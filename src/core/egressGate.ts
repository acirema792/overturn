import { detect, type IdKind } from './detectors';
import { nameFormsRe, nameFragments, PLACEHOLDER_RE } from './redact';

export interface GateFinding {
  reason: 'vault-value' | 'detector';
  kind?: IdKind;
  /** Masked excerpt, safe to display: never the full identifier. */
  excerpt: string;
}

export interface GateResult {
  allowed: boolean;
  findings: GateFinding[];
  bytes: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function mask(value: string): string {
  if (value.length <= 2) return '•'.repeat(value.length);
  return value[0] + '•'.repeat(Math.max(1, value.length - 2)) + value[value.length - 1];
}

/**
 * The egress gate is plain code, not a model: it decides whether a payload may
 * leave the device. It blocks the request if
 *  1. any value in the local vault (every identifier we redacted) appears in
 *     the payload: values with digits compared with all separators removed,
 *     names and words compared as whole words (case- and spacing-insensitive), or
 *  2. the rule-based detectors find a new identifier in the payload.
 * Placeholders like [PERSON_1] are removed before the detector pass.
 */
const sep = String.raw`[\s./-]?`;
/** "NWH448812901" also matches "nwh-4488-12901", but "1/2/26" never matches inside "$1,226.00". */
function digitValueRe(value: string): RegExp {
  const chars = [...value.replace(/[^A-Za-z0-9]/g, '')].map(escapeRe);
  return new RegExp(`(?<![\\p{L}\\p{N}])${chars.join(sep)}(?![\\p{L}\\p{N}])`, 'iu');
}

/** A name, whole word; one-word names only as written or in capitals ("Bill", not "bill"). */
function nameRe(value: string): RegExp {
  const parts = value.trim().split(/\s+/).map(escapeRe);
  if (parts.length === 1) {
    return new RegExp(`(?<![\\p{L}])(?:${nameFormsRe(value.trim())})(?![\\p{L}])(?!-\\p{L})`, 'u');
  }
  return new RegExp(`(?<![\\p{L}])${parts.join(String.raw`[\s.,'’-]*`)}(?![\\p{L}])`, 'iu');
}

/**
 * The egress gate is plain code, not a model: it decides whether a payload may
 * leave the device. It blocks the request if
 *  1. any value in the local vault (every identifier we redacted), or any part
 *     of a person's name, appears in the per-letter text (`checkText`: the
 *     redacted letter and the facts a model wrote; defaults to the whole
 *     payload). Overturn's own fixed instructions are not searched for names,
 *     so a doctor called "English" can't block the phrase "plain English".
 *  2. the rule-based detectors find a new identifier anywhere in the payload.
 * Placeholders like [PERSON_1] are removed first.
 */
export function checkEgress(payload: string, vault: Record<string, string>, checkText?: string): GateResult {
  const findings: GateFinding[] = [];
  // A neutral token, not a space, so "Claim #: [CLAIM_ID_1] CPT 99213" doesn't
  // read as "Claim #: CPT 99213" (a label followed by an ID-like code).
  const withoutPlaceholders = payload.replace(PLACEHOLDER_RE, ' · ');
  const variable = (checkText ?? payload).replace(PLACEHOLDER_RE, ' · ');
  const squashedVariable = squash(variable);

  for (const value of Object.values(vault)) {
    if (/\d/.test(value)) {
      if (squash(value).length >= 4 && digitValueRe(value).test(variable)) findings.push({ reason: 'vault-value', excerpt: mask(value) });
    } else if (value.trim().length >= 3) {
      // A multi-word name is also caught run together ("mariagonzalez").
      const runTogether = /\s/.test(value.trim()) && squash(value).length >= 8 && squashedVariable.includes(squash(value));
      if (nameRe(value).test(variable) || runTogether) findings.push({ reason: 'vault-value', excerpt: mask(value) });
    }
  }

  // Parts of a person's name in text a model wrote ("MRI for Gonzalez").
  for (const [ph, value] of Object.entries(vault)) {
    if (!ph.startsWith('[PERSON_') || /\d/.test(value)) continue;
    for (const frag of nameFragments(value)) {
      if (nameRe(frag).test(variable)) findings.push({ reason: 'vault-value', excerpt: mask(frag) });
    }
  }

  for (const span of detect(withoutPlaceholders)) {
    findings.push({ reason: 'detector', kind: span.kind, excerpt: mask(span.text) });
  }

  return {
    allowed: findings.length === 0,
    findings,
    bytes: new TextEncoder().encode(payload).length,
  };
}
