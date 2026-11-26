# Round 5 audit (independent auditor at e0e995a, production build, live site)

Saved by the loop from the auditor's report file.

# Round 5 audit: Overturn at e0e995a

Independent read-only auditor. The worktree was at 38f8c8e, so I detached it at e0e995a; nothing was edited, committed or pushed in the repo. The UI was checked on the main clone's `dist/`, served with `vite preview --port 4190 --outDir /home/user/overturn/dist`. It now uses lazy chunks `pdf-YwugTw7Y.js` and `pdf.worker.min-*.mjs`, so it is the round-5 build. The preview server has been stopped.

## Scores

| Criterion | R4 | R5 | Evidence |
|---|---|---|---|
| A. Technological Implementation | 7.0 | **7.5** | The hybrid core is unchanged and sound: `ONLY_ON_DEVICE` with an availability guard, and `PREFER_IN_CLOUD` behind the egress gate. New: on-device PDF reading with pdf.js. It is lazy-loaded (`src/pdf/readPdf.ts:44-45`, and in dist the index chunk does not preload `pdf-*.js`). It is size- and page-capped (`readPdf.ts:13-14,43,51`), detects scans (`readPdf.ts:59`), and counts Gemini requests while it reads (`AppealFlow.tsx:123`). In the real build, a PDF read made 0 off-origin requests. The language-aware prompt keeps the letter English (`prompts.ts:70`) and the gate still passes for all 24 letters (`i18n.test.ts:33-41`). |
| B. Design | 7.0 | **8.0** | A complete Español flow: the deadline sentence comes from code, not machine translation (`AppealFlow.tsx:638-649`). The English letter is explained in Spanish (`i18n.ts:250`, `template.ts:109-124`). The language choice is remembered and sets `<html lang>` (`App.tsx:27-30`). Errors for scanned, corrupt and oversized PDFs are graceful. Focus moves to the stage heading (`AppealFlow.tsx:67-75`). No horizontal scroll at 390 px in either language. Some English is still visible in Spanish mode (J5). |
| C. Potential Impact | 7.0 | **7.5** | PDF input matches how denials actually arrive (portal PDFs). The Spanish UI reaches a large group of US patients. Held back by J3: a Spanish-language denial notice is handled poorly and leaks a name under a green gate. |
| D. Quality of the Idea | 8.0 | **8.0** | Unchanged: the medicine leaves the device, the identity doesn't. A clear hybrid split. |
| **OVERALL** | 7.3 | **7.8** | mean(7.5, 8.0, 7.5, 8.0) = 7.75 |

Extras:

| Area | Score | Notes |
|---|---|---|
| Security | 7.5 | PDF bytes stay in memory, never uploaded (`readPdf.ts:47-48`). pdfjs-dist is pinned at 6.5.438 (`package.json`). Small worker leak on a rejected `getDocument` (J9). |
| Reliability | 7 | Scanned, corrupt and >15 MB PDFs fail gracefully. More than 20 pages are silently truncated (J2). Cancelling a draft works. |
| Observability | 6.5 | The "Read the PDF" ledger row is built but never shown (J2). Ledger notes are in English in Spanish mode (J5). |
| Testing | 8 | 263 unit tests and 9 e2e checks, including PDF with no off-origin request and Español with an English letter (`e2e/smoke.mjs:125-160`). Eval unchanged. |
| Infrastructure/Deploy | 6.0 | The live site is still the pre-round-5 build (J1). |
| Code Quality | 7.5 | Clean i18n with `Record<Key,string>` typing. Three old lint warnings. `tsc -b` is clean. |
| Compliance/Honesty | 7 | The diagram overclaims (J4), EVIDENCE.md is stale (J8), and the "letter stays English" claim is proven only for the template (J7). CLAIMS adds a fair NOT-CLAIMED row for the translation. |

## Tripwires (run at e0e995a)

- `npx vitest run --pool=forks --poolOptions.forks.maxForks=2`: **Test Files 11 passed (11); Tests 263 passed (263)**
- `npx tsx scripts/eval.ts`:
  - Tuning: **6/95** identifiers reach the cloud, **57/57** facts kept, 0/16 blocked, **16/16** deadlines, **16/16** reasons.
  - Held-out: **7/34** reach the cloud, **23/23** facts kept, 0/8 blocked, **8/8** deadlines, **7/8** reasons (H06 coding_or_billing → other).
  - Both match the baseline exactly.
- `oxlint`: 3 pre-existing warnings. `tsc -b`: clean. e2e was not run, as instructed; the 9 `await step(` calls in `e2e/smoke.mjs` match the README count.

## UI check, production build

Flow: sample → Hide my details (rules only) → review → template letter, then a PDF. Run in en/es at 1280 and 390 px.

- **Loading and status.** The page loads in about 120 ms locally. The pills read "Gemini Nano can be downloaded · Cloud: gemini-3.5-flash-lite · Cloud blocked in this browser", or the Spanish equivalents.
- **Review screen.** Focus lands on the stage `H2`. The gate passes (2,664 bytes in English, 2,841 in Spanish). scrollWidth equals the viewport at 390 px. The ledger table scrolls inside its own container at 390 px; the "MODELO" column is cut but can be scrolled to.
- **Cloud send at 1280 px.** App Check returned 401/403, which is known. The app shows a friendly App Check message in the chosen language and falls back to the template. The ledger failure row shows Cloud · PREFER_IN_CLOUD · 2,664 bytes · 1 request · 188 ms.
- **Letter language.** The letter is English in both languages; no Spanish characters or words were found in it. The explanation is Spanish in es mode.
- **PDF reading.**
  - Text PDF made with Chromium `page.pdf()`: read in about 170 ms, **no off-origin request during the read**. The text was rebuilt line by line, and the gate redacted the address, date, member and claim IDs and both names.
  - Scanned PDF: the "no text layer" alert appears, in both languages.
  - Corrupt PDF: "Couldn’t read that PDF on this device: Invalid PDF structure.. You can paste…" (double period).
  - 16 MB PDF: "…larger than 15 MB. Paste the letter text instead.. You can paste the letter instead." (English inside the Spanish sentence, double period).
  - 25-page PDF: 2,049 characters loaded, **no notice of truncation**.
- **Earlier runs.** My first run's PDF step failed because the preview server was killed mid-run (exit 144, from an external signal). After a restart the PDF path was reliable. This was not a code defect.
- **Live site** (https://acirema792.github.io/overturn/): loads in about 1.2 s. It serves `index-DgQ7oNk2.js` and has **no Español button and no PDF input**, so it is still the **pre-round-5 deploy**. The rules-only flow and gate work there (2,664 bytes), and the "Cloud blocked" pill shows.

## Round-4 findings status

- **I1 (App Check invisible): FIXED.** There is a "Cloud blocked in this browser" pill with a tooltip, and `friendlyDraftError` explains App Check in both languages (seen live and in the build).
- **I2 (Start over during drafting): FIXED** (`runRef`, `AppealFlow.tsx:65,190-205,262-263`). Attempt progress and the "Cancel and start over" label are present.
- **I3 (patient advice in the letter): FIXED.** The `ENCLOSURES` text is in the letter's own voice (`template.ts:47-73`).
- **I4 (SMITH, John A / de la Torre): FIXED.** Both become `[PERSON_n]` rules-only. "The patient, Sofia Marquez" still leaks but is flagged as a possible name and listed in BENCHMARK-RESULTS Known gaps (line 77).
- **I5 (SUBMISSION overclaims): FIXED.** The held-out wording is now accurate.
- **I6 (stale docs): MOSTLY FIXED.** README, JUDGES and SUBMISSION say 263. EVIDENCE.md still says 256 and does not mention PDF or Spanish (J8).
- **I7 (ledger failure row): FIXED.** The failure row shows its real request count and time, and the column reads "Prompt bytes sent".
- **I8 (390 px clipping): FIXED** for the hide button and the page. The ledger scrolls in its own container. The Spanish type-to-hide placeholder is truncated ("…o escribe el texto a ocu"), which is cosmetic.
- **I9 (link to source): FIXED in the app** (footer link). The repo About box is still the person's task.
- **I10 (focus): FIXED.** The heading gets focus after every stage change (verified).

## Findings

Ordered by score gain per changed line.

### J1 (S2) The live site is the pre-round-5 build

- **Files:** none (deploy step: `scripts/deploy-pages.sh`, run by the person). Protected path: no (`.github/workflows/**` is not touched).
- **Repro:** open https://acirema792.github.io/overturn/. There is no "Español" button and no "Open a PDF" input; the bundle is `index-DgQ7oNk2.js`. Yet SUBMISSION.md step 6 ("switch to Español"), the README screenshots (`docs/img/5-espanol.png`) and the README Input bullet describe both features. A judge following SUBMISSION.md hits a missing control.
- **Fix:** `npm run build && npm run deploy:pages`, then re-run the live checks. This needs no code change and lifts Infrastructure, Design and Honesty as judges see them.

### J2 (S2) The "Read the PDF" ledger row is discarded, and truncation is never shown

- **Files:** `src/components/AppealFlow.tsx:88` (and :124-139). Protected path: no.
- **Repro:** open any PDF. The input stage renders no ledger. Click "Hide my details": `read()` runs `setExtraLedger(l => l.filter(e => e.step === 'Read the photo'))`, which drops the "Read the PDF · pdf.js on this device … The file was not uploaded." row. So the row, its Spanish name (`i18n.ts` `STEP_ES['Read the PDF']`) and its "(first 20 read)" note are dead code. With a 25-page PDF, 2,049 characters load with no alert, and pages 21-25, which may hold the appeal-rights section, are silently ignored.
- **Fix:**
  - Line 88: `e.step === 'Read the photo' || e.step === 'Read the PDF'`.
  - In `onPdf`, when `pdf.truncated`, call `setError(t('pdfTruncated', {n: 20, pages: pdf.pages}))`, or better a non-alert note, and add one i18n key in each language.
  - About 4 lines. Proves the PDF privacy claim in the UI itself.

### J3 (S2) A Spanish-language denial notice leaks a name and date under a green gate

- **Files:** `src/core/detectors.ts` (or `redact.ts`), BENCHMARK-RESULTS.md Known gaps, `src/i18n.ts`. Protected path: no. A detector change is a rule change, so it goes to the person as in H3/H4. It is not derived from held-out data.
- **Repro:** rules-only (`analyse(new SimEngine('unavailable'), letter, false, 'es')`) on this letter:

  ```
  Plan de Salud Sol
  1 de octubre de 2026
  Estimada Sra. María José Gutiérrez Ramírez:
  Número de miembro: SOL987654321
  Su solicitud de resonancia magnética fue negada por no ser médicamente necesaria. Tiene 60 días para apelar.
  ```

  - Redacted output keeps `1 de octubre de 2026` and `Estimada Sra. María José Gutiérrez Ramírez:`. Only the member number becomes `[ID_1]`.
  - The gate is `allowed: true`.
  - The deadline is `null` ("not sure") and the category is `other`.
  - The name appears only in "possible names".

  The Spanish UI invites exactly the users whose Medicaid or Marketplace notices may come in Spanish. Nothing in the app or the docs says letters must be in English.
- **Smallest fix:**
  - Add one Known-gaps line and one Spanish UI note under the textarea in es mode, for example `inputLede` + "Overturn lee cartas en inglés; si tu carta está en español, revisa con cuidado los nombres y fechas."
  - About 3 lines. Optionally, and only with the person's approval, add the salutations `Estimad[oa]` / `Sr.` / `Sra.` and the `d de <mes> de yyyy` date pattern to the detectors.

### J4 (S2) The architecture diagram overclaims the privacy guarantee

- **Files:** `docs/architecture.svg` (text nodes). Protected path: no.
- **Repro:** the diagram says "The raw letter, the names and the finished letter never leave this box", "Sees only placeholders like [PERSON_1]" and "Egress gate … blocks the request if any identifier is still in it". The project's own eval shows 6/95 and 7/34 identifiers reaching the cloud rules-only, and the README (step 3) correctly says "any known identifier … or any detectable new one". The diagram is the first image a judge sees.
- **Fix:** change three strings: "never leave this box" → "stay in this box; you approve what leaves"; "Sees only placeholders" → "Sees de-identified text"; "if any identifier" → "if any known or detectable identifier". 3 lines.

### J5 (S1) English text visible in Spanish mode

- **Files:** `src/components/AppealFlow.tsx:16,106,136,207,221`, `src/pipeline.ts` (the code ledger note "N values replaced with placeholders"), `src/App.tsx:71,127-131,151-152`, `src/pdf/readPdf.ts:43`. Protected path: no.
- **Repro (es, 1280 px):**
  - The ledger shows "12 values replaced with placeholders" and "The de-identified prompt was sent, but the request failed; the template letter was used instead."
  - The sample chips read "Employer plan, MRI denied as not medically necessary", etc.
  - The footer reads "Built with … Not legal or medical advice · Sample letters are synthetic".
  - The PDF errors embed English: "No se pudo leer ese PDF en este dispositivo: This PDF is larger than 15 MB. Paste the letter text instead.. Puedes pegar la carta."
  - Also in English: `deviceError` "Gemini Nano couldn't be prepared (…); rules only", the egress-blocked note, and the "Setup needed" page.
- **Fix:**
  - Add i18n keys for the footer and the three ledger notes, translating notes at render time like `stepName`.
  - Have `readPdf` throw `new Error('too-big')` and map it to an `errPdfTooBig` key.
  - Translate the sample titles with a 3-entry ES map.
  - About 20 lines.

### J6 (S1) PDF error messages have a double period and repeat themselves

- **Files:** `src/i18n.ts` (`errPdf`), `src/pdf/readPdf.ts:43`. Protected path: no.
- **Repro:**
  - Corrupt PDF: "…: Invalid PDF structure.. You can paste the letter instead."
  - 16 MB file: "…larger than 15 MB. Paste the letter text instead.. You can paste the letter instead."
- **Fix:** strip a trailing period from `msg` before inserting it (`msg.replace(/\.$/, '')`) and drop the "Paste the letter text instead." sentence from `readPdf.ts:43`. 2 lines; overlaps with J5.

### J7 (S1) "The Spanish UI keeps the appeal letter in English" is proven only for the template letter

- **Files:** `CLAIMS.md` (new row), `JUDGES.md`. Protected path: no.
- **Repro:**
  - `i18n.test.ts` and e2e test the template and simulated engine only. For the cloud draft, English is a prompt instruction (`prompts.ts:70`) with no check on the reply.
  - In Spanish mode, Nano's `serviceDenied` (`factsPrompt` asks only `reasonInPlainWords` to be Spanish) can drift into Spanish. It then flows into the English template letter (`template.ts:82`) and the cloud prompt "Denied:". This could not be verified here (no Nano).
- **Fix:** reword the CLAIMS row to "the template letter is always English; the cloud model is instructed to write the letter in English (REPRODUCIBLE for the template, prompt-only for the cloud)". 1-2 lines. Optional: warn when the returned letter contains common Spanish words.

### J8 (S1) Stale docs

- **Files:** `EVIDENCE.md:5`, `SUBMISSION.md:53`. Protected path: no.
- **Repro:**
  - EVIDENCE.md still says "256 tests … plus a Playwright UI smoke test" and does not mention PDF or Spanish under Design or Impact.
  - SUBMISSION says "three rounds plus verifier passes"; `loop/` now has rounds 1-5.
- **Fix:** update the two lines.

### J9 (S1) The pdf.js task leaks when the document fails to open

- **Files:** `src/pdf/readPdf.ts:48-62`. Protected path: no.
- **Repro:** for a corrupt or password-protected PDF, `await task.promise` rejects before the `try`, so `task.destroy()` never runs and the worker and loading task stay alive. A password PDF also shows pdf.js's raw "No password given" in English.
- **Fix:** move `const doc = await task.promise` inside a `try { … } finally { await task.destroy(); }`, and map `PasswordException` to an i18n message. About 4 lines.

### J10 (S1) Switching language on the result screen mixes languages

- **Files:** `src/components/AppealFlow.tsx:250-258`. Protected path: no.
- **Repro:** finish a template letter in English, then click Español. The headings switch, but "Qué pasó", "Argumentos más fuertes" and "Pregúntale a tu médico" keep the English text stored in `appeal`.
- **Fix:** for template results, store the inputs and recompute `templateAppeal` with the current `lang` at render time, or show a one-line hint to start a new letter after switching. About 5 lines.

OVERALL_SCORE=7.8
