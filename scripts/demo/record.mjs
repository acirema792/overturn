// Records the demo video from a running Overturn build with Playwright, then
// burns in English captions and title cards with ffmpeg.
//
//   node scripts/demo/record.mjs <app-url> <out-dir>
//
// The captions describe what the viewer sees. Against a simulated build
// (?engine=sim) the app shows a "SIMULATED ENGINE" banner on every frame; such
// a take is a pipeline test only and must never be published.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) {
  console.error('usage: node scripts/demo/record.mjs <app-url> <out-dir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;
const captions = [];
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function say(text, holdMs) {
  const start = now();
  await wait(holdMs);
  captions.push({ start, end: now(), text });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: outDir, size: { width: W, height: H } } });
const page = await context.newPage();
t0 = Date.now();

await page.goto(url);
await page.getByText('Paste your denial letter').waitFor();
await say('Overturn helps you appeal a health insurance denial, without uploading your identity.', 4500);

await page.getByRole('button', { name: /MRI denied/ }).click();
await say('A denial letter is full of identity: name, member ID, address, dates. (This one is synthetic.)', 4500);

const nanoReady = await page.getByRole('button', { name: 'Read it on this device' }).count();
if (nanoReady) {
  await page.getByRole('button', { name: 'Read it on this device' }).click();
  await say('Gemini Nano reads it in Chrome, through Firebase AI Logic in ONLY_ON_DEVICE mode.', 4000);
} else {
  await page.getByRole('button', { name: /rules only|Hide my details/ }).first().click();
  await say('This browser has no Gemini Nano, so on-device rules find the identity. Nothing is uploaded.', 4000);
}
await page.getByText('Check what leaves your device').waitFor({ timeout: 120000 });
await page.locator('.facts').scrollIntoViewIfNeeded();
await say('The appeal deadline is computed by code from the letter: Mon, April 26, 2027, with a calendar file.', 5000);

await page.locator('.panes').scrollIntoViewIfNeeded();
await say('Left: your letter, stays here. Right: exactly what the cloud model will see. Placeholders instead of identity.', 6000);
await page.locator('.gate').scrollIntoViewIfNeeded();
await say('An egress gate (plain code) blocks the request if anything identifying is still in it.', 4500);

await page.getByLabel('Type a word or name from your letter to hide it').fill('Northwind');
await page.keyboard.press('Enter');
await say('Anything else can be hidden with one click, or typed. Here: the insurer’s name.', 4500);

await page.locator('.ledger').scrollIntoViewIfNeeded();
await say('The privacy ledger records where each step ran, bytes sent, and Gemini requests the browser saw.', 5000);

await page.getByRole('button', { name: 'Send the hidden version to Gemini' }).click();
await say('Only the de-identified text goes to Gemini in the cloud (PREFER_IN_CLOUD), which writes the appeal.', 4000);
const waitStart = now();
await page.getByText('Your appeal letter').waitFor({ timeout: 180000 });
if (now() - waitStart > 3) {
  captions.push({ start: waitStart, end: now(), text: 'Waiting for Gemini in the cloud. When the free tier is busy, the app retries automatically.' });
}
// Never caption a template fallback as a Gemini appeal: reject the take instead.
const fallback = await page.locator('.alert').filter({ hasText: 'template letter instead' }).count();
if (fallback) {
  await context.close();
  await browser.close();
  console.error('TAKE REJECTED: the cloud step fell back to the template letter. Re-run later.');
  process.exit(3);
}
await page.getByText('Your appeal letter').scrollIntoViewIfNeeded();
await say('Back on the device, your real name and member ID are filled in. The cloud never sees the finished letter.', 6000);
await page.locator('.side').scrollIntoViewIfNeeded();
await say('Arguments, an evidence checklist and questions for your doctor come with it.', 4000);
await page.locator('.ledger').scrollIntoViewIfNeeded();
await say('The ledger now shows one cloud step, with the bytes of de-identified text it sent.', 4500);

await page.goto(`${url.split('#')[0]}#/benchmark`);
await page.getByRole('button', { name: 'Run rules only' }).click();
await page.getByText('identifiers that would reach the cloud').first().waitFor();
await say('Benchmark: 24 synthetic letters, 129 planted identifiers. Pasting into a chatbot sends all of them.', 5500);
await page.locator('.stats').nth(1).scrollIntoViewIfNeeded();
await say('Held-out letters, rules only: 7 of 34 identifiers left (all names), 23 of 23 clinical facts kept, 8 of 8 deadlines right.', 6500);

await page.goto(`${url.split('#')[0]}#/how`);
await say('Hybrid by data, not by device: identity stays local, medicine goes to the cloud.', 5000);

await context.close();
await browser.close();

const webm = readdirSync(outDir).find((f) => f.endsWith('.webm'));
renameSync(join(outDir, webm), join(outDir, 'raw.webm'));

// ASS subtitles: large white text on a dark box, bottom centre, 1080p.
const ts = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
};
const ass = [
  '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Cap,Inter,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB4141E1E,0,0,0,0,100,100,0,0,3,18,0,2,140,140,60,1',
  '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...captions.map((c) => `Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`),
].join('\n');
writeFileSync(join(outDir, 'captions.ass'), ass);
writeFileSync(
  join(outDir, 'captions.srt'),
  captions.map((c, i) => `${i + 1}\n${ts(c.start).replace('.', ',')}0 --> ${ts(c.end).replace('.', ',')}0\n${c.text}\n`).join('\n'),
);

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
ff(['-i', join(outDir, 'raw.webm'), '-vf', `scale=1920:1080:flags=lanczos,ass=${join(outDir, 'captions.ass')}`, '-r', '30', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', join(outDir, 'body.mp4')]);

// Title and end cards.
const card = (name, lines, secs) => {
  const draw = lines
    .map((l, i) => `drawtext=fontfile=/usr/share/fonts/opentype/inter/Inter-Bold.otf:text='${l.text.replace(/'/g, '’').replace(/:/g, '\\:')}':expansion=none:fontcolor=${l.color ?? 'white'}:fontsize=${l.size}:x=(w-text_w)/2:y=${l.y}`)
    .join(',');
  ff(['-f', 'lavfi', '-i', `color=c=0x0f6b5c:s=1920x1080:d=${secs}:r=30`, '-vf', draw, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(outDir, `${name}.mp4`)]);
};
card('title', [
  { text: 'Overturn', size: 120, y: 330 },
  { text: 'Appeal a health insurance denial.', size: 56, y: 500 },
  { text: 'Your identity stays on your device.', size: 56, y: 580 },
  { text: '19% of in-network HealthCare.gov claims were denied in 2024; under 1% were appealed (KFF).', size: 32, y: 760, color: '0xd8efe8' },
], 6);
card('end', [
  { text: 'Overturn', size: 110, y: 330 },
  { text: 'Firebase AI Logic hybrid inference', size: 48, y: 490 },
  { text: process.env.DEMO_URL_TEXT ?? url, size: 44, y: 600 },
  { text: 'Open source (Apache-2.0). Not legal or medical advice. Sample letters are synthetic.', size: 30, y: 780, color: '0xd8efe8' },
], 5);

writeFileSync(join(outDir, 'list.txt'), ['title.mp4', 'body.mp4', 'end.mp4'].map((f) => `file '${join(outDir, f)}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', join(outDir, 'list.txt'), '-c', 'copy', join(outDir, 'overturn-demo.mp4')]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(outDir, 'overturn-demo.mp4')]).toString().trim();
console.log(`wrote ${join(outDir, 'overturn-demo.mp4')} (${Number(dur).toFixed(1)} s)`);
if (Number(dur) > 180) console.error('WARNING: longer than 3 minutes; only the first 3 minutes are judged.');
