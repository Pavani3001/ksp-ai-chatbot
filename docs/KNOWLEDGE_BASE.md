# KSP Crime Intelligence — Knowledge Base

> Reference document for the QuickML Knowledge Base / RAG index. Upload this file
> in **QuickML → Generative AI → Knowledge Base → Upload document**. It grounds the
> assistant so it can (a) generate correct ZCQL against the FIR schema and
> (b) answer conceptual questions about FIR procedure, crime classification, and
> legal acts/sections that are not directly stored as data rows.
>
> All content is generic reference material or synthetic. No real FIR/PII data.

---

## 1. What the platform is

The KSP Crime Intelligence Platform answers natural-language questions (English & Kannada)
about the Karnataka State Police FIR database. It converts questions into ZCQL
(a MySQL-compatible query language) and runs them against the crime Data Store.
Users are investigators, analysts, and policymakers.

Typical questions it answers:
- "How many theft cases were registered in Mysuru in 2025?"
- "Where are the crime hotspots?"
- "Who are the repeat offenders and who do they work with?"
- "What is the case-status breakdown for cyber crimes?"
- "Show recent murder FIRs in Bengaluru City."

---

## 2. FIR fundamentals and case categories

An **FIR (First Information Report)** is the document recording the first information
about a cognizable offence. In this system every case is a row in `CaseMaster`,
identified by a structured **Crime Number (CrimeNo)**.

**CrimeNo format** = 1-digit Case Category Code + 4-digit District ID + 4-digit
Police Station (Unit) ID + 4-digit Year + 5-digit running serial.
Example FIR: `104430006202600001`.

**CaseNo** = last 9 digits of CrimeNo = YYYY + 5-digit serial (e.g. `202600001`).

**Case categories (CaseCategory.LookupValue), by leading code:**
- **1 = FIR** — standard First Information Report for a cognizable offence.
- **3 = UDR** — Unnatural Death Report (deaths requiring inquiry, not necessarily a crime).
- **8 = Zero FIR** — an FIR registered at any police station regardless of jurisdiction,
  later transferred to the station with jurisdiction. Used so a victim is never turned away.
- **4 = PAR** — Preliminary/Property/Action Report as applicable in the workflow.

---

## 3. Crime classification

Crimes are classified in two levels:
- **CrimeHead (major head, CrimeGroupName)** — the crime group, e.g.
  *Crimes Against Body, Crimes Against Property, Crimes Against Women,
  Economic Offences, Cyber Crimes, Crimes Against Public Order.*
- **CrimeSubHead (CrimeHeadName)** — the specific offence under a head, e.g.
  Murder, Attempt to Murder, Grievous Hurt, Kidnapping (Against Body);
  House Burglary, Theft, Robbery, Dacoity, Motor Vehicle Theft (Against Property);
  Dowry Harassment, Sexual Assault, Domestic Violence (Against Women);
  Cheating & Fraud, Criminal Breach of Trust (Economic);
  Online Financial Fraud, Identity Theft (Cyber);
  Rioting, Unlawful Assembly (Public Order).

`CaseMaster.CrimeMajorHeadID` -> CrimeHead; `CaseMaster.CrimeMinorHeadID` -> CrimeSubHead.

---

## 4. Gravity of offence

**GravityOffence.LookupValue** categorizes severity:
- **Heinous** — most serious offences (e.g. murder, sexual assault, dacoity, robbery).
  Prioritized for investigation; `GravityOffenceID = 1` in the seed data.
- **Serious** — significant but non-heinous offences.
- **Non-Heinous** — comparatively minor offences.

Gravity drives investigation priority and is a factor in offender risk scoring.

---

## 5. Case status lifecycle

**CaseStatusMaster.CaseStatusName** values used:
- **Under Investigation** — active investigation, no chargesheet yet.
- **Charge Sheeted** — investigation complete, final report (chargesheet) filed in court.
- **Pending Trial** — chargesheeted and awaiting/undergoing trial.
- **Closed** — case closed (may be false/undetected via final report type).
- **Disposed** — concluded by the court.

**Final report type (ChargesheetDetails.cstype):**
A = Chargesheet (offence made out), B = False Case, C = Undetected.

---

## 6. Legal acts and sections

**Act** holds legal acts (ActCode = PK), e.g.:
- **BNS** — Bharatiya Nyaya Sanhita 2023 (replaces IPC).
- **IPC** — Indian Penal Code 1860.
- **NDPS** — Narcotic Drugs and Psychotropic Substances Act.
- **ITA** — Information Technology Act 2000.
- **MVA** — Motor Vehicles Act.
- **POCSO** — Protection of Children from Sexual Offences Act.

**Section** holds sections under each act (e.g. BNS 103 = murder, BNS 309 = robbery,
BNS 303 = theft, BNS 318 = cheating; IPC 302 = murder, IPC 498A = cruelty by husband;
ITA 66D = cheating by personation). `ActSectionAssociation` links a case (FIR) to the
acts/sections it is registered under (many-to-many).

---

## 7. People on a case

- **Complainant (ComplainantDetails)** — who reported the offence; carries
  age, gender, occupation, religion, caste (socio-demographic analysis).
- **Victim (Victim)** — affected person(s); `VictimPolice = '1'` if the victim is police.
- **Accused (Accused)** — alleged offender(s); `PersonID` orders them A1, A2, A3…
  Repeat offenders are identified by the same name appearing across many FIRs.
- **ArrestSurrender** — arrest or voluntary surrender events for accused persons,
  with the investigating officer (IOID) and court produced before.

**Gender lookup (GenderID):** 1 = Male, 2 = Female, 3 = Transgender.

---

## 8. Organization & geography

- **Unit** = police station (also circle/sub-division via UnitType). Cases are
  registered at a `PoliceStationID` (Unit).
- **District** and **State** provide geography; `Unit.DistrictID` -> District,
  `District.StateID` -> State. Karnataka is the primary state.
- **Employee** = police personnel; `CaseMaster.PolicePersonID` = registering officer,
  `ArrestSurrender.IOID` = investigating officer. **Rank** and **Designation** describe them.
- **Court** = court hearing the case (`CaseMaster.CourtID`).

To resolve a case to its district: CaseMaster -> Unit (PoliceStationID = UnitID)
-> District (DistrictID).

---

## 9. Analytical concepts the assistant supports

- **Hotspot** — geographic concentration of incidents. Computed by counting FIRs per
  district, and by plotting incident latitude/longitude to find clusters.
- **Repeat offender / habitual criminal** — an accused whose name recurs across
  two or more FIRs.
- **Criminal network / gang** — offenders linked because they appear as co-accused on
  the same FIR(s); a gang is a connected group of >= 3 such linked offenders.
- **Offender risk score (0-100)** — a heuristic blending number of cases,
  breadth of co-offenders, average offence gravity, and recency of activity.
  It is an investigative aid, not a determination of guilt.
- **Trend** — case counts over time (monthly/yearly), used for seasonal and
  emerging-pattern analysis.

---

## 10. FIR database schema (tables and columns)

The assistant generates read-only ZCQL SELECT queries against these tables.
Notation: Column (Type) [PK|FK -> target].

### CaseMaster
CaseMasterID (INT) [PK]; CrimeNo (VARCHAR); CaseNo (VARCHAR); CrimeRegisteredDate (DATE); PolicePersonID (INT) [FK -> Employee.EmployeeID]; PoliceStationID (INT) [FK -> Unit.UnitID]; CaseCategoryID (INT) [FK -> CaseCategory.CaseCategoryID]; GravityOffenceID (INT) [FK -> GravityOffence.GravityOffenceID]; CrimeMajorHeadID (INT) [FK -> CrimeHead.CrimeHeadID]; CrimeMinorHeadID (INT) [FK -> CrimeSubHead.CrimeSubHeadID]; CaseStatusID (INT) [FK -> CaseStatusMaster.CaseStatusID]; CourtID (INT) [FK -> Court.CourtID]; IncidentFromDate (DATETIME); IncidentToDate (DATETIME); InfoReceivedPSDate (DATETIME); latitude (DECIMAL); longitude (DECIMAL); BriefFacts (TEXT)

### ComplainantDetails
ComplainantID (INT) [PK]; CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; ComplainantName (VARCHAR); AgeYear (INT); OccupationID (INT) [FK -> OccupationMaster.OccupationID]; ReligionID (INT) [FK -> ReligionMaster.ReligionID]; CasteID (INT) [FK -> CasteMaster.caste_master_id]; GenderID (INT)

### Victim
VictimMasterID (INT) [PK]; CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; VictimName (VARCHAR); AgeYear (INT); GenderID (INT); VictimPolice (VARCHAR)

### Accused
AccusedMasterID (INT) [PK]; CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; AccusedName (VARCHAR); AgeYear (INT); GenderID (INT); PersonID (VARCHAR)

### ArrestSurrender
ArrestSurrenderID (INT) [PK]; CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; ArrestSurrenderTypeID (INT); ArrestSurrenderDate (DATE); ArrestSurrenderStateId (INT) [FK -> State.StateID]; ArrestSurrenderDistrictId (INT) [FK -> District.DistrictID]; PoliceStationID (INT) [FK -> Unit.UnitID]; IOID (INT) [FK -> Employee.EmployeeID]; CourtID (INT) [FK -> Court.CourtID]; AccusedMasterID (INT) [FK -> Accused.AccusedMasterID]; IsAccused (BIT); IsComplainantAccused (BIT)

### ActSectionAssociation
CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; ActID (VARCHAR) [FK -> Act.ActCode]; SectionID (VARCHAR) [FK -> Section.SectionCode]; ActOrderID (INT); SectionOrderID (INT)

### ChargesheetDetails
CSID (INT) [PK]; CaseMasterID (INT) [FK -> CaseMaster.CaseMasterID]; csdate (DATETIME); cstype (VARCHAR); PolicePersonID (INT) [FK -> Employee.EmployeeID]

### Act
ActCode (VARCHAR) [PK]; ActDescription (VARCHAR); ShortName (VARCHAR); Active (BIT)

### Section
ActCode (VARCHAR) [FK -> Act.ActCode]; SectionCode (VARCHAR); SectionDescription (VARCHAR); Active (BIT)

### CrimeHeadActSection
CrimeHeadID (INT) [FK -> CrimeHead.CrimeHeadID]; ActCode (VARCHAR) [FK -> Act.ActCode]; SectionCode (VARCHAR)

### CrimeHead
CrimeHeadID (INT) [PK]; CrimeGroupName (VARCHAR); Active (BIT)

### CrimeSubHead
CrimeSubHeadID (INT) [PK]; CrimeHeadID (INT) [FK -> CrimeHead.CrimeHeadID]; CrimeHeadName (VARCHAR); SeqID (INT)

### CasteMaster
caste_master_id (INT) [PK]; caste_master_name (VARCHAR)

### ReligionMaster
ReligionID (INT) [PK]; ReligionName (VARCHAR)

### OccupationMaster
OccupationID (INT) [PK]; OccupationName (VARCHAR)

### CaseStatusMaster
CaseStatusID (INT) [PK]; CaseStatusName (VARCHAR)

### CaseCategory
CaseCategoryID (INT) [PK]; LookupValue (VARCHAR)

### GravityOffence
GravityOffenceID (INT) [PK]; LookupValue (VARCHAR)

### Court
CourtID (INT) [PK]; CourtName (VARCHAR); DistrictID (INT) [FK -> District.DistrictID]; StateID (INT) [FK -> State.StateID]; Active (BIT)

### District
DistrictID (INT) [PK]; DistrictName (VARCHAR); StateID (INT) [FK -> State.StateID]; Active (BIT)

### State
StateID (INT) [PK]; StateName (VARCHAR); NationalityID (INT); Active (BIT)

### Unit
UnitID (INT) [PK]; UnitName (VARCHAR); TypeID (INT) [FK -> UnitType.UnitTypeID]; ParentUnit (INT); NationalityID (INT); StateID (INT) [FK -> State.StateID]; DistrictID (INT) [FK -> District.DistrictID]; Active (BIT)

### UnitType
UnitTypeID (INT) [PK]; UnitTypeName (VARCHAR); CityDistState (VARCHAR); Hierarchy (INT); Active (BIT)

### Rank
RankID (INT) [PK]; RankName (VARCHAR); Hierarchy (INT); Active (BIT)

### Designation
DesignationID (INT) [PK]; DesignationName (VARCHAR); Active (BIT); SortOrder (INT)

### Employee
EmployeeID (INT) [PK]; DistrictID (INT) [FK -> District.DistrictID]; UnitID (INT) [FK -> Unit.UnitID]; RankID (INT) [FK -> Rank.RankID]; DesignationID (INT) [FK -> Designation.DesignationID]; KGID (VARCHAR); FirstName (VARCHAR); EmployeeDOB (DATE); GenderID (INT); BloodGroupID (INT); PhysicallyChallenged (BIT); AppointmentDate (DATE)
