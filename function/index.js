/**
 * KSP Crime Intelligence Platform — main API function.
 *
 * Runs as a Catalyst Advanced I/O (Node.js) function in production and as a
 * plain Express server locally (node index.js). All data access goes through
 * the guarded ZCQL data client, so the security posture is identical in both
 * environments.
 *
 * Routes:
 *   GET  /health
 *   GET  /schema                       -> tables + columns (for UI hints)
 *   POST /chat        { question, context }   -> NL answer + evidence trail
 *   GET  /analytics/:kind              -> dashboard datasets
 *   GET  /network      ?focus=Name     -> criminal network + risk scores
 *   GET  /case/:crimeNo                -> case summary (investigator support)
 */

const express = require('express');
const cors = require('cors');

const { executeQuery } = require('./lib/dataClient');
const guard = require('./lib/zcqlGuard');
const { nlToZcql } = require('./lib/nl2zcql');
const analytics = require('./lib/analytics');
const { accusedGraphQuery, buildNetwork } = require('./lib/network');
const { SCHEMA, GENDER } = require('./lib/schema');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Helper: validate + execute, returning rows.
async function query(zcql, req) {
  const safe = guard.validate(zcql);
  const { content } = await executeQuery(safe, req);
  return { rows: content, executedZcql: safe };
}

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: process.env.DATA_PROVIDER || 'mock' }));

app.get('/schema', (_req, res) => res.json({ tables: SCHEMA }));

// ---- Conversational endpoint -------------------------------------------
app.post('/chat', async (req, res) => {
  const { question, context } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }
  try {
    const resolved = await nlToZcql(question, context, req);
    const { rows, executedZcql } = await query(resolved.zcql, req);
    const answer = summarize(question, resolved, rows);
    res.json({
      answer,
      intent: resolved.intent,
      explanation: resolved.explanation,
      evidence: { zcql: executedZcql, rowCount: rows.length },
      rows: rows.slice(0, 50),
      context: resolved.context || context || {},
      degraded: resolved.degraded || false,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Compose a short natural-language answer from result rows.
function summarize(question, resolved, rows) {
  if (!rows.length) return 'No matching records were found for that query.';
  switch (resolved.intent) {
    case 'count':
      return `There are ${rows[0].case_count} matching cases.`;
    case 'hotspots': {
      const top = rows.slice(0, 3).map((r) => `${r.DistrictName} (${r.case_count})`).join(', ');
      return `Top crime concentrations: ${top}. See the map and ranking for the full picture.`;
    }
    case 'repeat_offenders': {
      const top = rows.slice(0, 3).map((r) => `${r.AccusedName} — ${r.case_count} cases`).join('; ');
      return `Most frequently recurring accused: ${top}. Open the Network view for their associations and risk scores.`;
    }
    case 'status': {
      const parts = rows.map((r) => `${r.status}: ${r.case_count}`).join(', ');
      return `Case status breakdown — ${parts}.`;
    }
    case 'trend':
      return `Returned ${rows.length} time points. The trend chart visualizes the movement over time.`;
    default:
      return `Found ${rows.length} matching record(s). See the evidence table below.`;
  }
}

// ---- Analytics endpoints -----------------------------------------------
app.get('/analytics/:kind', async (req, res) => {
  const { kind } = req.params;
  try {
    let out;
    switch (kind) {
      case 'trend':
        out = analytics.trendTransform((await query(analytics.trendQuery(), req)).rows);
        break;
      case 'crimeHead':
        out = (await query(analytics.byCrimeHeadQuery(), req)).rows;
        break;
      case 'status':
        out = (await query(analytics.byStatusQuery(), req)).rows;
        break;
      case 'district':
        out = (await query(analytics.byDistrictQuery(), req)).rows;
        break;
      case 'incidents':
        out = (await query(analytics.incidentPointsQuery(), req)).rows;
        break;
      case 'ageBand':
        out = analytics.ageBandTransform((await query(analytics.ageBandQuery(), req)).rows);
        break;
      case 'gender':
        out = (await query(analytics.byGenderQuery(), req)).rows
          .map((r) => ({ name: GENDER[r.g] || 'Unknown', count: r.count }));
        break;
      case 'occupation':
        out = (await query(analytics.byOccupationQuery(), req)).rows;
        break;
      case 'religion':
        out = (await query(analytics.byReligionQuery(), req)).rows;
        break;
      case 'summary': {
        // Headline KPIs for the dashboard header.
        const total = (await query('SELECT COUNT(*) AS c FROM CaseMaster', req)).rows[0].c;
        const heinous = (await query("SELECT COUNT(*) AS c FROM CaseMaster cm WHERE cm.GravityOffenceID = 1", req)).rows[0].c;
        const arrests = (await query('SELECT COUNT(*) AS c FROM ArrestSurrender', req)).rows[0].c;
        const chargesheeted = (await query("SELECT COUNT(*) AS c FROM ChargesheetDetails cd WHERE cd.cstype = 'A'", req)).rows[0].c;
        out = { total, heinous, arrests, chargesheeted };
        break;
      }
      default:
        return res.status(404).json({ error: `Unknown analytics kind: ${kind}` });
    }
    res.json({ kind, data: out });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Network endpoint ---------------------------------------------------
app.get('/network', async (req, res) => {
  try {
    const { rows } = await query(accusedGraphQuery(), req);
    const focus = req.query.focus || null;
    const minCases = req.query.minCases ? parseInt(req.query.minCases, 10) : 2;
    res.json(buildNetwork(rows, { focusName: focus, minCases }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Case summary (investigator decision support) ----------------------
app.get('/case/:crimeNo', async (req, res) => {
  const crimeNo = req.params.crimeNo.replace(/[^0-9]/g, '');
  try {
    const caseRows = (await query(
      `SELECT cm.CaseMasterID AS id, cm.CrimeNo AS crimeNo, cm.CrimeRegisteredDate AS regDate, cm.BriefFacts AS facts, cm.latitude AS lat, cm.longitude AS lng, csh.CrimeHeadName AS crime, csm.CaseStatusName AS status, g.LookupValue AS gravity, d.DistrictName AS district FROM CaseMaster cm JOIN CrimeSubHead csh ON cm.CrimeMinorHeadID = csh.CrimeSubHeadID JOIN CaseStatusMaster csm ON cm.CaseStatusID = csm.CaseStatusID JOIN GravityOffence g ON cm.GravityOffenceID = g.GravityOffenceID JOIN Unit u ON cm.PoliceStationID = u.UnitID JOIN District d ON u.DistrictID = d.DistrictID WHERE cm.CrimeNo = '${crimeNo}'`,
      req)).rows;
    if (!caseRows.length) return res.status(404).json({ error: 'Case not found' });
    const c = caseRows[0];
    const accused = (await query(`SELECT AccusedName AS name, PersonID AS label, AgeYear AS age FROM Accused WHERE CaseMasterID = ${c.id}`, req)).rows;
    const victims = (await query(`SELECT VictimName AS name, AgeYear AS age FROM Victim WHERE CaseMasterID = ${c.id}`, req)).rows;
    res.json({ case: c, accused, victims });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Catalyst vs local export ------------------------------------------
module.exports = app;

// When run directly (local dev), start a server.
if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`KSP API (provider=${process.env.DATA_PROVIDER || 'mock'}) listening on :${port}`);
  });
}
