# Prototype Brief — KSP Crime Intelligence Platform

## Problem statement addressed

The Karnataka State Police FIR database holds rich, interconnected records — FIRs, accused, victims, complainants, locations, acts/sections, arrests, and organizational hierarchy — but investigators, analysts, and policymakers cannot easily interrogate it. Answering even simple questions ("how many theft cases in Mysuru this year?", "who are the repeat offenders and who do they work with?") requires SQL skills and manual cross-referencing across a dozen tables.

We built an **Intelligent Conversational AI and Crime Analytics Platform** that lets any authorized user query the crime database in **natural language (English & Kannada)** and receive answers grounded in the data — with a transparent evidence trail — alongside visual analytics and criminal-network intelligence for investigative decision support and proactive policing.

## Key features and functionalities

1. **Conversational crime intelligence** — Natural-language questions are translated to **ZCQL** (Catalyst's MySQL-compatible query language), executed against the FIR data store, and answered in plain language. Supports **context-aware follow-ups** (the district/year/crime from one question carries into the next), **English + Kannada**, **voice input** (Web Speech API), and **PDF export** of the whole conversation.
2. **Explainable AI** — Every answer displays the exact ZCQL that produced it, the row count, and a one-line rationale — meeting law-enforcement accountability requirements.
3. **Crime pattern & trend analytics** — Monthly trend lines, crime-head and case-status breakdowns, district hotspot ranking, and a GPS scatter map plotting individual incidents to reveal clusters.
4. **Socio-demographic insights** — Distributions by complainant age band, gender, and occupation, enabling analysis of social risk factors.
5. **Criminal network & repeat-offender analysis** — A co-accused graph (two offenders linked if they share an FIR), automatic **gang/group detection** via connected components, and an **offender risk score** (0–100) blending case volume, co-offender breadth, offence gravity, and recency.
6. **Investigator decision support** — A case-summary API returns brief facts, accused, and victims for any crime number.
7. **Secure-by-default querying** — A central guardrail permits only single-statement `SELECT`s against allowlisted tables, strips comments, blocks stacked queries, and always enforces a result `LIMIT`.

## Technology stack used

- **Frontend:** React 18 + Vite SPA; Recharts for charts; canvas force-directed graph for networks; jsPDF for export; Web Speech API for voice. → **Catalyst Web Client Hosting**
- **Backend:** Node.js (Express) serverless function. → **Catalyst Serverless Functions (Advanced I/O)**
- **Data:** 27-table FIR schema queried via **ZCQL / OLAP**. → **Catalyst Data Store**
- **AI / NL→ZCQL:** schema-grounded LLM prompt. → **Catalyst QuickML (LLM Serving / RAG)**
- **Auth:** role-based access. → **Catalyst Authentication**; **API Gateway** in front of the function.
- **Portability:** provider adapters allow a fully offline mock mode (local ZCQL interpreter + rule-based NL→ZCQL) that swaps to the Catalyst services above via environment variables.

## Proposed impact and use case

- **Investigators** get instant case lookups, similar-case context, and repeat-offender/associate leads without writing queries.
- **Analysts** surface hotspots, trends, and socio-demographic patterns for briefings in seconds.
- **Supervisors / policymakers** get district-level intelligence and risk-prioritized offender lists to allocate resources and drive **proactive, preventive** policing.
- **Accountability** is built in: every AI answer is backed by the exact query and evidence, satisfying transparency requirements for law-enforcement AI.

## Coverage of the challenge's 10 solution areas

| Area | Status in this prototype |
|------|--------------------------|
| 1. Conversational interface (EN/Kannada, context, voice, PDF) | **Built** |
| 2. Criminal network & relationship analysis | **Built** (co-accused graph, gang detection) |
| 3. Crime pattern & trend analytics | **Built** (time/geography/type, hotspots) |
| 4. Sociological crime insights | **Built** (age/gender/occupation; caste/religion in schema) |
| 5. Criminology-based offender profiling | **Built** (repeat-offender detection + risk scoring) |
| 6. Investigator decision support | **Partial** (case summaries via API; similar-case recommendation on roadmap) |
| 7. Financial crime & transaction link analysis | **Roadmap** — not in the provided ER schema; would ingest transaction tables |
| 8. Crime forecasting & early warning | **Roadmap** — trend infrastructure in place; predictive model to be added |
| 9. Explainable AI & transparent analytics | **Built** (evidence trail on every answer) |
| 10. Secure role-based access & governance | **Partial** (query guardrail + Catalyst Auth; full audit-log persistence on roadmap) |

## Notes on data

All data is **synthetic**, generated deterministically by `data/generate_seed.js` to mirror the official FIR ER diagram — including realistic Karnataka districts, repeat-offender clusters, geographic hotspots, and seasonal trends — so the analytics demonstrate real structure. **No real FIR or personal data is used.**
