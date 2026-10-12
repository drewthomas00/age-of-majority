/**
 * age-of-majority — is this person a minor here, and which age thresholds apply?
 *
 * Two tables, each keyed by jurisdiction and each entry carrying the provision
 * it comes from and a link to it:
 *
 *   majority        the age at which a person attains full legal capacity
 *   digitalConsent  the age from which a person may consent on their own to
 *                   the processing of their personal data by an online
 *                   service (GDPR Art. 8, COPPA and their equivalents)
 *
 * Entries are versioned by effective date, so a law change is a new version
 * rather than an edit that rewrites history. An answer the tables do not hold
 * is `null` — never a guessed 18.
 *
 * Pure functions: no I/O, no network, zero runtime dependencies.
 *
 * NOT LEGAL ADVICE. See the README for how the tables were checked.
 */
'use strict';

const { deepFreeze } = require('./freeze');
const iso = require('./jurisdictions');
const dates = require('./dates');
const data = require('./data');

/** The two tables, by name. */
const KINDS = deepFreeze({ MAJORITY: 'majority', DIGITAL_CONSENT: 'digitalConsent' });

/** Why a person's status could or could not be decided. */
const REASONS = deepFreeze({
  /** Younger than the threshold in force on the evaluation date. */
  BELOW_THRESHOLD: 'below_threshold',
  /** At or past the threshold in force on the evaluation date. */
  AT_OR_ABOVE_THRESHOLD: 'at_or_above_threshold',
  /** The tables hold no answer for this jurisdiction. */
  UNKNOWN_JURISDICTION: 'unknown_jurisdiction',
  /**
   * The country sets this threshold per subdivision (US states, Canadian
   * provinces), and none was given.
   */
  SUBDIVISION_REQUIRED: 'subdivision_required',
  /** The evaluation date is before the earliest rule recorded for the place. */
  NO_RULE_IN_FORCE: 'no_rule_in_force',
});

const CONFIDENCE = Object.freeze(['high', 'medium']);

const VERSION_FIELDS = Object.freeze([
  'age', 'effectiveFrom', 'citation', 'sourceUrl', 'confidence', 'note', 'leapDay', 'attainment',
]);
const SUBDIVISION_ENTRY_FIELDS = Object.freeze(['bySubdivision', 'citation', 'sourceUrl', 'note']);

// ── Table validation ────────────────────────────────────────────

/**
 * Validate one version and return a frozen copy with every field present.
 * The bundled tables pass through here at load, so a malformed entry fails
 * the require() rather than a lookup months later.
 */
function normalizeVersion(where, version) {
  if (!version || typeof version !== 'object' || Array.isArray(version)) {
    throw new TypeError(`${where} must be an object`);
  }
  for (const key of Object.keys(version)) {
    if (!VERSION_FIELDS.includes(key)) {
      throw new TypeError(`${where}: unknown field '${key}' (expected one of: ${VERSION_FIELDS.join(', ')})`);
    }
  }
  const { age, effectiveFrom = null, citation, sourceUrl, confidence, note = null,
    leapDay = null, attainment = null } = version;
  if (!Number.isInteger(age) || age < 1 || age > 30) {
    throw new TypeError(`${where}: age must be an integer in 1..30 (got ${age})`);
  }
  if (effectiveFrom !== null && (typeof effectiveFrom !== 'string' || !dates.parseIsoDate(effectiveFrom))) {
    throw new TypeError(`${where}: effectiveFrom must be 'YYYY-MM-DD' (got ${effectiveFrom})`);
  }
  if (typeof citation !== 'string' || citation.trim() === '') {
    throw new TypeError(`${where}: citation is required`);
  }
  if (typeof sourceUrl !== 'string' || !/^https?:\/\/\S+$/.test(sourceUrl)) {
    throw new TypeError(`${where}: sourceUrl must be an http(s) URL (got ${sourceUrl})`);
  }
  if (!CONFIDENCE.includes(confidence)) {
    throw new TypeError(`${where}: confidence must be one of ${CONFIDENCE.join(', ')} (got ${confidence})`);
  }
  if (note !== null && typeof note !== 'string') throw new TypeError(`${where}: note must be a string`);
  if (leapDay !== null && !dates.LEAP_DAY_RULES.includes(leapDay)) {
    throw new TypeError(`${where}: leapDay must be one of ${dates.LEAP_DAY_RULES.join(', ')}`);
  }
  if (attainment !== null && !dates.ATTAINMENT_RULES.includes(attainment)) {
    throw new TypeError(`${where}: attainment must be one of ${dates.ATTAINMENT_RULES.join(', ')}`);
  }
  return Object.freeze({ age, effectiveFrom, citation, sourceUrl, confidence, note, leapDay, attainment });
}

/**
 * Validate one table entry: a version, an array of versions (oldest first,
 * effective dates strictly increasing, only the first may omit one), or
 * `{ bySubdivision: true }` for a country that leaves the threshold to its
 * subdivisions.
 */
function normalizeEntry(where, entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && entry.bySubdivision !== undefined) {
    for (const key of Object.keys(entry)) {
      if (!SUBDIVISION_ENTRY_FIELDS.includes(key)) {
        throw new TypeError(`${where}: unknown field '${key}' on a bySubdivision entry`);
      }
    }
    if (entry.bySubdivision !== true) throw new TypeError(`${where}: bySubdivision must be true`);
    if (typeof entry.note !== 'string' || entry.note === '') {
      throw new TypeError(`${where}: a bySubdivision entry needs a note saying who sets the threshold`);
    }
    if (entry.citation !== undefined && (typeof entry.citation !== 'string' || entry.citation === '')) {
      throw new TypeError(`${where}: citation must be a non-empty string`);
    }
    if (entry.sourceUrl !== undefined && (typeof entry.sourceUrl !== 'string' || !/^https?:\/\/\S+$/.test(entry.sourceUrl))) {
      throw new TypeError(`${where}: sourceUrl must be an http(s) URL`);
    }
    return Object.freeze({
      bySubdivision: true,
      versions: Object.freeze([]),
      citation: entry.citation === undefined ? null : entry.citation,
      sourceUrl: entry.sourceUrl === undefined ? null : entry.sourceUrl,
      note: entry.note,
    });
  }
  const list = Array.isArray(entry) ? entry : [entry];
  if (list.length === 0) throw new TypeError(`${where}: needs at least one version`);
  const versions = list.map((version, index) => normalizeVersion(`${where}[${index}]`, version));
  for (let index = 1; index < versions.length; index += 1) {
    const previous = versions[index - 1].effectiveFrom;
    const current = versions[index].effectiveFrom;
    if (current === null) throw new TypeError(`${where}[${index}]: only the first version may omit effectiveFrom`);
    if (previous !== null && current <= previous) {
      throw new TypeError(`${where}[${index}]: effectiveFrom ${current} must be after ${previous}`);
    }
  }
  return Object.freeze({ bySubdivision: false, versions: Object.freeze(versions), citation: null, sourceUrl: null, note: null });
}

function normalizeTable(name, table) {
  const out = {};
  for (const code of Object.keys(table)) {
    const parsed = parseCode(`${name}: key '${code}'`, code);
    if (parsed.code !== code) {
      throw new TypeError(`${name}: key '${code}' must be written in its canonical form '${parsed.code}'`);
    }
    out[code] = normalizeEntry(`${name}['${code}']`, table[code]);
  }
  return deepFreeze(out);
}

// ── Jurisdictions ───────────────────────────────────────────────

const CODE_SHAPE = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/;

/**
 * Parse a code string into its canonical form.
 *
 *   'cz' → 'CZ'   'us-al' → 'US-AL'   'UK' → 'GB'   'US-PR' → 'PR'
 */
function parseCode(where, input) {
  const raw = input.trim().toUpperCase();
  const match = CODE_SHAPE.exec(raw);
  if (!match) {
    throw new TypeError(
      `${where}: '${input}' is not an ISO 3166-1 alpha-2 code ('CZ') or ISO 3166-2 code ('US-AL')`,
    );
  }
  return fromParts(where, input, match[1], match[2]);
}

function fromParts(where, input, countryInput, subdivisionInput) {
  const country = Object.prototype.hasOwnProperty.call(iso.ALIASES, countryInput)
    ? iso.ALIASES[countryInput] : countryInput;
  if (!iso.COUNTRIES.includes(country)) {
    throw new TypeError(`${where}: '${countryInput}' in '${input}' is not an assigned ISO 3166-1 alpha-2 country code`);
  }
  if (subdivisionInput === undefined || subdivisionInput === null) {
    return { code: country, country, subdivision: null };
  }
  const known = iso.SUBDIVISIONS[country];
  if (known && !known.includes(subdivisionInput)) {
    throw new TypeError(`${where}: '${country}-${subdivisionInput}' is not an ISO 3166-2 subdivision of ${country}`);
  }
  if (country === 'US' && iso.US_TERRITORIES.includes(subdivisionInput)) {
    return { code: subdivisionInput, country: subdivisionInput, subdivision: null };
  }
  const own = iso.OWN_CODES[`${country}-${subdivisionInput}`];
  if (own) return { code: own, country: own, subdivision: null };
  return { code: `${country}-${subdivisionInput}`, country, subdivision: subdivisionInput };
}

/**
 * Normalise any accepted jurisdiction form to its canonical code.
 *
 *   'cz'                                  → 'CZ'
 *   'US-AL', ' us-al '                    → 'US-AL'
 *   { country: 'CA', subdivision: 'BC' }  → 'CA-BC'
 *   { country: 'CA', subdivision: 'CA-BC' } → 'CA-BC'
 *   'UK' → 'GB', 'EL' → 'GR', 'US-PR' → 'PR'
 *
 * Anything else throws a TypeError: a jurisdiction that cannot be read is a
 * bug in the caller, and answering it as "unknown" would hide it.
 *
 * @param {string|{country: string, subdivision?: string|null}} jurisdiction
 * @returns {string}
 */
function normalizeJurisdiction(jurisdiction) {
  return parseJurisdiction('normalizeJurisdiction', jurisdiction).code;
}

function parseJurisdiction(where, input) {
  if (typeof input === 'string') return parseCode(where, input);
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const key of Object.keys(input)) {
      if (key !== 'country' && key !== 'subdivision') {
        throw new TypeError(`${where}: unknown jurisdiction field '${key}' (expected country, subdivision)`);
      }
    }
    // Own fields only: an inherited country is not something the caller passed.
    const own = (key) => (Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined);
    const country = own('country'); const subdivision = own('subdivision');
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country.trim().toUpperCase())) {
      throw new TypeError(`${where}: jurisdiction.country must be an ISO 3166-1 alpha-2 code (got ${dates.describe(country)})`);
    }
    const countryCode = country.trim().toUpperCase();
    if (subdivision === undefined || subdivision === null) {
      return fromParts(where, countryCode, countryCode, null);
    }
    if (typeof subdivision !== 'string') {
      throw new TypeError(`${where}: jurisdiction.subdivision must be a string (got ${dates.describe(subdivision)})`);
    }
    let sub = subdivision.trim().toUpperCase();
    const prefixed = /^([A-Z]{2})-(.*)$/.exec(sub);
    if (prefixed) {
      const subCountry = iso.ALIASES[prefixed[1]] || prefixed[1];
      const ownCountry = iso.ALIASES[countryCode] || countryCode;
      if (subCountry !== ownCountry) {
        throw new TypeError(`${where}: subdivision '${subdivision}' does not belong to country '${country}'`);
      }
      sub = prefixed[2];
    }
    if (!/^[A-Z0-9]{1,3}$/.test(sub)) {
      throw new TypeError(`${where}: '${subdivision}' is not an ISO 3166-2 subdivision code`);
    }
    return fromParts(where, `${countryCode}-${sub}`, countryCode, sub);
  }
  throw new TypeError(
    `${where}: jurisdiction must be a code string ('CZ', 'US-AL') or { country, subdivision } (got ${dates.describe(input)})`,
  );
}

// ── Lookup ──────────────────────────────────────────────────────

const TABLES = {
  [KINDS.MAJORITY]: normalizeTable('MAJORITY', data.MAJORITY),
  [KINDS.DIGITAL_CONSENT]: normalizeTable('DIGITAL_CONSENT', data.DIGITAL_CONSENT),
};

function tableFor(where, kind) {
  if (!Object.prototype.hasOwnProperty.call(TABLES, kind)) {
    throw new TypeError(`${where}: kind must be '${KINDS.MAJORITY}' or '${KINDS.DIGITAL_CONSENT}' (got ${dates.describe(kind)})`);
  }
  return TABLES[kind];
}

/**
 * Find the entry that answers for a place: its own, else its country's, else
 * (for a territory) the governing country's.
 *
 * A country whose entry is `bySubdivision` answers nothing itself: asked for
 * directly it reports SUBDIVISION_REQUIRED, and reached by falling back from a
 * subdivision it has no entry for, UNKNOWN_JURISDICTION.
 */
function findEntry(table, parsed) {
  const chain = [parsed.code];
  if (parsed.subdivision !== null) chain.push(parsed.country);
  if (Object.prototype.hasOwnProperty.call(iso.PARENTS, parsed.country)) chain.push(iso.PARENTS[parsed.country]);
  for (const code of chain) {
    if (!Object.prototype.hasOwnProperty.call(table, code)) continue;
    const entry = table[code];
    if (entry.bySubdivision) {
      return {
        entry: null, matched: null,
        status: code === parsed.code ? REASONS.SUBDIVISION_REQUIRED : REASONS.UNKNOWN_JURISDICTION,
      };
    }
    return { entry, matched: code, status: null };
  }
  return { entry: null, matched: null, status: REASONS.UNKNOWN_JURISDICTION };
}

/** The version in force on a date, or null before the first one. */
function versionAt(entry, dateString) {
  let found = null;
  for (const version of entry.versions) {
    if (version.effectiveFrom === null || version.effectiveFrom <= dateString) found = version;
  }
  return found;
}

/** The last day a version is in force (the day before the next one), or null. */
function versionEnd(entry, version) {
  const index = entry.versions.indexOf(version);
  const next = entry.versions[index + 1];
  if (!next) return null;
  return dates.formatDate(dates.fromDayNumber(dates.toDayNumber(dates.parseIsoDate(next.effectiveFrom)) - 1));
}

function describeVersion(kind, parsed, matched, entry, version) {
  return Object.freeze({
    kind,
    age: version.age,
    jurisdiction: parsed.code,
    matched,
    effectiveFrom: version.effectiveFrom,
    effectiveUntil: versionEnd(entry, version),
    citation: version.citation,
    sourceUrl: version.sourceUrl,
    confidence: version.confidence,
    note: version.note,
  });
}

function checkOptions(where, options, allowed) {
  if (options === undefined) return {};
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`${where}: options must be an object`);
  }
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`${where}: unknown option '${key}' (expected one of: ${allowed.join(', ')})`);
    }
  }
  return options;
}

function readTimeZone(where, timeZone) {
  if (timeZone === undefined) return undefined;
  if (typeof timeZone !== 'string' || timeZone === '') {
    throw new TypeError(`${where}: timeZone must be an IANA zone name`);
  }
  try {
    dates.zoneFormat(timeZone);
  } catch {
    throw new RangeError(`${where}: timeZone '${timeZone}' is not a time zone this runtime knows`);
  }
  return timeZone;
}

function lookup(where, kind, jurisdiction, options) {
  const opts = checkOptions(where, options, ['at', 'timeZone']);
  const table = tableFor(where, kind);
  const parsed = parseJurisdiction(where, jurisdiction);
  const timeZone = readTimeZone(where, opts.timeZone);
  const found = findEntry(table, parsed);
  // Today, or a Date, with no zone: answer only if every calendar day that
  // instant falls on somewhere gives the same rule. On the day a law changes
  // the zone matters, and the caller is asked for it rather than guessed at.
  let days;
  if (timeZone === undefined && (opts.at === undefined || dates.isDate(opts.at))) {
    const instant = opts.at === undefined ? new Date() : opts.at;
    if (Number.isNaN(instant.getTime())) throw new TypeError(`${where}: at is an invalid Date`);
    days = dates.daysAround(instant);
  } else {
    days = [dates.formatDate(dates.parseAt(`${where}: at`, opts.at, timeZone))];
  }
  if (!found.entry) return { parsed, result: null, status: found.status };
  const versions = new Set(days.map((d) => versionAt(found.entry, d)));
  if (versions.size > 1) {
    throw new TypeError(`${where}: the rule in ${parsed.code} changes on a day this instant falls on in some places; pass timeZone, or at as a 'YYYY-MM-DD' string`);
  }
  const [version] = versions;
  if (!version) return { parsed, result: null, status: REASONS.NO_RULE_IN_FORCE };
  return { parsed, result: describeVersion(kind, parsed, found.matched, found.entry, version), status: null };
}

/**
 * The threshold of either kind in force in a jurisdiction on a date.
 *
 * @param {string|{country: string, subdivision?: string|null}} jurisdiction
 * @param {'majority'|'digitalConsent'} kind
 * @param {{at?: string|Date, timeZone?: string}} [options]
 * @returns {Readonly<object>|null} null when the tables hold no answer
 */
function threshold(jurisdiction, kind, options) {
  return lookup('threshold', kind, jurisdiction, options).result;
}

/**
 * The age of majority in force in a jurisdiction on a date (default today).
 *
 * @param {string|{country: string, subdivision?: string|null}} jurisdiction
 * @param {{at?: string|Date, timeZone?: string}} [options]
 * @returns {Readonly<object>|null}
 */
function ageOfMajority(jurisdiction, options) {
  return lookup('ageOfMajority', KINDS.MAJORITY, jurisdiction, options).result;
}

/**
 * The age from which a person may consent alone to an online service
 * processing their personal data, in force in a jurisdiction on a date.
 *
 * @param {string|{country: string, subdivision?: string|null}} jurisdiction
 * @param {{at?: string|Date, timeZone?: string}} [options]
 * @returns {Readonly<object>|null}
 */
function digitalConsentAge(jurisdiction, options) {
  return lookup('digitalConsentAge', KINDS.DIGITAL_CONSENT, jurisdiction, options).result;
}

// ── People ──────────────────────────────────────────────────────

function readRules(where, opts, version) {
  const leapDay = opts.leapDay !== undefined ? opts.leapDay : (version && version.leapDay) || 'mar1';
  const attainment = opts.attainment !== undefined ? opts.attainment : (version && version.attainment) || 'anniversary';
  if (!dates.LEAP_DAY_RULES.includes(leapDay)) {
    throw new TypeError(`${where}: leapDay must be one of ${dates.LEAP_DAY_RULES.join(', ')} (got ${dates.describe(leapDay)})`);
  }
  if (!dates.ATTAINMENT_RULES.includes(attainment)) {
    throw new TypeError(`${where}: attainment must be one of ${dates.ATTAINMENT_RULES.join(', ')} (got ${dates.describe(attainment)})`);
  }
  return { leapDay, attainment };
}

/**
 * The first day from which a person is at or above the threshold and stays
 * there under every later version of the rule.
 *
 * Each version covers [effectiveFrom, next effectiveFrom); within it the
 * person is at or above the threshold from the day they attain its age. The
 * answer is the start of the last unbroken run of such days. A first version
 * without a date reaches back indefinitely. A first version with one does
 * not: if the run starts on that date because the person had already
 * attained its age, nothing is recorded about when they really crossed the
 * threshold (it may have been earlier, under an older rule), and the answer
 * is null rather than a guess.
 *
 * @returns {number|null} day number
 */
function reachesThreshold(entry, birth, opts, where) {
  let runStart = null;
  let runEnd = null; // exclusive; null = open-ended
  const spans = [];
  const first = entry.versions[0];
  const firstFrom = first.effectiveFrom === null ? -Infinity : dates.toDayNumber(dates.parseIsoDate(first.effectiveFrom));
  entry.versions.forEach((version, index) => {
    const from = index === 0 ? firstFrom : dates.toDayNumber(dates.parseIsoDate(version.effectiveFrom));
    const next = entry.versions[index + 1];
    const to = next ? dates.toDayNumber(dates.parseIsoDate(next.effectiveFrom)) : Infinity;
    const attained = dates.attainedOn(birth, version.age, readRules(where, opts, version));
    const start = Math.max(from, attained);
    if (start < to) spans.push([start, to]);
  });
  for (const [start, end] of spans) {
    if (runStart !== null && runEnd === start) {
      runEnd = end;
    } else {
      runStart = start;
      runEnd = end;
    }
  }
  if (runEnd !== Infinity) return null;
  if (runStart === firstFrom && Number.isFinite(firstFrom) && dates.attainedOn(birth, first.age, readRules(where, opts, first)) < firstFrom) return null;
  return runStart;
}

function evaluatePerson(where, kind, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new TypeError(`${where}: expected { birthDate, jurisdiction, at? }`);
  }
  const opts = checkOptions(where, args, ['birthDate', 'jurisdiction', 'at', 'timeZone', 'leapDay', 'attainment']);
  if (opts.birthDate === undefined) throw new TypeError(`${where}: birthDate is required`);
  if (opts.jurisdiction === undefined) throw new TypeError(`${where}: jurisdiction is required`);
  const table = tableFor(where, kind);
  const parsed = parseJurisdiction(where, opts.jurisdiction);
  const birth = dates.parseBirthDate(`${where}: birthDate`, opts.birthDate);
  const atDate = dates.parseAt(`${where}: at`, opts.at, readTimeZone(where, opts.timeZone));
  const at = dates.toDayNumber(atDate);
  if (at < dates.toDayNumber(birth)) {
    throw new RangeError(`${where}: at (${dates.formatDate(atDate)}) is before birthDate (${dates.formatDate(birth)})`);
  }
  const atString = dates.formatDate(atDate);
  const base = { jurisdiction: parsed.code, at: atString };

  const found = findEntry(table, parsed);
  const version = found.entry ? versionAt(found.entry, atString) : null;
  const rules = readRules(where, opts, version);
  const age = dates.completedYears(birth, at, rules);
  if (!found.entry) return { ...base, decided: null, age, status: found.status, threshold: null, reaches: null };
  if (!version) {
    return { ...base, decided: null, age, status: REASONS.NO_RULE_IN_FORCE, threshold: null, reaches: null };
  }
  const reachedDay = reachesThreshold(found.entry, birth, opts, where);
  const below = age < version.age;
  return {
    ...base,
    decided: below,
    age,
    status: below ? REASONS.BELOW_THRESHOLD : REASONS.AT_OR_ABOVE_THRESHOLD,
    threshold: describeVersion(kind, parsed, found.matched, found.entry, version),
    reaches: reachedDay === null ? null : dates.formatDate(dates.fromDayNumber(reachedDay)),
  };
}

/**
 * Is this person a minor in this jurisdiction on this date?
 *
 * `minor` is null — not false — when the tables hold no answer: an unknown
 * jurisdiction is not evidence of adulthood.
 *
 * @param {{
 *   birthDate: string|Date,
 *   jurisdiction: string|{country: string, subdivision?: string|null},
 *   at?: string|Date,
 *   timeZone?: string,
 *   leapDay?: 'mar1'|'feb28',
 *   attainment?: 'anniversary'|'dayBefore',
 * }} args
 */
function isMinor(args) {
  const out = evaluatePerson('isMinor', KINDS.MAJORITY, args);
  return Object.freeze({
    minor: out.decided,
    age: out.age,
    majorityAge: out.threshold ? out.threshold.age : null,
    minorUntil: out.reaches,
    reason: out.status,
    jurisdiction: out.jurisdiction,
    at: out.at,
    rule: out.threshold,
  });
}

/**
 * Does an online service need a parent's consent to process this person's
 * data on a consent basis (GDPR Art. 8, COPPA and their equivalents)?
 *
 * @param {{
 *   birthDate: string|Date,
 *   jurisdiction: string|{country: string, subdivision?: string|null},
 *   at?: string|Date,
 *   timeZone?: string,
 *   leapDay?: 'mar1'|'feb28',
 *   attainment?: 'anniversary'|'dayBefore',
 * }} args
 */
function needsParentalConsent(args) {
  const out = evaluatePerson('needsParentalConsent', KINDS.DIGITAL_CONSENT, args);
  return Object.freeze({
    required: out.decided,
    age: out.age,
    consentAge: out.threshold ? out.threshold.age : null,
    canConsentFrom: out.reaches,
    reason: out.status,
    jurisdiction: out.jurisdiction,
    at: out.at,
    rule: out.threshold,
  });
}

/**
 * The date a person reaches the age of majority in a jurisdiction, as
 * 'YYYY-MM-DD' — the first day they are no longer a minor, under the rules
 * as they stand in the tables. Null when the tables hold no answer.
 *
 * @param {string|Date} birthDate
 * @param {string|{country: string, subdivision?: string|null}} jurisdiction
 * @param {{leapDay?: 'mar1'|'feb28', attainment?: 'anniversary'|'dayBefore'}} [options]
 * @returns {string|null}
 */
function minorUntil(birthDate, jurisdiction, options) {
  const where = 'minorUntil';
  const opts = checkOptions(where, options, ['leapDay', 'attainment']);
  readRules(where, opts, null);
  const parsed = parseJurisdiction(where, jurisdiction);
  const birth = dates.parseBirthDate(`${where}: birthDate`, birthDate);
  const found = findEntry(TABLES[KINDS.MAJORITY], parsed);
  if (!found.entry) return null;
  const day = reachesThreshold(found.entry, birth, opts, where);
  return day === null ? null : dates.formatDate(dates.fromDayNumber(day));
}

/**
 * Completed years of age on a date (default today, UTC).
 *
 * @param {string|Date} birthDate
 * @param {{at?: string|Date, timeZone?: string, leapDay?: 'mar1'|'feb28', attainment?: 'anniversary'|'dayBefore'}} [options]
 * @returns {number}
 */
function ageOn(birthDate, options) {
  const where = 'ageOn';
  const opts = checkOptions(where, options, ['at', 'timeZone', 'leapDay', 'attainment']);
  const birth = dates.parseBirthDate(`${where}: birthDate`, birthDate);
  const atDate = dates.parseAt(`${where}: at`, opts.at, readTimeZone(where, opts.timeZone));
  const at = dates.toDayNumber(atDate);
  if (at < dates.toDayNumber(birth)) {
    throw new RangeError(`${where}: at (${dates.formatDate(atDate)}) is before birthDate (${dates.formatDate(birth)})`);
  }
  return dates.completedYears(birth, at, readRules(where, opts, null));
}

/**
 * The highest threshold of a kind across several jurisdictions — for a person
 * tied to more than one place (lives in one, is served from another).
 *
 * `age` is null if ANY jurisdiction is unknown: the unknown one might be the
 * strictest, so no answer can be certified. `governing` still names the
 * strictest of the known ones, and `unknown` lists the rest. Ties go to the
 * earliest in the input.
 *
 * @param {Array<string|{country: string, subdivision?: string|null}>} jurisdictions
 * @param {'majority'|'digitalConsent'} kind
 * @param {{at?: string|Date, timeZone?: string}} [options]
 */
function strictest(jurisdictions, kind, options) {
  const where = 'strictest';
  if (!Array.isArray(jurisdictions) || jurisdictions.length === 0) {
    throw new TypeError(`${where}: jurisdictions must be a non-empty array`);
  }
  tableFor(where, kind);
  const results = [];
  const unknown = [];
  let governing = null;
  for (const jurisdiction of jurisdictions) {
    const { parsed, result, status } = lookup(where, kind, jurisdiction, options);
    results.push(result);
    if (result === null) {
      if (!unknown.some((u) => u.jurisdiction === parsed.code)) unknown.push(Object.freeze({ jurisdiction: parsed.code, reason: status }));
    } else if (governing === null || result.age > governing.age) {
      governing = result;
    }
  }
  return Object.freeze({
    kind,
    age: unknown.length === 0 && governing ? governing.age : null,
    governing,
    unknown: Object.freeze(unknown),
    results: Object.freeze(results),
  });
}

/**
 * Every code with an answer of its own in a table (a country that leaves the
 * question to its subdivisions, such as 'US' for majority, is not listed).
 *
 * @param {'majority'|'digitalConsent'} kind
 * @returns {string[]}
 */
function jurisdictions(kind) {
  const table = tableFor('jurisdictions', kind);
  return Object.keys(table).filter((code) => !table[code].bySubdivision).sort();
}

const MAJORITY = TABLES[KINDS.MAJORITY];
const DIGITAL_CONSENT = TABLES[KINDS.DIGITAL_CONSENT];
const AS_OF = data.AS_OF;

// Plain identifiers only: Node's cjs-module-lexer detects named exports
// written this way, which is what lets `import { isMinor } from
// 'age-of-majority'` work from ESM.
module.exports = {
  ageOfMajority,
  digitalConsentAge,
  threshold,
  isMinor,
  needsParentalConsent,
  minorUntil,
  ageOn,
  strictest,
  normalizeJurisdiction,
  jurisdictions,

  MAJORITY,
  DIGITAL_CONSENT,
  AS_OF,
  KINDS,
  REASONS,
};
