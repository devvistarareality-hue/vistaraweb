'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../constants/api';
import { logout } from '../../redux/actions/authActions';

// ── Client-facing Kiosk self-booking (full-screen, no ERP chrome) ─────────────
// A Kiosk-role device is logged in; walk-in clients self-serve:
//   project (kiosk-enabled) → plot (or EOI if no plots) → their details → submit.
// The booking is created PENDING staff approval. Payment (Razorpay) is Phase 3.

const STEPS = [
  { key: 'project', label: 'Project' },
  { key: 'select',  label: 'Unit' },
  { key: 'details', label: 'Details' },
];

const isImageUrl = (u) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(String(u || ''));
const KSTATUS = {
  available: { dot: '#16A34A', label: 'Available' },
  sold:      { dot: '#EF4444', label: 'Sold' },
  hold:      { dot: '#F59E0B', label: 'On Hold' },
};
const zoneCenter = (z) => (z.points?.length
  ? { cx: z.points.reduce((s, p) => s + p.x, 0) / z.points.length, cy: z.points.reduce((s, p) => s + p.y, 0) / z.points.length }
  : { cx: (z.x || 0) + (z.width || 0) / 2, cy: (z.y || 0) + (z.height || 0) / 2 });

export default function KioskPage() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.auth.user);

  const [step, setStep]         = useState('project'); // project | select
  const [projects, setProjects] = useState(null);      // null = loading
  const [project,  setProject]  = useState(null);
  const [plots,    setPlots]    = useState([]);         // ALL plots (map needs sold/hold too)
  const [selIds,   setSelIds]   = useState([]);         // chosen plot ids (multi-select for LOI)
  const [hovered,  setHovered]  = useState(null);
  const isSelected = (pl) => selIds.includes(pl.id);
  const togglePlot = (pl) => { if (pl.status !== 'available') return; setSelIds((s) => s.includes(pl.id) ? s.filter((x) => x !== pl.id) : [...s, pl.id]); };
  const [eoiType,  setEoiType]  = useState('');
  const [eoiUnits, setEoiUnits] = useState('1');

  const isEoi = project && plots.length === 0;

  useEffect(() => {
    if (user === null) return;
    if (!user) router.replace('/company');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch(SALES_ENDPOINTS.projects, { headers: authHeaders() })
      .then((r) => r.json())
      .then((arr) => setProjects((Array.isArray(arr) ? arr : []).filter((p) => p.kiosk_enabled && p.is_active)))
      .catch(() => setProjects([]));
  }, [user]);

  const pickProject = async (p) => {
    setProject(p); setSelIds([]); setEoiType(''); setEoiUnits('1'); setHovered(null);
    try {
      const r = await fetch(`${SALES_ENDPOINTS.plots}?project=${p.id}`, { headers: authHeaders() });
      const arr = await r.json();
      setPlots(Array.isArray(arr) ? arr : []);
    } catch { setPlots([]); }
    setStep('select');
  };

  const availablePlots = plots.filter((x) => x.status === 'available');
  const plotByNumber   = Object.fromEntries(plots.map((p) => [String(p.number), p]));
  const zones          = project?.site_map_zones || [];
  const mapImage       = project?.site_map_image_url || (isImageUrl(project?.master_plan_url) ? project?.master_plan_url : '');
  const hasMap         = !!mapImage && zones.length > 0;

  const unitTypes = project?.eoi_unit_types || [];
  const selType   = unitTypes.find((t) => t.type === eoiType);
  const nUnits    = Math.max(1, parseInt(eoiUnits, 10) || 1);
  const eoiArea   = selType ? (+selType.plot_area || 0) * nUnits : 0;
  const eoiConst  = selType ? (+selType.const_area || 0) * nUnits : 0;
  const canContinueSelect = isEoi ? (unitTypes.length === 0 || !!eoiType) : selIds.length > 0;


  const restart = () => {
    setProject(null); setPlots([]); setSelIds([]); setEoiType(''); setEoiUnits('1');
    setStep('project');
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  if (!user) return <div className="k-root"><Style /><Spinner /></div>;

  return (
    <div className="k-root">
      <Style />
      <div className="k-bg" aria-hidden />

      {/* Top bar */}
      <header className="k-header">
        <div className="k-brand">
          <div className="k-logo">V</div>
          <div>
            <div className="k-brand-name">Vistara Realty</div>
            <div className="k-brand-sub">Self-Service Booking Kiosk</div>
          </div>
        </div>
        {step !== 'done' && (
          <div className="k-steps">
            {STEPS.map((s, i) => (
              <div key={s.key} className="k-step">
                <span className={`k-step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}>{i < stepIdx ? '✓' : i + 1}</span>
                <span className={`k-step-label ${i === stepIdx ? 'active' : ''}`}>{s.label}</span>
                {i < STEPS.length - 1 && <span className="k-step-bar" />}
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="k-main">
        {/* STEP: project */}
        {step === 'project' && (
          <section className="k-fade">
            <h1 className="k-hero">Find your space.</h1>
            <p className="k-hero-sub">Choose a project to begin your booking — it only takes a minute.</p>
            {projects === null ? <Spinner /> : projects.length === 0 ? (
              <Empty>No projects are open for kiosk booking right now.<br />Please ask our staff for help.</Empty>
            ) : (
              <div className="k-grid">
                {projects.map((p) => (
                  <button key={p.id} className="k-card" onClick={() => pickProject(p)}>
                    <div className="k-card-media">
                      {p.cover_image_url
                        ? <img src={p.cover_image_url} alt={p.name} />
                        : <div className="k-card-ph" />}
                      <div className="k-card-veil" />
                      <div className="k-card-title">{p.name}</div>
                    </div>
                    <div className="k-card-body">
                      {p.location && <div className="k-card-loc">📍 {p.location}</div>}
                      <div className="k-card-meta">
                        {p.price_range && <span className="k-tag">{p.price_range}</span>}
                        {p.total_area && <span className="k-tag ghost">{p.total_area}</span>}
                      </div>
                      <div className="k-card-cta">Book now →</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP: select */}
        {step === 'select' && project && (
          <section className="k-fade k-panel">
            <button className="k-back" onClick={restart}>← Projects</button>
            <h1 className="k-h1">{project.name}</h1>
            {/* Master plan (only when there's no interactive map to avoid showing it twice) */}
            {!hasMap && project.master_plan_url && (
              <img className="k-master" src={project.master_plan_url} alt="Master plan" />
            )}

            {isEoi ? (
              <div>
                <div className="k-note">Plots for this project aren’t released yet — register your <b>Expression of Interest</b> and we’ll reserve your spot.</div>
                {unitTypes.length > 0 && (
                  <>
                    <label className="k-label">Choose a unit type</label>
                    <div className="k-chips">
                      {unitTypes.map((t) => (
                        <button key={t.type} className={`k-chip ${eoiType === t.type ? 'on' : ''}`} onClick={() => setEoiType(t.type)}>
                          <span className="k-chip-t">{t.type}</span>
                          <span className="k-chip-s">{t.plot_area} sq.yd</span>
                        </button>
                      ))}
                    </div>
                    <label className="k-label">Number of units</label>
                    <div className="k-stepper">
                      <button onClick={() => setEoiUnits(String(Math.max(1, nUnits - 1)))}>−</button>
                      <input type="number" min="1" value={eoiUnits} onChange={(e) => setEoiUnits(e.target.value)} />
                      <button onClick={() => setEoiUnits(String(nUnits + 1))}>+</button>
                    </div>
                    {selType && <div className="k-summary">Total area <b>{eoiArea} sq.yd</b>{eoiConst ? <> · Construction <b>{eoiConst} sq.yd</b></> : null}</div>}
                  </>
                )}
              </div>
            ) : hasMap ? (
              <div>
                {/* Availability counts */}
                <div className="k-stats">
                  {['available', 'hold', 'sold'].map((k) => {
                    const n = plots.filter((p) => p.status === k).length;
                    return (
                      <div key={k} className="k-stat" style={{ borderColor: KSTATUS[k].dot + '55' }}>
                        <span className="k-stat-dot" style={{ background: KSTATUS[k].dot }} />
                        <span className="k-stat-n">{n}</span>
                        <span className="k-stat-l">{KSTATUS[k].label}{plots.length ? ` · ${Math.round(n / plots.length * 100)}%` : ''}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="k-maphead">
                  <label className="k-label" style={{ margin: 0 }}>Tap available (green) units — pick one or several</label>
                  <div className="k-legend">
                    <span><i style={{ background: KSTATUS.available.dot }} /> Available</span>
                    <span><i style={{ background: KSTATUS.hold.dot }} /> On hold</span>
                    <span><i style={{ background: KSTATUS.sold.dot }} /> Sold</span>
                  </div>
                </div>
                <div className="k-map">
                  <img src={mapImage} alt="Site map" draggable={false} />
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    {zones.map((zone) => {
                      const pl = plotByNumber[String(zone.plotNumber)];
                      if (!pl) return null;
                      const cfg = KSTATUS[pl.status] || KSTATUS.available;
                      const clickable = pl.status === 'available';
                      const isSel = isSelected(pl);
                      const isHov = hovered === zone.id;
                      const pts = zone.points?.length ? zone.points.map((p) => `${p.x},${p.y}`).join(' ') : null;
                      const fill = isSel ? '#3D5AFE' : cfg.dot + (isHov ? 'cc' : '99');
                      const stroke = isSel ? '#1A237E' : cfg.dot;
                      const sw = isSel ? 0.95 : (isHov ? 0.7 : 0.45);
                      const st = { cursor: clickable ? 'pointer' : 'not-allowed', transition: 'fill .13s' };
                      const ev = { onClick: () => togglePlot(pl), onMouseEnter: () => setHovered(zone.id), onMouseLeave: () => setHovered(null) };
                      return (
                        <g key={zone.id}>
                          {pts
                            ? <polygon points={pts} fill="rgba(255,255,255,0.92)" style={{ pointerEvents: 'none' }} />
                            : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill="rgba(255,255,255,0.92)" style={{ pointerEvents: 'none' }} />}
                          {pts
                            ? <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} style={st} {...ev} />
                            : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill={fill} stroke={stroke} strokeWidth={sw} style={st} {...ev} />}
                        </g>
                      );
                    })}
                  </svg>
                  {zones.map((zone) => {
                    const pl = plotByNumber[String(zone.plotNumber)];
                    if (!pl) return null;
                    const cfg = KSTATUS[pl.status] || KSTATUS.available;
                    const isSel = isSelected(pl);
                    const { cx, cy } = zoneCenter(zone);
                    const label = String(zone.plotNumber).replace(/^[^\d]+/, '') || zone.plotNumber;
                    return (
                      <div key={zone.id + '-l'} className="k-maplbl" style={{ left: `${cx}%`, top: `${cy}%`, background: isSel ? '#3D5AFE' : 'rgba(255,255,255,0.96)', color: isSel ? '#fff' : cfg.dot, boxShadow: `0 1px 3px rgba(0,0,0,.18),0 0 0 1px ${isSel ? '#1A237E' : cfg.dot + '66'}` }}>
                        {isSel ? `✓ ${label}` : label}
                      </div>
                    );
                  })}
                  {/* Hover tooltip */}
                  {hovered && (() => {
                    const zone = zones.find((z) => z.id === hovered);
                    const pl = zone && plotByNumber[String(zone.plotNumber)];
                    if (!pl) return null;
                    const cfg = KSTATUS[pl.status] || KSTATUS.available;
                    const { cx } = zoneCenter(zone);
                    const top = zone.points?.length ? Math.min(...zone.points.map((p) => p.y)) : (zone.y || 0);
                    const right = cx > 70;
                    return (
                      <div className="k-tip" style={{ left: `${cx}%`, top: `${top}%`, transform: right ? 'translate(-92%,calc(-100% - 8px))' : 'translate(-8%,calc(-100% - 8px))' }}>
                        <div className="k-tip-t">Plot {pl.number}</div>
                        <div className="k-tip-badges">
                          <span style={{ background: cfg.dot + '30', color: cfg.dot, border: `1px solid ${cfg.dot}60` }}>{cfg.label}</span>
                          {pl.cluster_type && <span className="k-tip-type">{pl.cluster_type}</span>}
                        </div>
                        {pl.size && <div className="k-tip-sz">{pl.size} sq.yd</div>}
                        {pl.status === 'available' && <div className="k-tip-hint">Tap to select →</div>}
                      </div>
                    );
                  })()}
                </div>
                {selIds.length > 0 && <div className="k-summary">Selected <b>{selIds.length}</b> unit{selIds.length > 1 ? 's' : ''} · {plots.filter((p) => selIds.includes(p.id)).map((p) => p.number).join(', ')}</div>}
              </div>
            ) : (
              <div>
                <label className="k-label">Choose available plots — pick one or several</label>
                <div className="k-plots">
                  {availablePlots.map((pl) => (
                    <button key={pl.id} className={`k-plot ${isSelected(pl) ? 'on' : ''}`} onClick={() => togglePlot(pl)}>
                      <span className="k-plot-no">{pl.number}</span>
                      {pl.size ? <span className="k-plot-sz">{pl.size} sq.yd</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="k-primary k-block" disabled={!canContinueSelect}
              onClick={() => router.push(`/kiosk/book?project=${project.id}${isEoi ? '&eoi=1' : `&plots=${selIds.join(',')}`}`)}>Continue →</button>
          </section>
        )}

      </main>

      <button className="k-exit" onClick={() => { dispatch(logout()); router.replace('/company'); }} title="Staff exit">Exit kiosk</button>
    </div>
  );
}

const Spinner = () => <div className="k-spin-wrap"><div className="k-spin" /></div>;
const Empty = ({ children }) => <div className="k-empty">{children}</div>;

// All kiosk styling lives here so it stays self-contained and touch-friendly.
const Style = () => (
  <style>{`
  .k-root{min-height:100vh;position:relative;overflow-x:hidden;font-family:inherit;color:#182350;
    background:radial-gradient(1200px 600px at 15% -10%,#E8EEFF 0%,transparent 60%),
               radial-gradient(1000px 500px at 110% 10%,#E7ECFF 0%,transparent 55%),
               linear-gradient(160deg,#F7F9FF 0%,#EDF1FB 100%);}
  .k-bg{position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(600px 300px at 90% 100%,rgba(61,90,254,.06),transparent 70%);}
  .k-header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
    gap:16px;padding:18px 40px;background:rgba(255,255,255,.72);backdrop-filter:blur(12px);
    border-bottom:1px solid rgba(24,35,80,.06);}
  .k-brand{display:flex;align-items:center;gap:14px}
  .k-logo{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:20px;color:#fff;background:linear-gradient(135deg,#182350,#3D5AFE);
    box-shadow:0 6px 16px rgba(61,90,254,.28)}
  .k-brand-name{font-size:19px;font-weight:800;letter-spacing:-.3px}
  .k-brand-sub{font-size:12px;color:#8492A6;margin-top:1px}
  .k-steps{display:flex;align-items:center;gap:0}
  .k-step{display:flex;align-items:center;gap:8px}
  .k-step-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:800;background:#E4E8F2;color:#9AA4B8;transition:.25s}
  .k-step-dot.active{background:#3D5AFE;color:#fff;box-shadow:0 4px 12px rgba(61,90,254,.4)}
  .k-step-dot.done{background:#16A34A;color:#fff}
  .k-step-label{font-size:13px;font-weight:600;color:#9AA4B8}
  .k-step-label.active{color:#182350}
  .k-step-bar{width:34px;height:2px;background:#E1E6F1;margin:0 12px;border-radius:2px}

  .k-main{max-width:1040px;margin:0 auto;padding:44px 40px 90px}
  .k-hero{font-size:40px;font-weight:800;letter-spacing:-1px;margin:0 0 8px}
  .k-hero-sub{font-size:17px;color:#6B7391;margin:0 0 30px}
  .k-h1{font-size:28px;font-weight:800;letter-spacing:-.5px;margin:0 0 16px}

  .k-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
  .k-card{padding:0;border:none;background:#fff;border-radius:22px;overflow:hidden;cursor:pointer;text-align:left;
    box-shadow:0 8px 30px rgba(24,35,80,.08);transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s}
  .k-card:hover{transform:translateY(-6px);box-shadow:0 20px 44px rgba(24,35,80,.16)}
  .k-card:active{transform:translateY(-2px) scale(.995)}
  .k-card-media{position:relative;height:200px}
  .k-card-media img{width:100%;height:100%;object-fit:cover;display:block}
  .k-card-ph{width:100%;height:100%;background:linear-gradient(135deg,#DfE4F5,#E8EEFF)}
  .k-card-veil{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,15,40,.72),transparent 55%)}
  .k-card-title{position:absolute;left:18px;bottom:14px;color:#fff;font-size:22px;font-weight:800;
    letter-spacing:-.4px;text-shadow:0 2px 10px rgba(0,0,0,.35)}
  .k-card-body{padding:16px 18px 18px}
  .k-card-loc{font-size:13px;color:#8492A6}
  .k-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .k-tag{font-size:12px;font-weight:700;color:#3D5AFE;background:#E8EEFF;border-radius:20px;padding:5px 12px}
  .k-tag.ghost{color:#64748B;background:#F1F4FA}
  .k-card-cta{font-size:14px;font-weight:800;color:#3D5AFE}

  .k-panel{background:#fff;border-radius:24px;padding:30px 32px;box-shadow:0 10px 34px rgba(24,35,80,.08)}
  .k-narrow{max-width:560px}
  .k-back{background:none;border:none;color:#6B7391;font-size:14px;font-weight:700;cursor:pointer;padding:0;margin-bottom:12px}
  .k-master{width:100%;max-height:380px;object-fit:contain;background:#F5F7FC;border-radius:16px;margin-bottom:22px}
  .k-maphead{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px}
  .k-legend{display:flex;gap:16px;font-size:12px;font-weight:600;color:#6B7391}
  .k-legend span{display:flex;align-items:center;gap:6px}
  .k-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}
  .k-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .k-stat{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #E6EBF4;border-radius:14px;padding:10px 16px;flex:1;min-width:150px}
  .k-stat-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .k-stat-n{font-size:22px;font-weight:800;color:#182350}
  .k-stat-l{font-size:12px;font-weight:600;color:#6B7391}
  .k-map{position:relative;width:100%;user-select:none;border-radius:14px;overflow:hidden;background:#F5F7FC;border:1px solid #E6EBF4}
  .k-tip{position:absolute;z-index:20;background:rgba(10,18,30,0.96);color:#fff;padding:10px 14px;border-radius:12px;
    white-space:nowrap;pointer-events:none;min-width:130px;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(8px)}
  .k-tip-t{font-weight:800;font-size:15px;margin-bottom:6px}
  .k-tip-badges{display:flex;gap:6px;flex-wrap:wrap}
  .k-tip-badges span{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700}
  .k-tip-type{background:rgba(124,58,237,0.25);color:#C4B5FD;border:1px solid rgba(124,58,237,0.5)}
  .k-tip-sz{color:#C9A84C;font-size:11px;font-weight:600;margin-top:5px}
  .k-tip-hint{color:rgba(255,255,255,0.45);font-size:10px;margin-top:5px}
  .k-map img{width:100%;display:block}
  .k-map svg{position:absolute;inset:0;width:100%;height:100%}
  .k-maplbl{position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:3;font-weight:800;
    font-size:clamp(6px,0.85vw,12px);line-height:1;padding:1px 5px;border-radius:4px;white-space:nowrap}
  .k-note{font-size:15px;color:#4B5468;line-height:1.5;margin:0 0 18px}
  .k-note.center{text-align:center}
  .k-label{display:block;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8492A6;margin:18px 0 8px}

  .k-chips{display:flex;flex-wrap:wrap;gap:12px}
  .k-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:96px;padding:14px 18px;border-radius:16px;
    border:1.5px solid #E1E6F1;background:#fff;color:#374151;cursor:pointer;transition:.15s}
  .k-chip:hover{border-color:#BBD0FF}
  .k-chip.on{border-color:#3D5AFE;background:#E8EEFF;color:#3D5AFE;box-shadow:0 6px 16px rgba(61,90,254,.18)}
  .k-chip-t{font-size:16px;font-weight:800}
  .k-chip-s{font-size:12px;opacity:.75}

  .k-plots{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
  .k-plot{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:92px;padding:14px 12px;border-radius:16px;
    border:1.5px solid #E1E6F1;background:#fff;color:#374151;cursor:pointer;transition:.15s}
  .k-plot:hover{border-color:#BBD0FF;transform:translateY(-2px)}
  .k-plot.on{border-color:#3D5AFE;background:#E8EEFF;color:#3D5AFE;box-shadow:0 8px 18px rgba(61,90,254,.2)}
  .k-plot-no{font-size:17px;font-weight:800}
  .k-plot-sz{font-size:11px;opacity:.75}

  .k-stepper{display:inline-flex;align-items:center;border:1.5px solid #E1E6F1;border-radius:14px;overflow:hidden;background:#fff}
  .k-stepper button{width:52px;height:52px;border:none;background:#F6F8FD;font-size:24px;font-weight:700;color:#3D5AFE;cursor:pointer}
  .k-stepper button:active{background:#E8EEFF}
  .k-stepper input{width:80px;height:52px;border:none;text-align:center;font-size:18px;font-weight:700;color:#182350;outline:none}
  .k-summary{margin-top:16px;font-size:15px;color:#4B5468}
  .k-summary b{color:#3D5AFE}

  .k-input{width:100%;height:54px;padding:0 16px;border-radius:14px;border:1.5px solid #D9DEEA;font-size:16px;
    box-sizing:border-box;outline:none;background:#fff;transition:.15s}
  .k-input:focus{border-color:#3D5AFE;box-shadow:0 0 0 4px rgba(61,90,254,.12)}

  .k-primary{height:56px;padding:0 34px;border:none;border-radius:16px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;
    background:linear-gradient(135deg,#182350,#3D5AFE);box-shadow:0 10px 24px rgba(61,90,254,.32);transition:.15s}
  .k-primary:hover{filter:brightness(1.05)}
  .k-primary:active{transform:scale(.98)}
  .k-primary:disabled{opacity:.45;box-shadow:none;cursor:not-allowed}
  .k-block{display:block;width:100%;margin-top:28px}
  .k-fine{font-size:12px;color:#9AA4B8;margin-top:14px;text-align:center}
  .k-err{margin-top:16px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px 16px;font-size:14px;color:#DC2626}

  .k-done{max-width:560px;margin:20px auto 0;text-align:center;background:#fff;border-radius:24px;padding:44px 32px;
    box-shadow:0 10px 34px rgba(24,35,80,.08)}
  .k-check{width:92px;height:92px;border-radius:50%;background:#DCFCE7;color:#16A34A;font-size:48px;
    display:flex;align-items:center;justify-content:center;margin:0 auto 22px;
    box-shadow:0 10px 26px rgba(22,163,74,.22)}
  .k-done-msg{font-size:17px;color:#3B4256;margin:10px 0 4px}

  .k-empty{background:#fff;border-radius:20px;padding:44px;text-align:center;color:#6B7391;font-size:16px;line-height:1.6;
    box-shadow:0 8px 26px rgba(24,35,80,.06)}
  .k-spin-wrap{display:flex;justify-content:center;padding:80px}
  .k-spin{width:38px;height:38px;border:3px solid #C7D8FF;border-top-color:#3D5AFE;border-radius:50%;animation:kspin .8s linear infinite}
  @keyframes kspin{to{transform:rotate(360deg)}}
  .k-fade{animation:kfade .35s ease}
  @keyframes kfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .k-exit{position:fixed;bottom:14px;right:16px;background:transparent;color:#AEB6C7;border:none;font-size:11px;cursor:pointer;z-index:5}
  .k-exit:hover{color:#6B7391}
  @media(max-width:640px){.k-main{padding:28px 18px 80px}.k-header{padding:14px 18px}.k-steps{display:none}.k-hero{font-size:30px}}
  `}</style>
);
