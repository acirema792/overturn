import type { Engine } from './ai/engine';
import { FirebaseEngine, settingsFromEnv } from './ai/firebaseEngine';
import { SimEngine } from './ai/simEngine';

export interface EngineChoice {
  engine: Engine | null;
  reason?: string;
}

export function chooseEngine(search = location.search): EngineChoice {
  const params = new URLSearchParams(search);
  if (params.get('engine') === 'sim') {
    const d = params.get('device');
    const device = d === 'unavailable' || d === 'downloadable' ? d : 'available';
    return { engine: new SimEngine(device) };
  }
  const settings = settingsFromEnv();
  if (!settings) {
    return { engine: null, reason: 'This build has no Firebase configuration. See README → "Run it yourself".' };
  }
  try {
    return { engine: new FirebaseEngine(settings) };
  } catch (e) {
    return { engine: null, reason: e instanceof Error ? e.message : String(e) };
  }
}
