/**
 * Contract test: confirms the API response shapes consumed by the React
 * components match exactly what the backend emits. Guards against silent
 * client/server drift without needing a browser or a bound socket.
 * Run: node functions/api/test/contract.js
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
const hasKeys = (obj, keys, ctx) => keys.forEach((k) => assert(k in obj, `${ctx} missing '${k}'`));

(async () => {
  // Chat.jsx consumes: answer, explanation, evidence.{zcql,rowCount}, rows[], context, intent
  await t('/chat shape matches Chat.jsx', async () => {
    const r = await inject(app, { method: 'POST', url: '/chat', body: { question: 'where are the hotspots' } });
    hasKeys(r.body, ['answer', 'explanation', 'evidence', 'rows', 'context', 'intent'], '/chat');
    hasKeys(r.body.evidence, ['zcql', 'rowCount'], '/chat.evidence');
    assert(Array.isArray(r.body.rows), 'rows not array');
  });

  // Dashboard.jsx summary KPIs
  await t('/analytics/summary shape matches Dashboard KPIs', async () => {
    const r = await inject(app, { url: '/analytics/summary' });
    hasKeys(r.body.data, ['total', 'heinous', 'arrests', 'chargesheeted'], 'summary');
  });

  // Dashboard charts expect [{name,count}] or [{month,count}] / [{band,count}]
  await t('/analytics/trend rows have month+count', async () => {
    const r = await inject(app, { url: '/analytics/trend' });
    hasKeys(r.body.data[0], ['month', 'count'], 'trend');
  });
  for (const [kind, key] of [['crimeHead', 'name'], ['status', 'name'], ['district', 'name'], ['occupation', 'name'], ['gender', 'name']]) {
    await t(`/analytics/${kind} rows have ${key}+count`, async () => {
      const r = await inject(app, { url: `/analytics/${kind}` });
      hasKeys(r.body.data[0], [key, 'count'], kind);
    });
  }
  await t('/analytics/ageBand rows have band+count', async () => {
    const r = await inject(app, { url: '/analytics/ageBand' });
    hasKeys(r.body.data[0], ['band', 'count'], 'ageBand');
  });
  await t('/analytics/incidents rows have lat/lng/type', async () => {
    const r = await inject(app, { url: '/analytics/incidents' });
    hasKeys(r.body.data[0], ['lat', 'lng', 'type'], 'incidents');
  });

  // NetworkView.jsx expects nodes[{id,caseCount,risk,crimes}], edges[{source,target,weight}],
  // topOffenders[{name,caseCount,coOffenders,risk,crimes}], gangs[{id,size,members}], stats
  await t('/network shape matches NetworkView.jsx', async () => {
    const r = await inject(app, { url: '/network' });
    hasKeys(r.body, ['nodes', 'edges', 'topOffenders', 'gangs', 'stats'], '/network');
    hasKeys(r.body.nodes[0], ['id', 'caseCount', 'risk', 'crimes'], 'node');
    hasKeys(r.body.edges[0], ['source', 'target', 'weight'], 'edge');
    hasKeys(r.body.topOffenders[0], ['name', 'caseCount', 'coOffenders', 'risk', 'crimes'], 'offender');
    hasKeys(r.body.gangs[0], ['id', 'size', 'members'], 'gang');
    hasKeys(r.body.stats, ['totalOffenders', 'repeatOffenders'], 'stats');
  });

  console.log(`\n${passed} contract checks passed.`);
})();
