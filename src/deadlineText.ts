// Spanish deadline and external-review sentences, built from the code's
// structured deadline result (never machine-translated).
import type { Lang } from './i18n';
import type { Analysis } from './pipeline';

const PLAN_RULE_ES: Record<string, string> = {
  employer: 'Los planes de salud de empleadores (ERISA) deben dar al menos 180 días para apelar.',
  marketplace: 'Los planes individuales y del Mercado de Seguros (ACA) deben dar 180 días para una apelación interna.',
  medicare_advantage: 'Las solicitudes de reconsideración de Medicare Advantage vencen 65 días después del aviso.',
  medicaid: 'Las apelaciones de Medicaid (atención administrada) vencen 60 días después de la decisión.',
};

/** The deadline sentence, built from the code's structured result (never machine-translated). */
export function deadlineExplanation(a: Analysis, lang: Lang): string {
  const d = a.deadline;
  if (lang === 'en') return d.explanation;
  let base: string;
  // Branch on the window itself: without a notice date the basis is 'unknown'
  // even when the letter states a window (see src/core/deadline.ts).
  const stated = d.windowDays !== null && a.facts.windowDays === d.windowDays;
  if (stated) base = `Tu carta dice que tienes ${d.windowDays} días para apelar.`;
  else if (d.windowDays !== null)
    base = `La carta no indica un plazo, así que usamos el mínimo legal: ${PLAN_RULE_ES[a.facts.planType] ?? ''} Confírmalo con tu plan.`;
  else
    base =
      'No encontramos un plazo para apelar en la carta ni pudimos saber qué tipo de plan es. Llama al número de tu tarjeta del seguro y pregunta: "¿Cuál es mi fecha límite para apelar esta decisión?"';
  return d.deadline ? base : `${base}${a.facts.noticeDate ? '' : ' Tampoco pudimos leer la fecha del aviso, así que no podemos calcular la fecha exacta.'}`;
}

const EXTERNAL_ES: Record<string, string> = {
  employer: 'Si niegan tu apelación interna, normalmente puedes pedir una revisión externa independiente dentro de 4 meses.',
  marketplace: 'Si niegan tu apelación interna, puedes pedir una revisión externa independiente dentro de 4 meses.',
  medicare_advantage: 'Si el plan mantiene la negación, el caso se envía automáticamente a una Entidad de Revisión Independiente.',
  medicaid: 'Si el plan mantiene la negación, puedes pedir una Audiencia Imparcial Estatal (normalmente dentro de 120 días).',
  unknown: 'Si niegan tu apelación interna, pregunta a tu plan cómo pedir una revisión externa independiente.',
};
export function externalReviewText(a: Analysis, lang: Lang): string {
  return lang === 'es' ? (EXTERNAL_ES[a.facts.planType] ?? EXTERNAL_ES.unknown) : a.deadline.externalReview;
}
