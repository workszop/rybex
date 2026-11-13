// Screenshots for the workshop presentation (assets/presentation/*.webp + manifest.json).
// Usage (from the repo root): node tools/presentation-shots.mjs [base|ai|all] [id...]   (default: base)
//   base = the shots that need no model (served against the mock Worker, they show no model output at all)
//   ai   = the shots that show real model output (added in a later step; they need a class code and cost money)
// Runs write only the shots they take: the manifest is merged by id, so a base run keeps the ai entries.
import { chromium } from '../tests/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'presentation');
const PORT = 8796, BASE = `http://127.0.0.1:${PORT}`, MOCK = `${BASE}/mock`;
const APP = `${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}`;
const VP = { width: 1440, height: 900 };

// In-page helpers, passed as source so that every shot seeds the app through its own globals (S, normTeam, save, render ...).
// team(over, quizzes): replaces slot 1 with a normalised team, marks the given demo quizzes as answered, persists and re-renders.
const seedTeam = (p, over, quizzes = []) => p.evaluate(([o, q]) => {
  S.lang = 'pl'; S.team = 1;
  const t = normTeam({ name: 'Zespół Szprot', onboardedAt: '2026-11-13T08:00:00.000Z', ...o });
  q.forEach(k => { t.quizzes[k] = { answers: Object.fromEntries(QUIZZES()[k].map(x => [x.id, x.answer])), first: {}, doneAt: 'x' }; });
  S.teams[1] = t; save(); render();
}, [over, quizzes]);
const settle = p => p.waitForTimeout(500);
const lab = (p, key) => p.evaluate(k => { go('lab', k); }, key);

const GOAL = {
  complaints: 'Poprawnie rozpoznać kategorię co najmniej 8 na 10 reklamacji, w tym wszystkie sprawy o bezpieczeństwie.',
  forecast: 'Błąd prognozy popytu niższy niż średnia historyczna.',
  rag: 'Odpowiedzi asystenta zawsze ze wskazaniem dokumentu, a pytania spoza dokumentów odrzucane.',
  maint: 'Ostrzec przed awarią zamykarki, zanim linia stanie, przy niewielu fałszywych alarmach.',
  vision: 'Wykryć wadliwe puszki bez fałszywych alarmów na linii.',
};

// Saves the baseline in the open lab, picks the first method and writes a justification (the test-set gate).
const baselineAndGate = async (p, runSel = '#runBase') => {
  await p.click(runSel); await p.click('#saveBase');
  await p.evaluate(() => document.querySelectorAll('#labMethod details').forEach(d => { d.open = true; }));
  await p.locator('input[name=meth]').first().check();
  await p.fill('#methWhy', 'Reguły są tanie i wyjaśnialne, a danych jest niewiele.');
};

// id, hash, seed, el (null = the whole 1440x900 viewport at 2x), alt (Polish, describes what the picture shows)
const SHOTS = [
  { id: 'site-home', hash: '#/rybex/home', ai: false, el: null,
    seed: p => seedTeam(p, { site: { newsRead: false } }),
    alt: 'Strona główna fikcyjnej firmy Rybex, producenta konserw rybnych, w ramce przeglądarki.' },
  { id: 'site-news', hash: '#/rybex/news', ai: false, el: null,
    seed: p => seedTeam(p, {}),
    alt: 'Strona firmy Rybex z aktualnością o partii konserw zwróconej przez sieć handlową.' },
  { id: 'start', hash: '#/home', ai: false, el: null,
    seed: p => seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true } }, ['life']),
    alt: 'Strona startowa aplikacji Rybex: przycisk następnego kroku, plan warsztatu i karty z opisem projektu.' },
  { id: 'path-bar', hash: '#/home', ai: false, el: '#pathBar',
    seed: p => seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true } }, ['life']),
    alt: 'Pasek ścieżki z napisem o aktualnym kroku, podpowiedzią na następny i przyciskiem „Dalej”.' },
  { id: 'cycle', hash: '#/demos/life', ai: false, el: null,
    seed: p => seedTeam(p, { site: { newsRead: true } }),
    alt: 'Demonstracja cyklu projektu AI: etapy od problemu biznesowego do wdrożenia i monitoringu.' },
  { id: 'brief-memo', hash: '#/brief', ai: false, el: '#memo',
    seed: p => seedTeam(p, { track: 'complaints', site: { newsRead: true } }, ['life']),
    alt: 'Notatka służbowa o zwróconej partii konserw: nadawca, adresat, data, temat i opis sprawy.' },
  { id: 'data', hash: '#/data', ai: false, el: null,
    seed: async p => { await seedTeam(p, { track: 'maint', goal: GOAL.maint, site: { newsRead: true } }, ['life']); await p.evaluate(() => { FSEL = TRACK_FILE.maint; render(); }); },
    alt: 'Strona danych zadania „Awarie maszyn”: lista plików i karta danych z odczytami czujników.' },
  { id: 'demos', hash: '#/demos/metr', ai: false, el: null,
    seed: p => seedTeam(p, { track: 'forecast', goal: GOAL.forecast, site: { newsRead: true } }, ['life', 'split']),
    alt: 'Demonstracja miar jakości modelu z suwakiem progu i macierzą pomyłek.' },
  { id: 'baseline', hash: '#/lab/rag', ai: false, el: null,
    seed: async p => { await seedTeam(p, { track: 'rag', goal: GOAL.rag, site: { newsRead: true }, seen: { data: true } }, ['life', 'split', 'metr', 'tok', 'rag']);
      await p.click('#runBase'); await settle(p); await p.evaluate(() => document.querySelector('#baseOut').scrollIntoView({ block: 'start' })); },
    alt: 'Laboratorium asystenta wiedzy firmowej: wynik metody odniesienia (wyszukiwanie słów kluczowych) z dwiema głównymi liczbami.' },
  { id: 'test-reveal', hash: '#/lab/complaints', ai: false, el: null,
    seed: async p => { await seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true }, seen: { data: true } }, ['life', 'split', 'metr', 'tok']);
      await baselineAndGate(p); await p.click('#rv'); await settle(p); await p.evaluate(() => { document.querySelector('#rv').closest('.card').scrollIntoView({ block: 'start' }); scrollBy(0, -150); }); },
    alt: 'Laboratorium analizy reklamacji po odsłonięciu zbioru testowego: zapisana metoda odniesienia i uzasadnienie wyboru metody.' },
  { id: 'risk', hash: '#/demos/risk', ai: false, el: null,
    seed: async p => { await seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true }, seen: { data: true } }, ['life', 'split', 'metr', 'tok']);
      for (const id of ['privacy', 'hallucination']) await p.click(`#riskDemo [data-r="${id}"] [data-o="0"]`);
      await p.evaluate(() => document.querySelector('#riskDemo [data-r="privacy"]').scrollIntoView({ block: 'start' })); },
    alt: 'Karty ryzyk projektu AI (dane osobowe, halucynacje) z wybraną odpowiedzią i widocznym uzasadnieniem.' },
  { id: 'golive', hash: '#/arch', ai: false, el: '#goLive',
    seed: async p => { await seedTeam(p, { track: 'maint', goal: GOAL.maint, site: { newsRead: true } }, ['life']);
      await p.click('#goLive [data-d=stopAuthority] [data-o=operator]'); await p.click('#goLive [data-d=monitor] [data-o=falseAlarms]');
      await p.click('#goLive [data-d=runWhere] [data-o=local]'); await p.click('#goLive [data-d=reviewEvery] [data-o=quarterly]'); },
    alt: 'Cztery decyzje przed uruchomieniem na linii dla zadania „Awarie maszyn”, wszystkie z odpowiedzią i widoczną konsekwencją.' },
  { id: 'arch', hash: '#/arch', ai: false, el: '#archOut',
    seed: p => seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true }, arch: { sel: Object.fromEntries(['mail', 'clean', 'split', 'anon', 'llm', 'hitl', 'dash', 'mon'].map(k => [k, true])), infra: 'hybrid' } }, ['life']),
    alt: 'Schemat blokowy architektury rozwiązania złożony z wybranych komponentów.' },
  { id: 'report-gaps', hash: '#/deliver', ai: false, el: '#delivGaps',
    seed: p => seedTeam(p, { name: '', track: 'complaints', goal: GOAL.complaints, site: { newsRead: true } }, ['life']),
    alt: 'Lista braków, które pokazałby raport: nazwa zespołu, metoda, diagram i nieodhaczone pozycje, każda z odnośnikiem.' },
  { id: 'badges', hash: '#/deliver', ai: false, el: '#badgeList',
    seed: async p => { await seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true }, seen: { data: true } }, ['life', 'split', 'metr', 'tok']);
      await lab(p, 'complaints'); await settle(p); await baselineAndGate(p); await p.click('#rv'); await settle(p);
      await p.evaluate(() => go('deliver')); await settle(p); },
    alt: 'Dziewięć odznak projektu: zdobyte i brakujące, z opisem, co jeszcze trzeba zrobić.' },
  { id: 'example', hash: '#/home', ai: false, el: null,
    seed: async p => { await seedTeam(p, { name: 'Moja praca', track: 'vision', site: { newsRead: true } }); await p.click('#showExample'); await settle(p); },
    alt: 'Podgląd przykładowego, nieidealnego projektu prognozy popytu z baneru „To podgląd” i raportem.' },
  { id: 'team-file', hash: '#/home', ai: false, el: '#teamBar',
    seed: p => seedTeam(p, { track: 'complaints', goal: GOAL.complaints, site: { newsRead: true } }, ['life']),
    alt: 'Pasek zespołu z nazwą „Zespół Szprot”, postępem i przyciskami pobierania i wczytywania pliku zespołu.' },
];

const args = process.argv.slice(2);
const mode = ['base', 'ai', 'all'].includes(args[0]) ? args.shift() : 'base';
const ids = args;
const todo = SHOTS.filter(s => (mode === 'all' || (mode === 'ai') === s.ai) && (!ids.length || ids.includes(s.id)));
const unknown = ids.filter(i => !SHOTS.some(s => s.id === i));
if (unknown.length) { console.error('Unknown shot id(s): ' + unknown.join(', ')); process.exit(1); }
if (!todo.length) { console.log(`No shots to take in mode "${mode}".`); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('node', [path.join(ROOT, 'tests', 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const manifestPath = path.join(OUT, 'manifest.json');
const taken = [];
try {
  await new Promise((res, rej) => { srv.once('error', rej); srv.once('exit', c => rej(new Error('mock server exited ' + c))); srv.stdout.once('data', res); });
  browser = await chromium.launch();
  // PNG -> WebP inside the browser (no image converter is installed).
  const conv = await (await browser.newContext()).newPage();
  const toWebp = async png => conv.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0);
    const url = cv.toDataURL('image/webp', .85);
    if (!url.startsWith('data:image/webp')) throw new Error('WebP encoding is not available in this browser');
    return { b64: url.split(',')[1], w: bmp.width, h: bmp.height };
  }, png.toString('base64'));

  for (const s of todo) {
    const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
    try {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(APP + s.hash);
      await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 10000 });
      await p.waitForLoadState('networkidle');
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await s.seed(p);
      await settle(p);
      await p.evaluate(() => { const t = document.querySelector('#toast'); if (t) { t.hidden = true; t.textContent = ''; } });
      const t = await p.$eval('#toast', e => e.hidden ? '' : e.textContent);
      if (errs.length) throw new Error('page errors: ' + errs.join(' | '));
      if (t) throw new Error('toast still visible: ' + t);
      if (s.el) await p.addStyleTag({ content: '.edu-header,.pathbar,.casebar,.teambar,.subnav,.tabs,[class*=sticky]{position:static!important}' });
      const png = s.el ? await p.locator(s.el).screenshot() : await p.screenshot();
      const { b64, w, h } = await toWebp(png);
      const file = s.id + '.webp';
      fs.writeFileSync(path.join(OUT, file), Buffer.from(b64, 'base64'));
      taken.push({ id: s.id, file, w, h, ai: s.ai, full: s.el === null, alt: s.alt });
      console.log(`ok ${s.id} ${w}x${h} ${(fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0)} kB`);
    } finally { await ctx.close(); }
  }

  // Merge by id into the manifest, keeping entries (such as the ai shots) this run did not take.
  let old = { shots: [] };
  try { old = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
  const byId = new Map((old.shots || []).map(x => [x.id, x]));
  taken.forEach(x => byId.set(x.id, x));
  const order = SHOTS.map(x => x.id);
  const shots = [...byId.values()].sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
  const commit = execFileSync('git', ['log', '-1', '--format=%h', '--', 'rybex-ai-workshop.html'], { cwd: ROOT, encoding: 'utf8' }).trim();
  fs.writeFileSync(manifestPath, JSON.stringify({ commit, shots }, null, 1) + '\n');
  console.log(`manifest: ${shots.length} shots, app commit ${commit}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  srv.kill();
}
