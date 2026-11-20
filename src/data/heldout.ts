// HELD-OUT cases, written after the rules were tuned on cases.ts and run once
// without further changes. Same format; same rule: everything is synthetic.
import type { EvalCase } from './cases';

export const HELDOUT: EvalCase[] = [
  {
    id: 'H01',
    title: 'Employer plan, sleep study denied (prior auth)',
    probes: 'Held-out. Name after "Hello"; claim # mid-sentence; "45 days" window.',
    text: `Ridgeline Health Benefits
Letter date: 11/16/2026

Hello Marcus Feldman,

Our records show claim # RHB-2026-448190 for an in-lab sleep study (CPT 95810) on 11/01/2026. We could not pay this claim because precertification was not requested by Dr. Sofia Albrecht.

You have the right to file an appeal within 45 days of the date of this letter. Your employer's group health plan rules apply.`,
    identifiers: ['Marcus Feldman', 'RHB-2026-448190', '11/01/2026', 'Sofia Albrecht', '11/16/2026'],
    keep: ['95810', 'sleep study', 'precertification'],
    expected: { noticeDate: '2026-11-16', windowDays: 45, planType: 'employer', deadline: '2026-12-31', category: 'prior_authorization' },
  },
  {
    id: 'H02',
    title: 'Marketplace plan, ambulance out of network',
    probes: 'Held-out. Address with "Blvd"; phone with dots; patient name only in body after "for".',
    text: `Coastal Plains Health Plan (Marketplace)
Date of notice: November 14, 2026

Member ID CPH770215580
Mailing address: 5510 Harbor View Blvd, Unit 12, Corpus Christi, TX 78412

The ground ambulance transport for Nadia Haddad on November 1, 2026 was provided by a non-participating ambulance company and was paid at the out-of-network rate. You may owe $1,250.00.

You may request an internal appeal within 180 days. Call 361.555.0190 with questions.`,
    identifiers: ['CPH770215580', '5510 Harbor View Blvd, Unit 12', 'Corpus Christi, TX 78412', 'Nadia Haddad', 'November 1, 2026', '361.555.0190', 'November 14, 2026'],
    keep: ['ground ambulance', 'non-participating', '$1,250.00'],
    expected: { noticeDate: '2026-11-14', windowDays: 180, planType: 'marketplace', deadline: '2027-05-13', category: 'out_of_network' },
  },
  {
    id: 'H03',
    title: 'Medicare Advantage, cataract surgery lens upgrade',
    probes: 'Held-out. Medicare number labelled "MBI"; caregiver after "niece"; no stated window.',
    text: `Golden Years Medicare Advantage
Notice of Denial of Payment
Date: 11/12/2026

Enrollee: Walter Grimsby
MBI: 3TR8-WQ2-JK51

We will not pay for the toric intraocular lens upgrade during cataract surgery (CPT 66984). Premium lenses are not covered under Original Medicare rules or this plan.

Your niece, Carla Benedetti, called on your behalf. You can ask us to reconsider this decision.`,
    identifiers: ['Walter Grimsby', '3TR8-WQ2-JK51', 'Carla Benedetti', '11/12/2026'],
    keep: ['66984', 'toric intraocular lens', 'cataract surgery'],
    expected: { noticeDate: '2026-11-12', windowDays: null, planType: 'medicare_advantage', deadline: '2027-01-16', category: 'not_covered' },
  },
  {
    id: 'H04',
    title: 'Employer plan, IVIG infusion experimental',
    probes: 'Held-out. Name with apostrophe; two-word surname; window "ninety (90) days".',
    text: `Summit Ridge Employee Health Plan
Date of determination: November 10, 2026

Patient: Siobhan O'Connell de la Cruz
Member ID SR-5590-11873

The request for intravenous immunoglobulin (IVIG) infusions for small fiber neuropathy (ICD-10 G62.9) is denied as investigational for this diagnosis under our policy.

You may appeal within ninety (90) days of receiving this notice. This is an ERISA plan.`,
    identifiers: ["Siobhan O'Connell de la Cruz", 'SR-5590-11873', 'November 10, 2026'],
    keep: ['intravenous immunoglobulin', 'G62.9', 'investigational'],
    expected: { noticeDate: '2026-11-10', windowDays: 90, planType: 'employer', deadline: '2027-02-08', category: 'experimental' },
  },
  {
    id: 'H05',
    title: 'Medicaid, dental extraction not covered for adults',
    probes: 'Held-out. Email with plus-tag; "Recipient" label; no window stated.',
    text: `Bayou State Medicaid Managed Care
11/15/2026

Recipient: Tremaine Joubert
Medicaid #: 4410087723
Email: t.joubert+mail@inbox.example

Adult dental extractions (CDT D7210) are not a covered benefit under your plan except in emergencies.

If you think we made a mistake, you can ask for an appeal.`,
    identifiers: ['Tremaine Joubert', 'Joubert', '4410087723', 't.joubert+mail@inbox.example', '11/15/2026'],
    keep: ['D7210', 'not a covered benefit'],
    expected: { noticeDate: '2026-11-15', windowDays: null, planType: 'medicaid', deadline: '2027-01-14', category: 'not_covered' },
  },
  {
    id: 'H06',
    title: 'Hospital bill, upcoding dispute (unknown plan)',
    probes: 'Held-out. No plan type, no window: must not invent a deadline; guarantor named.',
    text: `St. Brigid Regional Hospital — Billing Office
Statement date: 11/03/2026

Guarantor: Ana Lucia Ferreira
Account 7781-002-55410

Your insurer adjusted the claim for your observation stay because the level of service (CPT 99223) did not match the documentation. A corrected claim with a different code may be required.

Please call our billing office.`,
    identifiers: ['Ana Lucia Ferreira', '7781-002-55410', '11/03/2026'],
    keep: ['99223', 'observation stay', 'corrected claim'],
    expected: { noticeDate: '2026-11-03', windowDays: null, planType: 'unknown', deadline: null, category: 'coding_or_billing' },
  },
  {
    id: 'H07',
    title: 'Marketplace plan, GLP-1 drug denied (medical necessity)',
    probes: 'Held-out. Name in a "Prepared for" line; DOB written out; window "180 calendar days".',
    text: `Lone Pine Health (Covered via HealthCare.gov)
November 17, 2026

Prepared for: Yusuf Abernathy
Date of birth: March 3, 1979
Member number LPH-33-901274

The prior request for semaglutide 2.4 mg weekly was reviewed. Your records do not show a BMI of 30 or more, so the request does not meet our criteria for coverage and is denied as not medically necessary.

You have 180 calendar days from the date of this notice to appeal.`,
    identifiers: ['Yusuf Abernathy', 'March 3, 1979', 'LPH-33-901274', 'November 17, 2026'],
    keep: ['semaglutide 2.4 mg', 'BMI of 30', 'not medically necessary'],
    expected: { noticeDate: '2026-11-17', windowDays: 180, planType: 'marketplace', deadline: '2027-05-16', category: 'medical_necessity' },
  },
  {
    id: 'H08',
    title: 'Employer plan, chiropractic visits over limit, with fax and website',
    probes: 'Held-out. Fax number; website; "Insured:" label; plan ID with a short suffix.',
    text: `Heartland Benefit Services
Date: 11/18/2026

Insured: Gretchen Vollmer
Plan ID HBS-10045-7

Chiropractic visits (CPT 98941) after the 12th visit this year are beyond your plan's benefit limit and are not covered.

Appeals may be faxed to (816) 555-0175 or filed at www.heartlandbenefits.example/appeals within 180 days. Your employer group health plan document has details.`,
    identifiers: ['Gretchen Vollmer', 'HBS-10045-7', '11/18/2026'],
    keep: ['98941', 'benefit limit', '12th visit'],
    expected: { noticeDate: '2026-11-18', windowDays: 180, planType: 'employer', deadline: '2027-05-17', category: 'not_covered' },
  },
];
