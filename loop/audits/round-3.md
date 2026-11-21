# Round 3 audit (final round; independent auditor, worktree at cc620ef)

Saved by the loop from the auditor's returned report.

| Criterion | Score |
|---|---|
| A. Technological Implementation | 7.0 |
| B. Design | 7.5 |
| C. Potential Impact | 6.5 |
| D. Quality of the Idea | 8.0 |
| **OVERALL** | **7.3** |

Extras: Security/Privacy 7 · Testing 7 · Honesty 7 · Stage-1 readiness 3.

Round-2 verification: G1, G3, G5, G7, G9, G11 fixed; G2, G6, G8 fixed as specified (new phrasings remain); G4 fixed with a regression (H1); G10 fixed for Nano finds; G12 escalated.

Findings:
- H1 (S2) egress gate false-blocks the app's own prompt; single-word names replace common words (rule spans re-seeded case-insensitively; gate whole-word match case-insensitive). Repros: "Dr. Helen English" vs template "plain English"; "Dear Mr. Days,"; "Dear Bill,"; "Ms. Long" vs "long-term"; "Ms. May" vs "You may"; squashed date vs dollar amount.
- H2 (S2) "Stay offline" draft is blocked by the cloud egress gate.
- H3 (S2/S3) Medicaid continuation-of-benefits 10-day window first; plan obligation with "Within 30 days…, we will"; "request copies… within 180 days"; notice dates dd-Mon-yyyy / dotted / yyyy/mm/dd not parsed.
- H4 (S2) rules-only: "SMITH, John A", "GARCIA, Maria", "Dear Ms. de la Torre,", "The patient, Sofia Marquez, age 34".
- H5 (S3) failed-attempt ledger row shows 0 requests seen.
- H6 (S3) input lede overclaims ("every other identifier").
- H7 (S3) "Read by" card says "no on-device model" when the user chose rules only.
- H8 (S1 for submission) Stage-1 deliverables missing (repo, URL, video, Firebase project).
- H9 (S3, protected) CI lacks lint/e2e (= G12); F13 open.

OVERALL_SCORE=7.3
