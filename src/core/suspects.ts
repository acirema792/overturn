// Hints for the review screen: capitalised word pairs left in the OUTGOING
// text that might be names nobody caught. They are never auto-redacted (too
// many false alarms); the user decides with one click. This matters most
// when Gemini Nano isn't available and only the rules have run.

const ORG_OR_TERM =
  /\b(Health|Healthcare|Plan|Plans|Insurance|Insurer|Medical|Medicine|Center|Centre|Hospital|Clinic|Care|Services|Service|Department|Medicare|Medicaid|Marketplace|Policy|Section|Article|Notice|Appeal|Appeals|Benefit|Benefits|Mutual|Partners|Cooperative|Institute|Associates|Administrators|Trust|Group|Company|Co|Inc|LLC|Advantage|Management|Unit|Office|Review|Recovery|Rehabilitation|Pharmacy|Coverage|Evidence|Summary|Description|Federal|State|County|Act|Law|Fair|Hearing|Independent|Entity|Community|Regional|Employee|Individual|Utilization|Billing|Member|Customer|Prior|Authorization|Determination|Adverse|Denial|Payment|Request|Form|Representative|Number|Claim|Date|Name|ID|Reference|Account|Statement|Subscriber|Patient|Enrollee|Participant|Phone|Email|Fax|Address|Box|Notice|Enclosed|Information|Important|Rights)\b/i;

const SENTENCE_STARTERS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Your', 'You', 'We', 'Our', 'If', 'For', 'Please', 'To', 'In',
  'As', 'Based', 'Call', 'Send', 'Dear', 'Hello', 'Hi', 'Thanks', 'Sincerely', 'Questions', 'There', 'It',
  'Ask', 'Contact', 'Track', 'See', 'Visit', 'When', 'After', 'Before', 'Under', 'Some', 'Any', 'All',
]);

// Common words and clinical terms that appear in capitalised letter headers.
const CAPS_COMMON = new Set(
  (
    'THE A AN AND OR OF FOR TO IN ON BY AT IS ARE NOT WAS THIS THAT THESE YOU YOUR WE OUR US IT WHAT HOW WHY WHEN WHERE CAN MAY ' +
    'WILL MUST DO DOES NO YES IF WITH WITHOUT ABOUT FROM PLEASE READ CALL IMPORTANT NEW TOTAL LEFT RIGHT BILATERAL ' +
    'MRI CT PET SCAN XRAY X-RAY LUMBAR CERVICAL THORACIC SPINE BRAIN CHEST ABDOMEN PELVIS CONTRAST KNEE HIP SHOULDER ' +
    'ARTHROPLASTY REPLACEMENT SURGERY THERAPY PHYSICAL INJECTION TEST BLOOD LAB VISIT OFFICE EMERGENCY ROOM INPATIENT ' +
    'OUTPATIENT DRUG PEN TABLET DOSE PPO HMO EPO POS GOLD SILVER BRONZE PLATINUM DENIED APPROVED PAID AMOUNT'
  ).split(' '),
);

export function findSuspects(redactedText: string, knownOrgs: string[] = []): string[] {
  const out = new Map<string, number>();
  const add = (phrase: string) => {
    if (ORG_OR_TERM.test(phrase)) return;
    if (knownOrgs.some((o) => o && (o.toLowerCase().includes(phrase.toLowerCase()) || phrase.toLowerCase().includes(o.toLowerCase())))) return;
    out.set(phrase, (out.get(phrase) ?? 0) + 1);
  };
  // Capitalised word runs (Unicode: "Zoë Ångström"), minus a sentence starter.
  const mixed = /(?<![\p{L}])\p{Lu}[\p{Ll}'’-]+(?:[ -]\p{Lu}[\p{L}'’-]+){1,3}(?![\p{L}])/gu;
  let m: RegExpExecArray | null;
  while ((m = mixed.exec(redactedText))) {
    const words = m[0].split(' ');
    if (SENTENCE_STARTERS.has(words[0])) words.shift();
    if (words.length >= 2) add(words.join(' '));
  }
  // ALL-CAPS runs of 2–3 words ("BRANDON ESPOSITO"). Letters also use capitals
  // for headers and clinical terms, so a run with a common word in it is skipped.
  const caps = /(?<![\p{L}])\p{Lu}{2,}(?: \p{Lu}{2,}){1,2}(?![\p{L}])/gu;
  while ((m = caps.exec(redactedText))) {
    if (m[0].split(' ').some((w) => CAPS_COMMON.has(w))) continue;
    add(m[0]);
  }
  // Lines that are nothing but a capitalised name (an address block's first line).
  for (const line of redactedText.split('\n')) {
    const t = line.trim();
    if (/^\p{Lu}[\p{Ll}'’-]+(?:[ -]\p{Lu}[\p{L}'’-]+){0,3}$/u.test(t) && !SENTENCE_STARTERS.has(t.split(' ')[0])) add(t);
  }
  return [...out.keys()];
}
