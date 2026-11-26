import { useEffect, useMemo, useRef, useState } from 'react';
import { DraftFailedError, EgressBlockedError, ledgerEntry, watchGeminiRequests, type DeviceAvailability, type Engine, type LedgerEntry } from '../ai/engine';
import type { AppealResult } from '../ai/schemas';
import { categoryLabel, categoryPlaybook } from '../core/categories';
import { useLang, useT, type Key } from '../i18n';
import { checkEgress } from '../core/egressGate';
import { rehydrate } from '../core/redact';
import { templateAppeal } from '../core/template';
import { CASES } from '../data/cases';
import { analyse, buildAppealPrompt, buildAppealRequest, finishAnalysis, patientPlaceholder, applyVault, type Analysis } from '../pipeline';
import { OriginalWithHighlights, RedactedText } from './Highlight';
import { friendlyDraftError } from '../ai/errors';
import { MAX_PDF_PAGES, pdfErrorKind, readPdfText } from '../pdf/readPdf';
import { Ledger } from './Ledger';
import { deadlineExplanation, externalReviewText } from '../deadlineText';

const SAMPLES = [CASES[0], CASES[1], CASES[13]];

type Stage = 'input' | 'reading' | 'review' | 'drafting' | 'result';

const fmtDate = (iso: string, lang: 'en' | 'es' = 'en') =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function icsFor(deadline: string, title: string): string {
  const d = deadline.replace(/-/g, '');
  const next = new Date(`${deadline}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Overturn//EN', 'BEGIN:VEVENT',
    `UID:${d}-${Math.random().toString(36).slice(2)}@overturn`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${title}`,
    'BEGIN:VALARM', 'TRIGGER:-P14D', 'ACTION:DISPLAY', 'DESCRIPTION:Appeal deadline in 2 weeks', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AppealFlow({ engine, device, onDeviceChange }: { engine: Engine; device: DeviceAvailability; onDeviceChange: () => void }) {
  const t = useT();
  const lang = useLang();
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [appeal, setAppeal] = useState<AppealResult | null>(null);
  const [letter, setLetter] = useState('');
  const [unknownPh, setUnknownPh] = useState<string[]>([]);
  const [extraLedger, setExtraLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState(0); // > 0: a PDF was cut at MAX_PDF_PAGES
  const [progress, setProgress] = useState<string>('');
  const [selection, setSelection] = useState('');
  const [typedHide, setTypedHide] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const deviceOk = device === 'available' || device === 'downloadable' || device === 'downloading';

  // A draft can be cancelled by "Start over"; its late result must be ignored.
  const runRef = useRef(0);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Keyboard and screen-reader users land on the new stage's heading.
    const h = topRef.current?.querySelector('section h2');
    if (h instanceof HTMLElement) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [stage]);

  const gate = useMemo(() => {
    if (!analysis) return null;
    const req = buildAppealRequest(analysis, lang);
    return checkEgress(req.prompt, analysis.redaction.vault, req.checkText);
  }, [analysis, lang]);

  const ledger = [...(analysis?.ledger ?? []), ...extraLedger];

  async function read(raw: string, useDevice: boolean) {
    setError(null);
    // Keep the photo- or PDF-reading row: it is part of this letter's history.
    setExtraLedger((l) => l.filter((e) => e.step === 'Read the photo' || e.step === 'Read the PDF'));
    setStage('reading');
    try {
      let prepareError: string | undefined;
      if (useDevice) {
        setProgress(t('progPrepareNano'));
        try {
          // Must run inside the click handler's task chain (user activation).
          await engine.prepareDevice((f) => setProgress(t('progDownloadNano', { pct: Math.round(f * 100) })));
          onDeviceChange();
        } catch (err) {
          // Don't block the patient: fall back to the on-device rules.
          prepareError = err instanceof Error ? err.message : String(err);
        }
      }
      const withNano = useDevice && !prepareError;
      setProgress(withNano ? t('progNanoReading') : t('progRulesReading'));
      const result = await analyse(engine, raw, withNano, lang);
      const a = prepareError ? { ...result, deviceError: `Gemini Nano couldn't be prepared (${prepareError}); rules only` } : result;
      setAnalysis(a);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('input');
    } finally {
      setProgress('');
    }
  }

  async function onPdf(file: File) {
    setError(null);
    setStage('reading');
    setProgress(t('progPdf'));
    const t0 = performance.now();
    try {
      const { value: pdf, requests } = await watchGeminiRequests(() => readPdfText(file));
      if (pdf.textless) {
        setError(t('errPdfScan'));
      } else {
        setText(pdf.text);
        setSampleId(null);
        setPdfPages(pdf.truncated ? pdf.pages : 0);
        setExtraLedger([
          ledgerEntry({
            step: 'Read the PDF',
            where: 'code',
            bytesOut: 0,
            geminiRequests: requests,
            ms: Math.round(performance.now() - t0),
            note: `pdf.js on this device; ${pdf.pages} page${pdf.pages === 1 ? '' : 's'}${pdf.truncated ? ' (first 20 read)' : ''}. The file was not uploaded.`,
          }),
        ]);
      }
    } catch (e) {
      const kind = pdfErrorKind(e);
      if (kind === 'tooLarge') setError(t('errPdfLarge'));
      else if (kind === 'password') setError(t('errPdfPassword'));
      else if (kind === 'invalid') setError(t('errPdfInvalid'));
      else setError(t('errPdf', { msg: (e instanceof Error ? e.message : String(e)).replace(/[.\s]+$/, '') }));
    } finally {
      setStage('input');
      setProgress('');
    }
  }

  async function onPhoto(file: File) {
    setError(null);
    setStage('reading');
    setProgress(t('progPhoto'));
    try {
      await engine.prepareDevice();
      const { text: t, entry } = await engine.transcribeImage(file);
      setText(t);
      setSampleId(null);
      setExtraLedger([entry]);
      setStage('input');
    } catch (e) {
      setError(t('errPhoto', { msg: e instanceof Error ? e.message : String(e) }));
      setStage('input');
    } finally {
      setProgress('');
    }
  }

  function hide(value: string) {
    if (!analysis || !value.trim()) return;
    const userEntities = [...analysis.userEntities, { text: value.trim(), kind: 'PERSON' as const, source: 'user' as const }];
    setAnalysis(finishAnalysis({ ...analysis, userEntities }));
    setSelection('');
    window.getSelection()?.removeAllRanges();
  }

  function unhideModel(value: string) {
    if (!analysis) return;
    setAnalysis(finishAnalysis({ ...analysis, modelEntities: analysis.modelEntities.filter((m) => m.text !== value) }));
  }

  function unhide(value: string) {
    if (!analysis) return;
    setAnalysis(finishAnalysis({ ...analysis, userEntities: analysis.userEntities.filter((u) => u.text !== value) }));
  }

  async function draft(preferDevice: boolean) {
    if (!analysis) return;
    setError(null);
    setStage('drafting');
    setProgress(preferDevice ? t('progNanoDraft') : t('progCloudDraft'));
    const run = ++runRef.current;
    try {
      const { result, entry } = await engine.draftAppeal(
        { ...buildAppealRequest(analysis, lang), vault: analysis.redaction.vault },
        {
          preferDevice,
          onAttempt: (n, total) =>
            run === runRef.current && setProgress(t('progBusy', { n, total })),
          isCancelled: () => run !== runRef.current,
        },
      );
      if (run !== runRef.current) return; // cancelled by "Start over"
      setExtraLedger((l) => [...l, entry]);
      finish(result);
    } catch (e) {
      if (run !== runRef.current) return; // cancelled by "Start over"
      if (e instanceof EgressBlockedError) {
        setExtraLedger((l) => [...l, ledgerEntry({ step: 'Write the appeal', where: 'blocked', bytesOut: 0, geminiRequests: 0, ms: 0, note: e.message })]);
        setError(t('errBlocked', { msg: e.message }));
        setStage('review');
      } else {
        if (e instanceof DraftFailedError && e.attemptedBytes > 0) {
          setExtraLedger((l) => [
            ...l,
            ledgerEntry({
              step: 'Write the appeal',
              mode: 'PREFER_IN_CLOUD',
              where: 'cloud',
              bytesOut: e.attemptedBytes,
              geminiRequests: e.geminiRequests,
              ms: e.ms,
              note: 'The de-identified prompt was sent, but the request failed; the template letter was used instead.',
            }),
          ]);
        }
        console.warn('Appeal draft failed:', e instanceof Error ? e.message : e);
        setError(t('templateInstead', { msg: friendlyDraftError(e, preferDevice, lang) }));
        applyTemplate();
      }
    } finally {
      if (run === runRef.current) setProgress('');
    }
  }

  function applyTemplate() {
    if (!analysis) return;
    const t0 = performance.now();
    const result = templateAppeal({
      lang,
      category: analysis.facts.category,
      serviceDenied: applyVault(analysis.facts.serviceDenied, analysis.redaction.vault),
      insurer: analysis.facts.insurer,
      vault: analysis.redaction.vault,
      patient: patientPlaceholder(analysis),
      urgent: analysis.facts.urgent,
    });
    setExtraLedger((l) => [...l, ledgerEntry({ step: 'Template appeal letter', where: 'code', bytesOut: 0, geminiRequests: 0, ms: Math.round(performance.now() - t0) })]);
    finish(result);
  }

  function finish(result: AppealResult) {
    if (!analysis) return;
    const r = rehydrate(result.appealLetter, analysis.redaction.vault);
    setAppeal({
      ...result,
      plainExplanation: rehydrate(result.plainExplanation, analysis.redaction.vault).text,
    });
    setLetter(r.text);
    setUnknownPh(r.unknownPlaceholders);
    setStage('result');
  }

  function reset() {
    runRef.current++; // ignore any draft still in flight
    setProgress('');
    setStage('input');
    setAnalysis(null);
    setAppeal(null);
    setLetter('');
    setText('');
    setSampleId(null);
    setSelection('');
    setTypedHide('');
    setUnknownPh([]);
    setExtraLedger([]);
    setError(null);
  }

  return (
    <div ref={topRef} className="flow">
      <ol className="steps" aria-label="Progress">
        {[t('stepLetter'), t('stepCheck'), t('stepAppeal')].map((label, i) => {
          const idx = stage === 'input' || stage === 'reading' ? 0 : stage === 'review' || stage === 'drafting' ? 1 : 2;
          return (
            <li key={label} className={i === idx ? 'current' : i < idx ? 'done' : ''}>
              <span className="dot">{i + 1}</span> {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      {(stage === 'reading' || stage === 'drafting') && (
        <div className="working" role="status" aria-live="polite">
          <span className="spinner" aria-hidden /> {progress || t('working')}
        </div>
      )}

      {stage === 'input' && (
        <section className="card">
          <h2>{t('inputTitle')}</h2>
          <p className="lede">{device === 'available' ? t('inputLedeNano') : t('inputLede')}</p>
          <div className="samples">
            <span className="muted small">{t('trySample')}</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                className={`chip ${sampleId === s.id ? 'chip-on' : ''}`}
                onClick={() => {
                  setText(s.text);
                  setSampleId(s.id);
                  setExtraLedger([]); // a new letter: drop any earlier photo row
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="letter">
            {t('letterLabel')}
          </label>
          <textarea
            id="letter"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSampleId(null);
              if (!e.target.value.trim()) setExtraLedger([]);
            }}
            onPaste={() => setExtraLedger([])} // a pasted letter replaces any photo-read text
            placeholder={t('letterPlaceholder')}
            rows={14}
          />
          <div className="actions">
            {device === 'available' ? (
              <button className="primary" disabled={text.trim().length < 40} onClick={() => read(text, true)}>
                {t('readOnDevice')}
              </button>
            ) : deviceOk ? (
              <>
                <button className="primary" disabled={text.trim().length < 40} onClick={() => read(text, false)}>
                  {t('rulesOnlyNow')}
                </button>
                <button
                  className="secondary"
                  disabled={text.trim().length < 40}
                  onClick={() => read(text, true)}
                  title={t('downloadNanoTitle')}
                >
                  {device === 'downloading' ? t('waitNano') : t('downloadNano')}
                </button>
              </>
            ) : (
              <button className="primary" disabled={text.trim().length < 40} onClick={() => read(text, false)}>
                {t('hideOnDevice')}
              </button>
            )}
            <label className="secondary file">
              {t('openPdf')}
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0])} />
            </label>
            <label className={`secondary file ${device !== 'available' ? 'disabled' : ''}`} title={device !== 'available' ? t('photoNeedsNano') : ''}>
              {t('usePhoto')}
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={device !== 'available'}
                onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
              />
            </label>
            {text.trim().length > 0 && text.trim().length < 40 && <span className="muted small">{t('tooShort')}</span>}
          </div>
          {pdfPages > 0 && extraLedger.some((e) => e.step === 'Read the PDF') && (
            <p className="note" role="status">
              {t('pdfTruncated', { n: pdfPages, max: MAX_PDF_PAGES })}
            </p>
          )}
          {!deviceOk && (
            <p className="note">{t('noNanoNote')}</p>
          )}
        </section>
      )}

      {(stage === 'review' || stage === 'drafting') && analysis && gate && (
        <>
          <section className="facts">
            <DeadlineCard analysis={analysis} />
            <div className="card fact">
              <div className="eyebrow">{t('whyNo')}</div>
              <div className="big">{categoryLabel(analysis.facts.category, lang)}</div>
              {analysis.facts.reasonInPlainWords && <p>{rehydrate(analysis.facts.reasonInPlainWords, analysis.redaction.vault).text}</p>}
              <div className="muted small">{t('source', { source: sourceLabel(analysis.facts.categorySource, t) })}</div>
            </div>
            <div className="card fact">
              <div className="eyebrow">{t('readBy')}</div>
              <div className="big">{analysis.deviceRan ? t('readByNano') : t('readByRules')}</div>
              <p className="small">
                {analysis.deviceRan
                  ? t('readByNanoDetail', { n: analysis.modelEntities.length })
                  : analysis.deviceError
                    ? t('readByError', { err: analysis.deviceError })
                    : device === 'unavailable'
                      ? t('readByNoNano')
                      : t('readByChoseRules')}
              </p>
            </div>
          </section>

          <section className="card">
            <div className="split-head">
              <h2>{t('checkTitle')}</h2>
              <div className={`gate ${gate.allowed ? 'gate-ok' : 'gate-bad'}`} role="status">
                {gate.allowed
                  ? t('gateOk', { bytes: gate.bytes.toLocaleString() })
                  : t('gateBad', { n: gate.findings.length, list: gate.findings.map((f) => f.excerpt).join(', ') })}
              </div>
            </div>
            <div className="legend small">
              {t('legend')} <mark className="hl hl-on-device">Gemini Nano</mark> <mark className="hl hl-rule">{t('legendRules')}</mark>{' '}
              <mark className="hl hl-propagated">{t('legendRepeat')}</mark> <mark className="hl hl-user">{t('legendYou')}</mark>
            </div>
            <div className="panes">
              <div>
                <h3>{t('yourLetter')} <span className="muted small">{t('staysHere')}</span></h3>
                <div
                  tabIndex={0}
                  aria-label={t('originalAria')}
                  onMouseUp={() => setSelection(window.getSelection()?.toString().trim() ?? '')}
                  onKeyUp={() => setSelection(window.getSelection()?.toString().trim() ?? '')}
                >
                  <OriginalWithHighlights text={analysis.raw} redaction={analysis.redaction} />
                </div>
                <div className="hide-row">
                  <button className="secondary" disabled={!selection || selection.length > 80} onClick={() => hide(selection)}>
                    {selection ? t('hideSelection', { text: `${selection.slice(0, 30)}${selection.length > 30 ? '…' : ''}` }) : t('selectToHide')}
                  </button>
                  <form
                    className="type-hide"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (typedHide.trim() && analysis.raw.toLowerCase().includes(typedHide.trim().toLowerCase())) {
                        hide(typedHide);
                        setTypedHide('');
                      }
                    }}
                  >
                    <label className="sr-only" htmlFor="type-hide">
                      {t('typeHideLabel')}
                    </label>
                    <input
                      id="type-hide"
                      value={typedHide}
                      onChange={(e) => setTypedHide(e.target.value)}
                      placeholder={t('typeHidePlaceholder')}
                    />
                    <button className="secondary" type="submit" disabled={!typedHide.trim() || !analysis.raw.toLowerCase().includes(typedHide.trim().toLowerCase())}>
                      {t('hide')}
                    </button>
                  </form>
                </div>
              </div>
              <div>
                <h3>{t('cloudWillSee')}</h3>
                <RedactedText text={analysis.redaction.redacted} />
              </div>
            </div>
            {analysis.modelEntities.length > 0 && (
              <details className="small model-found">
                <summary>{t('foundByNano', { n: analysis.modelEntities.length })}</summary>
                <div className="suspects">
                  {analysis.modelEntities.map((m) => (
                    <button key={`${m.kind}:${m.text}`} className="chip" onClick={() => unhideModel(m.text)} aria-label={t('notPersonalAria', { text: m.text })}>
                      “{m.text}” ✕
                    </button>
                  ))}
                </div>
              </details>
            )}
            {analysis.userEntities.length > 0 && (
              <div className="suspects user-hides">
                <span className="small">{t('hiddenByYou')}</span>
                {analysis.userEntities.map((u) => (
                  <button key={u.text} className="chip" onClick={() => unhide(u.text)} aria-label={t('showAgainAria', { text: u.text })}>
                    “{u.text}” ✕
                  </button>
                ))}
              </div>
            )}
            {analysis.suspects.length > 0 && (
              <div className="suspects">
                <span className="small">{t('possibleNames')}</span>
                {analysis.suspects.slice(0, 12).map((s) => (
                  <button key={s} className="chip" onClick={() => hide(s)}>
                    {t('hideSuspect', { text: s })}
                  </button>
                ))}
              </div>
            )}
            <details className="small">
              <summary>{t('fullPrompt', { bytes: gate.bytes.toLocaleString() })}</summary>
              <pre className="letter outgoing">{buildAppealPrompt(analysis, lang)}</pre>
            </details>
            <div className="actions">
              <button className="primary" disabled={!gate.allowed || stage === 'drafting'} onClick={() => draft(false)}>
                {t('sendCloud')}
              </button>
              <button className="secondary" disabled={device !== 'available' || stage === 'drafting'} onClick={() => draft(true)} title={device !== 'available' ? t('needsNano') : ''}>
                {t('stayOffline')}
              </button>
              <button className="link" disabled={stage === 'drafting'} onClick={applyTemplate}>
                {t('useTemplate')}
              </button>
              <button className="link" onClick={reset}>
                {stage === 'drafting' ? t('cancelStartOver') : t('startOver')}
              </button>
            </div>
          </section>
          <Ledger entries={ledger} />
        </>
      )}

      {stage === 'result' && analysis && appeal && (
        <>
          <section className="facts">
            <DeadlineCard analysis={analysis} />
            <div className="card fact wide">
              <div className="eyebrow">{t('whatHappened')}</div>
              <p>{appeal.plainExplanation}</p>
            </div>
          </section>
          <section className="result-grid">
            <div className="card">
              <h2>{t('appealLetter')}</h2>
              <p className="muted small">
                {t('appealLetterNote')} {t('letterInEnglish')}
              </p>
              {unknownPh.length > 0 && (
                <div className="alert small">
                  {t('unknownPh', { list: unknownPh.join(', ') })}
                </div>
              )}
              <textarea className="letter-edit" value={letter} onChange={(e) => setLetter(e.target.value)} rows={24} aria-label={t('appealLetterAria')} />
              <div className="actions">
                <button className="primary" onClick={() => navigator.clipboard?.writeText(letter)}>
                  {t('copyLetter')}
                </button>
                <button className="secondary" onClick={() => download('appeal-letter.txt', letter, 'text/plain')}>
                  {t('downloadTxt')}
                </button>
                <button className="secondary" onClick={() => printLetter(letter)}>
                  {t('print')}
                </button>
                <button className="link" onClick={reset}>
                  {t('newLetter')}
                </button>
              </div>
            </div>
            <div className="side">
              <div className="card">
                <h3>{t('strongestArguments')}</h3>
                <ol>{appeal.strongestArguments.map((a, i) => <li key={i}>{rehydrate(a, analysis.redaction.vault).text}</li>)}</ol>
              </div>
              <div className="card">
                <h3>{t('gatherEvidence')}</h3>
                <ul className="checklist">
                  {[...new Set([...appeal.evidenceToGather, ...categoryPlaybook(analysis.facts.category, lang)])].slice(0, 8).map((e, i) => (
                    <li key={i}>
                      <label>
                        <input type="checkbox" /> {rehydrate(e, analysis.redaction.vault).text}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>{t('askDoctor')}</h3>
                <ul>{appeal.questionsForDoctor.map((q, i) => <li key={i}>{rehydrate(q, analysis.redaction.vault).text}</li>)}</ul>
              </div>
              <div className="card muted small">{externalReviewText(analysis, lang)}</div>
            </div>
          </section>
          <Ledger entries={ledger} />
          <p className="disclaimer">{t('disclaimer')}</p>
        </>
      )}
    </div>
  );
}

function DeadlineCard({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const lang = useLang();
  const d = analysis.deadline;
  const explanation = deadlineExplanation(analysis, lang);
  return (
    <div className={`card fact deadline ${d.daysLeft !== null && d.daysLeft < 30 ? 'urgent' : ''}`}>
      <div className="eyebrow">{t('deadlineTitle')}</div>
      {d.deadline ? (
        <>
          <div className="big">{fmtDate(d.deadline, lang)}</div>
          <div className="days">{d.daysLeft !== null && d.daysLeft >= 0 ? t('daysLeft', { n: d.daysLeft }) : t('datePassed')}</div>
          <p className="small">
            {explanation} {d.citation && <span className="mono">({d.citation})</span>}
          </p>
          <button className="link small" onClick={() => download('appeal-deadline.ics', icsFor(d.deadline!, t('calendarTitle')), 'text/calendar')}>
            {t('addCalendar')}
          </button>
        </>
      ) : (
        <>
          <div className="big">{t('notSure')}</div>
          <p className="small">{explanation}</p>
        </>
      )}
      <div className="muted small">
        {t('deadlineSources', {
          notice: sourceLabel(analysis.facts.noticeDateSource, t),
          window: d.basis === 'default-rule' ? t('legalDefault') : sourceLabel(analysis.facts.windowSource, t),
        })}
      </div>
    </div>
  );
}

type T = (key: Key, vars?: Record<string, string | number>) => string;

function sourceLabel(src: string, t: T): string {
  return src === 'letter text (code)' ? t('srcCode') : src === 'Gemini Nano' ? t('srcNano') : src === 'legal default' ? t('srcDefault') : t('srcNone');
}


function printLetter(letter: string) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const pre = w.document.createElement('pre');
  pre.textContent = letter;
  pre.style.cssText = 'font: 12pt/1.5 Georgia, serif; white-space: pre-wrap; margin: 1in;';
  w.document.body.appendChild(pre);
  w.document.title = 'Appeal letter';
  w.print();
}
