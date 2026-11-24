// The model the vision lab trains in the browser, measured on the generated can photographs (served over http by the mock server).
// The pixel-rules baseline and the language-model lab this file used to check are gone; the baseline is now the trained model with the default settings.
// Usage: node tests/vision-generated-baseline.mjs [port=8795]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.argv[2] || 8795);
const BASE = `http://127.0.0.1:${PORT}`;
const TIMEOUT = +(process.env.PW_TIMEOUT || 60000);
// Settings -> [defects found of 18, false alarms] on the practice set. Deterministic for one image decoder.
const DEFAULT = { n: 30, rounds: 100, bright: 1, detail: 1, thr: 50, want: [16, 15] };
const TABLE = [
  { name: '90 photos, 100 rounds', n: 90, rounds: 100, bright: 1, detail: 1, thr: 50, want: [17, 5] },
  { name: '90 photos, 300 rounds', n: 90, rounds: 300, bright: 1, detail: 1, thr: 50, want: [17, 3] },
  { name: '90 photos, 300 rounds, brightness only', n: 90, rounds: 300, bright: 1, detail: 0, thr: 50, want: [12, 2] },
  { name: '90 photos, 300 rounds, threshold 70%', n: 90, rounds: 300, bright: 1, detail: 1, thr: 70, want: [17, 1] },
];

let pass = 0, fail = 0;
const ok = (id, condition, detail = '') => { if (condition) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mock server startup timeout')), 5000);
    srv.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    srv.once('error', e => { clearTimeout(timer); reject(e); });
    srv.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`mock server exited before ready (${code ?? signal}); is port ${PORT} taken?`)); });
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], worker = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().startsWith(BASE + '/mock/')) worker.push(r.url()); });
  await page.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(BASE + '/mock')}&rooms=0#/lab/vision`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: TIMEOUT });
  const trainable = () => page.waitForFunction(() => { const x = document.querySelector('#visTrain'); return x && !x.disabled; }, null, { timeout: TIMEOUT });
  await trainable();
  const set = await page.evaluate(() => ({ photos: +document.body.dataset.visionPhotos, expected: +document.body.dataset.visionExpected, source: VIS.featureSource, sizes: [VIS.train, VIS.val, VIS.test].map(s => s.length).join(), bad: VIS.val.filter(i => i.bad).length }));
  ok('the 210 photographs are loaded (90 / 60 / 60), 18 defective cans in the practice set', set.photos === 210 && set.expected === 210 && set.source === 'photo' && set.sizes === '90,60,60' && set.bad === 18, JSON.stringify(set));

  // Sets the lab the way a team does (the buttons and the slider), trains and reads the result off #visRes.
  const measure = async c => {
    await page.click(`#visN button[data-n="${c.n}"]`);
    await page.click(`#visRounds button[data-r="${c.rounds}"]`);
    for (const k of ['bright', 'detail']) { // switch on first, so that one input always stays on
      const sel = `#visLook button[data-k="${k}"]`;
      if (c[k] && await page.getAttribute(sel, 'aria-pressed') !== 'true') await page.click(sel);
    }
    for (const k of ['bright', 'detail']) {
      const sel = `#visLook button[data-k="${k}"]`;
      if (!c[k] && await page.getAttribute(sel, 'aria-pressed') === 'true') await page.click(sel);
    }
    await page.$eval('#visThr', (e, v) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, c.thr);
    await trainable();
    await page.click('#visTrain');
    await page.waitForFunction(sig => { const r = document.querySelector('#visRes'); return r.dataset.trained === 'true' && !X.visBusy && lab().vision.fit === sig; }, [c.n, c.rounds, c.bright, c.detail].join('|'), { timeout: TIMEOUT });
    return page.$eval('#visRes', e => ({ set: e.dataset.set, found: +e.dataset.found, total: +e.dataset.total, fp: +e.dataset.fp, typeok: +e.dataset.typeok, thr: +e.dataset.thr, n: +e.dataset.n, rounds: +e.dataset.rounds, points: +document.querySelector('#visCurveBox').dataset.points }));
  };

  const base = await measure(DEFAULT);
  ok('defaults (30 photos, 100 rounds, brightness + detail, threshold 50%): found 16 of 18, 15 false alarms', base.set === 'val' && base.found === 16 && base.total === 18 && base.fp === 15 && base.points === 100, JSON.stringify(base));

  const rows = [{ setting: 'defaults: 30 photos, 100 rounds', found: `${base.found} / ${base.total}`, 'false alarms': base.fp, 'type right (of 60)': base.typeok, expected: DEFAULT.want.join(' / ') }];
  const got = {};
  for (const c of TABLE) {
    const r = await measure(c); got[c.name] = r;
    ok(`${c.name}: found ${c.want[0]}, false alarms ${c.want[1]}`, r.set === 'val' && r.found === c.want[0] && r.fp === c.want[1] && r.n === c.n && r.rounds === c.rounds && Math.round(r.thr * 100) === c.thr && r.points === c.rounds, JSON.stringify(r));
    rows.push({ setting: c.name, found: `${r.found} / ${r.total}`, 'false alarms': r.fp, 'type right (of 60)': r.typeok, expected: c.want.join(' / ') });
  }
  console.table(rows);
  const [n100, n300, bright, thr70] = TABLE.map(c => got[c.name]);
  ok('direction: more photos, more rounds and a higher threshold each cut false alarms; brightness alone finds fewer defects', n100.fp < base.fp && n300.fp < n100.fp && thr70.fp < n300.fp && thr70.found <= n300.found && bright.found < n300.found, JSON.stringify({ base: base.fp, n100: n100.fp, n300: n300.fp, thr70: thr70.fp, bright: bright.found }));
  ok('no request to the Worker, no page errors', worker.length === 0 && errors.length === 0, [...worker, ...errors].join(' | '));
} catch (e) { fail++; console.log('ERROR', e.stack); } finally {
  if (browser) await browser.close();
  if (!srv.killed) srv.kill('SIGTERM');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
