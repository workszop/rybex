// Focused probes for the optional photographic vision asset manifest.
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

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const manifest = {
  version: 1,
  images: [
    { id: 'train_003', split: 'train', type: 'ok', file: 'train_003.png' },
    { id: 'val_002', split: 'val', type: 'ok', file: 'val_002.png' },
    { id: 'test_001', split: 'test', type: 'ok', file: 'test_001.png' },
    // Deliberately wrong: train_001 is code in the immutable original inventory.
    { id: 'train_001', split: 'train', type: 'ok', file: 'train_001.png' },
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
  await page.route('**/assets/vision-realistic/web/manifest.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(manifest),
  }));
  await page.route('**/assets/vision-realistic/web/*.png', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: PNG_1X1,
  }));
  await page.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}#/data`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 8000 });
  await page.click('button[data-f="can_images/ (210)"]');
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
    big: visBig(VIS.train[2]),
    payload: JSON.stringify(visMessages(0, VIS.val[1])),
    selected: visSel({ vsel: 'old', mruns: [{ id: 'old', datasetKey: 'synthetic-baseline-v1' }] }),
    statusText: document.querySelector('#visionAssetStatus')?.textContent || '',
  }));
  const shortState = { ...state, first: { ...state.first, url: state.first.url.slice(0, 24) }, second: { ...state.second, url: state.second.url.slice(0, 24) }, big: state.big.slice(0, 24), payload: state.payload.slice(-120) };
  ok('manifest becomes ready with expected and loaded counts', state.status === 'ready' && state.expected === 210 && state.photos === 3 && state.fallback === 207, JSON.stringify(shortState));
  ok('loaded item uses a data URL and keeps its source URL separately', state.first.id === 'train_003' && state.first.type === 'ok' && state.first.source === 'photo' && state.first.url.startsWith('data:image/png') && /assets\/vision-realistic\/web\/train_003\.png$/.test(state.first.originalUrl), JSON.stringify(state.first));
  ok('manifest label mismatch is rejected without changing immutable truth', state.rejected === 1 && state.mismatch.id === 'train_001' && state.mismatch.type === 'code' && state.mismatch.bad && state.mismatch.source === 'synthetic', JSON.stringify(state.mismatch));
  ok('missing items visibly remain synthetic fallback', state.second.source === 'synthetic' && state.second.type === 'code' && state.second.url.startsWith('data:image/'), JSON.stringify(state.second));
  ok('visBig and model payload contain data URLs, not photo paths', state.big.startsWith('data:image/') && !state.payload.includes('/assets/vision-realistic/') && !state.payload.includes('train_003.png'), state.payload.slice(-200));
    const zip = await page.evaluate(async () => {
      const blob = zipStore([
        { name: 'train/train_001.png', data: dataUrlBytes(VIS.train[0].url) },
        { name: 'val/val_001.png', data: dataUrlBytes(VIS.val[0].url) },
      ]);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { size: bytes.length, signature: Array.from(bytes.slice(0, 4)) };
    });
    ok('ZIP accepts photo and synthetic data URLs', zip.size > 100 && JSON.stringify(zip.signature) === '[80,75,3,4]', JSON.stringify(zip));
  const cache = await page.evaluate(() => {
    const oldKey = VIS.datasetKey;
    const L = lab().vision;
    L.mruns = [{ id: 'old', datasetKey: oldKey }];
    VIS.train[2].photoHash = 'repaired-content';
    finishVisionAssets();
    return { oldKey, newKey: VIS.datasetKey, kept: L.mruns.some(run => run.id === 'old'), hashes: VIS.photoHashes };
  });
  ok('content change on same photo ID invalidates cached runs', cache.oldKey !== cache.newKey && !cache.kept && cache.hashes.some(hash => hash.includes('repaired-content')), JSON.stringify(cache));
  ok('synthetic run cache cannot be selected for photographic data', state.selected === null, JSON.stringify(state.selected));
  ok('status disclosure reports photographic and fallback counts', /3/.test(state.statusText) && /210/.test(state.statusText) && /synthetic|syntetycz/i.test(state.statusText), state.statusText);
  ok('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (!srv.killed) srv.kill('SIGTERM');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
