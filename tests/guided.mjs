// Probes for the guided simulation path. Starts the mock server itself.
// Usage: cd tests && node guided.mjs [section...]   (sections: smoke state gloss recap story path quiz labstart visprompt note exit1 gate site)
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
      const a = pathState(t).next.id; t.log = [1, 2, 3].map(i => ({ id: 'l' + i, ts: '', track: 'vision', note: '', testViews: 0 })).concat({ id: 'lb', ts: '', track: 'vision', note: '', testViews: 0, base: true }); const b = pathState(t).next.id; t.lab.vision.testViews = 1; const c = pathState(t).next.id; return [a, b, c, demoDone(t, 'tok'), demoDone(t, 'rag')]; });
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
    ok('page usable after the guarded click', await p.evaluate(() => { FSEL = TRACK_FILE[team().track]; go('data'); return S.view === 'data' && team().seen.data === true; }));
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
      base: t => { qz(t, 'split', 'metr'); }, iterate: t => { t.log.push({ id: 'b0', ts: '', track: 'forecast', note: '', testViews: 0, base: true }, { id: 'b1', ts: '', track: 'forecast', note: '', testViews: 0 }); }, report: t => { for (const i of [2, 3]) t.log.push({ id: 'b' + i, ts: '', track: 'forecast', note: '', testViews: 0 }); } };
    let acc = [];
    for (const [id, fn] of Object.entries(prep)) { acc.push(fn.toString());
      await f.evaluate(src => { S.teams[S.team] = defaultTeam(); const t = team(); for (const s of src) (0, eval)('(' + s + ')')(t); save(); }, acc);
      const r1 = await f.evaluate(id => { const s = PATH_STEPS().find(x => x.id === id); go(...s.go); document.activeElement.blur(); const n = PATH_STEPS().find(x => x.id === document.querySelector('#pathBar').dataset.next); return { next: n.id, hash: location.hash, target: '#/' + n.go.join('/') }; }, id);
      await f.click('#pathNext'); await f.waitForTimeout(50);
      const r2 = await f.evaluate(() => ({ hash: location.hash, act: document.activeElement }));
      // On its own page Next must focus the step's working element; elsewhere it must land exactly on the target.
      const own = { data: '.tree button[aria-current]', join: '#onboardName', cycle: '#quiz [data-o]', task: '#main [data-t]', demos: '#quiz [data-o]', base: '#runBase', iterate: '#expNote', report: '#expH' };
      const res = r1.hash === r1.target ? { own: true, hit: await f.evaluate(sel => document.activeElement.matches(sel), own[r1.next] || '#none') } : { own: false, hit: r2.hash === r1.target };
      ok(`Next acts on its own page (${id})`, res.hit && (!own[id] || (res.own && r1.next === id)), JSON.stringify([r1, r2.hash, res])); }
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); t.log = []; t.seen.data = true; qz(t, 'life', 'split'); delete t.quizzes.metr; });
    await f.evaluate(() => go('demos', 'split')); await f.click('#pathNext'); await f.waitForTimeout(50);
    ok('Next moves from one required demo to the next', await f.evaluate(() => location.hash) === '#/demos/metr');
    ok('Next focuses the working element', await f.evaluate(() => { S.teams[S.team] = defaultTeam(); save(); go('home'); document.querySelector('#pathNext').click(); return document.activeElement.id === 'onboardName'; }));
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'maint', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split', 'metr'); t.log = [{ id: 'mb', ts: '', track: 'maint', note: '', testViews: 0, base: true }]; });
    await f.evaluate(() => go('lab', 'maint')); await f.click('#sv');
    ok('bar fresh after saving an experiment', await f.evaluate(() => document.querySelector('#pathBar').dataset.next === pathState(team()).next.id && pathState(team()).next.id === 'iterate'));
    await seed(f, () => { const t = team(); t.track = 'vision'; qz(t, 'tok'); t.log = [1, 2, 3].map(i => ({ id: 'v' + i, ts: '', track: 'vision', note: '', testViews: 0 })).concat({ id: 'vb', ts: '', track: 'vision', note: '', testViews: 0, base: true }); t.decision.vision = { m: 0, why: 'Reguły są tanie i wyjaśnialne.' }; t.lab.vision.testViews = 0; t.lab.vision.revealed = false; });
    await f.evaluate(() => go('lab', 'vision')); await f.waitForSelector('#visRv'); await f.click('#visRv');
    ok('bar fresh after a test reveal', await f.evaluate(() => { const n = pathState(team()).next; return document.querySelector('#pathBar').dataset.next === (n ? n.id : '') && (!n || n.id !== 'iterate'); }));
    await seed(f, () => { const t = team(); t.name = ''; t.log = []; t.checks = {}; t.onboardedAt = ''; }); await f.evaluate(() => go('brief')); await f.fill('#teamName', 'Szprot');
    ok('bar fresh after typing the team name', await f.$eval('#pathBar', e => e.dataset.next !== 'join'));
    const done = await f.evaluate(() => { const t = defaultTeam(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split', 'metr'); t.log = [1, 2, 3].map(i => ({ id: 'f' + i, track: 'forecast' })).concat({ id: 'fb', track: 'forecast', base: true });
      const a = pathState(t); t.seen.report = true; const b = pathState(t); return { a: a.next && a.next.id, b: b.next, na: b.steps.find(s => s.id === 'risk') }; });
    ok('report recommended while risk is unavailable', done.a === 'report', JSON.stringify(done));
    ok('path completes without unavailable steps', done.b === null && done.na.na === true && done.na.done === false, JSON.stringify(done));
    await seed(f, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); Object.assign(t.seen, { data: true, report: true }); qz(t, 'life', 'split', 'metr'); t.log = [1, 2, 3].map(i => ({ id: 'f' + i, ts: '', track: 'forecast', note: '', testViews: 0 })).concat({ id: 'fb', ts: '', track: 'forecast', note: '', testViews: 0, base: true }); });
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
    await p.$eval('#saveBase', b => b.click()); ok(`${k}: second save is refused as duplicate`, await p.evaluate(k => team().log.filter(l => l.track === k && l.base).length, k) === 1);
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
  if (run('note')) { const p = await fresh('#/lab/maint');
    const saveWith = async (thr, note) => { await p.evaluate(v => { lab().mt.thr = v; save(); render(); }, thr); if (note) await p.fill('#expNote', note); await p.click('#sv'); };
    await saveWith(3); await saveWith(3.5);
    ok('first two saves need no note', await p.evaluate(() => expCount('maint')) === 2);
    await saveWith(3.5);
    ok('a duplicate third save shows the duplicate message, not the note request', await p.evaluate(() => expCount('maint') === 2 && /już w dzienniku|already in the log/.test(toastEl.textContent) && !document.querySelector('#expNote').hasAttribute('aria-invalid') && document.querySelector('#expNoteMsg').textContent === ''));
    await saveWith(4.5);
    ok('third save without a note is held', await p.evaluate(() => expCount('maint')) === 2 && await p.evaluate(() => document.activeElement.id) === 'expNote');
    ok('held save asks for one sentence', await p.evaluate(() => { const e = document.querySelector('#expNote'); return e.dataset.noteRequired === 'true' && e.getAttribute('aria-invalid') === 'true' && document.querySelector('#expNoteMsg').textContent.trim() !== ''; }));
    await saveWith(4.5, 'Wyższy próg: mniej fałszywych alarmów, retort nadal przeoczony');
    ok('third save with a note goes through', await p.evaluate(() => expCount('maint') === 3 && team().log.at(-1).note.startsWith('Wyższy próg')));
    ok('note appears in the Markdown report', await p.evaluate(() => { team().track = 'maint'; return reportMD().includes('Wyższy próg'); }));
    ok('note appears in the HTML report', await p.evaluate(() => reportHTML().includes('Wyższy próg')));
    ok('baseline saves never need a note', await p.evaluate(() => { const t = team(), n = t.log.length; logAdd('maint', { base: 1 }, { f1: .1 }, { m: 'F1', v: .1 }, { base: true }); return t.log.length === n + 1 && noteRequired('maint'); }));
    ok('generic placeholder on the maint track', await p.$eval('#expNote', e => e.placeholder.startsWith('Jednym zdaniem')));
    // Route changes focus #main; a fresh load starts the tab order at the top of the document.
    await p.evaluate(() => go('home')); await p.reload(); await p.waitForSelector('#main .page-head'); await p.keyboard.press('Tab');
    ok('skip link is the first focus stop', await p.evaluate(() => document.activeElement.classList.contains('skip') && document.activeElement.getAttribute('href') === '#main'));
    await p.keyboard.press('Enter'); ok('skip link moves focus to main', await p.evaluate(() => document.activeElement.id) === 'main');
    ok('skip link leaves the route alone', await p.evaluate(() => location.hash === '#/home' && S.view === 'home'), await p.evaluate(() => location.hash + ' ' + S.view));
    await p.evaluate(() => go('lab', 'maint')); await p.reload(); await p.waitForSelector('#sv');
    ok('skip link is off-screen until focused', await p.$eval('a.skip', e => e.getBoundingClientRect().bottom <= 0));
    const before = await p.evaluate(() => document.activeElement.id + '/' + document.activeElement.tagName); await p.keyboard.press('Tab'); ok('skip link shows on focus on a lab view', await p.$eval('a.skip', e => document.activeElement === e && e.getBoundingClientRect().top >= 0), before + ' -> ' + await p.evaluate(() => document.activeElement.id + '/' + document.activeElement.className));
    await p.keyboard.press('Enter'); ok('skip link on a lab view keeps the route', await p.evaluate(() => document.activeElement.id === 'main' && location.hash === '#/lab/maint'));
    ok('note no page errors', !p.errs.length, p.errs.join('|'));
    await p.close(); }
  if (run('exit1')) {
    // 1 + 6: the baseline is not an experiment; the note field says when it is required.
    { const p = await fresh('#/lab/maint');
      await seed(p, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'maint', goal: 'g' }); t.seen.data = true; qz(t, 'life', 'split', 'metr'); t.log = []; });
      await p.click('#runBase'); await p.click('#saveBase');
      const saveWith = async (thr, note) => { await p.evaluate(v => { lab().mt.thr = v; save(); render(); }, thr); if (note) await p.fill('#expNote', note); await p.click('#sv'); };
      ok('exit1 note not required after the baseline only', await p.$eval('#expNote', e => e.dataset.noteRequired === 'false' && e.getAttribute('aria-required') === 'false'));
      await saveWith(3); ok('exit1 note not required after one experiment', await p.$eval('#expNote', e => e.dataset.noteRequired) === 'false');
      await saveWith(3.5);
      ok('exit1 hero counter ignores the baseline (2/3)', await p.$eval('#heroProg .gh-num', e => e.textContent) === '2/3', await p.$eval('#heroProg .gh-num', e => e.textContent));
      ok('exit1 team bar counts experiments only', await p.$eval('#tbProg', e => e.textContent.includes(': 2/3')), await p.$eval('#tbProg', e => e.textContent));
      ok('exit1 iterate is next after baseline + 2 experiments', await p.evaluate(() => pathState(team()).next.id) === 'iterate');
      ok('exit1 note required after two experiments (updated by the save)', await p.$eval('#expNote', e => e.dataset.noteRequired === 'true' && e.getAttribute('aria-required') === 'true') && /\(wymagane\)/.test(await p.$eval('label[for=expNote]', e => e.textContent)));
      await saveWith(4.5);
      ok('exit1 third experiment without a note is held', await p.evaluate(() => team().log.filter(l => l.track === 'maint' && !l.base).length) === 2);
      ok('exit1 held save marks the field', await p.$eval('#expNote', e => e.getAttribute('aria-invalid') === 'true' && (e.getAttribute('aria-describedby') || '').split(' ').includes('expNoteMsg')) && /zdanie wniosku/.test(await p.$eval('#expNoteMsg', e => e.textContent)));
      await p.type('#expNote', 'W');
      ok('exit1 typing clears the field error', await p.$eval('#expNote', e => e.getAttribute('aria-invalid') !== 'true') && (await p.$eval('#expNoteMsg', e => e.textContent)).trim() === '');
      await p.fill('#expNote', 'Wyższy próg: mniej fałszywych alarmów'); await p.click('#sv');
      ok('exit1 with a note: 3/3 and the path moves on', await p.$eval('#heroProg .gh-num', e => e.textContent) === '3/3' && await p.evaluate(() => pathState(team()).next.id !== 'iterate'));
      // 3: the saved baseline card survives a reload, without writing anything.
      const n0 = await p.evaluate(() => JSON.stringify(team().log.map(l => l.id))); await p.reload(); await p.waitForSelector('#baseOut .recap');
      ok('exit1 baseline card after reload', await p.$eval('#baseOut', e => !e.hidden && e.dataset.v !== undefined && !!e.querySelector('.recap') && e.dataset.saved === 'true'));
      ok('exit1 saved baseline cannot be saved again', await p.evaluate(() => { const b = document.querySelector('#saveBase'); return !b || b.disabled || b.hidden || b.getAttribute('aria-disabled') === 'true'; }));
      const rl = await p.evaluate(n0 => [JSON.stringify(team().log.map(l => l.id)) === n0, !VIS.initialized], n0);
      ok('exit1 reload writes nothing and loads no photos', rl[0] && rl[1], JSON.stringify(rl));
      ok('exit1 no page errors (1, 3, 6)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
    // 3 on the vision track: the card is built before the photos load and must match the saved entry once they have.
    { const p = await fresh('#/lab/vision'); const ready = () => p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 15000 });
      await ready(); await p.click('#runBase'); await p.click('#saveBase');
      ok('exit1 vision baseline marked saved right after saving', await p.$eval('#baseOut', e => e.dataset.saved) === 'true');
      await p.reload(); await ready(); await p.waitForTimeout(200);
      ok('exit1 vision baseline card after reload', await p.$eval('#baseOut', e => !e.hidden && !!e.querySelector('.recap') && e.dataset.saved === 'true'), await p.$eval('#baseOut', e => JSON.stringify(e.dataset)));
      ok('exit1 no page errors (3, vision)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
    // 2: the data step needs the team's own data.
    { const p = await fresh('#/brief');
      await seed(p, () => { const t = team(); Object.assign(t, { onboardedAt: 'x', track: 'forecast', goal: 'g' }); qz(t, 'life'); t.seen.data = false; });
      ok('exit1 data is the next step', await p.$eval('#pathBar', e => e.dataset.next) === 'data');
      await p.click('#pathNext');
      ok('exit1 Next opens the forecast file with its card', await p.evaluate(() => S.view === 'data' && FSEL === 'sales_history.csv' && team().seen.data === true && [...document.querySelectorAll('#viewer h3')].some(h => /Karta zbioru danych/.test(h.textContent) && h.offsetParent)));
      ok('exit1 lead does not talk about vision data for sales_history.csv', !/wizj|zdję/i.test(await p.$eval('.page-head .edu-lead', e => e.textContent)));
      await seed(p, () => { S.teams[S.team] = defaultTeam(); team().onboardedAt = 'x'; }); await p.evaluate(() => { FSEL = 'project_description.md'; go('data'); });
      ok('exit1 team without a track does not complete the data step', await p.evaluate(() => S.view === 'data' && !team().seen.data));
      await p.evaluate(() => { FSEL = 'sales_history.csv'; vData(); });
      ok('exit1 team without a track: any file leaves the step open', await p.evaluate(() => !team().seen.data));
      await seed(p, () => { FSEL = 'project_description.md'; const t = team(); Object.assign(t, { track: 'forecast', goal: 'g' }); }); await p.evaluate(() => { go('home'); go('data'); });
      ok('exit1 forecast team on the project description: step open', await p.evaluate(() => S.view === 'data' && !team().seen.data));
      await p.click('.tree button[data-k=img]');
      ok('exit1 forecast team opening only the photos does not complete it', await p.evaluate(() => FSEL === 'can_images/ (210)' && !team().seen.data));
      await p.click('.tree button[data-k=sales]'); ok('exit1 forecast team opening its file completes it', await p.evaluate(() => team().seen.data === true));
      await seed(p, () => { const t = team(); t.track = 'rag'; t.seen.data = false; }); await p.evaluate(() => { FSEL = 'PROCES-03.md'; vData(); });
      ok('exit1 RAG: any PROCES document counts', await p.evaluate(() => team().seen.data === true));
      await seed(p, () => { const t = team(); t.track = 'forecast'; t.seen.data = false; }); await p.evaluate(() => { FSEL = 'project_description.md'; go('lab', 'forecast'); }); await p.click('#tod');
      ok('exit1 lab data link opens the track file', await p.evaluate(() => S.view === 'data' && FSEL === 'sales_history.csv' && team().seen.data === true));
      ok('exit1 no page errors (2)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
    // 4: Next on the step's own page says what to do.
    { const f = await fresh('#/home');
      const prep = { join: () => {}, cycle: t => { t.onboardedAt = 'x'; }, task: t => { qz(t, 'life'); }, data: t => { t.track = 'forecast'; t.goal = 'g'; }, demos: t => { t.seen.data = true; },
        base: t => { qz(t, 'split', 'metr'); }, iterate: t => { t.log.push({ id: 'b0', ts: '', track: 'forecast', note: '', testViews: 0, base: true }, { id: 'b1', ts: '', track: 'forecast', note: '', testViews: 0 }); }, report: t => { for (const i of [2, 3]) t.log.push({ id: 'b' + i, ts: '', track: 'forecast', note: '', testViews: 0 }); } };
      const txt = { join: 'Podajcie nazwę zespołu', cycle: 'Odpowiedzcie na pytania', task: 'Wybierzcie zadanie', data: 'Otwórzcie dane swojego zadania', demos: 'Odpowiedzcie na pytania', base: 'Uruchomcie metodę odniesienia', iterate: 'Zapiszcie eksperyment', report: 'Wyeksportujcie raport' };
      const acc = [];
      for (const [id, fn] of Object.entries(prep)) { acc.push(fn.toString());
        const r = await f.evaluate(([src, id]) => { S.teams[S.team] = defaultTeam(); const t = team(); for (const s of src) (0, eval)('(' + s + ')')(t); save(); FSEL = 'project_description.md';
          const s = PATH_STEPS().find(x => x.id === id); go(...s.go); const b = document.querySelector('#pathNext'), here = { next: document.querySelector('#pathBar').dataset.next, mode: b.dataset.mode, text: b.textContent.trim() };
          go('arch'); const g = document.querySelector('#pathNext'); return { here, go: { mode: g.dataset.mode, text: g.textContent.trim() } }; }, [acc, id]);
        ok(`exit1 Next on its own page names the action (${id})`, r.here.next === id && r.here.mode === 'here' && !/^Dalej/.test(r.here.text) && r.here.text === txt[id], JSON.stringify(r.here));
        ok(`exit1 Next elsewhere says Dalej (${id})`, r.go.mode === 'go' && /^Dalej: /.test(r.go.text), JSON.stringify(r.go)); }
      ok('exit1 join without the card: read the memo', await f.evaluate(() => { S.teams[S.team] = defaultTeam(); save(); go('home'); document.querySelector('#onboard').remove(); renderPathBar(); return document.querySelector('#pathNext').textContent.trim() === 'Przeczytajcie notatkę'; }));
      ok('exit1 task with a chosen track: write the criterion', await f.evaluate(() => { const t = team(); t.onboardedAt = 'x'; qz(t, 'life'); t.track = 'forecast'; save(); go('brief'); return document.querySelector('#pathNext').textContent.trim() === 'Wpiszcie kryterium sukcesu'; }));
      ok('exit1 English action text', await f.evaluate(() => { S.lang = 'en'; render(); const s = document.querySelector('#pathNext').textContent.trim(); S.lang = 'pl'; render(); return s === 'Write the success criterion'; }));
      ok('exit1 no page errors (4)', !f.errs.length, f.errs.join('|'));
      await f.close(); }
    // 5: Escape closes a glossary tooltip without moving focus.
    { const p = await fresh('#/lab/vision'); await p.mouse.move(0, 0);
      const tip = () => p.$eval('#proto .gloss .gloss-tip', e => getComputedStyle(e).display !== 'none');
      await p.focus('#proto .gloss'); const a = await tip();
      await p.keyboard.press('Escape');
      ok('exit1 Escape hides the glossary tip and keeps focus', a && !(await tip()) && await p.$eval('#proto .gloss', e => e === document.activeElement));
      await p.evaluate(() => document.activeElement.blur()); await p.focus('#proto .gloss');
      ok('exit1 tip shows again on the next focus', await tip());
      await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement.blur()); await p.hover('#proto .gloss');
      ok('exit1 tip shows again on the next hover', await tip());
      await p.keyboard.press('Escape'); ok('exit1 Escape hides a hovered tip', !(await tip()));
      await p.mouse.move(0, 0); await p.keyboard.press('2'); ok('exit1 keys 1-7 still work after Escape', await p.evaluate(() => S.view) === 'brief');
      ok('exit1 no page errors (5)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
    // 7 + 8: report grammar and English wording.
    { const p = await fresh('#/lab/forecast');
      const gen = { vision: '„zawsze OK”', rag: 'wyszukiwania dosłownego', complaints: 'klasy większościowej', forecast: 'średniej historycznej', maint: 'reguły PROCES-05' };
      const nom = ['wyszukiwanie dosłowne', 'klasa większościowa', 'średnia historyczna', 'reguła PROCES-05'];
      for (const k of Object.keys(gen)) {
        const md = await p.evaluate(k => { const t = team(); t.track = k; t.log = [{ id: 'r1', ts: '', track: k, cfg: { x: 1 }, res: { primary: { m: 'F1', v: .5, base: .3, hi: true } }, note: '', testViews: 0 }]; return reportMD(); }, k);
        ok(`exit1 report declines the baseline name (${k})`, md.includes('wobec ' + gen[k]) && !nom.some(n => md.includes('wobec ' + n)), (md.match(/wobec [^:]*/) || [''])[0]); }
      const en = await p.evaluate(() => { S.lang = 'en'; const r = [0, 1, 2].map(fp => recapText('vision', { tp: 1, fp, fn: 0 }, { set: 'val', n: 60 })); const md = reportMD(); S.lang = 'pl'; return { r, md }; });
      ok('exit1 English vision recap: false alarm forms', en.r[0].includes('0 good cans (false alarms)') && en.r[1].includes('1 good can (false alarm)') && en.r[2].includes('2 good cans (false alarms)'), JSON.stringify(en.r));
      ok('exit1 English report unchanged (vs)', en.md.includes('vs PROCES-05 rule'), (en.md.match(/vs [^:]*/) || [''])[0]);
      await p.click('#runBase'); const pl = await p.$eval('#baseOut .headline .stat', e => e.textContent);
      await p.click('#langSeg button[data-l=en]'); await p.click('#runBase'); const enh = await p.$eval('#baseOut .headline .stat', e => e.textContent);
      const cnt = (s, re) => (s.match(re) || []).length;
      ok('exit1 forecast headline says baseline once', cnt(pl, /baseline|odniesienia/gi) <= 1 && cnt(enh, /baseline|odniesienia/gi) <= 1, JSON.stringify([pl, enh]));
      ok('exit1 no page errors (7, 8)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
  }
  if (run('gate')) { for (const [k, sel, key] of [['vision', '#visRv', 'vision'], ['rag', '#ragRv', 'rag'], ['complaints', '#rv', 'compl']]) { const p = await fresh('#/lab/' + k);
      ok(`gate ${k}: reveal blocked without baseline`, await p.$eval(sel, e => e.dataset.blocked) === 'baseline');
      await p.click(sel); ok(`gate ${k}: click does not reveal or count`, await p.evaluate(key => !lab()[key].revealed && lab()[key].testViews === 0, key));
      ok(`gate ${k}: focus moves to the baseline button`, await p.evaluate(() => document.activeElement.id) === 'runBase');
      await p.click('#runBase'); await p.click('#saveBase');
      ok(`gate ${k}: now blocked on the justification`, await p.$eval(sel, e => e.dataset.blocked) === 'why');
      await p.click(sel); ok(`gate ${k}: focus moves to the justification`, await p.evaluate(() => document.activeElement.id) === 'methWhy');
      await p.fill('#methWhy', 'Reguły są tanie i wyjaśnialne, a danych jest mało.');
      ok(`gate ${k}: gate open`, await p.$eval(sel, e => e.dataset.blocked) === '');
      await p.click(sel); ok(`gate ${k}: reveal works and counts once`, await p.evaluate(key => lab()[key].revealed && lab()[key].testViews === 1, key));
      await p.click(sel); ok(`gate ${k}: hiding is never gated`, await p.evaluate(key => !lab()[key].revealed && lab()[key].testViews === 1, key));
      ok(`gate ${k}: re-reveal after a hide stays open`, await p.$eval(sel, e => e.dataset.blocked) === '');
      ok(`gate ${k}: no page errors`, !p.errs.length, p.errs.join('|'));
      await p.close(); }
    { const p = await fresh('#/lab/vision');
      await seed(p, () => { S.teams[S.team] = normTeam({ track: 'vision', lab: { vision: { revealed: true, testViews: 3 } } }); });
      ok('gate old file with a revealed test stays revealed and ungated', await p.evaluate(() => lab().vision.revealed && revealGate('vision') === ''));
      ok('gate old revealed track counts the path baseline step as done', await p.evaluate(() => pathState(team()).steps.find(s => s.id === 'base').done));
      await seed(p, () => { S.teams[S.team] = normTeam({ track: 'vision', log: [{ id: 'e1', ts: '', track: 'vision', cfg: { x: 1 }, res: { primary: { m: 'F1', v: .5, base: 0, hi: true } }, note: '', testViews: 0 }] }); });
      ok('gate path baseline step needs a saved baseline, not any entry', await p.evaluate(() => !pathState(team()).steps.find(s => s.id === 'base').done));
      await p.close(); }
    { const t = await fresh('#/lab/vision', '&trainer=1');
      ok('gate trainer bypasses the gate', await t.evaluate(() => revealGate('vision')) === '' && await t.evaluate(() => document.body.dataset.trainer) === 'true');
      ok('gate trainer flag is never persisted', await t.evaluate(() => { save(); return !/trainer/.test(localStorage.getItem(STORE_KEY)); }));
      await t.close(); }
    { const b = await fresh('#/lab/maint'); await b.click('#runBase'); await b.click('#saveBase');
      await b.evaluate(() => { lab().mt.thr = 3; save(); render(); }); await b.click('#sv');
      ok('gate banner compares tuning-set values only', await b.$eval('#baseBanner', e => ['true', 'false'].includes(e.dataset.beaten) && e.dataset.base !== '' && e.dataset.best !== ''));
      ok('gate participant body flag', await b.evaluate(() => document.body.dataset.trainer) === 'false');
      await b.close(); }
    { const f = await fresh('#/lab/forecast');
      const r = await f.evaluate(() => { const t = team(); t.log = [{ id: 'b', ts: '', track: 'forecast', cfg: { base: true }, res: { primary: { m: 'MAPE', v: .3, base: .3, hi: false } }, note: '', testViews: 0, base: true }, { id: 'e', ts: '', track: 'forecast', cfg: { x: 1 }, res: { primary: { m: 'MAPE', v: .2, base: .3, hi: false } }, note: '', testViews: 0 }]; renderBaseBanner('forecast'); return $('#baseBanner').dataset.beaten; });
      ok('gate lower error beats the baseline on forecast', r === 'true', r);
      await f.close(); }
    { const v = await fresh('#/lab/vision');
      const r = await v.evaluate(() => { const t = team(); t.log = [{ id: 'b', ts: '', track: 'vision', cfg: { base: true, set: 'val' }, res: { val: { f1: 0 }, primary: { m: 'F1', v: 0, base: 0, hi: true } }, note: '', testViews: 0, base: true }, { id: 'e', ts: '', track: 'vision', cfg: { x: 1 }, res: { val: { f1: .4 }, test: { f1: .9 }, primary: { m: 'F1', v: .9, base: 0, hi: true, test: true } }, note: '', testViews: 1 }]; renderBaseBanner('vision'); const e = $('#baseBanner'); return { best: e.dataset.best, txt: e.textContent }; });
      ok('gate vision banner never reads a test-set value', r.best === '0.4' && !r.txt.includes('90'), JSON.stringify(r));
      await v.close(); }
    // Review round 1: like-with-like banner, focus on an unsaved baseline, visible justification minimum.
    { const f = await fresh('#/lab/forecast');
      const fb = (v, base, p) => ({ id: 'e' + p + v, ts: '', track: 'forecast', cfg: { p, h: 6, w: 3 }, res: { primary: { m: 'MAPE', v, base, hi: false } }, note: '', testViews: 0 });
      const B = { id: 'b', ts: '', track: 'forecast', cfg: { base: true, p: 0, h: 6 }, res: { primary: { m: 'MAPE', v: .3, base: .3, hi: false } }, note: '', testViews: 0, base: true };
      const cross = await f.evaluate(([B, E]) => { team().log = [B, E]; renderBaseBanner('forecast'); return { ...$('#baseBanner').dataset }; }, [B, fb(.05, .04, 1)]);
      ok('gate forecast: no cross-product "beaten"', cross.beaten !== 'true' && cross.base === '0.04' && cross.same === 'false', JSON.stringify(cross));
      const same = await f.evaluate(([B, E]) => { team().log = [B, E]; renderBaseBanner('forecast'); return { ...$('#baseBanner').dataset }; }, [B, fb(.2, .3, 0)]);
      ok('gate forecast: same product and horizon, lower MAPE beats', same.beaten === 'true' && same.base === '0.3' && same.same === 'true', JSON.stringify(same));
      await f.close(); }
    { const r = await fresh('#/lab/rag');
      const d = await r.evaluate(() => { team().log = [{ id: 'b', ts: '', track: 'rag', cfg: { base: true, set: 'dev', lang: 'pl' }, res: { primary: { m: 'x', v: .5, base: .5, hi: true, test: false } }, note: '', testViews: 0, base: true },
        { id: 'e', ts: '', track: 'rag', cfg: { k: 2, chunk: 'p', min: .1, lang: 'en' }, res: { primary: { m: 'x', v: .6, base: .7, hi: true, test: false } }, note: '', testViews: 0 }]; renderBaseBanner('rag'); return { ...$('#baseBanner').dataset }; });
      ok('gate rag: no cross-language claim', d.beaten === 'false' && d.base === '0.7' && d.same === 'false', JSON.stringify(d));
      await r.close(); }
    { const c = await fresh('#/lab/complaints');
      const d = await c.evaluate(() => { const ids = Array.from({ length: 16 }, (_, i) => 21 + i), dev = DATA.compl.slice(0, 36), cnt = {}; dev.forEach(x => cnt[x.category] = (cnt[x.category] || 0) + 1);
        const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0], want = ids.filter(i => DATA.compl[i - 1].category === top).length / ids.length;
        lab().compl.runs = [{ id: 'r1', ts: '', ver: 'v1', model: 'm', shots: 5, set: 'dev16', n: 16, acc: .3, ids, preds: ids.map(() => ({ c: 'other', h: false, r: '' })) }];
        team().log = [{ id: 'b', ts: '', track: 'complaints', cfg: { base: true, set: 'dev' }, res: { dev: .25, base: .25, primary: { m: 'x', v: .25, base: .25, hi: true, test: false } }, note: '', testViews: 0, base: true },
          { id: 'e', ts: '', track: 'complaints', cfg: { mode: 'llm', model: 'm', ver: 'v1', shots: 5, set: 'dev16' }, res: { acc: want + .01, base: .1, test: null, run: 'r1', primary: { m: 'x', v: want + .01, base: .1, hi: true, test: false } }, note: '', testViews: 0 }];
        renderBaseBanner('complaints'); return { ds: { ...$('#baseBanner').dataset }, want }; });
      ok('gate complaints: few-shot run compared with the majority class on its own subset', d.ds.base === String(d.want) && d.ds.beaten === 'true' && d.ds.same === 'false', JSON.stringify(d));
      await c.close(); }
    { const p = await fresh('#/lab/vision');
      await p.click('#runBase'); await p.click('#visRv');
      ok('gate run but unsaved baseline: focus on the save button', await p.evaluate(() => document.activeElement.id) === 'saveBase');
      await p.click('#saveBase'); await p.click('#labMethod details > summary'); await p.fill('#methWhy', 'tanie');
      ok('gate short justification keeps the gate closed', await p.$eval('#visRv', e => e.dataset.blocked) === 'why');
      await p.click('#visRv'); const short = await p.$eval('#toast', e => e.dataset.reason);
      await p.fill('#methWhy', ''); await p.click('#visRv'); const empty = await p.$eval('#toast', e => e.dataset.reason);
      ok('gate short justification gets its own message', short === 'short' && empty === 'why', JSON.stringify([short, empty]));
      ok('gate justification hint names the minimum', await p.$eval('#methWhy', e => { const h = document.getElementById(e.getAttribute('aria-describedby') || 'none'); return !!h && /jedno zdanie/.test(h.textContent) && /raport/.test(h.textContent); }));
      ok('gate no page errors (review)', !p.errs.length, p.errs.join('|'));
      await p.close(); }
    ok('gate double click on reveal counts one view', await (async () => { const d = await fresh('#/lab/rag', '&trainer=1'); await d.dblclick('#ragRv'); const n = await d.evaluate(() => lab().rag.testViews); await d.close(); return n >= 1 && n <= 2; })()); }
  if (run('site')) { const p = await fresh('#/rybex/news');
    ok('site route opens the frame', await p.$eval('.rybex-frame', e => e.dataset.page) === 'news' && await p.evaluate(() => S.view === 'rybex'));
    ok('site news tells the same incident', await p.evaluate(() => { const t = document.querySelector('.rybex-frame').textContent; return t.includes(STORY().lot) && t.includes(PRODUCTS[STORY().product][langIx()]); }));
    ok('site news read recorded', await p.evaluate(() => team().site.newsRead === true));
    ok('site address bar names the page', /^rybex\.example\/aktualnosci/.test(await p.$eval('.rybex-frame [data-addr]', e => e.textContent.trim())));
    ok('site one h1 per view, company headings start at h2', await p.evaluate(() => document.querySelectorAll('#main h1').length === 1 && !document.querySelector('.rybex-frame h1') && !!document.querySelector('.rybex-frame h2')));
    ok('site no workshop menu item is current', await p.evaluate(() => !document.querySelector('#nav [aria-current], #nav .on')));
    ok('site path bar renders on the site', await p.evaluate(() => !!document.querySelector('#pathBar #pathNext')));
    for (const pg of await p.evaluate(() => RYBEX_PAGES)) { await p.evaluate(pg => go('rybex', pg), pg); ok(`site fiction banner on ${pg}`, await p.$eval('.rybex-frame .fiction-banner', e => /fikcyjn/.test(e.textContent) && e.getBoundingClientRect().height > 0) && await p.$eval('.rybex-frame', (e, pg) => e.dataset.page === pg && !!e.querySelector('#backToWs') && !!e.querySelector(`nav[aria-label] [data-rp="${pg}"][aria-current="page"]`), pg)); }
    await p.evaluate(() => go('rybex', 'products'));
    ok('site products come from PRODUCTS', await p.evaluate(() => PRODUCTS.every(x => document.querySelector('.rybex-frame').textContent.includes(x[0]))));
    await p.waitForFunction(() => document.querySelectorAll('.rybex-frame img').length >= 1, null, { timeout: 8000 });
    ok('site product photos have alt text', await p.$$eval('.rybex-frame img', e => e.every(i => i.alt.trim().length > 10)));
    ok('site product photos differ per product', await p.$$eval('.rybex-frame img[data-vi]', e => e.length === 4 && new Set(e.map(i => i.dataset.vi)).size === 4));
    ok('site product photos are OK cans from the training set', await p.evaluate(() => [...document.querySelectorAll('.rybex-frame img[data-vi]')].every(i => VIS.train[+i.dataset.vi] && !VIS.train[+i.dataset.vi].bad)));
    await p.click('.rybex-frame [data-lab=vision]'); ok('site product links to the vision lab', await p.evaluate(() => S.view === 'lab' && S.sub.lab === 'vision'));
    await p.evaluate(() => go('rybex', 'quality')); await p.click('.rybex-frame [data-doc]');
    ok('site quality links to a PROCES document in the data folder', await p.evaluate(() => S.view === 'data' && /^PROCES-0[1-5]/.test(FSEL)));
    await p.evaluate(() => go('rybex', 'quality')); await p.click('.rybex-frame [data-lab=rag]'); ok('site quality links to the knowledge assistant lab', await p.evaluate(() => S.view === 'lab' && S.sub.lab === 'rag'));
    await p.evaluate(() => go('rybex', 'news')); await p.click('.rybex-frame [data-lab=forecast]'); ok('site news links to the forecast lab', await p.evaluate(() => S.view === 'lab' && S.sub.lab === 'forecast'));
    await p.evaluate(() => { team().name = 'Zespół Szprot'; save(); go('rybex', 'career'); }); ok('site career names the new team', await p.$eval('.rybex-frame', e => e.textContent.includes('Zespół Szprot')));
    await p.evaluate(() => go('rybex', 'about')); await p.click('.rybex-frame nav[aria-label] [data-rp=news]'); ok('site menu button switches the page', await p.evaluate(() => S.sub.rybex === 'news' && location.hash === '#/rybex/news'));
    await p.evaluate(() => go('rybex', 'home')); await p.keyboard.press('7'); ok('site workshop keys still work inside the frame', await p.evaluate(() => S.view) === 'deliver');
    await p.evaluate(() => go('rybex', 'home')); const want = await p.evaluate(() => { const s = pathState(team()).next; return s ? s.go[0] : 'home'; });
    await p.click('#backToWs'); ok('site back button goes to the next path step', await p.evaluate(() => S.view) === want, want);
    await p.evaluate(() => go('rybex', 'home')); await p.click('#pathNext'); ok('site path bar Next works from the site', await p.evaluate(() => S.view !== 'rybex'));
    await p.goto(p.url().replace(/#.*/, '#/rybex/nope')); await p.waitForTimeout(50); ok('site unknown page falls back to site home', await p.evaluate(() => S.sub.rybex) === 'home');
    ok('site no real brands on any page', await p.evaluate(() => RYBEX_PAGES.every(pg => { go('rybex', pg); return !/Biedronka|Lidl|Graal|Auchan|Kaufland|NIP|KRS|\+48/.test(document.querySelector('.rybex-frame').textContent); })));
    ok('site no page errors', !p.errs.length, p.errs.join('|')); await p.close();
    const q = await fresh('#/home'); ok('site photos not loaded before the products page', await q.evaluate(() => !VIS.initialized));
    ok('site memo links to the company news', await q.$eval('#memoSite', e => !e.disabled && e.getAttribute('href') === '#/rybex/news' && /Otwórz stronę firmy Rybex/.test(e.textContent)));
    await q.click('#memoSite'); await q.waitForFunction(() => S.view === 'rybex', null, { timeout: 3000 }).catch(() => {}); ok('site memo link opens the news page', await q.evaluate(() => S.view === 'rybex' && S.sub.rybex === 'news'));
    await q.goto(q.url().replace(/#.*/, '#/home')); await q.waitForFunction(() => S.view === 'home');
    await q.evaluate(() => { const x = JSON.parse(localStorage.getItem(STORE_KEY)); x.view = 'home'; x.sub = { demos: 'life', lab: 'vision' }; localStorage.setItem(STORE_KEY, JSON.stringify(x)); });
    await q.reload(); await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('site old saved state without sub.rybex still opens the site', await q.evaluate(() => { go('rybex'); return S.sub.rybex === 'home' && document.querySelector('.rybex-frame').dataset.page === 'home'; }));
    await q.close();
    for (const pg of ['home', 'news', 'products', 'quality', 'career']) { const m = await fresh('#/rybex/' + pg, '', { width: 375, height: 740 });
      await m.waitForTimeout(150); ok(`site 375 no horizontal scroll on ${pg}`, await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await m.evaluate(() => document.documentElement.scrollWidth)));
      if (pg === 'home') { ok('site 375 menu folds into a toggle', await m.evaluate(() => { const t = document.querySelector('.rybex-frame .rf-toggle'), l = document.querySelector('.rybex-frame .rf-menu'); return !!t && t.offsetHeight > 0 && l.offsetHeight === 0 && t.getAttribute('aria-expanded') === 'false'; }));
        await m.click('.rybex-frame .rf-toggle'); ok('site 375 toggle opens the menu', await m.evaluate(() => document.querySelector('.rybex-frame .rf-menu').offsetHeight > 0 && document.querySelector('.rybex-frame .rf-toggle').getAttribute('aria-expanded') === 'true')); }
      await m.close(); } }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
