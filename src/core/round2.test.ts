// Findings from the round-2 audit (loop/audits/round-2.md).
import { describe, expect, it } from 'vitest';
import { redact } from './redact';

const personOf = (text: string, name: string) => {
  const r = redact(text);
  return Object.entries(r.vault).find(([k, v]) => k.startsWith('[PERSON_') && v === name)?.[0];
};

describe('G1 relatives who share a surname keep separate placeholders', () => {
  it('Ann Lee and her son Benjamin Lee', () => {
    const t = 'Dear Ann Lee,\nYour son, Benjamin Lee, called about the claim.';
    const a = personOf(t, 'Ann Lee');
    const b = personOf(t, 'Benjamin Lee');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });
  it('patient and subscriber with the same surname', () => {
    const t = 'Patient: Maria Gonzalez\nSubscriber: Jose Gonzalez\nWe wrote to Ms. Gonzalez.';
    expect(personOf(t, 'Maria Gonzalez')).not.toBe(personOf(t, 'Jose Gonzalez'));
    expect(personOf(t, 'Jose Gonzalez')).toBeDefined();
  });
  it('a doctor whose first name is the patient surname keeps their own name', () => {
    const t = 'Patient: Ann Lee\nTreating provider: Dr. Lee Park';
    expect(personOf(t, 'Ann Lee')).toBeDefined();
    expect(personOf(t, 'Lee Park')).toBeDefined();
  });
});

import { findNoticeDate, findWindowDays } from './deadline';

describe('G2 next-level and third-party windows are not the appeal window', () => {
  it.each([
    ['If we uphold our decision, you can ask for a State Fair Hearing within 120 days of the date of our appeal decision. You must file an appeal with the plan within 60 days of the date of this notice.', 60],
    ['Your provider may submit additional information within 14 days for review. You may appeal within 180 days of this notice.', 180],
    ['The independent reviewer will decide within 45 days of receiving your request for review.', null],
    ['You may request an external review within 4 months; first, you must appeal within 180 days of this notice.', 180],
    ['Your appeal must be filed no later than 60 calendar days after you receive this notice.', 60],
  ])('%s', (text, days) => expect(findWindowDays(text)).toBe(days));
});

describe('G5 header dates that are not the notice date', () => {
  it.each([
    'Plan effective date: 01/01/2026\nOctober 2, 2026\nDear member',
    'Coverage period 01/01/2026 - 12/31/2026\nOctober 2, 2026\nDear member',
    'Member since 03/15/2019\nOctober 2, 2026\nDear member',
    'Respond by: 12/31/2026\nOctober 2, 2026\nDear member',
    'Prior authorization request dated 09/20/2026\nOctober 2, 2026\nDear member',
  ])('%s', (text) => expect(findNoticeDate(text)).toBe('2026-10-02'));
});

import { checkEgress } from './egressGate';
import { applyVault } from '../pipeline';

describe('G4 partial names in model-written text', () => {
  const vault = { '[PERSON_1]': 'Maria L. Gonzalez' };
  it.each(['lumbar MRI for Maria Gonzalez', 'lumbar MRI for Gonzalez', "Maria's lumbar MRI", 'MRI for MARIA GONZALEZ', 'M. Gonzalez'])(
    'gate blocks "%s"',
    (text) => expect(checkEgress(text, vault).allowed).toBe(false),
  );
  it('a lowercase common word that is also a name part does not block', () => {
    expect(checkEgress('There is hope for this appeal.', { '[PERSON_1]': 'Hope Rivers' }).allowed).toBe(true);
  });
  it('applyVault maps an unambiguous surname to the full name placeholder', () => {
    expect(applyVault('lumbar MRI for Gonzalez', vault)).toBe('lumbar MRI for [PERSON_1]');
  });
});

describe('G4 consistency: capitals', () => {
  it('a surname in capitals is redacted, so the gate does not block the outgoing text', () => {
    const r = redact('Patient: Maria Gonzalez\nRE: GONZALEZ CLAIM');
    expect(r.redacted).not.toContain('GONZALEZ');
    expect(checkEgress(r.redacted, r.vault).allowed).toBe(true);
  });
});

describe('G6 more rules-only formats', () => {
  it.each([
    ['Treating physician: Dr. A. Patel', 'Patel'],
    ['Requesting provider: Dr. J. R. Okafor', 'Okafor'],
    ['Patient: Maria de la Cruz', 'Cruz'],
    ['Dear Maria de Jesus,', 'Jesus'],
    ['Member: Vincent van Gogh', 'Gogh'],
    ['Claim number 2026 0412 7781', '0412 7781'],
    ['Member number: XJH 4488 12901', '4488 12901'],
    ['DOB: 12-Apr-1961', '12-Apr-1961'],
    ['License plate 7ABC123', '7ABC123'],
    ['ZIP 62704', '62704'],
  ])('hides %s', (text, value) => expect(redact(text).redacted).not.toContain(value));
  it.each([
    ['CPT 72148 billed', '72148'],
    ['The plan number is in your handbook.', 'plan number'],
  ])('keeps %s', (text, value) => expect(redact(text).redacted).toContain(value));
});
