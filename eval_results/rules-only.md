### Rules only, tuning set (16 letters; rules were adjusted on these)

Ran 2026-11-20T21:54:08.012Z in node v22.23.5. 16 synthetic letters, 95 planted identifiers, 57 clinical facts that must survive.

| Metric | Paste into a cloud chatbot | Overturn |
|---|---|---|
| Identifiers that would reach the cloud | 95/95 | **6/95** (5 letters affected) |
| Clinical facts preserved for the appeal | 57/57 | **57/57** |
| Payloads the egress gate blocked | n/a | 0/16 |
| Appeal deadline correct (code-computed) | n/a | **16/16** |
| Denial reason correct | n/a | 16/16 |

| Case | Leaked | Lost facts | Gate | Deadline (expected → got) | Reason (expected → got) |
|---|---|---|---|---|---|
| C01 Employer plan, MRI denied as not medically necessary | 0 | 0 | pass | 2027-04-26 → 2027-04-26 ✓ | medical_necessity → medical_necessity ✓ |
| C02 Marketplace plan, specialty drug needs step therapy | 0 | 0 | pass | 2027-05-01 → 2027-05-01 ✓ | step_therapy → step_therapy ✓ |
| C03 Medicare Advantage, skilled nursing days cut short | 0 | 0 | pass | 2027-01-10 → 2027-01-10 ✓ | medical_necessity → medical_necessity ✓ |
| C04 Medicaid managed care, out-of-network surgeon | 0 | 0 | pass | 2026-12-29 → 2026-12-29 ✓ | out_of_network → out_of_network ✓ |
| C05 Employer plan, no prior authorization for ER follow-up | 0 | 0 | pass | 2027-05-08 → 2027-05-08 ✓ | prior_authorization → prior_authorization ✓ |
| C06 Marketplace plan, experimental cancer test | 0 | 0 | pass | 2027-05-11 → 2027-05-11 ✓ | experimental → experimental ✓ |
| C07 Employer plan, physical therapy visit limit | `alexei petrov` | 0 | pass | 2027-05-04 → 2027-05-04 ✓ | not_covered → not_covered ✓ |
| C08 Hospital bill, coding error | 0 | 0 | pass | 2027-04-29 → 2027-04-29 ✓ | coding_or_billing → coding_or_billing ✓ |
| C09 Medicare Advantage, wheelchair with stated 65-day window | `Beatrice`, `Okonkwo-Lindqvist` | 0 | pass | 2027-01-07 → 2027-01-07 ✓ | medical_necessity → medical_necessity ✓ |
| C10 Employer plan, out-of-network anesthesiologist (surprise bill) | `Halvorsen Ridge Brewing Co.` | 0 | pass | 2027-05-09 → 2027-05-09 ✓ | out_of_network → out_of_network ✓ |
| C11 Marketplace plan, fertility medication excluded | `Hope Rivers` | 0 | pass | 2027-05-12 → 2027-05-12 ✓ | not_covered → not_covered ✓ |
| C12 Medicaid, prior auth for insulin pump | 0 | 0 | pass | 2027-01-01 → 2027-01-01 ✓ | prior_authorization → prior_authorization ✓ |
| C13 Unknown plan type, no window: must say "inconclusive" | 0 | 0 | pass | none → none ✓ | medical_necessity → medical_necessity ✓ |
| C14 Employer plan, bariatric surgery: long letter with many names | 0 | 0 | pass | 2027-04-24 → 2027-04-24 ✓ | medical_necessity → medical_necessity ✓ |
| C15 Marketplace plan, mental health residential treatment | `Destiny Harper-Cole` | 0 | pass | 2027-05-08 → 2027-05-08 ✓ | medical_necessity → medical_necessity ✓ |
| C16 Employer plan, hearing aids not covered | 0 | 0 | pass | 2027-05-10 → 2027-05-10 ✓ | not_covered → not_covered ✓ |

### Rules only, held-out set (8 letters; written after tuning, run without changes)

Ran 2026-11-20T21:54:08.017Z in node v22.23.5. 8 synthetic letters, 34 planted identifiers, 23 clinical facts that must survive.

| Metric | Paste into a cloud chatbot | Overturn |
|---|---|---|
| Identifiers that would reach the cloud | 34/34 | **7/34** (6 letters affected) |
| Clinical facts preserved for the appeal | 23/23 | **23/23** |
| Payloads the egress gate blocked | n/a | 0/8 |
| Appeal deadline correct (code-computed) | n/a | **8/8** |
| Denial reason correct | n/a | 7/8 |

| Case | Leaked | Lost facts | Gate | Deadline (expected → got) | Reason (expected → got) |
|---|---|---|---|---|---|
| H01 Employer plan, sleep study denied (prior auth) | `Marcus Feldman` | 0 | pass | 2026-12-31 → 2026-12-31 ✓ | prior_authorization → prior_authorization ✓ |
| H02 Marketplace plan, ambulance out of network | `Nadia Haddad` | 0 | pass | 2027-05-13 → 2027-05-13 ✓ | out_of_network → out_of_network ✓ |
| H03 Medicare Advantage, cataract surgery lens upgrade | `Carla Benedetti` | 0 | pass | 2027-01-16 → 2027-01-16 ✓ | not_covered → not_covered ✓ |
| H04 Employer plan, IVIG infusion experimental | 0 | 0 | pass | 2027-02-08 → 2027-02-08 ✓ | experimental → experimental ✓ |
| H05 Medicaid, dental extraction not covered for adults | `Tremaine Joubert`, `Joubert` | 0 | pass | 2027-01-14 → 2027-01-14 ✓ | not_covered → not_covered ✓ |
| H06 Hospital bill, upcoding dispute (unknown plan) | `Ana Lucia Ferreira` | 0 | pass | none → none ✓ | coding_or_billing → other ✗ |
| H07 Marketplace plan, GLP-1 drug denied (medical necessity) | `Yusuf Abernathy` | 0 | pass | 2027-05-16 → 2027-05-16 ✓ | medical_necessity → medical_necessity ✓ |
| H08 Employer plan, chiropractic visits over limit, with fax and website | 0 | 0 | pass | 2027-05-17 → 2027-05-17 ✓ | not_covered → not_covered ✓ |

