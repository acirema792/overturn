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

export const CATEGORY_LABEL_ES: Record<DenialCategory, string> = {
  medical_necessity: 'No es médicamente necesario',
  prior_authorization: 'Sin autorización previa',
  out_of_network: 'Fuera de la red',
  experimental: 'Experimental o en investigación',
  not_covered: 'No es un beneficio cubierto',
  coding_or_billing: 'Error de códigos o facturación',
  step_therapy: 'Terapia escalonada / probar otro medicamento primero',
  other: 'Otro motivo',
};

export const CATEGORY_PLAYBOOK_ES: Record<DenialCategory, string[]> = {
  medical_necessity: [
    'Una carta de necesidad médica de tu médico que responda punto por punto a los criterios del plan',
    'Notas clínicas con tus síntomas, cuánto tiempo llevan y los tratamientos ya probados',
    'La política clínica del plan para este servicio (pídela: tienes derecho a una copia gratis)',
    'Guías publicadas que respalden el tratamiento',
  ],
  prior_authorization: [
    'Prueba de que tu proveedor pidió la autorización, o de por qué fue una emergencia',
    'Cualquier número de referencia de llamadas con el plan',
    'Una solicitud de autorización retroactiva de tu proveedor',
  ],
  out_of_network: [
    'Prueba de que ningún proveedor de la red podía atenderte en un tiempo o distancia razonables',
    'Si fue una emergencia o no pudiste elegir proveedor (protecciones de la Ley No Surprises)',
    'Cualquier referido de un médico de la red',
  ],
  experimental: [
    'Estudios revisados por pares o aprobación de la FDA que muestren que el tratamiento es estándar',
    'Una carta de tu médico sobre por qué las opciones estándar fallaron o no te sirven',
  ],
  not_covered: [
    'La sección exacta del documento del plan que usó la aseguradora (pide el Resumen de la Descripción del Plan)',
    'Cualquier ley estatal que obligue a cubrir el servicio',
  ],
  coding_or_billing: [
    'Una factura detallada con los códigos de procedimiento (CPT) y diagnóstico (ICD-10)',
    'Una reclamación corregida de la oficina de facturación de tu proveedor',
  ],
  step_therapy: [
    'Registros de los medicamentos que ya probaste, con fechas y por qué fallaron o causaron efectos secundarios',
    'Una solicitud de excepción a la terapia escalonada de tu médico',
  ],
  other: [
    'Una copia de tu expediente de reclamación y de las reglas del plan usadas en la decisión (gratis si la pides)',
    'Una nota de tu proveedor que respalde el servicio',
  ],
};

export const categoryLabel = (c: DenialCategory, lang: 'en' | 'es' = 'en') => (lang === 'es' ? CATEGORY_LABEL_ES[c] : CATEGORY_LABEL[c]);
export const categoryPlaybook = (c: DenialCategory, lang: 'en' | 'es' = 'en') => (lang === 'es' ? CATEGORY_PLAYBOOK_ES[c] : CATEGORY_PLAYBOOK[c]);
