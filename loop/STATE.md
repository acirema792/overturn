# Audit loop state

Round: 3 (DONE: max rounds reached; loop stopped)
Target: 9.0 · Max rounds: 3 · Freeze: 2026-11-29 14:00 PT

## Baseline tripwires (2026-11-20)
- `npm test`: 22 passed
- `npm run build`: OK
- `npm run eval`: tuning 6/95 leaked, 57/57 facts, 16/16 deadlines, 16/16 reasons; held-out 7/34 leaked, 23/23 facts, 8/8 deadlines, 7/8 reasons

## Scores
| Round | OVERALL | Tech | Design | Impact | Idea |
|---|---|---|---|---|---|
| 1 | 6.9 | 6.5 | 7.0 | 6.5 | 7.5 |
| 2 | 7.3 | 7.0 | 7.5 | 6.5 | 8.0 |
| 3 | 7.3 | 7.0 | 7.5 | 6.5 | 8.0 |

## Open findings
- Verified and approved: F1 logic, F4, F8, F9, F10 (782c90b), F11, F12, F14, G1, G6, G7, G9, G10, G11, F2 and F7 parts of 3b351e6.
- NOT independently verified (implementer-tested only; 193 tests, eval unchanged): 90d8f08 (H1/H2), c21bcc8 (H5-H7), 03364f0 (G2-G5, G8 second attempts; F5/F6 reverts). A fresh verifier pass is recommended before submission.

## Escalations (for the person)
- F3 (attempt cap reached): some plan-timeline phrasings placed before the patient's window ("We'll decide your appeal within 30 days. You have 180 days…") are read as the window. Errors are toward an EARLIER deadline. Options: (a) accept and document (current; listed in BENCHMARK-RESULTS Known gaps); (b) redesign as "only patient-marked windows count, else the legal default", which needs a new verification pass.
- F5 expectation change: two tests now expect "Dear AETNA," and "MEMBER: KAISER PERMANENTE" to be hidden (previously kept), because capitals names after those labels can't be told from insurers without a list and leaks are worse. Please confirm this trade-off.
- H3 (rule change): Medicaid 10-day continuation-of-benefits window read as the appeal window when it comes first; dd-Mon-yyyy / dotted / yyyy/mm/dd notice dates not parsed.
- H4 (rule change): "Patient Name: SMITH, John A", "Subscriber: GARCIA, Maria", "Dear Ms. de la Torre,", "The patient, Sofia Marquez, age 34" still leak rules-only.
- Measurement (protected: src/eval/runEval.ts): leaks are counted only when a whole planted value survives; fragment-level counting would be stricter and more honest.
- G12 (protected: CI workflow): add lint and e2e (with `npx playwright install --with-deps chromium`) to CI. Needs your OK.
- F13 (protected: scripts/eval.ts): `npm run eval` overwrites the committed eval_results/ on every run (timestamps and ms change). Recommendation: write to eval_results/ only with `--write`, print otherwise. Needs your OK because it touches the script behind published numbers.
- Published wording (README, BENCHMARK-RESULTS, CLAIMS, EVIDENCE, FEEDBACK) was corrected by the loop after the verifier found overclaims; please read and approve the final claims before submission.
- Live-only checks (need your Firebase project and a Chrome with Gemini Nano): App Check with reCAPTCHA, Remote Config fetch, real ONLY_ON_DEVICE runs and JSON output, cloud appeal quality, PREFER_IN_CLOUD → Nano fallback, Resource Timing counts, the Nano benchmark row.

## Rulings
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
