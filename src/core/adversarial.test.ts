// Adversarial inputs found by the round-1 audit (loop/audits/round-1.md).
import { describe, expect, it } from 'vitest';
import { computeDeadline, findNoticeDate, findWindowDays, guessPlanType, localToday } from './deadline';
import { checkEgress } from './egressGate';
import { redact } from './redact';
import { insurerFromLetter, templateAppeal } from './template';
import { findSuspects } from './suspects';

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
  it('8 pm on Nov 20 in Los Angeles is Nov 20, not the UTC date', () => {
    const before = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(localToday(new Date('2026-11-21T04:00:00Z'))).toBe('2026-11-20');
    } finally {
      process.env.TZ = before;
    }
  });
});

describe('F5 rules-only floor: formats the auditor found', () => {
  const hidden = (text: string, value: string) => {
    const r = redact(text);
    return !r.redacted.includes(value);
  };
  it('all-caps names after a label', () => expect(hidden('Patient: MARIA GONZALEZ\nWe denied', 'GONZALEZ')).toBe(true));
  it('"Last, First" after a label', () => expect(hidden('Member: Gonzalez, Maria\nWe denied', 'Maria')).toBe(true));
  it('accented names', () => expect(hidden('Dear José Ñúñez-García,\nWe denied', 'Ñúñez')).toBe(true));
  it('Mc/Mac names', () => expect(hidden('Patient: Fiona McGregor\nWe denied', 'McGregor')).toBe(true));
  it('initials', () => expect(hidden('Patient: M. L. Gonzalez\nWe denied', 'Gonzalez')).toBe(true));
  it('IDs with spaces', () => expect(hidden('Member ID: XJH 4488 12901 was denied', '4488 12901')).toBe(true));
  it('a labelled member ID that looks like a CPT code', () => expect(hidden('Member ID: 72148\nCPT 99213', '72148')).toBe(true));
  it('…while an unlabelled CPT code survives', () => expect(hidden('Member ID: 72148\nCPT 99213', '99213')).toBe(false));
  it('dotted dates of birth', () => expect(hidden('DOB 04.17.1961', '04.17.1961')).toBe(true));
  it('spaced SSNs', () => expect(hidden('SSN 219 55 0143', '219 55 0143')).toBe(true));
  it('the egress gate catches a spaced SSN in outgoing text', () => expect(checkEgress('ssn 219 55 0143', {}).allowed).toBe(false));
});

describe('verifier round 1: regressions in F2/F3/F4/F6 fixes', () => {
  it.each([
    ['You have the right to appeal this decision within 180 days of the date of this notice.', 180],
    ['If you disagree with our decision, you may appeal within 60 days of this notice.', 60],
    ['You may request a review of this decision within 180 days.', 180],
    ['To appeal this decision, send your request within 65 days of the date of this notice.', 65],
    ['We will review your appeal if you send it within 60 days of this notice.', 60],
  ])('F3: patient window kept: %s', (text, days) => expect(findWindowDays(text)).toBe(days));

  it('F2: a labelled notice date on a line that also mentions service', () => {
    expect(findNoticeDate('Notice date: 11/02/2026 (date of service 10/01/2026)')).toBe('2026-11-02');
    expect(findNoticeDate('Acme Health Customer Service   Date: 11/02/2026')).toBe('2026-11-02');
  });

  it('F6: names after labels without a colon are still redacted', () => {
    for (const t of ['Patient Name Grace Achterberg', 'Patient Name\tGrace Achterberg', 'Member Grace Achterberg   ID 5', 'Patient, Grace Achterberg, was seen']) {
      expect(redact(t).redacted, t).not.toContain('Achterberg');
    }
  });

  it('F6: insurer guess handles "From:" and never returns a known person', () => {
    expect(insurerFromLetter('From: Acme Health\nMaria Gonzalez\n12 Main St')).toBe('Acme Health');
    expect(insurerFromLetter('Maria Gonzalez\nAcme Health', ['Maria Gonzalez'])).toBe('Acme Health');
  });

  it('F4: a hidden full name written without spaces is still blocked', () => {
    expect(checkEgress('appeal for mariagonzalez', { '[PERSON_1]': 'Maria Gonzalez' }).allowed).toBe(false);
  });
  it('F4: a two-letter hidden word does not block common text', () => {
    expect(checkEgress('Smith et al reported', { '[PERSON_1]': 'Al' }).allowed).toBe(true);
  });
});

describe('verifier round 1 batch 2: F5 leaks and over-redaction', () => {
  const out = (t: string) => redact(t).redacted;
  it.each([
    ['MEMBER NAME: JOHN Q PUBLIC', ['JOHN', 'PUBLIC']],
    ['DOB 1961/04/12', ['1961/04/12']],
    ['Member: DE LA CRUZ, ANA', ['CRUZ', 'ANA']],
    ['Member: O’Brien, Siobhán', ['Brien', 'Siobhán']],
    ['Dear Okonkwo,\nWe denied', ['Okonkwo']],
    ['The patient, age 93, was admitted.', ['93']],
  ])('hides %s', (text, values) => {
    for (const v of values) expect(out(text), v).not.toContain(v);
  });

  it.each([
    ['To: CIGNA HEALTHCARE', 'CIGNA HEALTHCARE'],
    ['Member: ANTHEM BLUE CROSS', 'ANTHEM BLUE CROSS'],
    ['To: BLUE CROSS BLUE SHIELD', 'BLUE CROSS BLUE SHIELD'],
    ['To: AETNA LIFE INSURANCE COMPANY', 'AETNA LIFE INSURANCE COMPANY'],
    ['Under Section 4.1.12 of the plan', '4.1.12'],
    ['Policy version 3.2.25 applies', '3.2.25'],
    ['MEMBER NAME: SEE ENCLOSED', 'SEE ENCLOSED'],
    ['Units: 100 25 2026', '100 25 2026'],
    ['Patient age 45 at the time', '45'],
  ])('keeps %s', (text, value) => expect(out(text)).toContain(value));

  it('labelled account and reference numbers get their own kind', () => {
    const r = redact('Account Number: 4410 0877 23\nReference Number: RF 2231 9981');
    expect(Object.keys(r.vault).some((k) => k.startsWith('[ACCOUNT_ID_'))).toBe(true);
    expect(Object.keys(r.vault).some((k) => k.startsWith('[CLAIM_ID_'))).toBe(true);
  });

  it('possible-name hints include all-caps and accented names', () => {
    expect(findSuspects('Note from MARCUS FELDMAN about the claim.')).toContain('MARCUS FELDMAN');
    expect(findSuspects('Note from Zoë Ångström about the claim.')).toContain('Zoë Ångström');
  });
});
