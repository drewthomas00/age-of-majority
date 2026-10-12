'use strict';

/**
 * The bundled tables.
 *
 * Plain data, validated by index.js at load. Each key is a canonical
 * jurisdiction code; each value is one rule version, an array of versions
 * (oldest first), or `{ bySubdivision: true }` for a country that leaves the
 * threshold to its states or provinces.
 *
 * A version carries:
 *   age            the threshold, in completed years
 *   effectiveFrom  'YYYY-MM-DD' the version took effect; omitted on a first
 *                  version whose start the sources did not fix (it is then
 *                  treated as reaching back indefinitely). A first version
 *                  WITH a date means "no rule is recorded before this".
 *   citation       the provision it comes from
 *   sourceUrl      a link to that provision, or the best source found for it
 *   confidence     'high'   — read in the primary text, or an official source
 *                             for the text and its commencement
 *                  'medium' — an official or reputable secondary source, or a
 *                             primary text whose commencement date or article
 *                             number rests on a secondary source
 *   note           what a reader of the citation alone would get wrong
 *   leapDay        set only where a statute says how a 29 February birth is
 *                  anniversaried in a common year
 *   attainment     set only where a statute attains an age the day before the
 *                  anniversary ('dayBefore'); none does today
 *
 * A place is in a table only when its age AND a linkable citation were found.
 * Everything else is absent, and the lookup answers null: an unknown place is
 * never a guessed 18.
 */

/** The date the tables were last checked against their sources. */
const AS_OF = '2026-10-11';

// ── Shared sources ──────────────────────────────────────────────

const GDPR_START = '2018-05-25';
const GDPR = Object.freeze({
  citation: 'Regulation (EU) 2016/679 (GDPR), art. 8(1)',
  sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
});

/** The GDPR's default of 16, in force until a national derogation took effect. */
function gdprDefault(note) {
  return {
    age: 16,
    effectiveFrom: GDPR_START,
    ...GDPR,
    confidence: 'high',
    note: note || 'The GDPR default of 16, which applied until the national derogation took effect.',
  };
}

/** A state that sets no age of its own, so the GDPR default of 16 applies. */
function gdprNoDerogation(nationalCitation, sourceUrl, confidence, note, effectiveFrom = GDPR_START) {
  return {
    age: 16,
    effectiveFrom,
    citation: `${GDPR.citation}; ${nationalCitation}`,
    sourceUrl,
    confidence,
    note,
  };
}

// ── Age of majority ─────────────────────────────────────────────

const US_STATES = {
  'US-AL': {
    age: 19,
    citation: 'Ala. Code § 26-1-1(a)',
    sourceUrl: 'https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2015RS/PrintFiles/HB101-Enr.pdf',
    confidence: 'high',
  },
  'US-AK': { age: 18, citation: 'Alaska Stat. § 25.20.010', sourceUrl: 'https://www.akleg.gov/basis/statutes.asp?media=print&secStart=25.20.010&secEnd=25.20.010', confidence: 'high' },
  'US-AZ': { age: 18, citation: 'Ariz. Rev. Stat. § 1-215', sourceUrl: 'https://www.azleg.gov/ars/1/00215.htm', confidence: 'high' },
  'US-AR': { age: 18, citation: 'Ark. Code § 9-25-101', sourceUrl: 'https://syfert.com/arkansas/sections/9-25-101.html', confidence: 'medium' },
  'US-CA': {
    age: 18,
    citation: 'Cal. Fam. Code §§ 6500, 6501',
    sourceUrl: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6500',
    confidence: 'medium',
    note: 'An age is attained from the first minute of the birthday.',
  },
  'US-CO': {
    age: 18,
    citation: 'Colo. Rev. Stat. § 13-22-101(1)',
    sourceUrl: 'https://leg.colorado.gov/sites/default/files/images/olls/crs2024-title-13.pdf',
    confidence: 'high',
    effectiveFrom: '1973-07-01',
    note: '18 is "full age" for the purposes § 13-22-101 lists (contracts, suits, property, and others), in force from 1973-07-01. The general construction statute, § 2-4-401(6), still defines a minor as under 21 where no other age is given.',
  },
  'US-CT': { age: 18, effectiveFrom: '1972-10-01', citation: 'Conn. Gen. Stat. § 1-1d', sourceUrl: 'https://www.cga.ct.gov/current/pub/chap_001.htm', confidence: 'high' },
  'US-DE': { age: 18, effectiveFrom: '1972-06-16', citation: '1 Del. C. § 701', sourceUrl: 'https://delcode.delaware.gov/title1/c007/index.html', confidence: 'high' },
  'US-DC': { age: 18, effectiveFrom: '1976-07-22', citation: 'D.C. Code § 46-101', sourceUrl: 'https://code.dccouncil.gov/us/dc/council/code/sections/46-101', confidence: 'high', note: 'In force from 1976-07-22, per the linked text.' },
  'US-FL': { age: 18, citation: 'Fla. Stat. § 743.07(1)', sourceUrl: 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0743/Sections/0743.07.html', confidence: 'high' },
  'US-GA': { age: 18, effectiveFrom: '1972-07-01', citation: 'O.C.G.A. § 39-1-1(a)', sourceUrl: 'https://law.justia.com/codes/georgia/title-39/chapter-1/section-39-1-1', confidence: 'medium' },
  'US-HI': { age: 18, citation: 'Haw. Rev. Stat. § 577-1', sourceUrl: 'https://data.capitol.hawaii.gov/hrscurrent/Vol12_Ch0501-0588/HRS0577/HRS_0577-0001.htm', confidence: 'high' },
  'US-ID': { age: 18, citation: 'Idaho Code § 32-101', sourceUrl: 'https://legislature.idaho.gov/statutesrules/idstat/Title32/T32CH1/SECT32-101/', confidence: 'high' },
  'US-IL': { age: 18, citation: '755 ILCS 5/11-1', sourceUrl: 'https://ilga.gov/Documents/legislation/ilcs/documents/075500050K11-1.htm', confidence: 'high' },
  'US-IN': {
    age: 18,
    citation: 'Ind. Code § 1-1-4-5(a)(1), (a)(8)',
    sourceUrl: 'https://codes.findlaw.com/in/title-1-general-provisions/in-code-sect-1-1-4-5/',
    confidence: 'medium',
    note: 'A general definition for construing all Indiana statutes: an adult is at least 18 and a minor is under 18, unless a statute or its context says otherwise. Read in an unofficial compilation, current to 2026-01-01.',
  },
  'US-IA': { age: 18, citation: 'Iowa Code § 599.1', sourceUrl: 'https://www.legis.iowa.gov/docs/code/599.1.pdf', confidence: 'high' },
  'US-KS': { age: 18, citation: 'Kan. Stat. Ann. § 38-101', sourceUrl: 'https://www.ksrevisor.gov/statutes/chapters/ch38/038_001_0001.html', confidence: 'high' },
  'US-KY': { age: 18, citation: 'Ky. Rev. Stat. § 2.015', sourceUrl: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=58128', confidence: 'high', note: 'A version operative 2027-01-01 (2026 Ky. Acts ch. 161) adds fantasy sports to the age-21 exceptions; the age of majority stays 18.' },
  'US-LA': { age: 18, citation: 'La. Civ. Code art. 29', sourceUrl: 'https://www.legis.la.gov/LEGIS/Law.aspx?d=109928', confidence: 'high' },
  'US-ME': { age: 18, citation: '1 M.R.S. § 73', sourceUrl: 'https://legislature.maine.gov/statutes/1/title1sec73.html', confidence: 'high' },
  'US-MD': {
    age: 18,
    citation: 'Md. Code, Gen. Provisions § 1-401(a); § 1-303 (computing age)',
    sourceUrl: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ggp&section=1-401&enactments=false',
    confidence: 'high',
    leapDay: 'mar1',
    note: '§ 1-303 attains an age on the anniversary and, for a 29 February birth, on 1 March in a common year. The duty of support continues to 19 for a child still in secondary school (§ 1-401(b)); that does not delay majority.',
  },
  'US-MA': { age: 18, citation: 'Mass. Gen. Laws c. 231, § 85P', sourceUrl: 'https://malegislature.gov/Laws/GeneralLaws/PartIII/TitleII/Chapter231/Section85P', confidence: 'high' },
  'US-MI': { age: 18, effectiveFrom: '1972-01-01', citation: 'Mich. Comp. Laws § 722.52', sourceUrl: 'https://legislature.mi.gov/Laws/MCL?objectName=mcl-722-52', confidence: 'high' },
  'US-MN': { age: 18, citation: 'Minn. Stat. § 645.451', sourceUrl: 'https://www.revisor.mn.gov/statutes/cite/645.451', confidence: 'high' },
  'US-MS': {
    age: 21,
    citation: 'Miss. Code § 1-3-27',
    sourceUrl: 'https://billstatus.ls.state.ms.us/documents/2024/pdf/SB/2200-2299/SB2255IN.pdf',
    confidence: 'medium',
    note: 'A person of 18 may enter contracts (§ 93-19-13), but is a minor until 21. No stable official link to the code text was found; the link is 2024 SB 2255 as introduced, which quotes § 1-3-27 in force and proposed lowering the age to 18. That bill died, as did 2026 HB 277.',
  },
  'US-MO': { age: 18, effectiveFrom: '1975-01-07', citation: 'Mo. Rev. Stat. § 431.055', sourceUrl: 'https://revisor.mo.gov/main/OneSection.aspx?section=431.055', confidence: 'high' },
  'US-MT': {
    age: 18,
    citation: 'Mont. Code Ann. §§ 41-1-101, 41-1-102',
    sourceUrl: 'https://mca.legmt.gov/bills/mca/title_0410/chapter_0010/part_0010/section_0010/0410-0010-0010-0010.html',
    confidence: 'high',
    note: '§ 41-1-102: an age is attained from the first minute of the birthday.',
  },
  'US-NE': {
    age: 19,
    citation: 'Neb. Rev. Stat. § 43-2101',
    sourceUrl: 'https://nebraskalegislature.gov/laws/statutes.php?statute=43-2101',
    confidence: 'high',
    note: 'Majority is 19. Under LB 982 a person of 18 may enter contracts on their own, but remains a minor.',
  },
  'US-NV': { age: 18, citation: 'Nev. Rev. Stat. § 129.010', sourceUrl: 'https://www.leg.state.nv.us/NRS/NRS-129.html', confidence: 'high' },
  'US-NH': { age: 18, effectiveFrom: '1973-06-03', citation: 'N.H. Rev. Stat. § 21-B:1', sourceUrl: 'https://gc.nh.gov/rsa/html/I/21-B/21-B-1.htm', confidence: 'high', note: 'In force from 1973-06-03, per the linked text.' },
  'US-NJ': {
    age: 18,
    citation: 'N.J.S.A. 9:17B-3',
    sourceUrl: 'https://codes.findlaw.com/nj/title-9-children-juvenile-and-domestic-relations-courts/nj-st-sect-9-17b-3/',
    confidence: 'medium',
    note: 'A person of 18 is an adult with the capacity of a person of 21, except for listed purposes (among them services for people aged 18 to 21 and the Uniform Gifts and Transfers to Minors Acts). Read in an unofficial compilation.',
  },
  'US-NM': {
    age: 18,
    citation: 'N.M. Stat. Ann. § 28-6-1(A)',
    sourceUrl: 'https://codes.findlaw.com/nm/chapter-28-human-rights/nm-st-sect-28-6-1/',
    confidence: 'medium',
    note: 'Subsection B keeps 21 for gifts made before 1971-06-18 under the Uniform Gifts to Minors Act. Read in an unofficial compilation.',
  },
  'US-NY': { age: 18, citation: 'N.Y. Dom. Rel. Law § 2; CPLR 105(j)', sourceUrl: 'https://www.nysenate.gov/legislation/laws/DOM/2', confidence: 'high' },
  'US-NC': { age: 18, citation: 'N.C. Gen. Stat. § 48A-2', sourceUrl: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_48A/GS_48A-2.html', confidence: 'high' },
  'US-ND': { age: 18, citation: 'N.D. Cent. Code § 14-10-01', sourceUrl: 'https://ndlegis.gov/cencode/t14c10.pdf', confidence: 'high', note: 'An age is attained from the first minute of the birthday.' },
  'US-OH': { age: 18, citation: 'Ohio Rev. Code § 3109.01', sourceUrl: 'https://codes.ohio.gov/ohio-revised-code/section-3109.01', confidence: 'high' },
  'US-OK': { age: 18, citation: '15 Okla. Stat. § 13', sourceUrl: 'https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os15.rtf', confidence: 'high', note: 'An age is attained from the first minute of the birthday.' },
  'US-OR': { age: 18, citation: 'Or. Rev. Stat. § 109.621 (formerly § 109.510)', sourceUrl: 'https://www.oregonlegislature.gov/bills_laws/ors/ors109.html', confidence: 'high' },
  'US-PA': {
    age: 18,
    citation: '23 Pa.C.S. § 5101',
    sourceUrl: 'https://www.palegis.us/statutes/consolidated/view-statute?txtType=PDF&ttl=23&div=0&chapter=51',
    confidence: 'high',
    note: '18 for contracts and suits. The Statutory Construction Act, 1 Pa.C.S. § 1991, still defines "adult" as 21 where a statute gives no other age.',
  },
  'US-RI': { age: 18, citation: 'R.I. Gen. Laws § 15-12-1', sourceUrl: 'https://webserver.rilegislature.gov/Statutes/TITLE15/15-12/15-12-1.htm', confidence: 'high' },
  'US-SC': { age: 18, effectiveFrom: '1975-02-06', citation: 'S.C. Code § 15-1-320', sourceUrl: 'https://www.scstatehouse.gov/code/t15c001.php', confidence: 'high' },
  'US-SD': { age: 18, citation: 'S.D. Codified Laws § 26-1-1', sourceUrl: 'https://sdlegislature.gov/api/Statutes/26-1-1.html', confidence: 'high', note: 'An age is attained from the first minute of the birthday.' },
  'US-TN': {
    age: 18,
    citation: 'Tenn. Code Ann. § 1-3-105(a)(1), (a)(17); § 1-3-113(a)',
    sourceUrl: 'https://codes.findlaw.com/tn/title-1-code-and-statutes/tn-code-sect-1-3-105/',
    confidence: 'medium',
    note: 'The age of majority is 18, and § 1-3-113 gives a person of 18 the rights and duties of a person of 21. Both keep 21 for alcohol (and § 1-3-113 for tobacco, vapor and hemp products). Read in an unofficial compilation.',
  },
  'US-TX': { age: 18, citation: 'Tex. Civ. Prac. & Rem. Code § 129.001', sourceUrl: 'https://tcss.legis.texas.gov/docs/CP/htm/CP.129.htm', confidence: 'high' },
  'US-UT': { age: 18, citation: 'Utah Code § 15-2-1', sourceUrl: 'https://le.utah.gov/xcode/Title15/Chapter2/C15-2-S1_1800010118000101.html', confidence: 'high' },
  'US-VT': { age: 18, effectiveFrom: '1972-03-29', citation: '1 V.S.A. § 173', sourceUrl: 'https://legislature.vermont.gov/statutes/section/01/003/00173', confidence: 'high', note: 'In force from 1972-03-29, per the linked text.' },
  'US-VA': { age: 18, citation: 'Va. Code § 1-204', sourceUrl: 'https://law.lis.virginia.gov/vacode/title1/chapter2.1/section1-204/', confidence: 'high' },
  'US-WA': { age: 18, citation: 'Rev. Code Wash. § 26.28.010', sourceUrl: 'https://app.leg.wa.gov/RCW/default.aspx?cite=26.28.010', confidence: 'high' },
  'US-WV': { age: 18, effectiveFrom: '1972-06-09', citation: 'W. Va. Code § 2-3-1', sourceUrl: 'https://code.wvlegislature.gov/2-3-1/', confidence: 'high' },
  'US-WI': {
    age: 18,
    citation: 'Wis. Stat. § 990.01(3)',
    sourceUrl: 'https://docs.legis.wisconsin.gov/statutes/statutes/990/01/3',
    confidence: 'high',
    note: 'Criminal law treats 17-year-olds as adults for investigation and prosecution; that does not change civil majority.',
  },
  'US-WY': { age: 18, citation: 'Wyo. Stat. § 14-1-101(a)', sourceUrl: 'https://wyoleg.gov/statutes/compress/title14.pdf', confidence: 'high' },
  PR: {
    age: 21,
    citation: 'Código Civil de Puerto Rico (2020), art. 97',
    sourceUrl: 'https://www.lexjuris.com/lexlex/Leyes2020/lexl2020055b.pdf',
    confidence: 'medium',
    note: 'The 2020 Civil Code, in force from 2020-11-28, kept majority at 21. Read in an unofficial compilation.',
  },
};

const CA_PROVINCES = {
  'CA-AB': {
    age: 18,
    effectiveFrom: '1971-07-01',
    citation: 'Age of Majority Act, RSA 2000, c. A-6, s. 1',
    sourceUrl: 'https://kings-printer.alberta.ca/documents/Acts/A06.pdf',
    confidence: 'high',
  },
  'CA-BC': {
    age: 19,
    effectiveFrom: '1970-04-15',
    citation: 'Age of Majority Act, RSBC 1996, c. 7, s. 1(1)',
    sourceUrl: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96007_01',
    confidence: 'high',
  },
  'CA-MB': { age: 18, citation: 'The Age of Majority Act, CCSM c. A7, s. 1', sourceUrl: 'https://web2.gov.mb.ca/laws/statutes/ccsm/a007.php', confidence: 'high' },
  'CA-NB': {
    age: 19,
    effectiveFrom: '1972-08-01',
    citation: 'Age of Majority Act, RSNB 2011, c. 103, s. 1(1)',
    sourceUrl: 'https://laws.gnb.ca/en/document/cs/2011-c.103',
    confidence: 'high',
  },
  'CA-NL': {
    age: 19,
    citation: 'Age of Majority Act, SNL 1995, c. A-4.2, s. 2; s. 3(2) (29 February births)',
    sourceUrl: 'https://www.assembly.nl.ca/legislation/sr/statutes/a04-2.htm',
    confidence: 'high',
    leapDay: 'feb28',
    note: 's. 3(2): a person born on 29 February attains an age, in a common year, on the last day of February.',
  },
  'CA-NS': { age: 19, effectiveFrom: '1971-04-13', citation: 'Age of Majority Act, RSNS 1989, c. 4, s. 2(1)', sourceUrl: 'https://nslegislature.ca/sites/default/files/legc/statutes/age%20of%20majority.pdf', confidence: 'high' },
  'CA-NT': { age: 19, citation: 'Age of Majority Act, RSNWT 1988, c. A-2, s. 2', sourceUrl: 'https://www.justice.gov.nt.ca/en/files/legislation/age-of-majority/age-of-majority.a.pdf', confidence: 'high' },
  'CA-NU': { age: 19, citation: 'Age of Majority Act, CSNu, c. A-40, s. 2', sourceUrl: 'https://www.nunavutlegislation.ca/en/file-download/download/public/8470', confidence: 'high' },
  'CA-ON': { age: 18, citation: 'Age of Majority and Accountability Act, RSO 1990, c. A.7, s. 1', sourceUrl: 'https://www.ontario.ca/laws/statute/90a07', confidence: 'high' },
  'CA-PE': { age: 18, citation: 'Age of Majority Act, RSPEI 1988, c. A-8, s. 1', sourceUrl: 'https://www.princeedwardisland.ca/sites/default/files/legislation/A-08-Age%20Of%20Majority%20Act.pdf', confidence: 'high' },
  'CA-QC': { age: 18, citation: 'Civil Code of Québec, art. 153', sourceUrl: 'https://www.legisquebec.gouv.qc.ca/en/document/cs/CCQ-1991', confidence: 'high' },
  'CA-SK': { age: 18, citation: 'The Age of Majority Act, RSS 1978, c. A-6, s. 2(1)', sourceUrl: 'https://publications.saskatchewan.ca/api/v1/products/393/formats/427/download', confidence: 'high' },
  'CA-YT': { age: 19, citation: 'Age of Majority Act, RSY 2002, c. 2, s. 1', sourceUrl: 'https://laws.yukon.ca', confidence: 'medium' },
};

const AU_STATES = {
  'AU-ACT': {
    age: 18,
    effectiveFrom: '1974-11-01',
    citation: 'Age of Majority Act 1974 (ACT), s. 5(1)',
    sourceUrl: 'https://www.legislation.act.gov.au/a/1974-46/',
    confidence: 'high',
  },
  'AU-NSW': { age: 18, citation: 'Minors (Property and Contracts) Act 1970 (NSW), s. 9', sourceUrl: 'https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-1970-060', confidence: 'high' },
  'AU-NT': { age: 18, citation: 'Age of Majority Act 1974 (NT), s. 4(1)', sourceUrl: 'https://legislation.nt.gov.au/api/sitecore/Act/PDF?id=11583', confidence: 'high' },
  'AU-QLD': { age: 18, citation: 'Law Reform Act 1995 (Qld), s. 17', sourceUrl: 'https://www.legislation.qld.gov.au/view/html/inforce/current/act-1995-lra', confidence: 'high' },
  'AU-SA': {
    age: 18,
    citation: 'Age of Majority (Reduction) Act 1971 (SA), s. 3',
    sourceUrl: 'https://www.legislation.sa.gov.au/__legislation/lz/c/a/age%20of%20majority%20(reduction)%20act%201971/current/1971.15.auth.pdf',
    confidence: 'medium',
    note: 'Reported: the Legislation Interpretation Act 2021 (SA), s. 49(2), has a person born on 29 February attain an age on 1 March in a common year, which is the default here anyway. Its text could not be reached in two reviews, so it is not cited.',
  },
  'AU-TAS': { age: 18, citation: 'Age of Majority Act 1973 (Tas), s. 3', sourceUrl: 'https://www.legislation.tas.gov.au/view/whole/html/inforce/current/act-1973-021', confidence: 'high' },
  'AU-VIC': { age: 18, citation: 'Age of Majority Act 1977 (Vic), s. 3', sourceUrl: 'https://www.legislation.vic.gov.au/in-force/acts/age-majority-act-1977', confidence: 'high' },
  'AU-WA': { age: 18, citation: 'Age of Majority Act 1972 (WA), s. 5(1)(a)', sourceUrl: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/RedirectURL?OpenAgent=&query=mrdoc_22.pdf', confidence: 'high' },
};

const UK = {
  GB: {
    age: 18,
    effectiveFrom: '1970-01-01',
    citation: 'Family Law Reform Act 1969, s. 1(1) (England and Wales); Age of Majority (Scotland) Act 1969, s. 1(1); Age of Majority Act (Northern Ireland) 1969, s. 1(1)',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1969/46/section/1',
    confidence: 'high',
    note: 'Each of the three UK jurisdictions sets 18 by its own Act; ask for GB-ENG, GB-WLS, GB-SCT or GB-NIR for the specific provision. In Scotland, legal capacity is acquired at 16.',
  },
  'GB-ENG': {
    age: 18,
    effectiveFrom: '1970-01-01',
    citation: 'Family Law Reform Act 1969, s. 1(1); s. 9 (time at which an age is attained)',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1969/46/section/1',
    confidence: 'high',
    note: 's. 9: an age is attained at the start of the anniversary.',
  },
  'GB-WLS': {
    age: 18,
    effectiveFrom: '1970-01-01',
    citation: 'Family Law Reform Act 1969, s. 1(1); s. 9 (time at which an age is attained)',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1969/46/section/1',
    confidence: 'high',
    note: 's. 9: an age is attained at the start of the anniversary.',
  },
  'GB-SCT': {
    age: 18,
    effectiveFrom: '1970-01-01',
    citation: 'Age of Majority (Scotland) Act 1969, s. 1(1); Age of Legal Capacity (Scotland) Act 1991, s. 6(2) (29 February births)',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1969/39/section/1',
    confidence: 'high',
    leapDay: 'mar1',
    note: 'Majority is 18, but a person of 16 has full legal capacity to enter transactions (Age of Legal Capacity (Scotland) Act 1991, s. 1(1)). s. 6(2) of that Act: a person born on 29 February attains an age, in a common year, on 1 March.',
  },
  'GB-NIR': {
    age: 18,
    effectiveFrom: '1970-01-01',
    citation: 'Age of Majority Act (Northern Ireland) 1969, s. 1(1); s. 5(1) (time at which an age is attained)',
    sourceUrl: 'https://www.legislation.gov.uk/apni/1969/28/section/1',
    confidence: 'high',
    note: 's. 5(1): an age is attained at the start of the anniversary. In force 1970-01-01 (SR&O (NI) 1969 No. 327).',
  },
};

const EUROPE = {
  AT: { age: 18, citation: 'ABGB § 21(2)', sourceUrl: 'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001622&Paragraf=21', confidence: 'high' },
  BE: {
    age: 18,
    effectiveFrom: '1990-05-01',
    citation: 'Code civil, art. 388',
    sourceUrl: 'https://www.ejustice.just.fgov.be/eli/loi/1804/03/21/1804032150/justel',
    confidence: 'medium',
    note: 'Lowered from 21 by the Law of 19 January 1990, in force 1990-05-01 (date from a secondary source).',
  },
  BG: { age: 18, citation: 'Закон за лицата и семейството (Persons and Family Act), чл. 2', sourceUrl: 'https://lex.bg/laws/ldoc/2121624577', confidence: 'medium' },
  HR: { age: 18, citation: 'Obiteljski zakon (Family Act), čl. 117(3)', sourceUrl: 'https://www.zakon.hr/z/88/Obiteljski-zakon', confidence: 'medium', note: 'Read in an unofficial consolidation.' },
  CZ: { age: 18, citation: 'Občanský zákoník, zákon č. 89/2012 Sb., § 30(1)', sourceUrl: 'https://e-sbirka.gov.cz/sb/2012/89', confidence: 'high' },
  DK: { age: 18, citation: 'Værgemålsloven § 1(1)', sourceUrl: 'https://www.retsinformation.dk/eli/lta/2021/1122', confidence: 'high', note: 'The linked consolidation (LBK 1122 of 2021) may have been replaced by a later one; § 1(1) is unchanged.' },
  EE: { age: 18, citation: 'Tsiviilseadustiku üldosa seadus § 8(2)', sourceUrl: 'https://www.riigiteataja.ee/akt/131122024048', confidence: 'high' },
  FI: { age: 18, citation: 'Laki holhoustoimesta 442/1999, 2 §', sourceUrl: 'https://www.finlex.fi/fi/lainsaadanto/1999/442', confidence: 'high' },
  FR: {
    age: 18,
    effectiveFrom: '1974-07-07',
    citation: 'Code civil, art. 414 (art. 488 until 2008-12-31)',
    sourceUrl: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006427400',
    confidence: 'medium',
    note: 'Lowered from 21 by Loi n° 74-631 of 5 July 1974; 1974-07-07 is its publication in the Journal officiel, and the exact in-force date was not confirmed. The rule was art. 488 until Loi 2007-308 renumbered it from 2009-01-01.',
  },
  DE: { age: 18, citation: 'BGB § 2', sourceUrl: 'https://www.gesetze-im-internet.de/bgb/__2.html', confidence: 'high' },
  HU: { age: 18, citation: 'Polgári Törvénykönyv (Ptk.) 2:10. § (1)', sourceUrl: 'https://njt.hu/jogszabaly/2013-5-00-00', confidence: 'high' },
  IE: {
    age: 18,
    effectiveFrom: '1985-03-01',
    citation: 'Age of Majority Act 1985, s. 2(1); s. 4(1) (time at which an age is attained); s. 9(2) (commencement)',
    sourceUrl: 'https://www.irishstatutebook.ie/eli/1985/act/2/enacted/en/print',
    confidence: 'high',
    note: 'Full age is also attained on marriage before 18. s. 4(1): an age is attained at the start of the anniversary.',
  },
  IT: { age: 18, effectiveFrom: '1975-03-10', citation: 'Codice civile, art. 2', sourceUrl: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:regio.decreto:1942-03-16;262:2~art2', confidence: 'high' },
  LV: { age: 18, citation: 'Civillikums, 219. pants', sourceUrl: 'https://likumi.lv/ta/id/225418-civillikums', confidence: 'high' },
  LT: { age: 18, citation: 'Civilinis kodeksas, 2.5 str. 1 d.', sourceUrl: 'https://e-seimas.lrs.lt/rs/actualedition/TAIS.107687/YqZdEHkNHy/format/OO3_ODT/', confidence: 'high' },
  LU: { age: 18, citation: 'Code civil, art. 488', sourceUrl: 'https://legilux.public.lu', confidence: 'medium' },
  MT: { age: 18, citation: 'Civil Code, Cap. 16, art. 188(1)', sourceUrl: 'https://legislation.mt/eli/cap/16/eng', confidence: 'high' },
  NL: {
    age: 18,
    citation: 'Burgerlijk Wetboek, Boek 1, art. 233',
    sourceUrl: 'https://wetten.overheid.nl/jci1.3:c:BWBR0002656&boek=1&titeldeel=13&artikel=233',
    confidence: 'high',
    note: 'A court may declare a person of 16 or 17 of age (art. 1:253ha).',
  },
  PL: { age: 18, citation: 'Kodeks cywilny, art. 10 § 1', sourceUrl: 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093', confidence: 'high' },
  PT: { age: 18, citation: 'Código Civil, art. 122', sourceUrl: 'https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075', confidence: 'high' },
  RO: { age: 18, citation: 'Codul civil, art. 38(2)', sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/175630', confidence: 'high' },
  SK: { age: 18, citation: 'Občiansky zákonník, § 8(2)', sourceUrl: 'https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/1964/40/', confidence: 'medium' },
  SI: {
    age: 18,
    citation: 'Družinski zakonik (Family Code), arts. 5, 152',
    sourceUrl: 'https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/2017-01-0729/druzinski-zakonik-dz',
    confidence: 'high',
    note: 'Art. 5: a child is a person under 18; art. 152: full capacity at 18.',
  },
  ES: {
    age: 18,
    citation: 'Código Civil, art. 240',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763#art240',
    confidence: 'high',
    note: 'The rule was in article 315 until 2021-09-03; the age did not change.',
  },
  SE: { age: 18, citation: 'Föräldrabalken, 9 kap. 1 §', sourceUrl: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/foraldrabalk-1949381_sfs-1949-381/', confidence: 'high' },
  IS: { age: 18, citation: 'Lögræðislög nr. 71/1997, 1. gr.', sourceUrl: 'https://www.althingi.is/lagas/nuna/1997071.html', confidence: 'high' },
  LI: { age: 18, citation: 'Personen- und Gesellschaftsrecht (PGR), Art. 12', sourceUrl: 'https://www.gesetze.li/konso/1926004000', confidence: 'high', note: 'Set at 18 by LGBl. 2000 Nr. 41 (20 before); the in-force date was not confirmed, so earlier dates also answer 18.' },
  NO: { age: 18, citation: 'Vergemålsloven § 8', sourceUrl: 'https://lovdata.no/dokument/NL/lov/2010-03-26-9', confidence: 'high' },
  CH: {
    age: 18,
    effectiveFrom: '1996-01-01',
    citation: 'Zivilgesetzbuch (ZGB), Art. 14',
    sourceUrl: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de',
    confidence: 'high',
    note: 'Lowered from 20, in force 1996-01-01 (Federal Act of 7 Oct. 1994, AS 1995 1126).',
  },
};

const REST_OF_WORLD = {
  NZ: {
    age: 20,
    effectiveFrom: '1971-01-01',
    citation: 'Age of Majority Act 1970, s. 4(1); s. 5 (time at which an age is attained)',
    sourceUrl: 'https://legislation.govt.nz/act/public/1970/137/en/latest/',
    confidence: 'high',
    note: 'Lowered from 21, in force 1971-01-01. s. 4(3): where another enactment sets its own age (several use 18), that enactment governs its own subject. s. 5: an age is attained at the start of the anniversary.',
  },
  MX: {
    age: 18,
    citation: 'Código Civil Federal, art. 646',
    sourceUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf',
    confidence: 'high',
    note: 'The federal Civil Code. Each state has its own civil code; those were not checked.',
  },
  JP: [
    {
      age: 20,
      citation: 'Civil Code (Act No. 89 of 1896), art. 4, as in force until 2022-03-31',
      sourceUrl: 'https://laws.e-gov.go.jp/api/1/articles;lawId=129AC0000000089;article=4',
      confidence: 'high',
      leapDay: 'mar1',
      note: 'Act on Calculation of Age (1902): the day of birth counts as a whole day, so an age is attained when the day before the anniversary expires — the first instant of the anniversary, and of 1 March for a 29 February birth in a common year.',
    },
    {
      age: 18,
      effectiveFrom: '2022-04-01',
      citation: 'Civil Code (Act No. 89 of 1896), art. 4',
      sourceUrl: 'https://laws.e-gov.go.jp/api/1/articles;lawId=129AC0000000089;article=4',
      confidence: 'high',
      leapDay: 'mar1',
      note: 'Lowered from 20; everyone aged 18 or 19 on 2022-04-01 came of age that day. Act on Calculation of Age (1902): an age is attained at the first instant of the anniversary, and of 1 March for a 29 February birth in a common year.',
    },
  ],
  KR: [
    {
      age: 20,
      citation: 'Civil Act, art. 4, as in force until 2013-06-30',
      sourceUrl: 'https://elaw.klri.re.kr/kor_service/lawViewMultiContent.do?hseq=29453',
      confidence: 'medium',
      leapDay: 'mar1',
      note: 'Art. 158 (as in Japan): the day of birth counts, so an age is attained at the first instant of the anniversary; art. 160(3) makes it 1 March for a 29 February birth in a common year.',
    },
    {
      age: 19,
      effectiveFrom: '2013-07-01',
      citation: 'Civil Act, art. 4',
      sourceUrl: 'https://elaw.klri.re.kr/kor_service/lawViewMultiContent.do?hseq=29453',
      confidence: 'high',
      leapDay: 'mar1',
      note: 'Lowered from 20 by Act No. 10429 of 2011-03-07, in force 2013-07-01 (Addenda, art. 1). Arts. 158 and 160(3): an age is attained at the first instant of the anniversary, and of 1 March for a 29 February birth in a common year.',
    },
  ],
  TW: [
    {
      age: 20,
      citation: 'Civil Code, art. 12, as in force until 2022-12-31',
      sourceUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=12',
      confidence: 'medium',
      leapDay: 'mar1',
      note: 'Arts. 121 and 124: the day of birth counts, so an age is attained at the first instant of the anniversary (1 March for a 29 February birth in a common year).',
    },
    {
      age: 18,
      effectiveFrom: '2023-01-01',
      citation: 'Civil Code, art. 12',
      sourceUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=12',
      confidence: 'high',
      leapDay: 'mar1',
      note: 'Lowered from 20, in force 2023-01-01 (Enforcement Act of the General Principles of the Civil Code, art. 3-1: https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000002&flno=3-1). Arts. 121 and 124: an age is attained at the first instant of the anniversary, and of 1 March for a 29 February birth in a common year.',
    },
  ],
  CN: { age: 18, citation: 'Civil Code of the PRC, art. 17', sourceUrl: 'https://www.court.gov.cn/zixun/xiangqing/233181.html', confidence: 'medium' },
  MY: {
    age: 18,
    citation: 'Age of Majority Act 1971, s. 2; s. 3(2) (time at which an age is attained)',
    sourceUrl: 'https://www.commonlii.org/my/legis/consol_act/aoma1971153/',
    confidence: 'medium',
    note: 's. 3(2): an age is attained at the start of the anniversary.',
  },
  TH: { age: 20, citation: 'Civil and Commercial Code, s. 19', sourceUrl: 'https://www.thailawonline.com/thai-civil-code/section-19/', confidence: 'medium', note: 'Read in an unofficial English translation.' },
  PH: {
    age: 18,
    citation: 'Family Code, art. 234, as amended by Republic Act No. 6809',
    sourceUrl: 'https://lawphil.net/statutes/repacts/ra1989/ra_6809_1989.html',
    confidence: 'medium',
    note: 'Set at 18 by Republic Act No. 6809, approved 1989-12-13.',
  },
  VN: { age: 18, citation: 'Civil Code 2015, art. 20', sourceUrl: 'https://thuvienphapluat.vn/hoi-dap-phap-luat/nang-luc-hanh-vi-dan-su-la-gi-123168.html', confidence: 'medium' },
  IN: {
    age: 18,
    citation: 'Majority Act 1875, s. 3',
    sourceUrl: 'https://www.legitquest.com/act/majority-act-1875/27EA',
    confidence: 'medium',
    note: 'The rule extending minority to 21 for a person under a court-appointed guardian was removed with effect from 1999-12-16.',
  },
  TR: { age: 18, citation: 'Türk Medeni Kanunu (Civil Code) No. 4721, art. 11', sourceUrl: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.4721.pdf', confidence: 'high' },
  EG: { age: 21, citation: 'Civil Code, art. 44', sourceUrl: 'https://hrlibrary.law.umn.edu/research/Egypt/Civil%20Law.pdf', confidence: 'medium', note: 'Counted in Gregorian years. Read in an unofficial English translation.' },
  ZA: {
    age: 18,
    effectiveFrom: '2007-07-01',
    citation: "Children's Act 38 of 2005, s. 17",
    sourceUrl: 'https://www.gov.za/sites/default/files/gcis_document/201409/a38-053.pdf',
    confidence: 'high',
    note: 'Lowered from 21, in force 2007-07-01.',
  },
  KE: { age: 18, citation: 'Age of Majority Act, Cap. 33, s. 2', sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/1974/1/eng@1974-04-05', confidence: 'high' },
  BR: [
    {
      age: 21,
      citation: 'Código Civil de 1916 (Lei 3.071/1916), art. 9, as in force until 2003-01-10',
      sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l3071.htm',
      confidence: 'high',
    },
    {
      age: 18,
      effectiveFrom: '2003-01-11',
      citation: 'Código Civil (Lei 10.406/2002), art. 5',
      sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
      confidence: 'high',
      note: 'Lowered from 21 when the 2002 Civil Code took effect.',
    },
  ],
  AR: { age: 18, citation: 'Código Civil y Comercial de la Nación, art. 25 (Ley 26.994)', sourceUrl: 'https://www.colegio-escribanos.org.ar/noticias/2009-12-22_Ley_26579.pdf', confidence: 'medium', note: 'Lowered to 18 by Ley 26.579 (published 2009-12-22), which the link reproduces; the Civil and Commercial Code of 2015 (Ley 26.994) keeps 18 in art. 25. The in-force date was not confirmed, so earlier dates also answer 18.' },
  UY: {
    age: 18,
    effectiveFrom: '1995-10-19',
    citation: 'Código Civil, art. 280, as amended by Ley 16.719',
    sourceUrl: 'https://impo.com.uy/bases/leyes-originales/16719-1995',
    confidence: 'medium',
    note: 'Ley 16.719, published 1995-10-19; it has no commencement clause, so it took effect a few days later under Código Civil art. 1, on a date not confirmed.',
  },
};

const MAJORITY = {
  US: {
    bySubdivision: true,
    note: 'Set by each state, the District of Columbia and each territory. Ask for the state (US-AL, US-MS, ...) or territory (PR).',
  },
  CA: {
    bySubdivision: true,
    note: 'Set by each province and territory. Ask for the province (CA-BC, CA-ON, ...).',
  },
  AU: {
    bySubdivision: true,
    note: 'Set by each state and territory; no general Commonwealth statute was found. Ask for the state (AU-NSW, AU-SA, ...).',
  },
  ...US_STATES,
  ...CA_PROVINCES,
  ...AU_STATES,
  ...UK,
  ...EUROPE,
  ...REST_OF_WORLD,
};

// ── Digital consent ─────────────────────────────────────────────

const DIGITAL_CONSENT = {
  US: {
    age: 13,
    effectiveFrom: '2000-04-21',
    citation: "Children's Online Privacy Protection Act, 15 U.S.C. § 6501(1); 16 CFR § 312.2",
    sourceUrl: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section6501&num=0&edition=prelim',
    confidence: 'high',
    note: 'COPPA: an operator needs verifiable parental consent to collect personal information from a child under 13. It applies in every state, DC and the territories. The 2025 amendments to the Rule keep 13. State laws that restrict particular uses (targeted advertising, sale, profiling) for older minors are purpose-specific and not encoded.',
  },
  'CA-QC': {
    age: 14,
    effectiveFrom: '2023-09-22',
    citation: 'Act respecting the protection of personal information in the private sector, CQLR c. P-39.1, ss. 4.1, 14',
    sourceUrl: 'https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1',
    confidence: 'high',
    note: 'Under 14, consent is given by the person having parental authority. In force 2023-09-22: S.Q. 2021, c. 25 (Law 25), ss. 104, 110 and 175 (https://www.publicationsduquebec.gouv.qc.ca/fileadmin/Fichiers_client/lois_et_reglements/LoisAnnuelles/en/2021/2021C25A.PDF).',
  },
  BR: {
    age: 12,
    effectiveFrom: '2020-09-18',
    citation: 'Lei Geral de Proteção de Dados (Lei 13.709/2018), art. 14 § 1; Estatuto da Criança e do Adolescente, art. 2',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm',
    confidence: 'medium',
    note: 'Processing the data of a child (under 12, per the ECA) needs specific consent from a parent or guardian. Since 2026-03-17, Lei 15.211 also requires accounts of users up to 16 to be linked to a guardian; that is not encoded. The in-force date rests on a secondary source.',
  },
  CN: {
    age: 14,
    effectiveFrom: '2021-11-01',
    citation: 'Personal Information Protection Law, art. 31',
    sourceUrl: 'https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm',
    confidence: 'high',
    note: 'Processing the personal information of a minor under 14 needs the consent of a parent or guardian; such information is sensitive personal information (art. 28).',
  },
  KR: {
    age: 14,
    citation: 'Personal Information Protection Act, art. 22-2',
    sourceUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=248613',
    confidence: 'high',
    note: 'Art. 22-2 since 2023-09-15; the same age was set by art. 22(6) from 2011-09-30. Both dates rest on secondary sources, so no start date is recorded.',
  },
  ZA: {
    age: 18,
    effectiveFrom: '2021-07-01',
    citation: 'Protection of Personal Information Act 4 of 2013, s. 1 ("child"), ss. 34–35',
    sourceUrl: 'https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-POPIA-act2013-004.pdf',
    confidence: 'medium',
    note: 'A "child" is anyone under 18; processing their information needs the consent of a competent person. The sections commenced 2020-07-01, with compliance required from 2021-07-01.',
  },
  CO: {
    age: 18,
    effectiveFrom: '2012-10-18',
    citation: 'Ley Estatutaria 1581 de 2012, art. 7',
    sourceUrl: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html',
    confidence: 'medium',
    note: 'Art. 7 restricts processing the data of children and adolescents (under 18). Reading it as a consent age of 18 rests on a secondary source.',
  },
  CL: {
    age: 14,
    effectiveFrom: '2026-12-01',
    citation: 'Ley 19.628 as amended by Ley 21.719, art. 16 quáter',
    sourceUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=1209272',
    confidence: 'high',
    note: 'In force from 2026-12-01. Before then no statutory consent age is recorded. Processing the sensitive data of an adolescent under 16 still needs a parent\'s consent.',
  },

  // GDPR Art. 8: 16 unless a member state sets a lower age, not below 13.
  AT: {
    age: 14,
    effectiveFrom: GDPR_START,
    citation: 'Datenschutzgesetz (DSG) § 4(4)',
    sourceUrl: 'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597',
    confidence: 'high',
  },
  BE: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2018-09-05',
      citation: 'Loi du 30 juillet 2018 relative à la protection des personnes physiques à l’égard des traitements de données à caractère personnel, art. 7',
      sourceUrl: 'https://www.ejustice.just.fgov.be/eli/loi/2018/07/30/2018040581/justel',
      confidence: 'high',
    },
  ],
  BG: [
    gdprDefault(),
    {
      age: 14,
      effectiveFrom: '2019-03-02',
      citation: 'Закон за защита на личните данни (Personal Data Protection Act), чл. 25в',
      sourceUrl: 'https://kik-info.com/normativna-baza/zakoni/zzld/',
      confidence: 'medium',
      note: 'Applies to all consent-based processing of the data of a person under 14, not only online services. The in-force date is assumed from the amending Act.',
    },
  ],
  HR: gdprNoDerogation(
    'Zakon o provedbi Opće uredbe o zaštiti podataka (NN 42/2018), čl. 19',
    'https://narodne-novine.nn.hr/clanci/sluzbeni/2018_05_42_805.html',
    'high',
    'The implementing Act sets 16 expressly.',
  ),
  CY: [
    gdprDefault(),
    {
      age: 14,
      effectiveFrom: '2018-07-31',
      citation: 'Ν. 125(I)/2018, άρθρο 8',
      sourceUrl: 'http://www.cylaw.org/nomoi/enop/non-ind/2018_1_125/full.html',
      confidence: 'medium',
      note: 'Read in the Cyprus Bar Association\'s compilation, not the Official Gazette.',
    },
  ],
  CZ: [
    gdprDefault(),
    {
      age: 15,
      effectiveFrom: '2019-04-24',
      citation: 'Zákon č. 110/2019 Sb., o zpracování osobních údajů, § 7',
      sourceUrl: 'https://e-sbirka.gov.cz/sb/2019/110',
      confidence: 'high',
    },
  ],
  DK: [
    {
      age: 13,
      effectiveFrom: GDPR_START,
      citation: 'Databeskyttelsesloven (Lov nr. 502 of 2018) § 6, stk. 2',
      sourceUrl: 'https://www.retsinformation.dk/eli/lta/2018/502',
      confidence: 'high',
    },
    {
      age: 15,
      effectiveFrom: '2024-01-01',
      citation: 'Databeskyttelsesloven § 6, stk. 2–3, as amended by Lov nr. 1783 of 2023 (LBK nr. 289 of 2024)',
      sourceUrl: 'https://www.retsinformation.dk/eli/lta/2024/289',
      confidence: 'high',
      note: 'Raised from 13 by Lov nr. 1783 of 2023-12-28, in force 2024-01-01.',
    },
  ],
  EE: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2019-01-15',
      citation: 'Isikuandmete kaitse seadus § 8',
      sourceUrl: 'https://www.riigiteataja.ee/akt/104012019011',
      confidence: 'high',
    },
  ],
  FI: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2019-01-01',
      citation: 'Tietosuojalaki 1050/2018, 5 §',
      sourceUrl: 'https://www.finlex.fi/fi/laki/ajantasa/2018/20181050',
      confidence: 'high',
    },
  ],
  FR: [
    gdprDefault(),
    {
      age: 15,
      effectiveFrom: '2018-06-22',
      citation: 'Loi n° 78-17 du 6 janvier 1978, art. 45',
      sourceUrl: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037823135',
      confidence: 'high',
      note: 'Under 15, consent must be given jointly by the minor and the holder of parental authority. Art. 7-1 until 2019-05-31 (inserted by Loi n° 2018-493), renumbered art. 45 by Ordonnance n° 2018-1125.',
    },
  ],
  DE: gdprNoDerogation(
    'the BDSG sets no other age',
    'https://www.gesetze-im-internet.de/bdsg_2018/',
    'high',
    'No derogation: the GDPR default of 16 applies.',
  ),
  GR: [
    gdprDefault(),
    {
      age: 15,
      effectiveFrom: '2019-08-29',
      citation: 'Ν. 4624/2019, άρθρο 21',
      sourceUrl: 'https://www.dpa.gr/sites/default/files/2020-08/LAW%204624_2019_EN_TRANSLATED%20BY%20THE%20HDPA.PDF',
      confidence: 'medium',
      note: 'The link is the data protection authority’s English translation.',
    },
  ],
  HU: gdprNoDerogation(
    'the Infotv. sets no other age',
    'https://net.jogtar.hu/jogszabaly?docid=a1100112.tv',
    'medium',
    'No derogation: the GDPR default of 16 applies.',
  ),
  IE: {
    age: 16,
    effectiveFrom: GDPR_START,
    citation: 'Data Protection Act 2018, s. 31',
    sourceUrl: 'https://www.irishstatutebook.ie/eli/2018/act/7/section/31/enacted/en/html',
    confidence: 'high',
  },
  IT: [
    gdprDefault(),
    {
      age: 14,
      effectiveFrom: '2018-09-19',
      citation: 'D.Lgs. 196/2003 (Codice in materia di protezione dei dati personali), art. 2-quinquies',
      sourceUrl: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196~art2quinquies',
      confidence: 'high',
    },
  ],
  LV: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2018-07-05',
      citation: 'Fizisko personu datu apstrādes likums, 33. pants',
      sourceUrl: 'https://likumi.lv/ta/id/300099-fizisko-personu-datu-apstrades-likums',
      confidence: 'high',
    },
  ],
  LT: [
    gdprDefault(),
    {
      age: 14,
      effectiveFrom: '2018-07-16',
      citation: 'Asmens duomenų teisinės apsaugos įstatymas (I-1374, as recast by XIII-1426), 6 str.',
      sourceUrl: 'https://e-seimas.lrs.lt/rs/legalact/TAD/bc0837f27f9511e89188e16a6495e98c/',
      confidence: 'high',
    },
  ],
  LU: gdprNoDerogation(
    'the Loi du 1er août 2018 sets no other age',
    'https://data.legilux.public.lu/file/eli-etat-leg-loi-2018-08-01-a686-jo-fr-pdf.pdf',
    'high',
    'No derogation: the GDPR default of 16 applies.',
  ),
  MT: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2018-06-01',
      citation: 'Processing of Child’s Personal Data in relation to the Offer of Information Society Services Regulations, S.L. 586.11, reg. 4',
      sourceUrl: 'https://legislation.mt/eli/sl/586.11/eng/pdf',
      confidence: 'high',
    },
  ],
  NL: gdprNoDerogation(
    'Uitvoeringswet AVG, art. 5(1)',
    'https://wetten.overheid.nl/BWBR0040940/',
    'high',
    'No derogation: the GDPR default of 16 applies, and art. 5(1) extends it to consent for processing other than online services.',
  ),
  PL: gdprNoDerogation(
    'Polish law sets no other age',
    'https://api.sejm.gov.pl/eli/acts/DU/2019/1781/text.pdf',
    'high',
    'No derogation: the GDPR default of 16 applies.',
  ),
  PT: [
    gdprDefault(),
    {
      age: 13,
      effectiveFrom: '2019-08-09',
      citation: 'Lei n.º 58/2019, art. 16',
      sourceUrl: 'https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf',
      confidence: 'high',
    },
  ],
  RO: gdprNoDerogation(
    'Legea 190/2018 sets no other age',
    GDPR.sourceUrl,
    'medium',
    'No derogation: the GDPR default of 16 applies. The national text was not read at an official source; the link is to the GDPR.',
  ),
  SK: gdprNoDerogation(
    'Zákon č. 18/2018 Z. z. sets no lower age for GDPR processing',
    'https://static.slov-lex.sk/pdf/SK/ZZ/2018/18/ZZ_2018_18_20260818.pdf',
    'high',
    'No derogation: the GDPR default of 16 applies. § 15(1) of the national Act also uses 16, for processing outside the GDPR.',
  ),
  SI: [
    gdprDefault(),
    {
      age: 15,
      effectiveFrom: '2023-01-26',
      citation: 'Zakon o varstvu osebnih podatkov (ZVOP-2), Ur. l. RS 163/2022, 8. člen',
      sourceUrl: 'https://www.uradni-list.si/_pdf/2022/Ur/u2022163.pdf',
      confidence: 'high',
    },
  ],
  ES: [
    gdprDefault('The GDPR default of 16, which applied until the national derogation took effect. (The earlier Real Decreto 1720/2007, art. 13, already used 14 for consent to data processing.)'),
    {
      age: 14,
      effectiveFrom: '2018-12-07',
      citation: 'Ley Orgánica 3/2018 (LOPDGDD), art. 7',
      sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673',
      confidence: 'high',
      note: 'A draft law raising the age to 16 had not been enacted as of the tables’ date.',
    },
  ],
  SE: {
    age: 13,
    effectiveFrom: GDPR_START,
    citation: 'Lag (2018:218) med kompletterande bestämmelser till EU:s dataskyddsförordning, 2 kap. 4 §',
    sourceUrl: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser_sfs-2018-218/',
    confidence: 'high',
  },

  // EEA: the GDPR applies from 2018-07-20.
  IS: {
    age: 13,
    effectiveFrom: '2018-07-15',
    citation: 'Lög nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga, 10. gr.',
    sourceUrl: 'https://www.althingi.is/lagas/nuna/2018090.html',
    confidence: 'high',
  },
  LI: gdprNoDerogation(
    'the Datenschutzgesetz sets no other age',
    'https://www.gesetze.li/konso/html/2018272000?version=4',
    'high',
    'No derogation: the GDPR default of 16 applies, from the GDPR’s entry into the EEA Agreement.',
    '2018-07-20',
  ),
  NO: {
    age: 13,
    effectiveFrom: '2018-07-20',
    citation: 'Personopplysningsloven § 5',
    sourceUrl: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/%C2%A75',
    confidence: 'high',
    note: 'In October 2025 the government consulted on raising the age to 15; not enacted as of AS_OF.',
  },

  GB: {
    age: 13,
    effectiveFrom: GDPR_START,
    citation: 'Data Protection Act 2018, s. 9; since 2020-12-31, UK GDPR art. 8(1)',
    sourceUrl: 'https://www.legislation.gov.uk/eur/2016/679/article/8',
    confidence: 'high',
    note: 'Applies throughout the UK. The power added in 2026 to change the age by regulations (art. 8(2A)–(2B)) had not been used as of the tables’ date.',
  },
};

module.exports = { AS_OF, MAJORITY, DIGITAL_CONSENT };
