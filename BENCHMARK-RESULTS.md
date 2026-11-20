# Benchmark results

**Question:** if a patient uses Overturn, does anything that identifies them reach the cloud? And
does the appeal keep the medical facts it needs?

- **Data:** 24 synthetic US denial letters (`src/data/`): employer/ERISA, Marketplace, Medicare
  Advantage, Medicaid and hospital bills. They contain **129 planted identifiers** and **80 clinical
  facts** that must survive. Every person, number and address is invented.
- **Expected answers** (identifiers, facts, deadline, denial reason) were written into the case files
  before any run.
- **Tuning set (16 letters):** the rules were developed against these, so their numbers are
  in-sample.
- **Held-out set (8 letters):** written after the rules were frozen and run once. Rules derived from
  held-out misses are banned (`loop/STATE.md`, Rulings), and one attempt that broke this was
  reverted (`loop/ledger.json`).
- **Baseline:** pasting the letter into a cloud chatbot sends every identifier.

## 1. Rules only (no on-device model) · REPRODUCIBLE: `npm run eval`

This is the floor for browsers without Gemini Nano. Recorded run: `eval_results/rules-only.md`.

| Metric | Paste into a chatbot | Tuning (16) | **Held-out (8)** |
|---|---|---|---|
| Identifiers that would reach the cloud | 129/129 | 6/95 | **7/34** |
| Clinical facts kept for the appeal | all | 57/57 | **23/23** |
| Appeal deadline correct (code-computed) | n/a | 16/16 | **8/8** |
| Denial reason correct | n/a | 16/16 | 7/8 |

**The misses, explained.** Of the 13 leaked identifiers, 12 are people's names and 1 is the patient's employer, all in positions no rule labels:
- a bare recipient block ("Hope Rivers");
- a lowercase name ("alexei petrov");
- "for Nadia Haddad", "Hello Marcus Feldman", "your niece, Carla Benedetti";
- an employer ("Halvorsen Ridge Brewing Co.").

No ID number, date, address, phone, email or SSN leaked in either set. This is why Overturn has
Gemini Nano read the letter first, and why the patient approves the outgoing text before anything
is sent.

**Held-out reason miss.** H06 is a hospital "level of service did not match the documentation"
dispute. Rules call it `other`; the expected answer is `coding_or_billing`.

**Deadline.** Every held-out deadline was right, including H06, where the letter gives no plan type
and no window. There the correct answer is "not sure: we won't guess", and that's what Overturn
said.

## 2. Rules + Gemini Nano (on-device) · NOT YET RECORDED

This run needs desktop Chrome with Gemini Nano. Anyone can run it in the app's **Benchmark** tab:
everything runs in the browser and nothing is sent. The results table and JSON download will be
added here with the Chrome version and hardware. Until then, we make no claim about Nano's recall.

## 3. Robustness tests · REPRODUCIBLE: `npm test`

`src/core/adversarial.test.ts` pins the formats found in the independent audit (`loop/audits/`).

**Identity formats now caught** (each pinned by a test; formats outside these tests may still slip through):
- after a label or "Dear": accented names (José Ñúñez-García), "Last, First" (Gonzalez, Maria; O’Brien, Siobhán),
  Mc/Mac names, initials (M. L. Gonzalez), and ALL-CAPS names (JOHN Q PUBLIC, DE LA CRUZ, ANA);
- spaced IDs, and labelled IDs that look like procedure codes;
- dotted and yyyy/mm/dd dates, labelled spaced SSNs, and ages over 89 (Safe Harbor).

**Over-redaction guarded by tests:** insurer names in capitals, CPT/HCPCS/ICD-10 codes, dollar
amounts, a medical-policy reference ("Medical Policy MP-204"), section and version numbers ("Section 4.1.12"), drug doses and ages under 90 survive. (A value after an explicit ID label, such as "Policy No. MP-204", is redacted on purpose.)

**Traps now handled correctly:**
- a Medicaid letter that mentions Medicare;
- a date of birth on the first line;
- "we will decide within 30 days";
- short names inside other words ("Pat" in "patient").

## History

| Date | Change | Held-out leaked |
|---|---|---|
| 2026-11-20 | First frozen run | 7/34 |
| 2026-11-20 | Audit round-1 fixes and verifier follow-ups (none derived from held-out cases) | 7/34 (unchanged) |
