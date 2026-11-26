import type { LedgerEntry } from '../ai/engine';
import { stepName, useLang, useT, type Key } from '../i18n';

const WHERE_LABEL: Record<LedgerEntry['where'], Key> = {
  'on-device': 'whereDevice',
  cloud: 'whereCloud',
  code: 'whereCode',
  blocked: 'whereBlocked',
};

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const t = useT();
  const lang = useLang();
  if (!entries.length) return null;
  const bytes = entries.reduce((a, e) => a + e.bytesOut, 0);
  const sentSteps = entries.filter((e) => e.bytesOut > 0).length;
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <div className="ledger-head">
        <h3 id="ledger-h">{t('ledgerTitle')}</h3>
        <p>
          {sentSteps === 0 ? t('ledgerNothing') : t('ledgerSent', { steps: sentSteps, bytes: bytes.toLocaleString() })}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('colStep')}</th>
              <th>{t('colRan')}</th>
              <th>{t('colMode')}</th>
              <th>{t('colModel')}</th>
              <th className="num">{t('colBytes')}</th>
              <th className="num">{t('colRequests')}</th>
              <th className="num">{t('colTime')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>
                  {stepName(lang, e.step)}
                  {e.note && <div className="muted small">{e.note}</div>}
                </td>
                <td>
                  <span className={`where where-${e.where}`}>{t(WHERE_LABEL[e.where])}</span>
                </td>
                <td className="mono small">{e.mode ?? '—'}</td>
                <td className="small">{e.model ?? '—'}</td>
                <td className="num mono">{e.bytesOut.toLocaleString()}</td>
                <td className="num mono">{e.where === 'code' || e.geminiRequests < 0 ? '—' : e.geminiRequests}</td>
                <td className="num mono">{e.ms < 1000 ? `${e.ms} ms` : `${(e.ms / 1000).toFixed(1)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('ledgerFoot')}</p>
    </section>
  );
}
