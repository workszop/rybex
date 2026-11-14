// Keeps the class code out of terminal output and committed images (used by presentation-shots.mjs).
// The secret is passed in by the caller and never logged; every error raised here has a fixed text.

// Removes every occurrence of the secret from a text (for error messages that leave the tool).
export const redact = (text, secret) => secret ? String(text).split(secret).join('[class code]') : String(text);

// Fills a field with the secret. Playwright's errors quote the value (fill("...")), so they are replaced by a fixed message.
export async function fillSecret(page, sel, secret) {
  try { await page.fill(sel, secret, { timeout: 10000 }); }
  catch { throw new Error(`could not type the class code into ${sel} (field missing or not editable)`); }
}

// Masks the field for the rest of the page's life: an injected style survives re-renders that recreate the input as type="text".
export const MASK_CSS = '#aiCode{-webkit-text-security:disc!important}';
export const maskSecretField = page => page.addStyleTag({ content: MASK_CSS });

// Called right before every screenshot: any field that holds the secret must be drawn masked, and no visible text may contain it.
// Throws a fixed message (nothing is written by the caller when this throws).
export async function assertMasked(page, secret) {
  const st = await page.evaluate(() => ({
    text: document.body.innerText,
    fields: [...document.querySelectorAll('input, textarea')].map(e => ({
      v: e.value, masked: e.type === 'password' || getComputedStyle(e).webkitTextSecurity === 'disc' })),
  }));
  if (!secret) return;
  if (st.text.includes(secret)) throw new Error('the class code is visible as page text: no screenshot taken');
  if (st.fields.some(f => f.v.includes(secret) && !f.masked)) throw new Error('a field with the class code is not masked: no screenshot taken');
}
