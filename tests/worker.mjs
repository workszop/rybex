// Worker contract checks: runs `wrangler dev` against a local mock of OpenRouter.
// Usage: cd tests && node worker.mjs
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.join(HERE, '..', 'worker');
const UP_PORT = 8799, W_PORT = 8787, W = `http://127.0.0.1:${W_PORT}`;
const CODE = 'test-code';
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

// ─── Mock upstream ───
const seen = [];
const up = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const body = JSON.parse(b || '{}'); seen.push({ body, auth: req.headers.authorization });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'gen-' + seen.length, model: body.model, choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, cost: 0.4 } }));
  });
}).listen(UP_PORT);

// ─── wrangler dev ───
fs.writeFileSync(path.join(WORKER_DIR, '.dev.vars'), `CLASS_CODE=${CODE}\nOPENROUTER_API_KEY=dummy-key\n`);
const persist = fs.mkdtempSync('/tmp/rybex-wr-');
const wr = spawn('npx', ['wrangler', 'dev', '--port', String(W_PORT), '--ip', '127.0.0.1', '--persist-to', persist,
  '--var', `UPSTREAM_URL:http://127.0.0.1:${UP_PORT}/chat`, '--var', 'TEAM_DAILY_USD:0.5', '--var', 'TOTAL_DAILY_USD:100'],
  { cwd: WORKER_DIR, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let log = ''; wr.stdout.on('data', d => log += d); wr.stderr.on('data', d => log += d);
const stop = code => { try { process.kill(-wr.pid, 'SIGTERM'); } catch (e) { } up.close(); fs.rmSync(path.join(WORKER_DIR, '.dev.vars'), { force: true }); process.exit(code); };

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(W + '/status'); if (r.status) return; } catch (e) { }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(log); throw new Error('wrangler dev did not start');
}
const post = (body, h = {}) => fetch(W + '/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-class-code': CODE, 'x-team': '1', ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const msg = t => ({ model: 'deepseek/deepseek-v4.1-flash', messages: [{ role: 'user', content: t }], max_tokens: 50 });

try {
  await waitReady();
  let r = await post(msg('a'), { 'x-class-code': '' });
  ok('no code -> 401', r.status === 401 && (await r.json()).error === 'bad_code');
  r = await post(msg('a'), { 'x-class-code': 'wrong' });
  ok('wrong code -> 401', r.status === 401);
  r = await post({ ...msg('a'), model: 'openai/gpt-6' });
  ok('model not allowed -> 400', r.status === 400 && (await r.json()).error === 'model_not_allowed');
  r = await post(msg('x'.repeat(410000)));
  ok('too large -> 400', r.status === 400 && (await r.json()).error === 'too_large');
  r = await post('{not json');
  ok('bad json -> 400', r.status === 400 && (await r.json()).error === 'bad_request');

  r = await post({ ...msg('first'), max_tokens: 5000, temperature: 0.7 });
  let j = await r.json();
  ok('good call -> 200 with cost', r.status === 200 && j.usage.cost === 0.4 && j.rybex && j.rybex.cached === false, JSON.stringify(j).slice(0, 200));
  const sent = seen[seen.length - 1];
  ok('key injected server side', sent.auth === 'Bearer dummy-key');
  ok('max_tokens capped at 700', sent.body.max_tokens === 700, sent.body.max_tokens);
  ok('reasoning forced off', sent.body.reasoning && sent.body.reasoning.enabled === false);
  ok('temperature kept for deepseek', sent.body.temperature === 0.7);

  const before = seen.length;
  r = await post({ ...msg('first'), max_tokens: 5000, temperature: 0.7 }, { 'x-team': '2' });
  j = await r.json();
  ok('identical body -> cache hit, no upstream call', r.status === 200 && j.rybex.cached === true && seen.length === before, `cached=${j.rybex && j.rybex.cached} upstream=${seen.length - before}`);

  r = await post({ model: 'anthropic/claude-haiku-5.5', messages: [{ role: 'user', content: 'h' }], temperature: 0.3 });
  await r.json();
  ok('temperature stripped for anthropic', !('temperature' in seen[seen.length - 1].body));

  // team 1 has spent 0.4 (first) ; team 3 fresh: 0.4 then 0.4 then blocked at limit 0.5
  r = await post(msg('b1'), { 'x-team': '3' }); await r.json();
  r = await post(msg('b2'), { 'x-team': '3' }); await r.json();
  r = await post(msg('b3'), { 'x-team': '3' });
  ok('team over daily budget -> 429 budget_team', r.status === 429 && (await r.json()).error === 'budget_team');
  r = await post(msg('b4'), { 'x-team': '4' });
  ok('other team still allowed', r.status === 200);

  r = await fetch(W + '/status', { headers: { 'x-class-code': CODE, 'x-team': '3' } });
  j = await r.json();
  ok('status reports team spend', r.status === 200 && Math.abs(j.teamSpend - 0.8) < 1e-9 && j.limits.team === 0.5, JSON.stringify(j));

  r = await fetch(W + '/chat', { method: 'OPTIONS', headers: { origin: 'https://workszop.github.io', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-class-code,x-team' } });
  ok('CORS preflight allowed for GitHub Pages', r.status === 204 && r.headers.get('access-control-allow-origin') === 'https://workszop.github.io');
  r = await fetch(W + '/chat', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  ok('CORS preflight refused for other origin', r.headers.get('access-control-allow-origin') !== 'https://evil.example');

  const img = 'data:image/png;base64,' + 'A'.repeat(100);
  const many = { model: 'deepseek/deepseek-v4.1-flash', messages: [{ role: 'user', content: Array.from({ length: 11 }, () => ({ type: 'image_url', image_url: { url: img } })) }] };
  r = await post(many);
  ok('more than 10 images -> 400 too_large', r.status === 400);
  r = await post({ ...many, messages: [{ role: 'user', content: many.messages[0].content.slice(0, 9) }] }, { 'x-team': '5' });
  ok('9 images (8 examples + 1) accepted', r.status === 200);
} catch (e) { console.log('ERROR', e.message); fail++; }
console.log(`\n${pass} passed, ${fail} failed`);
stop(fail ? 1 : 0);
