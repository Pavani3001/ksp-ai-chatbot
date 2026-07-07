/**
 * Minimal ZCQL/SQL interpreter over in-memory JSON tables.
 *
 * Supports the MySQL-compatible subset that the platform's NL->ZCQL layer and
 * analytics endpoints emit:
 *
 *   SELECT <cols|aggregates> FROM <table> [alias]
 *   [JOIN <table> [alias] ON a.col = b.col] ...
 *   [WHERE <conditions with AND / OR / =, !=, >, <, >=, <=, LIKE, IN, BETWEEN>]
 *   [GROUP BY <cols>]
 *   [ORDER BY <col> [ASC|DESC]]
 *   [LIMIT <n>]
 *
 * Aggregates: COUNT(*), COUNT(col), SUM, AVG, MIN, MAX with optional alias.
 * This is not a full SQL engine — it is scoped to what the app generates and
 * is heavily commented so behaviour is auditable.
 */

function loadMockTables(seedDir, fs, path) {
  const tables = {};
  for (const f of fs.readdirSync(seedDir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const name = f.replace(/\.json$/, '');
    tables[name] = JSON.parse(fs.readFileSync(path.join(seedDir, f), 'utf8'));
  }
  return tables;
}

// ---- Tokenizer-lite parsing via regex on clause boundaries --------------
function splitClauses(sql) {
  const s = sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
  const upper = s.toUpperCase();
  const idx = (kw) => {
    const m = upper.indexOf(` ${kw} `);
    return m === -1 ? -1 : m;
  };
  const marks = [
    ['SELECT', upper.startsWith('SELECT ') ? 0 : -1],
    ['FROM', idx('FROM')],
    ['WHERE', idx('WHERE')],
    ['GROUP', idx('GROUP BY')],
    ['ORDER', idx('ORDER BY')],
    ['LIMIT', idx('LIMIT')],
  ];
  return { s, marks };
}

function parse(sql) {
  const { s } = splitClauses(sql);
  const re = /^SELECT\s+(.*?)\s+FROM\s+(.*?)(?:\s+WHERE\s+(.*?))?(?:\s+GROUP BY\s+(.*?))?(?:\s+ORDER BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/is;
  const m = s.match(re);
  if (!m) throw new Error(`Unable to parse query: ${sql}`);
  return {
    select: m[1].trim(),
    from: m[2].trim(),
    where: m[3] ? m[3].trim() : null,
    groupBy: m[4] ? m[4].trim() : null,
    orderBy: m[5] ? m[5].trim() : null,
    limit: m[6] ? parseInt(m[6], 10) : null,
  };
}

// ---- FROM + JOIN --------------------------------------------------------
function parseFrom(fromClause) {
  // e.g. "CaseMaster cm JOIN Accused a ON cm.CaseMasterID = a.CaseMasterID"
  const parts = fromClause.split(/\s+JOIN\s+/i);
  const base = parseTableRef(parts[0].replace(/\s+LEFT\s*$/i, '').trim());
  const joins = [];
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^(.*?)\s+ON\s+(.*)$/i);
    if (!m) throw new Error(`Bad JOIN: ${parts[i]}`);
    const ref = parseTableRef(m[1].trim());
    const cond = m[2].trim().match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/);
    if (!cond) throw new Error(`Bad JOIN condition: ${m[2]}`);
    joins.push({ ...ref, left: { alias: cond[1], col: cond[2] }, right: { alias: cond[3], col: cond[4] } });
  }
  return { base, joins };
}
function parseTableRef(ref) {
  const parts = ref.trim().split(/\s+/);
  return { table: parts[0], alias: parts[1] || parts[0] };
}

// Build combined rows: each combined row is { alias: rowObj, ... }
function buildRows(fromClause, tables) {
  const { base, joins } = parseFrom(fromClause);
  if (!tables[base.table]) throw new Error(`Unknown table: ${base.table}`);
  let rows = tables[base.table].map((r) => ({ [base.alias]: r }));

  for (const j of joins) {
    if (!tables[j.table]) throw new Error(`Unknown table: ${j.table}`);
    // index right table by join key
    const idx = new Map();
    for (const r of tables[j.table]) {
      const k = r[j.right.alias === j.alias ? j.right.col : j.right.col];
      const key = String(k);
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(r);
    }
    const out = [];
    for (const combined of rows) {
      const leftRow = combined[j.left.alias];
      const leftVal = leftRow ? leftRow[j.left.col] : undefined;
      const matches = idx.get(String(leftVal)) || [];
      for (const rr of matches) out.push({ ...combined, [j.alias]: rr });
    }
    rows = out;
  }
  return rows;
}

// ---- Value resolution ---------------------------------------------------
function resolveRef(ref, combined) {
  // "cm.CrimeNo" or bare "CrimeNo" (search all aliases)
  ref = ref.trim();
  if (ref.includes('.')) {
    const [alias, col] = ref.split('.');
    return combined[alias] ? combined[alias][col] : undefined;
  }
  for (const alias of Object.keys(combined)) {
    if (combined[alias] && ref in combined[alias]) return combined[alias][ref];
  }
  return undefined;
}
function litOrRef(tok, combined) {
  tok = tok.trim();
  if (/^'.*'$/.test(tok) || /^".*"$/.test(tok)) return tok.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
  return resolveRef(tok, combined);
}

// ---- WHERE evaluation (AND/OR, parens not supported; flat precedence) ---
function evalWhere(where, combined) {
  if (!where) return true;
  // Split on OR first (lower precedence), then AND.
  const orParts = where.split(/\s+OR\s+/i);
  return orParts.some((orp) =>
    orp.split(/\s+AND\s+/i).every((cond) => evalCond(cond.trim(), combined)));
}
function evalCond(cond, combined) {
  let m;
  if ((m = cond.match(/^(.*?)\s+BETWEEN\s+(.*?)\s+AND\s+(.*)$/i))) {
    const v = litOrRef(m[1], combined);
    return v >= litOrRef(m[2], combined) && v <= litOrRef(m[3], combined);
  }
  if ((m = cond.match(/^(.*?)\s+IN\s*\((.*)\)$/i))) {
    const v = litOrRef(m[1], combined);
    const set = m[2].split(',').map((x) => litOrRef(x, combined));
    return set.some((x) => String(x) === String(v));
  }
  if ((m = cond.match(/^(.*?)\s+LIKE\s+(.*)$/i))) {
    const v = String(litOrRef(m[1], combined) ?? '');
    const pat = String(litOrRef(m[2], combined));
    const rx = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
    return rx.test(v);
  }
  if ((m = cond.match(/^(.*?)\s*(>=|<=|!=|<>|=|>|<)\s*(.*)$/))) {
    const a = litOrRef(m[1], combined);
    const b = litOrRef(m[3], combined);
    switch (m[2]) {
      case '=': return String(a) === String(b);
      case '!=': case '<>': return String(a) !== String(b);
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
    }
  }
  throw new Error(`Unsupported WHERE condition: ${cond}`);
}

// ---- SELECT list parsing ------------------------------------------------
function parseSelect(selectClause) {
  return splitTopLevel(selectClause).map((item) => {
    const t = item.trim();
    const aliasM = t.match(/^(.*?)\s+AS\s+(\w+)$/i);
    const expr = aliasM ? aliasM[1].trim() : t;
    const alias = aliasM ? aliasM[2] : null;
    const aggM = expr.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(.*?)\s*\)$/i);
    if (aggM) return { kind: 'agg', fn: aggM[1].toUpperCase(), arg: aggM[2], alias: alias || `${aggM[1].toLowerCase()}` };
    return { kind: 'col', expr, alias: alias || (expr.includes('.') ? expr.split('.')[1] : expr) };
  });
}
function splitTopLevel(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function aggregate(fn, rows, arg, combinedResolver) {
  const vals = rows
    .map((r) => (arg === '*' ? 1 : combinedResolver(arg, r)))
    .filter((v) => v !== undefined && v !== null);
  switch (fn) {
    case 'COUNT': return arg === '*' ? rows.length : vals.length;
    case 'SUM': return vals.reduce((s, v) => s + Number(v), 0);
    case 'AVG': return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : 0;
    case 'MIN': return vals.reduce((m, v) => (v < m ? v : m), vals[0]);
    case 'MAX': return vals.reduce((m, v) => (v > m ? v : m), vals[0]);
    default: throw new Error(`Unsupported aggregate ${fn}`);
  }
}

// ---- Main runner --------------------------------------------------------
function runMockZcql(sql, tables) {
  const q = parse(sql);
  let rows = buildRows(q.from, tables);

  // WHERE
  if (q.where) rows = rows.filter((r) => evalWhere(q.where, r));

  const selects = parseSelect(q.select);
  const hasAgg = selects.some((s) => s.kind === 'agg');

  let resultRows;
  if (q.groupBy || hasAgg) {
    // GROUP BY (or global aggregate)
    const groupCols = q.groupBy ? q.groupBy.split(',').map((c) => c.trim()) : [];
    const groups = new Map();
    for (const r of rows) {
      const key = groupCols.map((c) => String(resolveRef(c, r))).join('|') || '__all__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    resultRows = [];
    for (const [, grpRows] of groups) {
      const out = {};
      for (const sel of selects) {
        if (sel.kind === 'agg') {
          out[sel.alias] = aggregate(sel.fn, grpRows, sel.arg, (a, r) => resolveRef(a, r));
        } else {
          out[sel.alias] = resolveRef(sel.expr, grpRows[0]);
        }
      }
      resultRows.push(out);
    }
  } else {
    // Plain projection
    resultRows = rows.map((r) => {
      if (selects.length === 1 && selects[0].expr === '*') {
        // flatten all aliases into one object
        return Object.assign({}, ...Object.values(r));
      }
      const out = {};
      for (const sel of selects) out[sel.alias] = resolveRef(sel.expr, r);
      return out;
    });
  }

  // ORDER BY
  if (q.orderBy) {
    const [col, dir] = q.orderBy.split(/\s+/);
    const desc = /desc/i.test(dir || '');
    const key = col.includes('.') ? col.split('.')[1] : col;
    resultRows.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return desc ? -cmp : cmp;
    });
  }

  // LIMIT
  if (q.limit != null) resultRows = resultRows.slice(0, q.limit);
  return resultRows;
}

module.exports = { runMockZcql, loadMockTables };
