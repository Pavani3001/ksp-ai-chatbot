/**
 * Canonical schema for the KSP Crime Intelligence Platform.
 *
 * This is the single source of truth, derived directly from the Karnataka
 * Police FIR ER Diagram. It is consumed by:
 *   - the synthetic data generator (data/generate_seed.js)
 *   - the NL->ZCQL guardrail / allowlist (functions/api/lib/schema.js mirrors this)
 *   - the schema documentation (docs/SCHEMA.md)
 *
 * Column types use a small normalized set (INT, VARCHAR, DATE, DATETIME,
 * DECIMAL, TEXT, BIT) that map cleanly onto both the local mock store and the
 * Catalyst Data Store column types.
 */

const TABLES = {
  // ---- Core case entity ----
  CaseMaster: {
    pk: 'CaseMasterID',
    columns: {
      CaseMasterID: 'INT',
      CrimeNo: 'VARCHAR',        // 1+4+4+4+5 structured crime number
      CaseNo: 'VARCHAR',         // YYYY + 5 digit serial (last 9 of CrimeNo)
      CrimeRegisteredDate: 'DATE',
      PolicePersonID: 'INT',     // FK Employee.EmployeeID
      PoliceStationID: 'INT',    // FK Unit.UnitID
      CaseCategoryID: 'INT',     // FK CaseCategory
      GravityOffenceID: 'INT',   // FK GravityOffence
      CrimeMajorHeadID: 'INT',   // FK CrimeHead
      CrimeMinorHeadID: 'INT',   // FK CrimeSubHead
      CaseStatusID: 'INT',       // FK CaseStatusMaster
      CourtID: 'INT',            // FK Court
      IncidentFromDate: 'DATETIME',
      IncidentToDate: 'DATETIME',
      InfoReceivedPSDate: 'DATETIME',
      latitude: 'DECIMAL',
      longitude: 'DECIMAL',
      BriefFacts: 'TEXT',
    },
    fks: {
      PolicePersonID: 'Employee.EmployeeID',
      PoliceStationID: 'Unit.UnitID',
      CaseCategoryID: 'CaseCategory.CaseCategoryID',
      GravityOffenceID: 'GravityOffence.GravityOffenceID',
      CrimeMajorHeadID: 'CrimeHead.CrimeHeadID',
      CrimeMinorHeadID: 'CrimeSubHead.CrimeSubHeadID',
      CaseStatusID: 'CaseStatusMaster.CaseStatusID',
      CourtID: 'Court.CourtID',
    },
  },

  ComplainantDetails: {
    pk: 'ComplainantID',
    columns: {
      ComplainantID: 'INT',
      CaseMasterID: 'INT',
      ComplainantName: 'VARCHAR',
      AgeYear: 'INT',
      OccupationID: 'INT',
      ReligionID: 'INT',
      CasteID: 'INT',
      GenderID: 'INT',
    },
    fks: {
      CaseMasterID: 'CaseMaster.CaseMasterID',
      OccupationID: 'OccupationMaster.OccupationID',
      ReligionID: 'ReligionMaster.ReligionID',
      CasteID: 'CasteMaster.caste_master_id',
    },
  },

  Victim: {
    pk: 'VictimMasterID',
    columns: {
      VictimMasterID: 'INT',
      CaseMasterID: 'INT',
      VictimName: 'VARCHAR',
      AgeYear: 'INT',
      GenderID: 'INT',
      VictimPolice: 'VARCHAR', // '1' if police else '0'
    },
    fks: { CaseMasterID: 'CaseMaster.CaseMasterID' },
  },

  Accused: {
    pk: 'AccusedMasterID',
    columns: {
      AccusedMasterID: 'INT',
      CaseMasterID: 'INT',
      AccusedName: 'VARCHAR',
      AgeYear: 'INT',
      GenderID: 'INT',
      PersonID: 'VARCHAR', // A1, A2, ...
    },
    fks: { CaseMasterID: 'CaseMaster.CaseMasterID' },
  },

  ArrestSurrender: {
    pk: 'ArrestSurrenderID',
    columns: {
      ArrestSurrenderID: 'INT',
      CaseMasterID: 'INT',
      ArrestSurrenderTypeID: 'INT', // 1 arrest, 2 surrender
      ArrestSurrenderDate: 'DATE',
      ArrestSurrenderStateId: 'INT',
      ArrestSurrenderDistrictId: 'INT',
      PoliceStationID: 'INT',
      IOID: 'INT',
      CourtID: 'INT',
      AccusedMasterID: 'INT',
      IsAccused: 'BIT',
      IsComplainantAccused: 'BIT',
    },
    fks: {
      CaseMasterID: 'CaseMaster.CaseMasterID',
      ArrestSurrenderStateId: 'State.StateID',
      ArrestSurrenderDistrictId: 'District.DistrictID',
      PoliceStationID: 'Unit.UnitID',
      IOID: 'Employee.EmployeeID',
      CourtID: 'Court.CourtID',
      AccusedMasterID: 'Accused.AccusedMasterID',
    },
  },

  ActSectionAssociation: {
    pk: null, // composite / associative
    columns: {
      CaseMasterID: 'INT',
      ActID: 'VARCHAR',
      SectionID: 'VARCHAR',
      ActOrderID: 'INT',
      SectionOrderID: 'INT',
    },
    fks: {
      CaseMasterID: 'CaseMaster.CaseMasterID',
      ActID: 'Act.ActCode',
      SectionID: 'Section.SectionCode',
    },
  },

  ChargesheetDetails: {
    pk: 'CSID',
    columns: {
      CSID: 'INT',
      CaseMasterID: 'INT',
      csdate: 'DATETIME',
      cstype: 'VARCHAR', // A chargesheet, B false, C undetected
      PolicePersonID: 'INT',
    },
    fks: {
      CaseMasterID: 'CaseMaster.CaseMasterID',
      PolicePersonID: 'Employee.EmployeeID',
    },
  },

  // ---- Legal reference ----
  Act: {
    pk: 'ActCode',
    columns: {
      ActCode: 'VARCHAR',
      ActDescription: 'VARCHAR',
      ShortName: 'VARCHAR',
      Active: 'BIT',
    },
  },
  Section: {
    pk: null,
    columns: {
      ActCode: 'VARCHAR',
      SectionCode: 'VARCHAR',
      SectionDescription: 'VARCHAR',
      Active: 'BIT',
    },
    fks: { ActCode: 'Act.ActCode' },
  },
  CrimeHeadActSection: {
    pk: null,
    columns: {
      CrimeHeadID: 'INT',
      ActCode: 'VARCHAR',
      SectionCode: 'VARCHAR',
    },
    fks: { CrimeHeadID: 'CrimeHead.CrimeHeadID', ActCode: 'Act.ActCode' },
  },

  // ---- Crime classification ----
  CrimeHead: {
    pk: 'CrimeHeadID',
    columns: {
      CrimeHeadID: 'INT',
      CrimeGroupName: 'VARCHAR',
      Active: 'BIT',
    },
  },
  CrimeSubHead: {
    pk: 'CrimeSubHeadID',
    columns: {
      CrimeSubHeadID: 'INT',
      CrimeHeadID: 'INT',
      CrimeHeadName: 'VARCHAR',
      SeqID: 'INT',
    },
    fks: { CrimeHeadID: 'CrimeHead.CrimeHeadID' },
  },

  // ---- Socio-demographic masters ----
  CasteMaster: {
    pk: 'caste_master_id',
    columns: { caste_master_id: 'INT', caste_master_name: 'VARCHAR' },
  },
  ReligionMaster: {
    pk: 'ReligionID',
    columns: { ReligionID: 'INT', ReligionName: 'VARCHAR' },
  },
  OccupationMaster: {
    pk: 'OccupationID',
    columns: { OccupationID: 'INT', OccupationName: 'VARCHAR' },
  },

  // ---- Case status / category / gravity ----
  CaseStatusMaster: {
    pk: 'CaseStatusID',
    columns: { CaseStatusID: 'INT', CaseStatusName: 'VARCHAR' },
  },
  CaseCategory: {
    pk: 'CaseCategoryID',
    columns: { CaseCategoryID: 'INT', LookupValue: 'VARCHAR' },
  },
  GravityOffence: {
    pk: 'GravityOffenceID',
    columns: { GravityOffenceID: 'INT', LookupValue: 'VARCHAR' },
  },

  // ---- Geography / org hierarchy ----
  Court: {
    pk: 'CourtID',
    columns: {
      CourtID: 'INT',
      CourtName: 'VARCHAR',
      DistrictID: 'INT',
      StateID: 'INT',
      Active: 'BIT',
    },
    fks: { DistrictID: 'District.DistrictID', StateID: 'State.StateID' },
  },
  District: {
    pk: 'DistrictID',
    columns: {
      DistrictID: 'INT',
      DistrictName: 'VARCHAR',
      StateID: 'INT',
      Active: 'BIT',
    },
    fks: { StateID: 'State.StateID' },
  },
  State: {
    pk: 'StateID',
    columns: {
      StateID: 'INT',
      StateName: 'VARCHAR',
      NationalityID: 'INT',
      Active: 'BIT',
    },
  },
  Unit: {
    pk: 'UnitID',
    columns: {
      UnitID: 'INT',
      UnitName: 'VARCHAR',
      TypeID: 'INT',
      ParentUnit: 'INT',
      NationalityID: 'INT',
      StateID: 'INT',
      DistrictID: 'INT',
      Active: 'BIT',
    },
    fks: {
      TypeID: 'UnitType.UnitTypeID',
      StateID: 'State.StateID',
      DistrictID: 'District.DistrictID',
    },
  },
  UnitType: {
    pk: 'UnitTypeID',
    columns: {
      UnitTypeID: 'INT',
      UnitTypeName: 'VARCHAR',
      CityDistState: 'VARCHAR',
      Hierarchy: 'INT',
      Active: 'BIT',
    },
  },

  // ---- Employee / org ----
  Rank: {
    pk: 'RankID',
    columns: { RankID: 'INT', RankName: 'VARCHAR', Hierarchy: 'INT', Active: 'BIT' },
  },
  Designation: {
    pk: 'DesignationID',
    columns: {
      DesignationID: 'INT',
      DesignationName: 'VARCHAR',
      Active: 'BIT',
      SortOrder: 'INT',
    },
  },
  Employee: {
    pk: 'EmployeeID',
    columns: {
      EmployeeID: 'INT',
      DistrictID: 'INT',
      UnitID: 'INT',
      RankID: 'INT',
      DesignationID: 'INT',
      KGID: 'VARCHAR',
      FirstName: 'VARCHAR',
      EmployeeDOB: 'DATE',
      GenderID: 'INT',
      BloodGroupID: 'INT',
      PhysicallyChallenged: 'BIT',
      AppointmentDate: 'DATE',
    },
    fks: {
      DistrictID: 'District.DistrictID',
      UnitID: 'Unit.UnitID',
      RankID: 'Rank.RankID',
      DesignationID: 'Designation.DesignationID',
    },
  },
};

// Gender lookup shared across person tables (per ER: M/F/T style).
const GENDER = { 1: 'Male', 2: 'Female', 3: 'Transgender' };

module.exports = { TABLES, GENDER };
