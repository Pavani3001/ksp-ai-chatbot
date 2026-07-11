/**
 * Criminal network analysis + offender risk scoring.
 *
 * Networks are derived from co-occurrence: two accused persons are linked if
 * they appear on the same FIR (co-accused). Repeat offenders are those whose
 * name recurs across many FIRs. Risk score blends case volume, co-offender
 * breadth, offence gravity, and recency.
 *
 * The data is pulled with two guarded SELECTs and the graph is assembled in
 * memory — appropriate for the interactive scale here; production would push
 * heavier aggregation to the OLAP layer.
 */

// Pull all accused with the case + gravity + date needed for scoring.
function accusedGraphQuery() {
  return `SELECT a.AccusedName AS name, a.CaseMasterID AS caseId, a.AgeYear AS age, a.GenderID AS gender, cm.GravityOffenceID AS gravity, cm.CrimeRegisteredDate AS regDate, csh.CrimeHeadName AS crime FROM Accused a JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID JOIN CrimeSubHead csh ON cm.CrimeMinorHeadID = csh.CrimeSubHeadID LIMIT 5000`;
}

// gravity 1 = Heinous (highest weight)
const GRAVITY_WEIGHT = { 1: 1.0, 3: 0.6, 2: 0.3 };

function buildNetwork(rows, { minCases = 2, focusName = null } = {}) {
  // Group by offender name.
  const byName = new Map();
  const caseMembers = new Map(); // caseId -> Set(names)
  for (const r of rows) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
    if (!caseMembers.has(r.caseId)) caseMembers.set(r.caseId, new Set());
    caseMembers.get(r.caseId).add(r.name);
  }

  // Co-accused edges (undirected, weighted by shared-case count).
  const edgeMap = new Map();
  for (const [, names] of caseMembers) {
    const arr = [...names];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [x, y] = [arr[i], arr[j]].sort();
        const key = `${x}||${y}`;
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    }
  }

  // Risk scoring per offender.
  const scored = [];
  const now = new Date('2026-07-02');
  for (const [name, recs] of byName) {
    const caseIds = new Set(recs.map((r) => r.caseId));
    const caseCount = caseIds.size;
    const coOffenders = new Set();
    for (const cid of caseIds) for (const n of caseMembers.get(cid)) if (n !== name) coOffenders.add(n);
    const gravityScore = recs.reduce((s, r) => s + (GRAVITY_WEIGHT[r.gravity] || 0.3), 0) / recs.length;
    const latest = recs.reduce((mx, r) => (r.regDate > mx ? r.regDate : mx), '0000');
    const monthsSince = Math.max(0, (now - new Date(latest)) / (1000 * 60 * 60 * 24 * 30));
    const recency = Math.exp(-monthsSince / 18); // decays over ~1.5y

    // Weighted risk on 0-100.
    const raw = 0.45 * Math.min(caseCount / 6, 1)
      + 0.2 * Math.min(coOffenders.size / 8, 1)
      + 0.2 * gravityScore
      + 0.15 * recency;
    const risk = Math.round(raw * 100);
    const crimes = [...new Set(recs.map((r) => r.crime))];
    scored.push({ name, caseCount, coOffenders: coOffenders.size, gravityScore: Number(gravityScore.toFixed(2)), risk, crimes, lastSeen: latest });
  }
  scored.sort((a, b) => b.risk - a.risk);

  // Build graph payload. Optionally focus on one offender's neighbourhood.
  let relevantNames;
  if (focusName) {
    relevantNames = new Set([focusName]);
    for (const [key] of edgeMap) {
      const [x, y] = key.split('||');
      if (x === focusName) relevantNames.add(y);
      if (y === focusName) relevantNames.add(x);
    }
  } else {
    relevantNames = new Set(scored.filter((s) => s.caseCount >= minCases).map((s) => s.name));
  }

  const scoreByName = Object.fromEntries(scored.map((s) => [s.name, s]));
  const nodes = [...relevantNames].map((name) => ({
    id: name,
    caseCount: scoreByName[name]?.caseCount || 1,
    risk: scoreByName[name]?.risk || 0,
    crimes: scoreByName[name]?.crimes || [],
  }));
  const edges = [];
  for (const [key, weight] of edgeMap) {
    const [x, y] = key.split('||');
    if (relevantNames.has(x) && relevantNames.has(y)) edges.push({ source: x, target: y, weight });
  }

  // Identify gangs = connected components with >= 3 members.
  const gangs = connectedComponents(nodes.map((n) => n.id), edges).filter((c) => c.length >= 3);

  return {
    nodes, edges,
    topOffenders: scored.slice(0, 20),
    gangs: gangs.map((members, i) => ({ id: `G${i + 1}`, size: members.length, members })),
    stats: { totalOffenders: scored.length, repeatOffenders: scored.filter((s) => s.caseCount >= 2).length },
  };
}

function connectedComponents(nodeIds, edges) {
  const adj = new Map(nodeIds.map((n) => [n, []]));
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).push(e.target);
      adj.get(e.target).push(e.source);
    }
  }
  const seen = new Set();
  const comps = [];
  for (const start of nodeIds) {
    if (seen.has(start)) continue;
    const stack = [start], comp = [];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const nb of adj.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    comps.push(comp);
  }
  return comps;
}

module.exports = { accusedGraphQuery, buildNetwork };
