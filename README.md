# age-of-majority

[![npm](https://img.shields.io/npm/v/age-of-majority)](https://www.npmjs.com/package/age-of-majority)
[![CI](https://github.com/drewthomas00/age-of-majority/actions/workflows/ci.yml/badge.svg)](https://github.com/drewthomas00/age-of-majority/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](https://www.npmjs.com/package/age-of-majority?activeTab=dependencies)
[![node](https://img.shields.io/node/v/age-of-majority)](https://www.npmjs.com/package/age-of-majority)
[![license](https://img.shields.io/npm/l/age-of-majority)](LICENSE)

Is this person a minor here? And does an online service need a parent's consent to process their data?

Two tables, keyed by jurisdiction:

- **`majority`** — the age at which a person attains full legal capacity.
- **`digitalConsent`** — the age from which a person may consent on their own to an online service processing their personal data (GDPR Art. 8, COPPA and their equivalents).

Every entry carries the provision it comes from, a link to it, a confidence level and a note on what the citation alone would not tell you. Changes in the law are versions with an effective date, so a question about 2021 gets 2021's answer.

Pure functions. No network, no runtime dependencies. TypeScript types included.

```sh
npm install age-of-majority
```

## Why this is harder than it looks

**18 is not the answer everywhere.** Alabama and Nebraska say 19; Mississippi and Puerto Rico say 21; seven Canadian provinces and territories say 19; New Zealand says 20; Japan said 20 until 1 April 2022. A hardcoded `age >= 18` treats a 20-year-old in Jackson, Mississippi as an adult.

**The answer changes over time.** Japan, Korea, Taiwan and Brazil all lowered the age in living memory. The GDPR set a digital-consent age of 16 from 25 May 2018 unless a state chose a lower one, and many states only did so months later — Spain in December 2018, Czechia in 2019, Slovenia in 2023. Denmark moved from 13 to 15 on 1 January 2024; Chile's 14 starts on 1 December 2026.

**"Unknown" is not "adult".** A place this library has no verified answer for returns `null`, never a default 18. The caller decides what an unknown means — and for a question like this, that should be a deliberate decision.

**Birthdays on 29 February.** Most statutes are silent; one says 28 February, others say 1 March. See [Attainment and leap days](#attainment-and-leap-days).

## Usage

```js
const { isMinor, needsParentalConsent, ageOfMajority, strictest } = require('age-of-majority');
// or: import { isMinor } from 'age-of-majority';

isMinor({ birthDate: '2006-05-10', jurisdiction: 'US-MS', at: '2026-10-11' });
// {
//   minor: true,
//   age: 20,
//   majorityAge: 21,
//   minorUntil: '2027-05-10',          // the first day they are no longer a minor
//   reason: 'below_threshold',
//   jurisdiction: 'US-MS',
//   at: '2026-10-11',
//   rule: {
//     kind: 'majority', age: 21, jurisdiction: 'US-MS', matched: 'US-MS',
//     effectiveFrom: null, effectiveUntil: null,
//     citation: 'Miss. Code § 1-3-27',
//     sourceUrl: 'https://billstatus.ls.state.ms.us/...',
//     confidence: 'high',
//     note: 'A person of 18 may enter contracts (§ 93-19-13), but is a minor until 21.'
//   }
// }
```

`minor` is `true`, `false`, or **`null` when the tables hold no answer** — check `reason`:

| `reason` | Meaning |
|---|---|
| `below_threshold` | Younger than the age in force on `at`. |
| `at_or_above_threshold` | At or past it. |
| `subdivision_required` | The country sets this per state or province and none was given (`'US'`, `'CA'`, `'AU'` for majority). |
| `unknown_jurisdiction` | The tables hold no verified answer for this place. |
| `no_rule_in_force` | `at` is before the earliest rule recorded (e.g. GDPR ages before 25 May 2018). |

### Parental consent online

```js
needsParentalConsent({ birthDate: '2011-03-02', jurisdiction: 'DE', at: '2026-10-11' });
// { required: true, age: 15, consentAge: 16, canConsentFrom: '2027-03-02',
//   reason: 'below_threshold', jurisdiction: 'DE', at: '2026-10-11', rule: { ... } }

// Born 2010-06-01, so 13 at the turn of 2024 — when Denmark raised its age from 13 to 15:
needsParentalConsent({ birthDate: '2010-06-01', jurisdiction: 'DK', at: '2023-12-31' }).required; // false
needsParentalConsent({ birthDate: '2010-06-01', jurisdiction: 'DK', at: '2024-01-01' }).required; // true
```

### Looking up a threshold

```js
ageOfMajority('JP', { at: '2022-03-31' }).age;   // 20
ageOfMajority('JP').age;                         // 18
ageOfMajority('US');                             // null — ask for a state
digitalConsentAge('GB-SCT');                     // the UK's 13, matched: 'GB'
threshold('CA-QC', 'digitalConsent').age;        // 14
minorUntil('2008-02-29', 'CA-NL');               // '2027-02-28'
```

### More than one place

A person can live in one place and be served from another. `strictest` takes the highest threshold — and certifies nothing if any of the places is unknown, since the unknown one might be the strictest:

```js
strictest(['US-AL', 'US-MS', 'CZ'], 'majority');
// { kind: 'majority', age: 21, governing: { jurisdiction: 'US-MS', ... },
//   unknown: [], results: [ {age: 19}, {age: 21}, {age: 18} ] }

strictest(['US-AL', 'SA'], 'majority').age;   // null; unknown: ['SA']
```

### API

| Function | Returns |
|---|---|
| `isMinor({ birthDate, jurisdiction, at?, timeZone?, leapDay?, attainment? })` | `{ minor, age, majorityAge, minorUntil, reason, jurisdiction, at, rule }` |
| `needsParentalConsent({ ...same })` | `{ required, age, consentAge, canConsentFrom, reason, jurisdiction, at, rule }` |
| `ageOfMajority(jurisdiction, { at?, timeZone? })` | the threshold in force, or `null` |
| `digitalConsentAge(jurisdiction, { at?, timeZone? })` | the threshold in force, or `null` |
| `threshold(jurisdiction, kind, { at?, timeZone? })` | either of the above by `kind` |
| `minorUntil(birthDate, jurisdiction, { leapDay?, attainment? })` | `'YYYY-MM-DD'` the person reaches majority, or `null` |
| `ageOn(birthDate, { at?, timeZone?, leapDay?, attainment? })` | completed years |
| `strictest(jurisdictions, kind, { at?, timeZone? })` | `{ kind, age, governing, unknown, results }` |
| `normalizeJurisdiction(jurisdiction)` | the canonical code |
| `jurisdictions(kind)` | every code with its own entry |

Constants: `MAJORITY`, `DIGITAL_CONSENT` (the tables), `AS_OF`, `KINDS`, `REASONS`.

**Jurisdictions** are ISO 3166-1 alpha-2 (`'CZ'`) or ISO 3166-2 (`'US-AL'`, `'CA-BC'`, `'AU-SA'`, `'GB-SCT'`) codes, or `{ country, subdivision }`. Case and whitespace are ignored; `'UK'` and `'EL'` are accepted for GB and GR; `'US-PR'` normalises to `'PR'`. A place without its own entry is answered by its country (`'GB-SCT'` digital consent → GB), and a US territory or French overseas department by the governing country where it has no entry of its own. A code that names no place (`'ZZ'`, `'US-XX'`) **throws a `TypeError`** — a typo is a bug, not an unknown jurisdiction.

**Dates.** `birthDate` is a calendar date: `'YYYY-MM-DD'`, or a `Date` at exactly midnight UTC (what `new Date('2008-03-14')` produces). Any other `Date` is refused rather than rounded, because picking a calendar day for `new Date(2008, 2, 14)` would move the birthday by a day in half the world. `at` defaults to today; a `Date` `at` is read on `timeZone`'s calendar (default `'UTC'`).

Unknown option names throw. Every result and every table is deeply frozen.

## Coverage

As of **2026-10-11** (`AS_OF`). Counts are entries with an answer of their own; confidence is the current version's.

| Table | Entries | `high` | `medium` |
|---|---|---|---|
| `majority` | 121 | 90 | 31 |
| `digitalConsent` | 39 | 31 | 8 |

**Majority** — 47 US states and DC, Puerto Rico; all 13 Canadian provinces and territories; all 8 Australian states and territories; the UK (GB, and GB-ENG, GB-WLS, GB-SCT, GB-NIR); 25 EU states, Iceland, Liechtenstein, Norway and Switzerland; New Zealand, Mexico (federal), Japan, Korea, Taiwan, China, Malaysia, Thailand, the Philippines, Vietnam, India, Türkiye, Egypt, South Africa, Kenya, Brazil, Argentina and Uruguay.

Not 18:

| Age | Where |
|---|---|
| 19 | Alabama, Nebraska; British Columbia, New Brunswick, Newfoundland and Labrador, Nova Scotia, Northwest Territories, Nunavut, Yukon; South Korea (20 before 2013-07-01) |
| 20 | New Zealand, Thailand; Japan before 2022-04-01, Taiwan before 2023-01-01 |
| 21 | Mississippi, Puerto Rico, Egypt; Brazil before 2003-01-11 |

**Digital consent** — the United States (13, COPPA, which also answers for every state and territory); all 27 EU states, Iceland, Liechtenstein, Norway and the UK, each with its GDPR history; Québec (14), China (14), South Korea (14), Brazil (12), South Africa (18), Colombia (18), and Chile (14 from 2026-12-01).

### What is absent, and why

`null` means one of these, not "probably 18":

- **No linkable citation found in this review** — majority: Indiana, New Jersey, New Mexico, Tennessee, American Samoa, Cyprus, Greece, Macau, Sri Lanka, Israel, Chile, Colombia, Peru, Venezuela, Bolivia, Paraguay, Guatemala, the Dominican Republic, Jamaica, Russia, Ukraine, Belarus, Georgia, Armenia, Serbia; digital consent: Kenya, Nigeria, Vietnam, Peru. Each has a reported age, but nothing in the tables ships without a source a reader can follow. These are the first candidates for a contribution.
- **Not verified** — Guam, the US Virgin Islands and the Northern Mariana Islands; Hong Kong, Nigeria, Ghana, Kuwait, Qatar, Bahrain, Kazakhstan, Moldova, the western Balkans outside the EU, and much of the world not listed above.
- **No single answer** — Singapore (21 at common law, 18 for contracts), Indonesia (21 in the Civil Code, 18 elsewhere), Pakistan and Bangladesh (18, but 21 under a court-appointed guardian), Thailand's digital-consent rules (split by age band), Ecuador (sources conflict).
- **Counted in lunar years** — Saudi Arabia; and the UAE before 2026-06-01, when it moves to 18 Gregorian years (not encoded yet: no linkable source).
- **No statutory digital-consent age** — Switzerland (the revised data protection act relies on the capacity of judgement, not a fixed age), Canada outside Québec, Australia (a children's online privacy code is in draft), Japan, Singapore, New Zealand, Argentina, Mexico, Türkiye, the Philippines.
- **Not yet in force, with uncertain dates** — India's Digital Personal Data Protection Act 2023 sets 18, with the children's provisions expected around May 2027.

## Attainment and leap days

**An age is attained at the start of the anniversary.** That is the default here and the rule in the statutes checked: England and Wales (Family Law Reform Act 1969, s. 9), Northern Ireland (Age of Majority Act (NI) 1969, s. 5(1)), Ireland (Age of Majority Act 1985, s. 4(1)), New Zealand (Age of Majority Act 1970, s. 5), Malaysia (Age of Majority Act 1971, s. 3(2)), Maryland (Gen. Prov. § 1-303), Canada's federal Interpretation Act (s. 30) and the Ontario, New Brunswick, Manitoba, Nova Scotia, Northwest Territories and Saskatchewan Acts. California, Montana, North Dakota, Oklahoma and South Dakota say "the first minute of the birthday". Japan, Korea and Taiwan count the day of birth as a whole day, so the age is attained the instant the day before the anniversary ends — the same moment.

The old common-law rule attained an age on the day *before* the anniversary. No jurisdiction in the tables was confirmed still applying it; it is available as a caller option, `attainment: 'dayBefore'`.

**A 29 February birth, in a common year:**

| Rule | Where | Statute |
|---|---|---|
| 1 March | default, wherever the statute is silent | — |
| 1 March (explicit) | Scotland | Age of Legal Capacity (Scotland) Act 1991, s. 6(2) |
| 1 March (explicit) | South Australia | Legislation Interpretation Act 2021, s. 49(2) |
| 1 March (explicit) | Maryland | Gen. Prov. § 1-303 |
| 1 March (the instant 28 February ends) | Japan, Korea, Taiwan | Act on Calculation of Age 1902 (JP); Civil Act art. 160 (KR); Civil Code arts. 121, 124 (TW) |
| **28 February** | **Newfoundland and Labrador** | Age of Majority Act, SNL 1995, s. 3(2) |

The default is 1 March because 28 February has to *end* before someone born on the 29th has lived the full number of years. Both rules can be overridden per call with `leapDay: 'mar1' | 'feb28'`.

## Not legal advice

These tables were compiled with AI-assisted research against the linked sources on the date in `AS_OF`. **They have not been reviewed by a lawyer.** `confidence: 'high'` means the age was read in the primary text (or an official source for the text and its date); `'medium'` means an official or reputable secondary source, or a primary text whose in-force date or article number rests on one. Read the `note`.

The tables are **not a claim of completeness**, and laws change.

### Out of scope

- **Emancipation, marriage, and court declarations of age** — many places end minority early on marriage or by court order (Ireland, the Netherlands, …). The tables give the age; the individual circumstances are yours to know.
- **Purpose-specific ages** — drinking, voting, driving, criminal responsibility, medical consent, and Scotland's legal capacity at 16 (noted on its entry). Specific statutes that use another age for their own subject (New Zealand's, Colorado's, Pennsylvania's) are noted on the entry.
- **Purpose-specific child-privacy rules** — US state laws that restrict targeted advertising, sale or profiling of minors' data (California, Colorado, Connecticut, Maryland, New York, Oregon and others), age-appropriate design codes, and account-linking rules such as Brazil's Lei 15.211. They are not general consent ages, so `digitalConsent` for every US state is COPPA's 13.
- **State civil codes in federal countries** where only the federal code was checked (Mexico).

## Data provenance and reporting a change

Each version's `citation` names the provision and `sourceUrl` links it. `effectiveFrom` is set only where the date the age took effect was found; a first version without one reaches back indefinitely, and a first version *with* one means no rule is recorded before it (`no_rule_in_force`). A prior age is encoded only where its end date was confirmed.

The tables are plain data in [`data.js`](data.js), validated at load — a malformed entry fails the `require()`, not a lookup months later. To report a change or fill a gap, open an issue or a PR with the provision, a link to its text, and the date it takes effect. A law change is a new version with an `effectiveFrom`, never an edit that rewrites history.

## Testing

```sh
npm test
```

Node's built-in test runner, no framework. CI runs the suite on Node 18–24 and again under a non-UTC `TZ`.

## Related packages

Small, dependency-light pieces pulled out of production systems I've built:

- **[tcpa-quiet-hours](https://github.com/drewthomas00/tcpa-quiet-hours)** — is it legal to send this marketing message right now, in the recipient's local time
- **[twilio-signature-verify](https://github.com/drewthomas00/twilio-signature-verify)** — verify `X-Twilio-Signature`, including behind a reverse proxy
- **[pg-cron-lease](https://github.com/drewthomas00/pg-cron-lease)** — make an in-process cron job a singleton across replicas, using Postgres
- **[us-zip-centroids](https://github.com/drewthomas00/us-zip-centroids)** — offline US ZIP → lat/lng, no geocoder

## License

MIT © [Drew Thomas](https://drewthomasbuilds.com)
