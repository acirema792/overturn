import { detect, type IdKind } from './detectors';
import { nameFragments, PLACEHOLDER_RE } from './redact';

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
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

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
export function checkEgress(payload: string, vault: Record<string, string>): GateResult {
  const findings: GateFinding[] = [];
  const withoutPlaceholders = payload.replace(PLACEHOLDER_RE, ' ');
  const squashedPayload = squash(withoutPlaceholders);
  const wordsPayload = ` ${words(withoutPlaceholders)} `;

  for (const value of Object.values(vault)) {
    const hasDigit = /\d/.test(value);
    if (hasDigit) {
      // IDs, dates, phones: compare with all separators removed, so a
      // reformatted "nwh-4488-12901" still matches "NWH448812901".
      const v = squash(value);
      if (v.length >= 4 && squashedPayload.includes(v)) findings.push({ reason: 'vault-value', excerpt: mask(value) });
    } else {
      // Names and words: whole-word match, so "Pat" doesn't match "patient".
      // A multi-word name is also caught run together ("mariagonzalez").
      const v = words(value);
      const runTogether = v.includes(' ') && squash(value).length >= 8 && squashedPayload.includes(squash(value));
      if ((v.length >= 3 && wordsPayload.includes(` ${v} `)) || runTogether) findings.push({ reason: 'vault-value', excerpt: mask(value) });
    }
  }

  // Parts of a person's name in text a model wrote ("MRI for Gonzalez",
  // "Maria's MRI"). Matched as written or in capitals, whole word, so the
  // word "hope" doesn't match the name "Hope Rivers".
  for (const [ph, value] of Object.entries(vault)) {
    if (!ph.startsWith('[PERSON_') || /\d/.test(value)) continue;
    for (const frag of nameFragments(value)) {
      const re = new RegExp(`(?<![\\p{L}])(?:${escapeRe(frag)}|${escapeRe(frag.toUpperCase())})(?![\\p{L}])`, 'u');
      if (re.test(withoutPlaceholders)) findings.push({ reason: 'vault-value', excerpt: mask(frag) });
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
