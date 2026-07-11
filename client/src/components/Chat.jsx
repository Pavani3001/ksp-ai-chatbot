import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../lib/api';

const COLORS = ['#2f80ed', '#56ccf2', '#27ae60', '#f2994a', '#e74c3c', '#9b51e0', '#2d9cdb', '#eb5757'];

export default function Dashboard({ t }) {
  const [d, setD] = useState({});
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const kinds = ['summary', 'trend', 'crimeHead', 'status', 'district', 'incidents', 'ageBand', 'gender', 'occupation'];
        const results = await Promise.all(kinds.map((k) => api.analytics(k)));
        const map = {};
        kinds.forEach((k, i) => { map[k] = results[i].data; });
        setD(map);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="card err">Failed to load analytics: {err}</div>;
  if (!d.summary) return <div className="card spinner">Loading analytics…</div>;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* KPI row */}
      <div className="grid grid-4">
        <Kpi num={d.summary.total} lbl={t.kpiTotal} />
        <Kpi num={d.summary.heinous} lbl={t.kpiHeinous} color="#e74c3c" />
        <Kpi num={d.summary.arrests} lbl={t.kpiArrests} />
        <Kpi num={d.summary.chargesheeted} lbl={t.kpiChargesheet} color="#27ae60" />
      </div>

      {/* Trend */}
      <div className="card">
        <h3>{t.trend}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={d.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2f80ed" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{t.byHead}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.crimeHead} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" fontSize={10} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#2f80ed" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>{t.byStatus}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.status} dataKey="count" nameKey="name" outerRadius={85} label>
                {d.status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend fontSize={11} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hotspot map + district ranking */}
      <div className="grid grid-2">
        <div className="card">
          <h3>{t.byDistrict}</h3>
          <HotspotMap points={d.incidents} />
          <div className="legend">Each dot = one FIR (GPS lat/long). Clusters reveal hotspots.</div>
        </div>
        <div className="card">
          <h3>{t.byDistrict} — ranking</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.district.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" fontSize={10} width={110} />
              <Tooltip />
              <Bar dataKey="count" fill="#f2994a" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Socio-demographic */}
      <div className="card">
        <h3>{t.demographics}</h3>
        <div className="grid grid-3">
          <MiniBar title={t.ageBand} data={d.ageBand} xKey="band" />
          <MiniPie title={t.gender} data={d.gender} />
          <MiniBar title={t.occupation} data={d.occupation.slice(0, 6)} xKey="name" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ num, lbl, color }) {
  return (
    <div className="card kpi">
      <div className="num" style={color ? { color } : undefined}>{num}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

function MiniBar({ title, data, xKey }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey={xKey} fontSize={9} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Bar dataKey="count" fill="#2d9cdb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function MiniPie({ title, data }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="name" outerRadius={60} label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Legend fontSize={10} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Lightweight SVG scatter of incident GPS points, framed to Karnataka bounds.
function HotspotMap({ points }) {
  const LAT = [11.5, 18.5], LNG = [74.0, 78.6];
  const W = 100, H = 130;
  const x = (lng) => ((lng - LNG[0]) / (LNG[1] - LNG[0])) * W;
  const y = (lat) => H - ((lat - LAT[0]) / (LAT[1] - LAT[0])) * H;
  const typeColor = {};
  let ci = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, background: '#eaf1f8', borderRadius: 10 }}>
      {points.map((p, i) => {
        if (p.lat == null) return null;
        if (!typeColor[p.type]) typeColor[p.type] = COLORS[ci++ % COLORS.length];
        return <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r={0.9} fill={typeColor[p.type]} opacity={0.7} />;
      })}
    </svg>
  );
}
