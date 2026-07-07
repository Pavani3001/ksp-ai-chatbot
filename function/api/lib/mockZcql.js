/**
 * Builds the schema-grounding prompt fragment handed to the QuickML LLM so it
 * emits valid ZCQL. Kept in its own module so both the runtime and docs can
 * reference the exact grounding text.
 */

const { SCHEMA } = require('./schema');

function buildSchemaPrompt() {
  const lines = Object.entries(SCHEMA).map(([t, cols]) => `  ${t}(${cols.join(', ')})`);
  return `You are a ZCQL query generator for the Karnataka State Police FIR database.
ZCQL is a MySQL-compatible query language. Generate ONLY read-only SELECT queries.

Database schema (table(columns)):
${lines.join('\n')}

Key relationships:
  CaseMaster.PoliceStationID -> Unit.UnitID ; Unit.DistrictID -> District.DistrictID
  CaseMaster.CrimeMajorHeadID -> CrimeHead.CrimeHeadID
  CaseMaster.CrimeMinorHeadID -> CrimeSubHead.CrimeSubHeadID
  CaseMaster.CaseStatusID -> CaseStatusMaster.CaseStatusID
  Accused.CaseMasterID / Victim.CaseMasterID / ComplainantDetails.CaseMasterID -> CaseMaster.CaseMasterID
  ComplainantDetails.CasteID -> CasteMaster.caste_master_id ; ReligionID -> ReligionMaster ; OccupationID -> OccupationMaster
Rules: single SELECT only; no INSERT/UPDATE/DELETE; always add a LIMIT; use JOINs to return readable names.`;
}

module.exports = { buildSchemaPrompt };
