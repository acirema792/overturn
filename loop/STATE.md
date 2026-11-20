# Audit loop state

Round: 2 (audit in progress; round-1 follow-ups in verification)
Target: 9.0 · Max rounds: 3 · Freeze: 2026-11-29 14:00 PT

## Baseline tripwires (2026-11-20)
- `npm test`: 22 passed
- `npm run build`: OK
- `npm run eval`: tuning 6/95 leaked, 57/57 facts, 16/16 deadlines, 16/16 reasons; held-out 7/34 leaked, 23/23 facts, 8/8 deadlines, 7/8 reasons

## Scores
| Round | OVERALL | Tech | Design | Impact | Idea |
|---|---|---|---|---|---|
| 1 | 6.9 | 6.5 | 7.0 | 6.5 | 7.5 |

## Open findings
- Round 1: verifier batch 1 approved F8, F4; rejected F1 (build red at intermediate commit only), F2/F3, F6. Batch 2 approved F11/F12, F9; rejected F10, F5, F7, F14. All rejections have follow-up commits: c204abe (F2/F3/F6/F4), c65b656 (F5, F14 dep), 782c90b (F10/F12/F9), 43f49fe (F7). Awaiting verification of these four.
- F13: escalated (protected path).

## Escalations (for the person)
- F13 (protected: scripts/eval.ts): `npm run eval` overwrites the committed eval_results/ on every run (timestamps and ms change). Recommendation: write to eval_results/ only with `--write`, print otherwise. Needs your OK because it touches the script behind published numbers.
- Published wording (README, BENCHMARK-RESULTS, CLAIMS, EVIDENCE, FEEDBACK) was corrected by the loop after the verifier found overclaims; please read and approve the final claims before submission.
- Live-only checks (need your Firebase project and a Chrome with Gemini Nano): App Check with reCAPTCHA, Remote Config fetch, real ONLY_ON_DEVICE runs and JSON output, cloud appeal quality, PREFER_IN_CLOUD → Nano fallback, Resource Timing counts, the Nano benchmark row.

## Rulings
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
