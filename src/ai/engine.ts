import type { AppealResult, EntityResult, FactsResult } from './schemas';

export type DeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type Where = 'on-device' | 'cloud' | 'code' | 'blocked';

/** One row of the privacy ledger: what ran where, and what left the device. */
export interface LedgerEntry {
  id: number;
  at: string;
  step: string;
  /** The inference mode we asked Firebase AI Logic for. */
  mode?: string;
  /** Where it actually ran: from `response.inferenceSource`, or our own code. */
  where: Where;
  /** Bytes of prompt sent off the device (0 for on-device and code). */
  bytesOut: number;
  /** Requests to Gemini endpoints the browser observed during this step. */
  geminiRequests: number;
  ms: number;
  model?: string;
  note?: string;
  /** The same note in Spanish, shown when the UI is in Spanish. */
  noteEs?: string;
}

export interface CloudRequest {
  prompt: string;
  vault: Record<string, string>;
  /** Per-letter text the gate searches for identifiers (defaults to the prompt). */
  checkText?: string;
}

export class EgressBlockedError extends Error {
  findings: { excerpt: string; kind?: string; reason: string }[];
  constructor(findings: { excerpt: string; kind?: string; reason: string }[]) {
    super(`Blocked: the outgoing text still contains ${findings.length} identifier(s).`);
    this.findings = findings;
  }
}

/**
 * The appeal request failed after it may have left the device (network or
 * HTTP error with no on-device fallback). `attemptedBytes` is the size of the
 * de-identified prompt that was sent, so the ledger can record it honestly.
 */
export class DraftFailedError extends Error {
  attemptedBytes: number;
  /** Gemini requests the browser recorded across all attempts (-1 if unknown). */
  geminiRequests: number;
  ms: number;
  constructor(message: string, attemptedBytes: number, geminiRequests = -1, ms = 0) {
    super(message);
    this.attemptedBytes = attemptedBytes;
    this.geminiRequests = geminiRequests;
    this.ms = ms;
  }
}

export type CloudAccess = 'ok' | 'blocked' | 'not-configured' | 'unknown';

export interface Engine {
  readonly kind: 'firebase' | 'simulated';
  readonly cloudModel: string;
  /** How this build proves itself to Firebase (App Check). */
  readonly appCheck: string;
  deviceAvailability(): Promise<DeviceAvailability>;
  /** Must be called from a user gesture (Chrome's user-activation rule). */
  prepareDevice(onProgress?: (fraction: number) => void): Promise<void>;
  transcribeImage(file: File): Promise<{ text: string; entry: LedgerEntry }>;
  findEntities(letter: string): Promise<{ result: EntityResult; entry: LedgerEntry }>;
  readFacts(letter: string, lang?: 'en' | 'es'): Promise<{ result: FactsResult; entry: LedgerEntry }>;
  /** Runs the egress gate first; throws EgressBlockedError if it fails. */
  draftAppeal(
    req: CloudRequest,
    opts: {
      preferDevice: boolean;
      onAttempt?: (attempt: number, total: number, model: string) => void;
      /** Checked before every retry: a cancelled draft sends nothing more. */
      isCancelled?: () => boolean;
    },
  ): Promise<{ result: AppealResult; entry: LedgerEntry }>;
  /** Whether this browser can get an App Check token (the cloud refuses requests without one). */
  cloudAccess(): Promise<CloudAccess>;
}

let nextId = 1;
export function ledgerEntry(fields: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
  return { id: nextId++, at: new Date().toISOString(), ...fields };
}

const GEMINI_HOSTS = ['firebasevertexai.googleapis.com', 'generativelanguage.googleapis.com', 'aiplatform.googleapis.com'];

/**
 * Counts requests to Gemini endpoints made while `fn` runs, using the
 * browser's own Resource Timing records. This is the receipt behind
 * "0 requests left the device" for on-device steps.
 */
export async function watchGeminiRequests<T>(fn: () => Promise<T>): Promise<{ value: T; requests: number }> {
  const seen = new Set<string>();
  const record = (e: PerformanceEntry) => {
    if (GEMINI_HOSTS.some((h) => e.name.includes(h))) seen.add(`${e.name}@${e.startTime}`);
  };
  const start = performance.now();
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => list.getEntries().forEach(record));
    observer.observe({ type: 'resource', buffered: false });
  } catch {
    observer = undefined;
  }
  try {
    const value = await fn();
    // Pick up entries the observer may not have flushed yet.
    performance.getEntriesByType('resource').filter((e) => e.startTime >= start).forEach(record);
    return { value, requests: seen.size };
  } catch (e) {
    performance.getEntriesByType('resource').filter((x) => x.startTime >= start).forEach(record);
    if (e && typeof e === 'object') (e as { geminiRequests?: number }).geminiRequests = seen.size;
    throw e;
  } finally {
    observer?.disconnect();
  }
}
