// Probes for the walk-in 3D rooms. Serves the worktree root itself (port 8798).
// Usage: cd tests && node rooms.mjs [section...]   (sections: engine look integration file)
// file: the app opened straight from disk (file://), rag and vision rooms.
// ROOMS_TRACKS=rag,forecast limits the look section to those rooms (default: all five).
// integration: the real app in the lab, served by mock-server.mjs on port 8799 (screenshots scratch/rooms/app-<track>-<station>.png).
// WebGL in headless Chromium: ANGLE on the machine's OpenGL driver (real GPU). ROOMS_GL=swiftshader uses the
// software renderer instead (no GPU needed, about 10x slower).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PORT = 8798, BASE = `http://127.0.0.1:${PORT}`;
const FIX = (q = '', track = 'test') => `${BASE}/tests/rooms-fixture.html?track=${track}${q}`;
const SHOTS = path.join(ROOT, 'scratch', 'rooms');
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, BASE).pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r, j) => { srv.once('error', j); srv.listen(PORT, '127.0.0.1', r); });
// Without this a failed browser launch leaves the server running and the command never returns.
const GL_ARGS = process.env.ROOMS_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=gl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: GL_ARGS }).catch(e => { srv.close(); throw e; });
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };
const errs = [], warns = [];

async function fresh(q = '', vp = { width: 1440, height: 900 }, track = 'test', ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${q} pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${q} console: ${m.text()}`); if (m.type() === 'warning' && /blocked/.test(m.text())) warns.push(m.text()); });
  await p.goto(FIX(q, track));
  await p.waitForFunction(() => { const r = document.querySelector('.room-root'); return r && r.dataset.roomStatus !== 'loading'; }, null, { timeout: 15000 });
  return p;
}
const root = (p, k) => p.$eval('.room-root', (e, k) => e.dataset[k], k);
// ROOMS_PICK_MS: how long a click on a station (mesh or toolbar) may take to open it; raise it on a software renderer.
const PICK_MS = Number(process.env.ROOMS_PICK_MS) || 2000;
const waitStation = (p, s, timeout = PICK_MS) => p.waitForFunction(s => document.querySelector('.room-root').dataset.roomStation === s, s, { timeout }).then(() => true, () => false);
const cam = p => p.evaluate(() => window.__room._debug.cameraPos());
// Wait until the app room's camera has stopped (the glide to a station takes up to 1.1 s): 6 equal samples 50 ms apart.
const settle = p => p.evaluate(() => { window.__camS = { k: '', n: 0 }; }).then(() => p.waitForFunction(() => {
  const c = typeof X !== 'undefined' && X.room && X.room.handle._debug.cameraPos(); if (!c) return true;
  const k = c.map(v => v.toFixed(4)).join(), w = window.__camS; if (w.k === k) w.n++; else { w.k = k; w.n = 0; } return w.n >= 5;
}, null, { polling: 50, timeout: 4000 })).then(() => true, () => false);

try {
  if (run('engine')) {
    let p = await fresh();
    // engine.mount
    const m = await p.evaluate(() => { const r = document.querySelector('.room-root'); return { track: r.dataset.roomTrack, status: r.dataset.roomStatus, station: r.dataset.roomStation, canvases: r.querySelectorAll('canvas').length, btns: [...r.querySelectorAll('.room-toolbar [data-station]')].map(b => b.dataset.station), calls: window.__room._debug.info().render.calls }; });
    ok('engine.mount data attributes', m.track === 'test' && m.status === 'ready' && m.station === 'none', JSON.stringify(m));
    ok('engine.mount one canvas, five station buttons in order', m.canvases === 1 && m.btns.join() === 'brief,data,method,experiment,results', JSON.stringify(m));
    ok('engine.mount WebGL actually drew something', m.calls > 0, String(m.calls));
    await p.screenshot({ path: path.join(SHOTS, 'fixture.png') });

    // engine.guide: the walk order (numbers in the toolbar, the guide's next step, the panel's onward button).
    {
      const g = await fresh();
      const gs = () => g.evaluate(() => { const r = document.querySelector('.room-root'), q = s => r.querySelector(s), b = s => q(`.room-toolbar [data-station=${s}]`); return { next: r.dataset.roomNext, nums: [...r.querySelectorAll('.room-toolbar .room-n')].map(e => e.textContent).join(''), btn: q('.room-guide-btn').textContent, btnHidden: q('.room-guide-btn').hidden, guideShown: getComputedStyle(q('.room-guide')).visibility === 'visible', text: q('.room-guide-text').textContent, step: q('.room-step').textContent, todo: q('.room-panel-do').textContent, onward: q('.room-onward').textContent, briefDone: b('brief').classList.contains('is-done'), briefNext: b('brief').classList.contains('is-next'), dataNext: b('data').classList.contains('is-next') }; });
      const g0 = await gs();
      ok('engine.guide stations numbered 1-5, the first one is next and the guide points to it', g0.nums === '12345' && g0.next === 'brief' && g0.briefNext && g0.guideShown && /1\./.test(g0.btn) && g0.text.length > 10, JSON.stringify(g0));
      await g.click('.room-guide-btn');
      const g1o = await waitStation(g, 'brief'), g1 = await gs();
      ok('engine.guide the guide button opens the next station; the panel names the step and what to do', g1o && !g1.guideShown && /1/.test(g1.step) && /5/.test(g1.step) && g1.todo.length > 10 && /2\./.test(g1.onward) && g1.briefDone && g1.dataNext && g1.next === 'data', JSON.stringify(g1));
      await g.click('.room-onward');
      const g2o = await waitStation(g, 'data');
      await g.click('.room-panel [data-room-close]'); await waitStation(g, 'none');
      const g2 = await gs();
      ok('engine.guide onward opens the following station; after closing the guide names step 3', g2o && g2.guideShown && g2.next === 'method' && /3/.test(g2.text) && /3\./.test(g2.btn), JSON.stringify(g2));
      await g.evaluate(() => { for (const s of ['method', 'experiment', 'results']) window.__room.open(s); });
      const g3 = await gs();
      ok('engine.guide last station: onward closes, nothing is next', g3.next === 'none' && !/\d\./.test(g3.onward), JSON.stringify(g3));
      await g.click('.room-onward'); const g4o = await waitStation(g, 'none'), g4 = await gs();
      ok('engine.guide all visited: the guide says so and offers no button', g4o && g4.guideShown && g4.btnHidden && g4.text.length > 10, JSON.stringify(g4));
      // opts.seen: a walk kept by the app goes on where it stood (unknown names ignored).
      const gk = await fresh('&seen=brief,data,bogus');
      const k0 = await gk.evaluate(() => { const r = document.querySelector('.room-root'); return { next: r.dataset.roomNext, done: [...r.querySelectorAll('.room-toolbar .is-done')].map(b => b.dataset.station).join(), text: r.querySelector('.room-guide-text').textContent, tip: r.querySelector('.room-guide-tip').hidden }; });
      ok('engine.guide opts.seen: those stations are done, the third is next', k0.next === 'method' && k0.done === 'brief,data' && /3/.test(k0.text) && k0.tip, JSON.stringify(k0));
      await gk.close();
      await g.close();
    }

    // engine.font: while Raleway is still downloading, a room's late-font redraws wait; a disposed room takes its
    // own away. The stylesheet is served here and the font file never answers, so the font stays pending.
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType: 'text/css', body: "@font-face{font-family:Raleway;font-weight:500 800;src:url(https://fonts.gstatic.com/stalled.woff2) format('woff2')}" }));
      await ctx.route(/fonts\.gstatic\.com/, () => {});
      const f = await ctx.newPage();
      await f.goto(FIX(), { waitUntil: 'domcontentloaded' }); // the load event would wait for the stalled font
      await f.waitForFunction(() => { const r = document.querySelector('.room-root'); return r && r.dataset.roomStatus !== 'loading'; }, null, { timeout: 15000 });
      const n = () => f.evaluate(() => Rooms._debug.fontWaiters());
      const n1 = await n();
      await f.evaluate(() => window.__room.dispose());
      const n2 = await n();
      await f.evaluate(() => { window.__mount(); window.__mount(); window.__mount(); });
      const n3 = await n();
      await f.evaluate(() => window.__room.dispose());
      const n4 = await n();
      ok('engine.font pending font: the mounted room waits with its text redraws', n1 > 0, String(n1));
      ok('engine.font dispose drops that room\'s redraws; three mounts in a row leave one room\'s worth', n2 === 0 && n3 === n1 && n4 === 0, JSON.stringify([n1, n2, n3, n4]));
      await ctx.close();
    }

    // engine.open
    await p.click('.room-toolbar [data-station=method]');
    const opened = await waitStation(p, 'method');
    const o = await p.evaluate(() => { const slots = [...document.querySelectorAll('.room-slot')]; const panel = document.querySelector('.room-panel'); return { vis: slots.filter(s => !s.hidden).map(s => s.dataset.station), hidden: slots.filter(s => s.hidden).length, focus: panel.contains(document.activeElement), role: panel.getAttribute('role'), lab: !!document.getElementById(panel.getAttribute('aria-labelledby')), live: (document.querySelector('.room-live') || {}).textContent || '' }; });
    ok('engine.open toolbar opens the station', opened);
    ok('engine.open only its slot visible, focus inside the dialog', o.vis.join() === 'method' && o.hidden === 4 && o.focus && o.role === 'dialog' && o.lab, JSON.stringify(o));
    ok('engine.open live region names the station', /Build|Budowa/.test(o.live), o.live);
    await p.keyboard.press('Escape');
    const c = await p.evaluate(() => ({ st: document.querySelector('.room-root').dataset.roomStation, f: document.activeElement && document.activeElement.dataset.station, hid: document.querySelector('.room-panel').hidden }));
    ok('engine.open Esc closes, focus back on the toolbar button', c.st === 'none' && c.f === 'method' && c.hid, JSON.stringify(c));

    // engine.identity
    await p.click('.room-toolbar [data-station=method]'); await waitStation(p, 'method');
    await p.fill('#fxInput', 'abc');
    await p.click('.room-panel [data-room-prev]'); const toData = await waitStation(p, 'data');
    await p.click('.room-panel [data-room-next]'); const back = await waitStation(p, 'method');
    const id = await p.evaluate(() => ({ same: window.__fxNode === document.querySelector('#fxInput'), v: document.querySelector('#fxInput').value, n: document.querySelectorAll('#fxInput').length, vis: !document.querySelector('#fxInput').closest('.room-slot').hidden }));
    ok('engine.identity next/prev switch stations', toData && back);
    ok('engine.identity panel node and its value survive switching', id.same && id.v === 'abc' && id.n === 1 && id.vis, JSON.stringify(id));

    // engine.typing
    await p.waitForTimeout(1300); // let the camera glide to the method station finish
    await p.focus('#fxInput'); const t0 = await cam(p);
    for (let i = 0; i < 20; i++) await p.keyboard.press('w');
    for (let i = 0; i < 10; i++) await p.keyboard.press('ArrowUp');
    await p.waitForTimeout(150); const t1 = await cam(p);
    ok('engine.typing keys in a field never move the camera', t0.every((v, i) => Math.abs(v - t1[i]) < 1e-6), JSON.stringify([t0, t1]));
    ok('engine.typing letters reached the field', (await p.$eval('#fxInput', e => e.value)).startsWith('abcwwww'));
    await p.close();

    // engine.walk
    p = await fresh();
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    const w0 = await cam(p); const cols = await p.evaluate(() => window.__fxColliders);
    const inside = ([x, , z]) => cols.some(([x0, z0, x1, z1]) => { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return dx * dx + dz * dz < (0.3 - 1e-3) ** 2; });
    await p.keyboard.down('w'); await p.waitForTimeout(500); const w1 = await cam(p);
    const trail = [];
    for (let i = 0; i < 30; i++) { await p.waitForTimeout(50); trail.push(await cam(p)); }
    await p.keyboard.up('w');
    ok('engine.walk holding w moves the camera forward', w1[2] < w0[2] - 0.3, JSON.stringify([w0, w1]));
    ok('engine.walk never enters a collider', ![w1, ...trail].some(inside), JSON.stringify(trail.slice(-3)));
    ok('engine.walk stopped by the crate in front', trail[trail.length - 1][2] > 1.5 + 0.3 - 0.01, JSON.stringify(trail[trail.length - 1]));
    await p.close();

    // engine.pick
    p = await fresh();
    const pt = await p.evaluate(() => window.__room._debug.project('results'));
    ok('engine.pick station on screen', pt && pt[0] > 0 && pt[0] < 1440 && pt[1] > 0 && pt[1] < 900, JSON.stringify(pt));
    await p.mouse.click(pt[0], pt[1]);
    ok('engine.pick clicking the station mesh opens it', await waitStation(p, 'results'));
    // engine.setPanels
    await p.click('.room-panel [data-room-close]'); await p.click('.room-toolbar [data-station=brief]'); await waitStation(p, 'brief');
    const sp = await p.evaluate(() => { const cv = document.querySelector('.room-root canvas'), old = document.querySelector('.room-slot[data-station=brief]').firstElementChild; const el = document.createElement('div'); el.id = 'fxNew'; el.textContent = 'Nowa treść'; window.__room.setPanels({ brief: el }); const s = document.querySelector('.room-slot[data-station=brief]'); return { st: document.querySelector('.room-root').dataset.roomStation, shown: s.contains(el) && !s.hidden && el.offsetHeight > 0, old: old.isConnected, cv: cv === document.querySelector('.room-root canvas') && cv.isConnected }; });
    ok('engine.setPanels keeps the open station and canvas, swaps content', sp.st === 'brief' && sp.shown && !sp.old && sp.cv, JSON.stringify(sp));

    // engine.dispose
    const d = await p.evaluate(async () => { window.__fxNode.value = 'keep me'; let n = 0; const raf = window.requestAnimationFrame; window.requestAnimationFrame = f => { n++; return raf.call(window, f); }; await new Promise(r => setTimeout(r, 200)); const before = n; window.__room.dispose(); n = 0; await new Promise(r => setTimeout(r, 300)); const after = n; const host = document.querySelector('#host'); const kids = host.children.length; const panelEl = window.__fxNode.closest('[data-fx]'); const node = { kept: window.__fxNode.value === 'keep me', inDoc: window.__fxNode.isConnected, parent: panelEl && panelEl.parentNode ? panelEl.parentNode.className || panelEl.parentNode.nodeName : null }; const a = window.__mount(), b = window.__mount(); b.dispose(); a.dispose(); window.requestAnimationFrame = raf; return { before, after, kids, node, canvases: document.querySelectorAll('canvas').length, hostKids: host.children.length }; });
    ok('engine.dispose stops frames and empties the host', d.before > 0 && d.after === 0 && d.kids === 0, JSON.stringify(d));
    ok('engine.dispose leaves the app panels intact and detached', d.node.kept && !d.node.inDoc && d.node.parent === null, JSON.stringify(d.node));
    ok('engine.dispose mounting twice then disposing leaves no canvas', d.canvases === 0 && d.hostKids === 0, JSON.stringify(d));
    await p.close();

    // engine.i18n: titles and labels given as { pl, en }
    for (const lang of ['pl', 'en']) {
      p = await fresh(`&i18n=1&lang=${lang}`);
      const want = lang === 'pl' ? { brief: 'Zadanie', data: 'Monitor z danymi' } : { brief: 'Brief', data: 'Data monitor' };
      const bar = await p.evaluate(() => ({ brief: document.querySelector('.room-toolbar [data-station=brief] .room-btn-t').textContent, data: document.querySelector('.room-toolbar [data-station=data] .room-btn-t').textContent, labels: window.__fxLabels }));
      await p.click('.room-toolbar [data-station=brief]'); await waitStation(p, 'brief');
      const t1 = await p.evaluate(() => ({ title: document.querySelector('.room-panel-title').textContent, live: document.querySelector('.room-live').textContent }));
      await p.click('.room-panel [data-room-next]'); await waitStation(p, 'data');
      const t2 = await p.evaluate(() => ({ title: document.querySelector('.room-panel-title').textContent, live: document.querySelector('.room-live').textContent }));
      ok(`engine.i18n ${lang}: { pl, en } title resolved in toolbar, panel title and live region`, bar.brief === want.brief && t1.title === want.brief && t1.live.endsWith(want.brief), JSON.stringify([bar, t1]));
      ok(`engine.i18n ${lang}: { pl, en } label resolved on the sprite, toolbar and panel title`, bar.labels.includes(want.data) && bar.labels.every(x => typeof x === 'string') && bar.data === want.data && t2.title === want.data && t2.live.endsWith(want.data), JSON.stringify([bar, t2]));
      await p.close();
    }

    // engine.fallback
    p = await fresh('&nowebgl=1');
    const f = await p.evaluate(() => { const r = document.querySelector('.room-root'); return { st: r.dataset.roomStatus, cv: r.querySelectorAll('canvas').length, status: window.__room.status, dbg: window.__room._debug.cameraPos() }; });
    ok('engine.fallback status and no canvas', f.st === 'fallback' && f.cv === 0 && f.status === 'fallback' && f.dbg === null, JSON.stringify(f));
    await p.click('.room-toolbar [data-station=data]');
    ok('engine.fallback toolbar opens panels', await waitStation(p, 'data') && await p.$eval('.room-slot[data-station=data]', e => !e.hidden && e.offsetHeight > 0));
    await p.close();

    // engine.mobile
    p = await fresh('', { width: 390, height: 844 });
    await p.click('.room-toolbar [data-station=brief]'); await waitStation(p, 'brief');
    const mb = await p.evaluate(() => { const r = document.querySelector('.room-panel').getBoundingClientRect(); return { bottom: r.bottom, w: r.width, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    ok('engine.mobile panel is a bottom sheet', mb.bottom >= mb.ih - 1 && mb.w >= 380, JSON.stringify(mb));
    ok('engine.mobile no sideways scroll', mb.sw <= mb.iw, JSON.stringify(mb));
    await p.screenshot({ path: path.join(SHOTS, 'fixture-mobile.png') });
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(400);
    const rz = await p.evaluate(() => { const h = document.querySelector('#host'), cv = document.querySelector('.room-root canvas'); return { hw: h.clientWidth, cw: cv.getBoundingClientRect().width, buf: cv.width, st: document.querySelector('.room-root').dataset.roomStation }; });
    ok('engine.mobile resize to desktop: canvas follows the host', rz.cw === rz.hw && rz.buf === rz.hw && rz.st === 'brief', JSON.stringify(rz));
    await p.screenshot({ path: path.join(SHOTS, 'fixture-panel.png') });
    await p.close();

    // engine.labels: station labels keep a small on-screen size and step aside while a panel is open.
    p = await fresh('', undefined, 'vision');
    await p.waitForTimeout(300);
    const labs = () => p.evaluate(() => window.__room._debug.labels && window.__room._debug.labels());
    const l0 = await labs();
    const vis0 = (l0 || []).filter(l => l.visible);
    ok('engine.labels debug hook lists five labels', Array.isArray(l0) && l0.length === 5, JSON.stringify(l0));
    ok('engine.labels at vision spawn every visible label is at most 40 px tall', vis0.length >= 3 && vis0.every(l => l.h <= 40), JSON.stringify(l0));
    ok('engine.labels at vision spawn labels stay readable (at least 18 px tall)', vis0.length >= 3 && vis0.every(l => l.h >= 18), JSON.stringify(l0));
    await p.click('.room-toolbar [data-station=method]'); await waitStation(p, 'method');
    await p.waitForTimeout(400);
    const l1 = await labs();
    ok('engine.labels with a panel open the other stations\' labels are hidden', Array.isArray(l1) && l1.filter(l => l.key !== 'method').every(l => !l.visible), JSON.stringify(l1));
    await p.click('.room-panel [data-room-close]'); await p.waitForTimeout(200);
    const l2 = await labs();
    ok('engine.labels closing the panel brings labels back', Array.isArray(l2) && l2.some(l => l.visible), JSON.stringify(l2));
    await p.close();

    // engine.errors
    ok('engine.errors no page or console errors', errs.length === 0, errs.join(' | '));
    ok('engine.errors fixture station views are not blocked', warns.length === 0, warns.join(' | '));
  }
  if (run('look')) {
    // Mean luminance (0..1) of a PNG, decoded by the browser itself (no image library needed).
    const lumaOf = async (p, buf) => p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 240; c.height = Math.round(240 * img.height / img.width);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      return s / (d.length / 4);
    }, buf.toString('base64'));
    const frameMs = p => p.evaluate(() => new Promise(res => { const t = []; const f = now => { t.push(now); if (t.length > 120) res((t[t.length - 1] - t[0]) / (t.length - 1)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
    // Frame time is always logged. SwiftShader: logged only (a software renderer is far too slow for any bound);
    // GPU: only a loose sanity bound.
    const SOFT = process.env.ROOMS_GL === 'swiftshader';
    const TRACKS = (process.env.ROOMS_TRACKS || 'vision,maint,rag,complaints,forecast').split(',');
    for (const track of TRACKS) {
      const w0 = warns.length, e0 = errs.length;
      let p = await fresh('', undefined, track);
      const st = await p.evaluate(() => ({ status: window.__room.status, track: document.querySelector('.room-root').dataset.roomTrack }));
      ok(`look.${track} ready`, st.status === 'ready' && st.track === track, JSON.stringify(st));
      await p.waitForTimeout(600); // photos and textures settle
      const ms = await frameMs(p);
      const calls = await p.evaluate(() => window.__room._debug.info().render.calls);
      console.log(`    ${track}: ${calls} draw calls, mean frame ${ms.toFixed(1)} ms (${(1000 / ms).toFixed(0)} fps)`);
      ok(`look.${track} draw calls between 20 and 600`, calls >= 20 && calls <= 600, String(calls));
      if (!SOFT) ok(`look.${track} mean frame time < 60 ms (sanity bound)`, ms < 60, ms.toFixed(1));
      // Labels at the door: none covers another (the engine lifts a farther label above a nearer one).
      const labs = await p.evaluate(() => window.__room._debug.labels().filter(l => l.visible));
      const clash = [];
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const a = labs[i], b = labs[j]; if (Math.abs(a.x - b.x) * 2 < a.w + b.w - 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h - 2) clash.push(`${a.key}/${b.key}`); }
      ok(`look.${track} station labels at the door do not overlap`, labs.length >= 3 && !clash.length, clash.join(', ') + ' ' + JSON.stringify(labs));
      const shot = await p.screenshot({ path: path.join(SHOTS, `${track}-spawn.png`) });
      const luma = await lumaOf(p, shot);
      console.log(`    ${track}: spawn luminance ${luma.toFixed(3)}`);
      ok(`look.${track} spawn view neither black nor blown out`, luma > 0.2 && luma < 0.8, luma.toFixed(3));
      // Every station is visible from the door and opens on a click at its anchor.
      for (const s of ['brief', 'data', 'method', 'experiment', 'results']) {
        await p.evaluate(() => window.__mount());
        await p.waitForTimeout(150);
        const pt = await p.evaluate(s => window.__room._debug.project(s), s);
        const on = pt && pt[0] > 0 && pt[0] < 1440 && pt[1] > 60 && pt[1] < 900;
        if (on) await p.mouse.click(pt[0], pt[1]);
        const opened = on && await waitStation(p, s);
        ok(`look.${track} ${s} visible from the door and opens on click`, opened, JSON.stringify(pt));
        await p.waitForTimeout(1300);
        await p.screenshot({ path: path.join(SHOTS, `${track}-${s}.png`) });
      }
      await p.close();
      // No data: the room still builds.
      p = await fresh('&nodata=1', undefined, track);
      ok(`look.${track} renders without data`, await p.evaluate(() => window.__room.status) === 'ready');
      await p.close();
      // Reduced motion: nothing moves (conveyor stopped, LEDs steady, glow steady).
      p = await fresh('', undefined, track, { reducedMotion: 'reduce' });
      await p.waitForTimeout(800);
      const a = await p.screenshot(), b = await (p.waitForTimeout(700).then(() => p.screenshot()));
      ok(`look.${track} reduced motion: a still picture`, a.equals(b));
      await p.close();
      ok(`look.${track} no station view blocked`, warns.length === w0, warns.slice(w0).join(' | '));
      ok(`look.${track} no page or console errors`, errs.length === e0, errs.slice(e0).join(' | '));
    }
  }
  if (run('integration')) {
    // The real app, served by the mock Worker server (as in guided.mjs), with the rooms mounted in the lab.
    const IPORT = 8799, IB = `http://127.0.0.1:${IPORT}`, IMOCK = `${IB}/mock`;
    const APP = (q = '') => `${IB}/rybex-ai-workshop.html?ai=${encodeURIComponent(IMOCK)}&i18n=all${q}`;
    const msrv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(IPORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
    // A busy port makes the mock server exit before it prints: fail (the outer catch closes the browser and the 8798 server).
    await new Promise((res, rej) => {
      const t = setTimeout(() => { msrv.kill(); rej(new Error(`mock server on ${IPORT} did not start in 10 s`)); }, 10000);
      msrv.stdout.once('data', () => { clearTimeout(t); res(); });
      msrv.once('exit', c => { clearTimeout(t); rej(new Error(`mock server on ${IPORT} exited (${c}) – port busy?`)); });
      msrv.once('error', e => { clearTimeout(t); rej(e); });
    });
    const ierrs = [], aborted = [];
    const TRACKS = ['vision', 'rag', 'complaints', 'forecast', 'maint'], ST = ['brief', 'data', 'method', 'experiment', 'results'];
    // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
    const app = async (hash = '#/lab/vision', q = '', init = null, vp = { width: 1440, height: 900 }) => {
      const ctx = await browser.newContext({ viewport: vp });
      const p = await ctx.newPage();
      if (init) await p.addInitScript(init);
      p.on('pageerror', e => ierrs.push(`${hash}${q} pageerror: ${e.message}`));
      p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) ierrs.push(`${hash}${q} console: ${m.text()}`); });
      p.on('requestfailed', r => { if (/\/mock\/chat/.test(r.url())) aborted.push(r.failure() && r.failure().errorText); });
      await p.goto(APP(q) + hash);
      await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 15000 });
      return p;
    };
    const roomReady = (p, k) => p.waitForSelector(`#roomHost .room-root[data-room-track="${k}"][data-room-status="ready"]`, { timeout: 15000 }).then(() => true, () => false);
    const station = p => p.evaluate(() => { const r = document.querySelector('#roomHost .room-root'); return r ? r.dataset.roomStation : null; });
    const openSt = (p, s) => p.evaluate(s => X.room.handle.open(s), s);
    // The vision lab gates its run button on the photo set: wait for the app's own state, not a timer.
    // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
    const readyPhotos = q => q.waitForFunction(() => typeof VIS !== 'undefined' && VIS.photoCount >= VIS.expectedPhotoCount, null, { timeout: 60000 }).catch(() => {});
    const inSlot = (p, s, sel) => p.evaluate(([s, sel]) => !!document.querySelector(`#roomHost .room-slot[data-station="${s}"] ${sel}`), [s, sel]);
    const dupIds = p => p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.id] = (c[e.id] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); });
    const seedTeam = (p, fn) => p.evaluate(`(${fn})(); save(); render();`);
    try {
      // integration.mount + integration.panels
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      let p = await app('#/lab/vision');
      for (const k of TRACKS) {
        if (k !== 'vision') await p.evaluate(k => go('lab', k), k);
        const ready = await roomReady(p, k);
        ok(`integration.mount ${k}: room in #roomHost`, ready && await p.evaluate(k => document.querySelectorAll('#roomHost .room-root').length === 1 && document.querySelector('#roomHost .room-root').dataset.roomTrack === k && !document.querySelector('#main .room-root'), k));
        if (!ready) continue;
        ok(`integration.panels ${k}: brief holds #pickTrack`, await inSlot(p, 'brief', '#pickTrack'));
        ok(`integration.panels ${k}: brief holds the five lab steps`, await inSlot(p, 'brief', '#labSteps li[data-step=task]') && await p.evaluate(() => document.querySelectorAll('#roomHost #labSteps li').length === 5));
        ok(`integration.panels ${k}: the build station holds the build card and no choice to make`, await inSlot(p, 'method', '#labBuild li') && !(await inSlot(p, 'method', ':is(input, textarea, select)')));
        // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
        ok(`integration.panels ${k}: experiment holds #proto with its build control and the save button`, await inSlot(p, 'experiment', '#proto') && await inSlot(p, 'experiment', '#sv') && await inSlot(p, 'experiment', { vision: '#visRun', rag: '#ragRun', complaints: '#cRun', forecast: '#fcTrain', maint: '#mtTrain' }[k]));
        ok(`integration.panels ${k}: results holds the saved experiments`, await inSlot(p, 'results', '#labLog'));
        ok(`integration.panels ${k}: nothing of the baseline, the method choice or the comparison in the room`, await p.evaluate(() => !document.querySelector('#runBase, #saveBase, #baseOut, #baseBanner, #methWhy, input[name=meth], #cmpList, #cmpGo') && !/odniesieni|baseline|Porównajcie dwa przebiegi|Compare two runs|Wybór metody/i.test(document.querySelector('#roomHost').textContent + document.querySelector('#main').textContent)));
        ok(`integration.panels ${k}: the station is named Budowa`, await p.evaluate(() => /Budowa/.test(document.querySelector('#roomHost .room-toolbar [data-station=method]').textContent) && !/Metoda/.test(document.querySelector('#roomHost .room-toolbar').textContent)), await p.evaluate(() => document.querySelector('#roomHost .room-toolbar').textContent));
        const data = await p.evaluate(() => { const s = document.querySelector('#roomHost .room-slot[data-station="data"]'); return { thumbs: s.querySelectorAll('.gal .thumb').length, txt: s.textContent, table: !!s.querySelector('table') }; });
        ok(`integration.panels ${k}: data shows the track file`, { vision: data.thumbs >= 200, rag: /PROCES-01/.test(data.txt) && /§1/.test(data.txt), complaints: data.table, forecast: data.table, maint: data.table }[k], JSON.stringify({ ...data, txt: data.txt.slice(0, 80) }));
        const d = await dupIds(p);
        ok(`integration.panels ${k}: no duplicate ids`, d.length === 0, d.join());
        ok(`integration.panels ${k}: lab sections left #main`, await p.evaluate(() => !document.querySelector('#main #labProto') && !document.querySelector('#main #labJump')));
        for (const s of ST) {
          // Start at the top for some stations and slightly scrolled (heading half under the bars) for the others.
          const y0 = ST.indexOf(s) % 2 ? 20 : 0;
          await p.evaluate(y => scrollTo(0, y), y0);
          await openSt(p, s); const still = await settle(p); if (s === 'brief') await p.waitForTimeout(250);
          const vis = await p.evaluate(s => { const sl = document.querySelector(`#roomHost .room-slot[data-station="${s}"]`); return !sl.hidden && sl.getBoundingClientRect().height > 40; }, s);
          ok(`integration.panels ${k}.${s} opens with content`, vis && await station(p) === s);
          ok(`integration.panels ${k}.${s} camera settles after the glide`, still);
          // integration.frame: once the camera stopped, the station's anchor is left of the panel (not behind it). Only x: the
          // anchor is the label point, which can sit above the object (vision QA desk, complaints desk); the shots cover height.
          const fr = await p.evaluate(s => { const a = X.room.handle._debug.project(s), c = document.querySelector('#roomHost canvas').getBoundingClientRect(), pn = document.querySelector('#roomHost .room-panel').getBoundingClientRect(); return { a: a && a.map(Math.round), left: Math.round(c.left), top: Math.round(c.top), bottom: Math.round(c.bottom), pl: Math.round(pn.left) }; }, s);
          ok(`integration.frame ${k}.${s} station in view beside the panel`, fr.a && fr.a[0] > fr.left + 20 && fr.a[0] < fr.pl - 20, JSON.stringify(fr));
          // integration.scroll: the room's top sits right under the sticky bars, the whole room in view.
          // integration.scroll: the whole room in view, its top not under the sticky bars, and the page heading either
          // fully shown or fully scrolled away (never half-cut under the bars).
          const sc = await p.evaluate(() => { const b = roomHost.getBoundingClientRect(), top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 0, h = document.querySelector('#main .page-head').getBoundingClientRect(); return { top: Math.round(b.top), hdr: Math.round(top), bottom: Math.round(b.bottom), ih: innerHeight, ht: Math.round(h.top), hb: Math.round(h.bottom), y: scrollY }; });
          const headOk = sc.ht >= sc.hdr - 1 || sc.hb <= sc.hdr + 1;
          ok(`integration.scroll ${k}.${s} (from y=${y0}) room in view under the sticky bars, heading not half-cut`, sc.top >= sc.hdr - 2 && sc.bottom <= sc.ih + 1 && headOk, JSON.stringify(sc));
          await p.screenshot({ path: path.join(SHOTS, `app-${k}-${s}.png`) });
        }
        await p.evaluate(() => X.room.handle.close());
      }
      // integration.focus: a programmatic open focuses the title quietly (no ring); toolbar buttons keep the ring for the keyboard.
      await openSt(p, 'method');
      const fo = await p.evaluate(() => { const t = document.activeElement, cs = getComputedStyle(t); return { title: t.classList.contains('room-panel-title'), shadow: cs.boxShadow, outline: cs.outlineStyle, deco: cs.textDecorationLine }; });
      ok('integration.focus title focused without the heavy ring', fo.title && fo.shadow === 'none' && fo.outline === 'none' && /underline/.test(fo.deco), JSON.stringify(fo));
      await p.evaluate(() => X.room.handle.close());
      await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
      const fk = await p.evaluate(() => { const t = document.activeElement; return { btn: !!t.closest('#roomHost .room-toolbar'), shadow: getComputedStyle(t).boxShadow }; });
      ok('integration.focus keyboard focus on a toolbar button shows the ring', fk.btn && fk.shadow !== 'none', JSON.stringify(fk));
      // Seen-progress: the data step counts only when the data station opens.
      await seedTeam(p, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'rag'); t.seen.data = false; });
      await p.evaluate(() => go('lab', 'rag')); await roomReady(p, 'rag');
      ok('integration.seen data not counted before the data station opens', await p.evaluate(() => team().seen.data === false));
      await openSt(p, 'data');
      ok('integration.seen data counted once the data station opens', await p.evaluate(() => team().seen.data === true));
      await p.close();

      // integration.photos: on a fresh load the room mounts with the drawn cans; once the real photos arrive the
      // inspection monitor switches to them without a remount.
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      await p.evaluate(() => { window.__cv = document.querySelector('#roomHost canvas'); });
      await p.waitForFunction(() => VIS.status === 'ready', null, { timeout: 20000 }).catch(() => {});
      const ph = await p.waitForFunction(() => { const want = VIS.train.slice(0, 6).map(x => x.url).filter(u => /^data:/.test(u)), r = X.room.handle._debug.room(); return r && want.length === 6 && r.photos.join('|') === want.join('|') && VIS.train.slice(0, 6).every(x => x.source === 'photo') ? { n: r.photos.length } : false; }, null, { timeout: 5000 }).then(h => h.jsonValue(), () => null);
      const ph2 = await p.evaluate(() => ({ status: VIS.status, src: VIS.train.slice(0, 6).map(x => x.source).join(), n: (X.room.handle._debug.room() || { photos: [] }).photos.length, same: window.__cv === document.querySelector('#roomHost canvas') }));
      ok('integration.photos monitor shows the real photo set once loaded', !!ph, JSON.stringify(ph2));
      ok('integration.photos no remount for the photos (same canvas)', ph2.same);
      await openSt(p, 'data'); await settle(p); await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(SHOTS, 'app-vision-photos-data.png') });
      await p.close();

      // integration.result: a trained model gives the same result in the room and on the 2D page.
      const resOf = async q => {
        const b = await app('#/lab/forecast', q);
        await seedTeam(b, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'forecast'); });
        if (!q) { await roomReady(b, 'forecast'); await openSt(b, 'experiment'); }
        const before = await b.evaluate(() => ({ trained: document.querySelector('#fcRes').dataset.trained, recap: !!document.querySelector('#fcRes .recap') }));
        await b.click('#fcTrain');
        await b.waitForSelector('#fcRes[data-trained="true"] .recap', { timeout: 5000 }).catch(() => {});
        const r = await b.evaluate(() => { const o = document.querySelector('#fcRes'); return o ? { v: o.dataset.mape, vis: o.getBoundingClientRect().height > 0, txt: o.querySelector('.recap') ? o.querySelector('.recap').innerText.replace(/\s+/g, ' ').trim() : '', learned: !!document.querySelector('#fcLearnedBox'), steps: [...document.querySelectorAll('#labSteps li')].map(l => l.dataset.done === 'true' ? 1 : 0).join(''), st: (document.querySelector('#roomHost .room-root') || { dataset: {} }).dataset.roomStation } : null; });
        await b.close(); return { ...r, before };
      };
      const b3 = await resOf(''), b2 = await resOf('&rooms=0');
      ok('integration.result nothing is shown before the training, in the room as on the page', b3 && b2 && b3.before.trained === 'false' && !b3.before.recap && b2.before.trained === 'false' && !b2.before.recap, JSON.stringify([b3 && b3.before, b2 && b2.before]));
      ok('integration.result training in the experiment station shows the result there', b3 && b3.vis && b3.st === 'experiment' && b3.learned && Number(b3.v) > 0, JSON.stringify(b3));
      ok('integration.result identical to the 2D page', b3 && b2 && b3.v === b2.v && b3.txt === b2.txt && b3.txt.length > 20, `${b3 && b3.v} vs ${b2 && b2.v}`);
      ok('integration.result the lab steps follow the training in the room too', b3 && b2 && b3.steps === b2.steps && b3.steps[2] === '1', `${b3 && b3.steps} vs ${b2 && b2.steps}`);

      // integration.rerender + integration.typing
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      await p.evaluate(() => { window.__cv = document.querySelector('#roomHost canvas'); });
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await readyPhotos(p);
      await p.click('#roomHost .room-toolbar [data-station="experiment"]');
      await p.waitForFunction(() => document.querySelector('#roomHost .room-root').dataset.roomStation === 'experiment', null, { timeout: PICK_MS }).catch(() => {});
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await p.fill('#vPrompt', 'Oceń puszkę. Odpowiedz JSON.');
      const pos0 = await p.evaluate(() => X.room.handle._debug.cameraPos());
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await p.focus('#vPrompt'); await p.keyboard.press('Control+End'); await p.keyboard.type(' wasd'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
      const pos1 = await p.evaluate(() => X.room.handle._debug.cameraPos());
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      ok('integration.typing WASD in the instruction field does not move the camera', JSON.stringify(pos0) === JSON.stringify(pos1) && (await p.inputValue('#vPrompt')).endsWith(' wasd'), JSON.stringify([pos0, pos1]));
      // A full re-render (choosing the team's task re-renders the page) keeps the room, the station and the typed text.
      await p.evaluate(() => { const b = document.querySelector('#roomHost #pickTrack'); if (b) b.click(); });
      await p.evaluate(() => render());
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      const rr = await p.evaluate(() => ({ st: document.querySelector('#roomHost .room-root').dataset.roomStation, same: document.querySelector('#roomHost canvas') === window.__cv, canv: document.querySelectorAll('#roomHost canvas').length, txt: document.querySelector('#vPrompt').value, saved: lab().vision.draft, track: team().track, inSlot: !!document.querySelector('#roomHost .room-slot[data-station="experiment"] #vPrompt') }));
      ok('integration.rerender station, canvas and the typed instruction kept', rr.st === 'experiment' && rr.same && rr.canv === 1 && rr.inSlot && rr.txt === 'Oceń puszkę. Odpowiedz JSON. wasd', JSON.stringify(rr));
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      ok('integration.rerender the instruction draft and the task choice saved', rr.saved === rr.txt && rr.track === 'vision', JSON.stringify(rr));
      const rd = await dupIds(p);
      ok('integration.rerender no duplicate ids', rd.length === 0, rd.join());
      await p.close();

      // integration.fullscreen: "Otwórz" lays the open panel over the window under the app header; Esc, the same button
      // and every move to another station bring the room back with the panel beside it.
      {
        const f = await app('#/lab/forecast'); await roomReady(f, 'forecast'); await openSt(f, 'experiment');
        const FB = '#roomHost .room-panel [data-room-full]';
        const fs_ = () => f.evaluate(() => { const r = document.querySelector('#roomHost .room-root'), pn = r.querySelector('.room-panel'), b = pn.querySelector('[data-room-full]'), box = pn.getBoundingClientRect(), hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 0;
          return { full: pn.classList.contains('is-full'), attr: r.dataset.roomPanel || 'side', label: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), pos: getComputedStyle(pn).position, top: Math.round(box.top), hdr: Math.round(hdr), left: Math.round(box.left), w: Math.round(box.width), bottom: Math.round(box.bottom), iw: document.documentElement.clientWidth, ih: innerHeight, st: r.dataset.roomStation, wide: getComputedStyle(pn.querySelector('[data-room-wide]')).display }; });
        const s0 = await fs_();
        ok('integration.fullscreen the panel opens beside the room with an "Otwórz" button', !s0.full && s0.attr === 'side' && s0.label === 'Otwórz' && s0.pressed === 'false' && s0.pos !== 'fixed' && s0.w < s0.iw - 100, JSON.stringify(s0));
        await f.click(FB); const s1 = await fs_();
        ok('integration.fullscreen "Otwórz" covers the window under the app header', s1.full && s1.attr === 'full' && s1.pos === 'fixed' && Math.abs(s1.top - s1.hdr) <= 2 && s1.left === 0 && s1.w >= s1.iw - 2 && s1.bottom >= s1.ih - 2 && s1.st === 'experiment', JSON.stringify(s1));
        ok('integration.fullscreen the button now reads "Wróć do pokoju"; the widen control is hidden', s1.label === 'Wróć do pokoju' && s1.pressed === 'true' && s1.wide === 'none', JSON.stringify(s1));
        await f.click('#fcTrain');
        ok('integration.fullscreen the lab works in the full-screen panel (training shows the result there)', await f.evaluate(() => fcTrained() && document.querySelector('#roomHost .room-panel.is-full #fcRes').dataset.trained === 'true' && document.querySelector('#roomHost .room-panel.is-full #fcTable').getBoundingClientRect().width > 0));
        await f.click(FB); const s2 = await fs_();
        ok('integration.fullscreen the same button returns to the room, station kept', !s2.full && s2.attr === 'side' && s2.label === 'Otwórz' && s2.pressed === 'false' && s2.st === 'experiment', JSON.stringify(s2));
        await f.click(FB); await f.keyboard.press('Escape'); const e1 = await fs_(); await f.keyboard.press('Escape'); const e2 = await fs_();
        ok('integration.fullscreen the first Esc only leaves full screen, the second closes the panel', !e1.full && e1.attr === 'side' && e1.st === 'experiment' && e2.st === 'none', JSON.stringify([e1, e2]));
        // Moving on from a full-screen panel: the onward button (it follows the guide), the arrows and the toolbar open
        // another station with the panel beside the room again.
        const stIs = s => f.waitForFunction(s => document.querySelector('#roomHost .room-root').dataset.roomStation === s, s, { timeout: PICK_MS + 3000 }).catch(() => {});
        const stNot = s => f.waitForFunction(s => !['none', s].includes(document.querySelector('#roomHost .room-root').dataset.roomStation), s, { timeout: PICK_MS + 3000 }).catch(() => {});
        await openSt(f, 'brief'); await f.click(FB);
        const hasOn = await f.evaluate(() => { const b = document.querySelector('#roomHost .room-panel [data-room-onward]'); return !!b && b.getBoundingClientRect().width > 0; });
        if (hasOn) { await f.click('#roomHost .room-panel [data-room-onward]'); await stNot('brief'); }
        const o1 = await fs_();
        ok('integration.fullscreen the onward button goes on to another station beside the room', hasOn && !o1.full && o1.attr === 'side' && !['brief', 'none'].includes(o1.st) && o1.label === 'Otwórz', JSON.stringify([hasOn, o1]));
        await openSt(f, 'data'); await f.click(FB); await f.click('#roomHost .room-panel button[data-room-next]'); await stIs('method'); const a1 = await fs_();
        await f.click(FB); await f.click('#roomHost .room-panel button[data-room-prev]'); await stIs('data'); const a2 = await fs_();
        ok('integration.fullscreen the arrows leave full screen for the neighbouring station', !a1.full && a1.attr === 'side' && a1.st === 'method' && !a2.full && a2.attr === 'side' && a2.st === 'data', JSON.stringify([a1, a2]));
        await f.click(FB); await f.evaluate(() => document.querySelector('#roomHost .room-toolbar [data-station="results"]').click()); await stIs('results'); const t1 = await fs_();
        ok('integration.fullscreen a toolbar station button leaves full screen too', !t1.full && t1.attr === 'side' && t1.st === 'results', JSON.stringify(t1));
        await f.click(FB); await f.evaluate(() => X.room.handle.close()); await openSt(f, 'results'); const c1 = await fs_();
        ok('integration.fullscreen a closed panel does not come back full screen', !c1.full && c1.attr === 'side', JSON.stringify(c1));
        await f.click('#langSeg button[data-l="en"]'); await roomReady(f, 'forecast'); await openSt(f, 'experiment');
        const en0 = await fs_(); await f.click(FB); const en1 = await fs_();
        ok('integration.fullscreen English labels', en0.label === 'Open' && en1.label === 'Back to the room' && en1.full, JSON.stringify([en0.label, en1.label]));
        await f.close();
      }

      // integration.airun: a model run survives closing and reopening the panel.
      await fetch(IMOCK + '/reset?delay=350');
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await seedTeam(p, () => { S.ai.code = 'test-code'; });
      await roomReady(p, 'vision'); await openSt(p, 'experiment');
      const a0 = aborted.length;
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await readyPhotos(p);
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await p.click('#visRun');
      const live = await p.waitForFunction(() => !!AIS.run, null, { timeout: 5000 }).then(() => true, () => false);
      await p.evaluate(() => X.room.handle.close()); await p.waitForTimeout(300);
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      const during = await p.evaluate(() => !!AIS.run || !!document.querySelector('#visModelRes[data-ai-run="done"]'));
      await p.click('#roomHost .room-toolbar [data-station="experiment"]');
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      const done = await p.waitForSelector('#visModelRes[data-ai-run="done"]', { timeout: 30000 }).then(() => true, () => false);
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      const out = await p.evaluate(() => { const e = document.querySelector('#visModelRes'); return e ? e.innerText.length : 0; });
      ok('integration.airun run active, survives close, finishes with output', live && during && done && out > 20 && await station(p) === 'experiment', JSON.stringify({ live, during, done, out }));
      ok('integration.airun no request aborted', aborted.length === a0, aborted.slice(a0).join());
      await p.close(); await fetch(IMOCK + '/reset');

      // integration.switch: tracks, language, team, leaving the lab.
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      const one = () => p.evaluate(() => ({ host: document.querySelectorAll('#roomHost canvas.room-canvas').length, all: document.querySelectorAll('canvas.room-canvas').length, roots: document.querySelectorAll('.room-root').length }));
      let sw = true;
      for (const k of ['rag', 'complaints', 'forecast', 'maint', 'vision']) { await p.click(`#trackTabs button[data-k="${k}"]`); if (!await roomReady(p, k)) sw = false; const c = await one(); if (c.host !== 1 || c.all !== 1 || c.roots !== 1) sw = false; }
      ok('integration.switch five track switches: one room each time', sw);
      for (const l of ['en', 'pl']) { await p.click(`#langSeg button[data-l="${l}"]`); await roomReady(p, 'vision'); }
      const lc = await one();
      ok('integration.switch language twice: one room', lc.host === 1 && lc.all === 1 && await p.evaluate(() => document.querySelector('#roomHost .room-btn[data-station="brief"]').textContent.length > 0), JSON.stringify(lc));
      // The team bar is hidden while the room is shown, so the switch is made on the select itself.
      for (const t of ['2', '1']) { await p.evaluate(t => { const s = document.querySelector('#teamSel'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true })); }, t); await roomReady(p, 'vision'); }
      const tc = await one();
      ok('integration.switch team twice: one room', tc.host === 1 && tc.all === 1, JSON.stringify(tc));
      await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForFunction(() => S.view === 'home');
      const hc = await one();
      ok('integration.switch outside the lab: no room, host hidden', hc.all === 0 && hc.roots === 0 && await p.evaluate(() => document.querySelector('#roomHost').hidden && !document.body.classList.contains('in-room')), JSON.stringify(hc));
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await p.evaluate(() => { location.hash = '#/lab/vision'; });
      const back = await roomReady(p, 'vision'), bc = await one();
      ok('integration.switch back in the lab: exactly one room', back && bc.all === 1 && bc.host === 1, JSON.stringify(bc));
      const sd = await dupIds(p);
      ok('integration.switch no duplicate ids', sd.length === 0, sd.join());

      // integration.jump: an action that targets a control inside a closed station opens that station first.
      await p.evaluate(() => X.room.handle.close());
      await seedTeam(p, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'forecast'); t.log = []; t.lab.fc.fit = null; });
      await p.evaluate(() => go('lab', 'forecast')); await roomReady(p, 'forecast'); await openSt(p, 'results');
      // The path bar's action on step 6 presses the training button, which sits in the experiment station.
      await p.evaluate(() => pathFocus('build')); await p.waitForTimeout(200);
      const jp = await p.evaluate(() => ({ st: document.querySelector('#roomHost .room-root').dataset.roomStation, trained: fcTrained(), res: document.querySelector('#roomHost .room-slot[data-station="experiment"] #fcRes').dataset.trained }));
      ok('integration.jump the path action on the build step opens the experiment station and trains the model', jp.st === 'experiment' && jp.trained && jp.res === 'true', JSON.stringify(jp));
      // The reveal gate (vision, no saved experiment yet) sends the focus to the save button: its station opens.
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await seedTeam(p, () => { const t = team(); setTrack(t, 'vision'); t.log = []; });
      await p.evaluate(() => go('lab', 'vision')); await roomReady(p, 'vision'); await openSt(p, 'results');
      await p.evaluate(() => tryReveal('vision', lab().vision, () => {})); await p.waitForTimeout(200);
      const gp = await p.evaluate(() => { const a = document.activeElement; return { st: document.querySelector('#roomHost .room-root').dataset.roomStation, inExp: !!a && !!a.closest('#roomHost .room-slot[data-station="experiment"]'), id: a && (a.id || a.name), revealed: lab().vision.revealed, views: lab().vision.testViews, msg: document.querySelector('#gateMsg').textContent }; });
      ok('integration.jump a blocked reveal opens the experiment station on the save button and reveals nothing', gp.inExp && gp.st === 'experiment' && gp.id === 'sv' && !gp.revealed && gp.views === 0 && /zapiszcie wynik w dzienniku/.test(gp.msg), JSON.stringify(gp));
      await p.close();

      // integration.chrome: in the room the team bar, the page title and the footer are out of the way; the page view has them back.
      {
        // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
        const c = await app('#/lab/vision'); await roomReady(c, 'vision');
        const vis = () => c.evaluate(() => { const shown = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 2; }; const h = document.querySelector('#roomHost').getBoundingClientRect(); return { team: shown('#teamBar'), title: shown('#main .app-title'), foot: document.querySelector('#foot').textContent.trim(), footShown: shown('#foot'), tabs: shown('#trackTabs'), path: shown('#pathBar'), nav: shown('#nav'), fits: h.bottom <= innerHeight + 1 && document.documentElement.scrollHeight <= innerHeight + 1 }; });
        const c1 = await vis();
        ok('integration.chrome room: no team bar, title or footer; menu, path bar and task tabs stay; the room fits the window', !c1.team && !c1.title && !c1.footShown && c1.foot === '' && c1.tabs && c1.path && c1.nav && c1.fits, JSON.stringify(c1));
        await c.click('#roomHost [data-room-2d]'); await c.waitForSelector('#roomOn');
        const c2 = await vis();
        ok('integration.chrome page view: team bar and title are back', c2.team && c2.title && c2.foot === '', JSON.stringify(c2));
        await c.close();
      }

      // integration.guide: past the first walk the guide follows the lab's own progress: every experiment up to the
      // minimum, each one named.
      {
        const c = await app('#/lab/forecast'); await roomReady(c, 'forecast');
        const gs = () => c.evaluate(() => { const r = document.querySelector('#roomHost .room-root'), q = s => r.querySelector(s); return { next: r.dataset.roomNext, guide: q('.room-guide-text').textContent, todo: q('.room-panel-do').textContent, foot: !q('.room-panel-foot').hidden, onward: q('.room-onward').textContent, tag: q('[data-station=experiment] .room-tag').textContent }; });
        const g0 = await gs();
        ok('integration.guide start: the first station is next, the experiment button counts 0/3', g0.next === 'brief' && g0.tag === '0/3', JSON.stringify(g0));
        for (const s of ['brief', 'data', 'method', 'experiment']) await openSt(c, s);
        const g1 = await gs();
        ok('integration.guide experiment station: experiment 1 of 3 first, no onward button while work is left here', g1.next === 'experiment' && /Eksperyment 1 z 3/.test(g1.todo) && !/odniesieni/.test(g1.todo + g1.guide) && !g1.foot, JSON.stringify(g1));
        await c.click('#fcTrain'); await c.click('#sv');
        const g2 = await gs();
        ok('integration.guide first experiment saved: experiment 2 of 3, count 1/3', g2.next === 'experiment' && /Eksperyment 2 z 3/.test(g2.todo) && g2.todo === g2.guide && g2.tag === '1/3', JSON.stringify(g2));
        await c.evaluate(() => { const t = team(), e = t.log[0]; t.log.push({ ...e, id: 'gx1', cfg: { ...e.cfg, h: 9 } }); save(); renderPathBar(); });
        const g3 = await gs();
        ok('integration.guide two experiments saved: experiment 3 of 3, count 2/3', /Eksperyment 3 z 3/.test(g3.todo) && g3.tag === '2/3', JSON.stringify(g3));
        // The walk is kept in the team: a language switch, a reload and a team switch each mount the room again.
        const ws = () => c.evaluate(() => { const r = document.querySelector('#roomHost .room-root'); return { next: r.dataset.roomNext, guide: r.querySelector('.room-guide-text').textContent, done: [...r.querySelectorAll('.room-toolbar .is-done')].map(b => b.dataset.station).join() }; });
        const setTeamSel = async t => { await c.evaluate(t => { const s = document.querySelector('#teamSel'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true })); }, t); await roomReady(c, 'forecast'); };
        await c.click('#langSeg button[data-l="en"]'); await roomReady(c, 'forecast');
        const w1 = await ws();
        ok('integration.guide language switch: the walk goes on (experiment 3 of 3, three stations done)', w1.next === 'experiment' && /Experiment 3 of 3/.test(w1.guide) && w1.done === 'brief,data,method', JSON.stringify(w1));
        await c.click('#langSeg button[data-l="pl"]'); await roomReady(c, 'forecast');
        await c.reload(); await c.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 15000 }); await roomReady(c, 'forecast');
        const w2 = await ws();
        ok('integration.guide reload: the walk goes on', w2.next === 'experiment' && /Eksperyment 3 z 3/.test(w2.guide) && w2.done === 'brief,data,method', JSON.stringify(w2));
        await setTeamSel('2');
        const w3 = await ws();
        ok('integration.guide another team starts its own walk', w3.next === 'brief' && w3.done === '', JSON.stringify(w3));
        await setTeamSel('1');
        const w4 = await ws();
        ok('integration.guide back to the first team: its walk is still there', w4.next === 'experiment' && w4.done === 'brief,data,method', JSON.stringify(w4));
        await openSt(c, 'experiment');
        await openSt(c, 'results');
        const g4 = await gs();
        ok('integration.guide results station early: onward leads back to the experiments', g4.next === 'experiment' && g4.foot && /4\./.test(g4.onward), JSON.stringify(g4));
        await c.evaluate(() => { const t = team(), e = t.log[1]; t.log.push({ ...e, id: 'gx2', cfg: { p: 0, h: 6, w: 4 } }, { ...e, id: 'gx3', cfg: { p: 0, h: 6, w: 5 } }); save(); renderPathBar(); });
        const g5 = await gs();
        ok('integration.guide three experiments saved and compared: nothing is next, the guide says the lab is done', g5.next === 'none' && g5.tag === '3/3' && g5.guide.length > 10, JSON.stringify(g5));
        await c.close();
      }

      // integration.2d: the toolbar 2D button, kept over a reload, and back to the room.
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      await p.click('#roomHost [data-room-2d]');
      const flat = () => p.evaluate(() => ({ host: document.querySelector('#roomHost').hidden, rooms: document.querySelectorAll('.room-root').length, proto: !!document.querySelector('#main #labProto'), jump: !!document.querySelector('#main #labJump'), cls: document.body.classList.contains('in-room'), on: !!document.querySelector('#roomOn'), saved: S.rooms }));
      const f1 = await flat();
      ok('integration.2d toolbar button shows the page view', f1.host && f1.rooms === 0 && f1.proto && f1.jump && !f1.cls && f1.on && f1.saved === false, JSON.stringify(f1));
      await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
      const f2 = await flat();
      ok('integration.2d choice kept after a reload', f2.host && f2.rooms === 0 && f2.proto && f2.on, JSON.stringify(f2));
      await p.click('#roomOn');
      ok('integration.2d the 3D button brings the room back', await roomReady(p, 'vision') && await p.evaluate(() => S.rooms === true && document.body.classList.contains('in-room') && !document.querySelector('#roomHost').hidden));
      await p.close();
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision', '&rooms=0');
      const f3 = await flat();
      ok('integration.2d ?rooms=0 forces the page view', f3.host && f3.rooms === 0 && f3.proto && !f3.on, JSON.stringify(f3));
      await p.close();

      // integration.fallback: no WebGL -> the 2D page with a notice.
      const e0 = ierrs.length;
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision', '', () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
      const fb = await p.evaluate(() => ({ rooms: document.querySelectorAll('.room-root').length, proto: !!document.querySelector('#main #labProto'), note: (document.querySelector('#roomNote') || {}).textContent || '', host: document.querySelector('#roomHost').hidden }));
      ok('integration.fallback no WebGL: 2D page with a notice, no errors', fb.rooms === 0 && fb.proto && fb.host && fb.note.length > 10 && ierrs.length === e0, JSON.stringify(fb) + ierrs.slice(e0).join('|'));
      await p.close();

      // integration.moremetrics: "More metrics" stays open (and closed) across redraws in the room, as on the page (guided.mjs fresh 3).
      const setRange = (p, sel, v) => p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
      p = await app('#/lab/maint');
      if (await roomReady(p, 'maint')) {
        await openSt(p, 'experiment'); await p.click('#mtTrain');
        await p.click('#proto details.more-metrics > summary'); await p.waitForTimeout(50); await setRange(p, '#mt', 2.5); await p.waitForTimeout(50);
        ok('integration.moremetrics stays open across a redraw in the room', await p.$eval('#roomHost #proto details.more-metrics', e => e.open));
        await p.click('#proto details.more-metrics > summary'); await p.waitForTimeout(50); await setRange(p, '#mt', 3); await p.waitForTimeout(50);
        ok('integration.moremetrics stays closed once closed in the room', !(await p.$eval('#roomHost #proto details.more-metrics', e => e.open)));
      } else ok('integration.moremetrics maint room ready', false);
      await p.close();

      // integration.aistop: a run survives closing the panel, and the stop control on the reopened station ends it.
      await fetch(IMOCK + '/reset?delay=400');
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await seedTeam(p, () => { S.ai.code = 'test-code'; });
      await roomReady(p, 'vision'); await openSt(p, 'experiment');
      const s0 = aborted.length;
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await readyPhotos(p);
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      await p.click('#visRun');
      const started = await p.waitForFunction(() => !!AIS.run, null, { timeout: 5000 }).then(() => true, () => false);
      await p.evaluate(() => X.room.handle.close()); await p.waitForTimeout(300);
      const alive = await p.evaluate(() => !!AIS.run);
      await p.click('#roomHost .room-toolbar [data-station="experiment"]');
      await p.waitForFunction(() => document.querySelector('#roomHost .room-root').dataset.roomStation === 'experiment', null, { timeout: PICK_MS }).catch(() => {});
      const stop = p.locator('#roomHost .room-slot[data-station="experiment"] [data-cancel]:visible').first();
      const hasStop = await stop.count() > 0;
      if (hasStop) await stop.click();
      const ended = await p.waitForFunction(() => !AIS.run, null, { timeout: 5000 }).then(() => true, () => false);
      await p.waitForTimeout(300);
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      const st = await p.evaluate(() => ({ run: (document.querySelector('#visModelRes') || { dataset: {} }).dataset.aiRun, station: document.querySelector('#roomHost .room-root').dataset.roomStation }));
      ok('integration.aistop stop on the reopened station ends the run', started && alive && hasStop && ended && st.run !== 'done' && st.station === 'experiment', JSON.stringify({ started, alive, hasStop, ended, ...st }));
      ok('integration.aistop the stopped request is aborted', aborted.slice(s0).some(e => /ABORTED/i.test(e || '')), aborted.slice(s0).join());
      await p.close(); await fetch(IMOCK + '/reset');

      // integration.resize: side panel at 1440x900 -> bottom sheet at 390x844 -> side panel again; the canvas fills the host.
      // VISION-REBUILD: drives or seeds the vision lab built on the language model; to be rewritten for the model trained in the browser.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision'); await openSt(p, 'experiment');
      const geo = () => p.evaluate(() => { const h = document.querySelector('#roomHost').getBoundingClientRect(), c = document.querySelector('#roomHost canvas').getBoundingClientRect(), pn = document.querySelector('#roomHost .room-panel').getBoundingClientRect(); return { hw: Math.round(h.width), hh: Math.round(h.height), cw: Math.round(c.width), ch: Math.round(c.height), pw: Math.round(pn.width), pb: Math.round(h.bottom - pn.bottom), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
      const g1 = await geo();
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
      const g2 = await geo();
      await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(400);
      const g3 = await geo();
      const fills = g => Math.abs(g.cw - g.hw) <= 1 && Math.abs(g.ch - g.hh) <= 1;
      ok('integration.resize desktop: side panel, canvas fills the host', g1.pw <= 562 && g1.pw < g1.hw / 2 && fills(g1), JSON.stringify(g1));
      ok('integration.resize phone: bottom sheet, no horizontal scroll, canvas fills the host', g2.pw === g2.hw && g2.pb <= 1 && g2.sw <= g2.iw && fills(g2), JSON.stringify(g2));
      ok('integration.resize back: side panel, canvas fills the host', g3.pw <= 562 && g3.pw < g3.hw / 2 && fills(g3) && g3.hw === g1.hw, JSON.stringify(g3));
      ok('integration.resize panel stays open', await station(p) === 'experiment');
      await p.close();

      // Mobile: bottom sheet over the room.
      p = await app('#/lab/rag', '', null, { width: 390, height: 844 });
      if (await roomReady(p, 'rag')) { await openSt(p, 'method'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'app-mobile-rag-method.png') }); }
      ok('integration.mobile no horizontal page scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await p.close();
    } finally { msrv.kill(); }
    ok('integration.errors no page or console errors', ierrs.length === 0, ierrs.join(' | '));
  }
  if (run('file')) {
    // The app straight from disk: rooms are classic scripts, so they work on file:// too.
    const FURL = 'file://' + path.join(ROOT, 'rybex-ai-workshop.html');
    const ferrs = [];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => ferrs.push(`pageerror: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) ferrs.push(`console: ${m.text()}`); });
    await p.goto(FURL + '#/lab/rag');
    await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 15000 }).catch(() => {});
    const ready = await p.waitForSelector('#roomHost .room-root[data-room-track="rag"][data-room-status="ready"]', { timeout: 15000 }).then(() => true, () => false);
    ok('file.rag room ready on file://', ready);
    if (ready) {
      await p.evaluate(() => X.room.handle.open('data')); await settle(p);
      const txt = await p.evaluate(() => document.querySelector('#roomHost .room-slot[data-station="data"]').textContent);
      ok('file.rag data station shows PROCES-01', /PROCES-01/.test(txt), txt.slice(0, 120));
      await p.screenshot({ path: path.join(SHOTS, 'file-rag-data.png') });
    }
    // Vision on file://: the photos come from photos.js as data: URLs, and the monitor takes them.
    await p.evaluate(() => go('lab', 'vision'));
    const vr = await p.waitForSelector('#roomHost .room-root[data-room-track="vision"][data-room-status="ready"]', { timeout: 15000 }).then(() => true, () => false);
    await p.waitForFunction(() => VIS.status === 'ready', null, { timeout: 20000 }).catch(() => {});
    const fv = await p.waitForFunction(() => { const r = X.room && X.room.handle._debug.room(); return r && r.photos.length === 6 && VIS.train.slice(0, 6).every(x => x.source === 'photo') && r.photos[0] === VIS.train[0].url; }, null, { timeout: 5000 }).then(() => true, () => false);
    ok('file.vision room ready, monitor shows the bundled photos', vr && fv);
    ok('file.errors no page or console errors', ferrs.length === 0, ferrs.join(' | '));
    await ctx.close();
  }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
