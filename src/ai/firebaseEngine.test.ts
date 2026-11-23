// F8: the installed SDK sends ONLY_ON_DEVICE requests to the cloud when
// Chrome's LanguageModel API is missing (no Chrome adapter is created). The
// engine must refuse BEFORE calling the SDK. Also: the egress gate runs before
// any cloud-capable request, and each step asks for the right mode.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { mode: string; prompt: unknown }[] = [];
let fallbackOnce = false;
let failOnce = false;
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(),
  ReCaptchaEnterpriseProvider: class {},
  ReCaptchaV3Provider: class {},
  CustomProvider: class {},
}));
vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: () => ({ settings: {}, defaultConfig: {} }),
  fetchAndActivate: () => Promise.resolve(true),
  getValue: () => ({ asString: () => '', asNumber: () => 0 }),
}));
vi.mock('firebase/ai', () => ({
  getAI: () => ({}),
  GoogleAIBackend: class {},
  InferenceMode: { PREFER_ON_DEVICE: 'prefer_on_device', ONLY_ON_DEVICE: 'only_on_device', ONLY_IN_CLOUD: 'only_in_cloud', PREFER_IN_CLOUD: 'prefer_in_cloud' },
  getGenerativeModel: (_ai: unknown, params: { mode: string }) => ({
    initializeDeviceModel: () => Promise.resolve(),
    generateContent: (prompt: unknown) => {
      calls.push({ mode: params.mode, prompt });
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error('403 Forbidden'));
      }
      const json = JSON.stringify({ plainExplanation: 'x', strongestArguments: [], evidenceToGather: [], questionsForDoctor: [], appealLetter: 'Dear [PERSON_1]' });
      const onDevice = params.mode === 'only_on_device' || fallbackOnce;
      fallbackOnce = false;
      return Promise.resolve({ response: { text: () => json, inferenceSource: onDevice ? 'on_device' : 'in_cloud' } });
    },
  }),
}));

import { FirebaseEngine, parseFirebaseConfig, settingsFromEnv } from './firebaseEngine';
import { initializeAppCheck } from 'firebase/app-check';
import { DraftFailedError, EgressBlockedError } from './engine';

const settings = { apiKey: 'k', projectId: 'p', appId: 'a' };

describe('FirebaseEngine', () => {
  beforeEach(() => {
    calls.length = 0;
    delete (globalThis as Record<string, unknown>).LanguageModel;
  });

  it('refuses on-device steps when Chrome has no LanguageModel API, without calling the SDK', async () => {
    const e = new FirebaseEngine(settings);
    await expect(e.findEntities('Dear Maria Gonzalez')).rejects.toThrow(/on-device/i);
    await expect(e.readFacts('Dear Maria Gonzalez')).rejects.toThrow(/on-device/i);
    expect(calls).toEqual([]);
  });

  it('refuses on-device steps when the model is unavailable', async () => {
    (globalThis as Record<string, unknown>).LanguageModel = { availability: () => Promise.resolve('unavailable') };
    const e = new FirebaseEngine(settings);
    await expect(e.findEntities('Dear Maria Gonzalez')).rejects.toThrow(/on-device/i);
    expect(calls).toEqual([]);
  });

  it('uses ONLY_ON_DEVICE for raw-letter steps when Nano is present', async () => {
    (globalThis as Record<string, unknown>).LanguageModel = { availability: () => Promise.resolve('available') };
    const e = new FirebaseEngine(settings);
    await e.findEntities('Dear Maria Gonzalez').catch(() => undefined);
    expect(calls.map((c) => c.mode)).toEqual(['only_on_device']);
  });

  it('blocks the appeal before any request when the prompt still holds an identifier', async () => {
    const e = new FirebaseEngine(settings);
    await expect(
      e.draftAppeal({ prompt: 'Appeal for Maria Gonzalez', vault: { '[PERSON_1]': 'Maria Gonzalez' } }, { preferDevice: false }),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(calls).toEqual([]);
  });

  it('"stay offline" refuses instead of going to the cloud when Nano is missing', async () => {
    const e = new FirebaseEngine(settings);
    await expect(
      e.draftAppeal({ prompt: 'Appeal for [PERSON_1]', vault: { '[PERSON_1]': 'Maria Gonzalez' } }, { preferDevice: true }),
    ).rejects.toThrow(/offline draft did not run/);
    expect(calls).toEqual([]);
  });

  it('initialises App Check with only a debug token configured (F9)', () => {
    vi.mocked(initializeAppCheck).mockClear();
    const e = new FirebaseEngine({ ...settings, appCheckDebug: 'true' });
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(e.appCheck).toBe('debug token');
  });

  it('reports App Check as off when nothing is configured (F9)', () => {
    vi.mocked(initializeAppCheck).mockClear();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = new FirebaseEngine(settings);
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(e.appCheck).toBe('off');
    warn.mockRestore();
  });

  it('counts the prompt as sent when the cloud failed and the SDK fell back to Nano (F10)', async () => {
    fallbackOnce = true;
    const e = new FirebaseEngine(settings);
    const r = await e.draftAppeal({ prompt: 'Appeal for [PERSON_1]', vault: { '[PERSON_1]': 'Maria Gonzalez' } }, { preferDevice: false });
    expect(r.entry.where).toBe('on-device');
    expect(r.entry.bytesOut).toBeGreaterThan(0);
  });

  it('reports the bytes of a cloud attempt that failed (G3)', async () => {
    failOnce = true;
    const e = new FirebaseEngine(settings);
    const err = await e
      .draftAppeal({ prompt: 'Appeal for [PERSON_1]', vault: { '[PERSON_1]': 'Maria Gonzalez' } }, { preferDevice: false })
      .catch((x) => x);
    expect(err).toBeInstanceOf(DraftFailedError);
    expect(err.attemptedBytes).toBeGreaterThan(0);
  });

  it('sends a clean appeal prompt with PREFER_IN_CLOUD', async () => {
    const e = new FirebaseEngine(settings);
    const r = await e.draftAppeal({ prompt: 'Appeal for [PERSON_1]', vault: { '[PERSON_1]': 'Maria Gonzalez' } }, { preferDevice: false });
    expect(calls.map((c) => c.mode)).toEqual(['prefer_in_cloud']);
    expect(r.entry.where).toBe('cloud');
  });
});

describe('config from one variable', () => {
  const pasted = `// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaFAKE",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  storageBucket: "demo.firebasestorage.app",
  messagingSenderId: "1",
  appId: "1:1:web:abc"
};`;
  it('parses the console block as pasted', () => {
    expect(parseFirebaseConfig(pasted)).toMatchObject({ apiKey: 'AIzaFAKE', projectId: 'demo', appId: '1:1:web:abc' });
  });
  it('settingsFromEnv uses it with the site key', () => {
    expect(settingsFromEnv({ VITE_FIREBASE_CONFIG: pasted, VITE_RECAPTCHA_V3_KEY: 'site' })).toMatchObject({ projectId: 'demo', recaptchaV3Key: 'site' });
  });
  it('returns null when nothing is configured', () => expect(settingsFromEnv({})).toBeNull());
});
