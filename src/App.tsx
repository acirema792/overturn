import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CloudAccess, DeviceAvailability } from './ai/engine';
import { AppealFlow } from './components/AppealFlow';
import { Benchmark } from './components/Benchmark';
import { HowItWorks } from './components/HowItWorks';
import { chooseEngine } from './engineFactory';
import { initialLang, LangContext, saveLang, translate, type Key, type Lang } from './i18n';

type Route = 'appeal' | 'benchmark' | 'how';
const routeFromHash = (): Route => (location.hash === '#/benchmark' ? 'benchmark' : location.hash === '#/how' ? 'how' : 'appeal');

const DEVICE_LABEL: Record<DeviceAvailability, Key> = {
  available: 'nanoAvailable',
  downloadable: 'nanoDownloadable',
  downloading: 'nanoDownloading',
  unavailable: 'nanoUnavailable',
};

export default function App() {
  const choice = useMemo(() => chooseEngine(), []);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [device, setDevice] = useState<DeviceAvailability>('unavailable');
  const [online, setOnline] = useState(navigator.onLine);
  const [cloud, setCloud] = useState<CloudAccess>('unknown');
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);

  const refreshDevice = useCallback(() => {
    choice.engine?.deviceAvailability().then(setDevice).catch(() => setDevice('unavailable'));
  }, [choice]);

  useEffect(() => {
    // Offline, App Check can't be reached: that says nothing about this browser.
    const probe = () => {
      if (!navigator.onLine) return setCloud('unknown');
      choice.engine?.cloudAccess().then(setCloud).catch(() => setCloud('unknown'));
    };
    const offline = () => setCloud('unknown');
    probe();
    window.addEventListener('online', probe);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', probe);
      window.removeEventListener('offline', offline);
    };
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
    <LangContext.Provider value={lang}>
      {choice.engine?.kind === 'simulated' && (
        <div className="sim-banner" role="note">
          {t('simBanner')}
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
          <span className="tagline">{t('tagline')}</span>
        </div>
        <nav>
          <a href="#/" className={route === 'appeal' ? 'on' : ''}>
            {t('navAppeal')}
          </a>
          <a href="#/how" className={route === 'how' ? 'on' : ''}>
            {t('navHow')}
          </a>
          <a href="#/benchmark" className={route === 'benchmark' ? 'on' : ''}>
            {t('navBenchmark')}
          </a>
          <span className="lang-switch" role="group" aria-label="Language / Idioma">
            <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">
              English
            </button>
            <button className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')} lang="es">
              Español
            </button>
          </span>
        </nav>
        <div className="status" aria-live="polite">
          <span className={`pill ${device === 'available' ? 'pill-ok' : device === 'unavailable' ? 'pill-off' : 'pill-wait'}`}>
            {t(DEVICE_LABEL[device])}
          </span>
          <span className={`pill ${online ? 'pill-cloud' : 'pill-off'}`}>{online ? t('cloudPill', { model: choice.engine?.cloudModel ?? '—' }) : t('offlinePill')}</span>
          {cloud === 'blocked' && (
            <span
              className="pill pill-wait"
              title={t('cloudBlockedTitle')}
            >
              {t('cloudBlocked')}
            </span>
          )}
          {choice.engine?.appCheck === 'off' && (
            <span className="pill pill-wait" title={t('appCheckOffTitle')}>
              {t('appCheckOff')}
            </span>
          )}
        </div>
      </header>
      <main>
        {!choice.engine ? (
          <div className="flow">
            <section className="card">
              <h2>{t('setupNeeded')}</h2>
              <p>{choice.reason}</p>
              <p>
                {t('setupSimPre')} <a href="?engine=sim">{t('setupSimLink')}</a>.
              </p>
            </section>
            <HowItWorks />
          </div>
        ) : route === 'benchmark' ? (
          <>
            {lang === 'es' && <p className="note">{t('englishOnlyPage')}</p>}
            <Benchmark engine={choice.engine} device={device} />
          </>
        ) : route === 'how' ? (
          <>
            {lang === 'es' && <p className="note">{t('englishOnlyPage')}</p>}
            <HowItWorks />
          </>
        ) : (
          <AppealFlow engine={choice.engine} device={device} onDeviceChange={refreshDevice} />
        )}
      </main>
      <footer>
        <span>
          {t('footBuilt')} · App Check: {choice.engine?.appCheck ?? 'n/a'} · <a href="https://github.com/acirema792/overturn">{t('footSource')}</a> ·{' '}
          {t('footNotAdvice')} · {t('footSynthetic')}
        </span>
      </footer>
    </LangContext.Provider>
  );
}
