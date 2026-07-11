/**
 * Natural-language -> ZCQL translation.
 *
 * Two backends selected by LLM_PROVIDER:
 *
 *   - 'template' (default): a deterministic intent matcher covering the demo
 *     question set. Zero external calls; ideal for offline demos and tests.
 *   - 'quickml': calls Catalyst QuickML LLM Serving with a schema-grounded
 *     prompt and parses the model's ZCQL. The generated query is ALWAYS run
 *     through the guardrail afterwards by the caller.
 *
 * Every result carries an `explanation` and the `zcql` used, so the UI can
 * render an evidence trail (Explainable-AI requirement).
 */

const { buildSchemaPrompt } = require('./schemaPrompt');

const PROVIDER = process.env.LLM_PROVIDER || 'template';

// Bilingual keyword lexicon (English + transliterated/native Kannada terms).
const LEX = {
  murder: ['murder', 'homicide', 'kolapataka', 'ಕೊಲೆ'],
  theft: ['theft', 'steal', 'stolen', 'kalavu', 'ಕಳ್ಳತನ'],
  robbery: ['robbery', 'dakaiti', 'ದರೋಡೆ'],
  women: ['women', 'woman', 'dowry', 'domestic', 'mahila', 'ಮಹಿಳೆ'],
  cyber: ['cyber', 'online fraud', 'upi', 'phishing', 'ಸೈಬರ್'],
  count: ['how many', 'count', 'number of', 'total', 'estu', 'ಎಷ್ಟು'],
  hotspot: ['hotspot', 'hot spot', 'cluster', 'where', 'location', 'ಎಲ್ಲಿ'],
  trend: ['trend', 'over time', 'monthly', 'yearly', 'by year', 'by month'],
  repeat: ['repeat offender', 'habitual', 'career criminal', 'multiple cases'],
  status: ['status', 'under investigation', 'charge sheet', 'chargesheet', 'closed', 'pending'],
};

const DISTRICTS = ['Bengaluru City', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubballi-Dharwad',
  'Belagavi', 'Kalaburagi', 'Ballari', 'Vijayapura', 'Davanagere', 'Shivamogga', 'Tumakuru',
  'Udupi', 'Hassan', 'Mandya'];

function has(text, keys) {
  return keys.some((k) => text.includes(k));
}
function matchDistrict(text) {
  return DISTRICTS.find((d) => text.includes(d.toLowerCase()));
}
function matchYear(text) {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? m[1] : null;
}
function matchCrime(text) {
  const map = { Murder: LEX.murder, Theft: LEX.theft, Robbery: LEX.robbery };
  for (const [name, keys] of Object.entries(map)) if (has(text, keys)) return name;
  if (has(text, LEX.cyber)) return 'CYBER_HEAD';
  if (has(text, LEX.women)) return 'WOMEN_HEAD';
  return null;
}

/**
 * Template intent resolver. Returns { zcql, explanation, intent, followupBase }.
 */
function templateResolve(question, context = {}) {
  const text = question.toLowerCase();
  const district = matchDistrict(text) || context.district || null;
  const year = matchYear(text) || context.year || null;
  const crime = matchCrime(text) || context.crime || null;

  const whereParts = [];
  const joinDistrict = district
    ? ' JOIN Unit u ON cm.PoliceStationID = u.UnitID JOIN District d ON u.DistrictID = d.DistrictID'
    : '';
  if (district) whereParts.push(`d.DistrictName = '${district}'`);
  if (year) whereParts.push(`cm.CrimeRegisteredDate LIKE '${year}%'`);

  let subheadJoin = '';
  if (crime === 'Murder' || crime === 'Theft' || crime === 'Robbery') {
    subheadJoin = ' JOIN CrimeSubHead csh ON cm.CrimeMinorHeadID = csh.CrimeSubHeadID';
    whereParts.push(`csh.CrimeHeadName = '${crime}'`);
  } else if (crime === 'CYBER_HEAD') {
    subheadJoin = ' JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID';
    whereParts.push(`ch.CrimeGroupName = 'Cyber Crimes'`);
  } else if (crime === 'WOMEN_HEAD') {
    subheadJoin = ' JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID';
    whereParts.push(`ch.CrimeGroupName = 'Crimes Against Women'`);
  }
  const where = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

  // ---- Intent: repeat offenders ----
  if (has(text, LEX.repeat)) {
    return {
      intent: 'repeat_offenders',
      zcql: `SELECT AccusedName, COUNT(*) AS case_count FROM Accused GROUP BY AccusedName ORDER BY case_count DESC LIMIT 15`,
      explanation: 'Grouping the Accused table by name and counting linked cases surfaces individuals appearing across multiple FIRs — a proxy for repeat/habitual offenders.',
      context: { district, year, crime },
    };
  }

  // ---- Intent: hotspots ----
  if (has(text, LEX.hotspot)) {
    return {
      intent: 'hotspots',
      zcql: `SELECT d.DistrictName AS DistrictName, COUNT(*) AS case_count FROM CaseMaster cm JOIN Unit u ON cm.PoliceStationID = u.UnitID JOIN District d ON u.DistrictID = d.DistrictID${subheadJoin}${where ? where : ''} GROUP BY d.DistrictName ORDER BY case_count DESC LIMIT 15`,
      explanation: 'Counting FIRs per district (joining CaseMaster → Unit → District) ranks geographic concentration of crime. The map view plots individual incident lat/long for finer hotspot detection.',
      context: { district, year, crime },
    };
  }

  // ---- Intent: trend over time ----
  if (has(text, LEX.trend)) {
    return {
      intent: 'trend',
      zcql: `SELECT cm.CrimeRegisteredDate AS d, COUNT(*) AS case_count FROM CaseMaster cm${joinDistrict}${subheadJoin}${where} GROUP BY cm.CrimeRegisteredDate ORDER BY d ASC LIMIT 500`,
      explanation: 'Aggregating case counts by registration date reveals temporal trends. The dashboard rolls these up to monthly buckets for seasonal analysis.',
      context: { district, year, crime },
    };
  }

  // ---- Intent: count ----
  if (has(text, LEX.count)) {
    return {
      intent: 'count',
      zcql: `SELECT COUNT(*) AS case_count FROM CaseMaster cm${joinDistrict}${subheadJoin}${where}`,
      explanation: `Counting rows in CaseMaster${crime ? ` filtered to ${crime}` : ''}${district ? ` in ${district}` : ''}${year ? ` for ${year}` : ''} yields the requested total.`,
      context: { district, year, crime },
    };
  }

  // ---- Intent: status breakdown ----
  if (has(text, LEX.status)) {
    return {
      intent: 'status',
      zcql: `SELECT csm.CaseStatusName AS status, COUNT(*) AS case_count FROM CaseMaster cm JOIN CaseStatusMaster csm ON cm.CaseStatusID = csm.CaseStatusID${joinDistrict}${subheadJoin}${where} GROUP BY csm.CaseStatusName ORDER BY case_count DESC`,
      explanation: 'Joining CaseMaster to CaseStatusMaster and grouping by status name shows the investigation-stage distribution of matching cases.',
      context: { district, year, crime },
    };
  }

  // ---- Fallback: list recent matching cases ----
  return {
    intent: 'list_cases',
    zcql: `SELECT cm.CrimeNo AS CrimeNo, cm.CrimeRegisteredDate AS RegisteredDate, cm.BriefFacts AS BriefFacts FROM CaseMaster cm${joinDistrict}${subheadJoin}${where} ORDER BY cm.CrimeRegisteredDate DESC LIMIT 25`,
    explanation: `Returning the most recent matching FIRs${crime ? ` for ${crime}` : ''}${district ? ` in ${district}` : ''}${year ? ` in ${year}` : ''}, ordered by registration date.`,
    context: { district, year, crime },
  };
}

// ---- QuickML backend ----------------------------------------------------
async function quickmlResolve(question, context, req) {
  const prompt = `${buildSchemaPrompt()}

Conversation context (for follow-up questions): ${JSON.stringify(context || {})}

User question: "${question}"

Respond with ONLY a JSON object: {"zcql": "<single SELECT query>", "explanation": "<one sentence on how this answers the question>"}. The query MUST be a single SELECT statement using only the tables and columns listed. Prefer JOINs to resolve foreign keys to human-readable names. Always include a LIMIT.`;

  const endpoint = process.env.QUICKML_ENDPOINT;
  const apiKey = process.env.QUICKML_API_KEY;
  if (!endpoint) throw new Error('QUICKML_ENDPOINT not configured');

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Zoho-oauthtoken ${apiKey}` } : {}),
    },
    body: JSON.stringify({ prompt, max_tokens: 512, temperature: 0 }),
  });
  if (!resp.ok) throw new Error(`QuickML error ${resp.status}`);
  const data = await resp.json();
  // Model serving responses vary; try common shapes.
  const textOut = data.output || data.text || data.choices?.[0]?.text || data.response || '';
  const jsonM = textOut.match(/\{[\s\S]*\}/);
  if (!jsonM) throw new Error('Could not parse LLM output');
  const parsed = JSON.parse(jsonM[0]);
  return { intent: 'llm', zcql: parsed.zcql, explanation: parsed.explanation, context: context || {} };
}

async function nlToZcql(question, context, req) {
  if (PROVIDER === 'quickml') {
    try {
      return await quickmlResolve(question, context, req);
    } catch (e) {
      // Graceful degradation: fall back to template resolver so the platform
      // still answers even if the model endpoint is unavailable.
      const t = templateResolve(question, context);
      t.explanation = `${t.explanation} (LLM unavailable, used rule-based resolver)`;
      t.degraded = true;
      return t;
    }
  }
  return templateResolve(question, context);
}

module.exports = { nlToZcql, templateResolve, PROVIDER };
