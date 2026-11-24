import { describe, expect, it } from 'vitest';
import { friendlyDraftError } from './errors';

const sdk = (status: string, text: string) =>
  new Error(`AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/p/models/m:generateContent: [${status}] ${text} (AI/fetch-error)`);

describe('friendlyDraftError says where it failed', () => {
  it('offline draft failures are never called cloud failures', () => {
    const m = friendlyDraftError(new Error('Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.'), true);
    expect(m).toMatch(/Gemini Nano/);
    expect(m).not.toMatch(/cloud|busy/i);
  });
  it('App Check refusals', () => expect(friendlyDraftError(sdk('401 Unauthorized', 'Firebase App Check token is invalid.'), false)).toMatch(/App Check/));
  it('busy model', () => expect(friendlyDraftError(new Error(`${sdk('500 Internal Server Error', 'This model is currently experiencing high demand.').message} (after 6 attempts: a, b)`), false)).toMatch(/busy.*6 times/));
  it('other HTTP errors are not called network errors', () => {
    const m = friendlyDraftError(sdk('400 Bad Request', 'API key not valid.'), false);
    expect(m).not.toMatch(/network/);
    expect(m).toMatch(/HTTP 400/);
  });
  it('a 403 that is not App Check is not called App Check', () => {
    expect(friendlyDraftError(sdk('403 Forbidden', 'Generative Language API has not been used in project.'), false)).not.toMatch(/App Check/);
  });
  it('a JSON parse error with digits is not called App Check', () => {
    expect(friendlyDraftError(new Error('Unexpected token } in JSON at position 4012'), false)).toMatch(/reply couldn/);
  });
  it('real network failures', () => expect(friendlyDraftError(new TypeError('Failed to fetch'), false)).toMatch(/no network/));
});
