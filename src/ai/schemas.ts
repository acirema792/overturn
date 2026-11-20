// JSON Schemas shared by both inference paths: passed to Chrome's Prompt API as
// `responseConstraint` (on-device) and to Gemini as `responseJsonSchema` (cloud),
// so either path returns the same shape.

import { DENIAL_CATEGORIES } from '../core/categories';

export const PLAN_TYPES = ['employer', 'marketplace', 'medicare_advantage', 'medicaid', 'unknown'] as const;
export const PERSON_ROLES = ['patient', 'family_or_caregiver', 'doctor_or_provider', 'insurer_staff', 'other'] as const;

export const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    people: {
      type: 'array',
      description: 'Every person named anywhere in the letter, exactly as written.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: [...PERSON_ROLES] },
        },
        required: ['name', 'role'],
      },
    },
    identifiers: {
      type: 'array',
      description: 'Member, claim, account, policy or record numbers, exactly as written.',
      items: { type: 'string' },
    },
    addresses: { type: 'array', items: { type: 'string' } },
    contacts: {
      type: 'array',
      description: 'Phone numbers, emails and web links that belong to the patient or family.',
      items: { type: 'string' },
    },
    organisationsAboutThePatient: {
      type: 'array',
      description: "The patient's employer, school or similar. NOT the insurer or the hospital.",
      items: { type: 'string' },
    },
  },
  required: ['people', 'identifiers', 'addresses', 'contacts', 'organisationsAboutThePatient'],
} as const;

export interface EntityResult {
  people: { name: string; role: (typeof PERSON_ROLES)[number] }[];
  identifiers: string[];
  addresses: string[];
  contacts: string[];
  organisationsAboutThePatient: string[];
}

export const FACTS_SCHEMA = {
  type: 'object',
  properties: {
    insurer: { type: 'string', description: 'Name of the insurance company or plan.' },
    planType: { type: 'string', enum: [...PLAN_TYPES] },
    denialCategory: { type: 'string', enum: [...DENIAL_CATEGORIES] },
    serviceDenied: { type: 'string', description: 'The treatment, test, drug or bill that was denied.' },
    reasonInPlainWords: {
      type: 'string',
      description: 'One or two sentences a non-expert understands. No names or numbers of people.',
    },
    noticeDate: { type: 'string', description: 'Date of the notice as YYYY-MM-DD, or empty.' },
    appealWindowDays: { type: 'integer', description: 'Days allowed to appeal as stated in the letter, or 0.' },
    urgent: { type: 'boolean', description: 'True if waiting could seriously harm the patient (ongoing care, hospital stay).' },
  },
  required: ['insurer', 'planType', 'denialCategory', 'serviceDenied', 'reasonInPlainWords', 'noticeDate', 'appealWindowDays', 'urgent'],
} as const;

export interface FactsResult {
  insurer: string;
  planType: (typeof PLAN_TYPES)[number];
  denialCategory: (typeof DENIAL_CATEGORIES)[number];
  serviceDenied: string;
  reasonInPlainWords: string;
  noticeDate: string;
  appealWindowDays: number;
  urgent: boolean;
}

export const APPEAL_SCHEMA = {
  type: 'object',
  properties: {
    plainExplanation: { type: 'string', description: 'What happened and what it means, in 3-4 plain sentences.' },
    strongestArguments: { type: 'array', items: { type: 'string' }, description: '2-4 arguments, strongest first.' },
    evidenceToGather: { type: 'array', items: { type: 'string' } },
    questionsForDoctor: { type: 'array', items: { type: 'string' } },
    appealLetter: { type: 'string', description: 'The full appeal letter, ready to sign.' },
  },
  required: ['plainExplanation', 'strongestArguments', 'evidenceToGather', 'questionsForDoctor', 'appealLetter'],
} as const;

export interface AppealResult {
  plainExplanation: string;
  strongestArguments: string[];
  evidenceToGather: string[];
  questionsForDoctor: string[];
  appealLetter: string;
}

/** Parse model JSON defensively: models sometimes wrap it in a code fence. */
export function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error('The model did not return valid JSON.');
  }
}
