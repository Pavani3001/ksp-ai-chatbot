/**
 * Data client adapter.
 *
 * Exposes a single `executeQuery(zcql)` interface used by the rest of the
 * backend. Two implementations are selected by DATA_PROVIDER:
 *
 *   - 'mock'     (default): a lightweight ZCQL interpreter running over the
 *                seed JSON files. Lets the whole platform run and demo with
 *                zero external dependencies.
 *   - 'catalyst': delegates to the Catalyst Data Store SDK
 *                (zcql.executeZCQLQuery / executeOLAPQuery). Wired for
 *                deployment; requires Catalyst credentials at runtime.
 *
 * The ZCQL we generate is intentionally a MySQL-compatible subset so the
 * exact same query string runs against both providers unchanged.
 */

const fs = require('fs');
const path = require('path');
const { runMockZcql, loadMockTables } = require('./mockZcql');

const PROVIDER = process.env.DATA_PROVIDER || 'mock';

// ---- Mock provider ------------------------------------------------------
let _mockTables = null;
function mockTables() {
  if (_mockTables) return _mockTables;
  const seedDir = process.env.SEED_DIR || path.join(__dirname, '..', '..', '..', 'data', 'seed');
  _mockTables = loadMockTables(seedDir, fs, path);
  return _mockTables;
}

async function executeQueryMock(zcql) {
  const rows = runMockZcql(zcql, mockTables());
  return { content: rows, provider: 'mock' };
}

// ---- Catalyst provider --------------------------------------------------
// Lazily required so the mock path has no Catalyst dependency.
async function executeQueryCatalyst(zcql, req) {
  // eslint-disable-next-line global-require
  const catalyst = require('zcatalyst-sdk-node');
  const app = catalyst.initialize(req);
  const zcqlComp = app.zcql();
  const isAggregate = /\b(count|sum|avg|min|max|group\s+by)\b/i.test(zcql);
  const result = isAggregate
    ? await zcqlComp.executeOLAPQuery(zcql)
    : await zcqlComp.executeZCQLQuery(zcql);
  // Catalyst returns rows keyed by table name; flatten to plain row objects.
  const rows = (result || []).map((r) => {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      const keys = Object.keys(r);
      if (keys.length === 1 && typeof r[keys[0]] === 'object') return r[keys[0]];
    }
    return r;
  });
  return { content: rows, provider: 'catalyst' };
}

/**
 * @param {string} zcql   validated ZCQL string
 * @param {object} [req]  Catalyst request context (only needed for catalyst provider)
 */
async function executeQuery(zcql, req) {
  if (PROVIDER === 'catalyst') return executeQueryCatalyst(zcql, req);
  return executeQueryMock(zcql);
}

module.exports = { executeQuery, PROVIDER };
