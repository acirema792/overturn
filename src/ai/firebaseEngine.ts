// Firebase AI Logic hybrid engine. Each step picks its inference mode on
// purpose:
//   - ONLY_ON_DEVICE for anything that reads the raw letter or photo. We do
//     NOT use PREFER_ON_DEVICE here: it silently falls back to the cloud when
//     Gemini Nano isn't ready, which would upload the patient's identity.
//   - PREFER_IN_CLOUD for the appeal letter, which reads only the redacted
//     text: the stronger cloud model writes it, and if the network fails the
//     SDK falls back to Gemini Nano so the patient still gets a draft offline.
//   - ONLY_ON_DEVICE for the appeal when the user chooses "stay offline".

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { CustomProvider, getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
  type HybridParams,
} from 'firebase/ai';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { checkEgress } from '../core/egressGate';
import {
  DraftFailedError,
  EgressBlockedError,
  ledgerEntry,
  watchGeminiRequests,
  type CloudRequest,
  type CloudAccess,
  type DeviceAvailability,
  type Engine,
  type LedgerEntry,
} from './engine';
import { entityPrompt, factsPrompt, transcribePrompt } from './prompts';
import {
  APPEAL_SCHEMA,
  ENTITY_SCHEMA,
  FACTS_SCHEMA,
  parseJson,
  type AppealResult,
  type EntityResult,
  type FactsResult,
} from './schemas';

export interface FirebaseSettings {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  recaptchaEnterpriseKey?: string;
  recaptchaV3Key?: string;
  appCheckDebug?: string;
}

/**
 * Accepts the `firebaseConfig = { … }` block exactly as the Firebase console
 * shows it (JS object syntax, with or without `const firebaseConfig =` and `;`).
 */
export function parseFirebaseConfig(raw: string | undefined): Record<string, string> | null {
  if (!raw || !raw.trim()) return null;
  const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  if (!body) return null;
  const json = body
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}');
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

export function settingsFromEnv(env: Record<string, string | undefined> = import.meta.env): FirebaseSettings | null {
  // One variable with the console's config block, or the individual variables.
  const cfg = parseFirebaseConfig(env.VITE_FIREBASE_CONFIG) ?? {};
  const pick = (key: string, envKey: string) => cfg[key] || env[envKey];
  const apiKey = pick('apiKey', 'VITE_FIREBASE_API_KEY');
  const projectId = pick('projectId', 'VITE_FIREBASE_PROJECT_ID');
  const appId = pick('appId', 'VITE_FIREBASE_APP_ID');
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain: pick('authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId,
    appId,
    messagingSenderId: pick('messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: pick('storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'),
    recaptchaEnterpriseKey: env.VITE_RECAPTCHA_ENTERPRISE_KEY || undefined,
    recaptchaV3Key: env.VITE_RECAPTCHA_V3_KEY || undefined,
    appCheckDebug: env.VITE_APPCHECK_DEBUG || undefined,
  };
}

const TEXT_IO = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

// The free Gemini Developer API has short "high demand" spikes: each model is
// tried up to 3 times (pauses below), then the next model.
const BUSY_DELAYS_MS = [2000, 6000];
// Tried in order when the configured cloud model is busy.
const CLOUD_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

const RC_DEFAULTS = {
  cloud_model: 'gemini-3.5-flash-lite',
  // Gemini 3.x ignores `temperature`, so the lever is the letter's length.
  appeal_word_limit: 400,
  // Measured on the live project: default thinking took ~100 s for an appeal,
  // LOW ~4 s with the same output quality for this task.
  appeal_thinking: 'LOW',
};

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
  // Chrome's built-in Prompt API (only used here to report status).
  const LanguageModel:
    | { availability(options?: unknown): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'> }
    | undefined;
}

export class FirebaseEngine implements Engine {
  readonly kind = 'firebase' as const;
  cloudModel = RC_DEFAULTS.cloud_model;
  appCheck: 'reCAPTCHA Enterprise' | 'reCAPTCHA v3' | 'debug token' | 'off' = 'off';
  private app: FirebaseApp;
  private wordLimit = RC_DEFAULTS.appeal_word_limit;
  private appCheckInstance: AppCheck | undefined;
  private thinking = RC_DEFAULTS.appeal_thinking;
  private ai;
  private entityModel: GenerativeModel;
  private factsModel: GenerativeModel;
  private imageModel: GenerativeModel;
  private readyRemoteConfig: Promise<void>;

  constructor(s: FirebaseSettings) {
    this.app = initializeApp({
      apiKey: s.apiKey,
      authDomain: s.authDomain,
      projectId: s.projectId,
      appId: s.appId,
      messagingSenderId: s.messagingSenderId,
      storageBucket: s.storageBucket,
    });

    // App Check is required by Firebase AI Logic. Production uses reCAPTCHA;
    // local development uses a registered debug token. In debug mode the App
    // Check SDK exchanges the debug token and never asks the provider for a
    // token, so a CustomProvider that refuses is enough (and, unlike a
    // placeholder reCAPTCHA provider, loads no third-party script).
    if (s.appCheckDebug) (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      s.appCheckDebug === 'true' ? true : s.appCheckDebug;
    let provider: ReCaptchaEnterpriseProvider | ReCaptchaV3Provider | CustomProvider | null = null;
    if (s.recaptchaEnterpriseKey) {
      provider = new ReCaptchaEnterpriseProvider(s.recaptchaEnterpriseKey);
      this.appCheck = s.appCheckDebug ? 'debug token' : 'reCAPTCHA Enterprise';
    } else if (s.recaptchaV3Key) {
      provider = new ReCaptchaV3Provider(s.recaptchaV3Key);
      this.appCheck = s.appCheckDebug ? 'debug token' : 'reCAPTCHA v3';
    } else if (s.appCheckDebug) {
      provider = new CustomProvider({
        getToken: () => Promise.reject(new Error('No attestation provider: App Check runs in debug-token mode only.')),
      });
      this.appCheck = 'debug token';
    } else {
      this.appCheck = 'off';
      console.warn('App Check is not configured: Firebase AI Logic will reject cloud requests. Set VITE_RECAPTCHA_ENTERPRISE_KEY or VITE_APPCHECK_DEBUG.');
    }
    if (provider) this.appCheckInstance = initializeAppCheck(this.app, { provider, isTokenAutoRefreshEnabled: true });

    this.ai = getAI(this.app, { backend: new GoogleAIBackend() });

    const onDeviceJson = (schema: object, io = TEXT_IO): HybridParams => ({
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: { createOptions: { ...io, temperature: 0.1, topK: 3 } as never, promptOptions: { responseConstraint: schema } },
    });
    this.entityModel = getGenerativeModel(this.ai, onDeviceJson(ENTITY_SCHEMA));
    this.factsModel = getGenerativeModel(this.ai, onDeviceJson(FACTS_SCHEMA));
    this.imageModel = getGenerativeModel(this.ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
          expectedOutputs: [{ type: 'text', languages: ['en'] }],
        },
      },
    });

    // Remote Config lets us switch the cloud model or tune the appeal prompt
    // without shipping a new build.
    const rc = getRemoteConfig(this.app);
    rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
    rc.defaultConfig = RC_DEFAULTS;
    this.readyRemoteConfig = fetchAndActivate(rc)
      .catch(() => false)
      .then(() => {
        this.cloudModel = getValue(rc, 'cloud_model').asString() || RC_DEFAULTS.cloud_model;
        const limit = getValue(rc, 'appeal_word_limit').asNumber();
        this.wordLimit = limit >= 150 && limit <= 800 ? Math.round(limit) : RC_DEFAULTS.appeal_word_limit;
        const thinking = getValue(rc, 'appeal_thinking').asString().toUpperCase();
        this.thinking = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'DEFAULT'].includes(thinking) ? thinking : RC_DEFAULTS.appeal_thinking;
      });
  }

  async cloudAccess(): Promise<CloudAccess> {
    if (!this.appCheckInstance) return 'not-configured';
    try {
      const t = await getToken(this.appCheckInstance);
      return t?.token ? 'ok' : 'blocked';
    } catch (e) {
      // Not reaching App Check says nothing about this browser; only a refusal does.
      const code = `${(e as { code?: string }).code ?? ''} ${e instanceof Error ? e.message : ''}`;
      return /network|Failed to fetch|offline/i.test(code) ? 'unknown' : 'blocked';
    }
  }

  async deviceAvailability(): Promise<DeviceAvailability> {
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    try {
      return await LanguageModel.availability(TEXT_IO);
    } catch {
      return 'unavailable';
    }
  }

  async prepareDevice(onProgress?: (fraction: number) => void): Promise<void> {
    if ((await this.deviceAvailability()) === 'unavailable') return;
    await Promise.all([
      this.entityModel.initializeDeviceModel(onProgress),
      this.factsModel.initializeDeviceModel(),
    ]);
  }

  private async onDevice<T>(step: string, model: GenerativeModel, prompt: Parameters<GenerativeModel['generateContent']>[0], parse: (t: string) => T): Promise<{ result: T; entry: LedgerEntry }> {
    // Guard BEFORE calling the SDK: when Chrome has no LanguageModel API, the
    // SDK creates no on-device adapter and sends even ONLY_ON_DEVICE requests
    // to the cloud. For the raw letter that would be a leak, so we stop here.
    if ((await this.deviceAvailability()) === 'unavailable') {
      throw new Error(`Gemini Nano is not available on this device, so "${step}" did not run on-device. Nothing was sent.`);
    }
    const t0 = performance.now();
    const { value, requests } = await watchGeminiRequests(() => model.generateContent(prompt));
    const source = value.response.inferenceSource;
    if (source !== 'on_device') {
      // Defence in depth: ONLY_ON_DEVICE should make this impossible.
      throw new Error(`${step} ran ${source}, expected on-device. Stopping.`);
    }
    return {
      result: parse(value.response.text()),
      entry: ledgerEntry({
        step,
        mode: 'ONLY_ON_DEVICE',
        where: 'on-device',
        bytesOut: 0,
        geminiRequests: requests,
        ms: Math.round(performance.now() - t0),
        model: 'Gemini Nano (Chrome)',
      }),
    };
  }

  async transcribeImage(file: File) {
    if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('Use a PNG or JPEG photo.');
    const data = await fileToBase64(file);
    const { result, entry } = await this.onDevice<string>(
      'Read the photo',
      this.imageModel,
      [transcribePrompt, { type: 'inlineData', inlineData: { data, mimeType: file.type } }],
      (t) => t.trim(),
    );
    return { text: result, entry };
  }

  findEntities(letter: string) {
    return this.onDevice<EntityResult>('Find personal details', this.entityModel, entityPrompt(letter), parseJson);
  }

  readFacts(letter: string, lang: 'en' | 'es' = 'en') {
    return this.onDevice<FactsResult>('Read the denial', this.factsModel, factsPrompt(letter, lang), parseJson);
  }

  async draftAppeal(
    req: CloudRequest,
    opts: { preferDevice: boolean; onAttempt?: (attempt: number, total: number, model: string) => void; isCancelled?: () => boolean },
  ) {
    await this.readyRemoteConfig;
    // The gate runs here, inside the engine, so no caller can skip it.
    // Remote Config sets the letter's length (the template says "under 400 words").
    const prompt = req.prompt.replace(/under \d+ words/, `under ${this.wordLimit} words`);
    // The gate guards what may leave the device, so it runs for every request
    // that can reach the cloud. "Stay offline" (ONLY_ON_DEVICE, checked below)
    // never sends anything, so it is not gated.
    const gate = checkEgress(prompt, req.vault, req.checkText);
    if (!opts.preferDevice && !gate.allowed) throw new EgressBlockedError(gate.findings);

    // Same SDK caveat as onDevice(): without the LanguageModel API, "stay
    // offline" would quietly go to the cloud. Honour the user's choice.
    if (opts.preferDevice && (await this.deviceAvailability()) === 'unavailable') {
      throw new Error('Gemini Nano is not available on this device, so the offline draft did not run. Nothing was sent.');
    }
    const mode = opts.preferDevice ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_IN_CLOUD;
    const modelFor = (cloudModel: string) =>
      getGenerativeModel(this.ai, {
        mode,
        inCloudParams: {
          model: cloudModel,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: APPEAL_SCHEMA as unknown as Record<string, unknown>,
            ...(this.thinking === 'DEFAULT' ? {} : { thinkingConfig: { thinkingLevel: this.thinking as never } }),
          },
        },
        onDeviceParams: {
          createOptions: { ...TEXT_IO, temperature: 0.4, topK: 3 } as never,
          promptOptions: { responseConstraint: APPEAL_SCHEMA },
        },
      });
    // Busy cloud models ("high demand", 429/500/503) are retried after a pause
    // (BUSY_DELAYS_MS), then the next model is tried. Every attempt sends the same
    // de-identified prompt and is counted in the ledger.
    const models = opts.preferDevice ? [this.cloudModel] : [this.cloudModel, ...CLOUD_FALLBACK_MODELS.filter((m) => m !== this.cloudModel)];
    const attempts: string[] = [];
    const t0 = performance.now();
    let watched: Awaited<ReturnType<typeof watchGeminiRequests<Awaited<ReturnType<GenerativeModel['generateContent']>>>>> | undefined;
    let usedModel = this.cloudModel;
    let requestsSeen = 0;
    const totalAttempts = models.length * (BUSY_DELAYS_MS.length + 1);
    for (const [i, cloudModel] of models.entries()) {
      for (let tryNo = 0; tryNo < BUSY_DELAYS_MS.length + 1 && !watched; tryNo++) {
        try {
          if (attempts.length > 0 && opts.isCancelled?.()) {
            throw new DraftFailedError('Cancelled by the user.', opts.preferDevice ? 0 : gate.bytes * attempts.length, requestsSeen, Math.round(performance.now() - t0));
          }
          attempts.push(cloudModel);
          if (attempts.length > 1) opts.onAttempt?.(attempts.length, totalAttempts, cloudModel);
          watched = await watchGeminiRequests(() => modelFor(cloudModel).generateContent(prompt));
          usedModel = cloudModel;
        } catch (e) {
          if (e instanceof DraftFailedError) throw e;
          const msg = e instanceof Error ? e.message : String(e);
          requestsSeen += (e as { geminiRequests?: number }).geminiRequests ?? 0;
          const busy = /\b(?:429|500|503)\b|high demand|overloaded|unavailable|resource exhausted/i.test(msg);
          const last = i === models.length - 1 && tryNo === BUSY_DELAYS_MS.length;
          if (opts.preferDevice || !busy || last) {
            // With PREFER_IN_CLOUD the request was sent before it failed.
            throw new DraftFailedError(
              attempts.length > 1 ? `${msg} (after ${attempts.length} attempts: ${attempts.join(', ')})` : msg,
              opts.preferDevice ? 0 : gate.bytes * attempts.length,
              requestsSeen,
              Math.round(performance.now() - t0),
            );
          }
          if (tryNo < BUSY_DELAYS_MS.length) await new Promise((r) => setTimeout(r, BUSY_DELAYS_MS[tryNo]));
        }
      }
      if (watched) break;
    }
    if (!watched) {
      throw new DraftFailedError('No cloud model answered.', opts.preferDevice ? 0 : gate.bytes * attempts.length, requestsSeen, Math.round(performance.now() - t0));
    }
    const { value } = watched;
    const requests = requestsSeen + watched.requests; // every attempt, not just the last
    const onDevice = value.response.inferenceSource === 'on_device';
    let result: AppealResult;
    try {
      // text() throws for a blocked answer; parseJson throws for non-JSON.
      result = parseJson<AppealResult>(value.response.text());
    } catch (e) {
      // With PREFER_IN_CLOUD the prompt was sent even if the SDK then fell back to Nano.
      throw new DraftFailedError(
        e instanceof Error ? e.message : String(e),
        opts.preferDevice ? 0 : gate.bytes * attempts.length,
        requests,
        Math.round(performance.now() - t0),
      );
    }
    return {
      result,
      entry: ledgerEntry({
        step: 'Write the appeal',
        mode: opts.preferDevice ? 'ONLY_ON_DEVICE' : 'PREFER_IN_CLOUD',
        where: onDevice ? 'on-device' : 'cloud',
        // After a failed cloud attempt the server may have received the
        // de-identified prompt (an HTTP error also triggers the fallback), so
        // count it as sent.
        bytesOut: onDevice && opts.preferDevice ? 0 : gate.bytes * attempts.length,
        geminiRequests: requests,
        ms: Math.round(performance.now() - t0),
        model: onDevice ? 'Gemini Nano (Chrome)' : usedModel,
        note:
          onDevice && !opts.preferDevice
            ? `The cloud request failed, so the SDK fell back to Gemini Nano. The ${gate.bytes.toLocaleString()}-byte de-identified prompt was sent first and may have reached the server, so it is counted as sent.`
            : attempts.length > 1
              ? `The cloud model was busy; ${attempts.length} attempts (${attempts.join(', ')}), each sending the same de-identified prompt.`
              : undefined,
        noteEs:
          onDevice && !opts.preferDevice
            ? `La solicitud a la nube falló, así que el SDK usó Gemini Nano. El texto anonimizado de ${gate.bytes.toLocaleString('es-US')} bytes se envió antes y pudo llegar al servidor, así que se cuenta como enviado.`
            : attempts.length > 1
              ? `El modelo en la nube estaba ocupado; ${attempts.length} intentos (${attempts.join(', ')}), cada uno con el mismo texto anonimizado.`
              : undefined,
      }),
    };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}
