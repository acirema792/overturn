# Audit loop state

Round: 5 (resumed 2026-11-26 at the person's request). Target: above 7.3. Max rounds: 6. Freeze: 2026-11-29 14:00 PT.

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
| 4 | 7.3 | 7.0 | 7.0 | 7.0 | 8.0 |
| 5 | 7.8 | 7.5 | 8.0 | 7.5 | 8.0 |

## Open findings
- Round 5 (2026-11-26): PDF (ee9682f), Spanish UI (458572f, 87a6f19), diagram + screenshots (e96980e), docs (d6769ee). Tests 263, e2e 9, eval unchanged. Round-5 audit 7.8 (loop/audits/round-5.md). Verifier pass 1: 1 approved, 3 rejected, 1 escalated; all defects and audit findings J2–J10 fixed in K1–K9 (267 tests, 9 e2e, eval unchanged); verifier pass 2 running. J1 (live site not redeployed) waits for pass 2.
- Verifier 7: 101248a APPROVED, 9c628ac APPROVED, 41803a4 REJECTED for history only (build fails at that single commit because one line landed in 9c628ac; code correct; main builds), 3169ae5 ESCALATED (run-log/CLAIMS live-evidence wording). Follow-ups for N1–N4 + the wording: this commit set, tests 256, eval unchanged.
- Needs the person: demo video, Gemini Nano benchmark run, Blaze plan, repo About box, Devpost submit, delete the debug token after Dec 16.

## Escalations (for the person)
- J3 (rule change): Spanish-language denial letters ("Estimada Sra. …", "1 de octubre de 2026") aren't detected rules-only. Documented in Known gaps and noted in the Spanish UI; adding Spanish detector rules is your call.
- History: commit 41803a4 doesn't build on its own (fixed by the next commit). Fixing that, or the "Unverified" label on 372d9ed, needs a rewrite of main + force-push: the person's call.
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
- 2026-11-26, the person (answers to one batched question): YES to on-device PDF reading with the new dependency pdfjs-dist; YES to README screenshots + architecture diagram, a fresh audit + verifier, and a Spanish UI; "increase score as a new round of checking, even more than 7.3 is possible".
- 2026-11-23, the person approved: (a) the F5 trade-off (capitals names after "Dear"/"Member:" hidden even when an insurer); (b) F13 (eval writes results only with --write); (c) G12/H9 (CI runs lint and the e2e UI test).
- Never add detector rules derived from held-out misses (src/data/heldout.ts). Held-out numbers must stay out-of-sample. (Round 1, after a reverted F6 attempt.)
