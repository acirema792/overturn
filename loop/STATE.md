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
| 2 | 7.3 | 7.0 | 7.5 | 6.5 | 8.0 |

## Open findings
- Round-1 attempt-3 commit 3b351e6 (F2/F3/F5/F6/F7) awaiting verification; F3, F5, F6 are at their attempt cap: one more rejection → escalate.
- Round 2 queue: G1 S3, G2 S3, G3 S2, G4 S2, G5 S2, G6 S2, G7 S2, G8 S1, G9 S1, G10 S1, G11 S1. G12 → escalate (protected).

## Escalations (for the person)
- G12 (protected: CI workflow): add lint and e2e (with `npx playwright install --with-deps chromium`) to CI. Needs your OK.
- F13 (protected: scripts/eval.ts): `npm run eval` overwrites the committed eval_results/ on every run (timestamps and ms change). Recommendation: write to eval_results/ only with `--write`, print otherwise. Needs your OK because it touches the script behind published numbers.
- Published wording (README, BENCHMARK-RESULTS, CLAIMS, EVIDENCE, FEEDBACK) was corrected by the loop after the verifier found overclaims; please read and approve the final claims before submission.
- Live-only checks (need your Firebase project and a Chrome with Gemini Nano): App Check with reCAPTCHA, Remote Config fetch, real ONLY_ON_DEVICE runs and JSON output, cloud appeal quality, PREFER_IN_CLOUD → Nano fallback, Resource Timing counts, the Nano benchmark row.

## Rulings
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
