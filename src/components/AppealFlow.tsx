import { useEffect, useMemo, useRef, useState } from 'react';
import { EgressBlockedError, ledgerEntry, type DeviceAvailability, type Engine, type LedgerEntry } from '../ai/engine';
import type { AppealResult } from '../ai/schemas';
import { CATEGORY_LABEL, CATEGORY_PLAYBOOK } from '../core/categories';
import { checkEgress } from '../core/egressGate';
import { rehydrate } from '../core/redact';
import { templateAppeal } from '../core/template';
import { CASES } from '../data/cases';
import { analyse, buildAppealPrompt, finishAnalysis, patientPlaceholder, applyVault, type Analysis } from '../pipeline';
import { OriginalWithHighlights, RedactedText } from './Highlight';
import { Ledger } from './Ledger';

const SAMPLES = [CASES[0], CASES[1], CASES[13]];

type Stage = 'input' | 'reading' | 'review' | 'drafting' | 'result';

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

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
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [appeal, setAppeal] = useState<AppealResult | null>(null);
  const [letter, setLetter] = useState('');
  const [unknownPh, setUnknownPh] = useState<string[]>([]);
  const [extraLedger, setExtraLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [selection, setSelection] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const deviceOk = device === 'available' || device === 'downloadable' || device === 'downloading';

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stage]);

  const gate = useMemo(() => {
    if (!analysis) return null;
    return checkEgress(buildAppealPrompt(analysis), analysis.redaction.vault);
  }, [analysis]);

  const ledger = [...(analysis?.ledger ?? []), ...extraLedger];

  async function read(raw: string) {
    setError(null);
    setExtraLedger([]);
    setStage('reading');
    try {
      if (deviceOk) {
        setProgress('Preparing Gemini Nano on this device…');
        // Must run inside the click handler's task chain (user activation).
        await engine.prepareDevice((f) => setProgress(`Downloading Gemini Nano to this device: ${Math.round(f * 100)}%`));
        onDeviceChange();
      }
      setProgress(deviceOk ? 'Gemini Nano is reading the letter on this device…' : 'Finding personal details with on-device rules…');
      const a = await analyse(engine, raw, deviceOk);
      setAnalysis(a);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('input');
    } finally {
      setProgress('');
    }
  }

  async function onPhoto(file: File) {
    setError(null);
    setStage('reading');
    setProgress('Gemini Nano is reading the photo on this device…');
    try {
      await engine.prepareDevice();
      const { text: t, entry } = await engine.transcribeImage(file);
      setText(t);
      setSampleId(null);
      setExtraLedger([entry]);
      setStage('input');
    } catch (e) {
      setError(`Couldn't read the photo on this device: ${e instanceof Error ? e.message : String(e)}. You can paste or type the letter instead.`);
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

  function unhide(value: string) {
    if (!analysis) return;
    setAnalysis(finishAnalysis({ ...analysis, userEntities: analysis.userEntities.filter((u) => u.text !== value) }));
  }

  async function draft(preferDevice: boolean) {
    if (!analysis) return;
    setError(null);
    setStage('drafting');
    setProgress(preferDevice ? 'Gemini Nano is drafting your appeal on this device…' : 'Gemini is drafting your appeal from the de-identified letter…');
    try {
      const { result, entry } = await engine.draftAppeal({ prompt: buildAppealPrompt(analysis), vault: analysis.redaction.vault }, { preferDevice });
      setExtraLedger((l) => [...l, entry]);
      finish(result);
    } catch (e) {
      if (e instanceof EgressBlockedError) {
        setExtraLedger((l) => [...l, ledgerEntry({ step: 'Write the appeal', where: 'blocked', bytesOut: 0, geminiRequests: 0, ms: 0, note: e.message })]);
        setError(`${e.message} Hide them on the left, then try again.`);
        setStage('review');
      } else {
        setError(`The model couldn't write the appeal (${e instanceof Error ? e.message : String(e)}). Here is a template letter instead; nothing was guessed.`);
        applyTemplate();
      }
    } finally {
      setProgress('');
    }
  }

  function applyTemplate() {
    if (!analysis) return;
    const t0 = performance.now();
    const result = templateAppeal({
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
    setStage('input');
    setAnalysis(null);
    setAppeal(null);
    setLetter('');
    setExtraLedger([]);
    setError(null);
  }

  return (
    <div ref={topRef} className="flow">
      <ol className="steps" aria-label="Progress">
        {['Your letter', 'Check what leaves', 'Your appeal'].map((label, i) => {
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
          <span className="spinner" aria-hidden /> {progress || 'Working…'}
        </div>
      )}

      {stage === 'input' && (
        <section className="card">
          <h2>Paste your denial letter</h2>
          <p className="lede">
            Your letter is read <strong>on this device</strong> by Gemini Nano. Your name, member ID, address and every other identifier
            are replaced before anything goes to the cloud, and you see exactly what will be sent.
          </p>
          <div className="samples">
            <span className="muted small">Try a sample (synthetic, not a real person):</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                className={`chip ${sampleId === s.id ? 'chip-on' : ''}`}
                onClick={() => {
                  setText(s.text);
                  setSampleId(s.id);
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="letter">
            Denial letter text
          </label>
          <textarea
            id="letter"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSampleId(null);
            }}
            placeholder="Paste the text of the letter from your insurer, or an Explanation of Benefits, here…"
            rows={14}
          />
          <div className="actions">
            <button className="primary" disabled={text.trim().length < 40} onClick={() => read(text)}>
              {deviceOk ? 'Read it on this device' : 'Hide my details on this device'}
            </button>
            <label className={`secondary file ${device !== 'available' ? 'disabled' : ''}`} title={device !== 'available' ? 'Photo reading needs Gemini Nano in Chrome' : ''}>
              Use a photo (PNG/JPEG)
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={device !== 'available'}
                onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
              />
            </label>
            {text.trim().length > 0 && text.trim().length < 40 && <span className="muted small">That looks too short to be a letter.</span>}
          </div>
          {!deviceOk && (
            <p className="note">
              Gemini Nano isn't available in this browser, so only Overturn's built-in rules will find your details. You'll review the
              result and can hide anything they missed before sending. For the full on-device experience, use Chrome on desktop (see
              "How it works").
            </p>
          )}
        </section>
      )}

      {(stage === 'review' || stage === 'drafting') && analysis && gate && (
        <>
          <section className="facts">
            <DeadlineCard analysis={analysis} />
            <div className="card fact">
              <div className="eyebrow">Why they said no</div>
              <div className="big">{CATEGORY_LABEL[analysis.facts.category]}</div>
              {analysis.facts.reasonInPlainWords && <p>{rehydrate(analysis.facts.reasonInPlainWords, analysis.redaction.vault).text}</p>}
              <div className="muted small">Source: {analysis.facts.categorySource}</div>
            </div>
            <div className="card fact">
              <div className="eyebrow">Read by</div>
              <div className="big">{analysis.deviceRan ? 'Gemini Nano, on this device' : 'Rules only, on this device'}</div>
              <p className="small">
                {analysis.deviceRan
                  ? `${analysis.modelEntities.length} details found by the on-device model, plus rule-based checks.`
                  : analysis.deviceError
                    ? `The on-device model didn't run (${analysis.deviceError}). Nothing was sent to the cloud instead.`
                    : 'No on-device model in this browser. Check the outgoing text carefully.'}
              </p>
            </div>
          </section>

          <section className="card">
            <div className="split-head">
              <h2>Check what leaves your device</h2>
              <div className={`gate ${gate.allowed ? 'gate-ok' : 'gate-bad'}`} role="status">
                {gate.allowed
                  ? `Egress check passed: no known or detectable identifiers in ${gate.bytes.toLocaleString()} bytes.`
                  : `Egress check blocked: ${gate.findings.length} identifier(s) still present (${gate.findings.map((f) => f.excerpt).join(', ')}). Hide them on the left.`}
              </div>
            </div>
            <div className="legend small">
              Highlighted by: <mark className="hl hl-on-device">Gemini Nano</mark> <mark className="hl hl-rule">rules</mark>{' '}
              <mark className="hl hl-propagated">repeat of a found value</mark> <mark className="hl hl-user">you</mark>
            </div>
            <div className="panes">
              <div>
                <h3>Your letter <span className="muted small">(stays here)</span></h3>
                <div
                  onMouseUp={() => setSelection(window.getSelection()?.toString().trim() ?? '')}
                  onKeyUp={() => setSelection(window.getSelection()?.toString().trim() ?? '')}
                >
                  <OriginalWithHighlights text={analysis.raw} redaction={analysis.redaction} />
                </div>
                <div className="hide-row">
                  <button className="secondary" disabled={!selection || selection.length > 80} onClick={() => hide(selection)}>
                    {selection ? `Hide “${selection.slice(0, 30)}${selection.length > 30 ? '…' : ''}”` : 'Select text above to hide it'}
                  </button>
                </div>
              </div>
              <div>
                <h3>What the cloud model will see</h3>
                <RedactedText text={analysis.redaction.redacted} />
              </div>
            </div>
            {analysis.userEntities.length > 0 && (
              <div className="suspects user-hides">
                <span className="small">Hidden by you:</span>
                {analysis.userEntities.map((u) => (
                  <button key={u.text} className="chip" onClick={() => unhide(u.text)} aria-label={`Show “${u.text}” again`}>
                    “{u.text}” ✕
                  </button>
                ))}
              </div>
            )}
            {analysis.suspects.length > 0 && (
              <div className="suspects">
                <span className="small">Possible names still visible. Hide any that are people:</span>
                {analysis.suspects.slice(0, 12).map((s) => (
                  <button key={s} className="chip" onClick={() => hide(s)}>
                    + hide “{s}”
                  </button>
                ))}
              </div>
            )}
            <details className="small">
              <summary>See the full prompt that would be sent ({gate.bytes.toLocaleString()} bytes)</summary>
              <pre className="letter outgoing">{buildAppealPrompt(analysis)}</pre>
            </details>
            <div className="actions">
              <button className="primary" disabled={!gate.allowed || stage === 'drafting'} onClick={() => draft(false)}>
                Send the hidden version to Gemini
              </button>
              <button className="secondary" disabled={device !== 'available' || stage === 'drafting'} onClick={() => draft(true)} title={device !== 'available' ? 'Needs Gemini Nano in Chrome' : ''}>
                Stay offline: draft on this device
              </button>
              <button className="link" disabled={stage === 'drafting'} onClick={applyTemplate}>
                Use a template letter (no AI)
              </button>
              <button className="link" onClick={reset}>
                Start over
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
              <div className="eyebrow">What happened</div>
              <p>{appeal.plainExplanation}</p>
            </div>
          </section>
          <section className="result-grid">
            <div className="card">
              <h2>Your appeal letter</h2>
              <p className="muted small">
                Names and numbers were put back <strong>on this device</strong>. Edit anything, then print, sign and send it before the
                deadline.
              </p>
              {unknownPh.length > 0 && (
                <div className="alert small">
                  The model used {unknownPh.join(', ')}, which we never issued. Replace {unknownPh.length > 1 ? 'them' : 'it'} by hand.
                </div>
              )}
              <textarea className="letter-edit" value={letter} onChange={(e) => setLetter(e.target.value)} rows={24} aria-label="Appeal letter" />
              <div className="actions">
                <button className="primary" onClick={() => navigator.clipboard?.writeText(letter)}>
                  Copy letter
                </button>
                <button className="secondary" onClick={() => download('appeal-letter.txt', letter, 'text/plain')}>
                  Download .txt
                </button>
                <button className="secondary" onClick={() => printLetter(letter)}>
                  Print
                </button>
                <button className="link" onClick={reset}>
                  Start a new letter
                </button>
              </div>
            </div>
            <div className="side">
              <div className="card">
                <h3>Strongest arguments</h3>
                <ol>{appeal.strongestArguments.map((a, i) => <li key={i}>{rehydrate(a, analysis.redaction.vault).text}</li>)}</ol>
              </div>
              <div className="card">
                <h3>Gather this evidence</h3>
                <ul className="checklist">
                  {[...new Set([...appeal.evidenceToGather, ...CATEGORY_PLAYBOOK[analysis.facts.category]])].slice(0, 8).map((e, i) => (
                    <li key={i}>
                      <label>
                        <input type="checkbox" /> {rehydrate(e, analysis.redaction.vault).text}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>Ask your doctor</h3>
                <ul>{appeal.questionsForDoctor.map((q, i) => <li key={i}>{rehydrate(q, analysis.redaction.vault).text}</li>)}</ul>
              </div>
              <div className="card muted small">{analysis.deadline.externalReview}</div>
            </div>
          </section>
          <Ledger entries={ledger} />
          <p className="disclaimer">Overturn is not a lawyer or your insurer. It helps you write and send your own appeal.</p>
        </>
      )}
    </div>
  );
}

function DeadlineCard({ analysis }: { analysis: Analysis }) {
  const d = analysis.deadline;
  return (
    <div className={`card fact deadline ${d.daysLeft !== null && d.daysLeft < 30 ? 'urgent' : ''}`}>
      <div className="eyebrow">Appeal deadline</div>
      {d.deadline ? (
        <>
          <div className="big">{fmtDate(d.deadline)}</div>
          <div className="days">{d.daysLeft !== null && d.daysLeft >= 0 ? `${d.daysLeft} days left` : 'This date has passed: call your plan today'}</div>
          <p className="small">
            {d.explanation} {d.citation && <span className="mono">({d.citation})</span>}
          </p>
          <button className="link small" onClick={() => download('appeal-deadline.ics', icsFor(d.deadline!, 'Insurance appeal deadline'), 'text/calendar')}>
            Add to calendar (.ics)
          </button>
        </>
      ) : (
        <>
          <div className="big">Not sure: we won't guess</div>
          <p className="small">{d.explanation}</p>
        </>
      )}
      <div className="muted small">Computed by code on this device, not by a model.</div>
    </div>
  );
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
