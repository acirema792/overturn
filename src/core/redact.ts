import { detect, mergeSpans, type IdKind, type Span } from './detectors';

/** An identifier the on-device model (or the user) found in the raw letter. */
export interface FoundEntity {
  text: string;
  kind: IdKind;
  source: 'on-device' | 'user';
}

export interface Redaction {
  /** Text safe to send to the cloud: identifiers replaced by placeholders. */
  redacted: string;
  /** Placeholder → original value. Lives only in this browser tab. */
  vault: Record<string, string>;
  /** Spans in the ORIGINAL text that were redacted. */
  spans: (Span & { placeholder: string })[];
}

const PLACEHOLDER_LABEL: Record<IdKind, string> = {
  PERSON: 'PERSON',
  DATE: 'DATE',
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  SSN: 'SSN',
  MEMBER_ID: 'MEMBER_ID',
  CLAIM_ID: 'CLAIM_ID',
  ACCOUNT_ID: 'ACCOUNT_ID',
  ADDRESS: 'ADDRESS',
  ZIP: 'ZIP',
  URL: 'URL',
  IP: 'IP',
  ID: 'ID',
};

export const PLACEHOLDER_RE = /\[([A-Z_]+)_(\d+)\]/g;

/** Capitalised words that should never be propagated as name fragments. */
const COMMON_CAPITALISED = new Set([
  'The', 'This', 'That', 'Your', 'You', 'We', 'Our', 'Dear', 'Health', 'Plan', 'Blue', 'Cross',
  'Shield', 'Care', 'Medical', 'Center', 'Hospital', 'Clinic', 'Group', 'Insurance', 'Member',
  'Patient', 'Claim', 'Appeal', 'Appeals', 'Department', 'Services', 'Service', 'Mr', 'Mrs', 'Ms',
  'Dr', 'Miss', 'Street', 'Avenue', 'Road', 'North', 'South', 'East', 'West', 'Saint', 'St',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday', 'Sunday', 'Sincerely', 'Regards', 'Notice', 'Denial', 'Adverse', 'Benefit',
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex that matches `value` with flexible whitespace, case-insensitively. */
function flexibleRe(value: string): RegExp {
  const parts = value.trim().split(/\s+/).map(escapeRe);
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
}

function findAll(text: string, value: string, kind: IdKind, source: Span['source']): Span[] {
  const v = value.trim();
  if (v.length < 2) return [];
  const re = flexibleRe(v);
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, kind, text: m[0], source });
  }
  return out;
}

/**
 * Name fragments: if "Maria L. Gonzalez" is a person, "Gonzalez" and "Maria"
 * on their own elsewhere in the letter are identifiers too ("Ms. Gonzalez").
 */
function nameFragments(name: string): string[] {
  return name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}'’-]/gu, '').replace(/['’]s$/, ''))
    .filter((w) => w.length >= 3 && /^\p{Lu}/u.test(w) && !COMMON_CAPITALISED.has(w) && !COMMON_CAPITALISED.has(w[0] + w.slice(1).toLowerCase()));
}

/** Case-sensitive fragment search, so "Rose" the name doesn't match "rose" the verb. */
function findFragment(text: string, frag: string, canonical: string): Span[] {
  const re = new RegExp(`(?<![\\p{L}])${escapeRe(frag)}(?![\\p{L}])`, 'gu');
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + frag.length, kind: 'PERSON', text: frag, source: 'propagated', canonical });
  }
  return out;
}

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Redact a letter. Rule-based detections always run; entities the on-device
 * model or the user found are added on top. Every occurrence of every found
 * value is redacted, not just the first.
 */
export function redact(text: string, entities: FoundEntity[] = []): Redaction {
  const spans: Span[] = detect(text);

  // Every value found once is redacted everywhere it appears.
  const seeds: { value: string; kind: IdKind; source: Span['source'] }[] = [
    ...spans.map((s) => ({ value: text.slice(s.start, s.end), kind: s.kind, source: 'propagated' as const })),
    ...entities.map((e) => ({ value: e.text, kind: e.kind, source: e.source })),
  ];
  for (const seed of seeds) {
    spans.push(...findAll(text, seed.value, seed.kind, seed.source));
    if (seed.kind === 'PERSON') {
      for (const frag of nameFragments(seed.value)) spans.push(...findFragment(text, frag, seed.value.trim()));
    }
  }

  const merged = mergeSpans(spans).map((s) => ({ ...s, text: text.slice(s.start, s.end) }));
  // A bare fragment ("Vance") shares its full name's placeholder, so the cloud
  // model can tell "Ms. [PERSON_1]" is the same person as "[PERSON_1]".
  const fullNames = new Set(merged.filter((s) => s.kind === 'PERSON').map((s) => normalise(s.text)));
  const canonicalOf = (s: (typeof merged)[number]) =>
    s.canonical && s.canonical.length > s.text.length && fullNames.has(normalise(s.canonical)) ? s.canonical : s.text;

  // Same value → same placeholder, so the cloud model can still reason
  // ("[PERSON_1] is the patient, [PERSON_2] is the treating physician").
  const counters: Partial<Record<string, number>> = {};
  const byValue = new Map<string, string>();
  const vault: Record<string, string> = {};
  const withPlaceholders = merged.map((s) => {
    const value = canonicalOf(s);
    const key = `${s.kind}|${normalise(value)}`;
    let ph = byValue.get(key);
    if (!ph) {
      const label = PLACEHOLDER_LABEL[s.kind];
      counters[label] = (counters[label] ?? 0) + 1;
      ph = `[${label}_${counters[label]}]`;
      byValue.set(key, ph);
      vault[ph] = value;
    }
    return { ...s, placeholder: ph };
  });

  let redacted = '';
  let cursor = 0;
  for (const s of withPlaceholders) {
    redacted += text.slice(cursor, s.start) + s.placeholder;
    cursor = s.end;
  }
  redacted += text.slice(cursor);

  return { redacted, vault, spans: withPlaceholders };
}

export interface Rehydration {
  text: string;
  /** Placeholders the model wrote that we never issued (it invented them). */
  unknownPlaceholders: string[];
}

/** Put the real values back, locally. The cloud never sees this output. */
export function rehydrate(text: string, vault: Record<string, string>): Rehydration {
  const unknown = new Set<string>();
  const out = text.replace(PLACEHOLDER_RE, (whole) => {
    if (whole in vault) return vault[whole];
    unknown.add(whole);
    return whole;
  });
  return { text: out, unknownPlaceholders: [...unknown] };
}
