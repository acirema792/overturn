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
- **Held-out set (8 letters):** written after the first rules freeze and first run at that freeze (7/34). The rules changed later during the audit, never from held-out cases, and the number stayed 7/34 (see History). Rules derived from
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

**The misses, explained.** Of the 13 leaked identifiers, 12 are people's names and 1 is the patient's employer, after labels the rules don't use ("Hello", "Recipient:", "Guarantor:", "Prepared for:") or in running text:
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

**Over-redaction guarded by tests** (in the tested forms only): insurer names in capitals after "To:", field values like "SERVICE NAME: MRI LUMBAR SPINE", clinical codes after a labelled ID ("Claim #: 2026041277 CPT 99213" is redacted to the ID only and passes the gate), CPT/HCPCS/ICD-10 codes, dollar
amounts, a medical-policy reference ("Medical Policy MP-204"), section and version numbers ("Section 4.1.12"), drug doses and ages under 90 survive. (A value after an explicit ID label, such as "Policy No. MP-204", is redacted on purpose.)

**Traps now handled correctly:**
- a Medicaid letter that mentions Medicare;
- a date of birth on the first line;
- the plan's own timelines ("a decision will be made within 90 days") and fair-hearing, external-review and provider windows next to the patient's window (the earliest candidate wins; see Known gaps);
- service-date ranges in the letterhead;
- short names inside other words ("Pat" in "patient").

## Known gaps (open, escalated)

- The appeal window is the earliest plausible patient window in the letter, so a misread errs toward an earlier deadline. Some plan-timeline phrasings ("Most appeals are decided within 30 days") can still count as candidates and make the deadline too early. Windows we skip outright (a later process such as a State Fair Hearing with no appeal offered in the same clause, or a provider's deadline in a sentence without "you") could make it later if a letter states only those.
- Letters written in Spanish: rules for Spanish salutations, person labels, titles, "1 de octubre de 2026" dates, "Número de miembro" IDs, "Tiene 180 días…" windows and Spanish denial reasons were added late and are tested only on 4 synthetic Spanish letters written together with the rules (`src/core/spanish.test.ts`), not on a held-out set, and are not part of the numbers above. Known misses there: names in running Spanish text ("la paciente, Sofía Márquez"), after "Para:" or "Don/Doña" (listed as possible names on the review screen); windows written only in words ("sesenta días" without "(60)"); a fair hearing or the 10-day continuation-of-benefits window in the same clause as the appeal (the same gap as in English, so the deadline errs earlier); some Spanish plan-timeline phrasings ("Resolveremos su apelación dentro de 30 días", "…se tomará dentro de 30 días") and a provider's own appeal window can be read as the patient's window (also earlier, never later); unusual formats after Spanish labels ("Paciente: Diabetes Tipo 2") can be hidden as names. A signature that starts a line with "Sr." ("Sr. Juan Pérez") isn't hidden by the rules, because in English "Sr." means Senior; it is listed as a possible name. An English letter that contains Spanish words ("Miembro:", "Servicio") is read with the Spanish rules too. The app asks the patient to check names and dates in Spanish mode.
- Capitals names after "Member:" or "Dear" are hidden even when they are an insurer ("MEMBER: KAISER PERMANENTE"): over-redaction is preferred to a leak.
- The eval counts a leak only when a whole planted value survives; a surviving surname fragment is not counted.
- Rules-only formats still known to leak (Gemini Nano and the review screen are the backstop): a name in running text with no label ("The patient, Sofia Marquez, age 34" is only flagged as a possible name), a lowercase name, and unusual label words the rules don't use (as in the held-out letters).

## History

| Date | Change | Held-out leaked |
|---|---|---|
| 2026-11-20 | First frozen run | 7/34 |
| 2026-11-20 | Audit round-1 fixes and verifier follow-ups (none derived from held-out cases) | 7/34 (unchanged) |
| 2026-11-21 | Audit round-2 and round-3 fixes and verifier follow-ups (none derived from held-out cases) | 7/34 (unchanged) |
