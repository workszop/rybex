// Static server for the app + a mock of the rybex-ai Worker contract (no real model calls).
// Reset params: delay=<ms>, fail=<substring> (502), hang=<substring> (answer after 3 s), cache=1.
// Usage: node tests/mock-server.mjs [port=8794]  ->  open http://127.0.0.1:8794/rybex-ai-workshop.html?ai=http://127.0.0.1:8794/mock
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || 8794);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const PRICE = { 'deepseek/deepseek-v4.1-flash': [0.045, 0.5], 'anthropic/claude-haiku-5.5': [0.1, 0.5] };
const KW = { smell: ['zapach', 'śmierdz', 'zepsut', 'nieświeży', 'smell'], damage: ['wgniec', 'uszkodz', 'wybrzusz', 'rdze', 'przecie', 'ścieśni'], label: ['etykiet', 'kod', 'składu', 'data'], quality: ['suchy', 'ości', 'słon', 'konsystenc', 'sos', 'rozpada'], delivery: ['zamówieni', 'dostaw', 'kurier', 'faktur', 'palet', 'karton'] };

const state = { calls: 0, replay: null, last: null, delay: 30, fail: '', seen: new Map() };

const textOf = c => typeof c === 'string' ? c : (c || []).filter(p => p.type === 'text').map(p => p.text).join('\n');
function answer(body) {
  const msgs = body.messages, sys = textOf((msgs.find(m => m.role === 'system') || {}).content).toLowerCase();
  const last = msgs[msgs.length - 1], lastText = textOf(last.content);
  const hasImg = msgs.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
  if (hasImg) {
    const parts = last.content.filter(p => p.type === 'image_url'), url = parts[parts.length - 1].image_url.url;
    let h = 0; for (let i = 0; i < url.length; i += 97) h = (h * 31 + url.charCodeAt(i)) >>> 0;
    const d = ['ok', 'ok', 'ok', 'dent', 'label', 'code'][h % 6];
    return { defect: d, reason: 'mock: ' + d };
  }
  if (sys.includes('sędzi') || sys.includes('judge')) return { correct: true, grounded: true, reason: 'mock judge' };
  if (sys.includes('reklamac') || sys.includes('complaint')) {
    const t = lastText.toLowerCase(); let best = 'quality', bs = 0;
    for (const [c, ws] of Object.entries(KW)) { const s = ws.filter(w => t.includes(w)).length; if (s > bs) { bs = s; best = c; } }
    const hazard = /zapach|śmierdz|zepsut|nieświeży|wybrzusz|zatru/.test(t);
    return { category: best, hazard, reply: 'Dziękujemy za zgłoszenie (mock ' + best + ').' };
  }
  const m = lastText.match(/\[([A-Z]+-\d{2}) §([\d–-]+)(?: · [^\]\n]*)?\]\s*([^\n]+)/);
  if (!m) return { answer: 'Nie wiem.', sources: [], refused: true };
  return { answer: m[3], sources: [{ doc: m[1], par: m[2] }], refused: false };
}

function send(res, status, obj, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Class-Code, X-Team', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', ...extra });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (url.pathname.startsWith('/mock/')) {
    const route = url.pathname.slice(6);
    if (route === 'calls') return send(res, 200, { calls: state.calls, last: state.last });
    if (route === 'reset') { state.calls = 0; state.replay = null; state.last = null; state.delay = +(url.searchParams.get('delay') || 30); state.fail = url.searchParams.get('fail') || ''; state.hang = url.searchParams.get('hang') || ''; state.cache = url.searchParams.get('cache') === '1'; state.seen = new Map(); return send(res, 200, { ok: true }); }
    if (route === 'replay' && req.method === 'POST') { let b = ''; req.on('data', c => b += c); req.on('end', () => { state.replay = b; send(res, 200, { ok: true }); }); return; }
    const code = req.headers['x-class-code'];
    if (route === 'status') {
      if (!code) return send(res, 200, { ok: false, error: 'bad_code' });
      if (code === 'broke') return send(res, 200, { ok: true, teamSpend: 1, totalSpend: 1, limits: { team: 1, total: 15 } });
      if (code !== 'test-code') return send(res, 401, { error: 'bad_code' });
      return send(res, 200, { ok: true, teamSpend: 0.01, totalSpend: 0.05, limits: { team: 1, total: 15 } });
    }
    if (route === 'chat' && req.method === 'POST') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        if (code === 'broke') return send(res, 429, { error: 'budget_team' });
        if (code !== 'test-code') return send(res, 401, { error: 'bad_code' });
        let body; try { body = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
        if (!PRICE[body.model]) return send(res, 400, { error: 'model_not_allowed' });
        const lastMsg = body.messages[body.messages.length - 1], lastText = typeof lastMsg.content === 'string' ? lastMsg.content : lastMsg.content.filter(c => c.type === 'text').map(c => c.text).join(' ');
        if (state.fail && lastText.includes(state.fail)) { state.calls++; return send(res, 502, { error: 'upstream', status: 429 }); }
        const prev = state.cache && state.seen.get(b);
        if (prev) { const out = JSON.parse(prev); out.rybex = { ...out.rybex, cached: true }; return send(res, 200, out); }
        state.calls++; state.last = body;
        const content = JSON.stringify(answer(body)), inTok = Math.ceil(b.length / 3), outTok = Math.ceil(content.length / 3), [pi, po] = PRICE[body.model];
        const outObj = { id: 'mock-' + state.calls, model: body.model, choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok, cost: (inTok * pi + outTok * po) / 1e6 }, rybex: { cached: false, teamSpend: 0.01 * state.calls, totalSpend: 0.02 * state.calls, limits: { team: 1, total: 15 } } };
        state.seen.set(b, JSON.stringify(outObj));
        setTimeout(() => send(res, 200, outObj), state.hang && lastText.includes(state.hang) ? 3000 : state.delay);
      });
      return;
    }
    // ─── Embeddings (the Worker's POST /embed) ───
    // Deterministic word-hash vectors: lower-case words, stop words dropped, cut to a 5-letter stem, unigrams and bigrams hashed
    // (FNV-1a) into EMBED_DIM signed buckets, plus one shared component so unrelated texts score about 0.2 as with a real
    // model. Texts that share wording really are similar; nothing here understands meaning.
    // embed-calls: {calls, texts, last}; embed-calls?reset=1 clears the counters. The chat reset's delay, fail and cache apply here too.
    if (route === 'embed-calls') { const out = { calls: state.embedCalls || 0, texts: state.embedTexts || 0, last: state.lastEmbed || null }; if (url.searchParams.get('reset') === '1') { state.embedCalls = 0; state.embedTexts = 0; state.lastEmbed = null; } return send(res, 200, out); }
    if (route === 'embed' && req.method === 'POST') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        const EMBED_MODEL = 'openai/text-embedding-3-small', EMBED_DIM = 256, EMBED_PRICE = 0.02;
        if (code === 'broke') return send(res, 429, { error: 'budget_team' });
        if (code !== 'test-code') return send(res, 401, { error: 'bad_code' });
        let body; try { body = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
        if (body.model !== EMBED_MODEL) return send(res, 400, { error: 'model_not_allowed' });
        if (body.dimensions != null && body.dimensions !== EMBED_DIM) return send(res, 400, { error: 'bad_dimensions' });
        const texts = typeof body.input === 'string' ? [body.input] : body.input;
        if (!Array.isArray(texts) || !texts.length || texts.some(t => typeof t !== 'string' || !t.trim())) return send(res, 400, { error: 'bad_request' });
        if (texts.length > 32) return send(res, 400, { error: 'too_large' });
        if (state.fail && texts.some(t => t.includes(state.fail))) { state.embedCalls = (state.embedCalls || 0) + 1; return send(res, 502, { error: 'upstream', status: 429 }); }
        const prev = state.cache && state.seen.get('embed:' + b);
        if (prev) { const out = JSON.parse(prev); out.rybex = { ...out.rybex, cached: true }; return send(res, 200, out); }
        const STOPW = new Set('i w z na do się nie to że o a po co ile jak jest są dla od przy lub oraz czy ma być ten ta te the of to in is are and or for on at how what do does be'.split(' '));
        const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
        const vec = t => {
          const w = t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(x => x && !STOPW.has(x)).map(x => x.slice(0, 5)), v = new Array(EMBED_DIM).fill(0);
          const add = (k, wt) => { const h = fnv(k); v[h % (EMBED_DIM - 1)] += (h & 0x10000 ? 1 : -1) * wt; };
          w.forEach((x, i) => { add(x, 1); if (i) add(w[i - 1] + ' ' + x, 0.5); });
          const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
          // the last bucket is the shared component: cos' = (cos + 0.25) / 1.25
          for (let i = 0; i < EMBED_DIM - 1; i++) v[i] = v[i] / n; v[EMBED_DIM - 1] = 0.5;
          const m = Math.sqrt(1.25); return v.map(x => Math.round(x / m * 1e5) / 1e5);
        };
        state.embedCalls = (state.embedCalls || 0) + 1; state.embedTexts = (state.embedTexts || 0) + texts.length; state.lastEmbed = body;
        const tok = texts.reduce((a, t) => a + Math.ceil(t.length / 3), 0);
        const outObj = { object: 'list', model: EMBED_MODEL, data: texts.map((t, i) => ({ index: i, embedding: vec(t) })), usage: { prompt_tokens: tok, total_tokens: tok, cost: tok * EMBED_PRICE / 1e6 }, rybex: { cached: false, teamSpend: 0.01 + 0.0001 * state.embedCalls, totalSpend: 0.05, limits: { team: 1, total: 15 }, dim: EMBED_DIM } };
        state.seen.set('embed:' + b, JSON.stringify(outObj));
        setTimeout(() => send(res, 200, outObj), state.hang && texts.some(t => t.includes(state.hang)) ? 3000 : state.delay);
      });
      return;
    }
    return send(res, 404, { error: 'not_found' });
  }
  if (url.pathname === '/replay.json' && state.replay) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(state.replay); }
  const f = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/rybex-ai-workshop.html' : url.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('mock server on', PORT));
