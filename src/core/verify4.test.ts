// Regressions found by the round-3 verifier (see loop/ledger.json).
import { describe, expect, it } from 'vitest';
import { redact } from './redact';
import { checkEgress } from './egressGate';
import { findNoticeDate, findWindowDays } from './deadline';
import { insurerFromLetter } from './template';
import { applyVault } from '../pipeline';
import { CASES } from '../data/cases';

describe('G2 attempt 2: patient windows that mention a doctor or a hearing are kept', () => {
  it.each([
    ['If you disagree, you or your doctor can file an appeal within 60 days from the date of this notice.', 60],
    ['You, your representative, or your doctor can ask for an appeal within 65 days of this notice.', 65],
    ['You or your provider may request an appeal within 90 days of this notice.', 90],
    ['You have 60 days from the date of this notice to ask for a fair hearing or an appeal.', 60],
    ['Your provider may submit additional information within 14 days for review. You may appeal within 180 days of this notice.', 180],
  ])('%s', (t, d) => expect(findWindowDays(t)).toBe(d));
  it('tuning letters C02 and C14 keep their stated 180-day window', () => {
    expect(findWindowDays(CASES[1].text)).toBe(180);
    expect(findWindowDays(CASES[13].text)).toBe(180);
  });
});

describe('G5 attempt 2: "dated" notice dates', () => {
  it('"This notice is dated 11/02/2026."', () => expect(findNoticeDate('Acme Health\nThis notice is dated 11/02/2026.')).toBe('2026-11-02'));
  it('"Notice of Adverse Benefit Determination dated November 2, 2026"', () =>
    expect(findNoticeDate('Notice of Adverse Benefit Determination dated November 2, 2026')).toBe('2026-11-02'));
});

describe('G4 attempt 2: no over-redaction from name parts', () => {
  it('applyVault keeps clinical words that equal a name part in lowercase or as a compound', () => {
    expect(applyVault('Hand surgery (carpal tunnel release)', { '[PERSON_1]': 'Mary Hand' })).toBe('[PERSON_1] surgery (carpal tunnel release)'.replace('[PERSON_1]', 'Hand'));
    expect(applyVault('Hospital bill for the MRI', { '[PERSON_1]': 'Bill Carter' })).toBe('Hospital bill for the MRI');
    expect(applyVault('Request to grant coverage', { '[PERSON_1]': 'Grant Miller' })).toBe('Request to grant coverage');
  });
  it('short capitals words are not propagated from a name', () => {
    expect(redact('Patient: Bill Carter\nTHIS IS NOT A BILL').redacted).toContain('THIS IS NOT A BILL');
    expect(redact('Patient: John Long\nLONG-TERM CARE').redacted).toContain('LONG-TERM CARE');
    expect(redact('Patient: Ann Gold\nPLAN: GOLD PPO').redacted).toContain('GOLD PPO');
  });
  it('a placeholder does not glue an ID label to the next clinical code', () => {
    const r = redact('Claim #: 2026041277 CPT 99213');
    expect(r.redacted).toContain('CPT 99213');
    expect(checkEgress(r.redacted, r.vault).allowed).toBe(true);
  });
});

describe('F5 revert: labelled names are hidden again (leaks beat over-redaction)', () => {
  it.each(['MEMBER: JOHN SMITH', 'SUBSCRIBER: MARIA GONZALEZ', 'Member: JOHN Q PUBLIC', 'Claimant Name: John Smith', 'Account Name: John Smith', 'Dear SMITH,'])(
    '%s',
    (t) => expect(redact(t).redacted).not.toMatch(/SMITH|Smith|GONZALEZ|PUBLIC/),
  );
});

describe('F6 partial revert: insurer guess never returns a month, a page header or a claim label', () => {
  it.each([
    ['November 2, 2026\n\nAcme Health Plan', 'Acme Health Plan'],
    ['Page 1 of 2\nAcme Health Plan', 'Acme Health Plan'],
    ['Claim 2026041277\nAcme Health Plan', 'Acme Health Plan'],
  ])('%s', (t, want) => expect(insurerFromLetter(t)).toBe(want));
});
