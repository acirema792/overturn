import type { LedgerEntry } from '../ai/engine';

const WHERE_LABEL: Record<LedgerEntry['where'], string> = {
  'on-device': 'On this device',
  cloud: 'Cloud',
  code: 'Plain code',
  blocked: 'Blocked',
};

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return null;
  const bytes = entries.reduce((a, e) => a + e.bytesOut, 0);
  const sentSteps = entries.filter((e) => e.bytesOut > 0).length;
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <div className="ledger-head">
        <h3 id="ledger-h">Privacy ledger</h3>
        <p>
          {sentSteps === 0
            ? 'No part of your letter has left this device.'
            : `${sentSteps} step sent ${bytes.toLocaleString()} bytes of de-identified text to the cloud. The original letter stayed here.`}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Ran</th>
              <th>Mode requested</th>
              <th>Model</th>
              <th className="num">Bytes sent</th>
              <th className="num">Gemini requests seen</th>
              <th className="num">Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.step}
                  {e.note && <div className="muted small">{e.note}</div>}
                </td>
                <td>
                  <span className={`where where-${e.where}`}>{WHERE_LABEL[e.where]}</span>
                </td>
                <td className="mono small">{e.mode ?? '—'}</td>
                <td className="small">{e.model ?? '—'}</td>
                <td className="num mono">{e.bytesOut.toLocaleString()}</td>
                <td className="num mono">{e.where === 'code' ? '—' : e.geminiRequests}</td>
                <td className="num mono">{e.ms < 1000 ? `${e.ms} ms` : `${(e.ms / 1000).toFixed(1)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        "Ran" comes from Firebase AI Logic's <code>inferenceSource</code> on each response. "Gemini requests seen" counts
        requests to Gemini endpoints recorded by your browser (Resource Timing) while the step ran. Separately, the app talks to
        Firebase for App Check and Remote Config when it loads; those requests carry no letter content.
      </p>
    </section>
  );
}
