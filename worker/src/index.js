// Rybex workshop AI proxy: browser app -> this Worker -> OpenRouter.
// The OpenRouter key and the class code are Worker secrets; the page never sees the key.
// One SQLite Durable Object ("Gate") keeps daily spend per team and a response cache,
// so identical requests from different teams are paid once.
import { DurableObject } from 'cloudflare:workers';

// ─── Constants ───
const MAX_BODY_BYTES = 400_000;
const MAX_IMAGES = 10;
const MAX_IMAGE_URL = 150_000;
const MAX_MESSAGES = 60;
const CACHE_DAYS = 7;
const CACHE_MAX_BYTES = 64_000;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// ─── Helpers ───
const listVar = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const numVar = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const today = () => new Date().toISOString().slice(0, 10);

function corsHeaders(req, env) {
  const origin = req.headers.get('origin');
  const h = { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Class-Code, X-Team', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (origin && (listVar(env.ALLOWED_ORIGINS).includes(origin) || LOCAL_ORIGIN.test(origin) || origin === 'null')) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const json = (req, env, status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(req, env) } });

function sameCode(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const codeOk = (env, code) => !!code && listVar(env.CLASS_CODE).some(c => sameCode(c, code));
// Teams 1..TEAM_COUNT only: with TEAM_COUNT × TEAM_DAILY_USD below TOTAL_DAILY_USD, one code holder
// cannot drain the class budget by rotating team numbers.
const teamOf = (req, env) => { const t = parseInt(req.headers.get('x-team'), 10), max = numVar(env.TEAM_COUNT, 8); return t >= 1 && t <= max ? String(t) : null; };

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate the client body and build the one we send upstream. Returns {error} or {body}.
function buildUpstream(input, env) {
  if (!input || typeof input !== 'object') return { error: 'bad_request' };
  if (!listVar(env.ALLOWED_MODELS).includes(input.model)) return { error: 'model_not_allowed' };
  const msgs = input.messages;
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > MAX_MESSAGES) return { error: 'bad_request' };
  let images = 0;
  for (const m of msgs) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role)) return { error: 'bad_request' };
    if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p && p.type === 'image_url') {
          const url = p.image_url && p.image_url.url;
          if (typeof url !== 'string' || !url.startsWith('data:image/')) return { error: 'bad_request' };
          if (url.length > MAX_IMAGE_URL || ++images > MAX_IMAGES) return { error: 'too_large' };
        } else if (!p || p.type !== 'text' || typeof p.text !== 'string') return { error: 'bad_request' };
      }
    } else if (typeof m.content !== 'string') return { error: 'bad_request' };
  }
  const cap = numVar(env.MAX_TOKENS, 700);
  const body = { model: input.model, messages: msgs, max_tokens: Math.min(cap, Math.max(1, parseInt(input.max_tokens, 10) || 300)), reasoning: { enabled: false } };
  const rf = input.response_format;
  if (rf && (rf.type === 'json_object' || rf.type === 'json_schema')) body.response_format = rf;
  if (!input.model.startsWith('anthropic/') && Number.isFinite(input.temperature)) body.temperature = Math.min(2, Math.max(0, input.temperature));
  if (Number.isInteger(input.seed)) body.seed = input.seed;
  return { body };
}

// ─── Durable Object: spend + cache ───
export class Gate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS spend (day TEXT NOT NULL, team TEXT NOT NULL, usd REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, team));
      CREATE TABLE IF NOT EXISTS cache (hash TEXT PRIMARY KEY, body TEXT NOT NULL, ts INTEGER NOT NULL);`);
  }
  totals(day, team) {
    const sql = this.ctx.storage.sql;
    const t = sql.exec('SELECT usd, calls FROM spend WHERE day = ? AND team = ?', day, team).toArray()[0];
    const all = sql.exec('SELECT COALESCE(SUM(usd), 0) AS usd FROM spend WHERE day = ?', day).one();
    return { teamSpend: t ? t.usd : 0, teamCalls: t ? t.calls : 0, totalSpend: all.usd };
  }
  // Cache lookup, budget check and reservation in one synchronous step, so parallel calls
  // cannot all pass the check before any of them has been charged.
  async begin(day, team, hash, limits, reserve) {
    const sql = this.ctx.storage.sql;
    const row = sql.exec('SELECT body, ts FROM cache WHERE hash = ?', hash).toArray()[0];
    if (row && Date.now() - row.ts < CACHE_DAYS * 864e5) return { cached: row.body, ...this.totals(day, team) };
    const t = this.totals(day, team);
    if (t.totalSpend >= limits.total) return { blocked: 'budget_total', ...t };
    if (t.teamSpend >= limits.team) return { blocked: 'budget_team', ...t };
    sql.exec(`INSERT INTO spend (day, team, usd, calls) VALUES (?, ?, ?, 0)
      ON CONFLICT (day, team) DO UPDATE SET usd = usd + excluded.usd`, day, team, reserve);
    return { cached: null, ...this.totals(day, team) };
  }
  // Replace the reservation with the real cost (0 and no call counted when the upstream call failed).
  async finish(day, team, cost, reserve, hash, body, ok = true) {
    const sql = this.ctx.storage.sql;
    sql.exec(`INSERT INTO spend (day, team, usd, calls) VALUES (?, ?, ?, ?)
      ON CONFLICT (day, team) DO UPDATE SET usd = MAX(0, usd + excluded.usd), calls = calls + excluded.calls`, day, team, cost - reserve, ok ? 1 : 0);
    if (hash && body && body.length <= CACHE_MAX_BYTES) sql.exec('INSERT OR REPLACE INTO cache (hash, body, ts) VALUES (?, ?, ?)', hash, body, Date.now());
    if (Math.random() < 0.02) sql.exec('DELETE FROM cache WHERE ts < ?', Date.now() - CACHE_DAYS * 864e5);
    return this.totals(day, team);
  }
  async status(day, team) { return this.totals(day, team); }
}

// ─── Handlers ───
async function handleChat(req, env) {
  if (!env.CLASS_CODE || !env.OPENROUTER_API_KEY) return json(req, env, 500, { error: 'not_configured' });
  if (!codeOk(env, req.headers.get('x-class-code'))) return json(req, env, 401, { error: 'bad_code' });
  const team = teamOf(req, env);
  if (!team) return json(req, env, 400, { error: 'bad_team' });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(req, env, 400, { error: 'too_large' });
  let input; try { input = JSON.parse(raw); } catch (e) { return json(req, env, 400, { error: 'bad_request' }); }
  const { error, body } = buildUpstream(input, env);
  if (error) return json(req, env, 400, { error });

  const payload = JSON.stringify(body), hash = await sha256(payload), day = today();
  const gate = env.GATE.getByName('class');
  const limits = { team: numVar(env.TEAM_DAILY_USD, 1), total: numVar(env.TOTAL_DAILY_USD, 15) }, reserve = numVar(env.RESERVE_USD, 0.01);
  const pre = await gate.begin(day, team, hash, limits, reserve);
  if (pre.cached) {
    const out = JSON.parse(pre.cached);
    out.rybex = { cached: true, teamSpend: pre.teamSpend, totalSpend: pre.totalSpend, limits };
    return json(req, env, 200, out);
  }
  if (pre.blocked) { const { blocked, ...t } = pre; return json(req, env, 429, { error: blocked, ...t, limits }); }

  let up, text = '';
  try {
    up = await fetch(env.UPSTREAM_URL, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://workszop.github.io', 'X-Title': 'Rybex AI workshop' } });
    text = await up.text();
  } catch (e) { await gate.finish(day, team, 0, reserve, null, null, false); return json(req, env, 502, { error: 'upstream', status: 0 }); }
  let out; try { out = JSON.parse(text); } catch (e) { out = null; }
  if (!up.ok || !out || !Array.isArray(out.choices)) {
    await gate.finish(day, team, 0, reserve, null, null, false);
    return json(req, env, 502, { error: 'upstream', status: up.status, detail: out && out.error ? String(out.error.message || '').slice(0, 300) : '' });
  }
  const cost = numVar(out.usage && out.usage.cost, 0);
  const post = await gate.finish(day, team, cost, reserve, hash, text);
  out.rybex = { cached: false, teamSpend: post.teamSpend, totalSpend: post.totalSpend, limits };
  return json(req, env, 200, out);
}

async function handleStatus(req, env) {
  if (!env.CLASS_CODE) return json(req, env, 500, { error: 'not_configured' });
  if (!req.headers.get('x-class-code')) return json(req, env, 200, { ok: false, error: 'bad_code' });
  if (!codeOk(env, req.headers.get('x-class-code'))) return json(req, env, 401, { error: 'bad_code' });
  const team = req.headers.get('x-team') ? teamOf(req, env) : '0';
  if (!team) return json(req, env, 400, { error: 'bad_team' });
  const t = await env.GATE.getByName('class').status(today(), team);
  return json(req, env, 200, { ok: true, ...t, limits: { team: numVar(env.TEAM_DAILY_USD, 1), total: numVar(env.TOTAL_DAILY_USD, 15) }, models: listVar(env.ALLOWED_MODELS) });
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    if (pathname === '/chat' && req.method === 'POST') return handleChat(req, env);
    if (pathname === '/status' && req.method === 'GET') return handleStatus(req, env);
    return json(req, env, 404, { error: 'not_found' });
  },
};
