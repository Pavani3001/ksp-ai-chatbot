/**
 * HTTP route test — drives the Express app in-memory (no socket) via inject().
 * Run: node functions/api/test/http.js
 */
process.env.SEED_DIR = require('path').join(__dirname, '..', '..', '..', 'data', 'seed');

const assert = require('assert');
const { inject } = require('./inject');
const app = require('../index');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

(async () => {
  await t('GET /health', async () => {
    const r = await inject(app, { url: '/health' });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });

  await t('POST /chat count returns answer + evidence', async () => {
    const r = await inject(app, { method: 'POST', url: '/chat', body: { question: 'how many theft cases in Mysuru in 2025' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.intent, 'count');
    assert(/matching cases/.test(r.body.answer), r.body.answer);
    assert(r.body.evidence.zcql.includes('SELECT'), 'no evidence zcql');
  });

  await t('POST /chat hotspots', async () => {
    const r = await inject(app, { method: 'POST', url: '/chat', body: { question: 'where are the crime hotspots' } });
    assert.equal(r.body.intent, 'hotspots');
    assert(r.body.rows.length > 0, 'no rows');
  });

  await t('POST /chat follow-up uses context', async () => {
    const r = await inject(app, { method: 'POST', url: '/chat', body: { question: 'what is the status breakdown', context: { district: 'Mysuru' } } });
    assert.equal(r.body.intent, 'status');
    assert(r.body.evidence.zcql.includes('Mysuru'), 'context district not applied');
  });

  await t('POST /chat rejects empty', async () => {
    const r = await inject(app, { method: 'POST', url: '/chat', body: {} });
    assert.equal(r.status, 400);
  });

  for (const kind of ['summary', 'trend', 'crimeHead', 'status', 'district', 'incidents', 'ageBand', 'gender', 'occupation', 'religion']) {
    await t(`GET /analytics/${kind}`, async () => {
      const r = await inject(app, { url: `/analytics/${kind}` });
      assert.equal(r.status, 200, `status ${r.status}`);
      assert(r.body.data, 'no data');
    });
  }

  await t('GET /network', async () => {
    const r = await inject(app, { url: '/network' });
    assert.equal(r.status, 200);
    assert(r.body.nodes.length > 0 && r.body.topOffenders.length > 0, 'empty network');
    console.log(`      -> nodes=${r.body.nodes.length} edges=${r.body.edges.length} gangs=${r.body.gangs.length} topRisk=${r.body.topOffenders[0].risk}`);
  });

  await t('GET /network?focus=<top offender> narrows graph', async () => {
    const full = await inject(app, { url: '/network' });
    const name = full.body.topOffenders[0].name;
    const r = await inject(app, { url: '/network', query: { focus: name } });
    assert(r.body.nodes.some((n) => n.id === name), 'focus node missing');
  });

  await t('GET /case/:crimeNo returns case + accused + victims', async () => {
    const list = await inject(app, { method: 'POST', url: '/chat', body: { question: 'list recent theft cases' } });
    const crimeNo = list.body.rows[0].CrimeNo;
    const r = await inject(app, { url: `/case/${crimeNo}` });
    assert.equal(r.status, 200, `status ${r.status}`);
    assert(r.body.case.crimeNo, 'no case');
    assert(Array.isArray(r.body.accused), 'no accused array');
  });

  console.log(`\n${passed} HTTP checks passed.`);
})();
