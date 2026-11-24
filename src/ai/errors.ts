// Plain-English messages for failures of the appeal-writing step. The message
// must say WHERE things failed: for a privacy-first app, calling an on-device
// failure a "cloud" failure would misstate where the data went.

export function friendlyDraftError(e: unknown, preferDevice: boolean): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (preferDevice) {
    if (/ONLY_ON_DEVICE|on-device model is not available|LanguageModel|not available on this device/i.test(msg)) {
      return 'Gemini Nano isn’t available on this device, so the offline draft didn’t run. Nothing was sent.';
    }
    return 'Gemini Nano couldn’t write the appeal on this device. Nothing was sent.';
  }
  if (/App ?Check|attestation|\[40[13] [A-Za-z ]*\]\s*(?:Firebase App Check|App Check)/i.test(msg)) {
    return 'Google couldn’t verify this browser (App Check), so the cloud model refused the request. This can happen on VPNs, privacy browsers or automated browsers.';
  }
  if (/high demand|\[(?:429|500|503)\b|overloaded|RESOURCE_EXHAUSTED|resource exhausted/i.test(msg)) {
    const tries = msg.match(/after (\d+) attempts/);
    return `Google’s free Gemini tier is busy right now${tries ? ` (tried ${tries[1]} times)` : ''}. Try again in a minute.`;
  }
  if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|network request failed/i.test(msg)) {
    return 'The cloud model couldn’t be reached (no network connection).';
  }
  // An HTTP error from the server is reported as such, even if its text mentions JSON.
  const status = msg.match(/\[(\d{3}) [^\]]*\]/);
  if (status) return `The cloud model couldn’t write the appeal (HTTP ${status[1]}).`;
  if (/valid JSON|Unexpected token|JSON/i.test(msg)) {
    return 'The cloud model answered, but its reply couldn’t be used.';
  }
  return 'The cloud model couldn’t write the appeal.';
}
