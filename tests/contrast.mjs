// In-page WCAG contrast walker, shared by tests/guided.mjs (section a11y) and ux-audit/regression.mjs (site frame).
// Run it with page.evaluate(lowContrast, { root, strict }): every visible text node under `root` is checked against the
// first opaque background up the tree. Normal text needs 4.5:1, large text (24 px, or 18.66 px bold) 3:1; strict asks
// 4.5:1 of all text and checks disabled controls too; otherwise disabled controls are exempt (WCAG 1.4.3). Returns "text ratio" strings for the failures.
export const lowContrast = ({ root = 'body', strict = false } = {}) => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number), lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const bg = e => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > .9) return c; } return [255, 255, 255]; };
  const bad = []; const w = document.createTreeWalker(document.querySelector(root), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const e = n.parentElement; if (!n.textContent.trim() || !e.offsetHeight || e.closest('[aria-hidden=true]') || (!strict && e.closest(':disabled,[aria-disabled=true]'))) continue;
    const s = getComputedStyle(e), px = parseFloat(s.fontSize), large = !strict && (px >= 24 || (px >= 18.66 && +s.fontWeight >= 700));
    const a = lum(rgb(s.color)), b = lum(bg(e)), r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (r < (large ? 3 : 4.5)) bad.push(n.textContent.trim().slice(0, 30) + ' ' + r.toFixed(2)); }
  return bad; };
