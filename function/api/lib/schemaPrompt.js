/**
 * Analytics builders.
 *
 * Each function returns { zcql, transform } where `transform` post-processes
 * raw rows into the shape the dashboard charts expect. Keeping the ZCQL here
 * (rather than hand-rolled JS over full tables) means the same aggregation
 * runs on Catalyst's OLAP engine in production.
 */

// Monthly trend of case counts, optionally filtered by crime head / district.
function trendQuery() {
  return `SELECT cm.CrimeRegisteredDate AS d FROM CaseMaster cm LIMIT 5000`;
}
function trendTransform(rows) {
  const byMonth = {};
  for (const r of rows) {
    const month = String(r.d).slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, count]) => ({ month, count }));
}

// Crime distribution by major head.
function byCrimeHeadQuery() {
  return `SELECT ch.CrimeGroupName AS name, COUNT(*) AS count FROM CaseMaster cm JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID GROUP BY ch.CrimeGroupName ORDER BY count DESC`;
}

// Case status distribution.
function byStatusQuery() {
  return `SELECT csm.CaseStatusName AS name, COUNT(*) AS count FROM CaseMaster cm JOIN CaseStatusMaster csm ON cm.CaseStatusID = csm.CaseStatusID GROUP BY csm.CaseStatusName ORDER BY count DESC`;
}

// District ranking (hotspots).
function byDistrictQuery() {
  return `SELECT d.DistrictName AS name, COUNT(*) AS count FROM CaseMaster cm JOIN Unit u ON cm.PoliceStationID = u.UnitID JOIN District d ON u.DistrictID = d.DistrictID GROUP BY d.DistrictName ORDER BY count DESC`;
}

// Incident points for the map (lat/long + crime type).
function incidentPointsQuery() {
  return `SELECT cm.latitude AS lat, cm.longitude AS lng, cm.CrimeNo AS crimeNo, csh.CrimeHeadName AS type FROM CaseMaster cm JOIN CrimeSubHead csh ON cm.CrimeMinorHeadID = csh.CrimeSubHeadID LIMIT 500`;
}

// Socio-demographic: complainant age bands.
function ageBandQuery() {
  return `SELECT AgeYear FROM ComplainantDetails LIMIT 5000`;
}
function ageBandTransform(rows) {
  const bands = { '<18': 0, '18-30': 0, '31-45': 0, '46-60': 0, '60+': 0 };
  for (const r of rows) {
    const a = Number(r.AgeYear);
    if (a < 18) bands['<18']++;
    else if (a <= 30) bands['18-30']++;
    else if (a <= 45) bands['31-45']++;
    else if (a <= 60) bands['46-60']++;
    else bands['60+']++;
  }
  return Object.entries(bands).map(([band, count]) => ({ band, count }));
}

// Socio-demographic: complainant by gender / religion / occupation.
function byGenderQuery() {
  return `SELECT GenderID AS g, COUNT(*) AS count FROM ComplainantDetails GROUP BY GenderID`;
}
function byOccupationQuery() {
  return `SELECT om.OccupationName AS name, COUNT(*) AS count FROM ComplainantDetails cd JOIN OccupationMaster om ON cd.OccupationID = om.OccupationID GROUP BY om.OccupationName ORDER BY count DESC`;
}
function byReligionQuery() {
  return `SELECT rm.ReligionName AS name, COUNT(*) AS count FROM ComplainantDetails cd JOIN ReligionMaster rm ON cd.ReligionID = rm.ReligionID GROUP BY rm.ReligionName ORDER BY count DESC`;
}

module.exports = {
  trendQuery, trendTransform,
  byCrimeHeadQuery, byStatusQuery, byDistrictQuery, incidentPointsQuery,
  ageBandQuery, ageBandTransform,
  byGenderQuery, byOccupationQuery, byReligionQuery,
};
