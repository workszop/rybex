// Regression checks for the UX_AUDIT.md acceptance criteria.
// Usage: serve the project on port 8794, then: node regression.mjs [chromium|firefox] [--firefox-path=...]
// Needs Playwright importable from the current directory.
import { chromium, firefox } from 'playwright';
import fs from 'fs';
const ROOT = process.env.APP_URL || 'http://localhost:8794/rybex-ai-workshop.html';
const engineName = process.argv[2] || 'chromium';
const ffPath = (process.argv.find(a => a.startsWith('--firefox-path=')) || '').split('=')[1];
const EV = process.env.EVIDENCE_DIR || '';
const DL = fs.mkdtempSync((process.env.TMPDIR || '/tmp') + '/rybex-dl-');
const engine = engineName === 'firefox' ? firefox : chromium;
const browser = await engine.launch(ffPath ? { executablePath: ffPath } : {});
let pass = 0, fail = 0; const failures = [];
function ok(id, cond, detail = '') { if (cond) { pass++; console.log(`  PASS ${id}`); } else { fail++; failures.push(id + ' ' + detail); console.log(`  FAIL ${id} ${detail}`); } }
async function fresh(vp = { width: 1440, height: 900 }, hash = '', lang) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage(); p.errs = []; p.dlgs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => { p.dlgs.push(d.message()); d.accept(); });
  await p.goto(ROOT + hash); await ready(p);
  if (lang === 'en') await p.click('#langSeg button[data-l=en]');
  return p;
}
const ready = p => p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 8000 });
const nav = (p, v) => p.click(`#nav button[data-v=${v}]`);
const track = (p, k) => p.click(`#trackTabs button[data-k=${k}]`);
const sub = p => p.evaluate(() => S.sub.lab);
const val = (p, s) => p.$eval(s, e => e.value);
const shot = async (p, n, full = true) => { if (EV) await p.screenshot({ path: `${EV}/after-${n}.png`, fullPage: full }); };
async function drag(p, sel, from, to) {
  await p.$eval(sel, e => e.scrollIntoView({ block: 'center' }));
  const b = await (await p.$(sel)).boundingBox(), y = b.y + b.height / 2;
  await p.mouse.move(b.x + b.width * from, y); await p.mouse.down();
  const trail = []; for (let i = 1; i <= 6; i++) { await p.mouse.move(b.x + b.width * (from + (to - from) * i / 6), y, { steps: 3 }); await p.waitForTimeout(30); trail.push(await val(p, sel)); }
  await p.mouse.up(); return { trail, end: +await val(p, sel), distinct: new Set(trail).size };
}
async function typeInto(p, sel, s) { await p.focus(sel); await p.keyboard.press('Control+A'); await p.keyboard.type(s, { delay: 30 }); }
async function download(p, sel, name) { const w = p.waitForEvent('download', { timeout: 6000 }); await p.click(sel); const d = await w; const f = DL + '/' + name; await d.saveAs(f); return { name: d.suggestedFilename(), file: f }; }

console.log(`\nEngine: ${engineName} ${browser.version()}`);

console.log('\nUX-001 forecast tabs');
{ const p = await fresh(); await nav(p, 'lab'); await track(p, 'forecast');
  for (const k of ['maint', 'vision', 'rag', 'complaints']) { await track(p, 'forecast'); await track(p, k); ok(`001 forecast -> ${k}`, await sub(p) === k); }
  await track(p, 'forecast'); ok('001 chart on return', !!(await p.$('#fcRes svg')));
  await p.click('#fcProducts button[data-p="2"]'); await track(p, 'maint'); ok('001 after product change', await sub(p) === 'maint');
  await track(p, 'forecast'); await p.reload(); await ready(p); await track(p, 'rag'); ok('001 after reload', await sub(p) === 'rag');
  ok('001 no console errors', p.errs.length === 0, p.errs.join('|')); }

console.log('\nUX-002 sliders');
{ const p = await fresh(); const cases = [['demos', 'metr', '#th'], ['demos', 'metr', '#pv'], ['demos', 'split', '#tp']];
  for (const [v, s, sel] of cases) { await p.evaluate(([v, s]) => go(v, s), [v, s]); await p.waitForSelector(sel); const r = await drag(p, sel, .2, .9); ok(`002 drag ${s} ${sel}`, r.distinct >= 4 && r.end > +r.trail[0], JSON.stringify(r)); }
  await nav(p, 'lab'); for (const [k, sels] of [['vision', ['#vd', '#vs', '#vc']], ['rag', ['#rk', '#rc', '#rm']], ['forecast', ['#fh', '#fw']], ['maint', ['#mt', '#mw']]]) { await track(p, k); for (const sel of sels) { const r = await drag(p, sel, .1, .9); ok(`002 drag ${k} ${sel}`, r.distinct >= 3, JSON.stringify(r)); } }
  await track(p, 'maint'); await p.focus('#mt'); const v0 = +await val(p, '#mt'); for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
  ok('002 arrows move 4 steps', Math.abs(+await val(p, '#mt') - v0 - .4) < .001); ok('002 focus kept', await p.evaluate(() => document.activeElement.id) === 'mt');
  const f0 = await p.$eval('#mtRes', e => e.dataset.f1); await drag(p, '#mt', .1, .8); ok('002 results update live', f0 !== await p.$eval('#mtRes', e => e.dataset.f1)); ok('002 no errors', !p.errs.length, p.errs.join('|')); }

console.log('\nUX-003 price');
{ const p = await fresh(undefined, '#/demos/tok');
  await typeInto(p, '#tpIn', '15'); ok('003 15 stays 15', await val(p, '#tpIn') === '15');
  await typeInto(p, '#tpIn', '0.15'); await typeInto(p, '#tpOut', '0.15'); ok('003 0.15 stays', await val(p, '#tpIn') === '0.15');
  ok('003 cost 3.45', await p.$eval('#costOut', e => e.dataset.cost) === '3.45', await p.$eval('#costOut', e => e.dataset.cost));
  await typeInto(p, '#tpIn', '0,15'); ok('003 decimal comma', await p.$eval('#costOut', e => e.dataset.cost) === '3.45');
  await typeInto(p, '#tpIn', 'abc'); ok('003 invalid flagged', await p.$eval('#tpIn', e => e.getAttribute('aria-invalid')) === 'true' && (await p.textContent('#tpInE')).length > 0);
  ok('003 invalid gives no cost', await p.$eval('#costOut', e => e.dataset.cost) === ''); await typeInto(p, '#tpIn', '-3'); ok('003 negative rejected', await p.$eval('#tpIn', e => e.getAttribute('aria-invalid')) === 'true');
  await p.fill('#tkCalls', '20000'); await typeInto(p, '#tpIn', '1'); await p.fill('#tpOut', '1'); ok('003 volume editable', await p.$eval('#costOut', e => e.dataset.cost) === '46.00'); await typeInto(p, '#tpOut', '2'); ok('003 focus kept', await p.evaluate(() => document.activeElement.id) === 'tpOut');
  await p.fill('#tt', 'Zażółć gęślą jaźń'); ok('003 text focus kept', await p.evaluate(() => document.activeElement.id) === 'tt'); await p.fill('#tt', ''); ok('003 empty text ok', !p.errs.length); }

console.log('\nUX-004 team file, tabs, failed save');
{ const p = await fresh(undefined, '#/lab/maint'); await p.fill('#teamName', 'Zespół Żółw'); await p.click('#sv'); await nav(p, 'deliver'); await p.fill('textarea[data-n="1"]', 'notatka ąę'); await p.click('input[data-c="1.0"]'); await nav(p, 'arch'); await p.click('button[data-p=vision]');
  const f = await download(p, '#teamExport', 'team.json'); ok('004 file name', f.name === 'rybex_team_1.json');
  const q = await fresh(); await q.selectOption('#teamSel', '3'); await q.setInputFiles('#teamFile', f.file); await q.click('#toast .toast-act'); await q.waitForFunction(() => team().name === 'Zespół Żółw');
  const t = await q.evaluate(() => team()); ok('004 restores name, note, check, log, arch', t.notes[1] === 'notatka ąę' && t.checks['1.0'] === true && t.log.length === 1 && Object.keys(t.arch.sel).length > 5);
  ok('004 import has undo', (await q.textContent('#toast')).includes('Cofnij')); await q.click('#toast button'); ok('004 undo import', await q.evaluate(() => team().name) === '');
  const bad = DL + '/bad.json'; fs.writeFileSync(bad, '{"hello":1}'); await q.setInputFiles('#teamFile', bad); await q.waitForTimeout(200); ok('004 wrong file rejected', (await q.textContent('#toast')).includes('Nic nie zmieniono') && await q.evaluate(() => team().log.length) === 0);
  fs.writeFileSync(bad, 'not json {'); await q.setInputFiles('#teamFile', bad); await q.waitForTimeout(200); ok('004 broken json rejected', (await q.textContent('#toast')).includes('Nic nie zmieniono'));
  // hostile file content stays inert
  fs.writeFileSync(bad, JSON.stringify({ app: 'rybex-ai-workshop', data: { name: '<img src=x onerror=window.__x=1>', notes: { 1: '<script>window.__x=1</script>' }, log: [{ ts: '<b>', track: '<img src=x onerror=window.__x=1>', text: '<img src=x onerror=window.__x=1>', note: '<i>' }], lab: { fc: { p: 99, h: 'x' }, rag: { msgs: [{ q: '<img src=x onerror=window.__x=1>', a: '<img src=x onerror=window.__x=1>', src: [{ doc: '<b>', par: '<b>' }] }] } } } }));
  await q.setInputFiles('#teamFile', bad); await q.click('#toast .toast-act'); await q.waitForFunction(() => team().log.length === 1); await nav(q, 'deliver'); await q.evaluate(() => go('lab', 'rag')); await q.waitForSelector('#chat .msg'); await q.evaluate(() => go('lab', 'forecast')); await q.waitForSelector('#fcRes svg'); await q.evaluate(() => go('deliver')); await q.waitForTimeout(150);
  ok('004 hostile import inert', !(await q.evaluate(() => window.__x)) && !q.errs.length, q.errs.join('|'));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const a = await ctx.newPage(), b = await ctx.newPage(); await a.goto(ROOT); await b.goto(ROOT); await ready(a); await ready(b);
  await a.evaluate(() => go('lab', 'maint')); await a.waitForSelector('#sv'); await a.click('#sv'); await b.waitForFunction(() => team().log.length === 1, null, { timeout: 3000 }).catch(() => {}); await b.evaluate(() => go('deliver')); await b.waitForSelector('textarea[data-n="1"]'); await b.fill('textarea[data-n="1"]', 'druga karta'); await a.reload(); await ready(a);
  ok('004 two tabs keep both', await a.evaluate(() => team().log.length === 1 && team().notes[1] === 'druga karta'));
  await b.selectOption('#teamSel', '2'); await b.fill('#teamName', 'B'); await a.evaluate(() => go('lab', 'rag')); await a.waitForSelector('#sv'); await a.click('#sv'); await b.reload(); await ready(b); ok('004 other team survives', await b.evaluate(() => S.teams[1].log.length === 2 && S.teams[2].name === 'B'));
  const c2 = await browser.newContext(); const s = await c2.newPage(); await s.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('quota'); }; }); await s.goto(ROOT + '#/lab/maint'); await ready(s); await s.click('#sv');
  ok('004 failed save warns', await s.isVisible('#saveWarn')); ok('004 no false success', !(await s.textContent('#toast')).includes('Zapisano')); }

console.log('\nUX-005 test discipline');
{ const p = await fresh(undefined, '#/lab/vision'); const res = () => p.$eval('#visRes', e => ({ ...e.dataset }));
  let r = await res(); ok('005 tuning shows validation', r.set === 'val' && r.testVisible === 'false' && r.testViews === '0'); ok('005 no test score in default', !(await p.textContent('#visRes')).includes('testowym'));
  await p.click('#visRv'); r = await res(); ok('005 reveal shows test, counted', r.set === 'test' && r.testViews === '1'); ok('005 sliders locked', await p.$eval('#vd', e => e.disabled) && await p.$eval('#cal', e => e.disabled));
  await p.click('#sv'); const l = await p.evaluate(() => team().log.at(-1)); ok('005 log stamps views', l.testViews === 1 && !!l.res.test);
  await p.click('#visRv'); await p.click('#visRv'); ok('005 second reveal counted', (await res()).testViews === '2'); await p.click('#visRv');
  await p.reload(); await ready(p); ok('005 count survives reload', (await res()).testViews === '2');
  await p.evaluate(() => go('lab', 'complaints')); await p.waitForSelector('#cStats'); const c = () => p.$eval('#cStats', e => ({ ...e.dataset }));
  ok('005 complaints test hidden', (await c()).test === undefined); await p.click('#rv'); ok('005 complaints reveal counted', (await c()).testViews === '1' && (await c()).test !== undefined); ok('005 keywords locked', await p.$eval('#kw_label', e => e.disabled) && await p.$eval('#rs', e => e.disabled));
  const q = await fresh(undefined, '#/data'); await q.click('.tree button[data-k=compl]'); const cats = await q.$$eval('#viewer .tscroll.tall tr', rs => rs.slice(1).map(x => x.lastElementChild.textContent)); ok('005 test labels masked', cats.slice(36).every(x => x === 'ukryta') && cats.slice(0, 36).every(x => x !== 'ukryta'));
  const d = await download(q, '#dlc2', 'test.csv'); const csv = fs.readFileSync(d.file, 'utf8'); ok('005 unlabeled csv', !csv.includes('category') && csv.trim().split('\n').length >= 25 && d.name === 'complaints_test_unlabeled.csv'); ok('005 no full file yet', !(await q.$('#dlc3')));
  await q.evaluate(() => go('lab', 'complaints')); await q.waitForSelector('#rv'); await q.click('#rv'); await q.evaluate(() => go('data')); await q.waitForSelector('#dlc3'); ok('005 full file after reveal', true); }

console.log('\nUX-006 RAG evaluation');
{ for (const lang of ['pl', 'en']) { const p = await fresh(undefined, '#/lab/rag', lang); const r = () => p.$eval('#ragRes', e => ({ ...e.dataset }));
    const d = await r(); console.log('   defaults', lang, JSON.stringify(d)); ok(`006 ${lang} below 100%`, +d.ok < +d.n || +d.hit < +d.n, JSON.stringify(d));
    const grid = await p.evaluate(() => { const o = []; for (const chunk of [1, 2, 3, 4]) for (const k of [1, 2, 3, 5]) for (const min of [0, .12, .3, .5]) { const e = ragEval({ k, chunk, min }); o.push([k, chunk, min, e.hit, e.ok, e.ref, e.prec.toFixed(4)].join(',')); } return o; });
    const by = (i, ...rest) => { const m = {}; grid.forEach(g => { const a = g.split(','); const key = a.filter((_, j) => j !== i && j < 3).join(); (m[key] = m[key] || new Set()).add(a.slice(3).join()); }); return Object.values(m).some(s => s.size > 1); };
    ok(`006 ${lang} k changes a metric`, by(0)); ok(`006 ${lang} chunk changes a metric`, by(1)); ok(`006 ${lang} threshold changes a metric`, by(2));
    ok(`006 ${lang} defaults report oos separately`, +d.nOos === 3); ok(`006 ${lang} baseline shown`, d.baseOk !== undefined);
    await p.click('#oosQ'); const t = await p.textContent('#chat'); ok(`006 ${lang} oos explained`, /powyżej|above/.test(t)); ok(`006 ${lang} focus back to input`, await p.evaluate(() => document.activeElement.id) === 'qi');
    await p.evaluate(() => { lab().rag.min = .6; }); const q = await p.evaluate(() => RQ.find(r => r.oos).q[S.lang === 'pl' ? 0 : 1]); await p.fill('#qi', q); await p.keyboard.press('Enter'); const a = await p.$$eval('#chat .msg.a', e => e.at(-1).textContent); ok(`006 ${lang} high threshold refuses, no citation`, /Nie znalazłem|could not find/.test(a) && !/PROCES-/.test(a));
    await p.evaluate(() => { lab().rag.min = .12; }); ok(`006 ${lang} no errors`, !p.errs.length, p.errs.join('|')); } }

console.log('\nUX-007 reproducible experiments');
{ const p = await fresh(undefined, '#/lab/complaints'); await p.fill('#kw_delivery', 'zamówieni, dostaw, kurier, faktur, palet, karton'); const before = await p.$eval('#cStats', e => e.dataset.dev);
  await p.fill('#expNote', 'Hipoteza: karton pomoże'); await p.click('#sv'); const l = await p.evaluate(() => team().log.at(-1)); ok('007 log has keywords and note', l.cfg.kw.delivery.includes('karton') && l.note.includes('karton'));
  await p.click('#sv'); ok('007 no duplicate', await p.evaluate(() => team().log.length) === 1); await p.reload(); await ready(p); ok('007 keywords survive reload', (await val(p, '#kw_delivery')).includes('karton'));
  await p.selectOption('#teamSel', '3'); await p.waitForSelector('#kw_delivery'); ok('007 team isolation', !(await val(p, '#kw_delivery')).includes('karton')); await p.selectOption('#teamSel', '1'); await p.waitForSelector('#kw_delivery');
  await p.fill('#kw_delivery', 'x'); const changed = await p.$eval('#cStats', e => e.dataset.dev); ok('007 metric moved', changed !== before); await nav(p, 'deliver'); await p.click('button[data-r="0"]'); await p.waitForSelector('#cStats');
  ok('007 restore gives same metric', await p.$eval('#cStats', e => e.dataset.dev) === before); ok('007 restore sets field', (await val(p, '#kw_delivery')).includes('karton'));
  for (const k of ['vision', 'rag', 'forecast', 'maint']) { await track(p, k); await p.click('#sv'); } await nav(p, 'deliver'); const txt = await p.textContent('#logBox'); ok('007 log renders all tracks', txt.includes('MAPE') && txt.includes('hit@k') && txt.includes('F1')); ok('007 no errors', !p.errs.length, p.errs.join('|'));
  await p.click('#langSeg button[data-l=en]'); const en = await p.textContent('#logBox'); ok('007 log follows language', en.includes('correct answers') && !en.includes('poprawne odpowiedzi')); }

console.log('\nUX-008 report');
{ const p = await fresh(undefined, '#/lab/vision'); await p.click('#pickTrack'); await p.click('input[name=meth][value="0"]'); await p.fill('#methWhy', 'Bo <tanie> i wyjaśnialne'); await p.click('#visRv'); await p.click('#sv'); await nav(p, 'arch'); await p.click('button[data-p=vision]'); await nav(p, 'deliver');
  const h = await download(p, '#expH', 'r.html'); const html = fs.readFileSync(h.file, 'utf8'); ok('008 html has diagram', html.includes('<svg')); ok('008 states track, method, why, best', /Wizyjna kontrola/.test(html) && /Reguły na cechach/.test(html) && html.includes('Bo &lt;tanie&gt;') && /F1 \(test\)/.test(html) && html.includes('zawsze OK')); ok('008 infra localized', html.includes('hybrydowa')); ok('008 title fallback', html.includes('<h1>Zespół 1</h1>'));
  const m = await download(p, '#exp', 'r.md'); const md = fs.readFileSync(m.file, 'utf8'); ok('008 md embeds diagram', md.includes('data:image/svg+xml;base64,')); ok('008 md summary', md.includes('Wizyjna kontrola') && md.includes('Bo &lt;tanie&gt;')); if (EV) { const v = await p.context().newPage(); await v.goto('file://' + h.file); await v.screenshot({ path: `${EV}/after-report.png`, fullPage: true }); await v.close(); } }

console.log('\nUX-009 safety');
{ const p = await fresh(undefined, '#/lab/complaints'); const safe = await p.evaluate(() => DATA.compl.filter(c => c.hazard).every(c => { const d = draftFor(c.text, lab().compl.kw, lab().compl.safety); return d.h && /24/.test(d.text) && /(nie spożywać|not consume)/i.test(d.text); })); ok('009 every hazard draft escalates', safe);
  const i = await p.evaluate(() => DATA.compl.slice(0, 36).findIndex(c => /wybrzusz/.test(c.text))); await p.click(`#cList tr[data-i="${i}"]`); ok('009 bulging marked', await p.$eval('#cDraft', e => e.dataset.hazard) === 'true'); const t = await p.textContent('#cDraft'); ok('009 draft text', /24 godzin/.test(t) && /Bezpieczeństwo żywności/.test(t));
  ok('009 recall 100% by default', +await p.$eval('#cStats', e => e.dataset.safety) === 1); await p.fill('#kwSafety', 'zapach'); ok('009 metric reacts', +await p.$eval('#cStats', e => e.dataset.safety) < 1); await p.click('#rs'); }

console.log('\nUX-010 data folder');
{ const p = await fresh(undefined, '#/data'); await p.click('.tree button[data-k=img]'); ok('010 all 210 shown', (await p.$$('#viewer .thumb')).length === 210); const z = await download(p, '#dlzip', 'c.zip'); const buf = fs.readFileSync(z.file); ok('010 zip signature', buf[0] === 0x50 && buf[1] === 0x4b); ok('010 zip has 211 entries', buf.readUInt16LE(buf.length - 12) === 211, String(buf.readUInt16LE(buf.length - 12)));
  await p.click('.tree button[data-k=sensors]'); ok('010 preview notice', await p.$eval('#viewer [data-preview]', e => e.dataset.preview) === '40/600' && (await p.textContent('#viewer')).includes('z 600')); await p.click('.tree button[data-k=log]'); ok('010 log download', (await download(p, '#dlb', 'l.md')).name === 'team_log.md');
  await p.click('.tree button[data-k=md]'); const b = await p.textContent('#viewer pre'); ok('010 brief full', b.includes('Celem projektu') && b.includes('Przykładowe tematy') && !b.includes('—')); await nav(p, 'arch'); await p.click('button[data-p=rag]'); await nav(p, 'data'); await p.click('.tree button[data-k=svg]'); ok('010 svg download', (await download(p, '#dlb', 'a.svg')).name === 'architecture.svg'); }

console.log('\nUX-011 keyboard');
{ const p = await fresh(undefined, '#/arch'); ok('011 all interactive focusable', await p.$$eval('.chip,.tabs button', e => e.every(x => x.tagName === 'BUTTON')));
  await p.focus('.chip[data-o=erp]'); await p.keyboard.press('Enter'); ok('011 enter toggles', await p.evaluate(() => !!team().arch.sel.erp)); ok('011 focus stays after toggle', await p.evaluate(() => document.activeElement.dataset.o === 'erp')); await p.keyboard.press('Space'); ok('011 space toggles', await p.evaluate(() => !team().arch.sel.erp)); await p.focus('.chip[data-o=erp]'); await p.keyboard.press('Space'); ok('011 diagram via keyboard', !!(await p.$('#archOut svg')));
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('2'); await p.waitForFunction(() => S.view === 'brief'); ok('011 shortcut 2', true); await p.fill('#teamName', '123'); ok('011 digits in field no nav', await p.evaluate(() => S.view) === 'brief'); ok('011 topic cards buttons', await p.$$eval('[data-t]', e => e.length === 5 && e.every(x => x.tagName === 'BUTTON')));
  await p.click('#main [data-t=vision]'); ok('brief task click does not open the lab', await p.evaluate(() => S.view === 'brief' && team().track === 'vision'));
  await p.evaluate(() => go('data')); await p.waitForSelector('.tree button'); ok('011 tree buttons', await p.$$eval('.tree button', e => e.length === 12)); await p.focus('.tree button[data-k=sales]'); await p.keyboard.press('Enter'); ok('011 tree keeps focus', await p.evaluate(() => document.activeElement.dataset.k) === 'sales');
  await p.evaluate(() => go('lab', 'rag')); await p.waitForSelector('#qi'); await p.fill('#qi', 'Jaki format ma kod partii?'); await p.keyboard.press('Enter'); ok('011 focus returns to chat', await p.evaluate(() => document.activeElement.id) === 'qi'); await p.keyboard.type('Jak'); ok('011 can type follow-up', await val(p, '#qi') === 'Jak'); ok('011 live region exists', !!(await p.$('[aria-live=polite]')));
  await p.evaluate(() => go('demos', 'rag')); await p.waitForSelector('#pl'); await p.click('#pl'); await p.waitForTimeout(300); const e0 = p.errs.length; await nav(p, 'home'); await p.waitForTimeout(1600); ok('019 play then leave no error', p.errs.length === e0); }

console.log('\nUX-012 forecast legend');
{ const p = await fresh(undefined, '#/lab/forecast'); ok('012 chips carry swatch', await p.$$eval('#fcChips .chip svg.sw', e => e.length === 5)); ok('012 legend covers shown', await p.$$eval('#fcRes .legend span', e => e.length === 1 + 3)); await p.click('#fcChips .chip[data-m=ma]'); ok('012 legend updates', await p.$$eval('#fcRes .legend span', e => e.length === 1 + 4));
  ok('012 best row readable', await p.$eval('#fcRes tr.best td', e => { const c = getComputedStyle(e); return c.color !== c.backgroundColor; }));
  const clip = await p.evaluate(() => { const s = document.querySelector('#fcRes svg'), r = s.getBoundingClientRect(); return [...s.querySelectorAll('text')].every(t => { const b = t.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1; }); }); ok('012 axis labels not clipped', clip); }

console.log('\nUX-013 inspector');
{ const p = await fresh(undefined, '#/lab/vision'); const cls = await p.$$eval('#visRes .thumb', e => e.map(x => x.dataset.cls)); ok('013 key lists TN', (await p.textContent('.keyrow')).includes('TN')); const iFN = cls.indexOf('fn'), i = iFN >= 0 ? iFN : cls.indexOf('tp'); await p.click(`#visRes .thumb[data-i="${i}"]`); ok('013 dialog opens', await p.evaluate(() => document.querySelector('#insp').open)); const t = await p.textContent('#insp'); ok('013 shows features', /Próg/.test(t) && /Energia krawędzi/.test(t)); if (iFN >= 0) ok('013 explains missed rule', /nie zadziałała/.test(t), t);
  await shot(p, 'inspector', false); await p.keyboard.press('Escape'); ok('013 esc closes', !(await p.evaluate(() => document.querySelector('#insp').open))); }

console.log('\nUX-014 undo');
{ const p = await fresh(undefined, '#/arch'); await p.click('.chip[data-o=hitl]'); await p.click('.chip[data-o=erp]'); await p.click('button[data-p=rag]'); ok('014 template applied', await p.evaluate(() => !team().arch.sel.erp && !!team().arch.sel.llm)); await p.click('#toast button'); ok('014 undo template', await p.evaluate(() => !!team().arch.sel.erp && !team().arch.sel.llm));
  await p.click('#clr'); await p.click('#toast button'); ok('014 undo clear', await p.evaluate(() => !!team().arch.sel.hitl)); await p.evaluate(() => go('lab', 'maint')); await p.waitForSelector('#sv'); await p.click('#sv'); await nav(p, 'deliver'); await p.click('button[data-d="0"]'); ok('014 deleted', await p.evaluate(() => team().log.length) === 0); await p.click('#toast button'); ok('014 undo delete', await p.evaluate(() => team().log.length) === 1); await p.reload(); await ready(p); ok('014 undo persisted', await p.evaluate(() => team().log.length) === 1); }

console.log('\nUX-015 narrow');
{ const p = await fresh({ width: 390, height: 844 }); const of = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  for (const v of ['home', 'brief', 'data']) { await p.evaluate(v => go(v), v); await p.waitForTimeout(80); ok(`015 ${v}`, await of(), String(await p.evaluate(() => document.documentElement.scrollWidth))); await shot(p, 'mobile-' + v); }
  for (const k of ['img', 'sales', 'sensors', 'compl', 'svg', 'log']) { await p.click(`.tree button[data-k=${k}]`); ok(`015 data ${k}`, await of(), String(await p.evaluate(() => document.documentElement.scrollWidth))); }
  for (const s of ['life', 'tok', 'rag', 'split', 'metr']) { await p.evaluate(s => go('demos', s), s); await p.waitForTimeout(80); ok(`015 demo ${s}`, await of(), String(await p.evaluate(() => document.documentElement.scrollWidth))); }
  for (const k of ['vision', 'rag', 'complaints', 'forecast', 'maint']) { await p.evaluate(k => go('lab', k), k); await p.waitForTimeout(100); ok(`015 lab ${k}`, await of(), String(await p.evaluate(() => document.documentElement.scrollWidth))); await shot(p, 'mobile-lab-' + k); }
  await p.evaluate(() => go('arch')); await p.waitForSelector('button[data-p=vision]'); await p.click('button[data-p=vision]'); ok('015 arch', await of()); const px = await p.evaluate(() => { const s = document.querySelector('#archOut svg'); return 12 * s.getBoundingClientRect().width / s.viewBox.baseVal.width; }); ok('015 diagram text readable', px >= 10, px.toFixed(1)); await p.evaluate(() => go('deliver')); await p.waitForTimeout(80); ok('015 deliver', await of()); ok('015 no errors', !p.errs.length, p.errs.join('|')); }

console.log('\nUX-016 navigation');
{ const p = await fresh(); await nav(p, 'brief'); await nav(p, 'lab'); await track(p, 'rag'); ok('016 deep url', p.url().endsWith('#/lab/rag')); await p.goBack(); await p.waitForFunction(() => S.sub.lab === 'vision'); ok('016 back to previous tab', true); await p.goBack(); await p.waitForFunction(() => S.view === 'brief'); ok('016 back to previous view', true); await p.goForward(); await p.waitForFunction(() => S.view === 'lab'); ok('016 forward', true);
  const q = await fresh(undefined, '#/demos/metr'); ok('016 direct link opens demo', await q.evaluate(() => S.view === 'demos' && S.sub.demos === 'metr') && !!(await q.$('#th'))); await q.evaluate(() => go('deliver')); await q.waitForSelector('#logBox'); await q.evaluate(() => window.scrollTo(0, 800)); await nav(q, 'brief'); await q.waitForFunction(() => S.view === 'brief'); ok('016 new view at top', await q.evaluate(() => scrollY) === 0);
  await q.goto(ROOT + '#/nonsense'); await q.reload(); await ready(q); ok('016 bad hash safe', !q.errs.length && !!(await q.$('.app-title'))); await q.goto(ROOT.replace(/#.*/, '') + '#/lab/nope'); await q.waitForTimeout(100); ok('016 bad sub safe', !q.errs.length); }

console.log('\nUX-017 complaint list');
{ const p = await fresh(undefined, '#/lab/complaints'); const sc = '#cList'; await p.$eval('#cList tr[data-i="15"]', e => e.scrollIntoView({ block: 'center' })); const top = await p.$eval(sc, e => e.scrollTop); await p.click('#cList tr[data-i="15"]'); ok('017 scroll kept', Math.abs(await p.$eval(sc, e => e.scrollTop) - top) < 2); ok('017 selected', await p.$eval('#cList tr[data-i="15"]', e => e.classList.contains('sel') && e.getAttribute('aria-selected') === 'true')); ok('017 draft for row', await p.$eval('#cDraft', e => e.dataset.id) === '16');
  const b = await p.evaluate(() => { const l = document.querySelector('#cList').getBoundingClientRect(), d = document.querySelector('#cDraft').getBoundingClientRect(); return d.left > l.left && d.top < l.bottom; }); ok('017 draft beside list', b); await p.focus('#cList tr[data-i="3"] button'); await p.keyboard.press('Enter'); ok('017 row by keyboard', await p.$eval('#cDraft', e => e.dataset.id) === '4'); }

console.log('\nUX-018 and UX-019 polish');
{ const p = await fresh(); const home = await p.textContent('#main'); ok('018 home says PNG', home.includes('SVG lub PNG')); ok('home shows the incident memo', await p.$eval('#memo', e => e.textContent.includes('Notatka służbowa') && e.textContent.includes('RYB-261031-L2') && e.getBoundingClientRect().top < innerHeight)); await p.fill('#teamName', 'Śledzie'); ok('019 label visible', await p.isVisible('#lblName')); ok('019 dropdown updates live', (await p.$eval('#teamSel', e => e.selectedOptions[0].textContent)).includes('Śledzie'));
  await p.evaluate(() => go('arch')); await p.waitForSelector('#dsv'); ok('019 export disabled when empty', await p.$eval('#dsv', e => e.disabled) && (await p.textContent('#archHint')).length > 0); await p.click('button[data-p=vision]'); ok('019 export enabled', !(await p.$eval('#dsv', e => e.disabled)));
  const fit = await p.evaluate(() => { const r = []; document.querySelectorAll('#archOut svg rect[rx]').forEach(rc => { const t = rc.nextElementSibling; r.push(t.getBBox().width <= +rc.getAttribute('width') - 4); }); return r.every(Boolean); }); ok('019 labels fit boxes', fit); await p.evaluate(() => { const t = team(); LANES().forEach(l => l[2].forEach(c => t.arch.sel[c[0]] = true)); save(); render(); }); ok('019 all labels fit', await p.evaluate(() => [...document.querySelectorAll('#archOut svg rect[rx]')].every(rc => rc.nextElementSibling.getBBox().width <= +rc.getAttribute('width') - 4)));
  await p.evaluate(() => go('lab', 'rag')); await p.waitForSelector('#qi'); await p.fill('#qi', 'Jaki format ma kod partii?'); await p.keyboard.press('Enter'); await p.click('#langSeg button[data-l=en]'); ok('019 old chat marked PL', (await p.textContent('#chat')).includes('PL')); await p.click('#sv'); ok('019 no alert dialog', p.dlgs.length === 0); ok('019 document lang', await p.evaluate(() => document.documentElement.lang) === 'en'); await nav(p, 'lab'); ok('019 no errors', !p.errs.length, p.errs.join('|')); }

console.log('\nOriginal behaviour and offline');
{ const p = await fresh(); for (const v of ['brief', 'data', 'demos', 'lab', 'arch', 'deliver']) { await nav(p, v); await p.waitForFunction(v => S.view === v, v); } ok('base all views', !p.errs.length, p.errs.join('|')); await p.fill('#teamName', 'X'); await p.reload(); await ready(p); ok('base persistence', await p.evaluate(() => team().name) === 'X' && await p.evaluate(() => S.view) === 'deliver'); ok('base 8 teams', (await p.$$('#teamSel option')).length === 8);
  // legacy saved data from the previous version keeps working
  await p.evaluate(() => localStorage.setItem('rybexws', JSON.stringify({ lang: 'pl', team: 1, view: 'deliver', sub: { demos: 'life', lab: 'vision' }, teams: { 1: { name: 'Stary', checks: { '1.0': true }, notes: { 1: 'n' }, arch: { sel: { cam: 1 }, infra: 'cloud' }, log: [{ ts: '10/31/2026, 4:50 PM', track: 'Wizja', text: 'progi d=3.2' }] } } }))); await p.reload(); await ready(p); ok('base legacy data', (await p.textContent('#logBox')).includes('progi d=3.2') && await p.evaluate(() => team().arch.infra) === 'cloud'); ok('base legacy no errors', !p.errs.length, p.errs.join('|'));
  await p.evaluate(() => localStorage.setItem('rybexws', '{broken')); await p.reload(); await ready(p); ok('base corrupt storage', !!(await p.$('.app-title')));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.route(/jsdelivr|googleapis|gstatic/, r => r.abort()); const o = await ctx.newPage(); o.errs = []; o.on('pageerror', e => o.errs.push(e.message)); await o.goto(ROOT + '#/lab/vision'); await ready(o); ok('base cdn blocked usable', !o.errs.length && !!(await o.$('#vd')), o.errs.join('|')); }

await browser.close();
console.log(`\n${engineName}: ${pass} passed, ${fail} failed`);
if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
