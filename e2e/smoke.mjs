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
