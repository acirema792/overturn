# Audit loop state

Round: 1 (fixes made, verification in progress)
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
- Round 1 fixes awaiting verification: F1 6d07a50 · F8 16bd200 · F2+F3 f754427 · F4 148fa4a · F6 3106a84 (batch 1); F9 ebf62e8 · F11+F12 c9ea4bd · F10 9f3dfbd · F5 4fd2a9d · F7 ca0eb7f · F14 244edfc (batch 2)

## Escalations (for the person)
- F13 (protected: scripts/eval.ts): `npm run eval` overwrites the committed eval_results/ on every run (timestamps and ms change). Recommendation: write to eval_results/ only with `--write`, print otherwise. Needs your OK because it touches the script behind published numbers.
- Live-only checks (need your Firebase project and a Chrome with Gemini Nano): App Check with reCAPTCHA, Remote Config fetch, real ONLY_ON_DEVICE runs and JSON output, cloud appeal quality, PREFER_IN_CLOUD → Nano fallback, Resource Timing counts, the Nano benchmark row.

## Rulings
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
