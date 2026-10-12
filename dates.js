'use strict';

/**
 * Calendar dates without clocks.
 *
 * A birth date is a calendar date, not an instant: someone born on
 * 2008-03-14 was born on that date wherever they now live. Everything here
 * works on proleptic-Gregorian `{ year, month, day }` triples and on day
 * numbers (days since 1970-01-01), so the host's timezone can never move a
 * birthday by a day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** How a leap-day birth is anniversaried in a common year. */
const LEAP_DAY_RULES = Object.freeze(['mar1', 'feb28']);

/** When, relative to the anniversary, an age is attained. */
const ATTAINMENT_RULES = Object.freeze(['anniversary', 'dayBefore']);

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Day number (days since 1970-01-01) of a calendar date.
 *
 * `Date.UTC` maps years 0–99 onto 1900–1999, so the year is set separately.
 */
function toDayNumber({ year, month, day }) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.round(date.getTime() / MS_PER_DAY);
}

function fromDayNumber(dayNumber) {
  const date = new Date(dayNumber * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function formatDate({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a strict 'YYYY-MM-DD' string. Returns null for anything else,
 * including dates that do not exist ('2023-02-29', '2024-13-01').
 */
function parseIsoDate(value) {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** One formatter per zone: building one costs far more than using it. */
const FORMATS = new Map();

/** Is `value` a Date, from this realm or another (a vm context, an iframe)? */
function isDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * A formatter that reads an instant on `timeZone`'s calendar; throws a
 * RangeError for a zone the runtime does not know.
 */
function zoneFormat(timeZone) {
  let format = FORMATS.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone, calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: 'numeric', day: 'numeric', era: 'short',
    });
    FORMATS.set(timeZone, format);
  }
  return format;
}

/** The calendar date of an instant, read on a zone's wall clock. */
function dateInZone(instant, timeZone) {
  const parts = zoneFormat(timeZone).formatToParts(instant);
  const read = (type) => parts.find((part) => part.type === type);
  const year = Number(read('year').value);
  const era = read('era');
  if (era && /^B/i.test(era.value)) {
    throw new RangeError(`date before year 1 is not supported (got ${instant.toISOString()})`);
  }
  if (year > 9999) throw new RangeError(`date after year 9999 is not supported (got ${instant.toISOString()})`);
  return { year, month: Number(read('month').value), day: Number(read('day').value) };
}

/**
 * Every calendar day an instant falls on somewhere on Earth (UTC−12 to
 * UTC+14): two or three days, as 'YYYY-MM-DD', earliest first.
 */
function daysAround(instant) {
  const first = toDayNumber(dateInZone(instant, 'Etc/GMT+12'));
  const last = toDayNumber(dateInZone(instant, 'Etc/GMT-14'));
  const out = [];
  for (let d = first; d <= last; d += 1) out.push(formatDate(fromDayNumber(d)));
  return out;
}

/**
 * Read a birth date: a 'YYYY-MM-DD' string, or a Date at exactly midnight UTC
 * (what `new Date('2008-03-14')` produces).
 *
 * A Date at any other time is refused rather than rounded. `new Date(2008, 2, 14)`
 * is local midnight, which is 2008-03-13 in UTC east of Greenwich; picking one
 * reading would silently move the birthday by a day for half the planet.
 *
 * @param {string} where - prefix for error messages
 * @param {string|Date} value
 */
function parseBirthDate(where, value) {
  if (typeof value === 'string') {
    const parsed = parseIsoDate(value);
    if (!parsed) throw new TypeError(`${where} must be a real calendar date as 'YYYY-MM-DD' (got '${value}')`);
    return parsed;
  }
  if (isDate(value)) {
    if (Number.isNaN(value.getTime())) throw new TypeError(`${where} is an invalid Date`);
    if (value.getTime() % MS_PER_DAY !== 0) {
      throw new TypeError(
        `${where} is a Date that is not midnight UTC (${value.toISOString()}); `
        + "pass the calendar date as 'YYYY-MM-DD' instead, so no timezone can move it",
      );
    }
    const date = fromDayNumber(value.getTime() / MS_PER_DAY);
    if (date.year < 1 || date.year > 9999) throw new RangeError(`${where} is outside years 1 to 9999`);
    return date;
  }
  throw new TypeError(`${where} must be a 'YYYY-MM-DD' string or a Date (got ${describe(value)})`);
}

/**
 * Read the date to evaluate on: a 'YYYY-MM-DD' string (taken as given), a Date
 * (read on `timeZone`'s calendar), or undefined (today, on `timeZone`'s
 * calendar). A Date or "today" needs the zone: which calendar day an instant
 * falls on depends on where the person is, and a day decides a birthday.
 *
 * @param {string} where
 * @param {string|Date|undefined} value
 * @param {string|undefined} timeZone - IANA zone
 */
function parseAt(where, value, timeZone) {
  if ((value === undefined || isDate(value)) && timeZone === undefined) {
    throw new TypeError(
      `${where}: ${value === undefined ? 'today' : 'a Date'} is a different calendar day in different places; `
      + "pass timeZone (e.g. 'America/Chicago'), or pass at as a 'YYYY-MM-DD' string",
    );
  }
  if (value === undefined) return dateInZone(new Date(), /** @type {string} */ (timeZone));
  if (typeof value === 'string') {
    const parsed = parseIsoDate(value);
    if (!parsed) throw new TypeError(`${where} must be a real calendar date as 'YYYY-MM-DD' (got '${value}')`);
    return parsed;
  }
  if (isDate(value)) {
    if (Number.isNaN(value.getTime())) throw new TypeError(`${where} is an invalid Date`);
    return dateInZone(value, /** @type {string} */ (timeZone));
  }
  throw new TypeError(`${where} must be a 'YYYY-MM-DD' string or a Date (got ${describe(value)})`);
}

/**
 * The anniversary of a date, `years` later.
 *
 * A 29 February birth has no anniversary in a common year. With 'mar1' (the
 * default) it falls on 1 March, the day after 28 February — the person has not
 * lived the full number of years until 28 February is over. With 'feb28' it
 * falls on 28 February, the last day of the same month.
 *
 * @returns {number} day number
 */
function anniversary(birth, years, leapDay) {
  const year = birth.year + years;
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return toDayNumber(leapDay === 'feb28' ? { year, month: 2, day: 28 } : { year, month: 3, day: 1 });
  }
  return toDayNumber({ year, month: birth.month, day: birth.day });
}

/**
 * The day on which `years` of age is attained.
 *
 * 'anniversary' — at the first moment of the anniversary, the modern statutory
 * rule. 'dayBefore' — the old common-law rule, under which an age is attained
 * on the day before the anniversary (the law takes no notice of fractions of a
 * day, and the last day of the period is already begun).
 *
 * @returns {number} day number
 */
function attainedOn(birth, years, { leapDay, attainment }) {
  const day = anniversary(birth, years, leapDay);
  return attainment === 'dayBefore' ? day - 1 : day;
}

/** Completed years of age on day number `on`, under the given rules. */
function completedYears(birth, on, rules) {
  const onDate = fromDayNumber(on);
  let years = onDate.year - birth.year;
  // At most one step back is ever needed: the attainment day for `years`
  // lies within a day of the anniversary, which lies in `onDate.year`.
  while (years > 0 && attainedOn(birth, years, rules) > on) years -= 1;
  if (years < 0) years = 0;
  // The 'dayBefore' rule can put the attainment of `years + 1` on the last
  // day of `onDate.year` (a 1 January birthday).
  while (attainedOn(birth, years + 1, rules) <= on) years += 1;
  return years;
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (isDate(value)) return 'a Date';
  return typeof value === 'string' ? `'${value}'` : typeof value;
}

module.exports = {
  zoneFormat,
  isDate,
  daysAround,
  LEAP_DAY_RULES,
  ATTAINMENT_RULES,
  isLeapYear,
  toDayNumber,
  fromDayNumber,
  formatDate,
  parseIsoDate,
  parseBirthDate,
  parseAt,
  attainedOn,
  completedYears,
  describe,
};
