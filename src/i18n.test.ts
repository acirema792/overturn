import { describe, expect, it } from 'vitest';
import { translate, type Key } from './i18n';
import { friendlyDraftError } from './ai/errors';
import { templateAppeal } from './core/template';
import { analyse, buildAppealRequest } from './pipeline';
import { SimEngine } from './ai/simEngine';
import { checkEgress } from './core/egressGate';
import { CASES } from './data/cases';
import { HELDOUT } from './data/heldout';
import * as i18n from './i18n';

describe('Spanish UI', () => {
  it('every key has a Spanish text, and Spanish differs from English except product names', () => {
    const sameOk = new Set<Key>(['srcNano']);
    for (const k of i18n.ALL_KEYS) {
      expect(translate('es', k).trim(), k).not.toBe('');
      if (!i18n.ES_ONLY.includes(k)) expect(translate('en', k).trim(), k).not.toBe('');
      if (!sameOk.has(k) && !i18n.ES_ONLY.includes(k)) expect(translate('es', k), k).not.toBe(translate('en', k));
    }
  });
  it('fills variables', () => {
    expect(translate('es', 'daysLeft', { n: 12 })).toBe('Quedan 12 días');
  });
  it('error messages keep their meaning in Spanish', () => {
    expect(friendlyDraftError(new Error('Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.'), true, 'es')).toMatch(/sin conexión.*No se envió nada/);
    expect(friendlyDraftError(new Error('[500 Internal Server Error] high demand (after 6 attempts: a, b)'), false, 'es')).toMatch(/saturado \(se intentó 6 veces\)/);
  });
  it('the template explains in Spanish but the letter stays English', () => {
    const r = templateAppeal({ category: 'medical_necessity', serviceDenied: '', insurer: 'Acme', vault: {}, urgent: false, lang: 'es' });
    expect(r.plainExplanation).toMatch(/Tu plan negó/);
    expect(r.appealLetter).toMatch(/I am writing to appeal/);
  });
  it('the Spanish cloud prompt asks for a Spanish explanation and an English letter, and passes the gate for every letter', async () => {
    for (const c of [...CASES, ...HELDOUT]) {
      const a = await analyse(new SimEngine('unavailable'), c.text, false, 'es');
      const req = buildAppealRequest(a, 'es');
      expect(req.prompt).toMatch(/simple, clear Spanish/);
      expect(req.prompt).toMatch(/appealLetter in English/);
      expect(checkEgress(req.prompt, a.redaction.vault, req.checkText).findings, c.id).toEqual([]);
    }
  });
});
