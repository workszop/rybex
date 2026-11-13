// Probes for the workshop presentation. Usage: node tests/presentation.mjs [section...]   (sections: shots, ai)
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
