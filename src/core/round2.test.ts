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
