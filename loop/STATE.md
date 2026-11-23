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
- Final verifier (2026-11-23) on 90d8f08 / c21bcc8 / 03364f0: c21bcc8 APPROVED; 90d8f08 and 03364f0 REJECTED. Follow-ups: d1f6f1f (deadline: earliest window wins; 'letter dated'), 73f8a07 + 7bc35ad (gate: any separators, money-safe, prefilter), 5db8b81 (capitals in name context), and the applyVault / fallback-bytes commit. 220 tests, eval unchanged. These follow-ups are NOT yet independently verified.
- Known residual (S3, documented): the gate's placeholder token can hide a label next to a partly redacted value ("Name: [PERSON_1] John Smith"); the offline draft is not cloud-gated and doesn't re-check inferenceSource (the availability guard runs first).

## Escalations (for the person)
- F3/G2: the window is now the earliest plausible candidate, so misreads err earlier; skipped categories (later process with no appeal offered; provider-only sentences) could still err later if a letter states only those. Documented in BENCHMARK-RESULTS Known gaps.
- F5 expectation change: APPROVED by the person (2026-11-23).
- H3 (rule change): Medicaid 10-day continuation-of-benefits window read as the appeal window when it comes first; dd-Mon-yyyy / dotted / yyyy/mm/dd notice dates not parsed.
- H4 (rule change): "Patient Name: SMITH, John A", "Subscriber: GARCIA, Maria", "Dear Ms. de la Torre,", "The patient, Sofia Marquez, age 34" still leak rules-only.
- Measurement (protected: src/eval/runEval.ts): leaks are counted only when a whole planted value survives; fragment-level counting would be stricter and more honest.
- G12: DONE with approval (CI runs lint and e2e).
- F13: DONE with approval (`npm run eval` prints; `npm run eval:write` updates eval_results/).
- Published wording (README, BENCHMARK-RESULTS, CLAIMS, EVIDENCE, FEEDBACK) was corrected by the loop after the verifier found overclaims; please read and approve the final claims before submission.
- Live-only checks (need your Firebase project and a Chrome with Gemini Nano): App Check with reCAPTCHA, Remote Config fetch, real ONLY_ON_DEVICE runs and JSON output, cloud appeal quality, PREFER_IN_CLOUD → Nano fallback, Resource Timing counts, the Nano benchmark row.

## Rulings
- 2026-11-23, the person approved: (a) the F5 trade-off (capitals names after "Dear"/"Member:" hidden even when an insurer); (b) F13 (eval writes results only with --write); (c) G12/H9 (CI runs lint and the e2e UI test).
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
