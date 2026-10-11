/**
 * age-of-majority — is this person a minor here, and which age thresholds apply?
 *
 * NOT LEGAL ADVICE. The bundled tables are not a claim of completeness: a
 * place they do not cover answers `null`, never a guessed 18.
 */

/** Which table to read. */
export type Kind = 'majority' | 'digitalConsent';

/** Why a person's status could or could not be decided. */
export type Reason =
  | 'below_threshold'
  | 'at_or_above_threshold'
  | 'unknown_jurisdiction'
  | 'subdivision_required'
  | 'no_rule_in_force';

/** 'high': read in the primary text. 'medium': an official or reputable secondary source. */
export type Confidence = 'high' | 'medium';

/** How a 29 February birth is anniversaried in a common year. */
export type LeapDayRule = 'mar1' | 'feb28';

/**
 * When an age is attained: at the start of the anniversary ('anniversary'),
 * or on the day before it, as at common law ('dayBefore').
 */
export type AttainmentRule = 'anniversary' | 'dayBefore';

/**
 * A jurisdiction: an ISO 3166-1 alpha-2 code ('CZ'), an ISO 3166-2 code
 * ('US-AL', 'CA-BC'), or its parts. Case-insensitive; 'UK' and 'EL' are
 * accepted for GB and GR. Anything unreadable throws a TypeError.
 */
export type JurisdictionInput = string | { country: string; subdivision?: string | null };

/** A date: 'YYYY-MM-DD' (preferred), or a Date read on `timeZone`'s calendar. */
export type DateInput = string | Date;

/** One version of a rule, as stored in the tables. */
export interface RuleVersion {
  readonly age: number;
  /** 'YYYY-MM-DD'; null on a first version that reaches back indefinitely. */
  readonly effectiveFrom: string | null;
  readonly citation: string;
  readonly sourceUrl: string;
  readonly confidence: Confidence;
  readonly note: string | null;
  /** A jurisdiction-specific leap-day rule, where its law sets one. */
  readonly leapDay: LeapDayRule | null;
  /** A jurisdiction-specific attainment rule, where its law sets one. */
  readonly attainment: AttainmentRule | null;
}

/** One table entry. */
export interface Entry {
  /** True for a country that leaves the threshold to its subdivisions. */
  readonly bySubdivision: boolean;
  /** Oldest first. Empty when `bySubdivision`. */
  readonly versions: ReadonlyArray<RuleVersion>;
  /** Set only on a `bySubdivision` entry. */
  readonly citation: string | null;
  readonly sourceUrl: string | null;
  readonly note: string | null;
}

/** A threshold in force on a date. */
export interface Threshold {
  readonly kind: Kind;
  readonly age: number;
  /** The canonical form of the jurisdiction asked about. */
  readonly jurisdiction: string;
  /** The entry that answered: the place itself, its country, or the country governing it. */
  readonly matched: string;
  readonly effectiveFrom: string | null;
  /** The first day of the next version; null while this one is current. */
  readonly effectiveUntil: string | null;
  readonly citation: string;
  readonly sourceUrl: string;
  readonly confidence: Confidence;
  readonly note: string | null;
}

export interface LookupOptions {
  /** Evaluation date. Default: today on `timeZone`'s calendar. */
  at?: DateInput;
  /** IANA zone used to read a Date `at` (or today) as a calendar date. Default 'UTC'. */
  timeZone?: string;
}

export interface RuleOptions {
  leapDay?: LeapDayRule;
  attainment?: AttainmentRule;
}

export interface PersonArgs extends LookupOptions, RuleOptions {
  /** 'YYYY-MM-DD', or a Date at exactly midnight UTC. */
  birthDate: DateInput;
  jurisdiction: JurisdictionInput;
}

export interface MinorResult {
  /** null when the tables hold no answer: unknown is not adult. */
  readonly minor: boolean | null;
  /** Completed years on `at`. */
  readonly age: number;
  readonly majorityAge: number | null;
  /** 'YYYY-MM-DD': the first day the person is no longer a minor. */
  readonly minorUntil: string | null;
  readonly reason: Reason;
  readonly jurisdiction: string;
  /** The evaluation date, 'YYYY-MM-DD'. */
  readonly at: string;
  readonly rule: Threshold | null;
}

export interface ParentalConsentResult {
  /** null when the tables hold no answer. */
  readonly required: boolean | null;
  readonly age: number;
  readonly consentAge: number | null;
  /** 'YYYY-MM-DD': the first day the person may consent on their own. */
  readonly canConsentFrom: string | null;
  readonly reason: Reason;
  readonly jurisdiction: string;
  readonly at: string;
  readonly rule: Threshold | null;
}

export interface StrictestResult {
  readonly kind: Kind;
  /** The highest threshold — null if any jurisdiction is unknown. */
  readonly age: number | null;
  /** The strictest of the known jurisdictions (first on a tie), or null if none is known. */
  readonly governing: Threshold | null;
  /** Canonical codes the tables hold no answer for. */
  readonly unknown: ReadonlyArray<string>;
  /** One result per input, in order. */
  readonly results: ReadonlyArray<Threshold | null>;
}

export declare function ageOfMajority(jurisdiction: JurisdictionInput, options?: LookupOptions): Threshold | null;
export declare function digitalConsentAge(jurisdiction: JurisdictionInput, options?: LookupOptions): Threshold | null;
export declare function threshold(jurisdiction: JurisdictionInput, kind: Kind, options?: LookupOptions): Threshold | null;
export declare function isMinor(args: PersonArgs): MinorResult;
export declare function needsParentalConsent(args: PersonArgs): ParentalConsentResult;
export declare function minorUntil(birthDate: DateInput, jurisdiction: JurisdictionInput, options?: RuleOptions): string | null;
export declare function ageOn(birthDate: DateInput, options?: LookupOptions & RuleOptions): number;
export declare function strictest(
  jurisdictions: ReadonlyArray<JurisdictionInput>,
  kind: Kind,
  options?: LookupOptions,
): StrictestResult;
export declare function normalizeJurisdiction(jurisdiction: JurisdictionInput): string;
export declare function jurisdictions(kind: Kind): string[];

export declare const MAJORITY: Readonly<Record<string, Entry>>;
export declare const DIGITAL_CONSENT: Readonly<Record<string, Entry>>;
/** The date the tables were last checked against their sources, 'YYYY-MM-DD'. */
export declare const AS_OF: string;
export declare const KINDS: Readonly<{ MAJORITY: 'majority'; DIGITAL_CONSENT: 'digitalConsent' }>;
export declare const REASONS: Readonly<{
  BELOW_THRESHOLD: 'below_threshold';
  AT_OR_ABOVE_THRESHOLD: 'at_or_above_threshold';
  UNKNOWN_JURISDICTION: 'unknown_jurisdiction';
  SUBDIVISION_REQUIRED: 'subdivision_required';
  NO_RULE_IN_FORCE: 'no_rule_in_force';
}>;
