#!/usr/bin/env node
/**
 * Synthetic data generator for the KSP Crime Intelligence Platform.
 *
 * Produces realistic, internally-consistent seed data for the full FIR schema.
 * The data is deliberately structured so that the platform's analytics have
 * something real to find:
 *
 *   - Repeat offenders: a pool of "career criminals" reused across many FIRs,
 *     forming co-accused networks and gangs.
 *   - Hotspots: incidents cluster around a handful of geographic centres per
 *     district instead of being uniformly scattered.
 *   - Temporal trends: seasonal + weekend effects and a rising theft trend.
 *   - Socio-demographic signal: age/gender/occupation skews by crime type.
 *
 * Output: one JSON file per table under data/seed/, plus a manifest.
 * No external dependencies — deterministic via a seeded PRNG so demos repeat.
 */

const fs = require('fs');
const path = require('path');
const { TABLES } = require('./schema/schema');

const SEED_DIR = path.join(__dirname, 'seed');

// ---- Deterministic PRNG (mulberry32) ------------------------------------
let _seed = 0x9e3779b9;
function rng() {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randint = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;
function weightedPick(pairs) {
  // pairs: [[value, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

// ---- Reference data -----------------------------------------------------
const KA_DISTRICTS = [
  'Bengaluru City', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubballi-Dharwad',
  'Belagavi', 'Kalaburagi', 'Ballari', 'Vijayapura', 'Davanagere',
  'Shivamogga', 'Tumakuru', 'Udupi', 'Hassan', 'Mandya',
];
// Approx centres (lat, lng) for hotspot clustering.
const DISTRICT_CENTRES = {
  'Bengaluru City': [12.9716, 77.5946], 'Bengaluru Rural': [13.2846, 77.6],
  Mysuru: [12.2958, 76.6394], Mangaluru: [12.9141, 74.856],
  'Hubballi-Dharwad': [15.3647, 75.124], Belagavi: [15.8497, 74.4977],
  Kalaburagi: [17.3297, 76.8343], Ballari: [15.1394, 76.9214],
  Vijayapura: [16.8302, 75.71], Davanagere: [14.4644, 75.9218],
  Shivamogga: [13.9299, 75.5681], Tumakuru: [13.3379, 77.101],
  Udupi: [13.3409, 74.7421], Hassan: [13.0068, 76.0996],
  Mandya: [12.5223, 76.8954],
};

const CRIME_HEADS = [
  { id: 1, name: 'Crimes Against Body' },
  { id: 2, name: 'Crimes Against Property' },
  { id: 3, name: 'Crimes Against Women' },
  { id: 4, name: 'Economic Offences' },
  { id: 5, name: 'Cyber Crimes' },
  { id: 6, name: 'Crimes Against Public Order' },
];
const CRIME_SUBHEADS = [
  { id: 1, head: 1, name: 'Murder' }, { id: 2, head: 1, name: 'Attempt to Murder' },
  { id: 3, head: 1, name: 'Grievous Hurt' }, { id: 4, head: 1, name: 'Kidnapping' },
  { id: 5, head: 2, name: 'House Burglary' }, { id: 6, head: 2, name: 'Theft' },
  { id: 7, head: 2, name: 'Robbery' }, { id: 8, head: 2, name: 'Dacoity' },
  { id: 9, head: 2, name: 'Motor Vehicle Theft' },
  { id: 10, head: 3, name: 'Dowry Harassment' }, { id: 11, head: 3, name: 'Sexual Assault' },
  { id: 12, head: 3, name: 'Domestic Violence' },
  { id: 13, head: 4, name: 'Cheating & Fraud' }, { id: 14, head: 4, name: 'Criminal Breach of Trust' },
  { id: 15, head: 5, name: 'Online Financial Fraud' }, { id: 16, head: 5, name: 'Identity Theft' },
  { id: 17, head: 6, name: 'Rioting' }, { id: 18, head: 6, name: 'Unlawful Assembly' },
];

const ACTS = [
  { code: 'BNS', desc: 'Bharatiya Nyaya Sanhita 2023', short: 'BNS' },
  { code: 'IPC', desc: 'Indian Penal Code 1860', short: 'IPC' },
  { code: 'NDPS', desc: 'Narcotic Drugs and Psychotropic Substances Act', short: 'NDPS' },
  { code: 'ITA', desc: 'Information Technology Act 2000', short: 'IT Act' },
  { code: 'MVA', desc: 'Motor Vehicles Act', short: 'MV Act' },
  { code: 'POCSO', desc: 'Protection of Children from Sexual Offences Act', short: 'POCSO' },
];
const SECTIONS = {
  BNS: [['103', 'Punishment for murder'], ['109', 'Attempt to murder'], ['309', 'Robbery'], ['303', 'Theft'], ['318', 'Cheating']],
  IPC: [['302', 'Murder'], ['307', 'Attempt to murder'], ['392', 'Robbery'], ['379', 'Theft'], ['420', 'Cheating'], ['498A', 'Cruelty by husband']],
  NDPS: [['20', 'Cannabis offences'], ['22', 'Psychotropic substances']],
  ITA: [['66C', 'Identity theft'], ['66D', 'Cheating by personation'], ['67', 'Obscene material']],
  MVA: [['184', 'Dangerous driving'], ['185', 'Drunk driving']],
  POCSO: [['4', 'Penetrative sexual assault'], ['8', 'Sexual assault']],
};

// Which subheads map to which act/section, for consistency.
const SUBHEAD_TO_SECTION = {
  Murder: ['BNS', '103'], 'Attempt to Murder': ['BNS', '109'],
  'Grievous Hurt': ['IPC', '307'], Kidnapping: ['IPC', '379'],
  'House Burglary': ['BNS', '303'], Theft: ['BNS', '303'],
  Robbery: ['BNS', '309'], Dacoity: ['BNS', '309'], 'Motor Vehicle Theft': ['MVA', '184'],
  'Dowry Harassment': ['IPC', '498A'], 'Sexual Assault': ['POCSO', '4'],
  'Domestic Violence': ['IPC', '498A'], 'Cheating & Fraud': ['BNS', '318'],
  'Criminal Breach of Trust': ['IPC', '420'], 'Online Financial Fraud': ['ITA', '66D'],
  'Identity Theft': ['ITA', '66C'], Rioting: ['IPC', '392'], 'Unlawful Assembly': ['IPC', '392'],
};

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Sikh', 'Other'];
const CASTES = ['General', 'OBC', 'SC', 'ST', 'Not Recorded'];
const OCCUPATIONS = ['Farmer', 'Daily Wage Labourer', 'Business', 'Government Employee',
  'Private Employee', 'Student', 'Unemployed', 'Driver', 'Homemaker', 'Retired'];
const CASE_STATUSES = ['Under Investigation', 'Charge Sheeted', 'Closed', 'Pending Trial', 'Disposed'];
const CASE_CATEGORIES = [['1', 'FIR'], ['3', 'UDR'], ['8', 'Zero FIR'], ['4', 'PAR']];
const GRAVITY = ['Heinous', 'Non-Heinous', 'Serious'];
const RANKS = [['Constable', 5], ['Head Constable', 4], ['ASI', 3], ['SI', 2], ['Inspector', 1], ['DSP', 0]];
const DESIGNATIONS = ['Investigating Officer', 'SHO', 'Beat Officer', 'Circle Inspector'];

const FIRST_NAMES = ['Ravi', 'Suresh', 'Manjunath', 'Prakash', 'Ganesh', 'Kiran', 'Naveen', 'Shivu',
  'Basavaraj', 'Ramesh', 'Lakshmi', 'Geetha', 'Kavya', 'Deepa', 'Anitha', 'Rekha', 'Nagaraj',
  'Venkatesh', 'Mahesh', 'Santosh', 'Imran', 'Ayesha', 'Fatima', 'John', 'Mary', 'Vijay', 'Arun'];
const LAST_NAMES = ['Gowda', 'Rao', 'Naik', 'Shetty', 'Hegde', 'Patil', 'Reddy', 'Kumar', 'Murthy',
  'Bhat', 'Kulkarni', 'Desai', 'Iyer', 'Shastri', 'Khan', "D'Souza", 'Jain', 'Prasad'];
const fullName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

// ---- Config -------------------------------------------------------------
const N_CASES = parseInt(process.env.N_CASES || '1200', 10);
const N_REPEAT_OFFENDERS = 60; // reused across cases -> networks
const YEAR_START = 2023;
const YEAR_END = 2026;

// ---- Build reference tables ---------------------------------------------
const db = {};
for (const t of Object.keys(TABLES)) db[t] = [];

// State
db.State.push({ StateID: 29, StateName: 'Karnataka', NationalityID: 1, Active: 1 });
db.State.push({ StateID: 1, StateName: 'Maharashtra', NationalityID: 1, Active: 1 });
db.State.push({ StateID: 33, StateName: 'Tamil Nadu', NationalityID: 1, Active: 1 });

// Districts
KA_DISTRICTS.forEach((name, i) => {
  db.District.push({ DistrictID: i + 1, DistrictName: name, StateID: 29, Active: 1 });
});

// UnitType
db.UnitType.push({ UnitTypeID: 1, UnitTypeName: 'Police Station', CityDistState: 'City', Hierarchy: 3, Active: 1 });
db.UnitType.push({ UnitTypeID: 2, UnitTypeName: 'Circle Office', CityDistState: 'District', Hierarchy: 2, Active: 1 });
db.UnitType.push({ UnitTypeID: 3, UnitTypeName: 'Sub-Division', CityDistState: 'District', Hierarchy: 1, Active: 1 });

// Units (police stations) — 3-6 per district
let unitId = 1000;
const unitsByDistrict = {};
db.District.forEach((d) => {
  unitsByDistrict[d.DistrictID] = [];
  const n = randint(3, 6);
  for (let i = 0; i < n; i++) {
    unitId++;
    const uName = `${d.DistrictName} PS ${['North', 'South', 'East', 'West', 'Central', 'Market'][i]}`;
    db.Unit.push({
      UnitID: unitId, UnitName: uName, TypeID: 1, ParentUnit: null,
      NationalityID: 1, StateID: 29, DistrictID: d.DistrictID, Active: 1,
    });
    unitsByDistrict[d.DistrictID].push(unitId);
  }
});

// Courts — 1-2 per district
let courtId = 500;
const courtsByDistrict = {};
db.District.forEach((d) => {
  courtsByDistrict[d.DistrictID] = [];
  const n = randint(1, 2);
  for (let i = 0; i < n; i++) {
    courtId++;
    db.Court.push({
      CourtID: courtId, CourtName: `${d.DistrictName} ${i === 0 ? 'Sessions' : 'JMFC'} Court`,
      DistrictID: d.DistrictID, StateID: 29, Active: 1,
    });
    courtsByDistrict[d.DistrictID].push(courtId);
  }
});

// Ranks / Designations
RANKS.forEach(([name, hier], i) => db.Rank.push({ RankID: i + 1, RankName: name, Hierarchy: hier, Active: 1 }));
DESIGNATIONS.forEach((name, i) => db.Designation.push({ DesignationID: i + 1, DesignationName: name, Active: 1, SortOrder: i + 1 }));

// Employees (officers) — populate each unit
let empId = 10000;
const empByUnit = {};
db.Unit.forEach((u) => {
  empByUnit[u.UnitID] = [];
  const n = randint(4, 8);
  for (let i = 0; i < n; i++) {
    empId++;
    db.Employee.push({
      EmployeeID: empId, DistrictID: u.DistrictID, UnitID: u.UnitID,
      RankID: randint(1, 6), DesignationID: randint(1, 4),
      KGID: `KG${empId}`, FirstName: fullName(),
      EmployeeDOB: `19${randint(70, 95)}-0${randint(1, 9)}-1${randint(0, 9)}`,
      GenderID: chance(0.85) ? 1 : 2, BloodGroupID: randint(1, 8),
      PhysicallyChallenged: 0, AppointmentDate: `20${randint(5, 20)}-0${randint(1, 9)}-15`,
    });
    empByUnit[u.UnitID].push(empId);
  }
});

// Masters
CRIME_HEADS.forEach((h) => db.CrimeHead.push({ CrimeHeadID: h.id, CrimeGroupName: h.name, Active: 1 }));
CRIME_SUBHEADS.forEach((s) => db.CrimeSubHead.push({ CrimeSubHeadID: s.id, CrimeHeadID: s.head, CrimeHeadName: s.name, SeqID: s.id }));
ACTS.forEach((a) => db.Act.push({ ActCode: a.code, ActDescription: a.desc, ShortName: a.short, Active: 1 }));
Object.entries(SECTIONS).forEach(([act, secs]) => secs.forEach(([code, desc]) => db.Section.push({ ActCode: act, SectionCode: code, SectionDescription: desc, Active: 1 })));
CASTES.forEach((c, i) => db.CasteMaster.push({ caste_master_id: i + 1, caste_master_name: c }));
RELIGIONS.forEach((r, i) => db.ReligionMaster.push({ ReligionID: i + 1, ReligionName: r }));
OCCUPATIONS.forEach((o, i) => db.OccupationMaster.push({ OccupationID: i + 1, OccupationName: o }));
CASE_STATUSES.forEach((s, i) => db.CaseStatusMaster.push({ CaseStatusID: i + 1, CaseStatusName: s }));
CASE_CATEGORIES.forEach(([code, val], i) => db.CaseCategory.push({ CaseCategoryID: i + 1, LookupValue: val, _code: code }));
GRAVITY.forEach((g, i) => db.GravityOffence.push({ GravityOffenceID: i + 1, LookupValue: g }));

// ---- Repeat offender pool (drives networks) -----------------------------
// Each has a home district and a preferred crime subhead, so gangs cluster.
const repeatOffenders = [];
for (let i = 0; i < N_REPEAT_OFFENDERS; i++) {
  repeatOffenders.push({
    name: fullName(),
    age: randint(22, 55),
    gender: weightedPick([[1, 0.9], [2, 0.1]]),
    homeDistrict: randint(1, KA_DISTRICTS.length),
    preferredSubhead: pick(CRIME_SUBHEADS).id,
    // gang id: cluster offenders into ~12 loose gangs
    gang: i % 12,
  });
}

// ---- Case generation ----------------------------------------------------
let complainantId = 0, victimId = 0, accusedId = 0, arrestId = 0, csId = 0;

function jitterCoord([lat, lng]) {
  // Hotspot: tight cluster around a couple of centres per district.
  return [lat + (rng() - 0.5) * 0.08, lng + (rng() - 0.5) * 0.08];
}
function randomDate(year) {
  // Seasonal weighting: more crime in summer months + festival season.
  const month = weightedPick([[1, 8], [2, 7], [3, 9], [4, 11], [5, 12], [6, 8],
    [7, 7], [8, 7], [9, 9], [10, 13], [11, 10], [12, 9]]);
  const day = randint(1, 28);
  return { year, month, day, str: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}
function crimeNo(catCode, districtId, unitIdVal, year, serial) {
  return `${catCode}${String(districtId).padStart(4, '0')}${String(unitIdVal).slice(-4).padStart(4, '0')}${year}${String(serial).padStart(5, '0')}`;
}

const BRIEF_TEMPLATES = {
  Theft: 'Complainant reports theft of belongings from residence/premises. Investigation under way.',
  Robbery: 'Armed individuals accosted the victim and forcibly took cash and valuables.',
  Murder: 'Body recovered; suspected homicide. Post-mortem and forensic examination ordered.',
  'Motor Vehicle Theft': 'Two-wheeler/four-wheeler reported stolen from public parking.',
  'Online Financial Fraud': 'Victim defrauded via fraudulent online transaction / UPI scam.',
  'Dowry Harassment': 'Complaint of harassment for dowry against in-laws and spouse.',
  Rioting: 'Group involved in public disturbance causing damage to property.',
};

let serialCounter = {};
for (let c = 0; c < N_CASES; c++) {
  const caseId = c + 1;
  const districtId = weightedPick(db.District.map((d) => [
    d.DistrictID,
    d.DistrictName.startsWith('Bengaluru') ? 4 : d.DistrictName === 'Mysuru' ? 2 : 1,
  ]));
  const unitIdVal = pick(unitsByDistrict[districtId]);
  const officer = pick(empByUnit[unitIdVal]);

  // Rising theft trend across years.
  const year = weightedPick([[2023, 6], [2024, 8], [2025, 11], [2026, 5]]);
  const d = randomDate(year);
  const subhead = pick(CRIME_SUBHEADS);
  const headId = subhead.head;

  const cat = pick(db.CaseCategory);
  const sKey = `${cat._code}-${districtId}-${year}`;
  serialCounter[sKey] = (serialCounter[sKey] || 0) + 1;
  const cno = crimeNo(cat._code, districtId, unitIdVal, year, serialCounter[sKey]);
  const [lat, lng] = jitterCoord(DISTRICT_CENTRES[db.District[districtId - 1].DistrictName]);

  const statusId = weightedPick([[1, 8], [2, 6], [3, 4], [4, 5], [5, 3]]);
  const gravityId = ['Murder', 'Attempt to Murder', 'Sexual Assault', 'Robbery', 'Dacoity'].includes(subhead.name)
    ? 1 : weightedPick([[2, 6], [3, 3]]);

  db.CaseMaster.push({
    CaseMasterID: caseId,
    CrimeNo: cno,
    CaseNo: cno.slice(-9),
    CrimeRegisteredDate: d.str,
    PolicePersonID: officer,
    PoliceStationID: unitIdVal,
    CaseCategoryID: cat.CaseCategoryID,
    GravityOffenceID: gravityId,
    CrimeMajorHeadID: headId,
    CrimeMinorHeadID: subhead.id,
    CaseStatusID: statusId,
    CourtID: pick(courtsByDistrict[districtId]),
    IncidentFromDate: `${d.str} ${String(randint(0, 23)).padStart(2, '0')}:00:00`,
    IncidentToDate: `${d.str} ${String(randint(0, 23)).padStart(2, '0')}:30:00`,
    InfoReceivedPSDate: `${d.str} ${String(randint(0, 23)).padStart(2, '0')}:45:00`,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    BriefFacts: BRIEF_TEMPLATES[subhead.name] || `Case registered under ${subhead.name}. Investigation in progress.`,
  });

  // Act-section association (consistent with subhead)
  const [actCode, secCode] = SUBHEAD_TO_SECTION[subhead.name] || ['BNS', '303'];
  db.ActSectionAssociation.push({ CaseMasterID: caseId, ActID: actCode, SectionID: secCode, ActOrderID: 1, SectionOrderID: 1 });

  // Complainant
  complainantId++;
  db.ComplainantDetails.push({
    ComplainantID: complainantId, CaseMasterID: caseId, ComplainantName: fullName(),
    AgeYear: randint(18, 70), OccupationID: randint(1, OCCUPATIONS.length),
    ReligionID: weightedPick([[1, 7], [2, 2], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]]),
    CasteID: randint(1, CASTES.length),
    GenderID: chance(0.5) ? 1 : 2,
  });

  // Victims (0-3)
  const nVictims = subhead.head === 3 ? randint(1, 2) : weightedPick([[0, 3], [1, 6], [2, 2], [3, 1]]);
  for (let v = 0; v < nVictims; v++) {
    victimId++;
    const vGender = subhead.head === 3 ? 2 : weightedPick([[1, 5], [2, 4], [3, 1]]);
    db.Victim.push({
      VictimMasterID: victimId, CaseMasterID: caseId, VictimName: fullName(),
      AgeYear: randint(5, 80), GenderID: vGender, VictimPolice: chance(0.02) ? '1' : '0',
    });
  }

  // Accused (1-4) — mix of repeat offenders (networks) and one-offs.
  const nAccused = weightedPick([[1, 6], [2, 3], [3, 2], [4, 1]]);
  const caseAccusedIds = [];
  // With good probability, pull a gang cluster of repeat offenders.
  const useGang = chance(0.45);
  let gangMembers = [];
  if (useGang) {
    const gangId = randint(0, 11);
    gangMembers = repeatOffenders.filter((r) => r.gang === gangId);
  }
  for (let a = 0; a < nAccused; a++) {
    accusedId++;
    let name, age, gender;
    if ((useGang && gangMembers.length) || chance(0.35)) {
      const off = gangMembers.length ? pick(gangMembers) : pick(repeatOffenders);
      name = off.name; age = off.age; gender = off.gender;
    } else {
      name = fullName(); age = randint(18, 60); gender = weightedPick([[1, 8], [2, 2]]);
    }
    db.Accused.push({
      AccusedMasterID: accusedId, CaseMasterID: caseId, AccusedName: name,
      AgeYear: age, GenderID: gender, PersonID: `A${a + 1}`,
    });
    caseAccusedIds.push(accusedId);
  }

  // Arrest/Surrender for some accused
  caseAccusedIds.forEach((accId) => {
    if (chance(0.55)) {
      arrestId++;
      db.ArrestSurrender.push({
        ArrestSurrenderID: arrestId, CaseMasterID: caseId,
        ArrestSurrenderTypeID: chance(0.85) ? 1 : 2,
        ArrestSurrenderDate: d.str, ArrestSurrenderStateId: 29,
        ArrestSurrenderDistrictId: districtId, PoliceStationID: unitIdVal,
        IOID: officer, CourtID: pick(courtsByDistrict[districtId]),
        AccusedMasterID: accId, IsAccused: 1, IsComplainantAccused: 0,
      });
    }
  });

  // Chargesheet for charge-sheeted / disposed cases
  if (statusId === 2 || statusId === 5) {
    csId++;
    db.ChargesheetDetails.push({
      CSID: csId, CaseMasterID: caseId,
      csdate: `${d.str} 10:00:00`,
      cstype: weightedPick([['A', 7], ['B', 1], ['C', 2]]),
      PolicePersonID: officer,
    });
  }
}

// ---- Write output -------------------------------------------------------
if (!fs.existsSync(SEED_DIR)) fs.mkdirSync(SEED_DIR, { recursive: true });
const manifest = {};
for (const [table, rows] of Object.entries(db)) {
  // Strip internal helper fields (prefixed with _)
  const clean = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) if (!k.startsWith('_')) o[k] = v;
    return o;
  });
  fs.writeFileSync(path.join(SEED_DIR, `${table}.json`), JSON.stringify(clean, null, 0));
  manifest[table] = clean.length;
}
fs.writeFileSync(path.join(SEED_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));

console.log('Generated synthetic KSP dataset:');
console.table(manifest);
