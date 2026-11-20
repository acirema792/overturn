// Hints for the review screen: capitalised word pairs left in the OUTGOING
// text that might be names nobody caught. They are never auto-redacted (too
// many false alarms); the user decides with one click. This matters most
// when Gemini Nano isn't available and only the rules have run.

const ORG_OR_TERM =
  /\b(Health|Healthcare|Plan|Plans|Insurance|Insurer|Medical|Medicine|Center|Centre|Hospital|Clinic|Care|Services|Service|Department|Medicare|Medicaid|Marketplace|Policy|Section|Article|Notice|Appeal|Appeals|Benefit|Benefits|Mutual|Partners|Cooperative|Institute|Associates|Administrators|Trust|Group|Company|Co|Inc|LLC|Advantage|Management|Unit|Office|Review|Recovery|Rehabilitation|Pharmacy|Coverage|Evidence|Summary|Description|Federal|State|County|Act|Law|Fair|Hearing|Independent|Entity|Community|Regional|Employee|Individual|Utilization|Billing|Member|Customer|Prior|Authorization|Determination|Adverse|Denial|Payment|Request|Form|Representative|Number|Claim|Date|Name|ID|Reference|Account|Statement|Subscriber|Patient|Enrollee|Participant|Phone|Email|Fax|Address|Box)\b/;

const SENTENCE_STARTERS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Your', 'You', 'We', 'Our', 'If', 'For', 'Please', 'To', 'In',
  'As', 'Based', 'Call', 'Send', 'Dear', 'Hello', 'Hi', 'Thanks', 'Sincerely', 'Questions', 'There', 'It',
  'Ask', 'Contact', 'Track', 'See', 'Visit', 'When', 'After', 'Before', 'Under', 'Some', 'Any', 'All',
]);

export function findSuspects(redactedText: string, knownOrgs: string[] = []): string[] {
  const out = new Map<string, number>();
  const re = /\b[A-Z][a-z'’-]+(?:[ -][A-Z][a-zA-Z'’-]+){1,3}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(redactedText))) {
    let phrase = m[0];
    const words = phrase.split(/[ ]/);
    if (SENTENCE_STARTERS.has(words[0])) {
      words.shift();
      phrase = words.join(' ');
      if (words.length < 2) continue;
    }
    if (ORG_OR_TERM.test(phrase)) continue;
    if (knownOrgs.some((o) => o && (o.includes(phrase) || phrase.includes(o)))) continue;
    out.set(phrase, (out.get(phrase) ?? 0) + 1);
  }
  // Lines that are nothing but a capitalised name (an address block's first line).
  for (const line of redactedText.split('\n')) {
    const t = line.trim();
    if (/^[A-Z][a-z'’-]+(?:[ -][A-Z][a-zA-Z'’-]+){0,3}$/.test(t) && !ORG_OR_TERM.test(t) && !SENTENCE_STARTERS.has(t.split(' ')[0])) {
      out.set(t, (out.get(t) ?? 0) + 1);
    }
  }
  return [...out.keys()];
}
