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
  | 'AGE'
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
    'services', 'id', 'portal', 'support', 'relations', 'advocate', 'handbook', 'guide', 'rights',
    'healthcare', 'insurance', 'company', 'cross', 'shield', 'blue', 'life', 'mutual', 'care', 'inc',
    'corp', 'corporation', 'group', 'enclosed', 'see', 'attached', 'unknown', 'sir', 'madam', 'customer',
    'doctor', 'colleague', 'participant', 'caregiver', 'applicant', 'friend', 'physician',
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

// Building blocks for Unicode name rules.
const NW = String.raw`\p{Lu}(?:\p{Ll}+(?:\p{Lu}\p{Ll}+)?|\.|(?=['’]))(?:['’-]\p{L}\p{Ll}+)*`; // Name, O’Brien, McGregor, M.
const CW = String.raw`\p{Lu}{2,}(?:['’-]\p{Lu}{2,})*`; // ALL-CAPS word
const CI = String.raw`(?:${CW}|\p{Lu}\.?)`; // ALL-CAPS word or initial
// Lowercase surname particles: "Maria de la Cruz", "Vincent van Gogh".
const PART = String.raw`(?:[ ](?:de|del|della|da|di|do|dos|das|du|van|von|der|den|ter|ten|le|la|bin|ibn|al|el))*`;
const TITLE = String.raw`(?:(?:Mr|Mrs|Ms|Miss|Dr)\.?[ ])?`;
// "Name:" alone counts only at the start of a field, so "Drug Name:" and "SERVICE NAME:" don't.
const BARE_NAME = String.raw`(?:(?<=^|[\n\t|]| {2})(?:Name|NAME))`;
// Labels that always introduce a person.
const PERSON_LABELS = String.raw`(?:Patient|Insured|Enrollee|Beneficiary|Participant|Claimant|Policyholder|Cardholder|Account ?holder|PATIENT|INSURED|ENROLLEE|BENEFICIARY|PARTICIPANT|CLAIMANT|POLICYHOLDER)(?:['’]s)?(?: [Nn]ame| NAME)?|(?:Member|Subscriber|Employee|Account|MEMBER|SUBSCRIBER|EMPLOYEE|ACCOUNT)(?:['’]s)?(?: [Nn]ame| NAME)|${BARE_NAME}|Dependent|Guardian`;
// Labels that may also introduce an organisation ("Member: KAISER PERMANENTE").
const AMBIGUOUS_LABELS = String.raw`Member|Subscriber|Employee|MEMBER|SUBSCRIBER|EMPLOYEE`;
const FIELD = String.raw`(?:${PERSON_LABELS}|${AMBIGUOUS_LABELS})[ \t]*:`;

const RULES: Rule[] = [
  { kind: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g },
  { kind: 'URL', re: /\b(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/g },
  { kind: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'SSN', re: /\bSSN[:#\s]*\d{9}\b/gi },
  { kind: 'SSN', re: /\b(?:SSN|Social Security(?: Number| No\.?)?)[:#\s]*(\d{3} \d{2} \d{4})\b/gi, group: 1 },
  {
    kind: 'PHONE',
    re: /(?<![\w$])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?(?!\d)/gi,
  },
  { kind: 'PHONE', re: /\b1-8\d\d-[A-Z0-9]{3}-[A-Z0-9]{4}\b/g },
  { kind: 'IP', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // Dates: numeric and written forms. Years alone are allowed by Safe Harbor.
  { kind: 'DATE', re: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{4}|\d{2})\b/g },
  { kind: 'DATE', re: /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g },
  // Dotted dates need a 4-digit year, so "Section 4.1.12" and "version 3.2.25" survive.
  { kind: 'DATE', re: /(?<![\w.])(?:0?[1-9]|1[0-2])\.(?:0?[1-9]|[12]\d|3[01])\.(?:19|20)\d{2}(?![.\d])/g },
  { kind: 'DATE', re: /\b(?:19|20)\d{2}\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b/g },
  { kind: 'DATE', re: new RegExp(`\\b\\d{1,2}[- ](?:${MONTHS})[- ]\\d{4}\\b`, 'gi') },
  // Safe Harbor also lists vehicle and device identifiers.
  {
    kind: 'ID',
    re: /\b(?:license plate|plate (?:no\.?|number|#)|VIN|vehicle (?:id|identification number)|device (?:id|serial(?: number)?)|serial (?:no\.?|number|#))[ \t]*[:#]?[ \t]*([A-Z0-9][A-Z0-9-]{4,16})\b/gi,
    group: 1,
    accept: (v) => /\d/.test(v),
  },
  { kind: 'ZIP', re: /\b(?:ZIP|Zip|zip)(?: [Cc]ode)?[ \t]*[:#]?[ \t]*(\d{5}(?:-\d{4})?)\b/g, group: 1 },
  // Ages over 89 are identifiers under Safe Harbor; younger ages are not.
  { kind: 'AGE', re: /\b(?:age|aged)[ :]+(9\d|1[01]\d)\b(?!\s*(?:days?|months?|weeks?|percent|percentile|%))/gi, group: 1 },
  { kind: 'AGE', re: /\b(9\d|1[01]\d)[- ]?(?:year|yr)s?[- ]old\b/gi, group: 1 },
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
    kind: 'ID',
    re: /\b([Mm]ember|MEMBER|[Ss]ubscriber|SUBSCRIBER|[Pp]olicy|POLICY|[Gg]roup|GROUP|Medicare|MEDICARE|Medicaid|MEDICAID|[Cc]laim|CLAIM|[Aa]ccount|ACCOUNT|[Rr]eference|REFERENCE|Medical Record|MEDICAL RECORD)[ \t]*(?:ID|Id|No\.?|NO\.?|[Nn]umber|NUMBER|#)[ \t]*[:#]?[ \t]*([A-Z0-9]{2,}(?:[ -](?=[A-Z0-9]*\d)[A-Z0-9]{2,}){0,4})(?![a-z])/g,
    group: 2,
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
    // EOBs often use "Patient Name<TAB>Grace Achterberg" with no colon, so the
    // colon stays optional. Label words that are not names ("Patient Account
    // No.", "Employee Benefits Trust") are rejected by acceptName/NOT_A_NAME.
    re: /\b(?:Dear|Patient(?: [Nn]ame)?|Member(?: [Nn]ame)?|Subscriber(?: [Nn]ame)?|Insured(?: [Nn]ame)?|Enrollee(?: [Nn]ame)?|Beneficiary(?: [Nn]ame)?|Participant(?: [Nn]ame)?|Employee(?: [Nn]ame)?|(?<=^|[\n\t|]| {2})Name|Attn|Attention|To|Dependent|Guardian|Parent\/Guardian|cc|Signed|Representative)[ \t]*[:,]?[ \t]+((?:(?:Mr|Mrs|Ms|Miss|Dr)\.?[ ])?[A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*(?:[ ][A-Z]\.)?(?:[ ][A-Z][a-z]*(?:['’-][A-Za-z][a-z]+)*){1,2})/g,
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
  // Unicode, "Last, First" and initials after a label ("Member: O’Brien, Siobhán",
  // "Dear José Ñúñez-García", "Patient: M. L. Gonzalez").
  { kind: 'PERSON', re: new RegExp(`(?<![\\p{L}])(?:${FIELD}|(?:Dear|DEAR|Attn|To|cc)[ \\t]*[:,]?)[ \\t]+(${TITLE}(?:${NW},[ ]?${NW}(?:[ ]${NW})?|${NW}(?:${PART}[ ]${NW}){1,3}))`, 'gu'), group: 1, accept: acceptName },
  // ALL-CAPS names, only after a patient field label or "Dear" ("MEMBER NAME: JOHN Q
  // PUBLIC", "Member: DE LA CRUZ, ANA"); "To: CIGNA HEALTHCARE" is an insurer, not a person.
  { kind: 'PERSON', re: new RegExp(`(?<![\\p{L}])(?:${FIELD}|(?:Dear|DEAR)[ \\t]*[:,]?)[ \\t]+(${CW}(?:[ ]${CW}){0,2},[ ]?${CW}(?:[ ]${CI})?)`, 'gu'), group: 1, accept: acceptName },
  // "First Last" in capitals after a person field label or "Dear" ("MEMBER: JOHN SMITH").
  // "MEMBER: KAISER PERMANENTE" is hidden too: over-redaction is acceptable, a leak
  // is not (the insurer name is restored on the device). Not after "To:".
  { kind: 'PERSON', re: new RegExp(`(?<![\\p{L}])(?:${FIELD}|(?:Dear|DEAR)[ \\t]*[:,]?)[ \\t]+(${CW}(?:[ ]${CI})?(?:[ ]${CW}){1,2})`, 'gu'), group: 1, accept: acceptName },
  // Titles before any name form, including initials ("Dr. J. R. Okafor").
  { kind: 'PERSON', re: new RegExp(`\\b(?:Dr|Mr|Mrs|Ms|Miss|DR|MR|MRS|MS)\\.?[ ]+(${NW}(?:[ ]${NW}){0,3}|${CW}(?:[ ]${CW}){0,2})`, 'gu'), group: 1, accept: acceptName },
  // A single surname after "Dear" ("Dear Okonkwo,").
  { kind: 'PERSON', re: new RegExp(`\\b(?:Dear|DEAR)[ \\t]+${TITLE}(${NW}|${CW}),`, 'gu'), group: 1, accept: acceptName },
  // "Dear MS. GONZALEZ," — a capitals surname only with a title ("Dear AETNA," is not a person).
  { kind: 'PERSON', re: new RegExp(`\\b(?:Dear|DEAR)[ \\t]+(?:Mr|Mrs|Ms|Miss|Dr|MR|MRS|MS|DR)\\.?[ ]+(${CW}),`, 'gu'), group: 1, accept: acceptName },
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
  ADDRESS: 5, DATE: 5, AGE: 5, URL: 4, IP: 4, ZIP: 3, ID: 2,
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
