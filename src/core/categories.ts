export const DENIAL_CATEGORIES = [
  'medical_necessity',
  'prior_authorization',
  'out_of_network',
  'experimental',
  'not_covered',
  'coding_or_billing',
  'step_therapy',
  'other',
] as const;

export type DenialCategory = (typeof DENIAL_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<DenialCategory, string> = {
  medical_necessity: 'Not medically necessary',
  prior_authorization: 'No prior authorization',
  out_of_network: 'Out of network',
  experimental: 'Experimental or investigational',
  not_covered: 'Not a covered benefit',
  coding_or_billing: 'Coding or billing error',
  step_therapy: 'Step therapy / try another drug first',
  other: 'Other reason',
};

/** What usually wins an appeal in each category: the evidence checklist. */
export const CATEGORY_PLAYBOOK: Record<DenialCategory, string[]> = {
  medical_necessity: [
    'A letter of medical necessity from your doctor that answers the plan’s criteria point by point',
    'Chart notes showing symptoms, duration and treatments already tried',
    'The plan’s own clinical policy for this service (ask for it: you are entitled to a free copy)',
    'Published guidelines that support the treatment',
  ],
  prior_authorization: [
    'Proof the provider requested authorization, or why it was an emergency',
    'Any reference number from calls with the plan',
    'A request for retroactive authorization from your provider',
  ],
  out_of_network: [
    'Proof no in-network provider could do this within a reasonable time or distance',
    'Whether it was an emergency or you had no choice of provider (No Surprises Act protections)',
    'Any referral from an in-network doctor',
  ],
  experimental: [
    'Peer-reviewed studies or FDA approval showing the treatment is standard of care',
    'A doctor’s letter on why standard options failed or are unsuitable',
  ],
  not_covered: [
    'The exact plan document section the plan relied on (request the Summary Plan Description)',
    'Any state benefit mandate that requires coverage',
  ],
  coding_or_billing: [
    'An itemized bill and the claim’s procedure (CPT) and diagnosis (ICD-10) codes',
    'A corrected claim from the provider’s billing office',
  ],
  step_therapy: [
    'Records of drugs already tried, with dates and why they failed or caused side effects',
    'A step-therapy exception request from your doctor',
  ],
  other: [
    'A copy of your claim file and the plan rules used in the decision (free on request)',
    'A note from your provider supporting the service',
  ],
};

const KEYWORDS: [DenialCategory, RegExp][] = [
  ['step_therapy', /step therapy|try (?:and fail|another)|first[- ]line|formulary alternative/i],
  ['experimental', /experimental|investigational|unproven/i],
  ['prior_authorization', /prior (?:authori[sz]ation|approval)|pre-?authori[sz]ation|precertification|not authori[sz]ed in advance/i],
  ['out_of_network', /out[- ]of[- ]network|non-?participating|not in (?:our|the plan's) network/i],
  ['coding_or_billing', /coding|billed incorrectly|modifier|duplicate claim|invalid (?:procedure|diagnosis) code|bundl/i],
  ['medical_necessity', /medical(?:ly)? necess|not necessary|clinical criteria|does not meet (?:our )?(?:coverage )?criteria|lower level of care|level of care is appropriate/i],
  ['not_covered', /not a covered|excluded|exclusion|not covered under|benefit limit/i],
];

export function classifyDenial(text: string): DenialCategory {
  // Drop negated mentions: "This is an exclusion, not a medical necessity decision."
  const t = text.replace(/\bnot an? [a-z ]{0,30}?(?:decision|determination|judg(?:e)?ment)\b/gi, ' ');
  for (const [cat, re] of KEYWORDS) if (re.test(t)) return cat;
  return 'other';
}
