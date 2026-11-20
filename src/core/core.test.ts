import { describe, expect, it } from 'vitest';
import { redact, rehydrate } from './redact';
import { checkEgress } from './egressGate';
import { computeDeadline, findNoticeDate, findWindowDays, toISODate } from './deadline';
import { classifyDenial } from './categories';
import { CASES } from '../data/cases';

describe('redact', () => {
  it('replaces labelled identifiers and keeps clinical codes', () => {
    const r = redact('Member ID: NWH448812901. CPT 72148, ICD-10 M54.16, billed $2,450.00.');
    expect(r.redacted).not.toContain('NWH448812901');
    expect(r.redacted).toContain('72148');
    expect(r.redacted).toContain('M54.16');
    expect(r.redacted).toContain('$2,450.00');
  });

  it('redacts every occurrence and name fragments ("Ms. Vance")', () => {
    const r = redact('Patient: Theresa Vance\nWe wrote to Ms. Vance and to Theresa about it.');
    expect(r.redacted).not.toMatch(/Vance|Theresa/);
  });

  it('gives the same value the same placeholder', () => {
    const r = redact('Dear Sam Lee, ... Sam Lee called.', [{ text: 'Sam Lee', kind: 'PERSON', source: 'on-device' }]);
    const phs = r.redacted.match(/\[PERSON_\d+\]/g) ?? [];
    expect(new Set(phs).size).toBe(1);
  });

  it('adds entities found by the on-device model', () => {
    const r = redact('Thanks alexei petrov for calling.', [{ text: 'alexei petrov', kind: 'PERSON', source: 'on-device' }]);
    expect(r.redacted).not.toContain('alexei');
  });

  it('does not treat a medical policy number or a plan section as a member ID', () => {
    const r = redact('Under our Medical Policy MP-204 and Article 12.3 of the 2026 plan.');
    expect(r.redacted).toContain('MP-204');
    expect(r.redacted).toContain('12.3');
    expect(r.redacted).toContain('2026');
  });
});

describe('rehydrate', () => {
  it('restores values locally and flags placeholders the model invented', () => {
    const { vault } = redact('Dear Maria Gonzalez, Member ID: NWH448812901');
    const out = rehydrate('I, [PERSON_1], member [MEMBER_ID_1], and [PERSON_9].', vault);
    expect(out.text).toContain('Maria Gonzalez');
    expect(out.text).toContain('NWH448812901');
    expect(out.unknownPlaceholders).toEqual(['[PERSON_9]']);
  });
});

describe('egress gate', () => {
  it('allows a properly redacted payload', () => {
    const r = redact(CASES[0].text);
    expect(checkEgress(r.redacted, r.vault).allowed).toBe(true);
  });

  it('blocks a payload that still contains a vault value, even reformatted', () => {
    const r = redact('Member ID: NWH448812901');
    const res = checkEgress('Write an appeal for member nwh-4488-12901', r.vault);
    expect(res.allowed).toBe(false);
    expect(res.findings[0].reason).toBe('vault-value');
    expect(res.findings[0].excerpt).not.toContain('448812901');
  });

  it('blocks new identifiers the detectors recognise', () => {
    const res = checkEgress('Call me at (602) 555-0187 or priya@mail.example', {});
    expect(res.allowed).toBe(false);
    expect(res.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['PHONE', 'EMAIL']));
  });
});

describe('deadline (code decides)', () => {
  it('uses the window stated in the letter', () => {
    const d = computeDeadline({ noticeDate: '2026-10-28', statedWindowDays: 180, planType: 'employer', today: '2026-11-20' });
    expect(d).toMatchObject({ deadline: '2027-04-26', basis: 'stated-in-letter', daysLeft: 157 });
  });

  it('falls back to the legal minimum for the plan type, and says so', () => {
    const d = computeDeadline({ noticeDate: '2026-11-06', statedWindowDays: null, planType: 'medicare_advantage', today: '2026-11-20' });
    expect(d.deadline).toBe('2027-01-10');
    expect(d.basis).toBe('default-rule');
    expect(d.citation).toBe('42 CFR 422.582(b)');
  });

  it('refuses to guess when neither window nor plan type is known', () => {
    const d = computeDeadline({ noticeDate: '2026-11-04', statedWindowDays: null, planType: 'unknown', today: '2026-11-20' });
    expect(d.deadline).toBeNull();
    expect(d.basis).toBe('unknown');
  });

  it('rejects impossible dates', () => {
    expect(toISODate('02/30/2026')).toBeNull();
    expect(toISODate('3 November 2026')).toBe('2026-11-03');
  });

  it('reads windows written in words and digits', () => {
    expect(findWindowDays('must be received within one hundred eighty (180) days of the date of this notice')).toBe(180);
    expect(findWindowDays('You can appeal within sixty days of this notice.')).toBe(60);
    expect(findWindowDays('Call us with questions.')).toBeNull();
  });

  it('finds the dateline', () => {
    expect(findNoticeDate('Plan\nIssued 3 November 2026\nName')).toBe('2026-11-03');
  });
});

describe('category fallback', () => {
  it('ignores negated mentions', () => {
    expect(classifyDenial('This is an exclusion, not a medical necessity decision.')).toBe('not_covered');
  });
});

describe('name fragments', () => {
  it('a bare surname shares the full name placeholder', () => {
    const r = redact('Member: Theresa Vance\nRecords from Ms. Vance’s doctor.');
    const phs = r.redacted.match(/\[PERSON_\d+\]/g) ?? [];
    expect(new Set(phs).size).toBe(1);
    expect(rehydrate(r.redacted, r.vault).text).toContain('Ms. Theresa Vance’s');
  });
});
