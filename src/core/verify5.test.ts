// Regressions found by the final verifier (see loop/ledger.json, round 3 follow-ups).
import { describe, expect, it } from 'vitest';
import { redact } from './redact';
import { checkEgress } from './egressGate';
import { findNoticeDate, findWindowDays } from './deadline';
import { applyVault } from '../pipeline';

describe('deadline: errors may only be earlier, never later', () => {
  it.each([
    ['You can ask for a State Fair Hearing within 120 days from the date of the Notice of Appeal Resolution. You have 60 days from the date of this notice to ask for an appeal.', 60],
    ['If we uphold our decision, you can ask for a State Fair Hearing within 120 days of the date on our appeal letter. You must file your appeal within 60 days of this notice.', 60],
    ['You can request an independent external review within 120 days after you get our appeal results. You must appeal within 60 days of this notice.', 60],
    ['When you are ready, your provider can ask for a review within 365 days. You may appeal within 60 days of this notice.', 60],
    ['If you have questions, your doctor may request a reconsideration within 90 days. You may appeal within 60 days of this notice.', 60],
  ])('%s', (t, d) => expect(findWindowDays(t)).toBe(d));
});

describe('gate: reformatted identifiers with any common separator', () => {
  it.each([
    ['NWH448812901', 'member NWH–4488–12901'],
    ['NWH448812901', 'member nwh_4488_12901'],
    ['NWH448812901', 'member NWH - 4488 - 12901'],
    ['(555) 201-3344', 'call 555 - 201 - 3344'],
    ['03/14/1961', 'born 03 / 14 / 1961'],
    ['123-45-6789', 'ssn 123 – 45 – 6789'],
    ['2026041277', 'claim 2026,041,277'],
  ])('%s blocked in "%s"', (value, payload) => expect(checkEgress(payload, { '[ID_1]': value }).allowed).toBe(false));
  it('a date never matches inside a dollar amount', () => {
    expect(checkEgress('billed $1226.00 and $1,226.00', { '[DATE_1]': '1/2/26' }).allowed).toBe(true);
  });
});

describe('capitals surnames: hidden next to the name or after a label, kept as ordinary words', () => {
  it.each([
    ['Patient: James Brown\nCLAIM DETAIL FOR BROWN, JAMES', 'BROWN'],
    ['Patient Name: John Lee\nMEMBER LEE', 'LEE'],
    ['Patient: Wei Chen\nRE: CHEN\nSTATEMENT FOR CHEN, WEI', 'CHEN'],
    ['Patient: Ana Diaz\nDIAZ, ANA', 'DIAZ'],
    ['Patient: Hope Rivers\nRIVERS, HOPE', 'RIVERS'],
    ['Patient: Min Kim\nATTN KIM', 'KIM'],
  ])('hides in %s', (t, v) => {
    const r = redact(t);
    expect(r.redacted).not.toContain(v);
    expect(checkEgress(r.redacted, r.vault).allowed).toBe(true);
  });
});

describe('applyVault: model-written name parts', () => {
  const vault = { '[PERSON_1]': 'Maria Gonzalez' };
  it.each(['lumbar MRI for maria', "Maria's lumbar MRI", 'Gonzalez lumbar MRI', 'MRI (Gonzalez)', 'Lumbar MRI. Maria needs it'])('%s is mapped and passes the gate', (s) => {
    const out = applyVault(s, vault);
    expect(out).toContain('[PERSON_1]');
    expect(checkEgress('prompt', vault, out).allowed).toBe(true);
  });
  it('a one-word name that is a common word is not replaced in ordinary text', () => {
    expect(applyVault('Physical therapy that may help', { '[PERSON_1]': 'May' })).toBe('Physical therapy that may help');
  });
});

describe('notice date: "letter dated" and "records dated" are not the notice', () => {
  it.each([
    'Thank you for your letter dated 08/15/2026.\nDate: 11/02/2026',
    'We reviewed records dated 10/01/2026.\nDate: 11/02/2026',
  ])('%s', (t) => expect(findNoticeDate(t)).toBe('2026-11-02'));
});
