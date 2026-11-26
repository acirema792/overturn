// A plain-code appeal letter. It is the last resort when neither Gemini Nano
// nor the cloud is reachable, so the patient always leaves with something they
// can send. It uses the same placeholders, filled in locally.

import { CATEGORY_LABEL, CATEGORY_LABEL_ES, CATEGORY_PLAYBOOK, CATEGORY_PLAYBOOK_ES, type DenialCategory } from './categories';
import type { AppealResult } from '../ai/schemas';

export interface TemplateInput {
  category: DenialCategory;
  serviceDenied: string;
  insurer: string;
  vault: Record<string, string>;
  /** Placeholder of the patient, if known. */
  patient?: string;
  urgent: boolean;
  /** Language of the explanation for the patient; the letter itself stays English. */
  lang?: 'en' | 'es';
}

/**
 * First line that looks like an organisation name, not a dateline, a field or
 * a person (`people`: names already found in the letter).
 */
export function insurerFromLetter(letter: string, people: string[] = []): string {
  const known = people.map((p) => p.toLowerCase().trim()).filter(Boolean);
  for (const raw of letter.split('\n')) {
    let line = raw.trim();
    const from = line.match(/^from\s*:\s*(.+)$/i);
    if (from) line = from[1].trim();
    // Keep the part before an address, phone, separator or bracket:
    // "Northwind Health Plan, P.O. Box 44120…" → "Northwind Health Plan".
    // Keep the part before an address, phone or separator ("Northwind Health
    // Plan, P.O. Box…" → "Northwind Health Plan"); a part that still has a
    // digit is a dateline, a page header or a claim line, so skip the line.
    line = line.split(/,|\||·|\(|\s[-–]\s/)[0].trim();
    if (/\d/.test(line)) continue;
    if (line.length < 3 || /:/.test(line) || line.length > 70 || !/\p{L}{2}/u.test(line)) continue;
    const lower = line.toLowerCase();
    if (known.some((k) => lower.includes(k))) continue;
    if (/^(?:dr|mr|mrs|ms|miss)\.?\s/i.test(line)) continue;
    return line;
  }
  return '';
}

const firstOf = (vault: Record<string, string>, label: string) =>
  Object.keys(vault).find((k) => k.startsWith(`[${label}_`));

/** What the patient encloses, in the letter's own voice (the checklist on screen keeps the advice wording). */
const ENCLOSURES: Record<DenialCategory, string[]> = {
  medical_necessity: [
    'A letter of medical necessity from my doctor that addresses your criteria point by point',
    'My chart notes showing my symptoms, how long they have lasted and the treatments already tried',
  ],
  prior_authorization: [
    'Records showing that my provider requested authorization, or why the care was urgent',
    'My provider\u2019s request for retroactive authorization',
  ],
  out_of_network: [
    'Records showing that no in-network provider could give this care within a reasonable time or distance',
    'Details of the emergency or referral that led to this provider',
  ],
  experimental: [
    'Published studies and guidelines showing this treatment is standard of care for my condition',
    'A letter from my doctor explaining why the standard options failed or are unsuitable for me',
  ],
  not_covered: ['The section of my plan documents that I believe covers this service', 'A letter from my provider supporting the service'],
  coding_or_billing: ['An itemized bill with the procedure and diagnosis codes', 'A corrected claim from my provider\u2019s billing office'],
  step_therapy: [
    'Records of the medications I have already tried, with dates and why they failed or caused side effects',
    'My doctor\u2019s step-therapy exception request',
  ],
  other: ['A letter from my provider supporting this service', 'Relevant medical records'],
};

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

My treating provider recommended this care because it is appropriate for my condition. I am enclosing:
${ENCLOSURES[t.category].map((e) => `- ${e}`).join('\n')}

Please also send me, free of charge, a complete copy of my claim file and the criteria, clinical policy or plan provision you relied on to make this decision.

Please reverse the denial and approve coverage. If you uphold it, please explain the specific reasons and tell me how to request an independent external review.

Sincerely,
${patient}
____ (signature)    Date: ____`;

  if (t.lang === 'es') {
    const servicio = t.serviceDenied || 'el servicio descrito en tu aviso';
    return {
      plainExplanation: `Tu plan negó ${servicio}. El motivo es: ${CATEGORY_LABEL_ES[t.category]}. Tienes derecho a apelar y a pedir los documentos que usó el plan. La carta de abajo está en inglés porque va dirigida a tu aseguradora.`,
      strongestArguments: [
        'Tu médico recomendó esta atención para tu condición.',
        'Tienes derecho a una revisión completa y justa y a ver los criterios que se usaron.',
      ],
      evidenceToGather: CATEGORY_PLAYBOOK_ES[t.category],
      questionsForDoctor: [
        '¿Puede escribir una carta de necesidad médica que responda a los criterios del plan?',
        '¿Puede enviar mis notas clínicas y resultados de pruebas para este tratamiento?',
      ],
      appealLetter: letter,
    };
  }

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
