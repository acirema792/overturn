// Evaluation case library. Every letter is SYNTHETIC: the people, insurers,
// numbers and addresses are invented. Expected outcomes were written before
// any run. `identifiers` are the planted values that must never reach the
// cloud; `keep` are clinical facts the appeal needs, which must survive
// redaction (the false-positive control).

import type { DenialCategory } from '../core/categories';
import type { PlanType } from '../core/deadline';

export interface EvalCase {
  id: string;
  title: string;
  /** What this case tests. */
  probes: string;
  text: string;
  identifiers: string[];
  keep: string[];
  expected: {
    noticeDate: string;
    windowDays: number | null;
    planType: PlanType;
    deadline: string | null;
    category: DenialCategory;
  };
}

export const CASES: EvalCase[] = [
  {
    id: 'C01',
    title: 'Employer plan, MRI denied as not medically necessary',
    probes: 'Baseline letter: labelled IDs, address block, 180-day window stated in words and digits.',
    text: `Northwind Health Plan
P.O. Box 44120, Tacoma, WA 98401

October 28, 2026

Maria L. Gonzalez
1842 Alder Creek Rd, Apt 3B
Olympia, WA 98502

Member ID: NWH448812901
Group Number: 77810-02
Claim Number: 2026-1014-55821

Dear Maria L. Gonzalez,

We reviewed the request for a lumbar spine MRI without contrast (CPT 72148) ordered by Dr. Anil Rao for lower back pain with radiculopathy (ICD-10 M54.16), date of service October 9, 2026. The service is denied because it is not medically necessary. Our clinical criteria require six weeks of conservative therapy, such as physical therapy, before advanced imaging. Billed amount: $2,450.00.

You have the right to appeal. Your appeal must be received within one hundred eighty (180) days of the date of this notice. This plan is an employer-sponsored group health plan governed by ERISA.

Sincerely,
Utilization Management, Northwind Health Plan
1-800-555-0142`,
    identifiers: ['Maria L. Gonzalez', 'Gonzalez', '1842 Alder Creek Rd, Apt 3B', 'Olympia, WA 98502', 'NWH448812901', '77810-02', '2026-1014-55821', 'Anil Rao', 'October 9, 2026', 'October 28, 2026'],
    keep: ['72148', 'M54.16', '$2,450.00', 'not medically necessary', 'six weeks of conservative therapy'],
    expected: { noticeDate: '2026-10-28', windowDays: 180, planType: 'employer', deadline: '2027-04-26', category: 'medical_necessity' },
  },
  {
    id: 'C02',
    title: 'Marketplace plan, specialty drug needs step therapy',
    probes: 'Family member named only in the body; numeric dates; no labelled patient name.',
    text: `CASCADE MUTUAL INDIVIDUAL PLANS
Notice date: 11/02/2026

To: Jordan Whitfield
re: your son, Mateo Whitfield, DOB 04/17/2014
Subscriber # CMI-5520-883410

Your Marketplace plan received a pharmacy request for Dupixent 300 mg (dupilumab) for Mateo. Our step therapy policy requires a trial of a formulary alternative, a high-potency topical corticosteroid, for at least 28 days before this drug is covered.

If you disagree, you or your doctor can file an appeal within 180 days from the date of this notice. You may also ask for an expedited review if waiting could seriously harm the patient's health. Call 855-555-0199 ext. 4 or write to appeals@cascademutual.example.

This plan is offered through HealthCare.gov.`,
    identifiers: ['Jordan Whitfield', 'Mateo Whitfield', 'Mateo', '04/17/2014', 'CMI-5520-883410', '11/02/2026'],
    keep: ['Dupixent 300 mg', 'step therapy', '28 days', 'formulary alternative'],
    expected: { noticeDate: '2026-11-02', windowDays: 180, planType: 'marketplace', deadline: '2027-05-01', category: 'step_therapy' },
  },
  {
    id: 'C03',
    title: 'Medicare Advantage, skilled nursing days cut short',
    probes: 'Medicare 65-day window NOT stated: default rule must apply; written dates; caregiver named.',
    text: `Evergreen Care Advantage (HMO)
Notice of Denial of Medical Coverage

Date: November 6, 2026

Enrollee: Harold Bixby
Medicare Number: 1EG4-TE5-MK73
Address: 77 Larkspur Way, Bend, OR 97701

We have denied continued coverage of your skilled nursing facility stay at Pine Hollow Rehabilitation after November 4, 2026. Based on our review, further skilled care is not medically necessary because you can now perform daily activities with supervision.

Your daughter, Ellen Bixby-Moore, may file on your behalf if you sign an Appointment of Representative form. You have the right to ask Evergreen Care Advantage to reconsider. See the enclosed form for how to request a reconsideration.`,
    identifiers: ['Harold Bixby', 'Bixby', '1EG4-TE5-MK73', '77 Larkspur Way', 'Bend, OR 97701', 'Ellen Bixby-Moore', 'November 6, 2026', 'November 4, 2026'],
    keep: ['skilled nursing facility', 'not medically necessary', 'daily activities with supervision'],
    expected: { noticeDate: '2026-11-06', windowDays: null, planType: 'medicare_advantage', deadline: '2027-01-10', category: 'medical_necessity' },
  },
  {
    id: 'C04',
    title: 'Medicaid managed care, out-of-network surgeon',
    probes: 'Medicaid 60-day window stated; email and phone of the member; hospital name.',
    text: `Sunrise Community Health (Medicaid Managed Care)
Date of notice: 10/30/2026

Member name: Priya Natarajan
Member ID 900145672A
Phone on file: (602) 555-0187   Email: priya.n.1987@mailbox.example

Your request for spinal fusion surgery with Dr. Lena Okafor at Desert Valley Spine Institute was denied. Dr. Okafor is out-of-network, and an in-network surgeon is available within 30 miles.

You may appeal this decision. You must file your appeal within 60 calendar days from the date on this notice. If we uphold our decision, you may ask for a State Fair Hearing.`,
    identifiers: ['Priya Natarajan', '900145672A', '(602) 555-0187', 'priya.n.1987@mailbox.example', 'Lena Okafor', 'Okafor', '10/30/2026'],
    keep: ['spinal fusion surgery', 'out-of-network', '30 miles'],
    expected: { noticeDate: '2026-10-30', windowDays: 60, planType: 'medicaid', deadline: '2026-12-29', category: 'out_of_network' },
  },
  {
    id: 'C05',
    title: 'Employer plan, no prior authorization for ER follow-up',
    probes: 'SSN fragment pasted by mistake; claim number unlabelled in a sentence; ISO date.',
    text: `Keystone Benefits Administrators
2026-11-09

Patient: Samuel K. Osei      SSN: 219-55-0143
Plan: Keystone Manufacturing Employee Health Plan (ERISA)
Reference KB-77-213908

Claim 7731-20991-04 for a cardiac stress test (CPT 93015) on 10/21/2026 was denied because prior authorization was not obtained. The test was ordered at a follow-up visit after an emergency department visit for chest pain (ICD-10 R07.9).

You have 180 days from receipt of this letter to request an appeal. Send your request to the Appeals Unit, 400 Market Street, Suite 900, Harrisburg, PA 17101.`,
    identifiers: ['Samuel K. Osei', 'Osei', '219-55-0143', 'KB-77-213908', '7731-20991-04', '10/21/2026', '2026-11-09'],
    keep: ['93015', 'R07.9', 'prior authorization', 'chest pain'],
    expected: { noticeDate: '2026-11-09', windowDays: 180, planType: 'employer', deadline: '2027-05-08', category: 'prior_authorization' },
  },
  {
    id: 'C06',
    title: 'Marketplace plan, experimental cancer test',
    probes: 'Two people (patient and spouse) and a doctor; written-out window; URL with member token.',
    text: `Bright Harbor Health Insurance Co.
Date of this notice: November 12, 2026

Dear Ms. Aiyana Redcloud:

Your doctor, Dr. Thomas Weller, requested a multi-cancer early detection blood test. This test is considered experimental and investigational under our Medical Policy MP-204 and is not covered.

Your husband, Daniel Redcloud, called us on your behalf on November 3, 2026. We can only discuss the case with him once we receive your written authorization.

You may file an appeal within one hundred eighty days. Track your case at https://portal.brightharbor.example/case?member=BH20931177. This is an individual plan purchased through the Health Insurance Marketplace.`,
    identifiers: ['Aiyana Redcloud', 'Redcloud', 'Thomas Weller', 'Daniel Redcloud', 'BH20931177', 'November 12, 2026', 'November 3, 2026'],
    keep: ['multi-cancer early detection blood test', 'experimental and investigational', 'MP-204'],
    expected: { noticeDate: '2026-11-12', windowDays: 180, planType: 'marketplace', deadline: '2027-05-11', category: 'experimental' },
  },
  {
    id: 'C07',
    title: 'Employer plan, physical therapy visit limit',
    probes: 'No window stated: ERISA 180-day default; lowercase name typed by the member in a forwarded note.',
    text: `From: Lakeshore Health Partners Member Services
Sent: 11/05/2026

Re: Claim for physical therapy, member alexei petrov, ID LHP-3301-7782

Hi alexei, thanks for calling. As discussed, visits 21 through 26 of physical therapy (CPT 97110) were denied because your plan covers 20 visits per calendar year. This is a benefit limit under your employer's group health plan, not a medical judgement.

If you believe the limit should not apply, you can appeal. Your plan documents explain the appeal process.`,
    identifiers: ['alexei petrov', 'LHP-3301-7782', '11/05/2026'],
    keep: ['97110', '20 visits per calendar year', 'benefit limit'],
    expected: { noticeDate: '2026-11-05', windowDays: null, planType: 'employer', deadline: '2027-05-04', category: 'not_covered' },
  },
  {
    id: 'C08',
    title: 'Hospital bill, coding error',
    probes: 'Account number, provider address, patient address in one line; CPT and money must survive.',
    text: `Statement date: Oct 31, 2026

Mercy Ridge Medical Center   |   Patient Account No. 00458812733
Patient: Grace Achterberg, 2209 Willow Bend Dr, Fort Collins, CO 80521

Your insurer, Summit Peak Health (employer group plan), denied line 4 of your claim (CPT 99285, $1,980.00) as a duplicate claim. It appears the emergency visit was billed twice with different modifiers.

To dispute this, ask your insurer for an appeal within 180 days of the denial and ask us for a corrected claim. Questions: billing@mercyridge.example or 970-555-0112.`,
    identifiers: ['Grace Achterberg', '00458812733', '2209 Willow Bend Dr', 'Fort Collins, CO 80521', 'billing@mercyridge.example', '970-555-0112', 'Oct 31, 2026'],
    keep: ['99285', '$1,980.00', 'duplicate claim', 'modifiers'],
    expected: { noticeDate: '2026-10-31', windowDays: 180, planType: 'employer', deadline: '2027-04-29', category: 'coding_or_billing' },
  },
  {
    id: 'C09',
    title: 'Medicare Advantage, wheelchair with stated 65-day window',
    probes: 'Name split across lines; Medicare number unlabelled; day-month-year date.',
    text: `Silver Valley Medicare Advantage Plan
Integrated Denial Notice
Issued 3 November 2026

Name:
Beatrice
Okonkwo-Lindqvist

1PX9-RD4-YT62

We will not cover the power wheelchair (HCPCS K0823) your doctor ordered. You do not meet our coverage criteria because records do not show you are unable to use a manual wheelchair. This decision is based on medical necessity.

You must ask for a reconsideration within 65 days of the date of this notice.`,
    identifiers: ['Beatrice', 'Okonkwo-Lindqvist', '1PX9-RD4-YT62', '3 November 2026'],
    keep: ['K0823', 'power wheelchair', 'manual wheelchair'],
    expected: { noticeDate: '2026-11-03', windowDays: 65, planType: 'medicare_advantage', deadline: '2027-01-07', category: 'medical_necessity' },
  },
  {
    id: 'C10',
    title: 'Employer plan, out-of-network anesthesiologist (surprise bill)',
    probes: 'Employer name identifies the patient; patient name in signature-style line; two phone formats.',
    text: `Pinecrest Health Plan
Date: 11/10/2026

Member: Kenji Takahashi (employee of Halvorsen Ridge Brewing Co.)
Member ID PHP-88-410-2277

The anesthesia services from an out-of-network anesthesiologist during your in-network knee surgery on 10/02/2026 were processed at out-of-network rates. You were billed $3,400.00.

You have 180 days to appeal. For help, call 1 (877) 555-0163 or text +1 312.555.0147.

cc: Kenji Takahashi`,
    identifiers: ['Kenji Takahashi', 'Takahashi', 'Halvorsen Ridge Brewing Co.', 'PHP-88-410-2277', '10/02/2026', '(877) 555-0163', '312.555.0147', '11/10/2026'],
    keep: ['out-of-network', 'anesthesia', '$3,400.00', 'knee surgery'],
    expected: { noticeDate: '2026-11-10', windowDays: 180, planType: 'employer', deadline: '2027-05-09', category: 'out_of_network' },
  },
  {
    id: 'C11',
    title: 'Marketplace plan, fertility medication excluded',
    probes: 'A name that is also a common word (Hope, Rivers); window in a footnote.',
    text: `Tidewater Health Cooperative — Marketplace Plans
11/13/2026

Hope Rivers
Member # TWC-60218744

The prescription for letrozole 2.5 mg prescribed for infertility is excluded from your plan's pharmacy benefit (Evidence of Coverage, Section 7.4: infertility treatment exclusion).

There is hope: some states require coverage. Contact the Rivers County consumer assistance office for help.

* You may request an internal appeal within 180 days after you receive this notice.`,
    identifiers: ['Hope Rivers', 'TWC-60218744', '11/13/2026'],
    keep: ['letrozole 2.5 mg', 'infertility treatment exclusion', 'Section 7.4'],
    expected: { noticeDate: '2026-11-13', windowDays: 180, planType: 'marketplace', deadline: '2027-05-12', category: 'not_covered' },
  },
  {
    id: 'C12',
    title: 'Medicaid, prior auth for insulin pump',
    probes: 'Guardian and minor; IP address in a portal footer; window stated as "sixty days".',
    text: `Prairie State Medicaid Health Plan
Notice Date: November 2, 2026

Member: Lily Ann Chen (age 9)
Parent/Guardian: Wei Chen
Medicaid ID: 7720045519

Your provider did not get prior authorization for the Omnipod 5 insulin pump. We denied the request. Please ask your provider to submit the prior authorization form with recent A1C results.

You can appeal within sixty days of this notice. If you need a fair hearing, ask us how.

Accessed from 192.168.14.22 on the member portal.`,
    identifiers: ['Lily Ann Chen', 'Wei Chen', '7720045519', '192.168.14.22', 'November 2, 2026'],
    keep: ['Omnipod 5 insulin pump', 'prior authorization', 'A1C'],
    expected: { noticeDate: '2026-11-02', windowDays: 60, planType: 'medicaid', deadline: '2027-01-01', category: 'prior_authorization' },
  },
  {
    id: 'C13',
    title: 'Unknown plan type, no window: must say "inconclusive"',
    probes: 'No plan type and no window: the app must NOT invent a deadline.',
    text: `Atlas Claims Services
Nov 4, 2026

Dear Rafael Moreno,

Your claim REF-4471-90012 for an allergy panel (CPT 86003 x 40) has been denied. The tests were not medically necessary based on the information submitted.

For questions call our customer service line.`,
    identifiers: ['Rafael Moreno', 'REF-4471-90012', 'Nov 4, 2026'],
    keep: ['86003', 'allergy panel', 'not medically necessary'],
    expected: { noticeDate: '2026-11-04', windowDays: null, planType: 'unknown', deadline: null, category: 'medical_necessity' },
  },
  {
    id: 'C14',
    title: 'Employer plan, bariatric surgery: long letter with many names',
    probes: 'Five people across roles; nurse reviewer; one name only by surname.',
    text: `Granite State Health Plan — Notice of Adverse Benefit Determination
Date of determination: 10/26/2026

Member: Theresa Vance          Member ID GSH-40-882103
Requesting provider: Dr. Michael Ostrowski, Concord Bariatric Associates
Reviewed by: Linda Park, RN, and Dr. Elaine Foster, Medical Director

We reviewed the request for laparoscopic sleeve gastrectomy (CPT 43775). Your BMI is 41.2 and you have type 2 diabetes. The plan requires documentation of a 6-month medically supervised weight-loss program. The records submitted from Ms. Vance's primary care doctor, Dr. Ostrowski's office, do not document this program. The request is denied as not medically necessary.

Your employer group health plan allows you to appeal within 180 days of receiving this notice. Your husband, Robert Vance, may act as your authorized representative.`,
    identifiers: ['Theresa Vance', 'Vance', 'GSH-40-882103', 'Michael Ostrowski', 'Ostrowski', 'Linda Park', 'Elaine Foster', 'Robert Vance', '10/26/2026'],
    keep: ['43775', 'BMI is 41.2', 'type 2 diabetes', '6-month medically supervised weight-loss program'],
    expected: { noticeDate: '2026-10-26', windowDays: 180, planType: 'employer', deadline: '2027-04-24', category: 'medical_necessity' },
  },
  {
    id: 'C15',
    title: 'Marketplace plan, mental health residential treatment',
    probes: 'Sensitive diagnosis must survive (the appeal needs it) while identity goes; street with N. prefix.',
    text: `Blue Mesa Health
Date: November 9, 2026

Destiny Harper-Cole
415 N. Juniper Avenue
Santa Fe, NM 87501
Member ID: BMH-2219-0044

Residential treatment for anorexia nervosa (ICD-10 F50.01) at Canyon Light Recovery was denied after day 14. Our reviewer found that a lower level of care, partial hospitalization, is appropriate.

Federal mental health parity law applies to this plan. You may appeal within 180 days of this notice. This is a Marketplace plan.`,
    identifiers: ['Destiny Harper-Cole', '415 N. Juniper Avenue', 'Santa Fe, NM 87501', 'BMH-2219-0044', 'November 9, 2026'],
    keep: ['F50.01', 'anorexia nervosa', 'partial hospitalization', 'parity'],
    expected: { noticeDate: '2026-11-09', windowDays: 180, planType: 'marketplace', deadline: '2027-05-08', category: 'medical_necessity' },
  },
  {
    id: 'C16',
    title: 'Employer plan, hearing aids not covered',
    probes: 'Look-alike numbers that are NOT identifiers (a policy section, a year, a dollar amount, a phone-like policy code).',
    text: `Redwood Coast Employee Benefits Trust
Date: 11/11/2026

Participant: Owen Delacroix, ID RCEBT-0097731

Hearing aids (HCPCS V5261) are excluded under Article 12.3 of the 2026 Summary Plan Description. Billed: $4,890.00. This is an exclusion, not a medical necessity decision.

As an ERISA plan participant, you may appeal within 180 days.`,
    identifiers: ['Owen Delacroix', 'RCEBT-0097731', '11/11/2026'],
    keep: ['V5261', 'Article 12.3', '2026 Summary Plan Description', '$4,890.00'],
    expected: { noticeDate: '2026-11-11', windowDays: 180, planType: 'employer', deadline: '2027-05-10', category: 'not_covered' },
  },
];
