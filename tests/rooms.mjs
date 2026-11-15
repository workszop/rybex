// Probes for the walk-in 3D rooms. Serves the worktree root itself (port 8798).
// Usage: cd tests && node rooms.mjs [section...]   (sections: engine look integration file)
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

try {
  if (run('engine')) {
    let p = await fresh();
    // engine.mount
    const m = await p.evaluate(() => { const r = document.querySelector('.room-root'); return { track: r.dataset.roomTrack, status: r.dataset.roomStatus, station: r.dataset.roomStation, canvases: r.querySelectorAll('canvas').length, btns: [...r.querySelectorAll('.room-toolbar [data-station]')].map(b => b.dataset.station), calls: window.__room._debug.info().render.calls }; });
    ok('engine.mount data attributes', m.track === 'test' && m.status === 'ready' && m.station === 'none', JSON.stringify(m));
    ok('engine.mount one canvas, five station buttons in order', m.canvases === 1 && m.btns.join() === 'brief,data,method,experiment,results', JSON.stringify(m));
    ok('engine.mount WebGL actually drew something', m.calls > 0, String(m.calls));
    await p.screenshot({ path: path.join(SHOTS, 'fixture.png') });

    // engine.open
    await p.click('.room-toolbar [data-station=method]');
    const opened = await waitStation(p, 'method');
    const o = await p.evaluate(() => { const slots = [...document.querySelectorAll('.room-slot')]; const panel = document.querySelector('.room-panel'); return { vis: slots.filter(s => !s.hidden).map(s => s.dataset.station), hidden: slots.filter(s => s.hidden).length, focus: panel.contains(document.activeElement), role: panel.getAttribute('role'), lab: !!document.getElementById(panel.getAttribute('aria-labelledby')), live: (document.querySelector('.room-live') || {}).textContent || '' }; });
    ok('engine.open toolbar opens the station', opened);
    ok('engine.open only its slot visible, focus inside the dialog', o.vis.join() === 'method' && o.hidden === 4 && o.focus && o.role === 'dialog' && o.lab, JSON.stringify(o));
    ok('engine.open live region names the station', /Method|Metoda/.test(o.live), o.live);
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
      const bar = await p.evaluate(() => ({ brief: document.querySelector('.room-toolbar [data-station=brief]').textContent, data: document.querySelector('.room-toolbar [data-station=data]').textContent, labels: window.__fxLabels }));
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
    const APP = (q = '') => `${IB}/rybex-ai-workshop.html?ai=${encodeURIComponent(IMOCK)}${q}`;
    const msrv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(IPORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise(r => msrv.stdout.once('data', r));
    const ierrs = [], aborted = [];
    const TRACKS = ['vision', 'rag', 'complaints', 'forecast', 'maint'], ST = ['brief', 'data', 'method', 'experiment', 'results'];
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
    const inSlot = (p, s, sel) => p.evaluate(([s, sel]) => !!document.querySelector(`#roomHost .room-slot[data-station="${s}"] ${sel}`), [s, sel]);
    const dupIds = p => p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.id] = (c[e.id] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); });
    const seedTeam = (p, fn) => p.evaluate(`(${fn})(); save(); render();`);
    try {
      // integration.mount + integration.panels
      let p = await app('#/lab/vision');
      for (const k of TRACKS) {
        if (k !== 'vision') await p.evaluate(k => go('lab', k), k);
        const ready = await roomReady(p, k);
        ok(`integration.mount ${k}: room in #roomHost`, ready && await p.evaluate(k => document.querySelectorAll('#roomHost .room-root').length === 1 && document.querySelector('#roomHost .room-root').dataset.roomTrack === k && !document.querySelector('#main .room-root'), k));
        if (!ready) continue;
        ok(`integration.panels ${k}: brief holds #pickTrack`, await inSlot(p, 'brief', '#pickTrack'));
        ok(`integration.panels ${k}: method holds #methWhy`, await inSlot(p, 'method', '#methWhy'));
        ok(`integration.panels ${k}: experiment holds #proto and #runBase`, await inSlot(p, 'experiment', '#proto') && await inSlot(p, 'experiment', '#runBase'));
        ok(`integration.panels ${k}: results holds #cmpList`, await inSlot(p, 'results', '#cmpList'));
        const data = await p.evaluate(() => { const s = document.querySelector('#roomHost .room-slot[data-station="data"]'); return { thumbs: s.querySelectorAll('.gal .thumb').length, txt: s.textContent, table: !!s.querySelector('table') }; });
        ok(`integration.panels ${k}: data shows the track file`, { vision: data.thumbs >= 200, rag: /PROCES-01/.test(data.txt) && /§1/.test(data.txt), complaints: data.table, forecast: data.table, maint: data.table }[k], JSON.stringify({ ...data, txt: data.txt.slice(0, 80) }));
        const d = await dupIds(p);
        ok(`integration.panels ${k}: no duplicate ids`, d.length === 0, d.join());
        ok(`integration.panels ${k}: lab sections left #main`, await p.evaluate(() => !document.querySelector('#main #labProto') && !document.querySelector('#main #labJump')));
        for (const s of ST) {
          await openSt(p, s); await p.waitForTimeout(s === 'brief' ? 400 : 150);
          const vis = await p.evaluate(s => { const sl = document.querySelector(`#roomHost .room-slot[data-station="${s}"]`); return !sl.hidden && sl.getBoundingClientRect().height > 40; }, s);
          ok(`integration.panels ${k}.${s} opens with content`, vis && await station(p) === s);
          await p.screenshot({ path: path.join(SHOTS, `app-${k}-${s}.png`) });
        }
        await p.evaluate(() => X.room.handle.close());
      }
      // Seen-progress: the data step counts only when the data station opens.
      await seedTeam(p, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'rag'); t.seen.data = false; });
      await p.evaluate(() => go('lab', 'rag')); await roomReady(p, 'rag');
      ok('integration.seen data not counted before the data station opens', await p.evaluate(() => team().seen.data === false));
      await openSt(p, 'data');
      ok('integration.seen data counted once the data station opens', await p.evaluate(() => team().seen.data === true));
      await p.close();

      // integration.baseline: same score in the room and on the 2D page.
      const baseOf = async q => {
        const b = await app('#/lab/vision', q);
        await seedTeam(b, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'vision'); });
        if (!q) { await roomReady(b, 'vision'); await openSt(b, 'experiment'); }
        await b.click('#runBase');
        await b.waitForSelector('#baseOut:not([hidden])', { timeout: 5000 }).catch(() => {});
        const r = await b.evaluate(() => { const o = document.querySelector('#baseOut'); return o ? { v: o.dataset.v, vis: !o.hidden && o.getBoundingClientRect().height > 0, txt: o.innerText.replace(/\s+/g, ' ').trim(), st: (document.querySelector('#roomHost .room-root') || { dataset: {} }).dataset.roomStation } : null; });
        await b.close(); return r;
      };
      const b3 = await baseOf(''), b2 = await baseOf('&rooms=0');
      ok('integration.baseline output visible in the experiment station', b3 && b3.vis && b3.st === 'experiment', JSON.stringify(b3));
      ok('integration.baseline score identical to the 2D page', b3 && b2 && b3.v === b2.v && b3.txt === b2.txt, `${b3 && b3.v} vs ${b2 && b2.v}`);

      // integration.rerender + integration.typing
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      await p.evaluate(() => { window.__cv = document.querySelector('#roomHost canvas'); });
      await p.click('#roomHost .room-toolbar [data-station="method"]');
      await p.waitForFunction(() => document.querySelector('#roomHost .room-root').dataset.roomStation === 'method', null, { timeout: PICK_MS }).catch(() => {});
      await p.check('#roomHost input[name=meth][value="0"]');
      await p.fill('#methWhy', 'Reguły są tanie i wystarczą na start.');
      const pos0 = await p.evaluate(() => X.room.handle._debug.cameraPos());
      await p.focus('#methWhy'); await p.keyboard.press('End'); await p.keyboard.type(' wasd'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
      const pos1 = await p.evaluate(() => X.room.handle._debug.cameraPos());
      ok('integration.typing WASD in #methWhy does not move the camera', JSON.stringify(pos0) === JSON.stringify(pos1) && (await p.inputValue('#methWhy')).endsWith(' wasd'), JSON.stringify([pos0, pos1]));
      // A full re-render (choosing the team's task re-renders the page) keeps the room, the station and the typed text.
      await p.click('#roomHost #pickTrack').catch(() => {});
      await p.evaluate(() => render());
      const rr = await p.evaluate(() => ({ st: document.querySelector('#roomHost .room-root').dataset.roomStation, same: document.querySelector('#roomHost canvas') === window.__cv, canv: document.querySelectorAll('#roomHost canvas').length, why: document.querySelector('#methWhy').value, saved: team().decision.vision && team().decision.vision.why, m: team().decision.vision && team().decision.vision.m, inSlot: !!document.querySelector('#roomHost .room-slot[data-station="method"] #methWhy') }));
      ok('integration.rerender station, canvas and justification kept', rr.st === 'method' && rr.same && rr.canv === 1 && rr.inSlot && rr.why === 'Reguły są tanie i wystarczą na start. wasd', JSON.stringify(rr));
      ok('integration.rerender justification and method saved', rr.saved === rr.why && rr.m === 0, JSON.stringify(rr));
      const rd = await dupIds(p);
      ok('integration.rerender no duplicate ids', rd.length === 0, rd.join());
      await p.close();

      // integration.airun: a model run survives closing and reopening the panel.
      await fetch(IMOCK + '/reset?delay=350');
      p = await app('#/lab/vision');
      await seedTeam(p, () => { S.ai.code = 'test-code'; lab().vision.method = 'llm'; });
      await roomReady(p, 'vision'); await openSt(p, 'experiment');
      const a0 = aborted.length;
      await p.click('#visRun');
      const live = await p.waitForFunction(() => !!AIS.run, null, { timeout: 5000 }).then(() => true, () => false);
      await p.evaluate(() => X.room.handle.close()); await p.waitForTimeout(300);
      const during = await p.evaluate(() => !!AIS.run || !!document.querySelector('#visModelRes[data-ai-run="done"]'));
      await p.click('#roomHost .room-toolbar [data-station="experiment"]');
      const done = await p.waitForSelector('#visModelRes[data-ai-run="done"]', { timeout: 30000 }).then(() => true, () => false);
      const out = await p.evaluate(() => { const e = document.querySelector('#visModelRes'); return e ? e.innerText.length : 0; });
      ok('integration.airun run active, survives close, finishes with output', live && during && done && out > 20 && await station(p) === 'experiment', JSON.stringify({ live, during, done, out }));
      ok('integration.airun no request aborted', aborted.length === a0, aborted.slice(a0).join());
      await p.close(); await fetch(IMOCK + '/reset');

      // integration.switch: tracks, language, team, leaving the lab.
      p = await app('#/lab/vision');
      await roomReady(p, 'vision');
      const one = () => p.evaluate(() => ({ host: document.querySelectorAll('#roomHost canvas.room-canvas').length, all: document.querySelectorAll('canvas.room-canvas').length, roots: document.querySelectorAll('.room-root').length }));
      let sw = true;
      for (const k of ['rag', 'complaints', 'forecast', 'maint', 'vision']) { await p.click(`#trackTabs button[data-k="${k}"]`); if (!await roomReady(p, k)) sw = false; const c = await one(); if (c.host !== 1 || c.all !== 1 || c.roots !== 1) sw = false; }
      ok('integration.switch five track switches: one room each time', sw);
      for (const l of ['en', 'pl']) { await p.click(`#langSeg button[data-l="${l}"]`); await roomReady(p, 'vision'); }
      const lc = await one();
      ok('integration.switch language twice: one room', lc.host === 1 && lc.all === 1 && await p.evaluate(() => document.querySelector('#roomHost .room-btn[data-station="brief"]').textContent.length > 0), JSON.stringify(lc));
      for (const t of ['2', '1']) { await p.selectOption('#teamSel', t); await roomReady(p, 'vision'); }
      const tc = await one();
      ok('integration.switch team twice: one room', tc.host === 1 && tc.all === 1, JSON.stringify(tc));
      await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForFunction(() => S.view === 'home');
      const hc = await one();
      ok('integration.switch outside the lab: no room, host hidden', hc.all === 0 && hc.roots === 0 && await p.evaluate(() => document.querySelector('#roomHost').hidden && !document.body.classList.contains('in-room')), JSON.stringify(hc));
      await p.evaluate(() => { location.hash = '#/lab/vision'; });
      const back = await roomReady(p, 'vision'), bc = await one();
      ok('integration.switch back in the lab: exactly one room', back && bc.all === 1 && bc.host === 1, JSON.stringify(bc));
      const sd = await dupIds(p);
      ok('integration.switch no duplicate ids', sd.length === 0, sd.join());

      // integration.jump: links that target the method section open the method station and focus the target.
      await p.evaluate(() => X.room.handle.close());
      await seedTeam(p, () => { const t = team(); t.name = 'Szprot'; setTrack(t, 'forecast'); t.decision = {}; });
      await p.evaluate(() => go('deliver'));
      await p.waitForSelector('#delivGaps [data-gap="meth"], #delivGaps [data-gap="why"]', { timeout: 5000 }).catch(() => {});
      await p.click('#delivGaps [data-gap="meth"], #delivGaps [data-gap="why"]').catch(() => {});
      await roomReady(p, 'forecast');
      const jp = await p.evaluate(() => { const a = document.activeElement; return { st: document.querySelector('#roomHost .room-root').dataset.roomStation, focus: a && (a.id || a.name), inMeth: !!a && !!a.closest('#roomHost .room-slot[data-station="method"]') }; });
      ok('integration.jump gaps link opens the method station and focuses its field', jp.st === 'method' && jp.inMeth, JSON.stringify(jp));
      // The reveal gate (vision, no method chosen) sends the focus to the method choice: that station opens.
      await seedTeam(p, () => { const t = team(); setTrack(t, 'vision'); t.decision = {}; });
      await p.evaluate(() => go('lab', 'vision')); await roomReady(p, 'vision'); await openSt(p, 'experiment');
      // Baseline run and saved, so the gate's next need is the method choice.
      await p.click('#runBase'); await p.click('#saveBase').catch(() => {});
      const rv = await p.$('#roomHost [data-reveal="vision"]');
      if (rv) await rv.click();
      const gp = await p.evaluate(() => { const a = document.activeElement; return { st: document.querySelector('#roomHost .room-root').dataset.roomStation, inMeth: !!a && !!a.closest('#roomHost .room-slot[data-station="method"]'), id: a && (a.id || a.name) }; });
      ok('integration.jump reveal gate opens the method station', !!rv && gp.inMeth && gp.st === 'method', JSON.stringify(gp));
      await p.close();

      // integration.2d: the toolbar 2D button, kept over a reload, and back to the room.
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
      p = await app('#/lab/vision', '&rooms=0');
      const f3 = await flat();
      ok('integration.2d ?rooms=0 forces the page view', f3.host && f3.rooms === 0 && f3.proto && !f3.on, JSON.stringify(f3));
      await p.close();

      // integration.fallback: no WebGL -> the 2D page with a notice.
      const e0 = ierrs.length;
      p = await app('#/lab/vision', '', () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
      const fb = await p.evaluate(() => ({ rooms: document.querySelectorAll('.room-root').length, proto: !!document.querySelector('#main #labProto'), note: (document.querySelector('#roomNote') || {}).textContent || '', host: document.querySelector('#roomHost').hidden }));
      ok('integration.fallback no WebGL: 2D page with a notice, no errors', fb.rooms === 0 && fb.proto && fb.host && fb.note.length > 10 && ierrs.length === e0, JSON.stringify(fb) + ierrs.slice(e0).join('|'));
      await p.close();

      // Mobile: bottom sheet over the room.
      p = await app('#/lab/rag', '', null, { width: 390, height: 844 });
      if (await roomReady(p, 'rag')) { await openSt(p, 'method'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'app-mobile-rag-method.png') }); }
      ok('integration.mobile no horizontal page scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await p.close();
    } finally { msrv.kill(); }
    ok('integration.errors no page or console errors', ierrs.length === 0, ierrs.join(' | '));
  }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
