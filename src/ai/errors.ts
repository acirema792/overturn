// Plain-English messages for failures of the appeal-writing step. The message
// must say WHERE things failed: for a privacy-first app, calling an on-device
// failure a "cloud" failure would misstate where the data went.

const ES: Record<string, string> = {
  nanoMissing: 'Gemini Nano no está disponible en este dispositivo, así que el borrador sin conexión no se ejecutó. No se envió nada.',
  nanoFailed: 'Gemini Nano no pudo redactar la apelación en este dispositivo. No se envió nada.',
  appCheck: 'Google no pudo verificar este navegador (App Check), así que el modelo en la nube rechazó la solicitud. Puede pasar con VPN, navegadores privados o automatizados.',
  busy: 'El nivel gratuito de Gemini está saturado{tries}. Inténtalo de nuevo en un minuto.',
  network: 'No se pudo conectar con el modelo en la nube (sin conexión a internet).',
  http: 'El modelo en la nube no pudo redactar la apelación (HTTP {status}).',
  badReply: 'El modelo en la nube respondió, pero su respuesta no se pudo usar.',
  generic: 'El modelo en la nube no pudo redactar la apelación.',
};

export function friendlyDraftError(e: unknown, preferDevice: boolean, lang: 'en' | 'es' = 'en'): string {
  const en = friendlyDraftErrorEn(e, preferDevice);
  if (lang === 'en') return en.text;
  return ES[en.kind].replace('{tries}', en.tries ? ` (se intentó ${en.tries} veces)` : '').replace('{status}', en.status ?? '');
}

function friendlyDraftErrorEn(
  e: unknown,
  preferDevice: boolean,
): { kind: keyof typeof ES; text: string; tries?: string; status?: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (preferDevice) {
    if (/ONLY_ON_DEVICE|on-device model is not available|LanguageModel|not available on this device/i.test(msg)) {
      return { kind: 'nanoMissing', text: 'Gemini Nano isn’t available on this device, so the offline draft didn’t run. Nothing was sent.' };
    }
    return { kind: 'nanoFailed', text: 'Gemini Nano couldn’t write the appeal on this device. Nothing was sent.' };
  }
  if (/App ?Check|attestation|\[40[13] [A-Za-z ]*\]\s*(?:Firebase App Check|App Check)/i.test(msg)) {
    return {
      kind: 'appCheck',
      text: 'Google couldn’t verify this browser (App Check), so the cloud model refused the request. This can happen on VPNs, privacy browsers or automated browsers.',
    };
  }
  if (/high demand|\[(?:429|500|503)\b|overloaded|RESOURCE_EXHAUSTED|resource exhausted/i.test(msg)) {
    const tries = msg.match(/after (\d+) attempts/);
    return { kind: 'busy', tries: tries?.[1], text: `Google’s free Gemini tier is busy right now${tries ? ` (tried ${tries[1]} times)` : ''}. Try again in a minute.` };
  }
  if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|network request failed/i.test(msg)) {
    return { kind: 'network', text: 'The cloud model couldn’t be reached (no network connection).' };
  }
  // An HTTP error from the server is reported as such, even if its text mentions JSON.
  const status = msg.match(/\[(\d{3}) [^\]]*\]/);
  if (status) return { kind: 'http', status: status[1], text: `The cloud model couldn’t write the appeal (HTTP ${status[1]}).` };
  if (/valid JSON|Unexpected token|JSON/i.test(msg)) {
    return { kind: 'badReply', text: 'The cloud model answered, but its reply couldn’t be used.' };
  }
  return { kind: 'generic', text: 'The cloud model couldn’t write the appeal.' };
}
