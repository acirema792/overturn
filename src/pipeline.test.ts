import { describe, expect, it } from 'vitest';
import { analyse, applyVault, buildAppealPrompt, finishAnalysis, groundEntities } from './pipeline';
import { SimEngine } from './ai/simEngine';
import { checkEgress } from './core/egressGate';
import { CASES } from './data/cases';
import { HELDOUT } from './data/heldout';

describe('pipeline', () => {
  it('the cloud prompt for every case passes the egress gate (template has no false alarms)', async () => {
    const engine = new SimEngine('unavailable');
    for (const c of [...CASES, ...HELDOUT]) {
      const a = await analyse(engine, c.text, false);
      const prompt = buildAppealPrompt(a);
      const gate = checkEgress(prompt, a.redaction.vault);
      expect(gate.findings, c.id).toEqual([]);
    }
  });

  it('records the on-device failure instead of falling back to the cloud', async () => {
    const a = await analyse(new SimEngine('unavailable'), CASES[0].text, true);
    expect(a.deviceRan).toBe(false);
    expect(a.deviceError).toMatch(/ONLY_ON_DEVICE/);
    expect(a.ledger.every((e) => e.where !== 'cloud')).toBe(true);
  });

  it('user-added redactions are applied', async () => {
    const base = await analyse(new SimEngine('unavailable'), CASES[10].text, false); // Hope Rivers
    expect(base.redaction.redacted).toContain('Hope Rivers');
    const next = finishAnalysis({ ...base, userEntities: [{ text: 'Hope Rivers', kind: 'PERSON', source: 'user' }] });
    expect(next.redaction.redacted).not.toContain('Hope Rivers');
  });

  it('drops entities the model invented', () => {
    const kept = groundEntities('Dear Ann Lee,', [
      { text: 'Ann Lee', kind: 'PERSON', source: 'on-device' },
      { text: 'Bob Smith', kind: 'PERSON', source: 'on-device' },
    ]);
    expect(kept.map((e) => e.text)).toEqual(['Ann Lee']);
  });

  it('maps names inside model-written facts to placeholders', () => {
    expect(applyVault('MRI for Maria Gonzalez', { '[PERSON_1]': 'Maria Gonzalez' })).toBe('MRI for [PERSON_1]');
  });
});
