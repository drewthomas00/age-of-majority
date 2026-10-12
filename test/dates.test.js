/**
 * Pins the calendar arithmetic: completed years, the leap-day rules, the
 * common-law day-before rule, and the refusal to let a clock move a birthday.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { ageOn } = require('..');
const dates = require('../dates');

describe('ageOn — ordinary birthdays', () => {
  it('counts completed years, attaining each at the start of the anniversary', () => {
    assert.equal(ageOn('2008-03-14', { at: '2026-03-13' }), 17);
    assert.equal(ageOn('2008-03-14', { at: '2026-03-14' }), 18);
    assert.equal(ageOn('2008-03-14', { at: '2026-03-15' }), 18);
  });

  it('is 0 on the day of birth and across the first year', () => {
    assert.equal(ageOn('2026-01-01', { at: '2026-01-01' }), 0);
    assert.equal(ageOn('2026-01-01', { at: '2026-12-31' }), 0);
    assert.equal(ageOn('2026-01-01', { at: '2027-01-01' }), 1);
  });

  it('handles year boundaries in both directions', () => {
    assert.equal(ageOn('2000-12-31', { at: '2018-12-30' }), 17);
    assert.equal(ageOn('2000-12-31', { at: '2018-12-31' }), 18);
    assert.equal(ageOn('2000-01-01', { at: '2017-12-31' }), 17);
    assert.equal(ageOn('2000-01-01', { at: '2018-01-01' }), 18);
  });

  it('works for years below 100, which Date.UTC would remap to the 1900s', () => {
    assert.equal(ageOn('0050-06-01', { at: '0068-06-01' }), 18);
    assert.equal(ageOn('0050-06-01', { at: '0068-05-31' }), 17);
  });

  it('refuses an evaluation date before the birth', () => {
    assert.throws(() => ageOn('2010-05-05', { at: '2010-05-04' }), RangeError);
  });
});

describe('ageOn — 29 February births', () => {
  it("attain each age on 1 March in a common year by default (28 February must end first)", () => {
    assert.equal(ageOn('2008-02-29', { at: '2026-02-28' }), 17);
    assert.equal(ageOn('2008-02-29', { at: '2026-03-01' }), 18);
  });

  it('attain it on 29 February itself in a leap year', () => {
    assert.equal(ageOn('2004-02-29', { at: '2024-02-28' }), 19);
    assert.equal(ageOn('2004-02-29', { at: '2024-02-29' }), 20);
  });

  it("attain it on 28 February under leapDay: 'feb28'", () => {
    assert.equal(ageOn('2008-02-29', { at: '2026-02-27', leapDay: 'feb28' }), 17);
    assert.equal(ageOn('2008-02-29', { at: '2026-02-28', leapDay: 'feb28' }), 18);
  });

  it('treat 1900 and 2100 as common years and 2000 as a leap year', () => {
    assert.equal(dates.isLeapYear(1900), false);
    assert.equal(dates.isLeapYear(2000), true);
    assert.equal(dates.isLeapYear(2100), false);
    assert.equal(ageOn('2084-02-29', { at: '2100-02-28' }), 15);
    assert.equal(ageOn('2084-02-29', { at: '2100-03-01' }), 16);
    assert.equal(ageOn('1980-02-29', { at: '2000-02-29' }), 20);
  });

  it('do not change anything for a 28 February or 1 March birth', () => {
    assert.equal(ageOn('2008-02-28', { at: '2026-02-28', leapDay: 'mar1' }), 18);
    assert.equal(ageOn('2008-03-01', { at: '2026-02-28', leapDay: 'feb28' }), 17);
  });
});

describe("ageOn — the common-law 'dayBefore' rule", () => {
  it('attains an age on the day before the anniversary', () => {
    assert.equal(ageOn('2008-03-14', { at: '2026-03-12', attainment: 'dayBefore' }), 17);
    assert.equal(ageOn('2008-03-14', { at: '2026-03-13', attainment: 'dayBefore' }), 18);
  });

  it('can attain an age in the previous calendar year (1 January birthday)', () => {
    assert.equal(ageOn('2008-01-01', { at: '2025-12-30', attainment: 'dayBefore' }), 17);
    assert.equal(ageOn('2008-01-01', { at: '2025-12-31', attainment: 'dayBefore' }), 18);
  });

  it('combines with the leap-day rule', () => {
    // mar1 → day before is 28 February; feb28 → day before is 27 February.
    assert.equal(ageOn('2008-02-29', { at: '2026-02-28', attainment: 'dayBefore' }), 18);
    assert.equal(ageOn('2008-02-29', { at: '2026-02-27', attainment: 'dayBefore' }), 17);
    assert.equal(ageOn('2008-02-29', { at: '2026-02-27', attainment: 'dayBefore', leapDay: 'feb28' }), 18);
  });
});

describe('ageOn — exhaustive cross-check', () => {
  // An independent, deliberately naive implementation: walk the calendar a
  // day at a time and bump the age whenever the anniversary is reached.
  function naiveAges(birth, years) {
    const out = new Map();
    let age = 0;
    const start = dates.toDayNumber(dates.parseIsoDate(birth));
    const b = dates.parseIsoDate(birth);
    for (let day = start; day < start + years * 366; day += 1) {
      const d = dates.fromDayNumber(day);
      const leapBirth = b.month === 2 && b.day === 29;
      const isAnniversary = d.year > b.year && (
        (d.month === b.month && d.day === b.day)
        || (leapBirth && !dates.isLeapYear(d.year) && d.month === 3 && d.day === 1));
      if (isAnniversary) age += 1;
      out.set(dates.formatDate(d), age);
    }
    return out;
  }

  for (const birth of ['2000-02-29', '2001-03-01', '1999-12-31', '2003-01-01', '2004-02-28']) {
    it(`matches a day-by-day walk for ${birth}`, () => {
      for (const [at, expected] of naiveAges(birth, 21)) {
        assert.equal(ageOn(birth, { at }), expected, `${birth} on ${at}`);
      }
    });
  }
});

describe('date inputs', () => {
  it('accepts a Date at midnight UTC as a birth date', () => {
    assert.equal(ageOn(new Date('2008-03-14'), { at: '2026-03-14' }), 18);
  });

  it('refuses a birth Date that is not midnight UTC, rather than guess its calendar day', () => {
    assert.throws(() => ageOn(new Date('2008-03-14T05:00:00Z'), { at: '2026-03-14' }), /not midnight UTC/);
  });

  it('reads an `at` Date on the given timeZone calendar', () => {
    const instant = new Date('2026-03-14T02:00:00Z'); // 13 March in New York
    assert.throws(() => ageOn('2008-03-14', { at: instant }), /pass timeZone/);
    assert.equal(ageOn('2008-03-14', { at: instant, timeZone: 'UTC' }), 18);
    assert.equal(ageOn('2008-03-14', { at: instant, timeZone: 'America/New_York' }), 17);
    assert.equal(ageOn('2008-03-14', { at: new Date('2026-03-13T12:00:00Z'), timeZone: 'Pacific/Kiritimati' }), 18);
  });

  it('defaults `at` to today, in the zone given', () => {
    assert.equal(typeof ageOn('2000-01-01', { timeZone: 'Europe/Prague' }), 'number');
    assert.throws(() => ageOn('2000-01-01'), /pass timeZone/);
  });

  for (const bad of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '24-01-01', '2024-1-1',
    '2024-01-01T00:00:00Z', '0000-01-01', '', 20240101, null, [], {}]) {
    it(`rejects ${JSON.stringify(bad)} as a birth date`, () => {
      assert.throws(() => ageOn(bad, { at: '2026-01-01' }), TypeError);
    });
  }

  it('rejects an invalid Date', () => {
    assert.throws(() => ageOn(new Date('nope'), { at: '2026-01-01' }), TypeError);
    assert.throws(() => ageOn('2000-01-01', { at: new Date('nope') }), TypeError);
  });

  it('rejects an unknown timeZone loudly', () => {
    assert.throws(() => ageOn('2000-01-01', { at: new Date(), timeZone: 'Mars/Olympus' }), RangeError);
  });

  it('rejects unknown options and bad rule names', () => {
    assert.throws(() => ageOn('2000-01-01', { on: '2020-01-01' }), /unknown option 'on'/);
    assert.throws(() => ageOn('2000-01-01', { leapDay: 'feb29' }), TypeError);
    assert.throws(() => ageOn('2000-01-01', { attainment: 'birthday' }), TypeError);
  });
});
