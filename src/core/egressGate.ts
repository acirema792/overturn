import { detect, type IdKind } from './detectors';
import { PLACEHOLDER_RE } from './redact';

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

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function mask(value: string): string {
  if (value.length <= 2) return '•'.repeat(value.length);
  return value[0] + '•'.repeat(Math.max(1, value.length - 2)) + value[value.length - 1];
}

/**
 * The egress gate is plain code, not a model: it decides whether a payload may
 * leave the device. It blocks the request if
 *  1. any value in the local vault (every identifier we redacted) appears in
 *     the payload, compared after stripping case, spaces and punctuation, or
 *  2. the rule-based detectors find a new identifier in the payload.
 * Placeholders like [PERSON_1] are removed before the detector pass.
 */
export function checkEgress(payload: string, vault: Record<string, string>): GateResult {
  const findings: GateFinding[] = [];
  const squashedPayload = squash(payload);

  for (const value of Object.values(vault)) {
    const v = squash(value);
    // Very short fragments ("Al", "12") would match innocent text.
    const minLen = /^\d+$/.test(v) ? 4 : 3;
    if (v.length < minLen) continue;
    if (squashedPayload.includes(v)) {
      findings.push({ reason: 'vault-value', excerpt: mask(value) });
    }
  }

  const withoutPlaceholders = payload.replace(PLACEHOLDER_RE, ' ');
  for (const span of detect(withoutPlaceholders)) {
    findings.push({ reason: 'detector', kind: span.kind, excerpt: mask(span.text) });
  }

  return {
    allowed: findings.length === 0,
    findings,
    bytes: new TextEncoder().encode(payload).length,
  };
}
