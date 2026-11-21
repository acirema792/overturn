// SIMULATED engine for UI development and automated UI tests ONLY. No model
// runs. It is enabled with ?engine=sim, and the app shows a "Simulated" banner
// on every screen while it is active. Never used for any reported number.

import { classifyDenial } from '../core/categories';
import { findNoticeDate, findWindowDays, guessPlanType } from '../core/deadline';
import { templateAppeal } from '../core/template';
import { PLACEHOLDER_RE } from '../core/redact';
import { CASES } from '../data/cases';
import { checkEgress } from '../core/egressGate';
import { EgressBlockedError, ledgerEntry, type CloudRequest, type DeviceAvailability, type Engine } from './engine';
import type { EntityResult, FactsResult } from './schemas';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SimEngine implements Engine {
  readonly kind = 'simulated' as const;
  readonly cloudModel = 'simulated';
  readonly appCheck = 'not used (simulated)';
  private device: DeviceAvailability;
  constructor(device: DeviceAvailability = 'available') {
    this.device = device;
  }

  async deviceAvailability() {
    return this.device;
  }
  async prepareDevice() {}

  async transcribeImage(): Promise<never> {
    throw new Error('Photo reading needs Gemini Nano in Chrome (not available in simulation).');
  }

  async findEntities(letter: string) {
    if (this.device !== 'available') throw new Error('Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.');
    await wait(300);
    const known = CASES.find((c) => c.text === letter);
    const result: EntityResult = {
      people: (known?.identifiers ?? []).filter((v) => /^[A-Za-z][a-z'’ .-]+[a-z]$/i.test(v) && !/\d/.test(v) && v.includes(' ')).map((name) => ({ name, role: 'other' as const })),
      identifiers: [],
      addresses: [],
      contacts: [],
      organisationsAboutThePatient: [],
    };
    return { result, entry: ledgerEntry({ step: 'Find personal details', mode: 'ONLY_ON_DEVICE', where: 'on-device', bytesOut: 0, geminiRequests: 0, ms: 300, model: 'SIMULATED' }) };
  }

  async readFacts(letter: string) {
    if (this.device !== 'available') throw new Error('Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.');
    await wait(300);
    const result: FactsResult = {
      insurer: letter.split('\n')[0].trim().slice(0, 60),
      planType: guessPlanType(letter),
      denialCategory: classifyDenial(letter),
      serviceDenied: '',
      reasonInPlainWords: 'Simulated: no model ran.',
      noticeDate: findNoticeDate(letter) ?? '',
      appealWindowDays: findWindowDays(letter) ?? 0,
      urgent: false,
    };
    return { result, entry: ledgerEntry({ step: 'Read the denial', mode: 'ONLY_ON_DEVICE', where: 'on-device', bytesOut: 0, geminiRequests: 0, ms: 300, model: 'SIMULATED' }) };
  }

  async draftAppeal(req: CloudRequest, opts: { preferDevice: boolean }) {
    const gate = checkEgress(req.prompt, req.vault, req.checkText);
    if (!opts.preferDevice && !gate.allowed) throw new EgressBlockedError(gate.findings);
    await wait(500);
    const letterPart = req.prompt.split('DE-IDENTIFIED LETTER:')[1] ?? '';
    const placeholders = [...new Set(letterPart.match(PLACEHOLDER_RE) ?? [])];
    const vault = Object.fromEntries(placeholders.map((p) => [p, req.vault[p] ?? p]));
    const result = templateAppeal({ category: classifyDenial(letterPart), serviceDenied: '', insurer: '', vault, urgent: false });
    return {
      result,
      entry: ledgerEntry({
        step: 'Write the appeal',
        mode: opts.preferDevice ? 'ONLY_ON_DEVICE' : 'PREFER_IN_CLOUD',
        where: opts.preferDevice ? 'on-device' : 'cloud',
        bytesOut: opts.preferDevice ? 0 : gate.bytes,
        geminiRequests: 0,
        ms: 500,
        model: 'SIMULATED',
      }),
    };
  }
}
