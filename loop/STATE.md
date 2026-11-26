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
| 6 | 7.9 | 7.5 | 8.5 | 7.5 | 8.0 |

## Open findings
- Round 6 (final, 2026-11-26): audit 7.9 (loop/audits/round-6.md), J1–J10 fixed except J3 (escalated). Findings L1–L6 (all S1) fixed in 45acda9, 4c2abb1, ae92ff3, 5a1f50c (272 tests, 9 e2e, eval unchanged). Verifier pass 3 rejected the first L3 (wrong code on multi-code letters); attempts 2 and 3 approved in pass 4. Deployed 5a1f50c and checked live. Max rounds reached: the loop has stopped.
- Round 5 (2026-11-26): PDF (c4215c6), Spanish UI (638e6d9, 0bdbfc0), diagram + screenshots (df97251), docs (e0e995a). Tests 263, e2e 9, eval unchanged. Round-5 audit 7.8 (loop/audits/round-5.md). Verifier pass 1: 1 approved, 3 rejected, 1 escalated; all defects and audit findings J2–J10 fixed in K1–K9 (267 tests, 9 e2e, eval unchanged); verifier pass 2: 8 approved, K8 (ebcf0b4) escalated for your approval of the final claims; its follow-ups R1 (47df745) and R3 (e8b0a98) done. Deployed e8b0a98 to the live site and checked it live (J1 closed).
- Verifier 7: cddf5e1 APPROVED, 88e8030 APPROVED (the two verifier-6 commits, later folded into one by the history rewrite; the first didn't build alone), 631ea20 ESCALATED (run-log/CLAIMS live-evidence wording). Follow-ups for N1–N4 + the wording: this commit set, tests 256, eval unchanged.
- Needs the person: demo video, Gemini Nano benchmark run, Blaze plan, repo About box, Devpost submit, delete the debug token after Dec 16.

## Escalations (for the person)
- History (resolved 2026-11-26 with the person's "force-push OK"): main was rewritten from 1114d00 so every commit has the Claude identity (original dates kept), and the commit that didn't build alone was folded into its follow-up fix (now 88e8030; the old hashes 41803a4 and 9c628ac in earlier notes both map to it). All hashes in loop/ were updated to the new ones. 45acda9 (five small round-6 fixes in one commit) was left as one commit: each part was verified and approved, and splitting it adds risk without changing the code.
- Claims (ebcf0b4, e8b0a98): please read and approve the final published wording on Spanish (README Input line, SUBMISSION steps/Accomplishments, CLAIMS rows). Gemini Nano's Spanish output (K6) can only be checked in Chrome with Nano.
- J3: DONE with the person's go-ahead (2026-11-26: "consider if it's useful… try not to break the rules"). Spanish-letter rules shipped after 3 attempts (verifier pass 7 APPROVED); eval identical; scoped claims; misses in Known gaps.
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
