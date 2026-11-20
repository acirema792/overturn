import type { Redaction } from '../core/redact';
import { PLACEHOLDER_RE } from '../core/redact';

/** The original letter with every redacted span highlighted by who found it. */
export function OriginalWithHighlights({ text, redaction }: { text: string; redaction: Redaction }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  redaction.spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(
      <mark key={i} className={`hl hl-${s.source}`} title={`${s.kind} → ${s.placeholder} (found by ${sourceLabel(s.source)})`}>
        {text.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  });
  parts.push(text.slice(cursor));
  return <pre className="letter">{parts}</pre>;
}

/** Outgoing text with placeholders styled as chips. */
export function RedactedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    parts.push(
      <span key={m.index} className="ph">
        {m[0]}
      </span>,
    );
    cursor = m.index + m[0].length;
  }
  parts.push(text.slice(cursor));
  return <pre className="letter outgoing">{parts}</pre>;
}

export function sourceLabel(s: string): string {
  return s === 'rule'
    ? 'rules'
    : s === 'on-device'
      ? 'Gemini Nano'
      : s === 'user'
        ? 'you'
        : 'repeat of a found value';
}
