'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { SALES_ENDPOINTS } from '../../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const isPdfUrl   = (u) => !!u && u.split('?')[0].toLowerCase().endsWith('.pdf');
const isImageUrl = (u) => !!u && /\.(png|jpe?g|webp|gif|svg)$/i.test(u.split('?')[0]);

// Status config keyed to vistaraweb plot statuses. Only "available" is selectable
// for a closure (Sold/Hold are shown for context but not clickable).
const STATUS = {
  available: { label: 'Available', dot: '#22c55e', text: '#064E3B', bg: '#E8F5E9' },
  hold:      { label: 'On Hold',   dot: '#f59e0b', text: '#78350F', bg: '#FEF3C7' },
  sold:      { label: 'Sold',      dot: '#ef4444', text: '#7F1D1D', bg: '#FEE2E2' },
};

function zoneCenter(zone) {
  if (zone.points?.length) {
    const xs = zone.points.map(p => p.x), ys = zone.points.map(p => p.y);
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return { cx: zone.x + zone.width / 2, cy: zone.y + zone.height / 2 };
}

function zoneTopCenter(zone) {
  if (zone.points?.length) {
    const xs = zone.points.map(p => p.x), ys = zone.points.map(p => p.y);
    return { tx: (Math.min(...xs) + Math.max(...xs)) / 2, ty: Math.min(...ys) };
  }
  return { tx: zone.x + zone.width / 2, ty: zone.y };
}

// Type badge colours (mirrors the CP portal hover tooltip).
const TYPE_COLORS = {
  Ananda:  { bg: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: 'rgba(139,92,246,0.5)' },
  Maitri:  { bg: 'rgba(37,99,235,0.18)',  color: '#93c5fd', border: 'rgba(37,99,235,0.5)'  },
  Karuna:  { bg: 'rgba(217,119,6,0.18)',  color: '#fcd34d', border: 'rgba(217,119,6,0.5)'  },
  Hridaya: { bg: 'rgba(5,150,105,0.18)',  color: '#6ee7b7', border: 'rgba(5,150,105,0.5)'  },
};

export default function ClosureViewerPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const user    = useSelector((s) => s.auth.user);

  const [project, setProject] = useState(null);
  const [plots,   setPlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sv,      setSv]      = useState(null);
  const [selected, setSelected] = useState(null); // selected plot
  const [hovered,  setHovered]  = useState(null);  // hovered zone id
  const [filter,     setFilter]     = useState('all'); // all | available | hold | sold
  const [typeFilter, setTypeFilter] = useState('all'); // all | <cluster_type>
  const [sources,    setSources]    = useState([]);

  useEffect(() => {
    try { setSv(JSON.parse(sessionStorage.getItem('closure_sv') || 'null')); } catch (_) {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(SALES_ENDPOINTS.project(id), { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      fetch(SALES_ENDPOINTS.sources, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
    ]).then(([p, pl, src]) => {
      setProject(p);
      setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []));
      setSources(Array.isArray(src) ? src : (src?.results ?? []));
      setLoading(false);
    });
  }, [id]);

  const zones    = project?.site_map_zones || [];
  const mapImage = project?.site_map_image_url
    || (isImageUrl(project?.master_plan_url) ? project.master_plan_url : '');
  const hasMap   = !!mapImage && zones.length > 0;

  const counts = useMemo(() => {
    const c = { available: 0, hold: 0, sold: 0 };
    plots.forEach(p => { if (c[p.status] != null) c[p.status]++; });
    return c;
  }, [plots]);

  const plotByNumber = useMemo(() => {
    const m = {};
    plots.forEach(p => { m[String(p.number)] = p; });
    return m;
  }, [plots]);

  const types = useMemo(
    () => [...new Set(plots.map(p => p.cluster_type).filter(Boolean))].sort(),
    [plots],
  );

  // A plot is dimmed (not removed) when it doesn't match the active status/type filter.
  const isHidden = (plot) =>
    (filter !== 'all' && plot.status !== filter) ||
    (typeFilter !== 'all' && plot.cluster_type !== typeFilter);

  const shownCount = plots.filter(p => !isHidden(p)).length;
  const total      = plots.length;
  const pct        = (n) => (total ? Math.round(n / total * 100) : 0);

  function pickPlot(plot) {
    if (!plot || plot.status !== 'available') return; // only Available selectable
    setSelected(plot);
  }

  if (loading) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#8492A6' }}>Loading project…</div>;
  }
  if (!project) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#8492A6' }}>Project not found.</div>;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push('/sales/closure')} style={backBtn}>← All projects</button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>{project.name}</h1>
        {project.location && <p style={{ fontSize: 13, color: '#8492A6' }}>📍 {project.location}</p>}
        {sv && (
          <p style={{ fontSize: 13, color: '#3D5AFE', marginTop: 6, fontWeight: 600 }}>
            Recording closure for {sv.lead_name} · {sv.lead_phone} — tap an available unit.
          </p>
        )}
      </div>

      {/* Filters — status + type (dim non-matching units) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[['all', 'All'], ['available', 'Available'], ['sold', 'Sold'], ['hold', 'On Hold']].map(([key, label]) => {
          const active = filter === key;
          const dot = STATUS[key]?.dot;
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${active ? '#C9A84C' : '#E6EBF4'}`, background: active ? '#FBF4DF' : '#fff', color: active ? '#8a6d1f' : '#6B7280',
            }}>
              {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
              {label}
            </button>
          );
        })}
      </div>
      {types.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {['all', ...types].map((t) => {
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${active ? '#C9A84C' : '#E6EBF4'}`, background: active ? '#FBF4DF' : '#fff', color: active ? '#8a6d1f' : '#6B7280',
              }}>
                {t === 'all' ? 'All Types' : t}
              </button>
            );
          })}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        {[['available', counts.available], ['hold', counts.hold], ['sold', counts.sold]].map(([key, n]) => {
          const cfg = STATUS[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, background: '#fff', border: '1px solid #E6EBF4', boxShadow: '0 2px 8px rgba(184,196,214,0.12)' }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cfg.dot, fontSize: 18, fontWeight: 900 }}>•</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>{cfg.label} · {pct(n)}%</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive unit map (if the admin drew zones) */}
      {hasMap ? (
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #E6EBF4', boxShadow: '0 4px 20px rgba(100,120,160,0.12)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F3FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E' }}>Interactive Unit Map</h2>
              <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>Tap an available (green) unit to view its layout and record the closure.</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6d1f', background: '#FBF4DF', border: '1px solid #EBD9A3', padding: '5px 12px', borderRadius: 20 }}>
              🏠 Showing {shownCount} of {total} units
            </span>
          </div>
          <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
            <img src={mapImage} alt="Site Map" draggable={false} style={{ width: '100%', display: 'block' }} />
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
              {zones.map(zone => {
                const plot = plotByNumber[String(zone.plotNumber)];
                if (!plot) return null;
                const cfg = STATUS[plot.status] || STATUS.available;
                const clickable = plot.status === 'available';
                const dim = isHidden(plot);
                const isHover = hovered === zone.id;
                const pts = zone.points?.length ? zone.points.map(p => `${p.x},${p.y}`).join(' ') : null;
                const topStyle = { cursor: clickable ? 'pointer' : 'not-allowed', transition: 'fill 0.13s, opacity 0.13s', opacity: dim ? 0.08 : 1, filter: isHover ? `drop-shadow(0 0 1.5px ${cfg.dot})` : 'none' };
                const ev = {
                  onClick: () => pickPlot(plot),
                  onMouseEnter: () => setHovered(zone.id),
                  onMouseLeave: () => setHovered(null),
                };
                return (
                  <g key={zone.id}>
                    {pts
                      ? <polygon points={pts} fill="rgba(255,255,255,0.92)" stroke="none" style={{ pointerEvents: 'none' }} />
                      : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill="rgba(255,255,255,0.92)" stroke="none" style={{ pointerEvents: 'none' }} />}
                    {pts
                      ? <polygon points={pts} fill={cfg.dot + (isHover ? 'cc' : '99')} stroke={cfg.dot} strokeWidth={isHover ? 0.7 : 0.45} style={topStyle} {...ev} />
                      : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill={cfg.dot + (isHover ? 'cc' : '99')} stroke={cfg.dot} strokeWidth={isHover ? 0.7 : 0.45} style={topStyle} {...ev} />}
                  </g>
                );
              })}
            </svg>
            {/* Number labels */}
            {zones.map(zone => {
              const plot = plotByNumber[String(zone.plotNumber)];
              if (!plot) return null;
              const cfg = STATUS[plot.status] || STATUS.available;
              const { cx, cy } = zoneCenter(zone);
              // Labels overlap on small plots when the number is type-prefixed
              // (e.g. "Karuna24"). The type is already conveyed by colour/legend,
              // so show just the numeric part; fall back to the full value.
              const labelText = String(zone.plotNumber).replace(/^[^\d]+/, '') || zone.plotNumber;
              return (
                <div key={zone.id + '-lbl'} style={{
                  position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%,-50%)',
                  opacity: isHidden(plot) ? 0.08 : 1, transition: 'opacity 0.13s',
                  pointerEvents: 'none', zIndex: 3, background: 'rgba(255,255,255,0.96)', color: cfg.text,
                  fontWeight: 800, fontSize: 'clamp(6px,0.8vw,11px)', lineHeight: 1, padding: '1px 5px',
                  borderRadius: 4, boxShadow: `0 1px 3px rgba(0,0,0,0.18), 0 0 0 1px ${cfg.dot}66`, whiteSpace: 'nowrap',
                }}>{labelText}</div>
              );
            })}

            {/* Hover tooltip — plot summary (mirrors CP portal) */}
            {hovered && (() => {
              const zone = zones.find(z => z.id === hovered);
              const plot = zone && plotByNumber[String(zone.plotNumber)];
              if (!plot || isHidden(plot)) return null;
              const cfg = STATUS[plot.status] || STATUS.available;
              const tc  = plot.cluster_type ? TYPE_COLORS[plot.cluster_type] : null;
              const { tx, ty } = zoneTopCenter(zone);
              const isRight = tx > 68;
              return (
                <div style={{
                  position: 'absolute', left: `${tx}%`, top: `${ty}%`,
                  transform: isRight ? 'translate(-92%, calc(-100% - 10px))' : 'translate(-8%, calc(-100% - 10px))',
                  background: 'rgba(10,18,30,0.96)', color: '#fff', padding: '10px 14px', borderRadius: 12,
                  whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20, minWidth: 140,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Plot {plot.number}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: plot.size ? 5 : 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: cfg.dot + '30', color: cfg.dot, border: `1px solid ${cfg.dot}60` }}>{cfg.label}</span>
                    {plot.cluster_type && tc && (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{plot.cluster_type}</span>
                    )}
                  </div>
                  {plot.size && <div style={{ color: '#C9A84C', fontSize: 11, fontWeight: 600 }}>{plot.size}</div>}
                  {plot.status === 'available' && (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 5 }}>Click to view details →</div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        // Fallback: no drawn map → plain grid of unit chips so the flow still works.
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px', border: '1px solid #E6EBF4', boxShadow: '0 4px 20px rgba(100,120,160,0.12)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Units</h2>
          <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 14 }}>No site map drawn for this project. Tap an available unit below.</p>
          {!plots.length ? (
            <p style={{ color: '#8492A6', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No units defined for this project.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {plots.filter(p => !isHidden(p)).map(plot => {
                const cfg = STATUS[plot.status] || STATUS.available;
                const clickable = plot.status === 'available';
                return (
                  <button key={plot.id} onClick={() => pickPlot(plot)} disabled={!clickable}
                    title={cfg.label}
                    style={{
                      minWidth: 56, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${cfg.dot}`,
                      background: cfg.dot + (clickable ? '22' : '14'), color: cfg.text, fontWeight: 800, fontSize: 13,
                      cursor: clickable ? 'pointer' : 'not-allowed', opacity: clickable ? 1 : 0.6,
                    }}>
                    {plot.number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected && (
        <UnitPanel
          plot={selected}
          project={project}
          sv={sv}
          user={user}
          sources={sources}
          onClose={() => setSelected(null)}
          onClosed={() => { router.push(sv ? '/sales/site-visits' : '/sales/my-conversions'); }}
        />
      )}
    </div>
  );
}

/* ── Unit detail: floor-plan layouts + record-closure / direct-booking form ── */
// Booking web app (records the booking, auto-generates the LOI and stores it in
// the Google Sheet). Opening it navigates the current tab — no new window.
const BOOKING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypnmUmBmBIrL5rC6xqSEbLFDvSw1XvES6D-JyL1beY8-AeEREnfvVM_TbbbV1t1i883g/exec';

function UnitPanel({ plot, project, sv, user, sources = [], onClose, onClosed }) {
  const cfg = STATUS[plot.status] || STATUS.available;
  const router = useRouter();

  function openBookingScript() {
    // Native ERP booking form (replaces the GAS web app).
    const q = new URLSearchParams({ project: String(project?.id || ''), plot: String(plot?.id || '') });
    if (sv) {
      if (sv.lead) q.set('lead', String(sv.lead));
      if (sv.lead_name)  q.set('client', sv.lead_name);
      if (sv.lead_phone) q.set('phone', sv.lead_phone);
    }
    router.push(`/sales/booking?${q.toString()}`);
  }

  const typePlans = useMemo(() => {
    const entry = (project.plot_type_plans || []).find(t => t.name === plot.cluster_type);
    return entry?.floor_plans || [];
  }, [project, plot]);
  const booking = !sv; // no site-visit context → direct booking from the Booking nav

  const [viewing, setViewing] = useState(null); // url in lightbox

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Header */}
        <div style={{ padding: '18px 20px', background: cfg.bg, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.text, opacity: 0.8 }}>Unit No.</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cfg.text }}>{plot.number}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {plot.cluster_type && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 8, background: '#fff', color: '#673AB7', border: '1px solid #E0D6F5' }}>
                {plot.cluster_type}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 20, background: '#fff', color: cfg.dot, border: `1px solid ${cfg.dot}55` }}>{cfg.label}</span>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: '#374151' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Unit info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {plot.size   && <InfoBox label="Unit Area" value={plot.size} />}
            {plot.facing && <InfoBox label="Facing" value={plot.facing} />}
            {plot.price  && <InfoBox label="Price" value={plot.price} full={!plot.size || !plot.facing} />}
          </div>

          {/* Floor plan layouts — per-unit only. The master/site layout is the map
              behind this panel, so it's intentionally not repeated here. */}
          {typePlans.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 10 }}>
                Floor Plan Layouts
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {typePlans.map((fp, i) => (
                  <button key={i} onClick={() => setViewing(fp.url)} style={planBtn}>🔍 {fp.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Booking & closure are both handled by the booking web app (own login,
              auto-LOI, Google Sheet). The button opens it in the same window. */}
          <button onClick={openBookingScript} style={primaryBtn}>
            {sv ? `Record Closure for Unit ${plot.number}` : `Book Unit ${plot.number}`}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {isPdfUrl(viewing)
            ? <embed src={viewing} type="application/pdf" style={{ width: '90vw', height: '88vh', borderRadius: 8 }} />
            : <img src={viewing} alt="Layout" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 50px rgba(0,0,0,0.5)' }} />}
          <button onClick={() => setViewing(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto', borderRadius: 12, padding: '12px 14px', background: '#FAFBFF', border: '1px solid #EDF0F7' }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

const overlay    = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,28,46,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const panel      = { background: '#fff', borderRadius: 18, width: '94%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(24,35,80,0.22)' };
const planBtn    = { padding: '11px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#B8960C', background: 'rgba(184,150,12,0.08)', border: '1px solid rgba(184,150,12,0.22)', cursor: 'pointer' };
const primaryBtn = { width: '100%', padding: '12px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer' };
const cancelBtn  = { padding: '11px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const backBtn    = { padding: '7px 14px', backgroundColor: '#F0F3FA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#5C6BC0', cursor: 'pointer' };
const lbl        = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };
const inp        = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#FAFAFA' };
