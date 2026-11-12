// Probes for the guided simulation path. Starts the mock server itself.
// Usage: cd tests && node guided.mjs [section...]   (sections: smoke state gloss recap story path quiz labstart visprompt)
// UX regression suite (ux-audit/regression.mjs) – NODE_PATH is ignored by ESM imports, so link the deps once:
//   ln -sfn ../tests/node_modules ux-audit/node_modules   (ux-audit/* is gitignored)
//   cd tests && node mock-server.mjs &  then  cd ../ux-audit && node regression.mjs; kill the server by PID
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8797, BASE = `http://127.0.0.1:${PORT}`, MOCK = `${BASE}/mock`;
const APP = (q = '') => `${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}${q}`;
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);

const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
// Without this a failed browser launch leaves the mock server running and the command never returns.
const browser = await chromium.launch().catch(e => { srv.kill(); throw e; });
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

async function fresh(hash = '#/home', q = '', vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage(); p.errs = [];
  // qz(t, ...demoKeys): marks those demo quizzes as answered correctly (a demo counts as done only after its quiz).
  await p.addInitScript(() => { window.qz = (t, ...ks) => ks.forEach(k => { t.quizzes[k] = { answers: Object.fromEntries(QUIZZES()[k].map(q => [q.id, q.answer])), first: {}, doneAt: 'x' }; }); });
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(APP(q) + hash);
  await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 8000 });
  return p;
}
// Runs fn in the page (it can reach the app's globals: S, team(), lab() ...), then persists and re-renders.
const seed = (p, fn) => p.evaluate(`(${fn})(); save(); render();`);

try {
  if (run('smoke')) { const p = await fresh();
    ok('smoke app ready, no errors', p.errs.length === 0, p.errs.join('|'));
    ok('smoke state readable', await p.evaluate(() => typeof team().name === 'string'));
    await p.close(); }
  if (run('state')) { const p = await fresh();
    const d = await p.evaluate(() => defaultTeam());
    ok('state v3 fields', ['goal','onboardedAt','seen','site','inbox','quizzes','challenges','risks','badges'].every(k => k in d) && 'decisions' in d.arch && Array.isArray(d.lab.vision.prompts));
    ok('state file version 3', await p.evaluate(() => FILE_VERSION) === 3);
    const m = await p.evaluate(() => { const old = { name: 'Stary', track: 'vision', log: [{ id: 'a', ts: '2026-11-01', track: 'vision', cfg: { x: 1 }, res: { primary: { v: .7, m: 'F1' } }, note: 'n' }], lab: { vision: { revealed: true, testViews: 2 } } }; return normTeam(old); });
    ok('state v2 file keeps log, reveal and views', m.log.length === 1 && m.lab.vision.revealed === true && m.lab.vision.testViews === 2 && m.goal === '' && m.site.newsRead === false);
    const junk = await p.evaluate(() => normTeam({ inbox: 'x', quizzes: 5, risks: [1], badges: { a: 1 }, site: null, goal: 7, arch: { decisions: 'no' }, inbox2: 1 }));
    ok('state junk values fall back to defaults', Array.isArray(junk.inbox) && junk.inbox.length === 0 && typeof junk.goal === 'string' && Array.isArray(junk.badges) && typeof junk.arch.decisions === 'object');
    const big = await p.evaluate(() => normTeam({ inbox: Array.from({ length: 50 }, (_, i) => ({ id: 'i' + i, ts: '', product: 0, cat: 'damage', text: 'x'.repeat(9000) })) }));
    ok('state inbox capped at 20 items and 2000 chars', big.inbox.length === 20 && big.inbox[0].text.length === 2000);
    ok('state base flag survives', await p.evaluate(() => normTeam({ log: [{ track: 'vision', base: true }] }).log[0].base) === true);
    await p.close(); }
  if (run('gloss')) { const p = await fresh('#/lab/vision');
    const ids = await p.evaluate(() => Object.keys(GLOSS()));
    ok('gloss at least 25 terms', ids.length >= 25, String(ids.length));
    ok('gloss every term has PL and EN definition', await p.evaluate(() => { const pl = GLOSS(); S.lang = 'en'; const en = GLOSS(); S.lang = 'pl'; return Object.keys(pl).every(k => pl[k].d && en[k].d && pl[k].d !== en[k].d); }));
    ok('gloss Polish inflection matched', await p.evaluate(() => /data-term="precision"/.test(glx('Niska precyzja i czułość')) && /data-term="recall"/.test(glx('wysoką czułością'))));
    ok('gloss first occurrence only', await p.evaluate(() => (glx('token token token').match(/class="gloss"/g) || []).length) === 1);
    ok('gloss glh leaves tags, code and attributes alone', await p.evaluate(() => { const h = glh('<b title="token">RAG</b> <code>token</code> <a href="#/demos/tok">token</a>'); return /title="token"/.test(h) && /<code>token<\/code>/.test(h) && /<a href="#\/demos\/tok">token<\/a>/.test(h) && /data-term="rag"/.test(h); }));
    ok('gloss no nested gloss', await p.evaluate(() => !/gloss-tip[^<]*<span class="gloss"/.test(glh(glx('baseline i F1')))));
    ok('gloss numbers untouched', await p.evaluate(() => glx('F1 0,73').includes('0,73')));
    ok('gloss terms on the lab page', await p.$$eval('#labMethod .gloss, #proto .gloss', e => e.length) >= 3);
    const tipShown = () => p.$eval('#proto .gloss .gloss-tip', e => getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
    const before = await tipShown(); await p.focus('#proto .gloss');
    ok('gloss tooltip reachable by keyboard', !before && await tipShown() && await p.$eval('#proto .gloss', e => e === document.activeElement), `before focus shown: ${before}`);
    await p.evaluate(() => go('demos', 'metr')); ok('gloss terms in the metrics demo', await p.$$eval('#demo .gloss', e => e.length) >= 2);
    for (const h of ['lab/vision', 'lab/maint', 'lab/complaints', 'demos/metr']) {
      await p.evaluate(h => { location.hash = '#/' + h; }, h); await p.waitForTimeout(400); await p.mouse.move(0, 0); await p.evaluate(() => document.activeElement && document.activeElement.blur());
      const shown = await p.$$eval('.gloss-tip', e => e.filter(t => getComputedStyle(t).display !== 'none').map(t => t.parentElement.dataset.term));
      ok(`gloss tips hidden until hover or focus: ${h}`, shown.length === 0 && await p.$$eval('.gloss', e => e.length) > 0, JSON.stringify(shown)); }
    await p.close(); }
  if (run('recap')) { const p = await fresh('#/lab/vision');
    await p.waitForSelector('#proto .recap');
    const r0 = await p.$eval('#proto .recap', e => ({ t: e.textContent, set: e.dataset.set, track: e.dataset.track }));
    ok('recap vision present on validation set', r0.track === 'vision' && r0.set === 'val' && /walidac/.test(r0.t), JSON.stringify(r0));
    await p.focus('#vd'); for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowRight');
    ok('recap follows the slider', r0.t !== await p.$eval('#proto .recap', e => e.textContent));
    ok('recap numbers equal the data contract', await p.evaluate(() => { const m = visEval(VIS.val, visTh()); const t = document.querySelector('#proto .recap').textContent; return t.includes(String(m.fn)) && t.includes(String(m.tp + m.fp)); }));
    for (const k of ['rag', 'complaints', 'forecast', 'maint']) { await p.evaluate(k => go('lab', k), k); await p.waitForSelector('#proto .recap'); ok(`recap on ${k}`, await p.$eval('#proto .recap', e => e.dataset.track) === k); }
    await p.evaluate(() => go('demos', 'metr')); ok('recap in the metrics demo', await p.$eval('#demo .recap', e => e.dataset.set) === 'demo');
    await p.evaluate(() => go('lab', 'vision')); await p.waitForSelector('#proto .recap');
    ok('headline shows two numbers, rest folded', await p.$$eval('#proto .headline .stat', e => e.length) === 2 && await p.$eval('#proto details.more-metrics', e => !e.open));
    for (const k of ['rag', 'complaints', 'forecast', 'maint']) { await p.evaluate(k => go('lab', k), k); await p.waitForSelector('#proto .recap');
      ok(`headline shows two numbers (${k})`, await p.$$eval('#proto .headline .stat', e => e.length) === 2, String(await p.$$eval('#proto .headline .stat', e => e.length))); }
    await p.evaluate(() => go('lab', 'vision')); await p.waitForSelector('#proto .recap');
    ok('confusion matrix has plain labels', /fałszywy alarm/i.test(await p.$eval('#proto details.more-metrics', e => e.textContent)));
    await p.click('#langSeg button[data-l=en]'); ok('recap in English', /validation/i.test(await p.$eval('#proto .recap', e => e.textContent)));
    ok('recap no page errors', !p.errs.length, p.errs.join('|'));
    await p.close(); }
  if (run('story')) { const p = await fresh('#/home');
    ok('story memo visible without scrolling past one screen', (await p.$eval('#memo', e => e.getBoundingClientRect().top)) < 900);
    ok('story memo comes before the home cards and agenda', await p.$eval('#main', e => { const all = [...e.querySelectorAll('#memo, .card')]; return all[0].id === 'memo' || all[0].closest('#onboard, #memo') !== null; }));
    ok('story lot from one source', await p.evaluate(() => STORY().lot === 'RYB-261031-L2' && document.querySelector('#memo').textContent.includes(STORY().lot) && VIS_SYS().includes(STORY().lot)));
    ok('onboarding shown on first visit', !!(await p.$('#onboard')));
    await p.fill('#onboardName', 'Zespół Szprot');
    ok('onboarding name mirrors the team name field', await p.$eval('#teamName', e => e.value) === 'Zespół Szprot');
    await p.click('#onboardGo');
    ok('onboarding sets name and timestamp', await p.evaluate(() => team().name === 'Zespół Szprot' && !!team().onboardedAt));
    ok('onboarding closes, memo stays', !(await p.$('#onboard')) && !!(await p.$('#memo')));
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('onboarding gone after reload', !(await p.$('#onboard')) && !!(await p.$('#memo')));
    await p.evaluate(() => go('brief')); ok('brief shows the incident and keeps requirements', await p.$eval('#main', e => e.textContent.includes('RYB-261031-L2') && e.querySelectorAll('#briefReq .card').length === SEC().length));
    ok('brief memo before task choice, requirements open on desktop', await p.evaluate(() => { const m = document.querySelector('#main #memo'), t = document.querySelector('#main [data-t]'), r = document.querySelector('#briefReq'); return !!m && !!t && !!(m.compareDocumentPosition(t) & 4) && !!(t.compareDocumentPosition(r) & 4) && r.open; }));
    ok('brief file starts with the story', await p.evaluate(() => BRIEF_PL.startsWith('>') && BRIEF_PL.includes(STORY().lot) && BRIEF_PL.includes('Celem projektu') && BRIEF_EN.includes(STORY().lot) && BRIEF_EN.includes('# Final project')));
    await p.click('#langSeg button[data-l=en]'); await p.evaluate(() => go('home')); ok('memo in English', /plant director/i.test(await p.$eval('#memo', e => e.textContent)));
    ok('no real brands', await p.$eval('#main', e => !/Biedronka|Lidl|Graal|Łosoś Ustka|Auchan|Kaufland/i.test(e.textContent)));
    ok('story no page errors', !p.errs.length, p.errs.join('|'));
    await p.close();
    const m = await fresh('#/brief', '', { width: 390, height: 844 });
    ok('brief requirements folded on mobile', await m.$eval('#briefReq', e => !e.open));
    await m.close(); }
  if (run('path')) { const p = await fresh('#/brief');
    ok('path bar on every view', await p.evaluate(async () => { for (const n of NAV) { go(n[0]); if (!document.querySelector('#pathBar #pathNext')) return false; } return true; }));
    await p.evaluate(() => go('brief'));
    await p.click('#main [data-t=forecast]');
    ok('picking a task stays out of the lab', await p.evaluate(() => S.view !== 'lab' && team().track === 'forecast'));
    ok('picked task is marked', await p.$eval('#main [data-t=forecast]', e => e.getAttribute('aria-pressed') === 'true') && await p.$eval('#main [data-t=vision]', e => e.getAttribute('aria-pressed') === 'false'));
    ok('next step asks for the success criterion or data', ['task', 'join', 'cycle'].includes(await p.$eval('#pathBar', e => e.dataset.next)));
    ok('goal field labelled', await p.$eval('label[for=goal]', e => e.textContent.includes('Kryterium sukcesu jednym zdaniem')));
    await p.fill('#goal', 'Błąd prognozy niższy niż średnia historyczna');
    ok('goal saved', await p.evaluate(() => team().goal.startsWith('Błąd prognozy')));
    ok('reqDemos per track', await p.evaluate(() => JSON.stringify([reqDemos('forecast'), reqDemos('complaints'), reqDemos('rag')])) === '[["split","metr"],["split","metr","tok"],["split","metr","tok","rag"]]');
    const st = await p.evaluate(() => { const t = defaultTeam(); t.onboardedAt = 'x'; t.track = 'maint'; t.goal = 'g'; t.seen.data = true; return pathState(t); });
    ok('pathState picks the first open step', st.next.id === 'cycle' && st.steps.length === 9, JSON.stringify(st.next));
    ok('PATH_STEPS order and minutes', await p.evaluate(() => PATH_STEPS().map(s => s.id).join() === 'join,cycle,task,data,demos,base,iterate,risk,report' && PATH_STEPS().every(s => s.label && s.min > 0)));
    const rules = await p.evaluate(() => { const t = defaultTeam(); t.onboardedAt = 'x'; t.track = 'vision'; t.goal = 'g'; t.seen.data = true; qz(t, 'life', 'split', 'metr', 'tok');
      const a = pathState(t).next.id; t.log = [1, 2, 3].map(i => ({ id: 'l' + i, ts: '', track: 'vision', note: '', testViews: 0 })); const b = pathState(t).next.id; t.lab.vision.testViews = 1; const c = pathState(t).next.id; return [a, b, c, demoDone(t, 'tok'), demoDone(t, 'rag')]; });
    ok('pathState demos, base, iterate with test reveal', JSON.stringify(rules) === '["base","iterate","report",true,false]', JSON.stringify(rules));
    ok('forecast iterate needs no test reveal', await p.evaluate(() => { const t = defaultTeam(); t.track = 'forecast'; t.log = [1, 2, 3].map(i => ({ id: 'l' + i, track: 'forecast' })); return pathState(t).steps.find(s => s.id === 'iterate').done; }));
    await seed(p, () => { team().onboardedAt = 'x'; });
    const before = await p.$eval('#pathBar', e => e.dataset.next); await p.click('#pathNext');
    ok('Next goes to the step target', await p.evaluate(b => { const s = PATH_STEPS().find(x => x.id === b); return S.view === s.go[0]; }, before));
    ok('opening a demo tab shows its quiz and does not mark it done', await p.evaluate(() => S.view !== 'demos' || (!!document.querySelector('#quiz .quiz') && !demoDone(team(), S.sub.demos))));
    await p.keyboard.press('5'); ok('keys 1-7 still work', await p.evaluate(() => S.view) === 'lab');
    await p.evaluate(() => { AIS.run = { fake: true }; }); await p.click('#pathNext');
    ok('Next is guarded during a model run', await p.evaluate(() => S.view) === 'lab'); await p.evaluate(() => { AIS.run = null; hideToast(); });
    ok('path bar contract', await p.$eval('#pathBar', e => e.dataset.total === '9' && e.dataset.step !== undefined && e.dataset.done !== undefined));
    ok('page usable after the guarded click', await p.evaluate(() => { go('data'); return S.view === 'data' && team().seen.data === true; }));
    ok('Next button names the step', await p.$eval('#pathNext', e => /^Dalej: /.test(e.textContent.trim())));
    await p.evaluate(() => go('deliver')); await Promise.all([p.waitForEvent('download'), p.click('#exp')]);
    ok('report export recorded', await p.evaluate(() => team().seen.report === true));
    await p.evaluate(() => go('lab', 'vision')); await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(100);
    ok('lab jump bar sits below the path bar (1440)', await p.evaluate(() => { const j = document.querySelector('#labJump').getBoundingClientRect(), b = document.querySelector('#pathBar').getBoundingClientRect(); return b.top >= 0 && j.top >= b.bottom - 1; }));
    ok('path no page errors', !p.errs.length, p.errs.join('|'));
    await p.close();
    const m = await fresh('#/lab/vision', '', { width: 390, height: 844 });
    await m.evaluate(() => window.scrollTo(0, 2500)); await m.waitForTimeout(100);
    ok('lab jump bar sits below the path bar (390)', await m.evaluate(() => { const j = document.querySelector('#labJump').getBoundingClientRect(), b = document.querySelector('#pathBar').getBoundingClientRect(); return b.top >= 0 && b.bottom < 140 && j.top >= b.bottom - 1; }));
    ok('no horizontal scroll at 390', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await m.goto('about:blank'); await m.close();
    const memoP = q => q.$eval('#memo .card-body > p', e => { const r = e.getBoundingClientRect(), hb = document.querySelector('#pathBar').getBoundingClientRect().bottom; return { top: r.top, bottom: r.bottom, hb, vh: innerHeight }; });
    const w = await fresh('#/home', '', { width: 1280, height: 720 });
    ok('first visit: onboarding shown', !!(await w.$('#onboard')));
    let r = await memoP(w); ok('first visit: memo first paragraph visible at 1280x720', r.top >= r.hb && r.bottom <= r.vh, JSON.stringify(r));
    await w.click('#onboardGo'); await w.waitForTimeout(700);
    ok('Zaczynamy completes the first step in the bar', await w.$eval('#pathBar', e => e.dataset.next !== 'join' && +e.dataset.done >= 1));
    r = await memoP(w); ok('after Zaczynamy: memo first paragraph visible at 1280x720', r.top >= r.hb && r.bottom <= r.vh, JSON.stringify(r));
    await w.close();
    const n = await fresh('#/home', '', { width: 390, height: 844 });
    ok('390: memo starts within 1.5 screens', await n.$eval('#memo', e => e.getBoundingClientRect().top < innerHeight * 1.5));
    await n.close();
    const o = await fresh('#/home');
    await seed(o, () => { const t = team(); t.onboardedAt = ''; t.log.push({ id: 'x1', ts: '', track: 'maint', note: '', testViews: 0 }); });
    ok('team with work skips onboarding', !!(await o.$('#memo')) && !(await o.$('#onboard')));
    await seed(o, () => { const t = team(); t.log = []; t.checks = { 'c0': true }; });
    ok('team with a ticked item skips onboarding', !(await o.$('#onboard')));
    await seed(o, () => { const t = team(); t.checks = {}; t.name = ''; });
    ok('empty team sees onboarding', !!(await o.$('#onboard')));
    await o.close();
    // Review round 1: Next on its own page, fresh bar after lab actions, unavailable steps, sub-view aware current step.
    const f = await fresh('#/home');
    const prep = { join: () => {}, cycle: t => { t.onboardedAt = 'x'; }, task: t => { qz(t, 'life'); }, data: t => { t.track = 'forecast'; t.goal = 'g'; }, demos: t => { t.seen.data = true; },
      base: t => { qz(t, 'split', 'metr'); }, iterate: t => { t.log.push({ id: 'b1', ts: '', track: 'forecast', note: '', testViews: 0 }); }, report: t => { for (const i of [2, 3]) t.log.push({ id: 'b' + i, ts: '', track: 'forecast', note: '', testViews: 0 }); } };
    let acc = [];
    for (const [id, fn] of Object.entries(prep)) { acc.push(fn.toString());
      await f.evaluate(src => { S.teams[S.team] = defaultTeam(); const t = team(); for (const s of src) (0, eval)('(' + s + ')')(t); save(); }, acc);
      const r1 = await f.evaluate(id => { const s = PATH_STEPS().find(x => x.id === id); go(...s.go); document.activeElement.blur(); const n = PATH_STEPS().find(x => x.id === document.querySelector('#pathBar').dataset.next); return { next: n.id, hash: location.hash, target: '#/' + n.go.join('/') }; }, id);
      await f.click('#pathNext'); await f.waitForTimeout(50);
      const r2 = await f.evaluate(() => ({ hash: location.hash, act: document.activeElement }));
      // On its own page Next must focus the step's working element; elsewhere it must land exactly on the target.
      const own = { join: '#onboardName', cycle: '#quiz [data-o]', task: '#main [data-t]', demos: '#quiz [data-o]', base: '#runBase', iterate: '#expNote', report: '#expH' };
      const res = r1.hash === r1.target ? { own: true, hit: await f.evaluate(sel => document.activeElement.matches(sel), own[r1.next] || '#none') } : { own: false, hit: r2.hash === r1.target };
      ok(`Next acts on its own page (${id})`, res.hit && (!own[id] || (res.own && r1.next === id)), JSON.stringify([r1, r2.hash, res])); }
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); t.log = []; t.seen.data = true; qz(t, 'life', 'split'); delete t.quizzes.metr; });
    await f.evaluate(() => go('demos', 'split')); await f.click('#pathNext'); await f.waitForTimeout(50);
    ok('Next moves from one required demo to the next', await f.evaluate(() => location.hash) === '#/demos/metr');
    ok('Next focuses the working element', await f.evaluate(() => { S.teams[S.team] = defaultTeam(); save(); go('home'); document.querySelector('#pathNext').click(); return document.activeElement.id === 'onboardName'; }));
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'maint', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split', 'metr'); t.log = []; });
    await f.evaluate(() => go('lab', 'maint')); await f.click('#sv');
    ok('bar fresh after saving an experiment', await f.evaluate(() => document.querySelector('#pathBar').dataset.next === pathState(team()).next.id && pathState(team()).next.id === 'iterate'));
    await seed(f, () => { const t = team(); t.track = 'vision'; qz(t, 'tok'); t.log = [1, 2, 3].map(i => ({ id: 'v' + i, ts: '', track: 'vision', note: '', testViews: 0 })); t.lab.vision.testViews = 0; t.lab.vision.revealed = false; });
    await f.evaluate(() => go('lab', 'vision')); await f.waitForSelector('#visRv'); await f.click('#visRv');
    ok('bar fresh after a test reveal', await f.evaluate(() => { const n = pathState(team()).next; return document.querySelector('#pathBar').dataset.next === (n ? n.id : '') && (!n || n.id !== 'iterate'); }));
    await seed(f, () => { const t = team(); t.name = ''; t.log = []; t.checks = {}; t.onboardedAt = ''; }); await f.evaluate(() => go('brief')); await f.fill('#teamName', 'Szprot');
    ok('bar fresh after typing the team name', await f.$eval('#pathBar', e => e.dataset.next !== 'join'));
    const done = await f.evaluate(() => { const t = defaultTeam(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split', 'metr'); t.log = [1, 2, 3].map(i => ({ id: 'f' + i, track: 'forecast' }));
      const a = pathState(t); t.seen.report = true; const b = pathState(t); return { a: a.next && a.next.id, b: b.next, na: b.steps.find(s => s.id === 'risk') }; });
    ok('report recommended while risk is unavailable', done.a === 'report', JSON.stringify(done));
    ok('path completes without unavailable steps', done.b === null && done.na.na === true && done.na.done === false, JSON.stringify(done));
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); Object.assign(t.seen, { data: true, report: true }); qz(t, 'life', 'split', 'metr'); t.log = [1, 2, 3].map(i => ({ id: 'f' + i, ts: '', track: 'forecast', note: '', testViews: 0 })); });
    ok('bar reads Ścieżka ukończona', await f.$eval('#pathBar', e => e.textContent.includes('Ścieżka ukończona') && e.dataset.next === '' && e.dataset.na === '1' && e.dataset.total === '9'));
    ok('data hint spec wording', await f.evaluate(() => PATH_STEPS().find(s => s.id === 'data').hint.includes('otwórz dane wybranego zadania')));
    await seed(f, () => { S.teams[S.team] = defaultTeam(); team().onboardedAt = 'x'; }); await f.evaluate(() => go('demos', 'split'));
    ok('current step follows the sub view', await f.$eval('#pathBar', e => e.dataset.step) === 'demos');
    ok('review round no page errors', !f.errs.length, f.errs.join('|'));
    await f.close(); }
  if (run('quiz')) { const p = await fresh('#/demos/split');
    ok('every demo has 2-3 questions with one valid answer', await p.evaluate(() => DEMO_KEYS.filter(k => k !== 'risk').every(k => { const q = QUIZZES()[k]; return q && q.length >= 2 && q.length <= 3 && q.every(x => x.options.length >= 3 && x.answer >= 0 && x.answer < x.options.length && x.explain); })));
    ok('question ids short and unique', await p.evaluate(() => { const ids = Object.values(QUIZZES()).flat().map(x => x.id); return ids.every(i => typeof i === 'string' && i.length <= 12) && new Set(ids).size === ids.length; }));
    const tp0 = await p.$eval('#tp', e => e.value); await p.focus('#tp'); await p.keyboard.press('ArrowRight'); const tp1 = await p.$eval('#tp', e => e.value);
    const q = await p.evaluate(() => QUIZZES().split[0]);
    const wrong = q.answer === 0 ? 1 : 0;
    ok('options are buttons, feedback is polite live region', await p.$$eval(`.quiz [data-q="${q.id}"] [data-o]`, b => b.length >= 3 && b.every(x => x.tagName === 'BUTTON')) && await p.$eval(`.quiz [data-q="${q.id}"] [aria-live]`, e => e.getAttribute('aria-live') === 'polite'));
    await p.click(`.quiz [data-q="${q.id}"] [data-o="${wrong}"]`);
    ok('wrong answer gets feedback, can retry', await p.$eval(`.quiz [data-q="${q.id}"]`, e => e.dataset.state) === 'wrong' && !(await p.$eval('.quiz', e => e.dataset.done === 'true')));
    ok('split wrong-A feedback verbatim', wrong !== 0 || await p.$eval(`.quiz [data-q="${q.id}"] [aria-live]`, e => e.textContent.includes('Wyciek danych to inna usterka')));
    ok('quiz does not reset the demo', await p.$eval('#tp', e => e.value) === tp1 && tp1 !== tp0);
    for (const x of await p.evaluate(() => QUIZZES().split)) await p.click(`.quiz [data-q="${x.id}"] [data-o="${x.answer}"]`);
    ok('all correct -> done', await p.$eval('.quiz', e => e.dataset.done === 'true' && e.dataset.score === e.dataset.total));
    ok('first-attempt result recorded', await p.evaluate(id => team().quizzes.split.first[id] === false, q.id));
    ok('opening the tab alone does not mark a demo done', await p.evaluate(() => !demoDone(team(), 'metr') && !Object.keys(team().seen).some(k => k.startsWith('demo.'))));
    await p.click('#langSeg button[data-l=en]'); ok('language switch keeps answers', await p.$eval('.quiz', e => e.dataset.done === 'true'));
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('quiz survives reload and feeds the path', await p.evaluate(() => quizDone(team(), 'split') && demoDone(team(), 'split')));
    const f = await p.evaluate(() => JSON.parse(JSON.stringify({ data: team() })).data.quizzes.split.doneAt); ok('quiz in the team file', !!f);
    ok('no quiz for a key without questions', await p.evaluate(() => { renderQuiz('risk'); const e = document.querySelector('#quiz'); return e.innerHTML === ''; }));
    await seed(p, () => { S.teams[S.team] = defaultTeam(); const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split'); });
    await p.evaluate(() => go('demos', 'metr'));
    const n0 = await p.$eval('#pathBar', e => e.dataset.next), h0 = await p.evaluate(() => location.hash);
    for (const x of await p.evaluate(() => QUIZZES().metr)) await p.click(`.quiz [data-q="${x.id}"] [data-o="${x.answer}"]`);
    const n1 = await p.$eval('#pathBar', e => e.dataset.next), h1 = await p.evaluate(() => location.hash);
    ok('last required quiz moves the path bar without navigation', n0 === 'demos' && n1 === 'base' && h0 === h1, JSON.stringify([n0, n1, h0, h1]));
    ok('quiz no page errors', !p.errs.length, p.errs.join('|'));
    await p.close(); }
  if (run('labstart')) { for (const k of ['vision', 'rag', 'complaints', 'forecast', 'maint']) { const p = await fresh('#/lab/' + k);
    // The vision set switches to photo features once the photos load; wait so both saves score the same data.
    if (k === 'vision') await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 15000 });
    ok(`${k}: task and baseline button above the fold`, await p.$eval('#runBase', e => e.getBoundingClientRect().bottom < 900));
    ok(`${k}: method table folded but present`, await p.$eval('#labMethod details', e => !e.open && e.querySelectorAll('input[name=meth]').length >= 2));
    ok(`${k}: AI bar not in the first screen`, !(await p.$('#aiBar')) || await p.$eval('#aiBar', e => e.getBoundingClientRect().top > 900 || e.closest('details') !== null));
    await p.click('#runBase'); ok(`${k}: baseline result with recap`, await p.$eval('#baseOut', e => e.dataset.track && e.dataset.v !== undefined && !!e.querySelector('.recap')));
    ok(`${k}: baseline shows two headline numbers on the tuning set`, await p.$$eval('#baseOut .headline .stat', e => e.length) === 2 && await p.$eval('#baseOut .recap', e => e.dataset.set) === ({ vision: 'val', rag: 'dev', complaints: 'dev', forecast: 'test', maint: 'test' })[k]);
    await p.click('#saveBase'); ok(`${k}: baseline saved with flag`, await p.evaluate(k => team().log.some(l => l.track === k && l.base === true), k));
    await p.click('#saveBase'); ok(`${k}: second save is refused as duplicate`, await p.evaluate(k => team().log.filter(l => l.track === k && l.base).length, k) === 1);
    ok(`${k}: baseline entry readable in the log`, await p.evaluate(k => { const l = team().log.find(x => x.track === k && x.base); const s = logText(l); return s.includes(BASE_NAME(k)) && !/unreadable|nieczytelny/.test(s); }, k));
    ok(`${k}: labstart no page errors`, !p.errs.length, p.errs.join('|'));
    await p.close(); }
  { const p = await fresh('#/lab/vision');
    await seed(p, () => { lab().vision.revealed = true; lab().vision.testViews = 1; }); await p.click('#runBase');
    ok('baseline stays on the validation set while the test is revealed', await p.$eval('#baseOut .recap', e => e.dataset.set) === 'val');
    await p.click('#visMethod button[data-m=llm]'); ok('AI bar mounted after switching vision to the model', !!(await p.$('#aiBar #aiCode')));
    await p.click('#visMethod button[data-m=rules]'); ok('AI bar removed after switching back to rules', !(await p.$('#aiBar')));
    await p.close(); }
  // Review fixes: baseline entries are not restorable, the saved baseline equals the shown one, forecast baseline recap.
  { const p = await fresh('#/lab/maint');
    await seed(p, () => { const m = lab().mt; m.thr = 3.3; m.win = 4; m.f = { temp_c: 1, vibration_mm_s: 0, pressure_bar: 1 }; });
    await p.click('#sv'); await p.click('#runBase'); await p.click('#saveBase');
    await p.evaluate(() => go('deliver'));
    const rows = await p.evaluate(() => team().log.map((l, i) => ({ i, base: !!l.base, btn: !!document.querySelector(`#logBox button[data-r="${i}"]`) })));
    ok('baseline row has no restore button, tuned row has one', rows.length === 2 && rows.every(r => r.btn === !r.base), JSON.stringify(rows));
    const kept = await p.evaluate(() => { restoreRun(team().log.find(l => l.base)); const m = lab().mt; return { thr: m.thr, win: m.win, f: m.f }; });
    ok('restoreRun on a baseline entry keeps the tuned settings', kept.thr === 3.3 && kept.win === 4 && kept.f.vibration_mm_s === 0, JSON.stringify(kept));
    await seed(p, () => { lab().mt.thr = 5; lab().mt.win = 1; }); await p.evaluate(() => go('deliver'));
    const ti = await p.evaluate(() => team().log.findIndex(l => !l.base)); await p.click(`#logBox button[data-r="${ti}"]`);
    ok('tuned run still restores', await p.evaluate(() => lab().mt.thr === 3.3 && lab().mt.win === 4 && S.view === 'lab'));
    await p.close(); }
  { const p = await fresh('#/lab/forecast');
    await p.click('#runBase'); const v0 = await p.$eval('#baseOut', e => e.dataset.v);
    ok('forecast baseline recap speaks about the baseline only', /^Na horyzoncie \d+ mies\. metoda odniesienia \(średnia historyczna\) ma błąd [\d,]+%\. To wynik, który wasza metoda ma pobić\.$/.test(await p.$eval('#baseOut .recap', e => e.textContent.trim())), await p.$eval('#baseOut .recap', e => e.textContent));
    await p.focus('#fh'); for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
    const shown = await p.$eval('#baseOut', e => e.dataset.v); await p.click('#saveBase');
    const saved = await p.evaluate(() => team().log.find(l => l.base).res.primary.v);
    ok('saved forecast baseline equals the shown one after a horizon change', String(saved) === shown && shown !== v0, JSON.stringify([v0, shown, saved]));
    await p.click('#langSeg button[data-l=en]'); await p.click('#runBase');
    ok('forecast baseline recap in English', /^Over a horizon of \d+ months the baseline \(historical mean\) has an error of/.test(await p.$eval('#baseOut .recap', e => e.textContent.trim())));
    ok('normal forecast result keeps the 4.5 template', /wybrana metoda|chosen method/.test(await p.$eval('#proto .recap', e => e.textContent)));
    await p.close(); }
  const p = await fresh('#/lab/forecast'); ok('forecast limits callout', /promocj/i.test(await p.$eval('#fcLimits', e => e.textContent)) && !(await p.$('#fcLimits button')));
  await p.evaluate(() => go('lab', 'maint')); ok('maint limits callout', !!(await p.$('#mtLimits')));
  ok('maint limits: nothing trained, a language model could explain the alert', /mało zdarzeń/.test(await p.$eval('#mtLimits', e => e.textContent)) && /wyjaśni/.test(await p.$eval('#mtLimits', e => e.textContent)));
  await p.close(); }
  if (run('visprompt')) { const p = await fresh('#/lab/vision');
    // Seeding the default prompt must not change a single byte of the request (replay.json keys).
    const seedSame = await p.evaluate(() => { const L = lab().vision, empty = !L.prompts.length && L.draft == null, it = VIS.val[0];
      const before = [0, 4].map(s => JSON.stringify(visMessages(s, it))); visEnsure(); const after = [0, 4].map(s => JSON.stringify(visMessages(s, it)));
      return { empty, same: before.every((b, i) => b === after[i]), v1: L.prompts.length === 1 && L.prompts[0].id === 'v1' && L.prompts[0].text === VIS_SYS() && L.draft === VIS_SYS() }; });
    ok('seeding the default prompt keeps the messages byte-identical', seedSame.empty && seedSame.same && seedSame.v1, JSON.stringify(seedSame));
    await p.evaluate(() => { lab().vision.method = 'llm'; save(); render(); });
    ok('prompt editable without a class code', await p.$eval('#vPrompt', e => !e.readOnly && !e.disabled && e.value.includes('RYB-261031-L2')));
    ok('prompt label and hint from the spec', await p.$eval('label[for=vPrompt]', e => e.textContent.trim()) === 'Prompt systemowy (wysyłany z każdym zdjęciem)' && /mała ciemna kropka brudu nie jest wadą – to zdanie już jest w prompcie domyślnym\. Sprawdźcie, co się stanie, gdy je usuniecie\./.test(await p.$eval('#proto', e => e.textContent)));
    ok('default prompt messages unchanged', await p.evaluate(() => { const a = visMessages(0, VIS.val[0]); return a[0].content === VIS_SYS() && JSON.stringify(a).includes(JSON.stringify(VIS_SYS())); }));
    ok('version chip shows v1', await p.$eval('#vVerChip', e => e.dataset.ver) === 'v1');
    await p.fill('#vPrompt', 'Oceń puszkę. Odpowiedz JSON.');
    ok('unsaved edit marks the version with a star', await p.$eval('#vVerChip', e => e.dataset.ver) === 'v1*' && await p.evaluate(() => visVer(lab().vision)) === 'v1*');
    await p.click('#vPromptSave');
    ok('new version v2 active', await p.evaluate(() => lab().vision.prompts.length === 2 && lab().vision.active === 'v2') && await p.$eval('#vPromptVer', e => e.value) === 'v2');
    ok('edited prompt is what gets sent', await p.evaluate(() => JSON.stringify(visMessages(0, VIS.val[0])).includes('Oceń puszkę.')));
    await p.click('#vPromptReset'); ok('reset restores the default text in the editor', await p.$eval('#vPrompt', e => e.value) === await p.evaluate(() => VIS_SYS()));
    await p.selectOption('#vPromptVer', 'v1'); ok('switching back to v1 loads its text', await p.evaluate(() => lab().vision.active === 'v1' && lab().vision.draft === VIS_SYS()));
    await p.selectOption('#vPromptVer', 'v2');
    await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('versions persist', await p.evaluate(() => lab().vision.prompts.length === 2 && lab().vision.active === 'v2'));
    ok('hint that a run needs a connection', /połączeni|kod zajęć/i.test(await p.$eval('#vPromptNet', e => e.textContent)));
    ok('pixel-rule view untouched', await p.evaluate(() => { lab().vision.method = 'rules'; render(); return !!document.querySelector('#vd') && !document.querySelector('#vPrompt'); }));
    // Model run with the edited version: request, run signature, history, log entry.
    await p.evaluate(() => { S.ai.code = 'test-code'; lab().vision.method = 'llm'; save(); render(); });
    await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
    await p.click('#visRun'); await p.waitForSelector('#visModelRes[data-ai-run="done"]', { timeout: 30000 });
    const last = await p.evaluate(async m => (await (await fetch(m + '/calls')).json()).last, MOCK);
    ok('the run sends the edited prompt', last && last.messages[0].content === 'Oceń puszkę. Odpowiedz JSON.');
    ok('run carries the prompt version', await p.evaluate(() => visSel(lab().vision).ver) === 'v2' && await p.$eval('#visModelRes', e => e.dataset.ver) === 'v2');
    ok('history shows the prompt version', await p.$eval('#visHist tbody tr:last-child td:nth-child(2)', e => e.textContent.trim()) === 'v2');
    await p.click('#sv');
    const lg = await p.evaluate(() => { const l = team().log[team().log.length - 1]; return { ver: l.cfg.ver, txt: logText(l) }; });
    ok('log entry carries cfg.ver and shows it', lg.ver === 'v2' && /prompt v2/.test(lg.txt), JSON.stringify(lg));
    ok('older vision log entries without ver render as before', await p.evaluate(() => logText({ track: 'vision', cfg: { mode: 'llm', model: 'x', shots: 0, set: 'val' }, res: { val: { f1: .5, p: .5, r: .5 }, ruleF1: .4 } }) === `[model] ${cnt(0, 'example')}, ${T('walidacja', 'validation')}: F1=${pct(.5)}, P=${pct(.5)}, R=${pct(.5)}; ${T('reguły pikselowe', 'pixel rules')} F1=${pct(.4)}`));
    await p.selectOption('#vPromptVer', 'v1');
    ok('a switched version marks the shown result as from another prompt', await p.$eval('#visModelRes', e => e.dataset.stale) === '1' && /v2/.test(await p.$eval('#visStale', e => e.textContent)));
    await p.evaluate(() => restoreRun(team().log[team().log.length - 1]));
    ok('restoring the log entry brings back its prompt version', await p.evaluate(() => lab().vision.active === 'v2' && lab().vision.draft === 'Oceń puszkę. Odpowiedz JSON.'));
    ok('v1 follows the language', await p.evaluate(() => { const L = lab().vision; L.active = 'v1'; L.draft = L.prompts[0].text; S.lang = 'en'; visEnsure(); const r = L.prompts[0].text === VIS_SYS() && L.draft === VIS_SYS() && visMessages(0, VIS.val[0])[0].content === VIS_SYS() && L.prompts[1].text === 'Oceń puszkę. Odpowiedz JSON.'; S.lang = 'pl'; visEnsure(); return r && L.prompts[0].text === VIS_SYS(); }));
    ok('visprompt no page errors', !p.errs.length, p.errs.join('|'));
    await p.close(); }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
