import { describe, expect, it } from 'vitest';
import { analyse, billedCode, buildAppealRequest } from './pipeline';
import { SimEngine } from './ai/simEngine';
import { templateAppeal } from './core/template';
import { checkEgress } from './core/egressGate';
import { CASES } from './data/cases';
import { HELDOUT } from './data/heldout';

describe('L3: a rules-only appeal names what was denied', () => {
  it('finds the first CPT or HCPCS code', () => {
    expect(billedCode('lumbar spine MRI without contrast (CPT 72148) ordered by')).toBe('CPT 72148');
    expect(billedCode('wheelchair, HCPCS code K0861, denied')).toBe('HCPCS K0861');
    expect(billedCode('No codes here, claim 2026-1014-55821')).toBe('');
  });
  it('names no code when the letter lists more than one (we cannot tell which was denied)', () => {
    expect(billedCode('Your office visit (CPT 99213) was paid. The lumbar MRI (CPT 72148) is denied.')).toBe('');
    expect(billedCode('Approved: CPT 97110. Denied: HCPCS E0601.')).toBe('');
    expect(billedCode('The MRI (CPT 72148) is denied. Appeal of CPT 72148 must be received within 180 days.')).toBe('CPT 72148');
  });
  it('ignores a "code" that is part of a detected identifier', () => {
    expect(billedCode('Member ID: CPT 55555\nThe MRI was denied.')).toBe('');
  });
  it('the template letter says "the service billed as CPT 72148" (and Spanish explains it in Spanish)', () => {
    const en = templateAppeal({ category: 'medical_necessity', serviceDenied: 'CPT 72148', insurer: 'Acme', vault: {}, urgent: false });
    expect(en.appealLetter).toMatch(/deny coverage for the service billed as CPT 72148\./);
    const es = templateAppeal({ category: 'medical_necessity', serviceDenied: 'CPT 72148', insurer: 'Acme', vault: {}, urgent: false, lang: 'es' });
    expect(es.plainExplanation).toMatch(/Tu plan negó el servicio facturado como CPT 72148/);
    expect(es.appealLetter).toMatch(/the service billed as CPT 72148/);
  });
  it('the rules-only analysis carries the code, and the gate still passes on every letter in both languages', async () => {
    const a0 = await analyse(new SimEngine('unavailable'), CASES[0].text, false);
    expect(a0.facts.serviceDenied).toBe('CPT 72148');
    for (const c of [...CASES, ...HELDOUT])
      for (const lang of ['en', 'es'] as const) {
        const a = await analyse(new SimEngine('unavailable'), c.text, false, lang);
        const req = buildAppealRequest(a, lang);
        expect(checkEgress(req.prompt, a.redaction.vault, req.checkText).findings, `${c.id} ${lang}`).toEqual([]);
      }
  });
});
