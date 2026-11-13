// Records replay.json: real Polish answers from both models for the default runs, used when the Worker is unreachable.
// Rerun whenever prompts, photos or default settings change (replay matches exact request bodies).
// Usage (from the repo root, costs about $0.04 of team 8's daily budget; repeated requests come free from the Worker cache):
//   CC='class-code' node tools/record-replay.mjs
// Options (environment, both optional):
//   AI=<url>   Worker URL passed to the app as ?ai= (the app accepts only localhost); default: the app's real Worker.
//   OUT=<path> where to write the recording; default: replay.json in the repo root.
// Dry run against the mock Worker (no real calls, nothing spent; keep the repo's replay.json untouched):
//   CC=test-code AI=http://127.0.0.1:8800/mock OUT=/tmp/replay-mock.json node tools/record-replay.mjs
import { chromium } from '../tests/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.CC) { console.error('Set the class code: CC=... node tools/record-replay.mjs'); process.exit(1); }
const PORT = 8800;
const Q = process.env.AI ? '?ai=' + encodeURIComponent(process.env.AI) : '';
const OUT = path.resolve(process.env.OUT || path.join(ROOT, 'replay.json'));
const srv = spawn('node', [path.join(ROOT, 'tests', 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const b = await chromium.launch().catch(e => { srv.kill(); throw e; }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); const toasts = [];
try {
  await p.goto(`http://127.0.0.1:${PORT}/rybex-ai-workshop.html${Q}#/lab/rag`);
  await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
  await p.evaluate(() => { S.team = 8; S.lang = 'pl'; save(); render(); });
  // The AI bar exists only in a lab's model view: switch the knowledge assistant to the model with its own control first.
  // The runs below set each lab's model method in its state before rendering, so the bar is there for them too.
  await p.click('#ragGen button[data-g=llm]'); await p.waitForSelector('#aiBar');
  await p.fill('#aiCode', process.env.CC); await p.click('#aiConnect');
  await p.waitForFunction(() => document.querySelector('#aiBar').dataset.aiState === 'ready', null, { timeout: 20000 });
  const run = async (sel, what) => {
    await p.click(sel); await p.waitForTimeout(300); await p.waitForFunction(() => !AIS.run, null, { timeout: 600000 });
    const t = await p.$eval('#toast', e => e.hidden ? '' : e.textContent); if (t && !/Zapisano|Saved/.test(t)) toasts.push(what + ': ' + t);
    console.log('done', what, 'recorded', await p.evaluate(() => AIS.rec.size), 'calls', await p.evaluate(() => AIS.calls));
  };
  const lab = async k => { await p.evaluate(k => go('lab', k), k); await p.waitForTimeout(300); };
  // Photos load on the first visit to the vision lab; start that now so the vision runs below find them ready.
  await p.evaluate(() => visInit());
  await p.waitForFunction(() => document.body.dataset.visionStatus === 'ready', null, { timeout: 60000 });
  for (const model of ['deepseek', 'haiku']) {
    await lab('rag'); await p.selectOption('#aiModel', model);
    await p.evaluate(() => { const L = lab().rag; L.gen = 'llm'; L.judge = true; L.revealed = false; save(); render(); });
    await run('#ragRun', model + ' rag dev');
    await p.evaluate(() => { lab().rag.revealed = true; save(); render(); }); await run('#ragRun', model + ' rag test');
    await p.evaluate(() => { lab().rag.revealed = false; save(); });
    await lab('complaints');
    await p.evaluate(() => { const L = lab().compl; L.method = 'llm'; L.shots = 0; L.revealed = false; L.active = 'v1'; L.draft = null; save(); render(); });
    await run('#cRun', model + ' compl dev');
    await run('#cCurve', model + ' compl curve');
    if (model === 'deepseek') await run('#cCmp', 'compl compare');
    await p.evaluate(() => { lab().compl.revealed = true; save(); render(); }); await run('#cRun', model + ' compl test');
    await p.evaluate(() => { lab().compl.revealed = false; save(); });
    await lab('vision');
    for (const s of [0, 4, 8]) { await p.evaluate(s => { const L = lab().vision; L.method = 'llm'; L.vshots = s; L.revealed = false; save(); render(); }, s); await run('#visRun', `${model} vision val ${s}`); }
    await p.evaluate(() => { const L = lab().vision; L.vshots = 0; L.revealed = true; save(); render(); }); await run('#visRun', model + ' vision test');
    await p.evaluate(() => { lab().vision.revealed = false; save(); });
  }
  const json = await p.evaluate(() => aiRecordedJSON());
  fs.writeFileSync(OUT, json);
  console.log(JSON.stringify({ entries: Object.keys(JSON.parse(json)).length, bytes: json.length, cost: await p.evaluate(() => AIS.cost), teamSpend: await p.evaluate(() => AIS.teamSpend), toasts, errs }));
} finally { await b.close(); srv.kill(); }
