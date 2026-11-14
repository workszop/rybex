// Probes for the workshop presentation. Usage: node tests/presentation.mjs [section...]   (sections: shots, ai, deck, facts)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'presentation');
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

const BASE_IDS = ['site-home', 'site-news', 'start', 'path-bar', 'cycle', 'brief-memo', 'data', 'demos', 'baseline', 'test-reveal', 'risk', 'golive', 'arch', 'report-gaps', 'badges', 'example', 'team-file'];

if (run('shots')) {
  const mf = path.join(DIR, 'manifest.json');
  const exists = fs.existsSync(mf);
  ok('shots manifest exists', exists, mf);
  if (exists) {
    const text = fs.readFileSync(mf, 'utf8'), m = JSON.parse(text), shots = Array.isArray(m.shots) ? m.shots : [];
    ok('shots commit is 7+ hex chars', /^[0-9a-f]{7,}$/.test(m.commit || ''), String(m.commit));
    ok('shots no class code in the manifest', !process.env.CC || !text.includes(process.env.CC));
    for (const id of BASE_IDS) {
      const s = shots.find(x => x.id === id);
      ok(`shot ${id} listed`, !!s);
      if (!s) continue;
      const f = path.join(DIR, s.file || 'missing');
      const have = fs.existsSync(f), buf = have ? fs.readFileSync(f) : Buffer.alloc(0);
      ok(`shot ${id} file is WebP over 15 kB`, have && buf.length > 15000 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP', `${s.file} ${buf.length} B`);
      ok(`shot ${id} alt text present`, typeof s.alt === 'string' && s.alt.trim().length > 0);
      ok(`shot ${id} not marked AI`, s.ai === false);
      if (s.full) ok(`shot ${id} full viewport is 2880x1800`, s.w === 2880 && s.h === 1800, `${s.w}x${s.h}`);
    }
    ok('shots every entry has file, size and alt', shots.every(s => s.file && s.w > 0 && s.h > 0 && s.alt && typeof s.full === 'boolean'));
  }
}
if (run('ai')) {
  const { spawnSync } = await import('node:child_process');
  const mf = path.join(DIR, 'manifest.json');
  const m = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : { shots: [] };
  const AI = { 'ai-run': true, 'ai-bar': false };   // id -> full viewport?
  const fileOf = id => path.join(DIR, id + '.webp');
  for (const [id, full] of Object.entries(AI)) {
    const s = (m.shots || []).find(x => x.id === id);
    ok(`ai ${id} listed`, !!s);
    if (!s) continue;
    const have = fs.existsSync(path.join(DIR, s.file || 'missing')), buf = have ? fs.readFileSync(path.join(DIR, s.file)) : Buffer.alloc(0);
    ok(`ai ${id} file is WebP over 15 kB`, have && buf.length > 15000 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP', `${s.file} ${buf.length} B`);
    ok(`ai ${id} marked AI`, s.ai === true);
    ok(`ai ${id} alt text present`, typeof s.alt === 'string' && s.alt.trim().length > 0);
    ok(`ai ${id} full flag is ${full}`, s.full === full);
    if (full) ok(`ai ${id} full viewport is 2880x1800`, s.w === 2880 && s.h === 1800, `${s.w}x${s.h}`);
  }
  ok('ai no class code in the manifest', !process.env.CC || !fs.readFileSync(mf, 'utf8').includes(process.env.CC));
  // Guard: a wrong code must fail loudly and leave the existing images untouched.
  const before = Object.keys(AI).map(id => fs.existsSync(fileOf(id)) ? fs.readFileSync(fileOf(id)) : null);
  const r = spawnSync('node', [path.join(ROOT, 'tools', 'presentation-shots.mjs'), 'ai'], { cwd: ROOT, env: { ...process.env, CC: 'wrong-code' }, encoding: 'utf8', timeout: 120000 });
  ok('ai wrong code exits non-zero', r.status !== 0 && r.status !== null, 'status ' + r.status);
  ok('ai wrong code prints the refusal', /class server refused the code/.test((r.stdout || '') + (r.stderr || '')));
  const after = Object.keys(AI).map(id => fs.existsSync(fileOf(id)) ? fs.readFileSync(fileOf(id)) : null);
  ok('ai wrong code leaves the images byte-identical', before.every((b, i) => (b === null && after[i] === null) || (b && after[i] && b.equals(after[i]))));
  const r2 = spawnSync('node', [path.join(ROOT, 'tools', 'presentation-shots.mjs'), 'ai'], { cwd: ROOT, env: { ...process.env, CC: '' }, encoding: 'utf8', timeout: 30000 });
  ok('ai missing code exits non-zero', r2.status !== 0);
}
if (run('deck')) {
  const { spawn } = await import('node:child_process');
  const { chromium } = await import('./node_modules/playwright/index.mjs');
  const PORT = 8795, URL_ = `http://127.0.0.1:${PORT}/prezentacja.html`;
  const mfp = path.join(DIR, 'manifest.json');
  const ids = new Set((fs.existsSync(mfp) ? JSON.parse(fs.readFileSync(mfp, 'utf8')).shots : []).map(s => s.id));
  const srv = spawn('node', [path.join(ROOT, 'tests', 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.once('data', r));
  let browser;
  try {
    browser = await chromium.launch();
    ok('deck file exists', fs.existsSync(path.join(ROOT, 'prezentacja.html')));
    const open = async (vp, block) => {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(String(e)));
      if (block) await page.route(/qrcode/, r => r.abort());
      await page.goto(URL_, { waitUntil: 'load' });
      await page.waitForSelector('html.deck-ready', { timeout: 15000 });
      return { ctx, page, errors };
    };
    const A = await open({ width: 1920, height: 1080 });
    const { page } = A;
    const info = await page.evaluate(() => ({
      total: window.Reveal ? Reveal.getTotalSlides() : -1,
      slides: document.querySelectorAll('[data-slide]').length,
      noNotes: [...document.querySelectorAll('[data-slide]')].filter(s => !((s.querySelector('aside.notes') || {}).textContent || '').trim()).map(s => s.dataset.slide),
      notes: !!(window.Reveal && Reveal.getPlugin('notes')),
      shots: [...document.querySelectorAll('img[data-shot]')].map(i => ({ id: i.dataset.shot, alt: (i.alt || '').trim(), src: i.getAttribute('src') })),
      qrSlide: (document.querySelector('#qr') || { closest: () => null }).closest('[data-slide]')?.dataset.slide,
    }));
    ok('deck reaches deck-ready', true);
    ok('deck no console errors', A.errors.length === 0, A.errors.join(' | '));
    ok('deck slide count matches [data-slide] and is >= 26', info.total === info.slides && info.slides >= 26, `${info.total} vs ${info.slides}`);
    ok('deck every slide has non-empty notes', info.noNotes.length === 0, info.noNotes.join(','));
    ok('deck notes plugin registered', info.notes);
    ok('deck has screenshots', info.shots.length >= 18, String(info.shots.length));
    ok('deck shot ids are in the manifest and alts present', info.shots.every(s => ids.has(s.id) && s.alt && s.src === `assets/presentation/${s.id}.webp`), JSON.stringify(info.shots.filter(s => !ids.has(s.id) || !s.alt)));
    const loaded = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('img[data-shot]')];
      imgs.forEach(i => { i.loading = 'eager'; });
      await Promise.all(imgs.map(i => i.decode().catch(() => null)));
      return imgs.filter(i => !(i.naturalWidth > 0)).map(i => i.dataset.shot);
    });
    ok('deck every screenshot loads (naturalWidth > 0)', loaded.length === 0, loaded.join(','));
    ok('deck QR target is in a slide and prints the URL', await page.evaluate(() => { const q = document.querySelector('#qr'); const u = q && q.dataset.url; return !!u && q.closest('[data-slide]').textContent.includes(u); }));
    await A.ctx.close();
    for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
      const C = await open(vp);
      const bad = await C.page.evaluate(async () => {
        const out = [], n = Reveal.getTotalSlides();
        for (let i = 0; i < n; i++) {
          Reveal.slide(i); Reveal.configure({ transition: 'none' });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const s = Reveal.getCurrentSlide();
          const imgs = [...s.querySelectorAll('img')];
          await Promise.all(imgs.map(im => im.decode().catch(() => null)));
          const kids = [...s.children].filter(c => c.tagName !== 'ASIDE');
          const sb = s.getBoundingClientRect();
          const spill = kids.some(c => { const r = c.getBoundingClientRect(); return r.bottom > sb.bottom + 1 || r.right > sb.right + 1; });
          if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1 || spill) out.push(`${s.dataset.slide} ${s.scrollHeight}>${s.clientHeight}`);
        }
        return out;
      });
      ok(`deck no slide overflows at ${vp.width}x${vp.height}`, bad.length === 0, bad.join('; '));
      await C.ctx.close();
    }
    const B = await open({ width: 1920, height: 1080 }, true);
    const vis = await B.page.evaluate(async () => {
      const q = document.querySelector('#qr'), sl = q.closest('[data-slide]');
      Reveal.slide(...Object.values(Reveal.getIndices(sl)).slice(0, 2));
      await new Promise(r => setTimeout(r, 300));
      const url = q.dataset.url, el = [...sl.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.includes(url));
      const r = el && el.getBoundingClientRect();
      return { shown: !!el && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden', current: Reveal.getCurrentSlide() === sl, hasQr: !!q.querySelector('svg') };
    });
    // Legibility floor: a screenshot exists to be read, so at 1920x1080 each one is at least 260 px tall or 900 px wide
    // (wide strips such as path-bar and team-file pass by width).
    const L = await open({ width: 1920, height: 1080 });
    const small = await L.page.evaluate(async () => {
      const out = [], n = Reveal.getTotalSlides();
      Reveal.configure({ transition: 'none' });
      for (let i = 0; i < n; i++) {
        Reveal.slide(i);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const s = Reveal.getCurrentSlide();
        for (const im of s.querySelectorAll('img[data-shot]')) {
          await im.decode().catch(() => null);
          const r = im.getBoundingClientRect();
          if (!(r.height >= 260 || r.width >= 900)) out.push(`${i + 1} ${im.dataset.shot} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    ok('deck every screenshot is at least 260 px tall or 900 px wide at 1920x1080', small.length === 0, small.join('; '));
    await L.ctx.close();
    ok('deck URL text visible on the QR slide with the qrcode request blocked', vis.shown && vis.current && !vis.hasQr, JSON.stringify(vis));
    ok('deck blocked qrcode leaves no page errors besides the failed request', !B.errors.some(e => /ReferenceError|TypeError/.test(e)), B.errors.join(' | '));
    await B.ctx.close();
  } catch (e) { ok('deck probe ran', false, String(e && e.message)); }
  finally { if (browser) await browser.close(); srv.kill(); }
}
if (run('facts')) {
  // Every fact on a slide comes from the app: step names and minutes, task names, badge count, memo senders.
  const { spawn, execFileSync } = await import('node:child_process');
  const { chromium } = await import('./node_modules/playwright/index.mjs');
  const PORT = 8794, BASE = `http://127.0.0.1:${PORT}`;
  const srv = spawn('node', [path.join(ROOT, 'tests', 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.once('data', r));
  let browser;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const app = await ctx.newPage();
    await app.goto(`${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(BASE + '/mock')}`, { waitUntil: 'load' });
    await app.waitForFunction(() => typeof PATH_STEPS === 'function' && typeof trMeta === 'function');
    const A = await app.evaluate(() => {
      S.lang = 'pl';
      return {
        steps: PATH_STEPS().map(s => ({ id: s.id, label: s.label, min: s.min })),
        tracks: Object.fromEntries(Object.entries(trMeta()).map(([k, v]) => [k, v.title])),
        badges: BADGES().length,
        senders: [...new Set(Object.values(TASK_MEMOS()).map(m => m.sender.split(',')[0].trim()))],
      };
    });
    const deck = await ctx.newPage();
    await deck.goto(`${BASE}/prezentacja.html`, { waitUntil: 'load' });
    await deck.waitForSelector('html.deck-ready', { timeout: 15000 });
    const D = await deck.evaluate(() => {
      const sl = [...document.querySelectorAll('.slides > section[data-slide]')];
      const txt = e => (e ? e.textContent : '').replace(/\s+/g, ' ');
      const bySlide = k => sl.find(s => s.dataset.slide === k);
      const tot = bySlide('path') && bySlide('path').querySelector('[data-total]');
      return {
        steps: sl.filter(s => s.dataset.step).map(s => ({ id: s.dataset.step, min: s.dataset.min, h: txt(s.querySelector('h2')) })),
        tracks: [...document.querySelectorAll('[data-track]')].map(e => ({ k: e.dataset.track, t: txt(e) })),
        total: tot ? tot.dataset.total : null, totalText: txt(tot),
        pathItems: [...document.querySelectorAll('[data-slide=path] [data-path-step]')].map(e => ({ id: e.dataset.pathStep, min: e.dataset.min, t: txt(e) })),
        recap: txt(bySlide('recap')),
        badges: txt(bySlide('badges')), memos: txt(bySlide('memos')),
        fills: [...document.querySelectorAll('.fill')].map(f => ({ n: sl.indexOf(f.closest('section[data-slide]')) + 1, t: txt(f) })),
      };
    });
    const html = fs.readFileSync(path.join(ROOT, 'prezentacja.html'), 'utf8');
    ok('facts app exposes nine steps', A.steps.length === 9, String(A.steps.length));
    for (const s of A.steps) {
      const d = D.steps.find(x => x.id === s.id);
      ok(`facts step ${s.id} has a slide`, !!d);
      if (!d) continue;
      ok(`facts step ${s.id} heading names „${s.label}”`, d.h.includes(s.label), d.h);
      ok(`facts step ${s.id} data-min is ${s.min}`, +d.min === s.min, String(d.min));
      const p = D.pathItems.find(x => x.id === s.id);
      ok(`facts path diagram shows ${s.id} with ${s.min} min`, !!p && p.t.includes(s.label) && +p.min === s.min && p.t.includes(`${s.min} min`), JSON.stringify(p));
      ok(`facts recap names ${s.id}`, D.recap.includes(s.label));
    }
    ok('facts step slides run in path order', D.steps.map(x => x.id).join() === A.steps.map(x => x.id).join(), D.steps.map(x => x.id).join());
    const sum = A.steps.reduce((a, s) => a + s.min, 0);
    ok(`facts path total is the sum of minutes (${sum})`, +D.total === sum, String(D.total));
    const hm = `${Math.floor(sum / 60)} h ${sum % 60} min`;
    ok(`facts path total shows „${hm}”`, D.totalText.includes(hm), D.totalText);
    for (const [k, title] of Object.entries(A.tracks)) {
      const items = D.tracks.filter(x => x.k === k);
      ok(`facts track ${k} listed with „${title}”`, items.length > 0 && items.every(x => x.t.includes(title)), JSON.stringify(items));
    }
    ok('facts no unknown data-track keys', D.tracks.every(x => x.k in A.tracks));
    ok(`facts badges slide states ${A.badges}`, new RegExp(`(^|\\D)${A.badges}(\\D|$)`).test(D.badges), D.badges.slice(0, 120));
    for (const name of A.senders) ok(`facts memo slide names ${name}`, D.memos.includes(name));
    ok('facts no em-dash in the deck', !html.includes(String.fromCharCode(0x2014)));
    ok('facts four placeholders left for the facilitator', D.fills.length === 4, String(D.fills.length));
    console.log('  INFO placeholders:'); D.fills.forEach(f => console.log(`    slide ${f.n}: ${f.t}`));
    const mf = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
    let head = '';
    try { head = execFileSync('git', ['log', '-1', '--format=%h', '--', 'rybex-ai-workshop.html'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* no git */ }
    if (head && !head.startsWith(mf.commit) && !mf.commit.startsWith(head)) console.log(`  WARN screenshots are from ${mf.commit}, the app was last changed in ${head}: retake them if the UI moved`);
    else console.log(`  INFO screenshots match the app commit (${mf.commit})`);
  } catch (e) { ok('facts probe ran', false, String(e && e.message)); }
  finally { if (browser) await browser.close(); srv.kill(); }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
