// Probes for the model-backed features. Starts the mock server itself.
// Usage: cd tests && node ai.mjs [section...]   (sections: core rag compl vision log data fixes photo file audit record)
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8796, BASE = `http://127.0.0.1:${PORT}`, MOCK = `${BASE}/mock`;
// rooms=0: the lab as the plain page (the walk-in 3D rooms have their own suite, tests/rooms.mjs integration).
const APP = (q = '') => `${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}&rooms=0&i18n=all${q}`;
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);

const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
// Without this a failed browser launch leaves the mock server running and the command never returns.
const browser = await chromium.launch().catch(e => { srv.kill(); throw e; });
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
// The three model labs always show the language-model bar (there is no method switch any more).
async function modelOn(p) { await p.waitForSelector('#aiBar'); }
// The vision lab is no language-model lab: the team trains a small model in the browser, with no Worker call.
// visReady: the photos and their grid numbers are in (#visTrain enabled). visDone: a trained result is on screen. trainVis: press the button, return #visRes' data attributes.
const visReady = p => p.waitForFunction(() => { const x = document.querySelector('#visTrain'); return x && !x.disabled; }, null, { timeout: 60000 });
const visDone = p => p.waitForFunction(() => { const r = document.querySelector('#visRes'); return r && r.dataset.trained === 'true' && !X.visBusy; }, null, { timeout: 60000 });
const visData = p => p.$eval('#visRes', e => ({ ...e.dataset }));
const trainVis = async p => { await visReady(p); await p.click('#visTrain'); await visDone(p); return visData(p); };
// The numbers of the default settings (30 photos, 100 rounds, brightness + detail, threshold 50%) on the real photos: found / false alarms / type named right.
const VIS_DEFAULT = { val: '16/18/15/42', test: '15/18/9' };
const visNums = d => [d.found, d.total, d.fp, d.typeok].join('/');
// The knowledge assistant: #ragBase's data attributes; buildBase presses the build button and waits for the built base.
const base = p => p.$eval('#ragBase', e => ({ ...e.dataset }));
const buildBase = async p => { await p.click('#ragBuildBtn'); await p.waitForFunction(() => document.querySelector('#ragBase').dataset.built === 'true' && !RAGB.busy, null, { timeout: 20000 }); };
const aiState = async p => { await modelOn(p); return p.$eval('#aiBar', e => e.dataset.aiState); };
async function connect(p, code = 'test-code') {
  await modelOn(p);
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
    const r = await p.evaluate(async () => { const x = await callModel({ messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[PROCES-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return { data: x.data, cost: x.usage.cost, inTok: x.usage.in, ms: x.ms, model: x.model }; });
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
    const rec = await p.evaluate(async () => { await callModel({ model: 'deepseek', messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[PROCES-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return aiRecordedJSON(); });
    await mock('replay', { method: 'POST', body: rec });
    await p.close();
    const ctx = await browser.newContext(); const q = await ctx.newPage(); q.errs = [];
    await q.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('http://127.0.0.1:9')}&rooms=0&i18n=all#/lab/rag`);
    await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await q.evaluate(() => { S.ai.code = 'test-code'; S.ai.model = 'deepseek'; });
    const rp = await q.evaluate(async () => { const x = await callModel({ messages: [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[PROCES-01 §1] Szew co 30 minut.\nPytanie: jak często?' }] }); return { replayed: x.replayed, a: x.data && x.data.answer }; });
    ok('unreachable Worker -> answer from replay.json', rp.replayed === true && rp.a === 'Szew co 30 minut.', JSON.stringify(rp));
    const miss = await q.evaluate(() => callModel({ messages: [{ role: 'user', content: 'never recorded' }] }).then(() => 'resolved', e => e.kind));
    ok('unreachable Worker, not in replay -> network error', miss === 'network', miss);
    await ctx.close();
    const ctx3 = await browser.newContext(); const q3 = await ctx3.newPage();
    await q3.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('http://127.0.0.1:9')}&rooms=0&i18n=all#/lab/rag`);
    await q3.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    const par = await q3.evaluate(async () => { S.ai.code = 'test-code'; S.ai.model = 'deepseek';
      const msgs = [{ role: 'system', content: 'Odpowiadaj na podstawie fragmentów.' }, { role: 'user', content: '[PROCES-01 §1] Szew co 30 minut.\nPytanie: jak często?' }];
      const res = await runBatch([1, 2, 3, 4], () => callModel({ messages: msgs })).catch(e => e.kind); return Array.isArray(res) ? res.filter(x => x.ok && x.value.replayed).length : res; });
    ok('unreachable Worker: 4 parallel first calls all answered from replay.json', par === 4, String(par));
    await ctx3.close();
    p = await fresh('#/lab/forecast');
    ok('no aiBar on forecast lab', !(await p.$('#aiBar')));
    ok('no page errors (core)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 3: RAG (the knowledge assistant: build the base with embeddings, ask, scored run) ───
  if (run('rag')) {
    console.log('rag');
    await mock('reset'); await mock('embed-calls?reset=1');
    const emb = () => mock('embed-calls');
    let p = await fresh('#/lab/rag');
    await connect(p);
    ok('the assistant always answers with the language model: no generation switch', await p.evaluate(() => !document.querySelector('#ragGen') && lab().rag.gen === 'llm' && !!document.querySelector('#ragRun')));
    // before the build: nothing to search
    let b0 = await base(p);
    ok('fresh lab: base not built, all 12 documents selected, fragments counted locally', b0.built === 'false' && b0.state === 'none' && b0.docs === '12' && +b0.chunks > 50 && b0.dim === '256', JSON.stringify(b0));
    ok('before the build the run button is disabled and says why', await p.$eval('#ragRun', e => e.disabled) && /zbudujcie bazę wiedzy/i.test(await p.$eval('#ragNeedBase', e => e.textContent)));
    await p.click('#proto .chip[data-i="0"]'); await p.waitForTimeout(300);
    ok('a question before the build -> no call at all, the team is sent to the build button', (await mock('calls')).calls === 0 && (await emb()).calls === 0 && await p.evaluate(() => lab().rag.msgs.length === 0 && document.activeElement.id === 'ragBuildBtn' && /bazę wiedzy/.test(toastEl.textContent)));
    const frag = await p.evaluate(() => { const b = document.querySelector('#ragFrags [data-frag]'); b.click(); const t = inspEl.textContent; inspEl.close(); return { n: document.querySelectorAll('#ragFrags [data-frag]').length, open: /ARCH-01 §1/.test(t) && /WERSJA ARCHIWALNA/.test(t) }; });
    ok('the real fragments are listed and one opens to read', frag.n === +b0.chunks && frag.open, JSON.stringify(frag));
    // build: real requests in fixed batches of 16
    await buildBase(p);
    let b1 = await base(p), e1 = await emb();
    ok('build -> one embeddings request per 16 fragments, with the fixed model and size', e1.calls === Math.ceil(+b0.chunks / 16) && e1.texts === +b0.chunks && e1.last.model === 'openai/text-embedding-3-small' && e1.last.dimensions === 256, JSON.stringify({ calls: e1.calls, texts: e1.texts }));
    ok('built base publishes documents, fragments, vector size, calls and cost', b1.built === 'true' && b1.state === 'ready' && b1.docs === '12' && b1.chunks === b0.chunks && b1.dim === '256' && b1.source === 'calls' && +b1.calls === e1.calls && +b1.cost > 0, JSON.stringify(b1));
    ok('usage line names the embedding model, calls, tokens and cost', /text-embedding-3-small · \d+ wywoł\S+ · [\d\s ]+ token\S+ · \$/.test(await p.$eval('#ragBaseUse', e => e.textContent)), await p.$eval('#ragBaseUse', e => e.textContent));
    const stg = await p.$$eval('#ragPipe li', l => Object.fromEntries(l.map(e => [e.dataset.stage, e.dataset.state])));
    ok('pipeline strip: the four build stages are done, the answer stages wait for a question', ['docs', 'chunk', 'embed', 'store'].every(k => stg[k] === 'done') && ['q', 'qvec', 'search', 'ctx', 'llm', 'ans'].every(k => stg[k] === 'idle'), JSON.stringify(stg));
    const mp = await p.evaluate(() => { const pts = [...document.querySelectorAll('#ragMapSvg circle.rag-pt')]; pts[5].dispatchEvent(new MouseEvent('click', { bubbles: true })); return { n: pts.length, docs: new Set(pts.map(c => c.dataset.doc)).size, cols: new Set(pts.map(c => c.getAttribute('fill'))).size, info: document.querySelector('#ragMapInfo').dataset.frag, txt: document.querySelector('#ragMapInfo').textContent.length }; });
    ok('map: one point per fragment, one colour per document, a click shows the fragment', mp.n === +b1.chunks && mp.docs === 12 && mp.cols === 12 && mp.info === '5' && mp.txt > 40, JSON.stringify(mp));
    const tf = await p.evaluate(() => { const j = JSON.stringify(team()); return { fit: lab().rag.fit, sig: ragBaseSig(lab().rag), bytes: j.length, vec: /embedding|Float32/.test(j), built: ragBuilt(), steps: labStepState('rag').build }; });
    ok('team state keeps the settings and the build signature, never the vectors', !!tf.fit && tf.fit === tf.sig && tf.fit.length <= 20 && tf.bytes < 6000 && !tf.vec && tf.built && tf.steps === true, JSON.stringify(tf));
    // one question, step by step
    let c0 = (await mock('calls')).calls, ec = (await emb()).calls;
    await p.click('#proto .chip[data-i="0"]');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a').length >= 1 && !document.querySelector('#chat .msg.a.pending'));
    let st = await mock('calls'), e2 = await emb();
    ok('chat question -> one embeddings call for the question and one model call with fragments', st.calls === c0 + 1 && e2.calls === ec + 1 && e2.last.input.length === 1 && /170 g/.test(e2.last.input[0]) && /\[[A-Z]+-0\d §[\d–]+ · /.test(st.last.messages[1].content) && /opisów procesów/.test(st.last.messages[0].content), JSON.stringify({ chat: st.calls - c0, embed: e2.calls - ec }));
    ok('answer shows model, tokens and cost', /DeepSeek/.test(await p.$eval('#chat .msg.a:last-child .ai-cost', e => e.textContent)));
    const rt = await p.evaluate(() => { const rows = [...document.querySelectorAll('#ragScores li')], sc = rows.map(r => +r.dataset.score), R = X.ragLast, L = lab().rag;
      const q = R.qv, v = RAGB.vec[R.sc[0].i]; let d = 0, a = 0, b = 0; for (let i = 0; i < q.length; i++) { d += q[i] * v[i]; a += q[i] * q[i]; b += v[i] * v[i]; }
      return { rows: rows.length, chunks: RAGB.ch.length, sorted: sc.every((x, i) => !i || x <= sc[i - 1]), cos: d / Math.sqrt(a * b), top: sc[0], used: rows.filter(r => r.dataset.used === 'true').map(r => +r.dataset.rank), k: L.k, min: L.min, usedOk: rows.filter(r => r.dataset.used === 'true').every(r => +r.dataset.score >= L.min), d: { ...document.querySelector('#ragRetr').dataset }, ctx: document.querySelector('#ragCtx').dataset.n, cited: rows.filter(r => r.dataset.cited === 'true').length, qvec: document.querySelector('#ragQVec').textContent }; });
    ok('retrieval view: a score for every fragment, best first, the top one is the exact cosine', rt.rows === rt.chunks && rt.sorted && Math.abs(rt.cos - rt.top) < 1e-4 && rt.d.state === 'done' && +rt.d.scores === rt.chunks, JSON.stringify({ rows: rt.rows, cos: rt.cos, top: rt.top }));
    ok('retrieval view: at most k fragments at or above the threshold go to the model', rt.used.length > 0 && rt.used.length <= rt.k && rt.usedOk && rt.used.every(r => r <= rt.k) && +rt.ctx === rt.used.length && +rt.d.used === rt.used.length, JSON.stringify(rt.used));
    ok('retrieval view: the question vector with its size and the real embedding call', /256 liczb/.test(rt.qvec) && /text-embedding-3-small · \d+ token/.test(rt.qvec), rt.qvec.slice(0, 200));
    ok('retrieval view: the fragment the model cited is marked', rt.cited >= 1, String(rt.cited));
    const sent = st.last.messages.map(m => `[${m.role}]\n${m.content}`).join('\n\n');
    ok('prompt panel shows exactly the request that was sent', await p.$eval('#ragPrompt pre', e => e.textContent) === sent);
    const stg2 = await p.$$eval('#ragPipe li', l => Object.fromEntries(l.map(e => [e.dataset.stage, e.dataset.state])));
    ok('pipeline strip: every answer stage is done after the question', ['q', 'qvec', 'search', 'ctx', 'llm', 'ans'].every(k => stg2[k] === 'done'), JSON.stringify(stg2));
    ok('map shows the question and marks the fragments it found', await p.evaluate(() => !!document.querySelector('#ragMapQ') && document.querySelectorAll('#ragMapSvg circle[data-used="true"]').length === ragPick(X.ragLast.sc, lab().rag.k, lab().rag.min).length));
    // the sliders re-select from the real scores without a call
    c0 = (await mock('calls')).calls; ec = (await emb()).calls;
    await p.$eval('#rk', e => { e.value = '1'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('k=1 -> one fragment selected, a note that the chat answer used other fragments, no call', await p.evaluate(() => document.querySelectorAll('#ragScores li[data-used="true"]').length === 1 && !!document.querySelector('#ragRetrChanged')) && (await mock('calls')).calls === c0 && (await emb()).calls === ec);
    await p.$eval('#rk', e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.$eval('#rm', e => { e.value = '0.8'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.fill('#qi', 'Jaka jest pogoda w Warszawie?'); await p.press('#qi', 'Enter');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a:not(.pending)').length === 2);
    ok('no fragment at the threshold -> refusal without a model call (the question vector is still a real call)', (await mock('calls')).calls === c0 && (await emb()).calls === ec + 1 && /Nie znalazłem|nie wiem/i.test(await p.$eval('#chat .msg.a:last-child', e => e.textContent)) && await p.$eval('#ragCtx', e => e.dataset.n) === '0' && await p.$eval('#ragPipe li[data-stage="llm"]', e => e.dataset.state) === 'skip');
    ec = (await emb()).calls;
    await p.fill('#qi', 'Jaka jest pogoda w Warszawie?'); await p.press('#qi', 'Enter');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a:not(.pending)').length === 3);
    ok('the same question again -> its vector comes from the browser, no new embeddings call, and the view says so', (await emb()).calls === ec && /z pamięci tej przeglądarki/.test(await p.$eval('#ragQVec', e => e.textContent)));
    await p.$eval('#rm', e => { e.value = '0.3'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    // the instruction is the team's to change; the answer format stays
    await p.evaluate(() => { document.querySelector('#ragInsBox').open = true; });
    await p.fill('#ragIns', 'Odpowiadaj tylko z fragmentów. TESTOWE POLECENIE.');
    await p.click('#proto .chip[data-i="1"]');
    await p.waitForFunction(() => document.querySelectorAll('#chat .msg.a:not(.pending)').length === 4);
    st = await mock('calls');
    ok('edited instruction is sent, with the fixed JSON format appended', /^Odpowiadaj tylko z fragmentów\. TESTOWE POLECENIE\. Zwróć wyłącznie JSON: /.test(st.last.messages[0].content) && await p.evaluate(() => lab().rag.ins === 'Odpowiadaj tylko z fragmentów. TESTOWE POLECENIE.' && /zmienione/.test(document.querySelector('#ragInsState').textContent)), st.last.messages[0].content.slice(0, 120));
    await p.click('#ragInsReset');
    ok('reset -> the default instruction again', await p.evaluate(() => lab().rag.ins === null && document.querySelector('#ragIns').value === RAG_INS() && /domyślne/.test(document.querySelector('#ragInsState').textContent)));
    // scored run
    ec = (await emb()).calls;
    await p.click('#ragRun');
    await p.waitForSelector('#ragModelRes[data-ai-run="done"]', { timeout: 15000 });
    const d = await p.$eval('#ragModelRes', e => ({ ...e.dataset }));
    ok('model evaluation on dev: 24 in-scope + 4 out-of-scope', d.n === '24' && d.nOos === '4' && +d.calls > 0 && +d.cost > 0 && d.ok !== undefined, JSON.stringify(d));
    const er = (await emb()).calls - ec, mr = await p.evaluate(() => { const m = lab().rag.mrun; return { emb: m.emb, base: m.base === lab().rag.fit, ret: m.rows.every(r => Array.isArray(r.ret) && r.ret.length >= 5 && r.ret.every(x => typeof x.s === 'number' && typeof x.d === 'string')), line: document.querySelector('#ragModelOut .ai-cost').textContent }; });
    ok('scored run: one question vector per question not asked before, counted in the run', er === mr.emb.calls && er >= 25 && er <= 28 && mr.base && /w tym wektory pytań: text-embedding-3-small/.test(mr.line), JSON.stringify({ er, emb: mr.emb }));
    ok('scored run keeps the found fragments of every question', mr.ret);
    await p.evaluate(() => document.querySelector('#ragModelQ [data-chunks-m]').click());
    ok('"Znalezione fragmenty" opens the fragments with scores and what was sent', await p.evaluate(() => { const r = [...inspEl.querySelectorAll('.rag-chunk')], o = r.length >= 5 && r.every(x => x.dataset.score) && r.some(x => x.dataset.used === 'true') && !!inspEl.querySelector('.rc-txt'); inspEl.close(); return o; }));
    await p.check('#ragJudge');
    await p.click('#ragRun');
    await p.waitForSelector('#ragModelRes[data-ai-run="done"][data-judge-n]', { timeout: 15000 });
    const dj = await p.$eval('#ragModelRes', e => ({ ...e.dataset }));
    ok('judge adds a second call per answered question + agreement', +dj.judgeN > 0 && dj.agree !== undefined && +dj.calls > +d.calls, JSON.stringify(dj));
    await p.fill('#expNote', 'model test'); await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { cfg: l.cfg, calls: l.res.ai && l.res.ai.calls, txt: logText(l), cfgTxt: cfgText(l), legacy: legacyRun(l) }; });
    ok('save -> log entry with the whole configuration, model, calls and cost', lg.cfg.mode === 'llm' && lg.cfg.docs.length === 12 && lg.cfg.size === 40 && lg.cfg.overlap === 0 && lg.cfg.k === 3 && lg.cfg.min === 0.3 && lg.cfg.ins === null && lg.cfg.emb === 'openai/text-embedding-3-small' && !lg.legacy && lg.calls > 0 && /DeepSeek/.test(lg.txt) && /\$/.test(lg.txt), JSON.stringify(lg.cfg));
    ok('the log line names documents, fragment size, overlap, k, threshold and instruction', /dokumenty: 12 \(z wersją archiwalną\), fragment do 40 słów, zakładka 0 zd\., k=3, próg 0,30, polecenie domyślne, PL/.test(lg.cfgTxt), lg.cfgTxt);
    await p.$eval('#rk', e => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('changing k marks the model result stale but keeps the base', await p.$eval('#ragModelRes', e => e.dataset.stale) === 'true' && (await base(p)).built === 'true');
    // reload: the base comes back from the browser, without a call
    ec = (await emb()).calls;
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await p.waitForFunction(() => document.querySelector('#ragBase').dataset.state === 'ready', null, { timeout: 8000 });
    b1 = await base(p);
    ok('reload: the base is loaded from the browser (IndexedDB) with no call and says so', b1.built === 'true' && b1.source === 'cache' && b1.calls === '0' && (await emb()).calls === ec && /z pamięci tej przeglądarki, bez nowych wywołań/.test(await p.$eval('#ragBaseOk', e => e.textContent)), JSON.stringify(b1));
    ok('model run survives reload', await p.$eval('#ragModelRes', e => e.dataset.aiRun) === 'done');
    await p.$eval('#rk', e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    // a change to the documents or the split un-builds the base
    await p.uncheck('#ragDocs [data-doc-id="ARCH-01"]');
    let b2 = await base(p);
    ok('removing a document un-builds the base and says so', b2.built === 'false' && b2.state === 'stale' && b2.docs === '11' && +b2.chunks < +b1.chunks && /Ustawienia się zmieniły – zbudujcie bazę ponownie/.test(await p.$eval('#ragBaseMsg', e => e.textContent)) && await p.evaluate(() => !ragBuilt() && !document.querySelector('#ragMapSvg')), JSON.stringify(b2));
    ok('un-built base: run disabled, nothing ready to save, chat sends the team to the build', await p.$eval('#ragRun', e => e.disabled) && await p.$eval('#expReady', e => e.dataset.state) === 'unchanged' && /zbudujcie bazę ponownie/.test(await p.$eval('#ragNeedBase', e => e.textContent)));
    await buildBase(p);
    ok('rebuild without the archived document: every vector is already in the browser, no request', (await emb()).calls === ec && (await base(p)).source === 'cache' && await p.evaluate(() => RAGB.ch.every(c => c.doc !== 'ARCH-01')));
    await p.$eval('#rcs', e => { e.value = '80'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    b2 = await base(p);
    ok('a larger fragment size re-splits the documents and un-builds the base', b2.built === 'false' && +b2.chunks < +b1.chunks && await p.$eval('#ragChunks', e => e.dataset.size === '80' && +e.dataset.avg > 40), JSON.stringify(b2));
    await p.$eval('#rov', e => { e.value = '1'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('overlap of one sentence: fragments start with the previous fragment\'s last sentence', await p.evaluate(() => { const L = lab().rag, ch = ragChunk(ragDocIds(L), L.size, L.overlap), o = ch.filter(c => c.ovText); return o.length > 10 && o.every(c => c.text.startsWith(c.ovText) && ch[c.i - 1].text.endsWith(c.ovText)); }));
    // a failed request: nothing is built, the vectors that arrived stay, a second try asks only for the missing batch
    await mock('reset?fail=' + encodeURIComponent('F-20')); ec = (await emb()).calls;
    await p.click('#ragBuildBtn');
    await p.waitForFunction(() => !RAGB.busy && !AIS.run && /brakujące/.test(document.querySelector('#ragBaseMsg').textContent), null, { timeout: 15000 });
    b2 = await base(p);
    ok('a failed embeddings request -> base not built, a plain message', b2.built === 'false' && await p.evaluate(() => !ragBuilt()), JSON.stringify(b2));
    await mock('reset'); const eFail = (await emb()).calls;
    await buildBase(p);
    ok('second try asks only for the batch that failed', (await emb()).calls === eFail + 1 && (await base(p)).built === 'true', String((await emb()).calls - eFail));
    await mock('reset?delay=400');
    await p.click('#ragRun'); await p.waitForTimeout(150);
    await p.click('#nav button[data-v=home]'); await p.click('#toast .toast-act'); await p.waitForTimeout(1200);
    ok('navigating away mid-run asks, then cancels cleanly', !p.errs.length && await p.evaluate(() => AIS.run === null && S.view === 'home'), p.errs.join(' | '));
    await mock('reset');
    ok('no page errors (rag)', !p.errs.length, p.errs.join(' | '));
    await p.close();
    // the recorded answers: a default build recorded here is replayed when the Worker is unreachable
    p = await fresh('#/lab/rag'); await connect(p); await buildBase(p);
    const rec = await p.evaluate(() => aiRecordedJSON());
    await mock('replay', { method: 'POST', body: rec });
    await p.close();
    const ctxR = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const q = await ctxR.newPage(); q.errs = [];
    q.on('pageerror', e => q.errs.push(e.message));
    await q.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent('http://127.0.0.1:9')}&rooms=0&i18n=all#/lab/rag`);
    await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await q.evaluate(() => { S.ai.code = 'test-code'; S.ai.model = 'deepseek'; save(); render(); });
    await q.click('#ragBuildBtn');
    await q.waitForFunction(() => document.querySelector('#ragBase').dataset.built === 'true', null, { timeout: 15000 }).catch(() => {});
    const rb = await q.evaluate(() => ({ d: { ...document.querySelector('#ragBase').dataset }, use: (document.querySelector('#ragBaseUse') || {}).textContent, replayed: AIS.replayed, n: RAGB.ch.length }));
    ok('unreachable Worker: the default base is built from replay.json and labelled as recorded', rb.d.built === 'true' && rb.replayed === true && /nagrane odpowiedzi: \d+/.test(rb.use) && rb.n === +b0.chunks, JSON.stringify(rb));
    await q.$eval('#rcs', e => { e.value = '60'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await q.click('#ragBuildBtn');
    await q.waitForFunction(() => !RAGB.busy && !!document.querySelector('#ragBaseMsg').textContent && document.querySelector('#ragBase').dataset.state !== 'building', null, { timeout: 15000 });
    ok('unreachable Worker: other settings were not recorded -> not built, the network message', await q.evaluate(() => document.querySelector('#ragBase').dataset.built === 'false' && AIS.err === 'network' && /Brak połączenia/.test(document.querySelector('#ragBaseMsg').textContent)), await q.$eval('#ragBaseMsg', e => e.textContent));
    ok('no page errors (rag, replay)', !q.errs.length, q.errs.join(' | '));
    await ctxR.close(); await mock('reset');
    const eEnd = (await emb()).calls;
    p = await fresh('#/lab/rag');
    await p.click('#ragBuildBtn'); await p.waitForTimeout(500);
    ok('no class code -> nothing is built and no vector is asked for', await p.evaluate(() => document.querySelector('#ragBase').dataset.built === 'false' && !lab().rag.fit && !AIS.run) && (await emb()).calls === eEnd);
    ok('no class code -> the participant is told about the class code', await p.evaluate(() => /kod zajęć|kodu zajęć/i.test(toastEl.textContent + document.querySelector('#aiStatus').textContent) || document.activeElement.id === 'aiCode'), await p.evaluate(() => toastEl.textContent + ' | ' + document.querySelector('#aiStatus').textContent));
    await p.click('#proto .chip[data-i="0"]'); await p.waitForTimeout(300);
    ok('no base -> no answer is made up: nothing is added to the chat', await p.evaluate(() => lab().rag.msgs.length === 0 && document.querySelectorAll('#chat .msg.a:not(.pending)').length === 0 && !AIS.run));
    ok('no page errors (rag, no code)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 4: complaints ───
  if (run('compl')) {
    console.log('compl');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/complaints', '&trainer=1'); // trainer mode: the test opens without a saved experiment
    await connect(p);
    const nc = await p.evaluate(() => [normCategory('Damaged can'), normCategory('xyz'), normCategory(' SMELL '), normCategory('Dostawa / faktura'), normCategory(null)]);
    ok('normCategory maps names and synonyms, else other', JSON.stringify(nc) === JSON.stringify(['damage', 'other', 'smell', 'delivery', 'other']), JSON.stringify(nc));
    ok('no method switch; the default instruction mentions PROCES-04', await p.evaluate(() => !document.querySelector('#cMethod, [id^=kw_], #kwSafety, #cStats') && lab().compl.method === 'llm') && /PROCES-04/.test(await p.$eval('#cPrompt', e => e.value)));
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
    ok('no model-versus-model comparison in the lab', !(await p.$('#cCmp, #cCmpOut')) && !/Porównajcie modele|Compare models/.test(await p.$eval('#proto', e => e.textContent)));
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
    ok('runs, versions and curve survive reload', await p.$$eval('#cHist tbody tr', t => t.length) === 4 && await p.$$eval('#cVer option', o => o.length) === 2 && !!(await p.$('#cCurveOut svg')));
    await p.click('#rv');
    ok('after hiding the test the instruction is editable again; still no rules view', await p.evaluate(() => !lab().compl.revealed && !document.querySelector('#cPrompt').disabled && !document.querySelector('#kw_damage, #cMethod')));
    ok('no page errors (compl)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Vision: a model trained in the browser, no language model ───
  if (run('vision')) {
    console.log('vision');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/vision');
    // Every request to the mock Worker from here on, page load included (the reload below).
    const reqs = []; p.on('request', r => { if (r.url().startsWith(MOCK + '/')) reqs.push(r.method() + ' ' + r.url().slice(MOCK.length)); });
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await p.waitForSelector('#visTrain');
    const bar = await p.evaluate(() => ({ slot: !!document.querySelector('#aiSlot'), bar: !!document.querySelector('#aiSlot #aiBar, #aiBar, #aiCode'), tracks: AI_TRACKS.join(), code: S.ai.code, demos: reqDemos('vision').join() }));
    ok('vision lab shows no AI bar and is no language-model track', !bar.bar && bar.tracks === 'rag,complaints' && bar.demos === 'split,metr', JSON.stringify(bar));
    ok('the language-model lab controls are gone', !(await p.$('#visRun, #visModelRes, #visShots, #vPrompt, #vPromptVer, #visHist, #visEst, #visMethod')));
    const un = await p.evaluate(() => ({ trained: document.querySelector('#visRes').dataset.trained, pts: document.querySelector('#visCurveBox').dataset.points, wait: !!document.querySelector('#visWait'), tune: document.querySelector('#visTune').hidden, fit: lab().vision.fit }));
    ok('before training: no result, no curve, nothing stored as trained', un.trained === 'false' && un.pts === '0' && un.wait && un.tune && un.fit === null, JSON.stringify(un));
    const d = await trainVis(p);
    ok('training needs no class code', bar.code === '' && d.trained === 'true', JSON.stringify(bar));
    ok('default training on the practice set: found 16 of 18, 15 false alarms', d.set === 'val' && visNums(d) === VIS_DEFAULT.val && d.n === '30' && d.rounds === '100' && d.thr === '0.5', JSON.stringify(d));
    const built = await p.evaluate(() => ({ pts: document.querySelector('#visCurveBox').dataset.points, lines: document.querySelectorAll('#visCurveBox svg polyline').length, read: !!document.querySelector('#visCurveRead'), msg: document.querySelector('#visTrainMsg').textContent, maps: [...document.querySelectorAll('#visLearnedBox .vis-heat figure')].map(f => f.dataset.type).join(), fit: lab().vision.fit, set: document.querySelector('#visSetName').textContent }));
    ok('learning curve has one point per round (data-points 100), two lines and its reading', built.pts === '100' && built.lines === 2 && built.read, JSON.stringify(built));
    ok('training message, three learned maps and the stored settings signature', /30/.test(built.msg) && /100/.test(built.msg) && built.maps === 'dent,label,code' && built.fit === '30|100|1|1' && /ćwiczeniowy/.test(built.set), JSON.stringify(built));
    const gal = await p.evaluate(() => { const t = [...document.querySelectorAll('#visGal .thumb')]; return { n: t.length, shown: t.filter(x => !x.hidden).length, wrong: t.filter(x => ['fp', 'fn'].includes(x.dataset.cls)).length }; });
    ok('gallery holds 60 thumbs and opens on the mistakes (2 missed + 15 false alarms)', gal.n === 60 && gal.wrong === 17 && gal.shown === 17, JSON.stringify(gal));
    await p.click('#visGal .thumb:not([hidden])');
    const conf = await p.$$eval('#visConf tbody tr', r => r.map(x => x.dataset.c + ':' + x.textContent.replace(/\s+/g, ' ')));
    ok('thumb click shows the confidence of the model for each of the four answers', conf.length === 4 && conf.map(c => c.split(':')[0]).join() === 'ok,dent,label,code' && conf.every(c => /\d+\s?%/.test(c)), JSON.stringify(conf));
    await p.fill('#expNote', 'vision trained'); await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { track: l.track, cfg: l.cfg, ai: 'ai' in l.res, val: l.res.val, test: l.res.test, txt: logText(l) }; });
    ok('save -> log entry of a trained model (cfg.mode train), no model, tokens or cost', lg.track === 'vision' && lg.cfg.mode === 'train' && lg.cfg.n === 30 && lg.cfg.rounds === 100 && lg.cfg.thr === 0.5 && !lg.ai && lg.val && lg.val.tp === 16 && lg.val.fp === 15 && lg.test === null && !/DeepSeek|Haiku|\$|token|nieczytelny|unreadable/i.test(lg.txt), JSON.stringify(lg));
    // The alarm threshold tunes the trained model: no new training, more alarms at a lower threshold.
    await p.$eval('#visThr', e => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    const lo = await visData(p);
    ok('lower threshold: still trained, more false alarms and never fewer defects found', lo.trained === 'true' && lo.thr === '0.2' && +lo.fp > 15 && +lo.found >= 16 && await p.evaluate(() => visTrained()), JSON.stringify(lo));
    await p.$eval('#visThr', e => { e.value = '50'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    // Changing a build setting untrains; setting it back restores the model.
    await p.click('#visN button[data-n="90"]');
    const ch = await p.evaluate(() => ({ trained: document.querySelector('#visRes').dataset.trained, msg: document.querySelector('#visTrainMsg').textContent }));
    await p.click('#visN button[data-n="30"]'); await visDone(p);
    ok('changing the number of photos untrains, setting it back restores the result', ch.trained === 'false' && /ponownie/.test(ch.msg) && visNums(await visData(p)) === VIS_DEFAULT.val, JSON.stringify(ch));
    // The final test: revealed after one saved experiment, shown at once from the trained model.
    await p.click('#visRv');
    await p.waitForFunction(() => document.querySelector('#visRes').dataset.set === 'test', null, { timeout: 10000 });
    const t = await visData(p);
    ok('test revealed -> result on the 60 test photos without a new training, view counted, settings locked', [t.found, t.total, t.fp].join('/') === VIS_DEFAULT.test && await p.evaluate(() => lab().vision.testViews === 1 && [...document.querySelectorAll('#visN button, #visRounds button, #visLook button, #visThr')].every(b => b.disabled)), JSON.stringify(t));
    await p.click('#visRv');
    ok('after hiding the test the settings are editable again', await p.evaluate(() => !lab().vision.revealed && [...document.querySelectorAll('#visN button, #visThr')].every(b => !b.disabled) && document.querySelector('#visRes').dataset.set === 'val'));
    ok('training, tuning, saving and the final test made ZERO requests to the Worker', reqs.length === 0 && (await mock('calls')).calls === 0, reqs.join(' | '));
    ok('no page errors (vision)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Task 6: log, restore, report ───
  if (run('log')) {
    console.log('log');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/complaints');
    await connect(p);
    await p.evaluate(() => { const L = lab().compl; L.shots = 2; L.kw.damage = 'custom'; save(); render(); });
    await p.click('#cRun'); await p.waitForSelector('#cRes[data-ai-run="done"]', { timeout: 20000 });
    await p.click('#sv');
    await p.evaluate(() => { const L = lab().compl; L.shots = 0; save(); });
    await p.click('#nav button[data-v=deliver]');
    await p.click('#logBox button[data-r]');
    let st = await p.evaluate(() => ({ m: lab().compl.method, s: lab().compl.shots, kw: lab().compl.kw.damage, view: S.view }));
    ok('restore complaints model entry -> 2 examples again, stored keywords of older files untouched', st.m === 'llm' && st.s === 2 && st.kw === 'custom' && st.view === 'lab', JSON.stringify(st));
    // Vision: a saved experiment of the trained model (no model calls), restored from the log; an entry of the old language-model lab is an older record.
    await p.goto(APP() + '#/lab/vision'); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    await p.evaluate(() => { const L = lab().vision; L.n = 90; L.rounds = 300; L.thr = .6; L.fit = visSig(L); save(); render(); });
    await visDone(p); // trained silently from the stored settings
    await p.fill('#expNote', 'vision train'); await p.click('#sv');
    const ve = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { cfg: l.cfg, ai: 'ai' in l.res, legacy: legacyRun(l), c: cfgText(l), r: resultText(l), t: logText(l), md: logLineMD(l) }; });
    ok('vision entry: cfg.mode train with the training settings', ve.cfg.mode === 'train' && ve.cfg.n === 90 && ve.cfg.rounds === 300 && ve.cfg.bright === 1 && ve.cfg.detail === 1 && ve.cfg.thr === 0.6 && !!ve.cfg.datasetKey && !ve.legacy, JSON.stringify(ve.cfg));
    ok('vision entry renders through cfgText / resultText / logText', ve.c === '90 zdjęć, 300 rund, model widzi: jasność + szczegóły, próg alarmu 60%' && /zestaw ćwiczeniowy: wykryte wady 17 z 18, fałszywe alarmy 1\b/.test(ve.r) && /17 z 18/.test(ve.t) && !/nieczytelny|starszy zapis/.test(ve.t + ve.md), JSON.stringify([ve.c, ve.r, ve.t]));
    ok('vision entry has no cost, tokens or model name', !ve.ai && !/\$|token|DeepSeek|Haiku|wywoła/i.test(ve.c + ve.r + ve.t + ve.md), JSON.stringify([ve.t, ve.md]));
    await p.evaluate(() => { const L = lab().vision; L.n = 30; L.rounds = 100; L.thr = .5; L.bright = 0; save(); });
    await p.click('#nav button[data-v=deliver]');
    const n = await p.$$eval('#logBox tr[data-log]', b => b.length);
    await p.click(`#logBox tr[data-log="${n - 1}"] button[data-r]`);
    st = await p.evaluate(() => { const L = lab().vision; return { n: L.n, r: L.rounds, b: L.bright, d: L.detail, thr: L.thr, fit: L.fit, rev: L.revealed, view: S.view, lab: S.sub.lab }; });
    ok('restore vision entry -> its training settings are back, the model is to be trained again', st.n === 90 && st.r === 300 && st.b === 1 && st.d === 1 && st.thr === 0.6 && st.fit === null && !st.rev && st.view === 'lab' && st.lab === 'vision', JSON.stringify(st));
    await p.click('#nav button[data-v=deliver]');
    const old = await p.evaluate(() => { const t = team(), m = { p: .7, r: .6, f1: .65, tp: 5, fp: 2, fn: 3, tn: 50 };
      const llm = { id: 'oldllm', ts: new Date().toISOString(), track: 'vision', note: '', testViews: 0, cfg: { mode: 'llm', model: 'deepseek/deepseek-v4.1-flash', ver: 'v1', shots: 4, set: 'val', datasetKey: 'x' }, res: { val: m, test: null, types: [['dent', 3, 4, 3], ['label', 1, 2, 1], ['code', 1, 2, 1]], primary: { m: 'wykryte wady (walidacja)', v: .6, hi: true, test: false } } };
      const rules = { id: 'oldrules', ts: new Date().toISOString(), track: 'vision', note: '', testViews: 0, cfg: { d: 30, s: 40, c: 50 }, res: { val: m, test: null, primary: { m: 'F1', v: .65, hi: true, test: false } } };
      t.log.push(llm, rules); save(); render();
      const row = id => { const i = t.log.findIndex(l => l.id === id), tr = document.querySelector(`#logBox tr[data-log="${i}"]`); return { restore: !!(tr && tr.querySelector('button[data-r]')), row: tr ? tr.textContent : '' }; };
      return { llm: { legacy: legacyRun(llm), t: logText(llm), ...row('oldllm') }, rules: { legacy: legacyRun(rules), t: logText(rules), ...row('oldrules') } }; });
    ok('an old {mode:llm} vision entry renders as "starszy zapis" and cannot be restored', old.llm.legacy && /starszy zapis/.test(old.llm.t) && /starszy zapis/.test(old.llm.row) && !old.llm.restore, JSON.stringify(old.llm));
    ok('an older rules vision entry renders as "starszy zapis" too', old.rules.legacy && /starszy zapis/.test(old.rules.t) && !old.rules.restore, JSON.stringify(old.rules));
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
        cats: Object.fromEntries(CK.map(k => [k, C.filter(c => c.category === k).length])), keys, hazards: [C.slice(0, 36), C.slice(36)].map(s => s.filter(c => c.hazard).length), trap: C.filter(c => /pachniało normalnie/i.test(c.text)).length > 0 && C.filter(c => /pachniało normalnie/i.test(c.text)).every(c => !c.hazard),
        engine: ['cSafetyRecall', 'cHazard', 'cEval'].filter(n => { try { return typeof (0, eval)(n) !== 'undefined'; } catch (e) { return false; } }), guide: typeof COMPL_GUIDE === 'function' && /transpor/i.test(COMPL_GUIDE()) };
    });
    ok('60 distinct complaints in 5 categories', d.n === 60 && d.distinct === 60 && Object.values(d.cats).every(v => v >= 8), JSON.stringify(d.cats));
    ok('transport damage labelled delivery, present in examples pool and dev 21-36', d.transportOk && d.transportPool >= 2 && d.transportEval >= 2, JSON.stringify(d));
    ok('mixed complaints follow the priority rule', d.mixedSmell && d.mixedLQ);
    ok('food-safety complaints in both parts (9 practice, 6 final test); "smelled normal" is no hazard', d.hazards.join() === '9,6' && d.trap, JSON.stringify(d.hazards));
    ok('the keyword-rule engine is gone', d.engine.length === 0, d.engine.join());
    ok('hidden fields not exported (id, product, text, category only)', JSON.stringify(d.keys) === JSON.stringify(['id', 'product', 'text', 'category']));
    ok('labelling guideline available and shown in the lab', d.guide && /transpor/i.test(await p.$eval('#proto', e => e.textContent)));
    await p.close();
  }
  // ─── Final review fixes ───
  if (run('fixes')) {
    console.log('fixes');
    await mock('reset?delay=5');
    let p = await fresh('#/lab/complaints');
    // Connect the way #aiConnect does, from the lab's own bar.
    await p.evaluate(() => { S.ai.code = 'test-code'; save(); aiCheck(); });
    await p.waitForTimeout(500);
    ok('complaints: connect -> ready, no errors', await aiState(p) === 'ready' && !p.errs.length, (await aiState(p)) + ' ' + p.errs.join(' | '));
    // The vision lab trains its own model: even with a class code connected it shows no AI bar.
    await p.click('#trackTabs button[data-k=vision]'); await p.waitForSelector('#visTrain');
    await p.waitForTimeout(300);
    ok('vision: a connected class code brings no AI bar to the lab, no errors', !(await p.$('#aiBar, #aiCode')) && await p.evaluate(() => S.sub.lab === 'vision' && !aiWanted('vision')) && !p.errs.length, p.errs.join(' | '));
    // failed calls are retried once, then left out of the metrics
    await mock('reset?delay=5&fail=' + encodeURIComponent('opóźnieniem'));
    await p.click('#trackTabs button[data-k=complaints]');
    await p.evaluate(() => { const L = lab().compl; L.shots = 0; L.revealed = false; save(); render(); });
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
    await p.evaluate(() => { const L = lab().rag; L.k = 2; L.judge = false; L.revealed = false; save(); render(); });
    await buildBase(p);
    await p.click('#ragRun'); await p.waitForTimeout(100);
    await p.$eval('#rk', e => { e.value = '5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForSelector('#ragModelRes[data-ai-run="done"]', { timeout: 20000 });
    const ks = (await mock('calls')).last.messages[1].content.match(/\[[A-Z]+-\d{2} §/g).length;
    ok('RAG run uses settings from its start (k=2) and is marked stale', ks <= 2 && await p.$eval('#ragModelRes', e => e.dataset.stale) === 'true', `passages=${ks}`);
    ok('no page errors (fixes)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── The photographs the vision lab trains and checks its model on ───
  if (run('photo')) {
    console.log('photo');
    await mock('reset?delay=5');
    const p = await fresh('#/lab/vision');
    // fields of older team files (rule thresholds, model runs): they must do no harm
    await p.evaluate(() => { const L = lab().vision; L.th = { d: 1, s: 2, c: 3 }; L.mruns = [{ id: 'old' }]; L.vsel = 'old'; L.method = 'llm'; save(); });
    await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
    const r = await p.evaluate(() => { const all = [...VIS.train, ...VIS.val, ...VIS.test], cnt = (set, t) => set.filter(i => i.type === t).length;
      return { src: VIS.featureSource, contract: document.documentElement.dataset.visionFeatures, n: VIS.photoCount, sets: [VIS.train, VIS.val, VIS.test].map(s => s.length).join(), urls: all.every(i => /^data:image\//.test(i.url)), body: { ...document.body.dataset },
        val: ['dent', 'label', 'code', 'ok'].map(t => cnt(VIS.val, t)), test: ['dent', 'label', 'code', 'ok'].map(t => cnt(VIS.test, t)), bad: VIS.val.every(i => i.bad === (i.type !== 'ok')),
        engine: ['visTh', 'visPred', 'visCalib', 'visRanges', 'visSens', 'visThFromSens', 'photoFeatureRaw', 'photoPixels'].filter(n => { try { return typeof (0, eval)(n) !== 'undefined'; } catch (e) { return false; } }), rng: 'rng' in VIS || 'calib' in VIS, pf: all.some(i => 'pf' in i || 'big' in i),
        llm: ['visMessages', 'visRunLLM', 'visSel', 'visBig', 'visExamples', 'normDefect', 'VIS_SYS', 'VSHOTS'].filter(n => { try { return typeof (0, eval)(n) !== 'undefined'; } catch (e) { return false; } }) }; });
    ok('all 210 photos loaded as data URLs (DOM contract says so)', r.src === 'photo' && r.contract === 'photo' && r.n === 210 && r.sets === '90,60,60' && r.urls, JSON.stringify(r));
    ok('body data attributes: status ready, 210 of 210 photos, no drawn fallback', r.body.visionStatus === 'ready' && r.body.visionExpected === '210' && r.body.visionPhotos === '210' && r.body.visionFallback === '0', JSON.stringify(r.body));
    ok('practice set and final test hold every defect type and good cans', r.val.every(n => n >= 2) && r.test.every(n => n >= 2) && r.bad, JSON.stringify([r.val, r.test]));
    ok('the pixel-rules engine and the language-model helpers are gone', r.engine.length === 0 && !r.rng && !r.pf && r.llm.length === 0, JSON.stringify([r.engine, r.rng, r.pf, r.llm]));
    const txt = await p.$eval('#proto', e => e.textContent);
    ok('lab text has no rules, thresholds or synthetic-image wording', !/syntetycznego obrazu|synthetic image|suwak|reguły pikseli|próg czułości/i.test(txt), txt.match(/.{0,60}(syntetycz|suwak|reguły pikseli|próg czułości).{0,60}/)?.[0] || '');
    const d1 = await trainVis(p);
    ok('every photo has its grid numbers (8 x 10 brightness + detail) before training', await p.evaluate(() => [...VIS.train, ...VIS.val, ...VIS.test].every(i => i.vf && i.vf.b.length === 80 && i.vf.e.length === 80 && i.vf.b.some(v => v !== 0))));
    ok('the model trained on the photos gives the default result (16 of 18, 15 false alarms)', visNums(d1) === VIS_DEFAULT.val, JSON.stringify(d1));
    await p.click('#visGal .gal-filter [data-gf=all]'); await p.click('#visGal .thumb[data-i="0"]');
    ok('a clicked thumbnail shows the photo, the true label and the model answer', await p.evaluate(() => { const d = document.querySelector('#visDetail'); return /^data:image\//.test(d.querySelector('img').src) && /Fakt/.test(d.textContent) && /Model/.test(d.textContent) && d.querySelectorAll('#visConf tbody tr').length === 4; }));
    const st0 = await p.evaluate(() => JSON.stringify(lab().vision));
    await p.reload(); await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
    await visDone(p); // no click: the model is trained again from the stored settings
    const d2 = await visData(p);
    ok('the trained result is the same after a reload, with its gallery; fields of older files do no harm', JSON.stringify(d2) === JSON.stringify(d1) && await p.evaluate(() => document.querySelectorAll('#visGal .thumb').length === 60 && document.querySelector('#visCurveBox').dataset.points === '100'), JSON.stringify([d1, d2]));
    ok('the reload stores the settings only, never weights or runs', await p.evaluate(() => { const L = lab().vision; return JSON.stringify(Object.keys(L).sort()); }) === JSON.stringify(['bright', 'detail', 'fit', 'n', 'revealed', 'rounds', 'testViews', 'thr']), st0);
    ok('the photo lab made no model call', (await mock('calls')).calls === 0);
    ok('no page errors (photo)', !p.errs.length, p.errs.join(' | '));
    await p.close();
  }
  // ─── Opened straight from disk (file://) ───
  if (run('file')) {
    console.log('file');
    const ROOT_DIR = path.join(HERE, '..');
    const visState = () => ({ status: document.body.dataset.visionStatus, src: VIS.featureSource, n: VIS.photoCount, key: VIS.datasetKey, reason: VIS.fallbackReason,
      sets: [VIS.train, VIS.val, VIS.test].map(s => s.length).join(), broken: [...VIS.train, ...VIS.val, ...VIS.test].filter(i => !String(i.url).startsWith('data:image/')).length });
    const openVision = async url => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.errs = [];
      p.on('pageerror', e => p.errs.push(e.message));
      await p.goto(url + (url.includes('?') ? '&' : '?') + 'rooms=0#/lab/vision');
      await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
      return p;
    };
    const h = await openVision(APP()); const viaHttp = await h.evaluate(visState), httpRes = await trainVis(h); await h.close();
    const p = await openVision(pathToFileURL(path.join(ROOT_DIR, 'rybex-ai-workshop.html')).href);
    const viaFile = await p.evaluate(visState);
    ok('file:// loads all 210 photos', viaFile.sets === '90,60,60' && viaFile.src === 'photo' && viaFile.n === 210 && viaFile.broken === 0, JSON.stringify(viaFile));
    ok('file:// photos are the same bytes as the served images (bundle up to date)', viaFile.key === viaHttp.key && viaHttp.src === 'photo', `${viaFile.key} vs ${viaHttp.key}`);
    const fileRes = await trainVis(p);
    ok('file:// the model trains to the default numbers (16 of 18, 15 false alarms)', visNums(fileRes) === VIS_DEFAULT.val, JSON.stringify(fileRes));
    ok('file:// and http give the same trained result', JSON.stringify(fileRes) === JSON.stringify(httpRes) && visNums(httpRes) === VIS_DEFAULT.val, JSON.stringify([fileRes, httpRes]));
    await p.click('#visGal .gal-filter [data-gf=all]'); await p.click('#visGal .thumb[data-i="0"]');
    ok('file:// the result gallery and the photo detail show the photo', /^data:image\/(jpeg|webp)/.test(await p.$eval('#visDetail img', e => e.src).catch(() => '')) && await p.$$eval('#visGal .thumb img', e => e.length === 60 && e.every(i => /^data:image\//.test(i.src))));
    ok('no page errors (file)', !p.errs.length, p.errs.join(' | '));
    await p.close();
    // Without the bundle next to it, the page falls back to drawn cans and says how to fix it.
    const lone = fs.mkdtempSync(path.join(os.tmpdir(), 'rybex-file-'));
    // the app without its photo bundle: the page, its styles and scripts, the icons; no assets/ folder at all
    fs.copyFileSync(path.join(ROOT_DIR, 'rybex-ai-workshop.html'), path.join(lone, 'rybex-ai-workshop.html'));
    for (const d of ['css', 'js']) fs.cpSync(path.join(ROOT_DIR, d), path.join(lone, d), { recursive: true });
    fs.mkdirSync(path.join(lone, 'vendor')); fs.copyFileSync(path.join(ROOT_DIR, 'vendor', 'icons.js'), path.join(lone, 'vendor', 'icons.js'));
    const q = await openVision(pathToFileURL(path.join(lone, 'rybex-ai-workshop.html')).href);
    const miss = await q.evaluate(visState);
    ok('file:// without the bundle -> drawn fallback, no errors', miss.src === 'synthetic' && miss.reason === 'file' && !q.errs.length, JSON.stringify(miss) + q.errs.join('|'));
    ok('file:// fallback text names the bundle command', /vision-bundle/.test(await q.$eval('#proto', e => e.textContent)));
    const drawn = await trainVis(q);
    ok('file:// on drawn cans the model still trains, no errors', drawn.trained === 'true' && drawn.total === '18' && !q.errs.length, JSON.stringify(drawn) + q.errs.join('|'));
    await q.close(); fs.rmSync(lone, { recursive: true, force: true });
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
        res: { acc, macro: acc, safety: 1, safetyFalse: 0, test: set === 'test' ? acc : null, primary: { m: set === 'test' ? 'trafność modelu (test)' : 'trafność modelu (dev)', v: acc, hi: true, test: set === 'test' } } });
      t.log.push(mk('a', 'dev', .9, 'v1', 0), mk('b', 'dev', .7, 'v2', 0), mk('c', 'test', .95, 'v2', 1), mk('d', 'test', .8, 'v1', 2));
      return reportFacts().bestTxt;
    });
    ok('report picks the best run by dev (90% = 32 of 36) and adds that configuration\'s test score (80% = 19 of 24, viewed 2×)', /kategorie 32 z 36/.test(best) && /kategorie 19 z 24/.test(best) && !/23 z 24/.test(best) && /2×/.test(best), best);
    const task = await p.evaluate(() => { const t = team(); t.track = null; t.log = [{ id: 'f', ts: '', track: 'forecast', note: '', testViews: 0, cfg: { p: 0, h: 6, trend: 1, season: 1 }, res: { mape: .1, mae: 5, slope: 1, trained: true, primary: { m: 'MAPE', v: .1, hi: false, test: true } } }]; return reportFacts().trackTxt; });
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
    await p.evaluate(() => go('lab', 'maint')); await p.click('#mtTrain'); await p.waitForSelector('#proto .conf', { state: 'attached' }); // scores show once the model is trained; folded in details.more-metrics
    const cm = await p.$$eval('#proto .conf', e => e.map(x => x.textContent).join(' '));
    ok('maintenance confusion matrix says failure, not defect', /awari/i.test(cm) && !/wada/i.test(cm), cm.slice(0, 160));
    const jl = await p.$$eval('#labJump button', b => b.map(x => x.textContent.trim()));
    ok('lab has jump links Dane / Budowa / Eksperyment / Wyniki', JSON.stringify(jl) === JSON.stringify(['Dane', 'Budowa', 'Eksperyment', 'Wyniki']), JSON.stringify(jl));
    await p.click('#labJump button[data-j="labMethod"]'); await p.waitForTimeout(700);
    const top = await p.$eval('#labMethod', e => e.getBoundingClientRect().top);
    ok('jump link brings the section just below the sticky bars', top >= 0 && top < 260, String(top));
    await p.evaluate(() => go('lab', 'rag')); await p.waitForSelector('#ragRun');
    const gl = await p.$$eval('.gloss', g => g.map(x => x.dataset.term));
    ok('glossary tips for the practice set and the final test; none for a baseline', ['dev', 'test-set'].every(t => gl.includes(t)) && !gl.includes('baseline'), JSON.stringify(gl));
    await p.focus('.gloss[data-term="dev"]');
    ok('glossary tip shows on keyboard focus', await p.$eval('.gloss[data-term="dev"] .gloss-tip', e => getComputedStyle(e).display !== 'none' && e.textContent.length > 20));
    await p.evaluate(() => go('lab', 'complaints')); await p.waitForSelector('#cRun');
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

  // ─── Task 21b: the page flow tools/record-replay.mjs depends on ───
  if (run('record')) {
    console.log('record');
    await mock('reset');
    // Each language-model lab opens with the AI bar and its run button: the tool needs no switch. The vision lab trains its own model and is not driven by the tool.
    for (const [k, runBtn] of [['rag', '#ragRun'], ['complaints', '#cRun']]) {
      const p = await fresh('#/lab/' + k);
      await p.evaluate(() => { S.team = 8; S.lang = 'pl'; save(); render(); });
      ok(`record ${k}: the code field is there from the start, no method switch`, !!(await p.$('#aiBar #aiCode')) && !(await p.$('#ragGen, #cMethod, #visMethod')));
      await p.fill('#aiCode', 'test-code');
      ok(`record ${k}: the code field takes input and connect is enabled`, await p.$eval('#aiCode', e => e.value) === 'test-code' && await p.$eval('#aiConnect', e => !e.disabled), k);
      await p.click('#aiConnect');
      await p.waitForFunction(() => document.querySelector('#aiBar').dataset.aiState === 'ready', null, { timeout: 5000 }).catch(() => {});
      ok(`record ${k}: connect -> ready, run control present`, await p.$eval('#aiBar', e => e.dataset.aiState) === 'ready' && !!(await p.$(runBtn)), await p.$eval('#aiBar', e => e.dataset.aiState));
      ok(`record ${k}: #aiModel is a select offering both models`, await p.$eval('#aiModel', e => e.tagName === 'SELECT' && ['deepseek', 'haiku'].every(v => [...e.options].some(o => o.value === v))));
      if (k === 'rag') ok('record rag: the build button the tool presses first is there and enabled once connected', await p.$eval('#ragBuildBtn', e => !e.disabled) && await p.$eval('#ragBase', e => e.dataset.built) === 'false');
      if (k === 'complaints') ok('record complaints: the learning-curve control exists, the model comparison is gone', !!(await p.$('#cCurve')) && !(await p.$('#cCmp')));
      ok(`record ${k}: no page errors`, !p.errs.length, p.errs.join(' | '));
      await p.close();
    }
    // A re-render and a lab change keep the AI bar and the run button.
    const p = await fresh('#/lab/complaints');
    await p.evaluate(() => { const L = lab().compl; save(); render(); });
    ok('record: a re-render keeps the AI bar and #cRun', !!(await p.$('#aiBar #aiCode')) && !!(await p.$('#cRun')));
    await p.evaluate(() => { go('lab', 'vision'); const L = lab().vision; save(); render(); });
    ok('record: the vision lab has no AI bar and no run button, only its training button', !(await p.$('#aiBar, #aiCode, #visRun')) && !!(await p.$('#visTrain')));
    await trainVis(p);
    ok('record: training the vision model records nothing for replay', await p.evaluate(() => AIS.rec.size === 0 && Object.keys(JSON.parse(aiRecordedJSON())).length === 0 && AIS.calls === 0) && (await mock('calls')).calls === 0, await p.evaluate(() => `rec=${AIS.rec.size} calls=${AIS.calls}`));
    const toolSrc = fs.readFileSync(path.join(HERE, '..', 'tools', 'record-replay.mjs'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    ok('record tool: its script drives rag and complaints only, never the vision lab', /#ragRun/.test(toolSrc) && /#cRun/.test(toolSrc) && !/#vis|lab\('vision'\)|visRun|vPrompt/.test(toolSrc));
    await p.close();
    // The tool's guards: a dry run (AI set) must name an OUT outside the repo's replay.json, and the app must really use AI.
    const ROOT = path.join(HERE, '..'), REPLAY = path.join(ROOT, 'replay.json'), TOOL = path.join(ROOT, 'tools', 'record-replay.mjs');
    const before = fs.readFileSync(REPLAY), mtime = fs.statSync(REPLAY).mtimeMs;
    const tool = env => spawnSync('node', [TOOL], { cwd: ROOT, env: { ...process.env, CC: 'test-code', ...env }, encoding: 'utf8', timeout: 120000 });
    const tmp = path.join(os.tmpdir(), `replay-probe-${process.pid}.json`);
    let r = tool({ AI: 'http://127.0.0.1:8800/mock', OUT: '' });
    ok('record tool: AI without OUT exits non-zero', r.status !== 0 && /OUT/.test(r.stderr), r.status + ' ' + r.stderr);
    r = tool({ AI: 'http://127.0.0.1:8800/mock', OUT: 'replay.json' });
    ok('record tool: OUT=replay.json (relative) refused', r.status !== 0 && /replay\.json/.test(r.stderr), r.status + ' ' + r.stderr);
    r = tool({ AI: 'http://127.0.0.1:8800/mock', OUT: path.join(ROOT, 'tools', '..', 'replay.json') });
    ok('record tool: OUT=<repo>/tools/../replay.json refused', r.status !== 0 && /replay\.json/.test(r.stderr), r.status + ' ' + r.stderr);
    r = tool({ AI: 'https://evil.example', OUT: tmp });
    ok('record tool: an AI URL the app ignores stops the tool before any run', r.status !== 0 && /ignored/.test(r.stderr) && !/done /.test(r.stdout) && !fs.existsSync(tmp), r.status + ' ' + r.stderr + r.stdout);
    ok('record tool: replay.json untouched', fs.readFileSync(REPLAY).equals(before) && fs.statSync(REPLAY).mtimeMs === mtime);
  }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
