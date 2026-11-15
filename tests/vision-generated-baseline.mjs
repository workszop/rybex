import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve('rybex-ai-workshop.html')).href + '#/lab/vision', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof visInit === 'function' && typeof team === 'function');
  await page.evaluate(() => visInit()); // the photos load on first use, not when the lab opens
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 90000 });
  const result = await page.evaluate(() => ({
    photoCount: VIS.photoCount, baseline: visHumanEval(VIS.val),
    scores: [20, 35, 50, 65, 80].map(s => ({ sensitivity: s, ...visEval(VIS.val, visThFromSens(s)) }))
  }));
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.photoCount, 210);
  assert(result.baseline.fp < 42 && result.baseline.tn > 0, 'baseline rejects every good tin');
  assert(result.baseline.tp > 0, 'baseline detects no defects');
  assert(new Set(result.scores.map(s => `${s.tp},${s.fp}`)).size >= 3, 'sensitivity does not meaningfully change results');

  // Beating the baseline: more defects found never counts when it is bought with more false alarms than the baseline.
  const guard = await page.evaluate(() => {
    const hb = visHumanEval(VIS.val), s = m => ({ r: f0(m.r), f1: f0(m.f1), tp: m.tp, fp: m.fp, fn: m.fn, tn: m.tn });
    const base = baseRun('vision'), be = { track: 'vision', base: true, cfg: base.cfg, res: { ...base.res, primary: base.primary } };
    const run = sens => { const m = visEval(VIS.val, visThFromSens(sens)); return { track: 'vision', cfg: { sens, fk: VIS.featureSource }, res: { val: s(m), test: null, primary: { v: f0(m.r), base: f0(hb.r), baseFp: Math.round(hb.fp), hi: true, test: false } } } };
    const verdict = list => { const t = { ...team(), track: 'vision', log: [be, ...list.map(run)] }, v = baseVerdict(t, 'vision'); return { beaten: v.beaten, sens: v.b.entry.cfg.sens, badge: earnedBadges(t).includes('beatBase') } };
    const fair = [...Array(101).keys()].filter(x => { const m = visEval(VIS.val, visThFromSens(x)); return m.fp <= hb.fp && m.tp > hb.tp });
    return { flagAll: verdict([100]), fair, mixed: fair.length ? verdict([100, fair[0]]) : null, word: partVerdict('vision', run(100), 'dev').line };
  });
  console.log(JSON.stringify(guard, null, 2));
  assert.equal(guard.flagAll.beaten, false, 'flagging every tin beats the baseline');
  assert.equal(guard.flagAll.badge, false, 'flagging every tin earns the badge');
  assert(guard.fair.length > 0, 'no sensitivity beats the baseline without extra false alarms');
  assert.deepEqual(guard.mixed, { beaten: true, sens: guard.fair[0], badge: true }, 'a fair run does not outrank the flag-everything run');
  assert(/fałszywe alarmy 42/.test(guard.word) && /nie pobił/.test(guard.word), 'the verdict line does not name the false alarms');
} finally { await browser.close(); }
