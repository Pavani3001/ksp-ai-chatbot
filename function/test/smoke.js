/**
 * Backend smoke test — exercises the ZCQL engine, guardrail, NL->ZCQL, and
 * network builder directly (no HTTP). Run: node functions/api/test/smoke.js
 * Exits non-zero on failure.
 */
process.env.SEED_DIR = require('path').join(__dirname, '..', '..', '..', 'data', 'seed');

const assert = require('assert');
const { executeQuery } = require('../lib/dataClient');
const guard = require('../lib/zcqlGuard');
const { templateResolve } = require('../lib/nl2zcql');
const { accusedGraphQuery, buildNetwork } = require('../lib/network');
const analytics = require('../lib/analytics');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

(async () => {
  console.log('ZCQL engine:');
  await t('COUNT(*) over CaseMaster', async () => {
    const { content } = await executeQuery('SELECT COUNT(*) AS c FROM CaseMaster');
    assert(content[0].c === 1200, `expected 1200 got ${content[0].c}`);
  });
  await t('JOIN + GROUP BY district', async () => {
    const { content } = await executeQuery('SELECT d.DistrictName AS name, COUNT(*) AS count FROM CaseMaster cm JOIN Unit u ON cm.PoliceStationID = u.UnitID JOIN District d ON u.DistrictID = d.DistrictID GROUP BY d.DistrictName ORDER BY count DESC LIMIT 3');
    assert(content.length === 3, `expected 3 rows got ${content.length}`);
    assert(content[0].count >= content[1].count, 'not sorted desc');
  });
  await t('WHERE + LIKE year filter', async () => {
    const { content } = await executeQuery("SELECT COUNT(*) AS c FROM CaseMaster cm WHERE cm.CrimeRegisteredDate LIKE '2025%'");
    assert(content[0].c > 0, 'no 2025 cases');
  });

  console.log('Guardrail:');
  await t('rejects DELETE', () => {
    assert.throws(() => guard.validate('DELETE FROM CaseMaster'));
  });
  await t('rejects stacked query', () => {
    assert.throws(() => guard.validate('SELECT * FROM CaseMaster; DROP TABLE Accused'));
  });
  await t('rejects unknown table', () => {
    assert.throws(() => guard.validate('SELECT * FROM SecretTable'));
  });
  await t('injects LIMIT', () => {
    const q = guard.validate('SELECT CrimeNo FROM CaseMaster');
    assert(/LIMIT \d+$/.test(q), `no limit: ${q}`);
  });

  console.log('NL->ZCQL (template):');
  await t('count intent', () => {
    const r = templateResolve('how many theft cases in Mysuru in 2025');
    assert(r.intent === 'count', r.intent);
    assert(r.zcql.includes("DistrictName = 'Mysuru'"), r.zcql);
  });
  await t('hotspot intent', () => {
    const r = templateResolve('where are the crime hotspots');
    assert(r.intent === 'hotspots', r.intent);
  });
  await t('repeat offender intent', () => {
    const r = templateResolve('show me repeat offenders');
    assert(r.intent === 'repeat_offenders', r.intent);
  });

  console.log('Analytics + Network:');
  await t('trend transform buckets by month', async () => {
    const { content } = await executeQuery(guard.validate(analytics.trendQuery()));
    const out = analytics.trendTransform(content);
    assert(out.length > 0 && out[0].month.match(/^\d{4}-\d{2}$/), 'bad month buckets');
  });
  await t('network builds nodes + edges + gangs', async () => {
    const { content } = await executeQuery(guard.validate(accusedGraphQuery()));
    const net = buildNetwork(content, { minCases: 2 });
    assert(net.nodes.length > 0, 'no nodes');
    assert(net.topOffenders.length > 0, 'no top offenders');
    assert(net.topOffenders[0].risk >= net.topOffenders[1].risk, 'not sorted by risk');
    console.log(`      -> ${net.stats.repeatOffenders} repeat offenders, ${net.gangs.length} gangs, top risk=${net.topOffenders[0].risk}`);
  });

  console.log(`\n${passed} checks passed.`);
})();
