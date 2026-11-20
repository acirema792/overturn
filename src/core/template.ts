// A plain-code appeal letter. It is the last resort when neither Gemini Nano
// nor the cloud is reachable, so the patient always leaves with something they
// can send. It uses the same placeholders, filled in locally.

import { CATEGORY_LABEL, CATEGORY_PLAYBOOK, type DenialCategory } from './categories';
import type { AppealResult } from '../ai/schemas';

export interface TemplateInput {
  category: DenialCategory;
  serviceDenied: string;
  insurer: string;
  vault: Record<string, string>;
  /** Placeholder of the patient, if known. */
  patient?: string;
  urgent: boolean;
}

/**
 * First line that looks like an organisation name, not a dateline, a field or
 * a person (`people`: names already found in the letter).
 */
export function insurerFromLetter(letter: string, people: string[] = []): string {
  const known = new Set(people.map((p) => p.toLowerCase().trim()));
  for (const raw of letter.split('\n')) {
    let line = raw.split('|')[0].trim();
    const from = line.match(/^from\s*:\s*(.+)$/i);
    if (from) line = from[1].trim();
    if (!line || /\d/.test(line) || /:/.test(line) || line.length > 70) continue;
    if (known.has(line.toLowerCase())) continue;
    return line;
  }
  return '';
}

const firstOf = (vault: Record<string, string>, label: string) =>
  Object.keys(vault).find((k) => k.startsWith(`[${label}_`));

export function templateAppeal(t: TemplateInput): AppealResult {
  // Only a placeholder the on-device model labelled "patient". Guessing the
  // first name in the letter can pick the doctor or a family member.
  const patient = t.patient ?? '____';
  const member = firstOf(t.vault, 'MEMBER_ID') ?? '____';
  const claim = firstOf(t.vault, 'CLAIM_ID') ?? firstOf(t.vault, 'ACCOUNT_ID') ?? '____';
  const service = t.serviceDenied || 'the service described in your notice';
  const insurer = t.insurer || '____ (insurance company name)';
  const reason = CATEGORY_LABEL[t.category].toLowerCase();

  const letter = `${insurer}
Attn: Appeals Department

Re: Request for internal appeal
Member: ${patient}
Member ID: ${member}
Claim / reference: ${claim}

To whom it may concern,

I am writing to appeal your decision to deny coverage for ${service}. Your notice gives the reason as "${reason}". I disagree with this decision and ask for a full and fair review.${t.urgent ? ' Because waiting could seriously harm my health, I ask that this appeal be expedited and decided within 72 hours.' : ''}

My treating provider recommended this care because it is appropriate for my condition. I am enclosing supporting documents, including:
${CATEGORY_PLAYBOOK[t.category].map((e) => `- ${e}`).join('\n')}

Please also send me, free of charge, a complete copy of my claim file and the criteria, clinical policy or plan provision you relied on to make this decision.

Please reverse the denial and approve coverage. If you uphold it, please explain the specific reasons and tell me how to request an independent external review.

Sincerely,
${patient}
____ (signature)    Date: ____`;

  return {
    plainExplanation: `Your plan denied ${service}. The reason category is: ${CATEGORY_LABEL[t.category]}. You have the right to appeal, and you can ask for the documents the plan used.`,
    strongestArguments: [
      'Your doctor recommended this care for your condition.',
      'You are entitled to a full and fair review and to see the criteria used.',
    ],
    evidenceToGather: CATEGORY_PLAYBOOK[t.category],
    questionsForDoctor: [
      'Can you write a letter of medical necessity that answers the plan’s criteria?',
      'Can you send my chart notes and test results for this treatment?',
    ],
    appealLetter: letter,
  };
}
