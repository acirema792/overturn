// Deterministic identifier detectors, modelled on the HIPAA Safe Harbor list
// (45 CFR 164.514(b)(2)). They run locally on every letter, with or without an
// on-device model, and again on every outgoing cloud payload (see egressGate.ts).
//
// Design rule: over-redaction is acceptable, a leak is not. Clinical content the
// appeal needs (CPT/HCPCS and ICD-10 codes, dollar amounts, the denial reason,
// the insurer's name) is deliberately NOT treated as an identifier.

export type IdKind =
  | 'PERSON'
  | 'DATE'
  | 'PHONE'
  | 'EMAIL'
  | 'SSN'
  | 'MEMBER_ID'
  | 'CLAIM_ID'
  | 'ACCOUNT_ID'
  | 'ADDRESS'
  | 'ZIP'
  | 'URL'
  | 'IP'
  | 'ID';

export interface Span {
  start: number;
  end: number;
  kind: IdKind;
  text: string;
  source: 'rule' | 'on-device' | 'propagated' | 'user';
  /** For a name fragment ("Vance"), the full name it belongs to ("Theresa Vance"). */
  canonical?: string;
}

const SOURCE_PRIORITY: Record<Span['source'], number> = { user: 4, 'on-device': 3, rule: 2, propagated: 1 };

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

const STREET_SUFFIX =
  'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Square|Sq|Trail|Trl';

// Words that look like names after a label but are not people.
const NOT_A_NAME = new Set(
  [
    'member', 'members', 'patient', 'customer', 'subscriber', 'provider', 'sir', 'madam',
    'policyholder', 'enrollee', 'beneficiary', 'appeals', 'appeal', 'team', 'department',
    'notice', 'of', 'denial', 'determination', 'information', 'benefits', 'benefit', 'claim', 'account',
    'number', 'no', 'date', 'statement', 'trust', 'service', 'coverage', 'adverse', 'explanation',
    'claims', 'services', 'the', 'valued', 'health', 'plan', 'insured', 'name', 'id',
  ].map((w) => w.toLowerCase()),
);

/** Reject captures that contain non-name words ("Member Services", "Your Plan"). */
function acceptName(v: string): boolean {
  const words = v.replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+/, '').split(/\s+/);
  return words.length > 0 && !words.some((w) => NOT_A_NAME.has(w.toLowerCase().replace(/[^a-z]/g, '')));
}

interface Rule {
  kind: IdKind;
  re: RegExp;
  /** Capture group holding the identifier (0 = whole match). */
  group?: number;
  accept?: (value: string) => boolean;
}

const looksLikeCode = (v: string) =>
  /^\d{5}$/.test(v) || // CPT
  /^[A-Z]\d{4}$/.test(v) || // HCPCS
  /^[A-TV-Z]\d[0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(v); // ICD-10-CM

const LABELED_ID_KIND = (label: string): IdKind => {
  const l = label.toLowerCase();
  if (/(member|subscriber|policy|group|enrollee|beneficiary|medicare|medicaid|insured)/.test(l)) return 'MEMBER_ID';
  if (/(claim|reference|ref|case|authorization|auth|appeal|grievance|tracking|control)/.test(l)) return 'CLAIM_ID';
  if (/(account|acct|invoice|statement|patient|mrn|medical record|chart)/.test(l)) return 'ACCOUNT_ID';
  return 'ID';
};

const RULES: Rule[] = [
  { kind: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g },
  { kind: 'URL', re: /\b(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/g },
  { kind: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'SSN', re: /\bSSN[:#\s]*\d{9}\b/gi },
  { kind: 'SSN', re: /\b\d{3} \d{2} \d{4}\b/g },
  {
    kind: 'PHONE',
    re: /(?<![\w$])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?(?!\d)/gi,
  },
  { kind: 'PHONE', re: /\b1-8\d\d-[A-Z0-9]{3}-[A-Z0-9]{4}\b/g },
  { kind: 'IP', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // Dates: numeric and written forms. Years alone are allowed by Safe Harbor.
  { kind: 'DATE', re: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{4}|\d{2})\b/g },
  { kind: 'DATE', re: /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g },
  { kind: 'DATE', re: /\b(?:0?[1-9]|1[0-2])\.(?:0?[1-9]|[12]\d|3[01])\.(?:\d{4}|\d{2})\b/g },
  { kind: 'DATE', re: new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'g') },
  { kind: 'DATE', re: new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\.?,?\\s+\\d{4}\\b`, 'g') },
  // Labeled identifiers: "Member ID: XJH448812901", "Claim #: 2026-0412-7781".
  {
    kind: 'ID',
    re: /\b(Member|Subscriber|Policy(?=\s*(?:ID|No|Number|Num|#))|Group(?=\s*(?:ID|No|Number|Num|#))|Enrollee|Beneficiary|Medicare|Medicaid|Claim|Reference|Ref|Case|Authorization|Auth|Appeal|Grievance|Tracking|Control|Account|Acct|Invoice|Statement|Patient Account|Medical Record|MRN|Chart)\s*(?:ID|No\.?|Number|Num|#)?\s*(?:#|:|No\.?)?\s*(?=[A-Z0-9-]*\d)([A-Z0-9][A-Z0-9-]{3,}[A-Z0-9])\b/gi,
    group: 2,
    accept: (v) => !looksLikeCode(v.toUpperCase()) && /\d/.test(v),
  },
  // Explicitly labelled IDs ("Member ID: XJH 4488 12901", "Member ID: 72148"):
  // the label says it's an identifier, so spaced groups and code-like values count.
  {
    kind: 'MEMBER_ID',
    re: /\b(?:[Mm]ember|MEMBER|[Ss]ubscriber|SUBSCRIBER|[Pp]olicy|POLICY|[Gg]roup|GROUP|Medicare|MEDICARE|Medicaid|MEDICAID|[Cc]laim|CLAIM|[Aa]ccount|ACCOUNT|[Rr]eference|REFERENCE)[ \t]*(?:ID|Id|No\.?|NO\.?|Number|NUMBER|#)[ \t]*[:#]?[ \t]*([A-Z0-9]{2,}(?:[ -][A-Z0-9]{2,}){0,4})(?![a-z])/g,
    group: 1,
    accept: (v) => (v.match(/\d/g) || []).length >= 4,
  },
  // Unlabeled long identifiers: ≥7 characters with ≥5 digits, not a code or money.
  {
    kind: 'ID',
    re: /(?<![$\w.,-])(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{5,}[A-Z0-9](?![\w.]*\d)/g,
    accept: (v) => (v.match(/\d/g) || []).length >= 5 && !looksLikeCode(v) && !/^\d{4}$/.test(v),
  },
  // Street addresses.
  {
    kind: 'ADDRESS',
    re: new RegExp(
      `\\b\\d{1,6}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z0-9][A-Za-z0-9'.-]*\\s+){0,4}(?:${STREET_SUFFIX})\\b\\.?(?:,?\\s*(?:Apt|Apartment|Unit|Suite|Ste|#)\\.?\\s*[A-Za-z0-9-]+)?`,
      'g',
    ),
  },
  { kind: 'ADDRESS', re: /\bP\.?\s?O\.?\s+Box\s+\d+\b/gi },
  // "Springfield, IL 62704" — city, state, ZIP.
  {
    kind: 'ADDRESS',
    re: /\b[A-Z][a-zA-Z.'-]+(?:\s[A-Z][a-zA-Z.'-]+){0,2},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
  },
  { kind: 'ZIP', re: /\b[A-Z]{2}\s+(\d{5}(?:-\d{4})?)\b/g, group: 1 },
  // Names after a salutation, a label, a relationship word or a title.
  {
    kind: 'PERSON',
    // Field labels ("Patient:", "Member Name:") need a colon, so "Patient
    // Account No." and "Employee Benefits Trust" are not taken as names.
    // Salutations and routing words ("Dear", "To", "cc") don't.
    re: /\b(?:(?:(?:Patient|Member|Subscriber|Insured|Enrollee|Beneficiary|Participant|Employee)(?: [Nn]ame)?|Name|Dependent|Guardian|Parent\/Guardian|Representative)[ \t]*:|(?:Dear|Attn|Attention|To|cc|Signed)[ \t]*[:,]?)[ \t]+((?:(?:Mr|Mrs|Ms|Miss|Dr)\.?[ ])?[A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*(?:[ ][A-Z]\.)?(?:[ ][A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*){1,2})/g,
    group: 1,
    accept: acceptName,
  },
  {
    kind: 'PERSON',
    re: /\b(?:husband|wife|spouse|partner|son|daughter|child|mother|father|parent|brother|sister|caregiver|guardian|grandson|granddaughter|grandmother|grandfather)[ \t]*,?[ \t]+([A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*(?:[ ][A-Z]\.)?(?:[ ][A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*){0,2})/g,
    group: 1,
    accept: acceptName,
  },
  {
    kind: 'PERSON',
    re: /\b(?:Dr|Mr|Mrs|Ms|Miss)\.?[ ]+([A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*(?:[ ][A-Z]\.)?(?:[ ][A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*){0,2})/g,
    group: 1,
    accept: acceptName,
  },
  {
    kind: 'PERSON',
    re: /\b([A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*(?:[ ][A-Z]\.)?[ ][A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*),?[ ]+(?:RN|MD|DO|NP|PA-C|PA|LPN|LCSW|PhD|PharmD|DPT)\b/g,
    group: 1,
    accept: acceptName,
  },
  // Unicode, all-caps, "Last, First" and initials after a label
  // ("Patient: MARIA GONZALEZ", "Member: Gonzalez, Maria", "Dear José Ñúñez-García").
  {
    kind: 'PERSON',
    re: /(?<![\p{L}])(?:(?:(?:Patient|Member|Subscriber|Insured|Enrollee|Beneficiary|Participant|Employee|PATIENT|MEMBER|SUBSCRIBER)(?: [Nn]ame| NAME)?|Name|NAME|Dependent|Guardian)[ \t]*:|(?:Dear|DEAR|Attn|To|cc)[ \t]*[:,]?)[ \t]+((?:(?:Mr|Mrs|Ms|Miss|Dr)\.?[ ])?(?:\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.)(?:['’-]\p{L}\p{Ll}+)*,[ ]?\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.)(?:['’-]\p{L}\p{Ll}+)*(?:[ ]\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.)(?:['’-]\p{L}\p{Ll}+)*)?|\p{Lu}{2,}(?:['’-]\p{Lu}{2,})*,[ ]?\p{Lu}{2,}(?:['’-]\p{Lu}{2,})*|\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.)(?:['’-]\p{L}\p{Ll}+)*(?:[ ]\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.)(?:['’-]\p{L}\p{Ll}+)*){1,3}|\p{Lu}{2,}(?:['’-]\p{Lu}{2,})*(?:[ ]\p{Lu}{2,}(?:['’-]\p{Lu}{2,})*){1,2}))/gu,
    group: 1,
    accept: acceptName,
  },
];

function labelOf(match: RegExpExecArray): string {
  return match[1] ?? '';
}

export function detect(text: string): Span[] {
  const spans: Span[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text))) {
      const g = rule.group ?? 0;
      const value = m[g];
      if (!value) continue;
      if (rule.accept && !rule.accept(value)) continue;
      const offset = g === 0 ? 0 : m[0].lastIndexOf(value);
      const start = m.index + offset;
      let kind = rule.kind;
      if (kind === 'ID' && rule.group === 2) kind = LABELED_ID_KIND(labelOf(m));
      spans.push({ start, end: start + value.length, kind, text: value, source: 'rule' });
      if (m[0].length === 0) rule.re.lastIndex++;
    }
  }
  return mergeSpans(spans);
}

const KIND_PRIORITY: Record<IdKind, number> = {
  SSN: 10, EMAIL: 9, MEMBER_ID: 8, CLAIM_ID: 8, ACCOUNT_ID: 8, PHONE: 7, PERSON: 6,
  ADDRESS: 5, DATE: 5, URL: 4, IP: 4, ZIP: 3, ID: 2,
};

/** Merge overlapping spans; the union is redacted, the strongest kind wins. */
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start < last.end) {
      if (s.end > last.end) {
        // Overlap that extends the span: keep the union.
        last.end = s.end;
      }
      if (KIND_PRIORITY[s.kind] > KIND_PRIORITY[last.kind] && s.end - s.start >= (last.end - last.start) / 2) {
        last.kind = s.kind;
      }
      if (SOURCE_PRIORITY[s.source] > SOURCE_PRIORITY[last.source]) last.source = s.source;
      if (s.canonical && (!last.canonical || s.canonical.length > last.canonical.length)) last.canonical = s.canonical;
      continue;
    }
    out.push({ ...s });
  }
  return out;
}
