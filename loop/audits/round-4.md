# Round 4 audit (independent auditor, worktree at 38f8c8e, plus the live site)

Saved by the loop from the auditor's returned report.

| Criterion | Score |
|---|---|
| A. Technological Implementation | 7.0 |
| B. Design | 7.0 |
| C. Potential Impact | 7.0 |
| D. Quality of the Idea | 8.0 |
| **OVERALL** | **7.3** |

Extras: Security 7 · Reliability 6 · Observability 6 · Testing 7.5 · Infrastructure 6.5 · Code Quality 7.5 · Compliance/Honesty 7.5 · Stage-1 readiness 7.

Live: site loads in ~2.7 s; rules-only flow, deadline, egress gate, Benchmark (rules), How it works and 390 px all fine. App Check (reCAPTCHA Enterprise) returned 403 "App attestation failed" for every browser launched from this datacenter IP, so Gemini returned 401 and the app fell back to the template letter. A real cloud answer was verified on 2026-11-23 (CLAIMS.md) but not in this round.

Findings:
- I1 (S2) App Check attestation failure is invisible; user sees a raw SDK 401 error.
- I2 (S2) "Start over" during drafting leaves a blank page (stale result); no progress/cancel during long retries.
- I3 (S2) template letter puts patient advice ("from your doctor", "ask for it") into the letter to the insurer.
- I4 (S2) rules-only leaks "Patient Name: SMITH, John A", "Dear Ms. de la Torre," under a green badge; not in public Known gaps.
- I5 (S2) SUBMISSION.md overclaims ("never later", "never come from a model", "held out until frozen").
- I6 (S3) stale docs (eval writes, deploy path, EVIDENCE pending items, test count 220 vs 224, FEEDBACK "not yet live", code comment).
- I7 (S3) ledger failure row shows "—" requests and 0 ms; bytes column is prompt bytes.
- I8 (S3) 390 px: type-to-hide button clipped; ledger columns off-screen.
- I9 (S3) repo About empty; app doesn't link to its source.
- I10 (S3) keyboard focus falls to <body> after each stage change.

OVERALL_SCORE=7.3
