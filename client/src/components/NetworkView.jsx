import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// Criminal-network view: a canvas graph of co-accused links (offenders sharing
// FIRs) plus a risk-scored offender list and detected groups (gangs).
// A small force simulation lays out nodes; clicking an offender re-queries the
// backend for that person's ego-network.
export default function NetworkView({ t }) {
  const [net, setNet] = useState(null);
  const [focus, setFocus] = useState(null);
  const [err, setErr] = useState(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    setNet(null);
    (async () => {
      try { setNet(await api.network(focus)); }
      catch (e) { setErr(e.message); }
    })();
  }, [focus]);

  useEffect(() => {
    if (!net || !canvasRef.current) return undefined;
    const cancel = runSim(canvasRef.current, net, focus, (name) => setFocus(name));
    animRef.current = cancel;
    return () => cancel && cancel();
  }, [net, focus]);

  if (err) return <div className="card err">Failed to load network: {err}</div>;

  const riskColor = (r) => (r >= 70 ? '#e74c3c' : r >= 45 ? '#f2994a' : '#27ae60');

  return (
    <div className="net-layout">
      <div className="card">
        <h3>{t.tabs.network}</h3>
        {!net ? <div className="spinner">Building network…</div> : (
          <>
            <canvas ref={canvasRef} width={640} height={440} style={{ width: '100%', borderRadius: 10, background: '#0d2137' }} />
            <div className="legend">
              {focus
                ? <>Focused on <strong>{focus}</strong>. <a href="#" onClick={(e) => { e.preventDefault(); setFocus(null); }}>{t.clearFocus}</a></>
                : t.focusHint}
              {' · '}{net.stats.repeatOffenders} repeat offenders · {net.gangs.length} groups
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>{t.topOffenders}</h3>
        {net?.topOffenders.map((o) => (
          <div className="offender-row" key={o.name} onClick={() => setFocus(o.name)}>
            <div>
              <div style={{ fontWeight: 600 }}>{o.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {o.caseCount} {t.cases} · {o.coOffenders} {t.coOffenders}
              </div>
              <div>{o.crimes.slice(0, 3).map((c) => <span className="tag" key={c}>{c}</span>)}</div>
            </div>
            <span className="risk-pill" style={{ background: riskColor(o.risk) }}>{o.risk}</span>
          </div>
        ))}

        {net?.gangs.length > 0 && (
          <>
            <h3 style={{ marginTop: 18 }}>{t.gangs}</h3>
            {net.gangs.map((g) => (
              <div key={g.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #eef2f7' }}>
                <strong>{g.id}</strong> — {g.size} members
                <div>{g.members.slice(0, 4).map((m) => <span className="tag" key={m}>{m}</span>)}
                  {g.members.length > 4 && <span className="tag">+{g.members.length - 4}</span>}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Minimal force-directed layout on canvas. Returns a cleanup fn.
function runSim(canvas, net, focus, onClick) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const nodes = net.nodes.map((n) => ({
    ...n, x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 + (Math.random() - 0.5) * 200, vx: 0, vy: 0,
  }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = net.edges.filter((e) => byId[e.source] && byId[e.target]);
  const riskColor = (r) => (r >= 70 ? '#e74c3c' : r >= 45 ? '#f2994a' : '#56ccf2');

  let running = true;
  let ticks = 0;
  function step() {
    if (!running) return;
    ticks++;
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = 900 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    // Attraction along edges
    for (const e of edges) {
      const a = byId[e.source], b = byId[e.target];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 60) * 0.008 * Math.min(e.weight, 4);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    // Centre gravity + integrate
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.001;
      n.vy += (H / 2 - n.y) * 0.001;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(12, Math.min(W - 12, n.x));
      n.y = Math.max(12, Math.min(H - 12, n.y));
    }
    // Draw
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,180,240,0.25)';
    for (const e of edges) {
      const a = byId[e.source], b = byId[e.target];
      ctx.lineWidth = Math.min(e.weight, 4) * 0.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      const r = 4 + Math.min(n.caseCount, 8) * 1.4;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.id === focus ? '#fff' : riskColor(n.risk);
      ctx.fill();
      if (n.id === focus || nodes.length < 40) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '9px sans-serif';
        ctx.fillText(n.id.split(' ')[0], n.x + r + 2, n.y + 3);
      }
    }
    if (ticks < 400) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // Click-to-focus hit testing.
  function handleClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (W / rect.width);
    const my = (ev.clientY - rect.top) * (H / rect.height);
    let best = null, bestD = 16;
    for (const n of nodes) {
      const d = Math.hypot(n.x - mx, n.y - my);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) onClick(best.id);
  }
  canvas.addEventListener('click', handleClick);

  return () => { running = false; canvas.removeEventListener('click', handleClick); };
}
