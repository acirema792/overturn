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
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check';
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
  EgressBlockedError,
  ledgerEntry,
  watchGeminiRequests,
  type CloudRequest,
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

export function settingsFromEnv(): FirebaseSettings | null {
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID || !env.VITE_FIREBASE_APP_ID) return null;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    recaptchaEnterpriseKey: env.VITE_RECAPTCHA_ENTERPRISE_KEY,
    recaptchaV3Key: env.VITE_RECAPTCHA_V3_KEY,
    appCheckDebug: env.VITE_APPCHECK_DEBUG,
  };
}

const TEXT_IO = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

const RC_DEFAULTS = {
  cloud_model: 'gemini-3.5-flash-lite',
  appeal_temperature: 0.4,
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
  private app: FirebaseApp;
  private temperature = RC_DEFAULTS.appeal_temperature;
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

    // App Check is required by Firebase AI Logic. Debug tokens are for local
    // development and judging builds only; production uses reCAPTCHA.
    if (s.appCheckDebug) self.FIREBASE_APPCHECK_DEBUG_TOKEN = s.appCheckDebug === 'true' ? true : s.appCheckDebug;
    const provider = s.recaptchaEnterpriseKey
      ? new ReCaptchaEnterpriseProvider(s.recaptchaEnterpriseKey)
      : s.recaptchaV3Key
        ? new ReCaptchaV3Provider(s.recaptchaV3Key)
        : null;
    if (provider) initializeAppCheck(this.app, { provider, isTokenAutoRefreshEnabled: true });

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
        this.temperature = getValue(rc, 'appeal_temperature').asNumber() || RC_DEFAULTS.appeal_temperature;
      });
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

  readFacts(letter: string) {
    return this.onDevice<FactsResult>('Read the denial', this.factsModel, factsPrompt(letter), parseJson);
  }

  async draftAppeal(req: CloudRequest, opts: { preferDevice: boolean }) {
    await this.readyRemoteConfig;
    // The gate runs here, inside the engine, so no caller can skip it.
    const gate = checkEgress(req.prompt, req.vault);
    if (!gate.allowed) throw new EgressBlockedError(gate.findings);

    const mode = opts.preferDevice ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_IN_CLOUD;
    const model = getGenerativeModel(this.ai, {
      mode,
      inCloudParams: {
        model: this.cloudModel,
        generationConfig: {
          temperature: this.temperature,
          responseMimeType: 'application/json',
          responseJsonSchema: APPEAL_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      onDeviceParams: {
        createOptions: { ...TEXT_IO, temperature: 0.4, topK: 3 } as never,
        promptOptions: { responseConstraint: APPEAL_SCHEMA },
      },
    });
    const t0 = performance.now();
    const { value, requests } = await watchGeminiRequests(() => model.generateContent(req.prompt));
    const onDevice = value.response.inferenceSource === 'on_device';
    return {
      result: parseJson<AppealResult>(value.response.text()),
      entry: ledgerEntry({
        step: 'Write the appeal',
        mode: opts.preferDevice ? 'ONLY_ON_DEVICE' : 'PREFER_IN_CLOUD',
        where: onDevice ? 'on-device' : 'cloud',
        bytesOut: onDevice ? 0 : gate.bytes,
        geminiRequests: requests,
        ms: Math.round(performance.now() - t0),
        model: onDevice ? 'Gemini Nano (Chrome)' : this.cloudModel,
        note: onDevice && !opts.preferDevice ? 'Cloud unreachable: the SDK fell back to Gemini Nano.' : undefined,
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
