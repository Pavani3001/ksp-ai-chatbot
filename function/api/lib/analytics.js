/**
 * Backend schema allowlist for NL->ZCQL guardrails.
 *
 * Mirrors data/schema/schema.js but is self-contained so the deployed function
 * bundle has no cross-package dependency. Used to validate that generated ZCQL
 * only references known tables/columns.
 */

const SCHEMA = {
  CaseMaster: ['CaseMasterID', 'CrimeNo', 'CaseNo', 'CrimeRegisteredDate', 'PolicePersonID',
    'PoliceStationID', 'CaseCategoryID', 'GravityOffenceID', 'CrimeMajorHeadID', 'CrimeMinorHeadID',
    'CaseStatusID', 'CourtID', 'IncidentFromDate', 'IncidentToDate', 'InfoReceivedPSDate',
    'latitude', 'longitude', 'BriefFacts'],
  ComplainantDetails: ['ComplainantID', 'CaseMasterID', 'ComplainantName', 'AgeYear', 'OccupationID', 'ReligionID', 'CasteID', 'GenderID'],
  Victim: ['VictimMasterID', 'CaseMasterID', 'VictimName', 'AgeYear', 'GenderID', 'VictimPolice'],
  Accused: ['AccusedMasterID', 'CaseMasterID', 'AccusedName', 'AgeYear', 'GenderID', 'PersonID'],
  ArrestSurrender: ['ArrestSurrenderID', 'CaseMasterID', 'ArrestSurrenderTypeID', 'ArrestSurrenderDate',
    'ArrestSurrenderStateId', 'ArrestSurrenderDistrictId', 'PoliceStationID', 'IOID', 'CourtID',
    'AccusedMasterID', 'IsAccused', 'IsComplainantAccused'],
  ActSectionAssociation: ['CaseMasterID', 'ActID', 'SectionID', 'ActOrderID', 'SectionOrderID'],
  ChargesheetDetails: ['CSID', 'CaseMasterID', 'csdate', 'cstype', 'PolicePersonID'],
  Act: ['ActCode', 'ActDescription', 'ShortName', 'Active'],
  Section: ['ActCode', 'SectionCode', 'SectionDescription', 'Active'],
  CrimeHeadActSection: ['CrimeHeadID', 'ActCode', 'SectionCode'],
  CrimeHead: ['CrimeHeadID', 'CrimeGroupName', 'Active'],
  CrimeSubHead: ['CrimeSubHeadID', 'CrimeHeadID', 'CrimeHeadName', 'SeqID'],
  CasteMaster: ['caste_master_id', 'caste_master_name'],
  ReligionMaster: ['ReligionID', 'ReligionName'],
  OccupationMaster: ['OccupationID', 'OccupationName'],
  CaseStatusMaster: ['CaseStatusID', 'CaseStatusName'],
  CaseCategory: ['CaseCategoryID', 'LookupValue'],
  GravityOffence: ['GravityOffenceID', 'LookupValue'],
  Court: ['CourtID', 'CourtName', 'DistrictID', 'StateID', 'Active'],
  District: ['DistrictID', 'DistrictName', 'StateID', 'Active'],
  State: ['StateID', 'StateName', 'NationalityID', 'Active'],
  Unit: ['UnitID', 'UnitName', 'TypeID', 'ParentUnit', 'NationalityID', 'StateID', 'DistrictID', 'Active'],
  UnitType: ['UnitTypeID', 'UnitTypeName', 'CityDistState', 'Hierarchy', 'Active'],
  Rank: ['RankID', 'RankName', 'Hierarchy', 'Active'],
  Designation: ['DesignationID', 'DesignationName', 'Active', 'SortOrder'],
  Employee: ['EmployeeID', 'DistrictID', 'UnitID', 'RankID', 'DesignationID', 'KGID', 'FirstName',
    'EmployeeDOB', 'GenderID', 'BloodGroupID', 'PhysicallyChallenged', 'AppointmentDate'],
};

const TABLE_NAMES = Object.keys(SCHEMA);
const GENDER = { 1: 'Male', 2: 'Female', 3: 'Transgender' };

module.exports = { SCHEMA, TABLE_NAMES, GENDER };
