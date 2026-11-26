// README screenshots from the REAL production build (no simulated engine).
// Headless Chromium has no Gemini Nano, so this shows the rules-only path, which
// is also what a judge without Nano sees. Run: npm run build && node scripts/screenshots.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 4181;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'docs/img';
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    await wait(250);
  }
}

// Full-page shots start at the nav bar: the status pills above it describe THIS
// machine (e.g. a datacenter IP that App Check refuses), not the app.
const belowStatus = async (p) => {
  const y = await p.evaluate(() => document.querySelector('nav').getBoundingClientRect().top);
  return { x: 0, y, width: 1280, height: 860 - y };
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await page.goto(BASE);
  await page.getByRole('button', { name: /MRI denied/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/1-input.png`, clip: await belowStatus(page) });

  await page.getByRole('button', { name: /Hide my details/ }).click();
  await page.getByText('Check what leaves your device').waitFor();
  await page.locator('section', { has: page.getByText('Check what leaves your device') }).first().screenshot({ path: `${OUT}/2-review.png` });

  const deadline = page.locator('.deadline').first();
  if (await deadline.count()) await deadline.screenshot({ path: `${OUT}/3-deadline.png` });
  await page.locator('.ledger').first().screenshot({ path: `${OUT}/4-ledger.png` });

  const es = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await es.goto(BASE);
  await es.getByRole('button', { name: 'Español' }).click();
  await es.getByRole('button', { name: /MRI denied/ }).click();
  await es.getByRole('button', { name: /Ocultar mis datos/ }).first().click();
  await es.getByText('Revisa lo que sale de tu dispositivo').waitFor();
  await es.evaluate(() => window.scrollTo(0, 0));
  await es.waitForTimeout(200);
  await es.screenshot({ path: `${OUT}/5-espanol.png`, clip: await belowStatus(es) });
  console.log('screenshots written to', OUT);
} finally {
  await browser.close();
  server.kill();
}
