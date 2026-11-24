// Worker contract checks: runs `wrangler dev` against a local mock of OpenRouter.
// Usage: cd tests && node worker.mjs   (W_PORT=<port> UP_PORT=<port> move the Worker and the mock upstream when 8787 or 8799 is taken)
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.join(HERE, '..', 'worker');
const UP_PORT = +process.env.UP_PORT || 8799, W_PORT = +process.env.W_PORT || 8787, W = `http://127.0.0.1:${W_PORT}`;
const CODE = 'test-code';
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

// ─── Mock upstream ───
const seen = [], embSeen = [];
const up = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const body = JSON.parse(b || '{}');
    // Embeddings upstream (EMBED_URL): one 256-number vector per input, returned in reverse order to prove the Worker sorts by index.
    // Markers in a text: BADSHAPE -> one vector too few, SHORTVEC -> vectors of 8 numbers, NOCOST -> usage without cost, UPFAIL -> 500.
    if (req.url === '/embed') {
      embSeen.push({ body, auth: req.headers.authorization });
      const texts = body.input, has = m => texts.some(t => t.includes(m));
      if (has('UPFAIL')) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'boom' } })); }
      const dim = has('SHORTVEC') ? 8 : body.dimensions, data = texts.map((t, i) => ({ object: 'embedding', index: i, embedding: Array.from({ length: dim }, (_, k) => k === 0 ? t.length : 0.123456789) }));
      if (has('BADSHAPE')) data.pop();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ object: 'list', model: body.model, data: data.reverse(), usage: { prompt_tokens: 1000, total_tokens: 1000, ...(has('NOCOST') ? {} : { cost: 0.05 }) } }));
    }
    seen.push({ body, auth: req.headers.authorization });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'gen-' + seen.length, model: body.model, choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, cost: 0.4 } }));
  });
}).listen(UP_PORT);

// ─── wrangler dev ───
fs.writeFileSync(path.join(WORKER_DIR, '.dev.vars'), `CLASS_CODE=${CODE}\nOPENROUTER_API_KEY=dummy-key\n`);
const persist = fs.mkdtempSync('/tmp/rybex-wr-');
const wr = spawn('npx', ['wrangler', 'dev', '--port', String(W_PORT), '--ip', '127.0.0.1', '--persist-to', persist,
  '--var', `UPSTREAM_URL:http://127.0.0.1:${UP_PORT}/chat`, '--var', `EMBED_URL:http://127.0.0.1:${UP_PORT}/embed`, '--var', 'TEAM_DAILY_USD:0.5', '--var', 'TOTAL_DAILY_USD:100', '--var', 'RESERVE_USD:0.3'],
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

  r = await post(msg('t9'), { 'x-team': '9' });
  ok('team outside 1-8 -> 400 (no budget rotation)', r.status === 400);
  r = await fetch(W + '/status', { headers: { 'x-class-code': CODE, 'x-team': '42' } });
  ok('status for team outside 1-8 -> 400', r.status === 400);
  // team 6: limit 0.5, reserve 0.3 per call -> of three parallel calls only two get through
  const par = await Promise.all(['p1', 'p2', 'p3'].map(t => post(msg(t), { 'x-team': '6' }).then(x => x.status)));
  ok('parallel calls reserve budget first: one of three blocked', par.filter(s => s === 429).length === 1 && par.filter(s => s === 200).length === 2, JSON.stringify(par));
  r = await fetch(W + '/status', { headers: { 'x-class-code': CODE, 'x-team': '6' } });
  j = await r.json();
  ok('reservations settle to the real cost', Math.abs(j.teamSpend - 0.8) < 1e-9, JSON.stringify(j));

  // ─── POST /embed: texts to vectors, behind the same gate as /chat (team 7 is untouched so far; team 8 for the budget) ───
  const EM = 'openai/text-embedding-3-small';
  const embed = (body, h = {}) => fetch(W + '/embed', { method: 'POST', headers: { 'content-type': 'application/json', 'x-class-code': CODE, 'x-team': '7', ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const eb = (input, extra = {}) => ({ model: EM, input, dimensions: 256, ...extra });
  r = await embed(eb(['a']), { 'x-class-code': '' });
  ok('embed: no code -> 401', r.status === 401 && (await r.json()).error === 'bad_code');
  r = await embed(eb(['a']), { 'x-class-code': 'wrong' });
  ok('embed: wrong code -> 401', r.status === 401);
  r = await embed(eb(['a']), { 'x-team': '9' });
  ok('embed: team outside 1-8 -> 400 bad_team', r.status === 400 && (await r.json()).error === 'bad_team');
  r = await embed({ ...eb(['a']), model: 'openai/text-embedding-3-large' });
  ok('embed: model not allowed -> 400', r.status === 400 && (await r.json()).error === 'model_not_allowed');
  r = await embed(eb(['a'], { dimensions: 1536 }));
  ok('embed: another vector size -> 400 bad_dimensions', r.status === 400 && (await r.json()).error === 'bad_dimensions');
  r = await embed('{not json');
  ok('embed: bad json -> 400', r.status === 400 && (await r.json()).error === 'bad_request');
  const badInputs = await Promise.all([[], [''], ['ok', 5], null, { text: 'a' }].map(i => embed(eb(i)).then(async x => [x.status, (await x.json()).error])));
  ok('embed: empty, blank or non-text input -> 400 bad_request', badInputs.every(x => x[0] === 400 && x[1] === 'bad_request'), JSON.stringify(badInputs));
  r = await embed(eb(Array.from({ length: 33 }, (_, i) => 't' + i)));
  ok('embed: more than 32 texts -> 400 too_large', r.status === 400 && (await r.json()).error === 'too_large');
  r = await embed(eb(['x'.repeat(8001)]));
  ok('embed: a text over 8000 characters -> 400 too_large', r.status === 400 && (await r.json()).error === 'too_large');
  ok('embed: refused requests never reach the upstream', embSeen.length === 0, String(embSeen.length));

  r = await embed(eb(['raz', 'dwa dwa', 'trzy trzy trzy']));
  j = await r.json();
  const es = embSeen[embSeen.length - 1];
  ok('embed: good call -> 200, one vector of 256 numbers per text', r.status === 200 && j.object === 'list' && j.model === EM && j.data.length === 3 && j.data.every(d => d.embedding.length === 256), JSON.stringify(j).slice(0, 200));
  ok('embed: vectors come back in input order', j.data.map(d => d.index).join() === '0,1,2' && j.data.map(d => d.embedding[0]).join() === '3,7,14', j.data.map(d => d.embedding[0]).join());
  ok('embed: numbers rounded to 5 decimals', j.data[0].embedding[1] === 0.12346, String(j.data[0].embedding[1]));
  ok('embed: cost and spend reported', j.usage.cost === 0.05 && j.usage.prompt_tokens === 1000 && j.rybex.cached === false && Math.abs(j.rybex.teamSpend - 0.05) < 1e-9 && j.rybex.dim === 256, JSON.stringify(j.rybex));
  ok('embed: key injected server side, upstream body is model + input + fixed size', es.auth === 'Bearer dummy-key' && es.body.model === EM && es.body.dimensions === 256 && es.body.encoding_format === 'float' && es.body.input.length === 3 && Object.keys(es.body).length === 4, JSON.stringify(Object.keys(es.body)));
  r = await embed({ model: EM, input: 'jeden tekst' });
  j = await r.json();
  ok('embed: a single string and no dimensions field are accepted', r.status === 200 && j.data.length === 1 && embSeen[embSeen.length - 1].body.dimensions === 256 && Array.isArray(embSeen[embSeen.length - 1].body.input));

  let eBefore = embSeen.length;
  r = await embed(eb(['raz', 'dwa dwa', 'trzy trzy trzy']), { 'x-team': '2' });
  j = await r.json();
  ok('embed: identical request from another team -> cache hit, no upstream call, nothing charged', r.status === 200 && j.rybex.cached === true && embSeen.length === eBefore && j.data.length === 3 && j.data[2].embedding[0] === 14, `cached=${j.rybex && j.rybex.cached} upstream=${embSeen.length - eBefore}`);
  r = await embed(eb(['NOCOST tekst']));
  j = await r.json();
  ok('embed: cost falls back to tokens × list price when the upstream gives none', r.status === 200 && Math.abs(j.usage.cost - 1000 * 0.02 / 1e6) < 1e-12, String(j.usage && j.usage.cost));

  r = await fetch(W + '/status', { headers: { 'x-class-code': CODE, 'x-team': '7' } });
  const spend0 = (await r.json()).teamSpend;
  const fails = []; for (const t of ['BADSHAPE a', 'SHORTVEC a', 'UPFAIL a']) { const x = await embed(eb([t, 'drugi'])); fails.push([x.status, (await x.json()).error]); }
  ok('embed: wrong number or size of vectors, or an upstream error -> 502 upstream', fails.every(x => x[0] === 502 && x[1] === 'upstream'), JSON.stringify(fails));
  r = await fetch(W + '/status', { headers: { 'x-class-code': CODE, 'x-team': '7' } });
  j = await r.json();
  ok('embed: failed calls are not charged', Math.abs(j.teamSpend - spend0) < 1e-9, `${spend0} -> ${j.teamSpend}`);
  ok('status lists the embedding model and size', j.embed && j.embed.models.join() === EM && j.embed.dimensions === 256, JSON.stringify(j.embed));
  eBefore = embSeen.length;
  r = await embed(eb(['BADSHAPE a', 'drugi']));
  ok('embed: a failed answer is not cached', r.status === 502 && embSeen.length === eBefore + 1);

  // team 8: limit 0.5, 0.05 per call -> the spend reaches the limit within eleven calls (ten sum to just under 0.5 in floating point), the next is blocked; chat and embed share the budget
  for (let i = 0; i < 11; i++) await (await embed(eb(['budget ' + i]), { 'x-team': '8' })).json();
  r = await embed(eb(['budget 11']), { 'x-team': '8' });
  j = await r.json();
  ok('embed: team over daily budget -> 429 budget_team', r.status === 429 && j.error === 'budget_team' && j.teamSpend >= 0.5 && j.teamSpend < 0.56, JSON.stringify(j).slice(0, 200));
  r = await post(msg('after embed budget'), { 'x-team': '8' });
  ok('embed and chat share one team budget', r.status === 429);
  r = await embed(eb(['budget 0']), { 'x-team': '8' });
  ok('embed: a cached request is still answered when the budget is used up', r.status === 200 && (await r.json()).rybex.cached === true);

  r = await fetch(W + '/embed', { method: 'OPTIONS', headers: { origin: 'https://workszop.github.io', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-class-code,x-team' } });
  ok('embed: CORS preflight allowed for GitHub Pages', r.status === 204 && r.headers.get('access-control-allow-origin') === 'https://workszop.github.io');
  r = await fetch(W + '/embed', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  ok('embed: CORS preflight refused for other origin', r.headers.get('access-control-allow-origin') !== 'https://evil.example');
  r = await embed(eb(['cors']), { origin: 'null', 'x-team': '2' });
  ok('embed: a file:// page (origin null) may read the answer', r.status === 200 && r.headers.get('access-control-allow-origin') === 'null');
  r = await fetch(W + '/embed', { headers: { 'x-class-code': CODE, 'x-team': '1' } });
  ok('embed: GET -> 404', r.status === 404);
} catch (e) { console.log('ERROR', e.message); fail++; }
console.log(`\n${pass} passed, ${fail} failed`);
stop(fail ? 1 : 0);
