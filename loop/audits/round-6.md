# Round 6 audit (independent auditor at 8fcbf67, live site from 0abdab8)

Saved by the loop from the auditor's report file.

# Round 6 audit: Overturn at 8fcbf67 (live site from 0abdab8)

Independent read-only auditor. The worktree was at 38f8c8e, so I fetched origin/main and detached at **8fcbf67**. Nothing in the repo was edited, committed or pushed. The production build went to the scratchpad only. The live site was checked with Playwright (Chromium, deviceScaleFactor 1, through the session proxy).

## Scores

| Criterion | R5 | R6 | Evidence |
|---|---|---|---|
| A. Technological Implementation | 7.5 | **7.5** | **Hybrid core unchanged and sound.** Raw-letter steps use `ONLY_ON_DEVICE` behind an availability guard; the appeal uses `PREFER_IN_CLOUD` behind the egress gate.<br>**New this round:** Gemini Nano sessions declare `['en','es']` output only in Spanish mode (`firebaseEngine.ts:103-109,295,330`; tested at `firebaseEngine.test.ts:75-82`). `serviceDenied` is pinned to English (`prompts.ts:21`). pdf.js errors are typed (`readPdf.ts:42-62`), and `task.destroy()` now also runs when opening fails (`readPdf.ts:70-84`).<br>**Live:** a PDF read made **0 off-origin requests**.<br>**What caps the score:** there is still no recorded Gemini Nano run (CLAIMS "PENDING"). For a hybrid-inference hackathon, the on-device half is shown only through mocks and the simulated engine. |
| B. Design | 8.0 | **8.5** | **Español is now clean on the main flow.** On the live site in es mode, the input, review and result screens and the ledger and footer have no English left (my scan found 0 English words in `main` outside the letter).<br>**Other fixes:** sample titles are translated (`AppealFlow.tsx:17-23`), a 23-page PDF says "only the first 20 were read", errors are clear in both languages, and switching language on the result screen shows a notice.<br>**Unchanged strengths:** focus moves to the stage `H2`, and there is no horizontal scroll at 390 px in either language.<br>**Held back by:** the rules-only letter is generic and has unexplained blanks (L2, L3). |
| C. Potential Impact | 7.5 | **7.5** | **Better:** PDF input and the Spanish UI are now on the live site. Spanish mode now warns that Spanish-language letters may not be detected (`i18n.ts` `englishLettersNote`), which covers the J3 harm honestly.<br>**Still missing:** no outcome data, no demo video yet, and Spanish-language letters are still unsupported (escalated J3). |
| D. Quality of the Idea | 8.0 | **8.0** | Unchanged and strong: the medicine leaves the device, the identity doesn't. Deadline arithmetic is code, and "not sure" is preferred to a guess. |
| **OVERALL** | 7.8 | **7.9** | mean(7.5, 8.5, 7.5, 8.0) = 7.875 |

### Extras

| Area | R6 | Notes |
|---|---|---|
| Security | 7.5 | The pdf.js task is destroyed on every path (J9 fixed). The PDF stays in memory and is never uploaded (verified live). `printLetter` uses `textContent`. There is no CSP: the site is on GitHub Pages and has no `<meta http-equiv>` in `index.html`. |
| Reliability | 7.5 | Corrupt, password-protected, over-15-MB and over-20-page PDFs all get a specific message. In the template fallback, the cloud failure row is kept. |
| Observability | 7.0 | The "Read the PDF" row now survives (live: "pdf.js on this device; 1 page. The file was not uploaded. · 0 requests"). It is listed out of order (L1). Ledger notes are translated (`Ledger.tsx:43`). |
| Testing | 8.0 | 267 unit tests. e2e now also covers the ledger row, the truncation notice, Spanish ledger and footer text, and the language-switch notice (`e2e/smoke.mjs:140-151,169-178`). 9 steps (`grep -c "await step("` = 9). CI is green on 8fcbf67 (run 45762673347). |
| Infrastructure/Deploy | 7.5 | Live = round-5 code: bundle `index-B9G0xlWb.js`, with the Español button, the PDF input and the translated chips (J1 closed). The repo About box (description, homepage, topics) is still empty (`gh api repos/acirema792/overturn`); this is the person's known task. |
| Code Quality | 7.5 | `tsc -b` is clean. oxlint shows the same 3 old warnings (`redact.ts:103`, `Highlight.tsx:40`, `scripts/demo/record.mjs:137`). The Spanish deadline text moved into `src/deadlineText.ts` and has its own test. |
| Compliance/Honesty | 8.0 | The diagram no longer overclaims (`architecture.svg:17,21,54-55`). README has a "Redaction isn't perfect: 7/34" caption under the diagram. CLAIMS splits the template letter (REPRODUCIBLE) from model letters (NOT-CLAIMED) and adds "reads Spanish letters: NOT-CLAIMED". EVIDENCE, JUDGES, SUBMISSION and README all say 267 tests and 9 e2e. One small nit remains (L5). |

## Tripwires (run at 8fcbf67)

- `npx vitest run --pool=forks --poolOptions.forks.maxForks=2`: **Test Files 12 passed (12); Tests 267 passed (267)**.
- `npx tsx scripts/eval.ts`: both sets match the baseline exactly.

| Set | Identifiers reach the cloud | Facts kept | Gate blocked | Deadlines | Reasons |
|---|---|---|---|---|---|
| Tuning | **6/95** | **57/57** | 0/16 | **16/16** | **16/16** |
| Held-out | **7/34** | **23/23** | 0/8 | **8/8** | **7/8** (H06 `coding_or_billing → other`) |

- `tsc -b --noEmit`: clean. `oxlint`: 3 old warnings. `vite build` to the scratchpad: OK; `pdf-YwugTw7Y.js` is lazy.
- The diff since d6769ee touches no protected path: no `src/data/*`, `eval_results/**`, `scripts/eval.ts`, `src/eval/runEval.ts`, `.github/workflows/**` or `LICENSE`.
- e2e was not run, as instructed.

## Live site check (https://acirema792.github.io/overturn/)

**Main flow.** Run in en and es at 1280 and 390 px: sample → Hide my details now (rules only) → review → template letter.

| Check | Result |
|---|---|
| Load time | 120–300 ms |
| Pills (en) | "Gemini Nano can be downloaded · Cloud: gemini-3.5-flash-lite · Cloud blocked in this browser" |
| Pills (es) | "Gemini Nano se puede descargar · Nube: … · Nube bloqueada en este navegador" |
| `<html lang>` | Set to `es` in Spanish mode |
| Focus after "Hide my details" | Moves to "H2: Check what leaves your device" / "Revisa lo que sale de tu dispositivo" |
| Egress gate | Passed: 2,664 bytes (en), 2,841 bytes (es) |
| `scrollWidth` | Equals the viewport in all four runs, on both the review and result screens |
| Letter language | English in both modes ("Northwind Health Plan / Attn: Appeals Department / Re: Request for internal appeal…"), 0 Spanish characters |
| Spanish screens | Deadline "lun, 26 de abril de 2027 · Quedan 151 días · Tu carta dice que tienes 180 días para apelar." Ledger "12 datos reemplazados por marcadores", "Carta modelo de apelación". Footer "Hecho con la inferencia híbrida… No es asesoría legal ni médica · Las cartas de ejemplo son ficticias". |
| Language switch on the result screen | en→es shows "Esta explicación y la lista se escribieron en inglés. Empieza de nuevo para verlas en español."; es→en shows the English notice. The checklist stays in the result's language (R1 fixed). |
| Console errors | Only `requestStorageAccess: Permission denied.` and the App Check 403. Both are known datacenter-IP effects. |

**PDF check.** I made a 1-page PDF of a synthetic letter with `page.pdf()`, waited 10 s for startup traffic to settle, then opened it.

| Check | Result |
|---|---|
| Read time | 366 ms (en), 260 ms (es) |
| Requests during the read | Only `pdf-YwugTw7Y.js`, `pdf.worker.min-BPK52Uye.js` and `pdf.worker.min-CIqJB0yW.mjs`, all same-origin. **Off-origin: none.** |
| Text extraction | Line by line |
| Redaction | Address, date, name, member ID, claim ID, phone and "Dr. Priya Ramaswamy" all redacted. Gate passed (2,468 / 2,645 bytes). |
| Ledger after Hide | Shows "Read the PDF · pdf.js on this device; 1 page. The file was not uploaded. · Plain code · 0" (es: "Leer el PDF · pdf.js en este dispositivo; 1 página. El archivo no se subió."). |
| 23-page PDF | "This PDF has 23 pages; only the first 20 were read. Check that the denial and its appeal instructions are in the text above…" (es equivalent). |
| Corrupt PDF | "This file doesn't look like a valid PDF (it may be damaged). Paste the letter text instead." (es: "Este archivo no parece un PDF válido…"). No double period. |

**Other tabs.** "Cómo funciona" and "Prueba" say "Esta página está en inglés." and fit at 390 px.

## Round-5 findings status

| Finding | Status | Evidence |
|---|---|---|
| **J1** (live site stale) | **FIXED** | Live has Español, the PDF input and the translated chips. Verified above. |
| **J2** (PDF ledger row dropped; silent truncation) | **FIXED** | Filter at `AppealFlow.tsx:97`. Notice at `AppealFlow.tsx:395-399` with `pdfTruncated` in both languages. Verified live and in e2e. The row is listed out of order (L1). |
| **J3** (Spanish-language letter leaks) | **MITIGATED, ESCALATED as known** | Spanish-mode note (`i18n.ts` `englishLettersNote`, shown at `AppealFlow.tsx:394`). Known-gaps line in BENCHMARK-RESULTS. CLAIMS NOT-CLAIMED row. No new evidence; the detector rules remain the person's call. |
| **J4** (diagram overclaims) | **FIXED** | `architecture.svg:17,21,54-55`. The README adds a 7/34 caption under the diagram. |
| **J5** (English in Spanish mode) | **FIXED on the main flow** | Footer, sim banner, setup page, App Check tooltip, the three ledger notes, sample chips and `nanoPrepareFailed` (`App.tsx`, `pipeline.ts:117`, `firebaseEngine.ts:412-417`, `AppealFlow.tsx:17-23,237`). Small residue on rare error paths (L4). |
| **J6** (double period in PDF errors) | **FIXED** | Typed messages, plus `.replace(/[.\s]+$/, '')` for the "other" case (`AppealFlow.tsx:152-156`). Verified live. `errPhoto` still has the old pattern (L4). |
| **J7** (English-letter claim scope) | **FIXED** | CLAIMS rows split the template letter (REPRODUCIBLE) from model letters (NOT-CLAIMED). README Input line and SUBMISSION step 6 match. |
| **J8** (stale docs) | **FIXED** | EVIDENCE says 267 tests, 9 Playwright checks, PDF and Spanish. SUBMISSION says "five audit rounds" (one more round now exists, L5). |
| **J9** (pdf.js task leak; raw password error) | **FIXED** | `readPdf.ts:70-84`; `PasswordException` maps to `errPdfPassword`. Unit test at `readPdf.test.ts`. |
| **J10** (mixed languages after a switch) | **FIXED with a notice** | `AppealFlow.tsx:546-550`. The checklist uses `appealLang` (`:593`). It is not recomputed, but the notice is honest and tested in e2e. |

## Findings

Ordered by score gain per changed line. All are S1. No protected path is touched by any fix.

### L1 (S1) The ledger lists "Read the PDF" / "Read the photo" after the step that came later

- **Files:** `src/components/AppealFlow.tsx:92`. Protected: no.
- **Repro:** live site: Open a PDF, then click Hide my details. The ledger reads:
  1. "Hide personal details + compute deadline … 7 ms"
  2. "Read the PDF … 327 ms"

  The reading happened first. The ledger is the product's "history of where your letter went", so judges read it top-down as a timeline. The photo row has the same problem.
- **Fix (1 line):**

  ```ts
  const isRead = (e: LedgerEntry) => e.step === 'Read the photo' || e.step === 'Read the PDF';
  const ledger = [...extraLedger.filter(isRead), ...(analysis?.ledger ?? []), ...extraLedger.filter((e) => !isRead(e))];
  ```

  Optionally add one e2e assert that "Read the PDF" comes before "Hide personal details".

### L2 (S1) The template letter has unexplained blanks

- **Files:** `src/core/template.ts:79-83,107`, `src/components/AppealFlow.tsx` (result card), `src/i18n.ts`. Protected: no.
- **Repro:** live site, any sample, rules only, template letter. The letter reads "Member: ____ … ____ (signature) Date: ____". The card above it says "The names and numbers were put back in on this device" ("Los nombres y números se volvieron a poner…"). Nothing tells the patient that "Member: ____" must be filled in. Without Gemini Nano there are no roles, so the patient name is always blank (`template.ts:77-79`, by design).

  A judge on Firefox or Safari, or on Chrome without the model downloaded, sees an incomplete letter that says it is complete.
- **Fix (about 4 lines):** add a `fillBlanks` key in both languages, for example "Fill in each ____ (your name, the date, your signature) before you send it." Show it under the letter when `letter.includes('____')`.

### L3 (S1) The rules-only result never names what was denied

- **Files:** `src/pipeline.ts:86` (`serviceDenied: model?.serviceDenied ?? ''`), `src/core/template.ts:82,110`. Protected: no. This is not a detector rule, and the eval doesn't read `serviceDenied`.
- **Repro:** run `analyse(new SimEngine('unavailable'), CASES[0].text)` and then `templateAppeal`.
  - The letter says "I am writing to appeal your decision to deny coverage for **the service described in your notice**".
  - "What happened" says "Your plan denied the service described in your notice" (live, en and es).
  - Yet the letter, and the outgoing text, contain "lumbar spine MRI without contrast (CPT 72148)".

  Without Gemini Nano and the cloud (the fallback path), the appeal letter doesn't say what it appeals. Insurers match an appeal by claim, but the letter still reads as a form letter.
- **Fix (about 3 lines):** in `mergeFacts`, fall back to the first procedure code the code already sees:

  ```ts
  serviceDenied: model?.serviceDenied || (raw.match(/\b(?:CPT|HCPCS)(?:\s+code)?\s*([A-Z]?\d{4}[A-Z0-9]?)\b/)?.[0] ?? ''),
  ```

  The letter then reads "deny coverage for CPT 72148". CPT codes are already kept in the outgoing text, so the gate is unaffected. Add one pipeline test.

### L4 (S1) Rare error paths still mix English into Spanish, with a double period

- **Files:** `src/components/AppealFlow.tsx:175` (`errPhoto`), `:115` (`nanoPrepareFailed`), `src/ai/firebaseEngine.ts:255,262,279,315`. Protected: no.
- **Repro:**
  - `errPhoto` inserts the engine's English message as-is. For example, "Gemini Nano is not available on this device, so "Read the photo" did not run on-device. Nothing was sent." becomes "No se pudo leer la foto en este dispositivo: Gemini Nano is not available … Nothing was sent.. Puedes pegar…".
  - It is reachable only when Nano is reported available but then fails, or when a photo has the wrong type, so it is rare.
- **Fix (1 line):** apply the same `.replace(/[.\s]+$/, '')` used for `errPdf` to `errPhoto`. Full translation of the engine messages isn't worth it this late.

### L5 (S1) Docs nits a judge could catch

- **Files:** `SUBMISSION.md:53`, `CLAIMS.md` (PDF row). Protected: no. The CLAIMS tier change is a claim change, so it goes to the person.
- **Repro:**
  - SUBMISSION says "five audit rounds plus verifier passes"; `loop/audits/` will hold round 6.
  - The CLAIMS row "A PDF letter is read on the device: no request leaves the page's origin" is REPRODUCIBLE only. It is now observable live: on 2026-11-26 the read made 0 off-origin requests and fetched only same-origin `pdf-*.js` and worker files.
- **Fix:**
  - Change "five" to "six" in SUBMISSION.
  - With the person's approval, add "VERIFIED-LIVE (2026-11-26)" to the PDF row, citing this audit.

### L6 (S1) The disabled "Use a photo" button explains itself only in a hover tooltip

- **Files:** `src/components/AppealFlow.tsx:383`. Protected: no.
- **Repro:** live at 390 px, in Chrome with Gemini Nano "downloadable" (the common judge state). "Use a photo (PNG/JPEG)" is greyed out. The reason (`photoNeedsNano`) is only a `title` attribute, which touch and keyboard users never see. `noNanoNote` doesn't show either, because `deviceOk` is true for "downloadable" (`:71`).
- **Fix (2 lines):** when `device !== 'available'`, render `<span className="muted small">{t('photoNeedsNano')}</span>` next to the button, or add it to `aria-describedby`.

## What would most raise each criterion before the freeze (2026-11-29 14:00 PT)

- **A. Technological Implementation (biggest lever).** In a real desktop Chrome with Gemini Nano:
  - Run the in-app Benchmark "Run with Gemini Nano" and record the row in BENCHMARK-RESULTS.md with the Chrome version. This turns CLAIMS "PENDING" into evidence.
  - Capture one live ledger screenshot showing `ONLY_ON_DEVICE · on_device · 0 bytes`, then `PREFER_IN_CLOUD · in_cloud`.

  This is the core of a hybrid-inference entry, and today it is shown only through mocks. Docs and evidence changes are allowed after the freeze, but the run itself needs the person's Chrome.
- **B. Design.** L2 and L3 (about 7 lines in total) make the no-Nano fallback letter read as finished. L1 makes the ledger a true timeline. L6 explains the disabled button on mobile. These are code changes, so they must land before the freeze.
- **C. Potential Impact.** The demo video (a real denial journey, the deadline card, the ledger, Español), plus a sentence in README on who uses it and how (portal PDF to filed appeal in minutes). Spanish-language letter support (J3, the person's call) would make the Spanish UI fully credible.
- **D. Quality of the Idea.** Already strong. The video should state the "identity stays, medicine goes" split in the first 20 seconds, with the side-by-side review screen on camera. Fill in the repo About box (description, homepage, topics).

OVERALL_SCORE=7.9
