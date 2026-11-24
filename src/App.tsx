import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CloudAccess, DeviceAvailability } from './ai/engine';
import { AppealFlow } from './components/AppealFlow';
import { Benchmark } from './components/Benchmark';
import { HowItWorks } from './components/HowItWorks';
import { chooseEngine } from './engineFactory';

type Route = 'appeal' | 'benchmark' | 'how';
const routeFromHash = (): Route => (location.hash === '#/benchmark' ? 'benchmark' : location.hash === '#/how' ? 'how' : 'appeal');

const DEVICE_LABEL: Record<DeviceAvailability, string> = {
  available: 'Gemini Nano ready on this device',
  downloadable: 'Gemini Nano can be downloaded',
  downloading: 'Gemini Nano is downloading',
  unavailable: 'Gemini Nano not available in this browser',
};

export default function App() {
  const choice = useMemo(() => chooseEngine(), []);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [device, setDevice] = useState<DeviceAvailability>('unavailable');
  const [online, setOnline] = useState(navigator.onLine);
  const [cloud, setCloud] = useState<CloudAccess>('unknown');

  const refreshDevice = useCallback(() => {
    choice.engine?.deviceAvailability().then(setDevice).catch(() => setDevice('unavailable'));
  }, [choice]);

  useEffect(() => {
    choice.engine?.cloudAccess().then(setCloud).catch(() => setCloud('unknown'));
  }, [choice]);

  useEffect(() => {
    refreshDevice();
    const onHash = () => setRoute(routeFromHash());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refreshDevice]);

  return (
    <>
      {choice.engine?.kind === 'simulated' && (
        <div className="sim-banner" role="note">
          SIMULATED ENGINE: no AI model is running. For UI testing only; nothing here is a real result.
        </div>
      )}
      <header className="top">
        <div className="brand">
          <a href="#/" className="logo" aria-label="Overturn home">
            <span className="logo-mark" aria-hidden>
              ↺
            </span>
            Overturn
          </a>
          <span className="tagline">Appeal a health insurance denial. Your identity stays on your device.</span>
        </div>
        <nav>
          <a href="#/" className={route === 'appeal' ? 'on' : ''}>
            Appeal
          </a>
          <a href="#/how" className={route === 'how' ? 'on' : ''}>
            How it works
          </a>
          <a href="#/benchmark" className={route === 'benchmark' ? 'on' : ''}>
            Benchmark
          </a>
        </nav>
        <div className="status" aria-live="polite">
          <span className={`pill ${device === 'available' ? 'pill-ok' : device === 'unavailable' ? 'pill-off' : 'pill-wait'}`}>
            {DEVICE_LABEL[device]}
          </span>
          <span className={`pill ${online ? 'pill-cloud' : 'pill-off'}`}>{online ? `Cloud: ${choice.engine?.cloudModel ?? 'not set up'}` : 'Offline'}</span>
          {cloud === 'blocked' && (
            <span
              className="pill pill-wait"
              title="Google's App Check couldn't verify this browser (common on VPNs, privacy or automated browsers). On-device reading, the review screen and the template letter still work."
            >
              Cloud blocked in this browser
            </span>
          )}
          {choice.engine?.appCheck === 'off' && (
            <span className="pill pill-wait" title="Firebase AI Logic requires App Check; cloud requests will be rejected">
              App Check not configured
            </span>
          )}
        </div>
      </header>
      <main>
        {!choice.engine ? (
          <div className="flow">
            <section className="card">
              <h2>Setup needed</h2>
              <p>{choice.reason}</p>
              <p>
                To look around without a model, open <a href="?engine=sim">the simulated UI</a>.
              </p>
            </section>
            <HowItWorks />
          </div>
        ) : route === 'benchmark' ? (
          <Benchmark engine={choice.engine} device={device} />
        ) : route === 'how' ? (
          <HowItWorks />
        ) : (
          <AppealFlow engine={choice.engine} device={device} onDeviceChange={refreshDevice} />
        )}
      </main>
      <footer>
        <span>
          Built with Firebase AI Logic hybrid inference · App Check: {choice.engine?.appCheck ?? 'n/a'} ·{' '}
          <a href="https://github.com/acirema792/overturn">Source (Apache-2.0)</a> · Not legal or medical advice · Sample letters are synthetic
        </span>
      </footer>
    </>
  );
}
