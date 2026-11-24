// Findings from the round-3 audit (loop/audits/round-3.md).
import { describe, expect, it } from 'vitest';
import { redact } from './redact';
import { checkEgress } from './egressGate';
import { analyse, buildAppealRequest } from '../pipeline';
import { SimEngine } from '../ai/simEngine';

const letters = {
  english: 'Patient: Maria Gonzalez\nTreating physician: Dr. Helen English\nThe MRI (CPT 72148) is not medically necessary. You may appeal within 180 days of this notice. This is an employer group health plan.',
  days: 'Dear Mr. Days,\nYour MRI is not medically necessary. You may appeal within 180 days of the date of this notice. ERISA employer group health plan.',
  bill: 'Dear Bill,\nYour bill for the MRI was denied as not medically necessary. Ask for an itemized bill. You may appeal within 180 days of this notice.',
  long: 'Patient: Grace Long\nDear Ms. Long,\nLong-term acute care was denied as not medically necessary. You may appeal within 180 days of this notice.',
  may: 'Dear Ms. May,\nYou may appeal within 180 days of this notice. The MRI is not medically necessary.',
  money: 'Date of notice: 1/2/26\nYou were billed $1,226.00. You may appeal within 180 days of this notice.',
};

describe('H1 single-word names do not eat ordinary words or block the template', () => {
  it('"Bill" the person does not redact "your bill"', () => {
    expect(redact(letters.bill).redacted).toContain('Your bill');
    expect(redact(letters.bill).redacted).toContain('itemized bill');
  });
  it('"Ms. May" does not redact "You may"', () => expect(redact(letters.may).redacted).toContain('You may appeal'));
  it('"Ms. Long" does not redact "Long-term"', () => expect(redact(letters.long).redacted).toContain('Long-term acute care'));
  it('"Mr. Days" does not redact "180 days"', () => expect(redact(letters.days).redacted).toContain('180 days'));

  it.each(Object.entries(letters))('the app prompt for "%s" passes the gate', async (_name, text) => {
    const a = await analyse(new SimEngine('unavailable'), text, false);
    const req = buildAppealRequest(a);
    expect(checkEgress(req.prompt, a.redaction.vault, req.checkText).findings).toEqual([]);
  });

  it('a date does not match inside a dollar amount', () => {
    expect(checkEgress('You were billed $1,226.00.', { '[DATE_1]': '1/2/26' }).allowed).toBe(true);
  });
  it('the name itself in the variable part is still blocked', () => {
    expect(checkEgress('prompt', { '[PERSON_1]': 'Helen English' }, 'Records from Dr. English').allowed).toBe(false);
  });
});

describe('H2 the offline draft does not go through the cloud gate', () => {
  it('Sim engine: preferDevice drafts even when the prompt would be blocked for the cloud', async () => {
    const r = await new SimEngine('available').draftAppeal(
      { prompt: 'Appeal for Maria Gonzalez', vault: { '[PERSON_1]': 'Maria Gonzalez' } },
      { preferDevice: true },
    );
    expect(r.entry.where).toBe('on-device');
  });
});

import { templateAppeal } from './template';
import { DENIAL_CATEGORIES } from './categories';

describe('I3 the template letter speaks to the insurer, not to the patient', () => {
  it.each(DENIAL_CATEGORIES.map((c) => [c]))('%s', (category) => {
    const letter = templateAppeal({ category, serviceDenied: '', insurer: 'Acme Health', vault: {}, urgent: false }).appealLetter;
    expect(letter).not.toMatch(/\byour doctor\b|ask for it|you are entitled|\(request the/i);
  });
});

describe('I4 rules-only: "LAST, First" and particle surnames after a title', () => {
  it.each([
    ['Patient Name: SMITH, John A', ['SMITH', 'John']],
    ['Subscriber Name: GARCIA, Maria', ['GARCIA', 'Maria']],
    ['Dear Ms. de la Torre,\nWe denied', ['Torre']],
    ['Dear Dr. van der Berg,\nWe denied', ['Berg']],
  ])('%s', (text, values) => {
    const r = redact(text);
    for (const v of values) expect(r.redacted, v).not.toContain(v);
  });
});

describe('verifier 6: "LAST, First Middle" is hidden whole, never cut mid-word', () => {
  it.each([
    ['Patient Name: SMITH, John Andrew', ['SMITH', 'John', 'Andrew', 'ndrew']],
    ['Patient Name: NGUYEN, Thi Bich', ['NGUYEN', 'Thi', 'Bich', 'ich']],
    ['Patient Name: SMITH, John A', ['SMITH', 'John']],
    ['Patient Name: SMITH, John A.', ['SMITH', 'John']],
  ])('%s', (text, values) => {
    const out = redact(text).redacted;
    for (const v of values) expect(out, v).not.toContain(v);
  });
  it.each([
    ['Patient: JONES, Prior Authorization required', 'uthorization'],
    ['Member: AETNA, Medicare Advantage HMO', 'dvantage'],
  ])('never leaves a broken word: %s', (text, frag) => {
    expect(redact(text).redacted).not.toMatch(new RegExp(`\\]${frag}`));
  });
});
