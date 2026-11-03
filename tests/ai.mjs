// Probes for the model-backed features. Starts the mock server itself.
// Usage: cd tests && node ai.mjs [section...]   (sections: core rag compl vision log)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8796, BASE = `http://127.0.0.1:${PORT}`, MOCK = `${BASE}/mock`;
const APP = (q = '') => `${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}${q}`;
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);

const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };
const mock = (p, opt) => fetch(MOCK + '/' + p, opt).then(r => r.json());

async function fresh(hash = '#/lab/rag', q = '', vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(APP(q) + hash);
  await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 8000 });
  return p;
}
const aiState = p => p.$eval('#aiBar', e => e.dataset.aiState);
async function connect(p, code = 'test-code') {
  await p.fill('#aiCode', code); await p.click('#aiConnect');
  await p.waitForFunction(() => !['busy', 'nocode'].includes(document.querySelector('#aiBar').dataset.aiState), null, { timeout: 5000 });
}

try {
  // ─── Task 2: core ───
  if (run('core')) {
    console.log('core');
    await mock('reset');
    let p = await fresh();
    ok('aiBar present on RAG lab with state nocode', await aiState(p) === 'nocode');
    await connect(p, 'wrong');
    ok('wrong code -> error state + bad_code', await aiState(p) === 'error' && await p.$eval('#aiBar', e => e.dataset.aiError) === 'bad_code');
    await connect(p);
    ok('good code -> ready', await aiState(p) === 'ready');
    ok('team spend shown from status', /0[,.]01/.test(await p.$eval('#aiSpend', e => e.textContent)), await p.$eval('#aiSpend', e => e.textContent));
    const r = await p.evaluate(async () => { const x = await callModel({ messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[SOP-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return { data: x.data, cost: x.usage.cost, inTok: x.usage.in, ms: x.ms, model: x.model }; });
    ok('callModel returns parsed JSON + usage', r.data && r.data.answer === 'Szew co 30 minut.' && r.cost > 0 && r.inTok > 0 && r.ms >= 0 && r.model === 'deepseek/deepseek-v4.1-flash', JSON.stringify(r));
    const last = (await mock('calls')).last;
    ok('request asks for JSON and default model', last.response_format && last.response_format.type === 'json_object' && last.model === 'deepseek/deepseek-v4.1-flash');
    await p.selectOption('#aiModel', 'haiku');
    await p.evaluate(() => callModel({ messages: [{ role: 'user', content: 'x' }] }));
    ok('model select switches to Haiku', (await mock('calls')).last.model === 'anthropic/claude-haiku-5.5');
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('code and model persist after reload', await p.$eval('#aiCode', e => e.value) === 'test-code' && await p.$eval('#aiModel', e => e.value) === 'haiku');
    const bad = await p.evaluate(() => callModel({ messages: [{ role: 'user', content: 'y' }], model: 'deepseek' }).then(() => 'resolved', e => e.kind));
    ok('callModel accepts explicit model key', bad === 'resolved');
    // replay fallback: record, then point the app at an unreachable Worker
    const rec = await p.evaluate(async () => { await callModel({ model: 'deepseek', messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[SOP-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return aiRecordedJSON(); });
    await mock('replay', { method: 'POST', body: rec });
    await p.close();
    const ctx = await browser.newContext(); const q = await ctx.newPage(); q.errs = [];
    await q.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('http://127.0.0.1:9')}#/lab/rag`);
    await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await q.evaluate(() => { S.ai.code = 'test-code'; S.ai.model = 'deepseek'; });
    const rp = await q.evaluate(async () => { const x = await callModel({ messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[SOP-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return { replayed: x.replayed, a: x.data && x.data.answer }; });
    ok('unreachable Worker -> answer from replay.json', rp.replayed === true && rp.a === 'Szew co 30 minut.', JSON.stringify(rp));
    const miss = await q.evaluate(() => callModel({ messages: [{ role: 'user', content: 'never recorded' }] }).then(() => 'resolved', e => e.kind));
    ok('unreachable Worker, not in replay -> network error', miss === 'network', miss);
    await ctx.close();
    const ctx3 = await browser.newContext(); const q3 = await ctx3.newPage();
    await q3.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('http://127.0.0.1:9')}#/lab/rag`);
    await q3.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    const par = await q3.evaluate(async () => { S.ai.code = 'test-code'; S.ai.model = 'deepseek';
      const msgs = [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[SOP-01 §1] Szew co 30 minut.\nPytanie: jak często?' }];
      const res = await runBatch([1, 2, 3, 4], () => callModel({ messages: msgs })).catch(e => e.kind); return Array.isArray(res) ? res.filter(x => x.ok && x.value.replayed).length : res; });
    ok('unreachable Worker: 4 parallel first calls all answered from replay.json', par === 4, String(par));
    await ctx3.close();
    p = await fresh('#/lab/forecast');
    ok('no aiBar on forecast lab', !(await p.$('#aiBar')));
    ok('no page errors (core)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 3: RAG ───
  if (run('rag')) {
    console.log('rag');
    await mock('reset');
    let p = await fresh('#/lab/rag');
    await connect(p);
    await p.click('#ragGen button[data-g=llm]');
    ok('generation mode switch -> llm, persisted', await p.$eval('#ragGen button[data-g=llm]', b => b.getAttribute('aria-pressed')) === 'true' && await p.evaluate(() => lab().rag.gen) === 'llm');
    let c0 = (await mock('calls')).calls;
    await p.click('#proto .chip[data-i="0"]');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a').length >= 1 && !document.querySelector('#chat .msg.a.pending'));
    let st = await mock('calls');
    ok('chat question -> one model call with SOP passages', st.calls === c0 + 1 && /\[SOP-0\d §/.test(st.last.messages[1].content) && /SOP/.test(st.last.messages[0].content));
    ok('answer shows model, tokens and cost', /DeepSeek/.test(await p.$eval('#chat .msg.a:last-child .ai-cost', e => e.textContent)));
    ok('prompt card shows the request actually sent', /\[SOP-0\d §/.test(await p.$eval('#ragPrompt', e => e.textContent)));
    await p.$eval('#rm', e => { e.value = '0.6'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    c0 = (await mock('calls')).calls;
    await p.fill('#qi', 'Jaka jest pogoda w Warszawie?'); await p.press('#qi', 'Enter');
    await p.waitForTimeout(400);
    ok('no passage above min similarity -> refusal without a call', (await mock('calls')).calls === c0 && /Nie znalazłem|nie wiem/i.test(await p.$eval('#chat .msg.a:last-child', e => e.textContent)));
    await p.$eval('#rm', e => { e.value = '0.12'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#ragRun');
    await p.waitForSelector('#ragModelRes[data-ai-run="done"]', { timeout: 15000 });
    const d = await p.$eval('#ragModelRes', e => ({ ...e.dataset }));
    ok('model evaluation on dev: 12 in-scope + 3 out-of-scope', d.n === '12' && d.nOos === '3' && +d.calls > 0 && +d.cost > 0 && d.ok !== undefined, JSON.stringify(d));
    await p.check('#ragJudge');
    await p.click('#ragRun');
    await p.waitForSelector('#ragModelRes[data-ai-run="done"][data-judge-n]', { timeout: 15000 });
    const dj = await p.$eval('#ragModelRes', e => ({ ...e.dataset }));
    ok('judge adds a second call per answered question + agreement', +dj.judgeN > 0 && dj.agree !== undefined && +dj.calls > +d.calls, JSON.stringify(dj));
    await p.fill('#expNote', 'model test'); await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { mode: l.cfg.mode, calls: l.res.ai && l.res.ai.calls, txt: logText(l) }; });
    ok('save -> log entry with model, calls and cost', lg.mode === 'llm' && lg.calls > 0 && /DeepSeek/.test(lg.txt) && /\$/.test(lg.txt), JSON.stringify(lg));
    await p.$eval('#rk', e => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('changing k marks model result stale', await p.$eval('#ragModelRes', e => e.dataset.stale) === 'true');
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('model run survives reload', await p.$eval('#ragModelRes', e => e.dataset.aiRun) === 'done');
    await mock('reset?delay=400');
    await p.$eval('#rk', e => { e.value = '2'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#ragRun'); await p.waitForTimeout(150);
    await p.click('#nav button[data-v=home]'); await p.click('#toast .toast-act'); await p.waitForTimeout(1200);
    ok('navigating away mid-run asks, then cancels cleanly', !p.errs.length && await p.evaluate(() => AIS.run === null && S.view === 'home'), p.errs.join(' | '));
    await mock('reset');
    ok('no page errors (rag)', !p.errs.length, p.errs.join(' | '));
    await p.close();
    p = await fresh('#/lab/rag');
    await p.evaluate(() => { lab().rag.gen = 'llm'; save(); render(); });
    await p.click('#proto .chip[data-i="1"]');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a').length >= 1 && !document.querySelector('#chat .msg.a.pending'));
    ok('no code -> extractive fallback with a note', /121/.test(await p.$eval('#chat .msg.a:last-child', e => e.textContent)) && /kod zajęć/i.test(await p.$eval('#chat .msg.a:last-child', e => e.textContent)));
    ok('no page errors (rag, no code)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 4: complaints ───
  if (run('compl')) {
    console.log('compl');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/complaints');
    await connect(p);
    const nc = await p.evaluate(() => [normCategory('Damaged can'), normCategory('xyz'), normCategory(' SMELL '), normCategory('Dostawa / faktura'), normCategory(null)]);
    ok('normCategory maps names and synonyms, else other', JSON.stringify(nc) === JSON.stringify(['damage', 'other', 'smell', 'delivery', 'other']), JSON.stringify(nc));
    await p.click('#cMethod button[data-m=llm]');
    ok('method switch -> llm with default prompt mentioning SOP-04', await p.evaluate(() => lab().compl.method) === 'llm' && /SOP-04/.test(await p.$eval('#cPrompt', e => e.value)));
    let c0 = (await mock('calls')).calls;
    await p.click('#cRun');
    await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    let d = await p.$eval('#cRes', e => ({ ...e.dataset }));
    ok('dev run, 0 examples -> 36 complaints, 36 calls', d.n === '36' && d.shots === '0' && (await mock('calls')).calls - c0 === 36 && +d.acc > 0 && d.safety !== undefined, JSON.stringify(d));
    ok('list shows model predictions for 36 rows', await p.$$eval('#cList tbody tr', t => t.length) === 36);
    await p.click('#cList tbody tr:nth-child(3)');
    ok('draft panel shows the model reply', /mock/.test(await p.$eval('#cDraft', e => e.textContent)));
    await p.click('#cShots button[data-s="5"]');
    c0 = (await mock('calls')).calls;
    await p.click('#cRun');
    await p.waitForSelector('#cRes[data-ai-run="done"][data-shots="5"]', { timeout: 20000 });
    d = await p.$eval('#cRes', e => ({ ...e.dataset }));
    const last = (await mock('calls')).last;
    ok('5 examples -> evaluated on complaints 21-36 (16) with 5 example pairs', d.n === '16' && (await mock('calls')).calls - c0 === 16 && last.messages.length === 12 && last.messages[1].role === 'user' && last.messages[2].role === 'assistant', `${d.n} ${last.messages.length}`);
    const exIds = await p.evaluate(() => complExamples(5).map(r => r.id));
    ok('examples come only from complaints 1-20', exIds.every(i => i >= 1 && i <= 20) && new Set(exIds).size === 5, JSON.stringify(exIds));
    await p.fill('#cPrompt', (await p.$eval('#cPrompt', e => e.value)) + '\nKategoria to pierwszy problem opisany w zgłoszeniu.');
    await p.click('#cSaveVer');
    ok('save as new version -> v2 active', await p.$$eval('#cVer option', o => o.length) === 2 && await p.evaluate(() => lab().compl.active) === 'v2');
    await p.click('#cRun');
    await p.waitForSelector('#cRes[data-ai-run="done"][data-ver="v2"]', { timeout: 20000 });
    ok('history lists runs with prompt version', await p.$$eval('#cHist tbody tr', t => t.length) === 3 && /v2/.test(await p.$eval('#cHist tbody tr:last-child', e => e.textContent)));
    c0 = (await mock('calls')).calls;
    await p.click('#cCurve');
    await p.waitForSelector('#cCurveOut[data-points="5"]', { timeout: 30000 });
    ok('learning curve: 5 points x 16 complaints = 80 calls, chart drawn', (await mock('calls')).calls - c0 === 80 && !!(await p.$('#cCurveOut svg')));
    await p.click('#cCmp');
    await p.waitForSelector('#cCmpOut[data-rows="2"]', { timeout: 30000 });
    const cmp = await p.$eval('#cCmpOut', e => e.textContent);
    ok('compare models: DeepSeek and Haiku rows with cost per 1000', /DeepSeek/.test(cmp) && /Haiku/.test(cmp) && /1000/.test(cmp));
    await p.fill('#expNote', 'llm complaints'); await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { mode: l.cfg.mode, txt: logText(l) }; });
    ok('save -> log entry readable with model and cost', lg.mode === 'llm' && /DeepSeek|Haiku/.test(lg.txt) && !/nieczytelny|unreadable/.test(lg.txt), lg.txt);
    await p.click('#rv');
    await p.click('#cRun');
    await p.waitForSelector('#cRes[data-ai-run="done"][data-set="test"]', { timeout: 20000 });
    d = await p.$eval('#cRes', e => ({ ...e.dataset }));
    ok('test revealed -> run on 24 test complaints, view counted', d.n === '24' && await p.evaluate(() => lab().compl.testViews) === 1, JSON.stringify(d));
    ok('prompt editing locked while test visible', await p.$eval('#cPrompt', e => e.disabled));
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('runs, versions and curve survive reload', await p.$$eval('#cHist tbody tr', t => t.length) >= 6 && await p.$$eval('#cVer option', o => o.length) === 2 && !!(await p.$('#cCurveOut svg')));
    await p.click('#rv');
    await p.click('#cMethod button[data-m=rules]');
    ok('back to rules: keyword inputs return', !!(await p.$('#kw_damage')) && await p.evaluate(() => lab().compl.method) === 'rules');
    ok('no page errors (compl)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 5: vision ───
  if (run('vision')) {
    console.log('vision');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/vision');
    await connect(p);
    const nd = await p.evaluate(() => [normDefect('Dent'), normDefect('wgniecenie'), normDefect('none'), normDefect('smudged code'), normDefect('xyz'), normDefect(' Label shift')]);
    ok('normDefect maps synonyms, unknown -> null', JSON.stringify(nd) === JSON.stringify(['dent', 'dent', 'ok', 'code', null, 'label']), JSON.stringify(nd));
    await p.click('#visMethod button[data-m=llm]');
    ok('method switch -> llm', await p.evaluate(() => lab().vision.method) === 'llm');
    let c0 = (await mock('calls')).calls;
    await p.click('#visRun');
    await p.waitForSelector('#visModelRes[data-ai-run="done"]', { timeout: 20000 });
    let d = await p.$eval('#visModelRes', e => ({ ...e.dataset }));
    let last = (await mock('calls')).last;
    const imgs = m => m.flatMap(x => Array.isArray(x.content) ? x.content.filter(c => c.type === 'image_url') : []);
    ok('validation run: 60 images, 60 calls, F1 reported', d.n === '60' && d.set === 'val' && (await mock('calls')).calls - c0 === 60 && d.f1 !== undefined && +d.cost > 0, JSON.stringify(d));
    ok('request carries one 320x400 JPEG', imgs(last.messages).length === 1 && imgs(last.messages)[0].image_url.url.startsWith('data:image/jpeg'));
    ok('gallery shows 60 model-coloured thumbs', await p.$$eval('#visGal .thumb', t => t.length) === 60);
    await p.click('#visGal .thumb:nth-child(2)');
    ok('thumb click shows model reason', /mock/.test(await p.$eval('#visDetail', e => e.textContent)));
    await p.click('#visShots button[data-s="4"]');
    await p.click('#visRun');
    await p.waitForSelector('#visModelRes[data-ai-run="done"][data-shots="4"]', { timeout: 20000 });
    last = (await mock('calls')).last;
    ok('4 examples -> 4 labelled train images (one per class) + the query', last.messages.length === 10 && imgs(last.messages).length === 5 && /"defect"/.test(last.messages[2].content));
    const ex = await p.evaluate(() => visExamples(8).map(x => x.id + ':' + x.type));
    ok('examples come from the training set, balanced', ex.length === 8 && ex.every(s => s.startsWith('train_')) && ['ok', 'dent', 'label', 'code'].every(t => ex.filter(s => s.endsWith(':' + t)).length === 2), JSON.stringify(ex));
    const size = await p.evaluate(() => JSON.stringify(visMessages(8, VIS.val[0])).length);
    ok('8-example request stays under the Worker size limit', size < 380000, size);
    await p.fill('#expNote', 'vision llm'); await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { mode: l.cfg.mode, txt: logText(l) }; });
    ok('save -> readable log entry with model', lg.mode === 'llm' && /DeepSeek/.test(lg.txt) && !/nieczytelny|unreadable/.test(lg.txt), lg.txt);
    await p.click('#visRv');
    await p.click('#visRun');
    await p.waitForSelector('#visModelRes[data-ai-run="done"][data-set="test"]', { timeout: 20000 });
    ok('test revealed -> run on 60 test images, view counted', await p.evaluate(() => lab().vision.testViews) === 1 && await p.$eval('#visModelRes', e => e.dataset.n) === '60');
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready') && document.body.dataset.visionStatus === 'ready');
    ok('model runs survive reload', await p.$eval('#visModelRes', e => e.dataset.aiRun) === 'done' && await p.$$eval('#visHist tbody tr', t => t.length) === 3);
    await p.click('#visRv');
    await p.click('#visMethod button[data-m=rules]');
    ok('back to rules: threshold sliders return', !!(await p.$('#vd')));
    ok('no page errors (vision)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 6: log, restore, report ───
  if (run('log')) {
    console.log('log');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/complaints');
    await connect(p);
    await p.evaluate(() => { const L = lab().compl; L.method = 'llm'; L.shots = 2; L.kw.damage = 'custom'; save(); render(); });
    await p.click('#cRun'); await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    await p.click('#sv');
    await p.evaluate(() => { const L = lab().compl; L.method = 'rules'; L.shots = 0; save(); });
    await p.click('#nav button[data-v=deliver]');
    await p.click('#logBox button[data-r]');
    let st = await p.evaluate(() => ({ m: lab().compl.method, s: lab().compl.shots, kw: lab().compl.kw.damage, view: S.view }));
    ok('restore complaints model entry -> llm mode, 2 examples, keywords untouched', st.m === 'llm' && st.s === 2 && st.kw === 'custom' && st.view === 'lab', JSON.stringify(st));
    await p.goto(APP() + '#/lab/vision'); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await p.evaluate(() => { const L = lab().vision; L.method = 'llm'; L.vshots = 4; L.th = { d: 1, s: 2, c: 3 }; save(); render(); });
    await p.click('#visRun'); await p.waitForSelector('#visModelRes[data-ai-run="done"]', { timeout: 20000 });
    await p.click('#sv');
    await p.evaluate(() => { const L = lab().vision; L.method = 'rules'; L.vshots = 0; save(); });
    await p.click('#nav button[data-v=deliver]');
    const n = await p.$$eval('#logBox button[data-r]', b => b.length);
    await p.click(`#logBox tr[data-log="${n - 1}"] button[data-r]`);
    st = await p.evaluate(() => ({ m: lab().vision.method, s: lab().vision.vshots, th: lab().vision.th }));
    ok('restore vision model entry -> llm mode, 4 examples, thresholds untouched', st.m === 'llm' && st.s === 4 && st.th && st.th.d === 1, JSON.stringify(st));
    await p.click('#nav button[data-v=deliver]');
    const md = await p.evaluate(() => team().log.map(logLineMD).join('\n'));
    ok('report lines include model, calls and cost', /DeepSeek/.test(md) && /\$0/.test(md) && !/nieczytelny/.test(md));
    ok('record button exports replay JSON', await p.evaluate(() => Object.keys(JSON.parse(aiRecordedJSON())).length > 0));
    ok('no page errors (log)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Harder complaints data ───
  if (run('data')) {
    console.log('data');
    const p = await fresh('#/lab/complaints');
    const d = await p.evaluate(() => {
      const C = DATA.compl, txt = C.map(c => c.text), low = s => s.toLowerCase();
      const transport = C.filter(c => /kurier|paleta|w transporcie/i.test(c.text));
      const mixedSmell = C.filter(c => /dostawa|opóźnieni/i.test(c.text) && /zapach/i.test(c.text));
      const mixedLabelQuality = C.filter(c => /słon/i.test(c.text) && /daty ważności/i.test(c.text));
      const keys = Object.keys(C[0]);
      return { n: C.length, distinct: new Set(txt).size, transport: transport.length, transportOk: transport.every(c => c.category === 'delivery'), transportPool: transport.filter(c => c.id <= 20).length, transportEval: transport.filter(c => c.id > 20 && c.id <= 36).length,
        mixedSmell: mixedSmell.length && mixedSmell.every(c => c.category === 'smell' && c.hazard), mixedLQ: mixedLabelQuality.length && mixedLabelQuality.every(c => c.category === 'label'),
        cats: Object.fromEntries(CK.map(k => [k, C.filter(c => c.category === k).length])), keys, safetyAll: cSafetyRecall(C, SAFETY_KW), trap: C.filter(c => /pachniało normalnie/i.test(c.text)).every(c => !c.hazard && !cHazard(c.text, SAFETY_KW)),
        ruleDev: cEval(C.slice(0, 36), KW).acc, guide: typeof COMPL_GUIDE === 'function' && /transpor/i.test(COMPL_GUIDE()) };
    });
    ok('60 distinct complaints in 5 categories', d.n === 60 && d.distinct === 60 && Object.values(d.cats).every(v => v >= 8), JSON.stringify(d.cats));
    ok('transport damage labelled delivery, present in examples pool and dev 21-36', d.transportOk && d.transportPool >= 2 && d.transportEval >= 2, JSON.stringify(d));
    ok('mixed complaints follow the priority rule', d.mixedSmell && d.mixedLQ);
    ok('default safety keywords still catch every hazard; "smelled normal" is no hazard', d.safetyAll === 1 && d.trap);
    ok('keyword rules no longer near-perfect on dev (< 75%)', d.ruleDev < .75, d.ruleDev);
    ok('hidden fields not exported (id, product, text, category only)', JSON.stringify(d.keys) === JSON.stringify(['id', 'product', 'text', 'category']));
    ok('labelling guideline available and shown in the lab', d.guide && /transpor/i.test(await p.$eval('#proto', e => e.textContent)));
    await p.close();
  }
  // ─── Final review fixes ───
  if (run('fixes')) {
    console.log('fixes');
    await mock('reset?delay=5');
    let p = await fresh('#/lab/complaints');
    for (const [track, sel] of [['complaints', '#cMethod'], ['vision', '#visMethod']]) {
      await p.click(`#trackTabs button[data-k=${track}]`);
      await p.click(`${sel} button[data-m=llm]`); await p.click(`${sel} button[data-m=rules]`);
      await p.fill('#aiCode', 'test-code'); await p.click('#aiConnect');
      await p.waitForTimeout(500);
      ok(`${track}: model -> rules, then connect -> ready, no errors`, await aiState(p) === 'ready' && !p.errs.length, (await aiState(p)) + ' ' + p.errs.join(' | '));
    }
    // failed calls are retried once, then left out of the metrics
    await mock('reset?delay=5&fail=' + encodeURIComponent('opóźnieniem'));
    await p.click('#trackTabs button[data-k=complaints]');
    await p.evaluate(() => { const L = lab().compl; L.method = 'llm'; L.shots = 0; L.revealed = false; save(); render(); });
    const nFail = await p.evaluate(() => DATA.compl.slice(0, 36).filter(r => r.text.includes('opóźnieniem')).length);
    let c0 = (await mock('calls')).calls;
    await p.click('#cRun'); await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    let d = await p.$eval('#cRes', e => ({ ...e.dataset }));
    ok('failed calls retried once, excluded from metrics and reported', nFail > 0 && d.failed === String(nFail) && d.n === String(36 - nFail) && (await mock('calls')).calls - c0 === 36 + nFail, `nFail=${nFail} ${JSON.stringify(d)} calls=${(await mock('calls')).calls - c0}`);
    const runs0 = await p.evaluate(() => lab().compl.runs.length);
    await mock('reset?delay=5&fail=' + encodeURIComponent('Zgłoszenie'));
    await p.click('#cRun'); await p.waitForTimeout(300); await p.waitForFunction(() => !AIS.run, null, { timeout: 40000 });
    ok('run with most calls failing is not stored', await p.evaluate(() => lab().compl.runs.length) === runs0 && /nie powiodło|failed/i.test(await p.$eval('#toast', e => e.textContent)));
    // cached answers keep their list cost for projections; paid-now is 0
    await mock('reset?delay=5&cache=1');
    await p.click('#cRun'); await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    const r1 = await p.evaluate(() => { const r = complSel(lab().compl); return { cost: r.sum.cost, paid: r.sum.paid }; });
    await p.click('#cRun'); await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    const r2 = await p.evaluate(() => { const r = complSel(lab().compl); return { cost: r.sum.cost, paid: r.sum.paid, cached: r.sum.cached }; });
    ok('cached run: same list cost, paid now 0', r1.cost > 0 && Math.abs(r2.cost - r1.cost) < 1e-12 && r2.paid === 0 && r2.cached === 36, JSON.stringify([r1, r2]));
    // RAG: moving a slider mid-run does not mix settings
    await mock('reset?delay=300');
    await p.click('#trackTabs button[data-k=rag]');
    await p.evaluate(() => { const L = lab().rag; L.gen = 'llm'; L.k = 2; L.judge = false; L.revealed = false; save(); render(); });
    await p.click('#ragRun'); await p.waitForTimeout(100);
    await p.$eval('#rk', e => { e.value = '5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForSelector('#ragModelRes[data-ai-run="done"]', { timeout: 20000 });
    const ks = (await mock('calls')).last.messages[1].content.match(/\[SOP-/g).length;
    ok('RAG run uses settings from its start (k=2) and is marked stale', ks <= 2 && await p.$eval('#ragModelRes', e => e.dataset.stale) === 'true', `passages=${ks}`);
    ok('no page errors (fixes)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Pixel rules on the photographs ───
  if (run('photo')) {
    console.log('photo');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/vision');
    await p.evaluate(() => { const L = lab().vision; L.th = { d: 1, s: 2, c: 3 }; save(); });
    await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
    const r = await p.evaluate(() => {
      const th = visTh(), recall = (set, t) => { const x = set.filter(i => i.type === t); return x.filter(i => visPred(i.f, th)).length + '/' + x.length; };
      return { src: VIS.featureSource, contract: document.documentElement.dataset.visionFeatures, th, f1: { train: visEval(VIS.train, th).f1, val: visEval(VIS.val, th).f1 },
        val: { dent: recall(VIS.val, 'dent'), code: recall(VIS.val, 'code'), label: recall(VIS.val, 'label') },
        finite: [...VIS.train, ...VIS.val, ...VIS.test].every(i => ['dent', 'shift', 'code'].every(k => Number.isFinite(i.f[k]))) };
    });
    ok('all photos loaded -> rules measure the photos (DOM contract says so)', r.src === 'photo' && r.contract === 'photo' && r.finite, JSON.stringify(r));
    ok('thresholds saved for the old drawn-image features are dropped', r.th.d !== 1 && r.th.s !== 2 && r.th.c !== 3, JSON.stringify(r.th));
    ok('calibrated photo rules beat the "all defective" baseline on validation (F1 > 0.6)', r.f1.val > 0.6, JSON.stringify(r.f1));
    ok('borderline photos leave room for tuning (validation F1 below 1)', r.f1.val < 0.99, JSON.stringify(r.f1));
    ok('photo rules catch every dent and smudged code on validation', r.val.dent === '6/6' && r.val.code === '6/6', JSON.stringify(r.val));
    const txt = await p.$eval('#proto', e => e.textContent);
    ok('lab text no longer says the rules use the synthetic image', !/syntetycznego obrazu|synthetic image/i.test(txt), txt.match(/.{0,60}syntetycz.{0,60}/)?.[0] || '');
    await p.click('#visRes .thumb[data-i="0"]');
    ok('inspector shows photo feature names', /odstające|outlier/i.test(await p.textContent('#insp')));
    await p.keyboard.press('Escape');
    await p.$eval('#vd', e => { e.value = e.min; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.reload(); await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
    ok('a threshold set on the photo features survives reload', await p.evaluate(() => Math.abs(visTh().d - VIS.rng.dent[0]) < 1e-9));
    ok('no page errors (photo)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Audit fixes (2026-11-03) ───
  if (run('audit')) {
    console.log('audit');
    await mock('reset?delay=5');
    let p = await fresh('#/deliver');
    const best = await p.evaluate(() => {
      const t = team(); t.track = 'complaints'; t.log = [];
      const mk = (id, set, acc, ver, views) => ({ id, ts: new Date().toISOString(), track: 'complaints', note: '', testViews: views,
        cfg: { mode: 'llm', model: 'deepseek/deepseek-v4.1-flash', ver, shots: 0, set, prompt: 'h' + ver },
        res: { acc, macro: acc, safety: 1, safetyFalse: 0, base: .5, test: set === 'test' ? acc : null, primary: { m: set === 'test' ? 'trafność modelu (test)' : 'trafność modelu (dev)', v: acc, base: .5, hi: true, test: set === 'test' } } });
      t.log.push(mk('a', 'dev', .9, 'v1', 0), mk('b', 'dev', .7, 'v2', 0), mk('c', 'test', .95, 'v2', 1), mk('d', 'test', .8, 'v1', 2));
      return reportFacts().bestTxt;
    });
    ok('report picks the best run by dev (90%) and adds that configuration\'s test score (80%, viewed 2×)', /90/.test(best) && /80/.test(best) && !/95/.test(best) && /2×/.test(best), best);
    const task = await p.evaluate(() => { const t = team(); t.track = null; t.log = [{ id: 'f', ts: '', track: 'forecast', note: '', testViews: 0, cfg: { p: 0, h: 6, w: 3 }, res: { mape: {}, best: 'mean', primary: { m: 'MAPE', v: .1, base: .2, hi: false } } }]; return reportFacts().trackTxt; });
    ok('report task stays empty until the team picks one', /nie wybrano|not chosen/.test(task), task);
    const hdr = await p.evaluate(() => { const t = team(); t.track = 'forecast'; t.log.push({ id: 'r', ts: '', track: 'rag', note: '', testViews: 0, cfg: { k: 2 }, res: {} }); save(); render(); return document.querySelector('#tbProg').textContent; });
    ok('header counts experiments of the chosen task (1/3), not all labs', /1\/3/.test(hdr), hdr);
    const btns = await p.$$eval('#logBox tr[data-log] button', bs => bs.map(b => ({ t: b.textContent.trim(), title: b.title })));
    ok('log buttons say what they do (text + tooltip)', btns.length >= 3 && btns.every(b => b.t && b.title), JSON.stringify(btns));
    await p.click('#logBox button[data-d]');
    const ts = await p.$eval('#toast', e => ({ ms: +e.dataset.ms, hidden: e.hidden }));
    ok('undo toast stays at least 15 s', !ts.hidden && ts.ms >= 15000, JSON.stringify(ts));
    await p.hover('#toast');
    ok('toast pauses while hovered', await p.$eval('#toast', e => e.dataset.paused) === 'true');
    await p.mouse.move(5, 5);
    await p.evaluate(() => { S.team = 5; save(); render(); });
    await p.setInputFiles('#teamFile', { name: 't.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'rybex-ai-workshop', version: 2, team: 3, data: { name: 'Zespół Karp', log: [] } })) });
    await p.waitForFunction(() => /Karp/.test(document.querySelector('#toast').textContent));
    const tt = await p.$eval('#toast', e => e.textContent);
    ok('import asks first and names source team 3 and target team 5', /3/.test(tt) && /5/.test(tt) && await p.evaluate(() => team().name) !== 'Zespół Karp', tt);
    await p.click('#toast .toast-act');
    ok('confirming imports the file into team 5', await p.evaluate(() => S.team === 5 && team().name === 'Zespół Karp'));
    const pl = await p.evaluate(() => [1, 3, 5, 12, 22, 25].map(n => plural(n, ['wada', 'wady', 'wad'], ['defect', 'defects'])).join(','));
    ok('Polish plural helper', pl === 'wada,wady,wad,wad,wady,wad', pl);
    await p.evaluate(() => go('demos', 'split')); await p.waitForTimeout(200);
    const sp = await p.evaluate(() => { const st = [...document.querySelectorAll('#demo .stat')].find(s => /zbiorze testowym/.test(s.textContent)); if (!st) return 'missing'; const n = +st.querySelector('b').textContent, l = st.querySelector('span').textContent; return l === plural(n, ['wada w zbiorze testowym', 'wady w zbiorze testowym', 'wad w zbiorze testowym'], ['', '']) ? 'ok' : n + ' ' + l; });
    ok('split demo defect label agrees with the number', sp === 'ok', sp);
    await p.evaluate(() => go('demos', 'tok')); await p.waitForSelector('#tokOut .stat');
    const tk = await p.$$eval('#tokOut .stat', s => s.map(x => [x.querySelector('b').textContent, x.querySelector('span').textContent]));
    ok('token demo shows characters per token', tk.some(([v, l]) => /znaków na token/.test(l) && !/%/.test(v)), JSON.stringify(tk));
    await p.evaluate(() => go('lab', 'maint')); await p.waitForSelector('#proto .conf');
    const cm = await p.$$eval('#proto .conf', e => e.map(x => x.textContent).join(' '));
    ok('maintenance confusion matrix says failure, not defect', /awari/i.test(cm) && !/wada/i.test(cm), cm.slice(0, 160));
    const jl = await p.$$eval('#labJump button', b => b.map(x => x.textContent.trim()));
    ok('lab has jump links Dane / Metoda / Prototyp / Eksperymenty', JSON.stringify(jl) === JSON.stringify(['Dane', 'Metoda', 'Prototyp', 'Eksperymenty']), JSON.stringify(jl));
    await p.click('#labJump button[data-j="labMethod"]'); await p.waitForTimeout(700);
    const top = await p.$eval('#labMethod', e => e.getBoundingClientRect().top);
    ok('jump link brings the section just below the sticky bars', top >= 0 && top < 260, String(top));
    await p.evaluate(() => go('lab', 'complaints')); await p.waitForSelector('#cStats');
    const gl = await p.$$eval('.gloss', g => g.map(x => x.dataset.term));
    ok('glossary tips for baseline, macro-F1 and dev', ['baseline', 'macro-F1', 'dev'].every(t => gl.includes(t)), JSON.stringify(gl));
    await p.focus('.gloss[data-term="macro-F1"]');
    ok('glossary tip shows on keyboard focus', await p.$eval('.gloss[data-term="macro-F1"] .gloss-tip', e => getComputedStyle(e).display !== 'none' && e.textContent.length > 20));
    await p.click('#cMethod button[data-m=llm]');
    ok('few-shot has a glossary tip', await p.$$eval('.gloss[data-term="few-shot"]', g => g.length) > 0);
    ok('no page errors (audit UI)', !p.errs.length, p.errs.join(' | '));
    await p.close();

    const ctx2 = await browser.newContext(); const q = await ctx2.newPage();
    await q.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('https://evil.example')}#/home`);
    await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('?ai= pointing outside localhost is ignored', await q.evaluate(() => AI_URL === AI_DEFAULT_URL));
    await ctx2.close();

    await mock('reset?delay=800'); // 36 calls / 4 in parallel ≈ 7 s: long enough for the interruptions below
    p = await fresh('#/lab/complaints'); await connect(p);
    await p.click('#cMethod button[data-m=llm]');
    await p.click('#cRun'); await p.waitForTimeout(400);
    await p.click('#langSeg button[data-l=en]');
    ok('language switch during a run asks instead of cancelling', await p.evaluate(() => !!AIS.run && S.lang === 'pl') && !(await p.$eval('#toast', e => e.hidden)));
    await p.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue: localStorage.getItem(STORE_KEY) })));
    ok('background re-render waits for the run', await p.evaluate(() => !!AIS.run));
    await p.click('#nav button[data-v=home]');
    ok('navigation during a run asks instead of cancelling', await p.evaluate(() => !!AIS.run && S.view === 'lab'));
    await p.waitForFunction(() => !AIS.run, null, { timeout: 30000 });
    ok('run finished and was saved', await p.evaluate(() => lab().compl.runs.length) === 1);
    await p.click('#cRun'); await p.waitForTimeout(400);
    await p.click('#langSeg button[data-l=en]');
    await p.click('#toast .toast-act');
    ok('"cancel and continue" stops the run and switches language', await p.evaluate(() => !AIS.run && S.lang === 'en'));
    await p.click('#langSeg button[data-l=pl]');
    const hangText = await p.evaluate(() => DATA.compl[24].text);
    await mock('reset?delay=5&hang=' + encodeURIComponent(hangText));
    await p.evaluate(() => { AIS.timeoutMs = 400; });
    await p.click('#cRun');
    await p.waitForFunction(() => !AIS.run, null, { timeout: 30000 });
    const to = await p.evaluate(() => ({ runs: lab().compl.runs.length, failed: lab().compl.runs.at(-1).failed, state: AIS.state }));
    ok('one timed-out call is a per-item failure, not a lost connection', to.runs === 2 && to.failed === 1 && to.state !== 'offline', JSON.stringify(to));
    ok('no page errors (audit runs)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
