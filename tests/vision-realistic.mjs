// Focused probes for the optional photographic vision asset manifest and the drawn-can fallback of the vision lab.
// Usage: node tests/vision-realistic.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK = `${BASE}/mock`;
const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
const waitForServer = new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => finish(new Error('mock server startup timeout')), 5000);
  const cleanup = () => {
    clearTimeout(timer);
    srv.stdout.off('data', onReady);
    srv.off('error', onError);
    srv.off('exit', onExit);
  };
  const finish = error => {
    if (settled) return;
    settled = true;
    cleanup();
    error ? reject(error) : resolve();
  };
  const onReady = () => finish();
  const onError = error => finish(error);
  const onExit = (code, signal) => finish(new Error(`mock server exited before ready (${code ?? signal})`));
  srv.stdout.once('data', onReady);
  srv.once('error', onError);
  srv.once('exit', onExit);
});

const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);
const manifest = {
  version: 1,
  images: [
    { id: 'train_003', split: 'train', type: 'ok', file: 'train_003.jpg' },
    { id: 'val_002', split: 'val', type: 'ok', file: 'val_002.jpg' },
    { id: 'test_001', split: 'test', type: 'ok', file: 'test_001.jpg' },
    // Deliberately wrong: train_001 is code in the immutable original inventory.
    { id: 'train_001', split: 'train', type: 'ok', file: 'train_001.jpg' },
  ],
};

let pass = 0;
let fail = 0;
const ok = (id, condition, detail = '') => {
  if (condition) {
    pass++;
    console.log('  PASS', id);
  } else {
    fail++;
    console.log('  FAIL', id, detail);
  }
};

let browser;
let context;
let page;
const errors = [];
try {
  await waitForServer;
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/vision-generated/web/manifest.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(manifest),
  }));
  await page.route('**/assets/vision-generated/web/*.jpg', route => route.fulfill({
    status: 200,
    contentType: 'image/jpeg',
    body: JPEG_1X1,
  }));
  await page.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}#/data`, { waitUntil: 'domcontentloaded' });
  const idle = await page.evaluate(() => ({ status: document.body.dataset.visionStatus, initialized: VIS.initialized }));
  await page.click('button[data-f="can_images/ (210)"]');
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 8000 });
  const state = await page.evaluate(() => ({
    status: document.body.dataset.visionStatus,
    expected: +document.body.dataset.visionExpected,
    photos: +document.body.dataset.visionPhotos,
    fallback: +document.body.dataset.visionFallback,
    dataset: document.body.dataset.visionDataset,
    error: VIS.error,
    manifestVersion: VIS.manifestVersion,
    rejected: VIS.manifestRejected,
    first: { id: VIS.train[2].id, type: VIS.train[2].type, source: VIS.train[2].source, url: VIS.train[2].url, originalUrl: VIS.train[2].originalUrl },
    mismatch: { id: VIS.train[0].id, type: VIS.train[0].type, bad: VIS.train[0].bad, source: VIS.train[0].source },
    second: { id: VIS.train[1].id, type: VIS.train[1].type, source: VIS.train[1].source, url: VIS.train[1].url },
    source: VIS.featureSource,
    gone: ['visBig', 'visMessages', 'visSel', 'visRunLLM'].filter(n => { try { return typeof (0, eval)(n) !== 'undefined'; } catch (e) { return false; } }),
    statusText: document.querySelector('#visionAssetStatus')?.textContent || '',
  }));
  const shortState = { ...state, first: { ...state.first, url: state.first.url.slice(0, 24) }, second: { ...state.second, url: state.second.url.slice(0, 24) } };
  ok('photos are not loaded until the image folder is opened', idle.status === 'idle' && idle.initialized === false, JSON.stringify(idle));
  ok('manifest becomes ready with expected and loaded counts', state.status === 'ready' && state.expected === 210 && state.photos === 3 && state.fallback === 207, JSON.stringify(shortState));
  ok('loaded item uses a data URL and keeps its source URL separately', state.first.id === 'train_003' && state.first.type === 'ok' && state.first.source === 'photo' && state.first.url.startsWith('data:image/jpeg') && /assets\/vision-generated\/web\/train_003\.jpg$/.test(state.first.originalUrl), JSON.stringify(state.first));
  ok('manifest label mismatch is rejected without changing immutable truth', state.rejected === 1 && state.mismatch.id === 'train_001' && state.mismatch.type === 'code' && state.mismatch.bad && state.mismatch.source === 'synthetic', JSON.stringify(state.mismatch));
  ok('missing items visibly remain synthetic fallback', state.second.source === 'synthetic' && state.second.type === 'code' && state.second.url.startsWith('data:image/'), JSON.stringify(state.second));
  ok('no model payload any more: the language-model helpers are gone and a partly loaded set is not a photo set', state.gone.length === 0 && state.source !== 'photo', JSON.stringify([state.gone, state.source]));
    const zip = await page.evaluate(async () => {
      const blob = zipStore([
        { name: 'train/train_001.jpg', data: dataUrlBytes(VIS.train[0].url) },
        { name: 'val/val_001.jpg', data: dataUrlBytes(VIS.val[0].url) },
      ]);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { size: bytes.length, signature: Array.from(bytes.slice(0, 4)) };
    });
    ok('ZIP accepts photo and synthetic data URLs', zip.size > 100 && JSON.stringify(zip.signature) === '[80,75,3,4]', JSON.stringify(zip));
  // The lab on this mostly drawn set (3 photos, 207 drawn cans): it mounts, trains and shows a result. The numbers are not specified for drawn cans.
  await page.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}&rooms=0#/lab/vision`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 30000 });
  await page.waitForFunction(() => { const x = document.querySelector('#visTrain'); return x && !x.disabled; }, null, { timeout: 60000 });
  const mounted = await page.evaluate(() => ({ steps: [...document.querySelectorAll('#proto [data-lab-step]')].map(e => e.dataset.labStep).join(), status: !!document.querySelector('#visionAssetStatus'), bar: !!document.querySelector('#aiBar'), old: !!document.querySelector('#visRun, #vPrompt, #visShots'), trained: document.querySelector('#visRes').dataset.trained, photos: +document.body.dataset.visionPhotos, source: VIS.featureSource, feats: [...VIS.train, ...VIS.val, ...VIS.test].every(i => i.vf && i.vf.b.length === 80 && i.vf.e.length === 80) }));
  ok('with photos missing the lab still mounts: three steps, no AI bar, #visTrain enabled', mounted.steps === 'build,experiment,result' && mounted.status && !mounted.bar && !mounted.old && mounted.trained === 'false' && mounted.photos === 3 && mounted.source !== 'photo', JSON.stringify(mounted));
  ok('drawn cans get their grid numbers too', mounted.feats, JSON.stringify(mounted));
  await page.click('#visTrain');
  await page.waitForFunction(() => document.querySelector('#visRes').dataset.trained === 'true' && !X.visBusy, null, { timeout: 60000 });
  const trained = await page.evaluate(() => ({ ...document.querySelector('#visRes').dataset, points: document.querySelector('#visCurveBox').dataset.points, thumbs: document.querySelectorAll('#visGal .thumb').length, maps: document.querySelectorAll('#visLearnedBox .vis-heat figure').length, fit: lab().vision.fit,
    challenge: [...document.querySelectorAll('.challenge')].map(e => e.dataset.state).join() }));
  ok('training on drawn cans completes: a result on the practice set, the curve, the maps and the gallery', trained.set === 'val' && trained.total === '18' && Number.isFinite(+trained.found) && Number.isFinite(+trained.fp) && trained.points === '100' && trained.thumbs === 60 && trained.maps === 3 && trained.fit === '30|100|1|1', JSON.stringify(trained));
  ok('the challenge is not available without the photographs (state "na")', trained.challenge === 'na', trained.challenge);
  const cache = await page.evaluate(() => {
    const oldKey = VIS.datasetKey, had = !!visModel();
    VIS.train[2].photoHash = 'repaired-content';
    finishVisionAssets();
    return { oldKey, newKey: VIS.datasetKey, had, kept: !!visModel(), cached: !!(X.visModel && X.visModel.sig.endsWith('@' + VIS.datasetKey)), hashes: VIS.photoHashes };
  });
  ok('content change on same photo ID drops the model trained on the old set', cache.oldKey !== cache.newKey && cache.had && !cache.kept && !cache.cached && cache.hashes.some(hash => hash.includes('repaired-content')), JSON.stringify(cache));
  await page.evaluate(() => X.labRedraw());
  await page.waitForFunction(() => document.querySelector('#visRes').dataset.trained === 'true' && !X.visBusy && X.visModel && X.visModel.sig.endsWith('@' + VIS.datasetKey), null, { timeout: 60000 });
  ok('the model is trained again, silently, for the changed set', await page.evaluate(() => !!visModel() && document.querySelectorAll('#visGal .thumb').length === 60));
  ok('status disclosure reports photographic and fallback counts', /3/.test(state.statusText) && /210/.test(state.statusText) && /synthetic|syntetycz/i.test(state.statusText), state.statusText);
  ok('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (!srv.killed) srv.kill('SIGTERM');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
