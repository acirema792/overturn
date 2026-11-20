# Round 2 audit (independent auditor, worktree at d9cb8f8)

Saved by the loop from the auditor's returned report (subagents may not write files).

| Criterion | Score |
|---|---|
| A. Technological Implementation | 7.0 |
| B. Design | 7.5 |
| C. Potential Impact | 6.5 |
| D. Quality of the Idea | 8.0 |
| **OVERALL** | **7.3** |

Extras: Security/Privacy 6.5 · Testing 7 · Honesty 7 · Stage-1 readiness 4 (no public repo, hosted URL or video yet).

Round-1 verification: fixed F1, F4, F6, F8, F9, F11, F12, F14; partly F2, F3, F5, F7, F10; F13 escalated.

Findings:
- G1 (S3) relatives sharing a surname collapse into one placeholder (detectors.ts mergeSpans canonical copy; redact.ts canonicalOf).
- G2 (S3) fair-hearing / independent-reviewer / provider windows read as the patient's appeal window (Medicaid 60 days late); "no later than 60 calendar days after you receive" missed.
- G3 (S2) failed cloud attempt that ends in the template is not in the ledger, which says nothing left (real-browser repro, 3,269 bytes sent).
- G4 (S2) partial patient names in Nano-written facts pass the gate and applyVault.
- G5 (S2) dateline fallback takes "Plan effective date", "Coverage period", "Member since", "Respond by", "request dated".
- G6 (S2) rules-only leaks: Dr. A. Patel initials, particle surnames (de la Cruz, van Gogh), lowercase "number" label, dd-Mon-yyyy, license plate, bare ZIP.
- G7 (S2) "downloadable" Nano forces a download; prepare error blocks the read; no rules-only choice.
- G8 (S1) wording: "removes every name…", "all in positions no rule labels", "never from a model", "frozen and run once".
- G9 (S1) Remote Config temperature ignored by Gemini 3.x; asNumber()||default can't be 0.
- G10 (S1) a Nano false positive matching template wording blocks Send with no undo.
- G11 (S1) Start over keeps the old letter; select-to-hide is mouse-only.
- G12 (S1, protected: CI, eval script) CI lacks lint/e2e; F13.

Live-only: Nano JSON/roles/input size, temperature/topK on web, download UX, photo model init, reCAPTCHA Enterprise, Remote Config on origin, cloud appeal quality, request counts, offline fallback, Pages deploy.

OVERALL_SCORE=7.3
