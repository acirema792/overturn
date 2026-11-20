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
const DAY = 86_400_000;

export function computeDeadline(input: DeadlineInput): DeadlineResult {
  const notice = parseISO(input.noticeDate);
  const today = parseISO(input.today ?? toISO(new Date())) as Date;
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
export function findWindowDays(text: string): number | null {
  const t = text.replace(/\s+/g, ' ');
  const patterns = [
    /(?:within|no later than|in|have|up to)\s+(?:[a-z -]+\s+)?\(?(\d{2,3})\)?\s+(?:calendar\s+)?days?\b[^.]{0,80}?\b(?:appeal|request|reconsideration|review|date of (?:this|the) (?:notice|letter))/i,
    /(?:appeal|request|reconsideration)[^.]{0,80}?\bwithin\s+(?:[a-z -]+\s+)?\(?(\d{2,3})\)?\s+(?:calendar\s+)?days?/i,
    /\b(\d{2,3})\s+(?:calendar\s+)?days?\s+(?:from|after|of)\s+(?:the\s+)?(?:date|receipt)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 10 && n <= 400) return n;
    }
  }
  const words = t.match(
    /within\s+(thirty|sixty(?:[ -]five)?|ninety|one hundred(?: and)? (?:twenty|eighty))\s+(?:calendar\s+)?days/i,
  );
  if (words) return NUMBER_WORDS[words[1].toLowerCase()] ?? null;
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

/**
 * The notice date: a date labelled "Date of notice"/"Notice date"/"Date:", or
 * else the first date in the first few lines (the letter's dateline).
 */
export function findNoticeDate(text: string): string | null {
  const labelled = text.match(
    /(?:date of (?:this )?(?:notice|letter|determination|decision)|notice date|letter date|date issued|issue date|issued(?: on)?|statement date|sent|^\s*date)\s*[:\-]?\s*([A-Za-z0-9 ,./-]{6,24})/im,
  );
  if (labelled) {
    const inner = labelled[1].match(DATE_IN_TEXT);
    if (inner) {
      const iso = toISODate(inner[0]);
      if (iso) return iso;
    }
  }
  const head = text.split('\n').slice(0, 8).join('\n');
  const first = head.match(DATE_IN_TEXT);
  return first ? toISODate(first[0]) : null;
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
