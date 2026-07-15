
# Data Model — KSP FIR Schema

Derived from the Karnataka Police FIR ER Diagram. 27 tables. `PK` = primary key, `FK` = foreign key. Source of truth: `data/schema/schema.js`.

## CaseMaster

| Column | Type | Key |
|--------|------|-----|
| CaseMasterID | INT | PK |
| CrimeNo | VARCHAR |  |
| CaseNo | VARCHAR |  |
| CrimeRegisteredDate | DATE |  |
| PolicePersonID | INT | FK → Employee.EmployeeID |
| PoliceStationID | INT | FK → Unit.UnitID |
| CaseCategoryID | INT | FK → CaseCategory.CaseCategoryID |
| GravityOffenceID | INT | FK → GravityOffence.GravityOffenceID |
| CrimeMajorHeadID | INT | FK → CrimeHead.CrimeHeadID |
| CrimeMinorHeadID | INT | FK → CrimeSubHead.CrimeSubHeadID |
| CaseStatusID | INT | FK → CaseStatusMaster.CaseStatusID |
| CourtID | INT | FK → Court.CourtID |
| IncidentFromDate | DATETIME |  |
| IncidentToDate | DATETIME |  |
| InfoReceivedPSDate | DATETIME |  |
| latitude | DECIMAL |  |
| longitude | DECIMAL |  |
| BriefFacts | TEXT |  |

## ComplainantDetails

| Column | Type | Key |
|--------|------|-----|
| ComplainantID | INT | PK |
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| ComplainantName | VARCHAR |  |
| AgeYear | INT |  |
| OccupationID | INT | FK → OccupationMaster.OccupationID |
| ReligionID | INT | FK → ReligionMaster.ReligionID |
| CasteID | INT | FK → CasteMaster.caste_master_id |
| GenderID | INT |  |

## Victim

| Column | Type | Key |
|--------|------|-----|
| VictimMasterID | INT | PK |
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| VictimName | VARCHAR |  |
| AgeYear | INT |  |
| GenderID | INT |  |
| VictimPolice | VARCHAR |  |

## Accused

| Column | Type | Key |
|--------|------|-----|
| AccusedMasterID | INT | PK |
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| AccusedName | VARCHAR |  |
| AgeYear | INT |  |
| GenderID | INT |  |
| PersonID | VARCHAR |  |

## ArrestSurrender

| Column | Type | Key |
|--------|------|-----|
| ArrestSurrenderID | INT | PK |
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| ArrestSurrenderTypeID | INT |  |
| ArrestSurrenderDate | DATE |  |
| ArrestSurrenderStateId | INT | FK → State.StateID |
| ArrestSurrenderDistrictId | INT | FK → District.DistrictID |
| PoliceStationID | INT | FK → Unit.UnitID |
| IOID | INT | FK → Employee.EmployeeID |
| CourtID | INT | FK → Court.CourtID |
| AccusedMasterID | INT | FK → Accused.AccusedMasterID |
| IsAccused | BIT |  |
| IsComplainantAccused | BIT |  |

## ActSectionAssociation

| Column | Type | Key |
|--------|------|-----|
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| ActID | VARCHAR | FK → Act.ActCode |
| SectionID | VARCHAR | FK → Section.SectionCode |
| ActOrderID | INT |  |
| SectionOrderID | INT |  |

## ChargesheetDetails

| Column | Type | Key |
|--------|------|-----|
| CSID | INT | PK |
| CaseMasterID | INT | FK → CaseMaster.CaseMasterID |
| csdate | DATETIME |  |
| cstype | VARCHAR |  |
| PolicePersonID | INT | FK → Employee.EmployeeID |

## Act

| Column | Type | Key |
|--------|------|-----|
| ActCode | VARCHAR | PK |
| ActDescription | VARCHAR |  |
| ShortName | VARCHAR |  |
| Active | BIT |  |

## Section

| Column | Type | Key |
|--------|------|-----|
| ActCode | VARCHAR | FK → Act.ActCode |
| SectionCode | VARCHAR |  |
| SectionDescription | VARCHAR |  |
| Active | BIT |  |

## CrimeHeadActSection

| Column | Type | Key |
|--------|------|-----|
| CrimeHeadID | INT | FK → CrimeHead.CrimeHeadID |
| ActCode | VARCHAR | FK → Act.ActCode |
| SectionCode | VARCHAR |  |

## CrimeHead

| Column | Type | Key |
|--------|------|-----|
| CrimeHeadID | INT | PK |
| CrimeGroupName | VARCHAR |  |
| Active | BIT |  |

## CrimeSubHead

| Column | Type | Key |
|--------|------|-----|
| CrimeSubHeadID | INT | PK |
| CrimeHeadID | INT | FK → CrimeHead.CrimeHeadID |
| CrimeHeadName | VARCHAR |  |
| SeqID | INT |  |

## CasteMaster

| Column | Type | Key |
|--------|------|-----|
| caste_master_id | INT | PK |
| caste_master_name | VARCHAR |  |

## ReligionMaster

| Column | Type | Key |
|--------|------|-----|
| ReligionID | INT | PK |
| ReligionName | VARCHAR |  |

## OccupationMaster

| Column | Type | Key |
|--------|------|-----|
| OccupationID | INT | PK |
| OccupationName | VARCHAR |  |

## CaseStatusMaster

| Column | Type | Key |
|--------|------|-----|
| CaseStatusID | INT | PK |
| CaseStatusName | VARCHAR |  |

## CaseCategory

| Column | Type | Key |
|--------|------|-----|
| CaseCategoryID | INT | PK |
| LookupValue | VARCHAR |  |

## GravityOffence

| Column | Type | Key |
|--------|------|-----|
| GravityOffenceID | INT | PK |
| LookupValue | VARCHAR |  |

## Court

| Column | Type | Key |
|--------|------|-----|
| CourtID | INT | PK |
| CourtName | VARCHAR |  |
| DistrictID | INT | FK → District.DistrictID |
| StateID | INT | FK → State.StateID |
| Active | BIT |  |

## District

| Column | Type | Key |
|--------|------|-----|
| DistrictID | INT | PK |
| DistrictName | VARCHAR |  |
| StateID | INT | FK → State.StateID |
| Active | BIT |  |

## State

| Column | Type | Key |
|--------|------|-----|
| StateID | INT | PK |
| StateName | VARCHAR |  |
| NationalityID | INT |  |
| Active | BIT |  |

## Unit

| Column | Type | Key |
|--------|------|-----|
| UnitID | INT | PK |
| UnitName | VARCHAR |  |
| TypeID | INT | FK → UnitType.UnitTypeID |
| ParentUnit | INT |  |
| NationalityID | INT |  |
| StateID | INT | FK → State.StateID |
| DistrictID | INT | FK → District.DistrictID |
| Active | BIT |  |

## UnitType

| Column | Type | Key |
|--------|------|-----|
| UnitTypeID | INT | PK |
| UnitTypeName | VARCHAR |  |
| CityDistState | VARCHAR |  |
| Hierarchy | INT |  |
| Active | BIT |  |

## Rank

| Column | Type | Key |
|--------|------|-----|
| RankID | INT | PK |
| RankName | VARCHAR |  |
| Hierarchy | INT |  |
| Active | BIT |  |

## Designation

| Column | Type | Key |
|--------|------|-----|
| DesignationID | INT | PK |
| DesignationName | VARCHAR |  |
| Active | BIT |  |
| SortOrder | INT |  |

## Employee

| Column | Type | Key |
|--------|------|-----|
| EmployeeID | INT | PK |
| DistrictID | INT | FK → District.DistrictID |
| UnitID | INT | FK → Unit.UnitID |
| RankID | INT | FK → Rank.RankID |
| DesignationID | INT | FK → Designation.DesignationID |
| KGID | VARCHAR |  |
| FirstName | VARCHAR |  |
| EmployeeDOB | DATE |  |
| GenderID | INT |  |
| BloodGroupID | INT |  |
| PhysicallyChallenged | BIT |  |
| AppointmentDate | DATE |  |

