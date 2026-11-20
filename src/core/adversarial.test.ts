// Adversarial inputs found by the round-1 audit (loop/audits/round-1.md).
import { describe, expect, it } from 'vitest';
import { computeDeadline, findNoticeDate, findWindowDays, guessPlanType } from './deadline';

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
