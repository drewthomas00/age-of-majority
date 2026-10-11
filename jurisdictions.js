'use strict';

/**
 * The codes a jurisdiction may be named by.
 *
 * A two-letter code is checked against the officially assigned ISO 3166-1
 * alpha-2 list, so a typo ('CZE', 'ZZ') throws instead of quietly answering
 * "unknown" for a place that does not exist. Subdivisions are checked against
 * the full list only for the countries whose subdivisions the data actually
 * distinguishes (the United States, Canada and Australia); elsewhere any
 * well-formed ISO 3166-2 suffix is accepted and answered by the country's own
 * entry.
 */

const { deepFreeze } = require('./freeze');

/** ISO 3166-1 alpha-2: every officially assigned code (249). */
const COUNTRIES = deepFreeze([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
]);

/**
 * The two exceptionally reserved codes people actually type. 'UK' is not the
 * United Kingdom's ISO code (that is GB), and 'EL' is the code the EU uses for
 * Greece (ISO's is GR); both are accepted and normalised.
 */
const ALIASES = deepFreeze({ UK: 'GB', EL: 'GR' });

/** The US territories that also hold an ISO 3166-1 code of their own. */
const US_TERRITORIES = deepFreeze(['AS', 'GU', 'MP', 'PR', 'UM', 'VI']);

/**
 * Subdivision lists checked in full, because the data answers per subdivision
 * there and a typo would otherwise read as "unknown" rather than as a typo.
 * The US list includes the territories, which ISO 3166-2:US also lists; they
 * normalise to their own country codes ('US-PR' → 'PR').
 */
const SUBDIVISIONS = deepFreeze({
  US: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
    'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
    'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
    ...US_TERRITORIES,
  ],
  CA: ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'],
  AU: ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'],
});

/**
 * Places with their own ISO 3166-1 code that are governed, for the question a
 * table answers, by another country's law — consulted only when the place has
 * no entry of its own in that table.
 *
 * The US territories fall under federal law such as COPPA, which defines
 * "State" to include them. France's five overseas departments are part of
 * France and of the EU: the Civil Code and the GDPR apply there as in Paris.
 */
const PARENTS = deepFreeze({
  AS: 'US', GU: 'US', MP: 'US', PR: 'US', UM: 'US', VI: 'US',
  GF: 'FR', GP: 'FR', MQ: 'FR', RE: 'FR', YT: 'FR',
});

module.exports = { COUNTRIES, ALIASES, US_TERRITORIES, SUBDIVISIONS, PARENTS };
