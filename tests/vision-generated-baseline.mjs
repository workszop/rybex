// VISION-REBUILD: the whole file checks the vision lab as the language-model lab (#vPrompt, #visRun, visExamples); to be rewritten for the model trained in the browser.
// The generated can photographs the vision lab sends to the model, opened straight from disk.
// The pixel-rules engine and the "visual inspection" baseline this file used to score were removed with the guided labs;
// what is left to check here is the photo set itself. Usage (from the repo root): node tests/vision-generated-baseline.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve('rybex-ai-workshop.html')).href + '?rooms=0#/lab/vision', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof visInit === 'function' && typeof team === 'function');
  await page.evaluate(() => visInit()); // the photos load on first use, not when the lab opens
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 90000 });
  const result = await page.evaluate(() => { const count = set => Object.fromEntries(['ok', 'dent', 'label', 'code'].map(t => [t, set.filter(i => i.type === t).length]));
    const gone = ['visEval', 'visTh', 'visThFromSens', 'visPred', 'visHumanEval', 'baseRun', 'baseVerdict'].filter(n => { try { return typeof (0, eval)(n) !== 'undefined'; } catch (e) { return false; } });
    return { photoCount: VIS.photoCount, source: VIS.featureSource, train: count(VIS.train), val: count(VIS.val), test: count(VIS.test), gone,
      urls: [...VIS.train, ...VIS.val, ...VIS.test].every(i => /^data:image\//.test(i.url)), flags: [...VIS.val, ...VIS.test].every(i => i.bad === (i.type !== 'ok')),
      examples: visExamples(8).map(x => x.type).sort().join(), lab: { prompt: !!document.querySelector('#vPrompt'), run: !!document.querySelector('#visRun'), rules: !!document.querySelector('#visMethod, #vd, #runBase') } }; });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.photoCount, 210);
  assert.equal(result.source, 'photo', 'the photographs did not load from the bundle');
  const total = s => Object.values(s).reduce((a, b) => a + b, 0);
  assert.deepEqual([total(result.train), total(result.val), total(result.test)], [90, 60, 60], 'split sizes changed');
  for (const part of ['train', 'val', 'test']) assert(Object.values(result[part]).every(n => n >= 2), `${part} lacks a class`);
  assert(result.val.ok > result.val.dent + result.val.label + result.val.code, 'good cans are not the majority of the practice set');
  assert(result.urls && result.flags, 'photo URLs or defect flags are inconsistent');
  assert.equal(result.examples, 'code,code,dent,dent,label,label,ok,ok', 'the labelled examples are not two per class');
  assert.deepEqual(result.gone, [], 'the pixel-rules engine or the baseline is back');
  assert.deepEqual(result.lab, { prompt: true, run: true, rules: false }, 'the vision lab is not the language-model lab');
} finally { await browser.close(); }
