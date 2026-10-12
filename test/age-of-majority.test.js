/**
 * Pins the bundled tables and the lookups over them: every entry is
 * well-formed, the thresholds bite on the right day, dated changes switch on
 * their date, leap-day statutes are honoured, and an unknown place is never
 * answered as an adult.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const aom = require('..');

const {
  ageOfMajority, digitalConsentAge, threshold, isMinor, needsParentalConsent, minorUntil,
  strictest, normalizeJurisdiction, jurisdictions, MAJORITY, DIGITAL_CONSENT, AS_OF, KINDS, REASONS,
} = aom;

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const EEA = ['IS', 'LI', 'NO'];

function allVersions(table) {
  const out = [];
  for (const [code, entry] of Object.entries(table)) {
    entry.versions.forEach((version, index) => out.push({ code, index, version, entry }));
  }
  return out;
}

describe('the bundled tables', () => {
  it('record the date they were checked', () => {
    assert.equal(AS_OF, '2026-10-11');
  });

  for (const [name, table] of [['MAJORITY', MAJORITY], ['DIGITAL_CONSENT', DIGITAL_CONSENT]]) {
    it(`${name}: every key is a canonical code`, () => {
      for (const code of Object.keys(table)) assert.equal(normalizeJurisdiction(code), code);
    });

    it(`${name}: every version is complete, cited and linked`, () => {
      for (const { code, index, version } of allVersions(table)) {
        const where = `${name}['${code}'][${index}]`;
        assert.ok(Number.isInteger(version.age) && version.age >= 12 && version.age <= 21, `${where} age`);
        assert.ok(typeof version.citation === 'string' && version.citation.trim().length > 3, `${where} citation`);
        assert.match(version.sourceUrl, /^https?:\/\/[^\s]+$/, `${where} sourceUrl`);
        const url = new URL(version.sourceUrl);
        assert.ok(url.hostname.includes('.'), `${where} sourceUrl host`);
        assert.ok(['high', 'medium'].includes(version.confidence), `${where} confidence`);
        assert.ok(version.note === null || version.note.length > 0, `${where} note`);
        if (version.effectiveFrom !== null) assert.match(version.effectiveFrom, /^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it(`${name}: a country left to its subdivisions says so, and has some`, () => {
      for (const [code, entry] of Object.entries(table)) {
        if (!entry.bySubdivision) {
          assert.ok(entry.versions.length > 0, code);
          continue;
        }
        assert.equal(entry.versions.length, 0);
        assert.ok(entry.note.length > 0);
        assert.ok(Object.keys(table).some((key) => key.startsWith(`${code}-`)), `${code} has no subdivisions`);
      }
    });
  }

  it('hold 18 for majority everywhere except the places pinned here', () => {
    const notEighteen = {};
    for (const [code, entry] of Object.entries(MAJORITY)) {
      if (entry.bySubdivision) continue;
      const current = entry.versions[entry.versions.length - 1];
      if (current.age !== 18) notEighteen[code] = current.age;
    }
    assert.deepEqual(notEighteen, {
      'US-AL': 19, 'US-NE': 19, 'US-MS': 21, PR: 21,
      'CA-BC': 19, 'CA-NB': 19, 'CA-NL': 19, 'CA-NS': 19, 'CA-NT': 19, 'CA-NU': 19, 'CA-YT': 19,
      NZ: 20, KR: 19, TH: 20, EG: 21,
    });
  });

  it('cover every US state and DC, every Canadian province and territory, and every Australian state', () => {
    for (const s of ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IA', 'KS',
      'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NY', 'NC', 'ND', 'OH', 'OK',
      'OR', 'PA', 'RI', 'SC', 'SD', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'IN', 'NJ', 'NM', 'TN']) {
      assert.ok(ageOfMajority(`US-${s}`), `US-${s}`);
    }
    const states = jurisdictions('majority').filter((code) => /^US-/.test(code));
    assert.equal(states.length, 51, 'the 50 states and DC');
    for (const p of ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']) {
      assert.ok(ageOfMajority(`CA-${p}`), `CA-${p}`);
    }
    for (const s of ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']) {
      assert.equal(ageOfMajority(`AU-${s}`).age, 18, `AU-${s}`);
    }
  });

  it('give every EU and EEA state and the UK a digital-consent age between 13 and 16', () => {
    for (const code of [...EU, ...EEA, 'GB']) {
      const rule = digitalConsentAge(code, { at: AS_OF });
      assert.ok(rule, code);
      assert.ok(rule.age >= 13 && rule.age <= 16, `${code}: ${rule.age}`);
    }
    assert.equal(digitalConsentAge('DE', { at: AS_OF }).age, 16);
    assert.equal(digitalConsentAge('AT', { at: AS_OF }).age, 14);
    assert.equal(digitalConsentAge('FR', { at: AS_OF }).age, 15);
    assert.equal(digitalConsentAge('BE', { at: AS_OF }).age, 13);
  });
});

describe('isMinor — the day before, of and after the threshold', () => {
  const cases = [
    ['US-AL', 19, '2007-05-10'],
    ['US-MS', 21, '2005-05-10'],
    ['CA-BC', 19, '2007-05-10'],
    ['NZ', 20, '2006-05-10'],
    ['US-TX', 18, '2008-05-10'],
    ['US-IN', 18, '2008-05-10'],
    ['US-NJ', 18, '2008-05-10'],
    ['US-NM', 18, '2008-05-10'],
    ['US-TN', 18, '2008-05-10'],
  ];
  for (const [jurisdiction, age, birthDate] of cases) {
    it(`${jurisdiction}: majority at ${age}`, () => {
      const [y, m, d] = birthDate.split('-');
      const day = (n) => `${Number(y) + age}-${m}-${String(Number(d) + n).padStart(2, '0')}`;
      const before = isMinor({ birthDate, jurisdiction, at: day(-1) });
      const on = isMinor({ birthDate, jurisdiction, at: day(0) });
      const after = isMinor({ birthDate, jurisdiction, at: day(1) });
      assert.equal(before.minor, true);
      assert.equal(before.age, age - 1);
      assert.equal(before.reason, REASONS.BELOW_THRESHOLD);
      assert.equal(on.minor, false);
      assert.equal(on.age, age);
      assert.equal(on.reason, REASONS.AT_OR_ABOVE_THRESHOLD);
      assert.equal(after.minor, false);
      for (const result of [before, on, after]) {
        assert.equal(result.majorityAge, age);
        assert.equal(result.minorUntil, day(0));
        assert.equal(result.rule.matched, jurisdiction);
      }
      assert.equal(minorUntil(birthDate, jurisdiction), day(0));
    });
  }

  it('Indiana, New Jersey, New Mexico and Tennessee: 18, each cited to its own provision', () => {
    const expected = {
      'US-IN': 'Ind. Code § 1-1-4-5', 'US-NJ': 'N.J.S.A. 9:17B-3', 'US-NM': 'N.M. Stat. Ann. § 28-6-1', 'US-TN': 'Tenn. Code Ann. § 1-3-105',
    };
    for (const [code, citation] of Object.entries(expected)) {
      const rule = ageOfMajority(code, { at: AS_OF });
      assert.equal(rule.age, 18, code);
      assert.equal(rule.matched, code);
      assert.ok(rule.citation.startsWith(citation), `${code}: ${rule.citation}`);
      assert.equal(rule.confidence, 'medium', code);
    }
  });

  it('a person of 18 in Mississippi is a minor; the same person in Czechia is not', () => {
    const args = { birthDate: '2008-01-15', at: '2026-10-11' };
    assert.equal(isMinor({ ...args, jurisdiction: 'US-MS' }).minor, true);
    assert.equal(isMinor({ ...args, jurisdiction: 'CZ' }).minor, false);
  });
});

describe('effective-dated changes', () => {
  it('Japan: 20 until 2022-03-31, 18 from 2022-04-01 — 18- and 19-year-olds came of age that day', () => {
    assert.equal(ageOfMajority('JP', { at: '2022-03-31' }).age, 20);
    assert.equal(ageOfMajority('JP', { at: '2022-03-31' }).effectiveUntil, '2022-03-31');
    assert.equal(ageOfMajority('JP', { at: '2022-04-01' }).age, 18);
    assert.equal(ageOfMajority('JP', { at: '2022-04-01' }).effectiveFrom, '2022-04-01');
    const birthDate = '2003-06-01';
    assert.equal(isMinor({ birthDate, jurisdiction: 'JP', at: '2022-03-31' }).minor, true);
    assert.equal(isMinor({ birthDate, jurisdiction: 'JP', at: '2022-04-01' }).minor, false);
    assert.equal(minorUntil(birthDate, 'JP'), '2022-04-01');
    // Turned 20 before the change: adult since the 20th birthday.
    assert.equal(minorUntil('2001-06-01', 'JP'), '2021-06-01');
    // Turned 18 after it: adult on the 18th birthday.
    assert.equal(minorUntil('2005-06-01', 'JP'), '2023-06-01');
  });

  it('Korea: 20 until 2013-06-30, 19 from 2013-07-01', () => {
    assert.equal(ageOfMajority('KR', { at: '2013-06-30' }).age, 20);
    assert.equal(ageOfMajority('KR', { at: '2013-07-01' }).age, 19);
    const birthDate = '1994-03-15';
    assert.equal(isMinor({ birthDate, jurisdiction: 'KR', at: '2013-06-30' }).minor, true);
    assert.equal(isMinor({ birthDate, jurisdiction: 'KR', at: '2013-07-01' }).minor, false);
    assert.equal(minorUntil(birthDate, 'KR'), '2013-07-01');
  });

  it('Taiwan: 20 until 2022-12-31, 18 from 2023-01-01', () => {
    const birthDate = '2004-05-05';
    assert.equal(isMinor({ birthDate, jurisdiction: 'TW', at: '2022-12-31' }).minor, true);
    assert.equal(isMinor({ birthDate, jurisdiction: 'TW', at: '2023-01-01' }).minor, false);
    assert.equal(minorUntil(birthDate, 'TW'), '2023-01-01');
  });

  it('Brazil: 21 until 2003-01-10, 18 from 2003-01-11', () => {
    assert.equal(ageOfMajority('BR', { at: '2003-01-10' }).age, 21);
    assert.equal(ageOfMajority('BR', { at: '2003-01-11' }).age, 18);
  });

  it('Denmark digital consent: 13 until 2023-12-31, 15 from 2024-01-01', () => {
    const birthDate = '2010-06-01';
    const before = needsParentalConsent({ birthDate, jurisdiction: 'DK', at: '2023-12-31' });
    const after = needsParentalConsent({ birthDate, jurisdiction: 'DK', at: '2024-01-01' });
    assert.equal(before.required, false);
    assert.equal(before.consentAge, 13);
    assert.equal(after.required, true);
    assert.equal(after.consentAge, 15);
    assert.equal(after.canConsentFrom, '2025-06-01');
  });

  it('Chile digital consent: no rule before 2026-12-01, 14 from that day', () => {
    assert.equal(digitalConsentAge('CL', { at: '2026-11-30' }), null);
    assert.equal(digitalConsentAge('CL', { at: '2026-12-01' }).age, 14);
    const before = needsParentalConsent({ birthDate: '2014-01-01', jurisdiction: 'CL', at: '2026-11-30' });
    assert.equal(before.required, null);
    assert.equal(before.reason, REASONS.NO_RULE_IN_FORCE);
    assert.equal(needsParentalConsent({ birthDate: '2014-01-01', jurisdiction: 'CL', at: '2026-12-01' }).required, true);
  });

  it('GDPR: no rule before 2018-05-25 (EU) or 2018-07-20 (EEA); 16 until a derogation took effect', () => {
    const person = { birthDate: '2001-01-01' };
    assert.equal(needsParentalConsent({ ...person, jurisdiction: 'DE', at: '2018-05-24' }).reason, REASONS.NO_RULE_IN_FORCE);
    assert.equal(needsParentalConsent({ ...person, jurisdiction: 'DE', at: '2018-05-25' }).required, false);
    assert.equal(digitalConsentAge('NO', { at: '2018-07-19' }), null);
    assert.equal(digitalConsentAge('NO', { at: '2018-07-20' }).age, 13);
    assert.equal(digitalConsentAge('ES', { at: '2018-12-06' }).age, 16);
    assert.equal(digitalConsentAge('ES', { at: '2018-12-07' }).age, 14);
    assert.equal(digitalConsentAge('PT', { at: '2019-08-08' }).age, 16);
    assert.equal(digitalConsentAge('PT', { at: '2019-08-09' }).age, 13);
    assert.equal(digitalConsentAge('SI', { at: '2023-01-25' }).age, 16);
    assert.equal(digitalConsentAge('SI', { at: '2023-01-26' }).age, 15);
  });

  it('a dated first version answers nothing before it', () => {
    assert.equal(ageOfMajority('CH', { at: '1995-12-31' }), null);
    assert.equal(ageOfMajority('CH', { at: '1996-01-01' }).age, 18);
    assert.equal(isMinor({ birthDate: '1980-01-01', jurisdiction: 'CH', at: '1995-12-31' }).reason, REASONS.NO_RULE_IN_FORCE);
  });
});

describe('29 February births', () => {
  const birthDate = '2008-02-29';

  it('default: attained on 1 March in a common year', () => {
    assert.equal(minorUntil(birthDate, 'CA-BC'), '2027-03-01');
    assert.equal(minorUntil(birthDate, 'US-TX'), '2026-03-01');
  });

  it('Newfoundland and Labrador: the last day of February (s. 3(2))', () => {
    assert.equal(ageOfMajority('CA-NL').age, 19);
    assert.equal(minorUntil(birthDate, 'CA-NL'), '2027-02-28');
    assert.equal(isMinor({ birthDate, jurisdiction: 'CA-NL', at: '2027-02-27' }).minor, true);
    assert.equal(isMinor({ birthDate, jurisdiction: 'CA-NL', at: '2027-02-28' }).minor, false);
  });

  it('Scotland and Maryland: 1 March, by statute', () => {
    for (const jurisdiction of ['GB-SCT', 'US-MD']) {
      assert.equal(minorUntil(birthDate, jurisdiction), '2026-03-01', jurisdiction);
      assert.equal(isMinor({ birthDate, jurisdiction, at: '2026-02-28' }).minor, true, jurisdiction);
      assert.equal(isMinor({ birthDate, jurisdiction, at: '2026-03-01' }).minor, false, jurisdiction);
    }
  });

  it('Japan, Korea and Taiwan: 1 March (the instant between 28 February and 1 March)', () => {
    assert.equal(minorUntil('2004-02-29', 'JP'), '2022-04-01');
    assert.equal(minorUntil('2008-02-29', 'JP'), '2026-03-01');
    assert.equal(minorUntil('2008-02-29', 'TW'), '2026-03-01');
    assert.equal(minorUntil('2008-02-29', 'KR'), '2027-03-01');
  });

  it('a leap-year anniversary is the day itself', () => {
    assert.equal(minorUntil('2004-02-29', 'CA-NL'), '2023-02-28');
    assert.equal(minorUntil('2005-02-28', 'CA-NL'), '2024-02-28');
    assert.equal(minorUntil('2009-02-28', 'GB-SCT'), '2027-02-28');
  });

  it("a caller's rule overrides the jurisdiction's", () => {
    assert.equal(minorUntil(birthDate, 'GB-SCT', { leapDay: 'feb28' }), '2026-02-28');
    assert.equal(minorUntil(birthDate, 'CA-NL', { leapDay: 'mar1' }), '2027-03-01');
    assert.equal(minorUntil('2008-03-14', 'GB-ENG', { attainment: 'dayBefore' }), '2026-03-13');
  });
});

describe('places the tables do not answer', () => {
  it('a country that sets majority per subdivision needs one', () => {
    for (const country of ['US', 'CA', 'AU']) {
      assert.equal(ageOfMajority(country), null, country);
      const result = isMinor({ birthDate: '2010-01-01', jurisdiction: country, at: '2026-01-01' });
      assert.equal(result.minor, null);
      assert.equal(result.reason, REASONS.SUBDIVISION_REQUIRED);
      assert.equal(result.age, 16);
    }
  });

  it('an unresearched place is unknown — never a guessed 18', () => {
    for (const code of ['SA', 'AE', 'SG', 'ID', 'EC', 'GR', 'CY', 'GU', 'VI', 'MP', 'AS']) {
      assert.equal(ageOfMajority(code), null, code);
      const result = isMinor({ birthDate: '1990-01-01', jurisdiction: code, at: '2026-01-01' });
      assert.equal(result.minor, null, code);
      assert.equal(result.reason, REASONS.UNKNOWN_JURISDICTION, code);
      assert.equal(result.minorUntil, null);
    }
    for (const code of ['CH', 'JP', 'AU', 'CA', 'CA-ON', 'IN', 'SG', 'KE', 'NG', 'VN', 'PE']) {
      assert.equal(digitalConsentAge(code), null, code);
      assert.equal(needsParentalConsent({ birthDate: '2015-01-01', jurisdiction: code, at: '2026-01-01' }).required, null);
    }
  });

  it('a subdivision falls back to its country where the country answers', () => {
    assert.equal(digitalConsentAge('GB-SCT').matched, 'GB');
    assert.equal(digitalConsentAge('US-CA').age, 13);
    assert.equal(digitalConsentAge('US-CA').matched, 'US');
    assert.equal(digitalConsentAge('PR').matched, 'US');
    assert.equal(ageOfMajority('GP').matched, 'FR');
    assert.equal(ageOfMajority('GB-BIR').matched, 'GB');
  });

  it('a code that names no place throws instead of answering unknown', () => {
    for (const bad of ['ZZ', 'USA', 'US-XX', 'CA-ZZ', 'AU-XYZ', '', 'us_al', 42, null, {}]) {
      assert.throws(() => ageOfMajority(bad), TypeError, String(bad));
    }
  });
});

describe('strictest', () => {
  it('takes the highest threshold across places', () => {
    const result = strictest(['US-AL', 'US-MS', 'CZ'], KINDS.MAJORITY, { at: AS_OF });
    assert.equal(result.age, 21);
    assert.equal(result.governing.jurisdiction, 'US-MS');
    assert.deepEqual(result.unknown, []);
    assert.deepEqual(result.results.map((r) => r.age), [19, 21, 18]);
  });

  it('certifies nothing when any place is unknown', () => {
    const result = strictest(['US-AL', 'SA'], 'majority', { at: AS_OF });
    assert.equal(result.age, null);
    assert.equal(result.governing.jurisdiction, 'US-AL');
    assert.deepEqual(result.unknown, [{ jurisdiction: 'SA', reason: 'unknown_jurisdiction' }]);
  });

  it('works for digital consent, ties going to the first', () => {
    const result = strictest(['US', 'FR', 'DE', 'NL'], 'digitalConsent', { at: AS_OF });
    assert.equal(result.age, 16);
    assert.equal(result.governing.jurisdiction, 'DE');
  });

  it('reads the dates', () => {
    assert.equal(strictest(['JP', 'US-NE'], 'majority', { at: '2022-03-31' }).age, 20);
    assert.equal(strictest(['JP', 'US-NE'], 'majority', { at: '2022-04-01' }).age, 19);
  });
});

describe('input normalisation', () => {
  it('accepts any case, whitespace, aliases and object form', () => {
    assert.equal(normalizeJurisdiction(' us-al '), 'US-AL');
    assert.equal(normalizeJurisdiction('cz'), 'CZ');
    assert.equal(normalizeJurisdiction('UK'), 'GB');
    assert.equal(normalizeJurisdiction('el'), 'GR');
    assert.equal(normalizeJurisdiction('US-PR'), 'PR');
    assert.equal(normalizeJurisdiction('gb-sct'), 'GB-SCT');
    assert.equal(normalizeJurisdiction({ country: 'ca', subdivision: 'bc' }), 'CA-BC');
    assert.equal(normalizeJurisdiction({ country: 'CA', subdivision: 'CA-BC' }), 'CA-BC');
    assert.equal(normalizeJurisdiction({ country: 'AU', subdivision: null }), 'AU');
  });

  it('answers the normalised code', () => {
    assert.equal(ageOfMajority('us-pr').age, 21);
    assert.equal(ageOfMajority('US-PR').jurisdiction, 'PR');
    assert.equal(ageOfMajority({ country: 'us', subdivision: 'ms' }).age, 21);
    assert.equal(digitalConsentAge('uk').age, 13);
    assert.equal(threshold('ca-qc', 'digitalConsent').age, 14);
    assert.equal(isMinor({ birthDate: '2010-01-01', jurisdiction: 'ca-bc', at: '2028-12-31' }).jurisdiction, 'CA-BC');
  });

  it('rejects a mismatched subdivision prefix and unknown fields', () => {
    assert.throws(() => normalizeJurisdiction({ country: 'CA', subdivision: 'US-AL' }), TypeError);
    assert.throws(() => normalizeJurisdiction({ country: 'CA', province: 'BC' }), TypeError);
    assert.throws(() => threshold('CZ', 'majorty'), TypeError);
    assert.throws(() => isMinor({ birthDate: '2010-01-01', jurisdiction: 'CZ', on: '2026-01-01' }), TypeError);
  });

  it('lists the codes in each table', () => {
    const majority = jurisdictions('majority');
    assert.ok(majority.includes('US-MS') && majority.includes('NZ') && !majority.includes('US'), 'a country that answers only per subdivision is not listed');
    assert.equal(majority.length, 125);
    assert.deepEqual(majority, [...majority].sort());
    assert.ok(jurisdictions('digitalConsent').includes('CL'));
  });
});

describe('immutability', () => {
  it('freezes the tables all the way down', () => {
    assert.ok(Object.isFrozen(MAJORITY));
    assert.ok(Object.isFrozen(MAJORITY['US-MS']));
    assert.ok(Object.isFrozen(MAJORITY['US-MS'].versions));
    assert.ok(Object.isFrozen(MAJORITY['US-MS'].versions[0]));
    assert.ok(Object.isFrozen(DIGITAL_CONSENT.DK.versions[1]));
    assert.ok(Object.isFrozen(KINDS) && Object.isFrozen(REASONS));
    assert.throws(() => { MAJORITY['US-MS'].versions[0].age = 18; }, TypeError);
    assert.throws(() => { MAJORITY.ZZ = {}; }, TypeError);
    assert.equal(ageOfMajority('US-MS').age, 21);
  });

  it('freezes results', () => {
    assert.ok(Object.isFrozen(ageOfMajority('CZ')));
    assert.ok(Object.isFrozen(isMinor({ birthDate: '2010-01-01', jurisdiction: 'CZ', at: '2026-01-01' })));
    assert.ok(Object.isFrozen(strictest(['CZ'], 'majority')));
  });
});

describe('ESM consumers', () => {
  it('can import every documented name', async () => {
    // cjs-module-lexer detects only plain-identifier exports; anything else
    // compiles against index.d.ts and then fails at runtime.
    const mod = await import('../index.js');
    for (const name of ['ageOfMajority', 'digitalConsentAge', 'threshold', 'isMinor', 'needsParentalConsent',
      'minorUntil', 'ageOn', 'strictest', 'normalizeJurisdiction', 'jurisdictions',
      'MAJORITY', 'DIGITAL_CONSENT', 'AS_OF', 'KINDS', 'REASONS']) {
      assert.ok(name in mod, `${name} is not a named ESM export`);
      assert.equal(mod[name], aom[name]);
    }
  });
});

describe('review fixes, 2026-10-11', () => {
  it('Québec\'s consent age of 14 starts with Law 25 on 2023-09-22, not a year earlier', () => {
    assert.equal(aom.threshold('CA-QC', 'digitalConsent', { at: '2023-09-21' }), null);
    assert.equal(aom.threshold('CA-QC', 'digitalConsent', { at: '2023-09-22' }).age, 14);
  });

  it('each Danish version links the Act in force for it', () => {
    const [before, after] = aom.DIGITAL_CONSENT.DK.versions;
    assert.match(before.sourceUrl, /\/2018\/502$/);
    assert.match(after.sourceUrl, /\/2024\/289$/);
  });
});

describe('second review, 2026-10-11', () => {
  it('an age lowered on a known date has no answer before it, never a wrong 18', () => {
    for (const [code, from] of [['GB-NIR', '1970-01-01'], ['US-CT', '1972-10-01'], ['US-MI', '1972-01-01'], ['CA-NS', '1971-04-13'], ['IE', '1985-03-01'], ['IT', '1975-03-10']]) {
      const day = new Date(Date.parse(`${from}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      assert.equal(aom.threshold(code, 'majority', { at: day }), null, code);
      assert.ok(aom.threshold(code, 'majority', { at: from }), code);
    }
  });

  it('New Brunswick cites the Act in force', () => {
    assert.match(aom.threshold('CA-NB', 'majority').sourceUrl, /2011-c\.103$/);
  });
});

describe('code review, 2026-10-11', () => {
  it('never dates a coming of age before the first rule the tables hold', () => {
    // South Africa's 18 began 2007-07-01; before, the tables hold nothing (it was 21).
    assert.equal(minorUntil('1988-03-01', 'ZA'), null);
    assert.equal(minorUntil('1995-03-01', 'ZA'), '2013-03-01');
    assert.equal(minorUntil('1950-06-01', 'GB'), null);
    assert.equal(minorUntil('1960-06-01', 'GB'), '1978-06-01');
    // Chile's consent age begins 2026-12-01.
    assert.equal(aom.needsParentalConsent({ birthDate: '2010-01-01', jurisdiction: 'CL', at: '2026-12-01' }).canConsentFrom, null);
    assert.equal(aom.needsParentalConsent({ birthDate: '2015-01-01', jurisdiction: 'CL', at: '2026-12-01' }).canConsentFrom, '2029-01-01');
  });

  it('a place with its own country code answers the same however it is spelled', () => {
    for (const [sub, own] of [['CN-TW', 'TW'], ['CN-HK', 'HK'], ['NL-AW', 'AW'], ['FR-NC', 'NC'], ['FI-01', 'AX']]) {
      assert.equal(aom.normalizeJurisdiction(sub), own, sub);
      for (const kind of ['majority', 'digitalConsent']) {
        assert.deepEqual(aom.threshold(sub, kind, { at: AS_OF }), aom.threshold(own, kind, { at: AS_OF }), `${sub} ${kind}`);
      }
    }
    assert.equal(aom.threshold('CN-TW', 'majority', { at: '2022-06-01' }).age, 20);
    assert.equal(aom.threshold('FR-971', 'majority', { at: AS_OF }).matched, 'FR');
  });

  it('a Date or today needs a zone where the day decides the answer', () => {
    // 15:00 UTC on 2022-03-31 is already 1 April in Tokyo, the day Japan's 18 began.
    const instant = new Date('2022-03-31T15:00:00Z');
    assert.throws(() => ageOfMajority('JP', { at: instant }), /pass timeZone/);
    assert.equal(ageOfMajority('JP', { at: instant, timeZone: 'Asia/Tokyo' }).age, 18);
    assert.equal(ageOfMajority('JP', { at: instant, timeZone: 'America/New_York' }).age, 20);
    // A day nowhere near a change needs none.
    assert.equal(ageOfMajority('JP', { at: new Date('2025-06-01T12:00:00Z') }).age, 18);
    // A person's age always does.
    assert.throws(() => isMinor({ birthDate: '2008-10-12', jurisdiction: 'CZ' }), /pass timeZone/);
  });

  it('an unknown time zone throws, whatever at is', () => {
    assert.throws(() => ageOfMajority('CZ', { at: '2026-01-01', timeZone: 'Mars/Olympus' }), RangeError);
    assert.throws(() => isMinor({ birthDate: '2000-01-01', jurisdiction: 'CZ', at: '2026-01-01', timeZone: 'Mars/Olympus' }), RangeError);
  });

  it('years past 9999 are refused, not compared as text', () => {
    assert.throws(() => ageOfMajority('JP', { at: new Date('+010000-01-01T00:00:00Z'), timeZone: 'UTC' }), RangeError);
  });

  it('input that is not quite right is refused', () => {
    assert.throws(() => minorUntil('2008-01-01', 'US', { leapDay: 'bogus' }), TypeError);
    assert.throws(() => aom.normalizeJurisdiction(Object.create({ country: 'CZ' })), TypeError);
    const vm = require('node:vm');
    const foreign = vm.runInNewContext("new Date('2008-03-14T00:00:00Z')");
    assert.equal(aom.ageOn(foreign, { at: '2026-03-14' }), 18);
  });

  it('effectiveUntil is the last day a version is in force', () => {
    assert.equal(ageOfMajority('JP', { at: '2022-03-31' }).effectiveUntil, '2022-03-31');
  });

  it('strictest says why a place is unknown', () => {
    const r = strictest(['US', 'CL', 'SA', 'DE'], 'digitalConsent', { at: AS_OF });
    assert.deepEqual(r.unknown, [{ jurisdiction: 'CL', reason: 'no_rule_in_force' }, { jurisdiction: 'SA', reason: 'unknown_jurisdiction' }]);
  });

  it('the README examples answer as shown', () => {
    const ms = isMinor({ birthDate: '2006-05-10', jurisdiction: 'US-MS', at: '2026-10-11' });
    assert.deepEqual([ms.minor, ms.age, ms.majorityAge, ms.minorUntil, ms.reason], [true, 20, 21, '2027-05-10', 'below_threshold']);
    assert.equal(minorUntil('2008-02-29', 'CA-NL'), '2027-02-28');
    assert.equal(strictest(['US-AL', 'US-MS', 'CZ'], 'majority', { at: AS_OF }).age, 21);
  });
});
