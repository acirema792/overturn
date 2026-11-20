// Adversarial inputs found by the round-1 audit (loop/audits/round-1.md).
import { describe, expect, it } from 'vitest';
import { computeDeadline, findNoticeDate, findWindowDays, guessPlanType, localToday } from './deadline';
import { checkEgress } from './egressGate';
import { redact } from './redact';
import { insurerFromLetter, templateAppeal } from './template';

describe('F1 plan type is not fooled by a passing mention', () => {
  it('a Medicaid letter that mentions Medicare is Medicaid', () => {
    expect(guessPlanType('Sunrise Medicaid Managed Care. If you also have Medicare, call us. You may ask for a State Fair Hearing.')).toBe('medicaid');
  });
  it('an employer letter that says "reconsideration" is not Medicare Advantage', () => {
    expect(guessPlanType('Your employer group health plan (ERISA) denied the claim. You may request reconsideration of this decision.')).toBe('employer');
  });
  it('a real Medicare Advantage letter is still detected', () => {
    expect(guessPlanType('Evergreen Care Advantage (HMO) — Notice of Denial of Medical Coverage. Medicare Number: 1EG4-TE5-MK73')).toBe('medicare_advantage');
  });
  it('conflicting strong signals → unknown (let the model or the user decide)', () => {
    expect(guessPlanType('This Medicare Advantage plan ... your Medicaid managed care organization ...')).toBe('unknown');
  });
});

describe('F2 notice date ignores birth and service dates', () => {
  it('Date of birth on the first line is not the notice date', () => {
    expect(findNoticeDate('Date of birth: 04/12/1961\nNotice date: 11/02/2026\nWe denied...')).toBe('2026-11-02');
  });
  it('DOB in the header block is skipped in the dateline fallback', () => {
    expect(findNoticeDate('Acme Health\nPatient DOB 04/12/1961\nNovember 2, 2026\nDear member')).toBe('2026-11-02');
  });
  it('"Date of Service" is not the notice date', () => {
    expect(findNoticeDate('Date of Service: 10/01/2026\nDate: 11/03/2026')).toBe('2026-11-03');
  });
  it('"presented" does not count as the label "sent"', () => {
    expect(findNoticeDate('Claim presented 09/09/2026 by provider.\nLetter date: 11/04/2026')).toBe('2026-11-04');
  });
  it('a birth date never yields a passed deadline', () => {
    const d = computeDeadline({ noticeDate: findNoticeDate('Date of birth: 04/12/1961\nYou may appeal within 180 days.'), statedWindowDays: 180, planType: 'employer', today: '2026-11-20' });
    expect(d.deadline).toBeNull();
  });
});

describe('F3 the plan’s own response time is not the appeal window', () => {
  it('"We will decide within 30 days of receiving your appeal" is not a window', () => {
    expect(findWindowDays('We will decide within 30 days of receiving your appeal.')).toBeNull();
  });
  it('still finds the patient window in the same letter', () => {
    expect(findWindowDays('You may appeal within 180 days of the date of this notice. We will respond within 30 days of receiving your appeal.')).toBe(180);
  });
  it('"we must receive your request within 60 days" is the patient window', () => {
    expect(findWindowDays('We must receive your appeal request within 60 days of the date of this notice.')).toBe(60);
  });
});

describe('F4 egress gate matches names as whole words', () => {
  it('a short hidden name does not match inside another word', () => {
    expect(checkEgress('The patient asked for a review.', { '[PERSON_1]': 'Pat' }).allowed).toBe(true);
    expect(checkEgress('Tomorrow the samples arrive.', { '[PERSON_1]': 'Tom', '[PERSON_2]': 'Sam' }).allowed).toBe(true);
  });
  it('still blocks the name itself, in any case or spacing', () => {
    expect(checkEgress('Appeal for MARIA   gonzalez', { '[PERSON_1]': 'Maria Gonzalez' }).allowed).toBe(false);
    expect(checkEgress('Ask Pat about it', { '[PERSON_1]': 'Pat' }).allowed).toBe(false);
  });
  it('still blocks reformatted IDs', () => {
    expect(checkEgress('member nwh-4488-12901', { '[MEMBER_ID_1]': 'NWH448812901' }).allowed).toBe(false);
  });
});

describe('F6 labels are not names; template never guesses the patient', () => {
  it('"Patient Account No." and "Employee Benefits Trust" are not people', () => {
    const r = redact('Mercy Ridge | Patient Account No. 00458812733\nRedwood Coast Employee Benefits Trust');
    expect(Object.entries(r.vault).filter(([k]) => k.startsWith('[PERSON_')).map(([, v]) => v)).toEqual([]);
  });
  it('labelled names with a colon are still found', () => {
    const r = redact('Patient: Grace Achterberg\nParticipant: Owen Delacroix, ID 1');
    expect(r.redacted).not.toMatch(/Grace|Achterberg|Owen|Delacroix/);
  });
  it('the template leaves a blank instead of naming someone who may not be the patient', () => {
    const t = templateAppeal({ category: 'other', serviceDenied: '', insurer: '', vault: { '[PERSON_1]': 'Dr. Weller' }, urgent: false });
    expect(t.appealLetter).not.toContain('[PERSON_1]');
    expect(t.appealLetter).toContain('Member: ____');
  });
  it('the template skips a dateline when guessing the insurer', () => {
    expect(insurerFromLetter('Statement date: Oct 31, 2026\n\nMercy Ridge Medical Center | Patient Account No. 1')).toBe('Mercy Ridge Medical Center');
  });
});

describe('F12 days left uses the local calendar date', () => {
  it('8 pm on Nov 20 in a UTC-8 zone is still Nov 20', () => {
    // 2026-11-21T04:00Z is 8 pm on Nov 20 in Los Angeles.
    const at = new Date('2026-11-21T04:00:00Z');
    const local = localToday(at);
    expect(local).toBe(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`);
  });
});
