// Shared evaluation runner: used by `npm run eval` (Node, rules only) and by
// the in-app Benchmark page (in the judge's own Chrome, with Gemini Nano).

import { CASES, type EvalCase } from '../data/cases';
import { redact, type FoundEntity } from '../core/redact';
import { checkEgress } from '../core/egressGate';
import { computeDeadline, findNoticeDate, findWindowDays, guessPlanType } from '../core/deadline';
import { classifyDenial, type DenialCategory } from '../core/categories';

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface CaseResult {
  id: string;
  title: string;
  /** Planted identifiers still present in what would be sent to the cloud. */
  leaked: string[];
  identifiers: number;
  /** Clinical facts the appeal needs that redaction destroyed. */
  lost: string[];
  keep: number;
  gateAllowed: boolean;
  deadline: { expected: string | null; got: string | null; ok: boolean };
  category: { expected: DenialCategory; got: DenialCategory; ok: boolean };
  entitySource: string;
  ms: number;
}

export interface EvalSummary {
  label: string;
  cases: number;
  identifiers: number;
  leakedBaseline: number;
  leaked: number;
  casesWithLeak: number;
  keepTotal: number;
  lost: number;
  gateBlocked: number;
  deadlineOk: number;
  categoryOk: number;
  results: CaseResult[];
  ranAt: string;
  environment: string;
}

export type EntityProvider = (text: string) => Promise<{ entities: FoundEntity[]; category?: DenialCategory; source: string }>;

const containsValue = (haystack: string, value: string) => squash(haystack).includes(squash(value));

export async function runCase(c: EvalCase, provider?: EntityProvider): Promise<CaseResult> {
  const t0 = performance.now();
  const extra = provider ? await provider(c.text) : { entities: [], source: 'rules only' };
  const r = redact(c.text, extra.entities);
  const leaked = c.identifiers.filter((id) => containsValue(r.redacted, id));
  const lost = c.keep.filter((k) => !c.text.includes(k) || !r.redacted.includes(k));
  const gate = checkEgress(r.redacted, r.vault);

  // Code decides the deadline from locally extracted facts.
  const noticeDate = findNoticeDate(c.text);
  const windowDays = findWindowDays(c.text);
  const planType = guessPlanType(c.text);
  const dl = computeDeadline({ noticeDate, statedWindowDays: windowDays, planType, today: '2026-11-20' });

  const rulesCategory = classifyDenial(c.text);
  const category = extra.category ?? rulesCategory;

  return {
    id: c.id,
    title: c.title,
    leaked,
    identifiers: c.identifiers.length,
    lost,
    keep: c.keep.length,
    gateAllowed: gate.allowed,
    deadline: { expected: c.expected.deadline, got: dl.deadline, ok: dl.deadline === c.expected.deadline },
    category: { expected: c.expected.category, got: category, ok: category === c.expected.category },
    entitySource: extra.source,
    ms: Math.round(performance.now() - t0),
  };
}

export async function runEval(
  label: string,
  provider?: EntityProvider,
  environment = 'node',
  cases: EvalCase[] = CASES,
): Promise<EvalSummary> {
  const results: CaseResult[] = [];
  for (const c of cases) results.push(await runCase(c, provider));
  const sum = (f: (r: CaseResult) => number) => results.reduce((a, r) => a + f(r), 0);
  return {
    label,
    cases: results.length,
    identifiers: sum((r) => r.identifiers),
    // Baseline: pasting the letter into a cloud chatbot sends every identifier.
    leakedBaseline: sum((r) => r.identifiers),
    leaked: sum((r) => r.leaked.length),
    casesWithLeak: results.filter((r) => r.leaked.length > 0).length,
    keepTotal: sum((r) => r.keep),
    lost: sum((r) => r.lost.length),
    gateBlocked: results.filter((r) => !r.gateAllowed).length,
    deadlineOk: results.filter((r) => r.deadline.ok).length,
    categoryOk: results.filter((r) => r.category.ok).length,
    results,
    ranAt: new Date().toISOString(),
    environment,
  };
}

export function renderMarkdown(s: EvalSummary): string {
  const lines = [
    `### ${s.label}`,
    '',
    `Ran ${s.ranAt} in ${s.environment}. ${s.cases} synthetic letters, ${s.identifiers} planted identifiers, ${s.keepTotal} clinical facts that must survive.`,
    '',
    '| Metric | Paste into a cloud chatbot | Overturn |',
    '|---|---|---|',
    `| Identifiers that would reach the cloud | ${s.leakedBaseline}/${s.identifiers} | **${s.leaked}/${s.identifiers}** (${s.casesWithLeak} letters affected) |`,
    `| Clinical facts preserved for the appeal | ${s.keepTotal}/${s.keepTotal} | **${s.keepTotal - s.lost}/${s.keepTotal}** |`,
    `| Payloads the egress gate blocked | n/a | ${s.gateBlocked}/${s.cases} |`,
    `| Appeal deadline correct (code-computed) | n/a | **${s.deadlineOk}/${s.cases}** |`,
    `| Denial reason correct | n/a | ${s.categoryOk}/${s.cases} |`,
    '',
    '| Case | Leaked | Lost facts | Gate | Deadline (expected → got) | Reason (expected → got) |',
    '|---|---|---|---|---|---|',
    ...s.results.map(
      (r) =>
        `| ${r.id} ${r.title} | ${r.leaked.length ? r.leaked.map((x) => '`' + x + '`').join(', ') : '0'} | ${r.lost.length ? r.lost.join(', ') : '0'} | ${r.gateAllowed ? 'pass' : 'BLOCKED'} | ${r.deadline.expected ?? 'none'} → ${r.deadline.got ?? 'none'} ${r.deadline.ok ? '✓' : '✗'} | ${r.category.expected} → ${r.category.got} ${r.category.ok ? '✓' : '✗'} |`,
    ),
  ];
  return lines.join('\n');
}
