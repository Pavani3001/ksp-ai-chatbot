# KSP Crime Intelligence Platform

**Intelligent Conversational AI & Crime Analytics for the Karnataka State Police FIR database.**

Ask questions in plain English or Kannada — *"Where are the theft hotspots in Mysuru in 2025?"* — and get an answer backed by a transparent evidence trail (the exact query that was run), interactive analytics, and criminal-network intelligence. Built to deploy on **Zoho Catalyst**.

> Hackathon prototype. Ships with a self-contained mock data layer so it runs end-to-end with **zero external credentials**, and a documented swap to live Catalyst services for deployment.

---

## What it does

| # | Capability | Where |
|---|------------|-------|
| 1 | **Conversational crime intelligence** — NL → ZCQL → answer, with follow-up context, EN/Kannada, voice input, and PDF export of the conversation | `Assistant` tab |
| 2 | **Explainable AI** — every answer shows the executed ZCQL + row count + a plain-language rationale | evidence trail under each answer |
| 3 | **Crime pattern & trend analytics** — monthly trend, crime-head/status breakdowns, district ranking, GPS hotspot map | `Analytics` tab |
| 4 | **Socio-demographic insights** — complainant age bands, gender, occupation distributions | `Analytics` tab |
| 5 | **Criminal network & repeat-offender analysis** — co-accused graph, gang detection, offender **risk scoring** | `Networks` tab |
| 6 | **Investigator decision support** — case summary endpoint (`/case/:crimeNo`) returning facts, accused, victims | API |
| 7 | **Secure querying** — SELECT-only guardrail, table allowlist, forced LIMIT, no stacked queries/comments | `function/api/lib/zcqlGuard.js` |

See [`docs/PROTOTYPE_BRIEF.md`](docs/PROTOTYPE_BRIEF.md) for the submission brief and how each maps to the challenge's 10 solution areas (including what's roadmap vs. built).

---

## Architecture

```
        React SPA  (Catalyst Web Client Hosting)
              │  REST /chat /analytics /network /case
              ▼
   Catalyst Serverless Function — Node.js  (function/api)
   ┌──────────────────────────────────────────────┐
   │  zcqlGuard → nl2zcql → dataClient → analytics  │
   │                          │        └ network/risk│
   └──────────┬───────────────┴─────────────────────┘
              │                         │
   Catalyst QuickML (LLM Serving)   Catalyst Data Store (ZCQL / OLAP)
     NL→ZCQL + explanation            27 FIR tables
```

The **provider adapters** decouple logic from infrastructure:

- `DATA_PROVIDER=mock` runs a MySQL-compatible ZCQL interpreter over local JSON (`function/api/lib/mockZcql.js`). `DATA_PROVIDER=catalyst` calls `zcql.executeZCQLQuery` / `executeOLAPQuery`.
- `LLM_PROVIDER=template` uses a deterministic rule-based NL→ZCQL resolver. `LLM_PROVIDER=quickml` calls Catalyst QuickML LLM Serving.

The **same guarded ZCQL string runs unchanged** against both the mock and Catalyst data stores. Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the data model is in [`docs/SCHEMA.md`](docs/SCHEMA.md).

---

## Run locally

Requires Node 18+.

```bash
# 1. Generate the synthetic dataset (deterministic, ~1,200 FIRs)
node data/generate_seed.js

# 2. Backend — Catalyst function runs standalone as an Express server
cd function/api
npm install
npm test          # 41 checks: ZCQL engine, guardrail, routes, client contract
npm start         # http://localhost:3001  (needs local bind permission)

# 3. Frontend (in a second terminal)
cd client
npm install
npm run dev       # http://localhost:5173  (proxies /api -> :3001)
```

Then open http://localhost:5173 and try: *"How many theft cases in Mysuru in 2025?"*, *"Where are the crime hotspots?"*, *"Show me repeat offenders."*

> The test suite runs the API **in-process** (no socket), so `npm test` works even in restricted/sandboxed environments where binding a port is blocked.

---

## Deploy on Catalyst

Deployment on Catalyst is **mandatory** for this challenge. Step-by-step in [`docs/ARCHITECTURE.md#deployment`](docs/ARCHITECTURE.md). In short:

```bash
npm i -g zcatalyst-cli
catalyst login
catalyst init                    # link to your Catalyst project (uses catalyst.json)

# Provision services in the Catalyst console:
#   - Data Store  : create the 27 tables (docs/SCHEMA.md) and import data/seed/*.json
#   - QuickML     : deploy an LLM serving endpoint; copy its URL + token
#   - Web Client Hosting : serves client/dist
#   - Authentication     : enable for role-based access

# Configure the function environment (Catalyst console → Functions → api → Env):
DATA_PROVIDER=catalyst
LLM_PROVIDER=quickml
QUICKML_ENDPOINT=<your endpoint>
QUICKML_API_KEY=<oauth token>

cd client && npm run build && cd ..
catalyst deploy                  # functions + client hosting
```

Catalyst service mapping (per the challenge's required-services table): Serverless Functions, Data Store (ZCQL/OLAP + full-text), QuickML (LLM Serving/RAG), Web Client Hosting, Authentication, API Gateway. Details in the architecture doc.

---

## Repository layout

```
kspdata/
├── README.md
├── catalyst.json                  # Catalyst project config
├── .env.example
├── docs/
│   ├── PROTOTYPE_BRIEF.md          # submission brief + challenge coverage
│   ├── ARCHITECTURE.md             # architecture, adapters, deployment, security
│   └── SCHEMA.md                   # 27-table FIR data model
├── data/
│   ├── schema/schema.js            # canonical schema (source of truth)
│   ├── generate_seed.js            # deterministic synthetic data generator
│   └── seed/                       # generated JSON (git-ignored, reproducible)
├── function/api/                  # Catalyst Advanced I/O function (Node.js)
│   ├── index.js                    # Express app (routes)
│   ├── lib/                        # dataClient, mockZcql, zcqlGuard, nl2zcql, analytics, network, schema
│   └── test/                       # smoke, http (in-process), contract tests
└── client/                         # React SPA (Vite)
    └── src/{App, components/{Chat,Dashboard,NetworkView}, lib/{api,i18n}}
```

## Security & governance

This is a law-enforcement system, so query safety is enforced centrally:
**SELECT-only**, single-statement, no SQL comments, table **allowlist**, and an always-injected **LIMIT** — every query (LLM-generated or built-in) passes `zcqlGuard.validate()` before touching data. Role-based access is provided by Catalyst Authentication; audit logging is on the roadmap (see brief).

> All data in this repo is **synthetic** and generated locally. No real FIR/PII data is included.
