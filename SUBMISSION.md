# Devpost submission: copy-paste fields

Deadline: **Mon Nov 30, 2026, 2:00 pm PT**. Submit by Sun Nov 29 evening PT.

| Field | Value |
|---|---|
| Project name | `Overturn` |
| Elevator pitch (≤200) | `Appeal a health insurance denial without uploading your identity. Gemini Nano reads the letter on your device; only de-identified text goes to the cloud to write the appeal.` (173 characters) |
| Platform | **Web (Chrome)** |
| New or existing | **New** (built Nov 11–30, 2026) |
| Submitter type | Individual |
| Built with (tags) | `firebase`, `firebase-ai-logic`, `gemini`, `gemini-nano`, `firebase-app-check`, `firebase-remote-config`, `chrome`, `typescript`, `react`, `vite`, `pdf.js`, `playwright`, `github-pages` |
| Try it out | https://acirema792.github.io/overturn/ · https://github.com/acirema792/overturn |
| Video | _YouTube link (public)_ |
| Testing instructions | See below |

## Testing instructions (paste)

No account, key or install needed.

1. Open https://acirema792.github.io/overturn/ in desktop Chrome.
2. Click the sample **"Employer plan, MRI denied…"** (all sample letters are synthetic).
3. If Gemini Nano is available, click **Read it on this device**. Otherwise click **Hide my details now (rules only)**, or **Download Gemini Nano (once), then read** (a few minutes, once).
4. Review **Check what leaves your device**: left is your letter, right is exactly what the cloud will see; the green **Egress check** must pass.
5. Click **Send the hidden version to Gemini**. The free Gemini tier is occasionally busy: the app retries automatically and otherwise shows an honest template letter; the **Privacy ledger** shows every attempt.
6. Optional: switch to **Español** in the top bar: the explanation is Spanish; the appeal letter is written in English for the insurer.
7. Optional: **Benchmark** tab → run the 24-letter benchmark in your own browser.

Five-minute guide with what to look for: https://github.com/acirema792/overturn/blob/main/JUDGES.md

## About the project (paste into the story field)

## Inspiration
In 2024, insurers on HealthCare.gov denied **19% of in-network claims**, and fewer than **1%** of those denials were appealed (KFF, March 2026). Appeals are hard to write, the deadline is buried in the letter, and the obvious helper, a cloud chatbot, asks you to paste in your name, member ID, date of birth and diagnosis.

The appeal needs the **medicine**: what was denied, and why. It doesn't need the **identity**. That split is exactly what hybrid inference is for.

## What it does
1. **Paste the letter, open a PDF or take a photo.** The PDF is read on the device with pdf.js. Gemini Nano, running in Chrome through Firebase AI Logic, finds every person, member ID, address and contact detail, and reads the denial reason, **on the device**.
2. **Code hides and decides.** Each identifier becomes a placeholder (`[PERSON_1]`, `[MEMBER_ID_1]`) everywhere it appears. The **appeal deadline** is computed by code from the letter and federal rules (ERISA 180 days, Medicare Advantage 65, Medicaid 60). When it isn't sure, it says so instead of guessing.
3. **You see exactly what leaves.** A side-by-side view shows your letter and the de-identified text. An **egress gate** (plain code) blocks the request if any identifier is still in it, even reformatted. You can hide anything else with a click or by typing.
4. **The cloud argues.** Gemini in the cloud writes a plain-English explanation, the strongest arguments, an evidence checklist, questions for your doctor and a ready-to-sign appeal letter, **from the de-identified text only**.
5. **Your details come back on your device.** The finished letter never touches the cloud. Add the deadline to your calendar, then print and send.

Offline? **Stay offline** drafts the appeal with Gemini Nano. A **privacy ledger** shows every step: where it ran (from the SDK's `inferenceSource`), bytes sent, and the requests to Gemini that your browser recorded.

## How we built it
- **Firebase AI Logic hybrid inference, two modes used on purpose:** `ONLY_ON_DEVICE` for the raw letter, the photo and the offline draft; `PREFER_IN_CLOUD` for the de-identified appeal.
- **We read the SDK source and closed a gap:** in SDK 13.4.0, when Chrome has no Prompt API, even `ONLY_ON_DEVICE` requests go to the cloud. Overturn checks availability before every on-device call and fails closed (details in FEEDBACK.md).
- **One JSON Schema, both paths:** `responseConstraint` on device, `responseJsonSchema` in the cloud.
- **App Check** (reCAPTCHA Enterprise) and **Remote Config** (cloud model, letter length, thinking level).
- **Measured on the live project:** the default thinking level took ~100 s per appeal; `thinkingLevel: LOW` took ~4 s. Busy-model errors are retried (3 per model, 2 models), and every attempt is counted in the ledger.
- **A deterministic core** in TypeScript: 14 identifier kinds modelled on HIPAA Safe Harbor, a redaction vault, the egress gate, deadline rules with CFR citations, and a template letter for when no model is reachable. 270 tests, 9 Playwright UI checks, and an independent audit-and-verify loop (six audit rounds plus verifier passes, all in `loop/`).

## Measured results
24 synthetic denial letters with 129 planted identifiers and 80 clinical facts. Expected answers were written before any run, and 8 letters were held out from rule development (the rules were never tuned on them).

| | Paste into a chatbot | Overturn, rules only (held-out) |
|---|---|---|
| Identifiers that reach the cloud | 34/34 | **7/34** (all names) |
| Clinical facts kept for the appeal | 23/23 | **23/23** |
| Appeal deadline correct | n/a | **8/8** |

The rules-only numbers are the floor for browsers without Gemini Nano. The misses are names in running text, which is the job of Nano and of the review screen. Judges can run the benchmark in their own Chrome from the **Benchmark** tab.

## Challenges we ran into
- `PREFER_ON_DEVICE` is the obvious choice, and it would quietly upload raw letters whenever Nano isn't downloaded yet. Reading the SDK source changed our design.
- Names hide everywhere: "your son, Mateo", "Ms. Vance's doctor", "CLAIM DETAIL FOR BROWN, JAMES". Relatives who share a surname must keep separate placeholders, or the letter names the wrong person.
- Over-redaction breaks the appeal: CPT/ICD codes, dollar amounts and policy sections must survive. The benchmark measures both directions.
- Deadlines: a letter can mention a fair-hearing window, the plan's own decision time and the patient's window. Overturn uses the earliest plausible patient window, so a misread usually errs toward an earlier deadline (see Known gaps in BENCHMARK-RESULTS.md).

## Accomplishments we're proud of
- **English and Español.** Many people who get a denial read Spanish first. Overturn explains the denial, the arguments and the evidence in Spanish, while the appeal letter is written in English for the US insurer (the template always; Gemini is instructed to).
- A privacy guarantee you can check yourself: the ledger, the gate and the side-by-side view.
- Deadline arithmetic is always code: Gemini Nano only fills a missing date or window, and the card says which. When neither is known, Overturn says "not sure" instead of guessing.

## What we learned
Hybrid isn't "on-device when possible". It's deciding which data each model is allowed to see.

## What's next
State-specific Medicaid and external-review rules, a Chrome extension that works inside insurer portals, and appeal outcome tracking with consent.

*Not legal or medical advice. Sample letters are synthetic.*
