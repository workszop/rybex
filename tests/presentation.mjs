// Probes for the workshop presentation. Usage: node tests/presentation.mjs [section...]   (sections: shots)
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
