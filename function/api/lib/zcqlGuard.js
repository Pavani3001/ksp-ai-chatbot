/**
 * ZCQL guardrail.
 *
 * Every query — whether produced by the NL->ZCQL layer or an analytics
 * builder — passes through validate() before it reaches the data store. This
 * enforces the security posture required for a law-enforcement system:
 *
 *   1. SELECT-only. INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE are rejected.
 *   2. Single statement. No stacked queries (`;`).
 *   3. No comments (-- or block) that could smuggle payloads.
 *   4. Every referenced table must be in the schema allowlist.
 *   5. A LIMIT is always enforced (injected if absent) to cap result size.
 *
 * The validator returns a sanitized query string, or throws with a reason.
 */

const { TABLE_NAMES } = require('./schema');

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|MERGE|GRANT|REVOKE|EXEC|EXECUTE)\b/i;
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

function validate(zcql, { maxLimit = MAX_LIMIT, defaultLimit = DEFAULT_LIMIT } = {}) {
  if (typeof zcql !== 'string' || !zcql.trim()) {
    throw new Error('Empty query');
  }
  let q = zcql.trim().replace(/;+\s*$/, '');

  if (q.includes(';')) throw new Error('Stacked queries are not allowed');
  if (/--|\/\*|\*\//.test(q)) throw new Error('Comments are not allowed in queries');
  if (!/^select\b/i.test(q)) throw new Error('Only SELECT queries are permitted');
  if (FORBIDDEN.test(q)) throw new Error('Query contains a forbidden keyword');

  // Table allowlist: collect identifiers appearing after FROM / JOIN.
  const refs = [...q.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)].map((m) => m[1]);
  if (refs.length === 0) throw new Error('Query references no known table');
  for (const t of refs) {
    if (!TABLE_NAMES.includes(t)) throw new Error(`Unknown or disallowed table: ${t}`);
  }

  // Enforce LIMIT.
  const limitM = q.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (limitM) {
    const n = parseInt(limitM[1], 10);
    if (n > maxLimit) q = q.replace(/\bLIMIT\s+\d+\s*$/i, `LIMIT ${maxLimit}`);
  } else {
    q = `${q} LIMIT ${defaultLimit}`;
  }
  return q;
}

module.exports = { validate, MAX_LIMIT, DEFAULT_LIMIT };
