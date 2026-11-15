import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve('rybex-ai-workshop.html')).href + '#/lab/vision');
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
} finally { await browser.close(); }
