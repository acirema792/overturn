import { useState } from 'react';
import type { DeviceAvailability, Engine } from '../ai/engine';
import { CASES } from '../data/cases';
import { HELDOUT } from '../data/heldout';
import { runEval, renderMarkdown, type EntityProvider, type EvalSummary } from '../eval/runEval';
import { entitiesFromModel, groundEntities } from '../pipeline';

export function Benchmark({ engine, device }: { engine: Engine; device: DeviceAvailability }) {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<EvalSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(withNano: boolean) {
    setError(null);
    setResults([]);
    try {
      let provider: EntityProvider | undefined;
      if (withNano) {
        setRunning('Preparing Gemini Nano…');
        await engine.prepareDevice();
        let n = 0;
        provider = async (text) => {
          n++;
          setRunning(`Gemini Nano is reading letter ${n} of ${CASES.length + HELDOUT.length} on this device…`);
          const e = await engine.findEntities(text);
          const f = await engine.readFacts(text);
          return { entities: groundEntities(text, entitiesFromModel(e.result)), category: f.result.denialCategory, source: 'rules + Gemini Nano' };
        };
      } else {
        setRunning('Running the rules…');
      }
      const env = `${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? navigator.userAgent} · engine ${engine.kind}`;
      const label = withNano ? 'Rules + Gemini Nano (on-device)' : 'Rules only';
      const a = await runEval(`${label}: tuning set`, provider, env, CASES);
      const b = await runEval(`${label}: held-out set`, provider, env, HELDOUT);
      setResults([a, b]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flow">
      <section className="card">
        <h2>Benchmark: does anything identifying reach the cloud?</h2>
        <p className="lede">
          {CASES.length + HELDOUT.length} synthetic denial letters with {[...CASES, ...HELDOUT].reduce((a, c) => a + c.identifiers.length, 0)} planted
          identifiers (names, member IDs, addresses, dates of birth…) and the clinical facts an appeal needs. Expected answers were
          written before any run. This runs entirely in your browser; with Gemini Nano, nothing is sent anywhere.
        </p>
        <div className="actions">
          <button className="primary" disabled={!!running || engine.kind !== 'firebase' || device === 'unavailable'} onClick={() => run(true)}>
            Run with Gemini Nano (on this device)
          </button>
          <button className="secondary" disabled={!!running} onClick={() => run(false)}>
            Run rules only
          </button>
          {results.length > 0 && (
            <button
              className="link"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `overturn-benchmark-${Date.now()}.json`;
                a.click();
              }}
            >
              Download results (JSON)
            </button>
          )}
        </div>
        {device === 'unavailable' && engine.kind === 'firebase' && (
          <p className="note">Gemini Nano isn't available in this browser, so only the rules-only run is possible here.</p>
        )}
        {engine.kind === 'simulated' && <p className="note">Simulated engine: only the rules-only run is meaningful.</p>}
        {running && (
          <div className="working" role="status">
            <span className="spinner" aria-hidden /> {running}
          </div>
        )}
        {error && <div className="alert">{error}</div>}
      </section>
      {results.map((r) => (
        <section className="card" key={r.label}>
          <h3>{r.label}</h3>
          <div className="stats">
            <Stat value={`${r.leaked}/${r.identifiers}`} label="identifiers that would reach the cloud" baseline={`${r.leakedBaseline}/${r.identifiers} if pasted into a chatbot`} good={r.leaked === 0} />
            <Stat value={`${r.keepTotal - r.lost}/${r.keepTotal}`} label="clinical facts kept for the appeal" good={r.lost === 0} />
            <Stat value={`${r.deadlineOk}/${r.cases}`} label="deadlines correct (code)" good={r.deadlineOk === r.cases} />
            <Stat value={`${r.categoryOk}/${r.cases}`} label="denial reasons correct" good={r.categoryOk === r.cases} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Leaked</th>
                  <th>Deadline expected → got</th>
                  <th>Reason expected → got</th>
                  <th className="num">ms</th>
                </tr>
              </thead>
              <tbody>
                {r.results.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="mono">{c.id}</span> {c.title}
                    </td>
                    <td className={c.leaked.length ? 'bad' : 'good'}>{c.leaked.length ? c.leaked.join(', ') : '0'}</td>
                    <td className={c.deadline.ok ? 'good' : 'bad'}>
                      {c.deadline.expected ?? 'none'} → {c.deadline.got ?? 'none'}
                    </td>
                    <td className={c.category.ok ? 'good' : 'bad'}>
                      {c.category.expected} → {c.category.got}
                    </td>
                    <td className="num mono">{c.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="small">
            <summary>Markdown</summary>
            <pre className="letter">{renderMarkdown(r)}</pre>
          </details>
        </section>
      ))}
    </div>
  );
}

function Stat({ value, label, baseline, good }: { value: string; label: string; baseline?: string; good: boolean }) {
  return (
    <div className={`stat ${good ? 'good' : 'bad'}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {baseline && <div className="muted small">{baseline}</div>}
    </div>
  );
}
