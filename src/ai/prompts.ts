import { CATEGORY_LABEL, CATEGORY_PLAYBOOK, type DenialCategory } from '../core/categories';
import type { PlanType } from '../core/deadline';

/** On-device only: the raw letter never leaves the browser. */
export const entityPrompt = (letter: string) => `You are a privacy assistant running on the user's own computer.
List every piece of personal information in this health insurance letter so it can be hidden before anything is shared.
Include: every person's name (patient, family members, caregivers, doctors, nurses, staff) exactly as written, even if lowercase or split across lines; member, claim, account, policy and record numbers; street addresses; the patient's phone numbers, emails and web links; the patient's employer or school.
Do not include the insurance company, hospital names, drug names, medical codes or dollar amounts.
Copy each item exactly as it appears in the letter.

LETTER:
"""
${letter}
"""`;

/** On-device only. */
export const factsPrompt = (letter: string, lang: 'en' | 'es' = 'en') => `You read a US health insurance denial letter on the user's own computer.
Extract the facts as JSON.
- planType: "employer" for job-based / ERISA / group plans, "marketplace" for HealthCare.gov / ACA individual plans, "medicare_advantage", "medicaid", otherwise "unknown".
- denialCategory: the main reason for the denial.
- serviceDenied: the service, drug or item that was denied, in English as the letter names it (keep CPT/ICD codes).
- noticeDate: the date printed on the notice, as YYYY-MM-DD; empty if none.
- appealWindowDays: the number of days the letter gives to appeal; 0 if the letter does not say.
- reasonInPlainWords: explain the reason to a worried patient in one or two short sentences, without any names or ID numbers${lang === 'es' ? ', written in Spanish' : ''}.

LETTER:
"""
${letter}
"""`;

/** On-device only: photo → text. */
export const transcribePrompt =
  'Transcribe all the text in this photo of a letter exactly, line by line. Output only the text.';

export interface AppealContext {
  redactedLetter: string;
  category: DenialCategory;
  planType: PlanType;
  serviceDenied: string;
  daysLeft: number | null;
  urgent: boolean;
  /** "[PERSON_1]: patient" lines, from the on-device model's role labels. */
  roles: string[];
  /** Language of the explanation for the patient; the letter itself stays English. */
  lang?: 'en' | 'es';
}

const PLAN_LABEL: Record<PlanType, string> = {
  employer: 'an employer-sponsored (ERISA) group health plan',
  marketplace: 'an ACA Marketplace / individual plan',
  medicare_advantage: 'a Medicare Advantage plan',
  medicaid: 'a Medicaid managed-care plan',
  unknown: 'a plan of unknown type',
};

/**
 * The only prompt that may go to the cloud. It is built from the REDACTED
 * letter plus facts computed on the device, and it must pass the egress gate
 * before it is sent. It deliberately contains no dates: the deadline is
 * computed on the device and only "days left" is shared.
 */
export const appealPrompt = (c: AppealContext) => `You help a patient in the United States appeal a health insurance denial.

The letter below was de-identified on the patient's device. Placeholders such as [PERSON_1], [MEMBER_ID_1], [CLAIM_ID_1], [DATE_2] or [ADDRESS_1] stand for real values that will be filled back in on the patient's device after you answer.
Rules:
1. When the appeal needs one of these values, write the placeholder exactly as it appears (same brackets, same number). Use only placeholders that appear in the letter.
2. Never invent names, ID numbers, dates, phone numbers or addresses. If something is needed but missing, write a fill-in like ____ .
   Addresses, phone numbers and emails in a letterhead or a "call us" line belong to the insurer, not the patient: never use them as the patient's own contact details (write ____ instead).
3. Base every argument on what the letter says and on how US appeals work. Do not promise an outcome.
4. Write the appeal letter in the patient's voice, formal and firm, under 400 words. Reference the claim or ID placeholders in a "Re:" line. Ask for a full and fair review, and ask for a free copy of the claim file and the clinical criteria used.
5. Use plain English a stressed patient understands.${c.lang === 'es' ? '\n6. Write plainExplanation, strongestArguments, evidenceToGather and questionsForDoctor in simple, clear Spanish. Write appealLetter in English, because it goes to a US insurer.' : ''}

What the device already knows:
- Plan: ${PLAN_LABEL[c.planType]}.
- Reason category: ${CATEGORY_LABEL[c.category]}.
- Denied: ${c.serviceDenied || 'see letter'}.
- Days left to appeal: ${c.daysLeft === null ? 'unknown (the patient must confirm with the plan)' : c.daysLeft}.
- ${c.urgent ? 'Ongoing or urgent care: mention the right to an expedited (72-hour) appeal.' : 'Not marked urgent.'}
${c.roles.length ? `- Who is who: ${c.roles.join('; ')}.` : ''}
- Evidence that usually matters for this kind of denial: ${CATEGORY_PLAYBOOK[c.category].join('; ')}.

DE-IDENTIFIED LETTER:
"""
${c.redactedLetter}
"""`;
