import { appealPrompt } from './ai/prompts';
import type { Engine, LedgerEntry } from './ai/engine';
import { ledgerEntry } from './ai/engine';
import type { EntityResult, FactsResult } from './ai/schemas';
import { classifyDenial, type DenialCategory } from './core/categories';
import {
  computeDeadline,
  findNoticeDate,
  findWindowDays,
  guessPlanType,
  parseISO,
  type DeadlineResult,
  type PlanType,
} from './core/deadline';
import { detect, type IdKind } from './core/detectors';
import { nameFragments, redact, type FoundEntity, type Redaction } from './core/redact';
import { findSuspects } from './core/suspects';
import { insurerFromLetter } from './core/template';

export type FactSource = 'letter text (code)' | 'Gemini Nano' | 'legal default' | 'not found';

export interface Facts {
  insurer: string;
  /** True when Gemini Nano named the insurer; a guess from the letterhead is not trusted to suppress name hints. */
  insurerFromModel: boolean;
  serviceDenied: string;
  reasonInPlainWords: string;
  category: DenialCategory;
  categorySource: FactSource;
  planType: PlanType;
  planTypeSource: FactSource;
  noticeDate: string | null;
  noticeDateSource: FactSource;
  windowDays: number | null;
  windowSource: FactSource;
  urgent: boolean;
}

export interface Analysis {
  raw: string;
  deviceRan: boolean;
  deviceError?: string;
  modelEntities: FoundEntity[];
  userEntities: FoundEntity[];
  roles: Record<string, string>; // lower-cased name → role
  redaction: Redaction;
  facts: Facts;
  deadline: DeadlineResult;
  suspects: string[];
  ledger: LedgerEntry[];
}

export function entitiesFromModel(r: EntityResult): FoundEntity[] {
  const add = (text: string, kind: IdKind): FoundEntity => ({ text, kind, source: 'on-device' });
  return [
    ...r.people.map((p) => add(p.name, 'PERSON')),
    ...r.identifiers.map((v) => add(v, 'ID')),
    ...r.addresses.map((v) => add(v, 'ADDRESS')),
    ...r.contacts.map((v) => add(v, v.includes('@') ? 'EMAIL' : /^\W*\+?\d/.test(v) ? 'PHONE' : 'URL')),
    ...r.organisationsAboutThePatient.map((v) => add(v, 'PERSON')),
  ].filter((e) => e.text && e.text.trim().length >= 2);
}

/**
 * The model may hallucinate entities that aren't in the letter; keep only
 * values that actually occur (case- and space-insensitively).
 */
export function groundEntities(raw: string, entities: FoundEntity[]): FoundEntity[] {
  const hay = raw.toLowerCase().replace(/\s+/g, ' ');
  return entities.filter((e) => hay.includes(e.text.toLowerCase().replace(/\s+/g, ' ').trim()));
}

function mergeFacts(raw: string, model?: FactsResult): Facts {
  const regexDate = findNoticeDate(raw);
  const modelDate = model && parseISO(model.noticeDate) ? model.noticeDate : null;
  const regexWindow = findWindowDays(raw);
  const modelWindow = model && model.appealWindowDays > 0 && model.appealWindowDays <= 400 ? model.appealWindowDays : null;
  const rulesPlan = guessPlanType(raw);
  const rulesCategory = classifyDenial(raw);

  // Code wins whenever it found something; the model fills the gaps.
  const planType: PlanType = rulesPlan !== 'unknown' ? rulesPlan : (model?.planType ?? 'unknown');
  return {
    insurer: model?.insurer || insurerFromLetter(raw, detect(raw).filter((d) => d.kind === 'PERSON').map((d) => d.text)),
    insurerFromModel: Boolean(model?.insurer),
    serviceDenied: model?.serviceDenied ?? '',
    reasonInPlainWords: model?.reasonInPlainWords ?? '',
    category: model?.denialCategory ?? rulesCategory,
    categorySource: model ? 'Gemini Nano' : 'letter text (code)',
    planType,
    planTypeSource: rulesPlan !== 'unknown' ? 'letter text (code)' : model && model.planType !== 'unknown' ? 'Gemini Nano' : 'not found',
    noticeDate: regexDate ?? modelDate,
    noticeDateSource: regexDate ? 'letter text (code)' : modelDate ? 'Gemini Nano' : 'not found',
    windowDays: regexWindow ?? modelWindow,
    windowSource: regexWindow ? 'letter text (code)' : modelWindow ? 'Gemini Nano' : 'not found',
    urgent: model?.urgent ?? /expedit|urgent|ongoing (?:care|treatment)|hospital stay|inpatient/i.test(raw),
  };
}

export function finishAnalysis(base: Omit<Analysis, 'redaction' | 'deadline' | 'suspects'>, today?: string): Analysis {
  const t0 = performance.now();
  const redaction = redact(base.raw, [...base.modelEntities, ...base.userEntities]);
  const deadline = computeDeadline({
    noticeDate: base.facts.noticeDate,
    statedWindowDays: base.facts.windowDays,
    planType: base.facts.planType,
    today,
  });
  const suspects = findSuspects(redaction.redacted, base.facts.insurerFromModel ? [base.facts.insurer] : []);
  const codeEntry = ledgerEntry({
    step: 'Hide personal details + compute deadline',
    where: 'code',
    bytesOut: 0,
    geminiRequests: 0,
    ms: Math.round(performance.now() - t0),
    note: `${Object.keys(redaction.vault).length} values replaced with placeholders`,
  });
  return { ...base, redaction, deadline, suspects, ledger: [...base.ledger.filter((e) => e.where !== 'code'), codeEntry] };
}

export async function analyse(engine: Engine, raw: string, useDevice: boolean): Promise<Analysis> {
  const ledger: LedgerEntry[] = [];
  let modelEntities: FoundEntity[] = [];
  let modelFacts: FactsResult | undefined;
  let deviceRan = false;
  let deviceError: string | undefined;
  const roles: Record<string, string> = {};

  if (useDevice) {
    try {
      const e = await engine.findEntities(raw);
      ledger.push(e.entry);
      modelEntities = groundEntities(raw, entitiesFromModel(e.result));
      for (const p of e.result.people) roles[p.name.toLowerCase().trim()] = p.role;
      const f = await engine.readFacts(raw);
      ledger.push(f.entry);
      modelFacts = f.result;
      deviceRan = true;
    } catch (err) {
      deviceError = err instanceof Error ? err.message : String(err);
    }
  }

  return finishAnalysis({
    raw,
    deviceRan,
    deviceError,
    modelEntities,
    userEntities: [],
    roles,
    facts: mergeFacts(raw, modelFacts),
    ledger,
  });
}

/** "[PERSON_1]: patient" lines for the cloud prompt, from on-device role labels. */
export function roleLines(a: Analysis): string[] {
  const out: string[] = [];
  for (const [ph, value] of Object.entries(a.redaction.vault)) {
    const role = a.roles[value.toLowerCase().trim()];
    if (role && ph.startsWith('[PERSON_')) out.push(`${ph} = ${role.replace(/_/g, ' ')}`);
  }
  return out;
}

export function patientPlaceholder(a: Analysis): string | undefined {
  return Object.entries(a.redaction.vault).find(([ph, v]) => ph.startsWith('[PERSON_') && a.roles[v.toLowerCase().trim()] === 'patient')?.[0];
}

/** Replace any vault value inside model-written text with its placeholder. */
export function applyVault(text: string, vault: Record<string, string>): string {
  let out = text;
  const entries = Object.entries(vault).sort((x, y) => y[1].length - x[1].length);
  for (const [ph, value] of entries) {
    if (value.trim().length < 2) continue;
    const re = new RegExp(value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
    out = out.replace(re, ph);
  }
  // Then name parts ("MRI for Gonzalez"), when only one person has that part.
  const owners = new Map<string, Set<string>>();
  for (const [ph, value] of entries) {
    if (!ph.startsWith('[PERSON_')) continue;
    for (const frag of nameFragments(value)) owners.set(frag, (owners.get(frag) ?? new Set()).add(ph));
  }
  for (const [frag, phs] of owners) {
    if (phs.size !== 1) continue;
    const re = new RegExp(`(?<![\\p{L}])(?:${frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:['’]s)?(?![\\p{L}])`, 'giu');
    out = out.replace(re, [...phs][0]);
  }
  return out;
}

export function buildAppealPrompt(a: Analysis): string {
  return appealPrompt({
    redactedLetter: a.redaction.redacted,
    category: a.facts.category,
    planType: a.facts.planType,
    // Written by the on-device model from the RAW letter, so it may contain a
    // name ("MRI for Maria"): map it through the vault first.
    serviceDenied: applyVault(a.facts.serviceDenied, a.redaction.vault),
    daysLeft: a.deadline.daysLeft,
    urgent: a.facts.urgent,
    roles: roleLines(a),
  });
}

/**
 * The cloud request: the full prompt, plus the per-letter parts the egress gate
 * searches for names and IDs (the redacted letter, the model-written service
 * description and the role lines), as opposed to Overturn's fixed wording.
 */
export function buildAppealRequest(a: Analysis): { prompt: string; checkText: string } {
  return {
    prompt: buildAppealPrompt(a),
    checkText: [a.redaction.redacted, applyVault(a.facts.serviceDenied, a.redaction.vault), ...roleLines(a)].join('\n'),
  };
}
