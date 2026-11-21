// Appeal deadlines are computed by code, never by the model. The model (or a
// regex) only extracts facts from the letter; the rules below turn them into a
// date, and say which rule applied.

export type PlanType = 'employer' | 'marketplace' | 'medicare_advantage' | 'medicaid' | 'unknown';

export interface DeadlineInput {
  /** Date printed on the denial notice, ISO yyyy-mm-dd. */
  noticeDate: string | null;
  /** Appeal window the letter states, in calendar days. */
  statedWindowDays: number | null;
  planType: PlanType;
  /** "today", for days-left; injectable for tests. */
  today?: string;
}

export interface DeadlineResult {
  deadline: string | null;
  daysLeft: number | null;
  basis: 'stated-in-letter' | 'default-rule' | 'unknown';
  windowDays: number | null;
  explanation: string;
  citation?: string;
  /** Next step if the internal appeal is denied. */
  externalReview: string;
}

const DEFAULTS: Record<Exclude<PlanType, 'unknown'>, { days: number; rule: string; citation: string }> = {
  employer: {
    days: 180,
    rule: 'Employer (ERISA) group health plans must allow at least 180 days to appeal.',
    citation: '29 CFR 2560.503-1(h)(3)(i)',
  },
  marketplace: {
    days: 180,
    rule: 'ACA individual and Marketplace plans must allow 180 days to file an internal appeal.',
    citation: '45 CFR 147.136(b)',
  },
  medicare_advantage: {
    days: 65,
    rule: 'Medicare Advantage reconsideration requests are due within 65 days of the notice.',
    citation: '42 CFR 422.582(b)',
  },
  medicaid: {
    days: 60,
    rule: 'Medicaid managed-care appeals are due within 60 days of the adverse benefit determination.',
    citation: '42 CFR 438.402(c)(2)(ii)',
  },
};

const EXTERNAL_REVIEW: Record<PlanType, string> = {
  employer:
    'If the internal appeal is denied, you can usually request an independent external review within 4 months.',
  marketplace:
    'If the internal appeal is denied, you can request an independent external review within 4 months.',
  medicare_advantage:
    'If the plan upholds the denial, the case is forwarded automatically to an Independent Review Entity.',
  medicaid: 'If the plan upholds the denial, you can ask for a State Fair Hearing (usually within 120 days).',
  unknown: 'If the internal appeal is denied, ask the plan how to request an independent external review.',
};

export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

const toISO = (d: Date) => d.toISOString().slice(0, 10);
/** Today's date where the user is, not in UTC (an evening in the US is already "tomorrow" in UTC). */
export const localToday = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const DAY = 86_400_000;

export function computeDeadline(input: DeadlineInput): DeadlineResult {
  const notice = parseISO(input.noticeDate);
  const today = parseISO(input.today ?? localToday()) as Date;
  const external = EXTERNAL_REVIEW[input.planType];

  let windowDays: number | null = null;
  let basis: DeadlineResult['basis'] = 'unknown';
  let explanation = '';
  let citation: string | undefined;

  if (input.statedWindowDays && input.statedWindowDays > 0 && input.statedWindowDays <= 400) {
    windowDays = input.statedWindowDays;
    basis = 'stated-in-letter';
    explanation = `Your letter says you have ${windowDays} days to appeal.`;
  } else if (input.planType !== 'unknown') {
    const d = DEFAULTS[input.planType];
    windowDays = d.days;
    basis = 'default-rule';
    explanation = `The letter doesn't state a window, so we used the legal minimum: ${d.rule} Confirm it with your plan.`;
    citation = d.citation;
  } else {
    explanation =
      "We couldn't find an appeal window in the letter or tell what kind of plan this is. Call the number on the back of your insurance card and ask: \"What is my deadline to appeal this decision?\"";
  }

  if (!notice || windowDays === null) {
    return {
      deadline: null,
      daysLeft: null,
      basis: notice ? basis : 'unknown',
      windowDays,
      explanation: notice
        ? explanation
        : `${explanation} We also couldn't read the date of the notice, so we can't compute the exact deadline.`,
      citation,
      externalReview: external,
    };
  }

  const deadline = new Date(notice.getTime() + windowDays * DAY);
  return {
    deadline: toISO(deadline),
    daysLeft: Math.round((deadline.getTime() - today.getTime()) / DAY),
    basis,
    windowDays,
    explanation,
    citation,
    externalReview: external,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fact extraction. Used as the primary source when it finds
// something, and as the fallback when no model is available.

const NUMBER_WORDS: Record<string, number> = {
  thirty: 30, sixty: 60, 'sixty-five': 65, 'sixty five': 65, ninety: 90,
  'one hundred twenty': 120, 'one hundred and twenty': 120,
  'one hundred eighty': 180, 'one hundred and eighty': 180,
};

/** "within 180 days", "within one hundred eighty (180) calendar days", "65 days from the date". */
// Appeal window extraction. A letter usually states two kinds of deadline:
// the PATIENT's ("you may appeal within 180 days") and the PLAN's ("a decision
// will be made within 30 days"). Each "N days" mention is classified by the
// clause it sits in (who has to act), and the first patient deadline wins.

const NUMBER_WORD = String.raw`thirty|sixty(?:[ -]five)?|ninety|one hundred(?: and)? (?:twenty|eighty)`;
// "within one hundred eighty (180) days", "within 60 days", "have 180 days", "65 days from the date".
const DAYS_MENTION = new RegExp(
  String.raw`\b(?:(?:within|in|have|up to|no later than)\s+(?:(${NUMBER_WORD})\s+)?\(?(\d{2,3})?\)?\s*(?:calendar\s+)?days?\b|(\d{2,3})\s+(?:calendar\s+)?days?\s+(?:from|after|of)\b)`,
  'gi',
);

// The patient acts: "you may/can/must…", "if you send it", "your appeal must be received", "we must receive your…".
const PATIENT_CLAUSE =
  /\byou\s+(?:may|can|must|should|have|need)\b|\b(?:if|when|once)\s+you\b|\bmust be (?:received|filed|submitted|postmarked|sent)\b|\bwe must (?:receive|get|have)\b/i;
// The plan acts: "we will…", "the reviewer will…", "a decision will be made…", "you will be notified…".
const PLAN_CLAUSE =
  /\b(?:we|the plan|our (?:plan|team|reviewers?)|the reviewer|reviewers?|they)\s+(?:will|shall|must|are required to|have to)\b|\b(?:will|shall) be (?:made|decided|notified|sent|reviewed|mailed|issued)\b|\byou will (?:be notified|receive|get|hear)\b/i;
// The sentence must be about appealing ("…within 180 days of the date of this
// notice" counts), not about paying a bill.
const APPEAL_TOPIC = /\b(?:appeal|reconsider|reconsideration|review|dispute|grievance|hearing|request)/i;
const NOTICE_TOPIC = /\b(?:notice|letter|determination)\b/i;
const PAYMENT_TOPIC = /\b(?:pay|payment|balance|bill)\b/i;
const isAppealSentence = (s: string) => APPEAL_TOPIC.test(s) || (NOTICE_TOPIC.test(s) && !PAYMENT_TOPIC.test(s));

// Windows for a later or different process, or for someone else: a State Fair
// Hearing, an external/independent review, "after our appeal decision", or
// the provider's own deadline. These are never the first appeal's window.
const NEXT_LEVEL =
  /\b(?:fair hearing|state hearing|external review|independent review(?:er)?|review entity|hearing officer)\b|\b(?:of|after|from) (?:the date of |receiving )?(?:our|the|a|your) (?:appeal|final|internal appeal|reconsideration) (?:decision|determination)\b/i;
const THIRD_PARTY = /\b(?:your|the) (?:provider|doctor|physician|pharmacist|employer|facility|hospital)\b/i;

export function findWindowDays(text: string): number | null {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!isAppealSentence(sentence)) continue;
    DAYS_MENTION.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DAYS_MENTION.exec(sentence))) {
      const n = m[2] ? Number(m[2]) : m[3] ? Number(m[3]) : m[1] ? NUMBER_WORDS[m[1].toLowerCase()] : NaN;
      if (!n || n < 10 || n > 400) continue;
      // The clause: from the last clause break (comma, semicolon, "if", "and") before the number.
      const before = sentence.slice(0, m.index);
      const breaks = [...before.matchAll(/[,;]|\b(?:if|and|but|or)\b/gi)];
      const clauseStart = breaks.length ? breaks[breaks.length - 1].index! : 0;
      const clause = sentence.slice(clauseStart, m.index + m[0].length);
      const context = clause + sentence.slice(m.index + m[0].length, m.index + m[0].length + 60);
      if (NEXT_LEVEL.test(context) || THIRD_PARTY.test(clause)) continue;
      const patient = PATIENT_CLAUSE.test(clause);
      const plan = PLAN_CLAUSE.test(clause);
      if (patient || !plan) return n;
    }
  }
  return null;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Normalise a date string the letter uses to ISO. */
export function toISODate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return parseISO(t) ? t : null;
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return parseISO(iso) ? iso : null;
  }
  m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m && MONTH_INDEX[m[1].toLowerCase()]) {
    const iso = `${m[3]}-${String(MONTH_INDEX[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return parseISO(iso) ? iso : null;
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/);
  if (m && MONTH_INDEX[m[2].toLowerCase()]) {
    const iso = `${m[3]}-${String(MONTH_INDEX[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return parseISO(iso) ? iso : null;
  }
  return null;
}

const DATE_IN_TEXT =
  /\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

// A date directly after a birth/service label is about the patient or the
// care, never the notice. Only the label right before the date counts, so
// "Customer Service   Date: 11/02/2026" keeps its notice date.
const NOT_NOTICE_BEFORE =
  /\b(?:birth|dob|d\.o\.b|born|services?|dos|admission|admitted|discharged?|treatments?|visits?|procedures?|surgery|received|presented|effective|coverage|period|since|through|thru|by|due|dated|expires?|expiration|renewal|enrolled|enrollment)\b\.?(?: dates?| on)?(?: \(dos\))?[\s:()|\-–]{0,4}$/i;
// "10/01/2026 - 10/03/2026": the second date of a skipped range is skipped too.
const RANGE_JOINER = /^\s*(?:-|–|to|through|thru|and|,)\s*$/i;
const NOTICE_LABEL =
  /(?:date of (?:this )?(?:notice|letter|determination|decision)|notice date|letter date|date issued|issue date|\bissued\b(?: on)?|statement date|\bsent\b|(?:^|\s{2,}|\|\s*)date\s*:)\s*[:-]?\s*/i;

/** ISO dates on a line, from `from` onwards, skipping birth/service dates. */
function noticeDatesIn(line: string, from = 0): string[] {
  const out: string[] = [];
  const re = new RegExp(DATE_IN_TEXT.source, 'g');
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  let lastSkippedEnd = -1;
  while ((m = re.exec(line))) {
    const continuesSkippedRange = lastSkippedEnd >= 0 && RANGE_JOINER.test(line.slice(lastSkippedEnd, m.index));
    if (continuesSkippedRange || NOT_NOTICE_BEFORE.test(line.slice(Math.max(0, m.index - 24), m.index))) {
      lastSkippedEnd = m.index + m[0].length;
      continue;
    }
    lastSkippedEnd = -1;
    const iso = toISODate(m[0]);
    if (iso) out.push(iso);
  }
  return out;
}

/**
 * The notice date: the first date after a notice/letter-date label, or else
 * the first date in the first few lines (the dateline). Birth and service
 * dates are skipped date by date, not line by line.
 */
export function findNoticeDate(text: string): string | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(NOTICE_LABEL);
    if (!m || m.index === undefined) continue;
    const [first] = noticeDatesIn(line, m.index + m[0].length);
    if (first) return first;
  }
  // Dateline fallback: a line that is nothing but a date wins over a date
  // inside other header text.
  const head = lines.slice(0, 8);
  for (const line of head) {
    if (!new RegExp(`^\\s*(?:${DATE_IN_TEXT.source})\\s*$`).test(line)) continue;
    const [first] = noticeDatesIn(line);
    if (first) return first;
  }
  for (const line of head) {
    const [first] = noticeDatesIn(line);
    if (first) return first;
  }
  return null;
}

const PLAN_SIGNALS: Record<Exclude<PlanType, 'unknown'>, RegExp[]> = {
  medicare_advantage: [/medicare advantage/, /\bpart c\b/, /independent review entity/, /medicare (?:number|id)\b/, /\bmbi\b/, /integrated denial notice/, /notice of denial of (?:medical coverage|payment)/],
  medicaid: [/medicaid/, /medi-cal/, /state fair hearing/, /\bchip\b/, /managed care organization/],
  employer: [/\berisa\b/, /employer/, /group health plan/, /plan administrator/, /section 502\(a\)/, /summary plan description/, /employee (?:health|benefits?)/],
  marketplace: [/marketplace/, /healthcare\.gov/, /affordable care act/, /individual (?:health )?plans?\b/, /covered california/],
};

/**
 * Plan type from strong signals only. A passing mention ("if you also have
 * Medicare") must not decide a legal deadline, so a type wins only if it has
 * clearly more distinct signals than any other; otherwise "unknown", and the
 * on-device model (or the user) decides.
 */
export function guessPlanType(text: string): PlanType {
  const t = text.toLowerCase();
  const scores = (Object.keys(PLAN_SIGNALS) as Exclude<PlanType, 'unknown'>[])
    .map((type) => ({ type, n: PLAN_SIGNALS[type].filter((re) => re.test(t)).length }))
    .sort((a, b) => b.n - a.n);
  const [first, second] = scores;
  if (first.n === 0) return 'unknown';
  if (second.n === 0 || first.n - second.n >= 2) return first.type;
  return 'unknown';
}
