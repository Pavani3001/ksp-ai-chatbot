// Thin API client. Base URL resolves to the Vite dev proxy (/api) locally,
// or VITE_API_BASE when deployed on Catalyst (e.g. the function's /server route).
const BASE = import.meta.env.VITE_API_BASE || '/api';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}

export const api = {
  health: () => get('/health'),
  chat: (question, context) => post('/chat', { question, context }),
  analytics: (kind) => get(`/analytics/${kind}`),
  network: (focus) => get(`/network${focus ? `?focus=${encodeURIComponent(focus)}` : ''}`),
  caseByCrimeNo: (crimeNo) => get(`/case/${crimeNo}`),
};
