// UI smoke test against the SIMULATED engine (no model runs). Builds must exist
// (`npm run build`). Run: npm run e2e
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  try {
    ok = (await fetch(BASE)).ok;
  } catch {
    await wait(250);
  }
}
assert.ok(ok, 'preview server did not start');

const browser = await chromium.launch();
const errors = [];
const results = [];
async function step(name, fn) {
  await fn();
  results.push(`ok - ${name}`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await step('full flow with simulated Nano: read → review → cloud draft → letter restored locally', async () => {
    await page.goto(`${BASE}?engine=sim`);
    await page.getByText('SIMULATED ENGINE').waitFor();
    await page.getByRole('button', { name: /MRI denied/ }).click();
    await page.getByRole('button', { name: 'Read it on this device' }).click();
    await page.getByText('Check what leaves your device').waitFor();
    const outgoing = await page.locator('pre.outgoing').first().innerText();
    assert.ok(!outgoing.includes('Gonzalez') && !outgoing.includes('NWH448812901'), 'identity in outgoing text');
    assert.match(await page.locator('.gate').innerText(), /passed/);
    assert.match(await page.locator('.deadline').first().innerText(), /April 26, 2027/);
    await page.getByRole('button', { name: 'Send the hidden version to Gemini' }).click();
    await page.getByText('Your appeal letter').waitFor();
    const letter = await page.getByLabel('Appeal letter').inputValue();
    assert.ok(letter.includes('NWH448812901'), 'member ID not restored locally');
    assert.ok(!/\[(PERSON|MEMBER_ID|CLAIM_ID)_\d+\]/.test(letter), 'unresolved placeholder in letter');
    assert.match(await page.locator('.ledger').innerText(), /PREFER_IN_CLOUD/);
  });

  await step('select-to-hide and undo update the outgoing text', async () => {
    await page.goto(`${BASE}?engine=sim&device=unavailable`);
    await page.getByRole('button', { name: /bariatric/ }).click();
    await page.getByRole('button', { name: /Hide my details/ }).click();
    await page.getByText('Check what leaves your device').waitFor();
    // Select the word "Concord" in the original letter.
    await page.evaluate(() => {
      const pre = document.querySelector('pre.letter:not(.outgoing)');
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const i = n.textContent.indexOf('Concord');
        if (i >= 0) {
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + 7);
          getSelection().removeAllRanges();
          getSelection().addRange(r);
          pre.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          return;
        }
      }
    });
    await page.getByRole('button', { name: /Hide “Concord/ }).click();
    assert.ok(!(await page.locator('pre.outgoing').first().innerText()).includes('Concord'));
    await page.getByRole('button', { name: /Show “Concord” again/ }).click();
    assert.ok((await page.locator('pre.outgoing').first().innerText()).includes('Concord'));
  });

  await step('no-Nano path: offline draft disabled, template letter works, nothing marked cloud', async () => {
    assert.ok(await page.getByRole('button', { name: /Stay offline/ }).isDisabled());
    await page.getByRole('button', { name: /template letter/ }).click();
    await page.getByText('Your appeal letter').waitFor();
    // Without Gemini Nano the template has blanks; the app says to fill them in.
    await page.getByText(/Fill in every ____ before you send it/).waitFor();
    const ledger = await page.locator('.ledger').innerText();
    assert.ok(!ledger.includes('PREFER_IN_CLOUD'), 'a cloud step appears in the ledger');
    assert.match(ledger, /No part of your letter has left this device/);
  });

  await step('type-to-hide works from the keyboard, and Start over clears the letter', async () => {
    await page.goto(`${BASE}?engine=sim&device=unavailable`);
    await page.getByRole('button', { name: /bariatric/ }).click();
    await page.getByRole('button', { name: /Hide my details/ }).click();
    await page.getByText('Check what leaves your device').waitFor();
    await page.getByLabel('Type a word or name from your letter to hide it').fill('Concord');
    await page.keyboard.press('Enter');
    assert.ok(!(await page.locator('pre.outgoing').first().innerText()).includes('Concord'));
    await page.getByRole('button', { name: 'Start over' }).click();
    assert.equal(await page.locator('#letter').inputValue(), '', 'old letter still in the box');
  });

  await step('Nano downloadable: offers rules-only now or a one-time download', async () => {
    await page.goto(`${BASE}?engine=sim&device=downloadable`);
    await page.getByRole('button', { name: /MRI denied/ }).click();
    await page.getByRole('button', { name: /Download Gemini Nano/ }).waitFor();
    await page.getByRole('button', { name: /rules only/ }).click();
    await page.getByText('Check what leaves your device').waitFor();
    assert.match(await page.locator('.facts').innerText(), /Rules only/);
  });

  await step('cancelling a draft returns to a working input screen (no stale result)', async () => {
    await page.goto(`${BASE}?engine=sim`);
    await page.getByRole('button', { name: /MRI denied/ }).click();
    await page.getByRole('button', { name: 'Read it on this device' }).click();
    await page.getByText('Check what leaves your device').waitFor();
    await page.getByRole('button', { name: 'Send the hidden version to Gemini' }).click();
    await page.getByRole('button', { name: 'Cancel and start over' }).click();
    await page.waitForTimeout(1200); // longer than the simulated draft
    assert.equal(await page.getByText('Paste your denial letter').count(), 1, 'input screen missing');
    assert.equal(await page.getByText('Your appeal letter').count(), 0, 'stale result shown');
  });

  await step('PDF letter is read on the device: text extracted, no request to any other host', async () => {
    // Make a real text PDF of a synthetic sample letter with Chromium.
    const maker = await browser.newPage();
    await maker.setContent(`<pre style="font:14px monospace">Northwind Health Plan\nOctober 28, 2026\n\nMember ID: NWH448812901\nDear Maria L. Gonzalez,\nThe lumbar MRI (CPT 72148) is not medically necessary.\nYour appeal must be received within 180 days of the date of this notice.</pre>`);
    const pdf = await maker.pdf({ format: 'Letter' });
    await maker.close();
    const offOrigin = [];
    page.on('request', (r) => { if (!r.url().startsWith(BASE)) offOrigin.push(r.url()); });
    await page.goto(`${BASE}?engine=sim&device=unavailable`);
    await page.locator('input[type=file][accept*="pdf"]').setInputFiles({ name: 'letter.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.waitForFunction(() => document.querySelector('#letter')?.value.includes('NWH448812901'), null, { timeout: 30000 });
    const text = await page.locator('#letter').inputValue();
    assert.match(text, /Member ID: NWH448812901/);
    assert.match(text, /within 180 days/);
    assert.deepEqual(offOrigin, [], 'requests left the origin while reading the PDF');
    // The reading step stays in the privacy ledger after the letter is read.
    await page.getByRole('button', { name: /Hide my details/ }).click();
    await page.getByText('Check what leaves your device').waitFor();
    assert.match(await page.locator('.ledger').innerText(), /Read the PDF/);
    // Reading came first, so its row is listed before hiding the details.
    const rows = await page.locator('.ledger tbody tr').allInnerTexts();
    assert.match(rows[0], /Read the PDF/, `first ledger row: ${rows[0]}`);
    // A PDF longer than the page cap says so instead of silently dropping pages.
    const longMaker = await browser.newPage();
    await longMaker.setContent(Array.from({ length: 22 }, (_, i) => `<p style="page-break-after:always">Page ${i + 1} of a synthetic letter.</p>`).join(''));
    const longPdf = await longMaker.pdf({ format: 'Letter' });
    await longMaker.close();
    await page.getByRole('button', { name: 'Start over' }).click();
    await page.locator('input[type=file][accept*="pdf"]').setInputFiles({ name: 'long.pdf', mimeType: 'application/pdf', buffer: longPdf });
    await page.getByText(/has 22 pages; only the first 20 were read/).waitFor({ timeout: 30000 });
  });

  await step('Español: the interface is Spanish, the appeal letter stays English, and the choice is remembered', async () => {
    const es = await browser.newPage(); // own context: the saved language must not leak into other checks
    es.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await es.goto(`${BASE}?engine=sim&device=unavailable`);
    await es.getByRole('button', { name: 'Español' }).click();
    await es.getByText('Pega tu carta de negación').waitFor();
    assert.equal(await es.evaluate(() => document.documentElement.lang), 'es');
    await es.getByRole('button', { name: /bariátrica/ }).click();
    await es.getByRole('button', { name: 'Ocultar mis datos en este dispositivo' }).click();
    await es.getByText('Revisa lo que sale de tu dispositivo').waitFor();
    await es.getByRole('button', { name: /carta modelo/ }).click();
    await es.getByText('Tu carta de apelación').waitFor();
    const letter = await es.getByLabel('Carta de apelación').inputValue();
    assert.match(letter, /I am writing to appeal/, 'the letter to the insurer must stay in English');
    assert.match(await es.locator('main').innerText(), /La carta está en inglés/);
    // No English ledger note or footer in Spanish mode.
    const ledgerEs = await es.locator('.ledger').innerText();
    assert.match(ledgerEs, /datos reemplazados por marcadores/);
    assert.ok(!/values replaced/.test(ledgerEs), 'English ledger note in Spanish mode');
    assert.match(await es.locator('footer').innerText(), /No es asesoría legal ni médica/);
    // Switching language on the result screen says the explanation is in the other language.
    await es.getByRole('button', { name: 'English' }).click();
    await es.getByText('This explanation and checklist were written in Spanish').waitFor();
    await es.getByRole('button', { name: 'Español' }).click();
    assert.equal(await es.getByText('This explanation and checklist were written in Spanish').count(), 0);
    await es.reload();
    await es.getByText('Pega tu carta de negación').waitFor();
    await es.close();
  });

  await step('390px: no horizontal scroll on the review screen', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(`${BASE}?engine=sim&device=unavailable`);
    await m.getByRole('button', { name: /bariatric/ }).click();
    await m.getByRole('button', { name: /Hide my details/ }).click();
    await m.getByText('Check what leaves your device').waitFor();
    const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert.ok(sw <= iw, `scrollWidth ${sw} > ${iw}`);
    // The type-to-hide button must sit inside its card.
    const [btnRight, cardRight] = await m.evaluate(() => {
      const b = document.querySelector('.type-hide button').getBoundingClientRect();
      const c = document.querySelector('.type-hide').closest('.card').getBoundingClientRect();
      return [b.right, c.right];
    });
    assert.ok(btnRight <= cardRight, `Hide button overflows its card (${btnRight} > ${cardRight})`);
  });

  assert.deepEqual(errors, [], 'console errors');
  console.log(results.join('\n'));
  console.log(`\n${results.length} e2e checks passed`);
} finally {
  await browser.close();
  server.kill();
}
