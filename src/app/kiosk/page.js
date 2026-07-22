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

export default function KioskPage() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.auth.user);

  const [step, setStep]         = useState('project'); // project | select | details | done
  const [projects, setProjects] = useState(null);      // null = loading
  const [project,  setProject]  = useState(null);
  const [plots,    setPlots]    = useState([]);
  const [plot,     setPlot]     = useState(null);       // chosen plot (LOI) or null (EOI)
  const [eoiType,  setEoiType]  = useState('');
  const [eoiUnits, setEoiUnits] = useState('1');
  const [form, setForm]         = useState({ client_name: '', gender: '', phone: '', address: '' });
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [ref, setRef]           = useState('');

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
    setProject(p); setPlot(null); setEoiType(''); setEoiUnits('1'); setErr('');
    try {
      const r = await fetch(`${SALES_ENDPOINTS.plots}?project=${p.id}`, { headers: authHeaders() });
      const arr = await r.json();
      setPlots((Array.isArray(arr) ? arr : []).filter((x) => x.status === 'available'));
    } catch { setPlots([]); }
    setStep('select');
  };

  const unitTypes = project?.eoi_unit_types || [];
  const selType   = unitTypes.find((t) => t.type === eoiType);
  const nUnits    = Math.max(1, parseInt(eoiUnits, 10) || 1);
  const eoiArea   = selType ? (+selType.plot_area || 0) * nUnits : 0;
  const eoiConst  = selType ? (+selType.const_area || 0) * nUnits : 0;
  const canContinueSelect = isEoi ? (unitTypes.length === 0 || !!eoiType) : !!plot;

  const submit = async () => {
    if (!form.client_name.trim() || !form.phone.trim() || !form.gender) {
      setErr('Please enter your name, gender and phone.'); return;
    }
    setSaving(true); setErr('');
    const area      = isEoi ? String(eoiArea || '') : String(plot?.size || '');
    const constArea = isEoi ? String(eoiConst || '') : String(plot?.construction_area || '0');
    const payload = {
      project: project.id,
      plot: isEoi ? undefined : plot.id,
      plot_ids: isEoi ? [] : [plot.id],
      ...(isEoi ? { eoi: true } : {}),
      client_name: form.client_name.trim(), gender: form.gender, phone: form.phone.trim(),
      address: form.address.trim(), source: 'Kiosk',
      formula_set: project.formula_set || 'kalrav',
      area, area_unit: 'sq.yd', const_area: constArea || '0',
      sale_deed_pct: 60,
    };
    try {
      const r = await fetch(SALES_ENDPOINTS.bookings, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.detail || 'Could not submit. Please call staff.'); setSaving(false); return; }
      setRef(data.plot_numbers || (isEoi ? 'EOI' : plot?.number) || '');
      setStep('done');
    } catch { setErr('Network error. Please call staff.'); }
    setSaving(false);
  };

  const restart = () => {
    setProject(null); setPlots([]); setPlot(null); setEoiType(''); setEoiUnits('1');
    setForm({ client_name: '', gender: '', phone: '', address: '' }); setErr(''); setRef('');
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
            {project.master_plan_url && (
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
            ) : (
              <div>
                <label className="k-label">Choose an available plot</label>
                <div className="k-plots">
                  {plots.map((pl) => (
                    <button key={pl.id} className={`k-plot ${plot?.id === pl.id ? 'on' : ''}`} onClick={() => setPlot(pl)}>
                      <span className="k-plot-no">{pl.number}</span>
                      {pl.size ? <span className="k-plot-sz">{pl.size} sq.yd</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="k-primary k-block" disabled={!canContinueSelect} onClick={() => setStep('details')}>Continue →</button>
          </section>
        )}

        {/* STEP: details */}
        {step === 'details' && (
          <section className="k-fade k-panel k-narrow">
            <button className="k-back" onClick={() => setStep('select')}>← Back</button>
            <h1 className="k-h1">Your details</h1>
            <p className="k-note">We’ll use these to confirm your {isEoi ? 'interest' : 'booking'}.</p>

            <label className="k-label">Full name *</label>
            <input className="k-input" value={form.client_name} onChange={(e) => setForm((s) => ({ ...s, client_name: e.target.value }))} placeholder="Your name" />

            <label className="k-label">Gender *</label>
            <div className="k-chips">
              {['Male', 'Female', 'Other'].map((g) => (
                <button key={g} className={`k-chip ${form.gender === g ? 'on' : ''}`} onClick={() => setForm((s) => ({ ...s, gender: g }))}>{g}</button>
              ))}
            </div>

            <label className="k-label">Phone *</label>
            <input className="k-input" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="10-digit mobile" inputMode="tel" />

            <label className="k-label">City / address</label>
            <input className="k-input" value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} placeholder="Optional" />

            {err && <div className="k-err">{err}</div>}
            <button className="k-primary k-block" disabled={saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit booking'}</button>
            <p className="k-fine">Your request will be reviewed and confirmed by our team.</p>
          </section>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <section className="k-fade k-done">
            <div className="k-check">✓</div>
            <h1 className="k-h1">Thank you, {form.client_name.split(' ')[0]}!</h1>
            <p className="k-done-msg">Your {isEoi ? 'Expression of Interest' : 'booking'} for <b>{project?.name}</b>{ref ? <> · <b>{ref}</b></> : null} has been submitted.</p>
            <p className="k-note center">Our team will contact you shortly to confirm.</p>
            <button className="k-primary" onClick={restart}>Start a new booking</button>
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
    background:radial-gradient(1200px 600px at 15% -10%,#EEF2FF 0%,transparent 60%),
               radial-gradient(1000px 500px at 110% 10%,#E7ECFF 0%,transparent 55%),
               linear-gradient(160deg,#F7F9FF 0%,#EDF1FB 100%);}
  .k-bg{position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(600px 300px at 90% 100%,rgba(79,70,229,.06),transparent 70%);}
  .k-header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
    gap:16px;padding:18px 40px;background:rgba(255,255,255,.72);backdrop-filter:blur(12px);
    border-bottom:1px solid rgba(24,35,80,.06);}
  .k-brand{display:flex;align-items:center;gap:14px}
  .k-logo{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:20px;color:#fff;background:linear-gradient(135deg,#182350,#3D3AF5);
    box-shadow:0 6px 16px rgba(61,58,245,.28)}
  .k-brand-name{font-size:19px;font-weight:800;letter-spacing:-.3px}
  .k-brand-sub{font-size:12px;color:#8492A6;margin-top:1px}
  .k-steps{display:flex;align-items:center;gap:0}
  .k-step{display:flex;align-items:center;gap:8px}
  .k-step-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:800;background:#E4E8F2;color:#9AA4B8;transition:.25s}
  .k-step-dot.active{background:#4F46E5;color:#fff;box-shadow:0 4px 12px rgba(79,70,229,.4)}
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
  .k-card-ph{width:100%;height:100%;background:linear-gradient(135deg,#DfE4F5,#EEF2FF)}
  .k-card-veil{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,15,40,.72),transparent 55%)}
  .k-card-title{position:absolute;left:18px;bottom:14px;color:#fff;font-size:22px;font-weight:800;
    letter-spacing:-.4px;text-shadow:0 2px 10px rgba(0,0,0,.35)}
  .k-card-body{padding:16px 18px 18px}
  .k-card-loc{font-size:13px;color:#8492A6}
  .k-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .k-tag{font-size:12px;font-weight:700;color:#4338CA;background:#EEF2FF;border-radius:20px;padding:5px 12px}
  .k-tag.ghost{color:#64748B;background:#F1F4FA}
  .k-card-cta{font-size:14px;font-weight:800;color:#4F46E5}

  .k-panel{background:#fff;border-radius:24px;padding:30px 32px;box-shadow:0 10px 34px rgba(24,35,80,.08)}
  .k-narrow{max-width:560px}
  .k-back{background:none;border:none;color:#6B7391;font-size:14px;font-weight:700;cursor:pointer;padding:0;margin-bottom:12px}
  .k-master{width:100%;max-height:380px;object-fit:contain;background:#F5F7FC;border-radius:16px;margin-bottom:22px}
  .k-note{font-size:15px;color:#4B5468;line-height:1.5;margin:0 0 18px}
  .k-note.center{text-align:center}
  .k-label{display:block;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8492A6;margin:18px 0 8px}

  .k-chips{display:flex;flex-wrap:wrap;gap:12px}
  .k-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:96px;padding:14px 18px;border-radius:16px;
    border:1.5px solid #E1E6F1;background:#fff;color:#374151;cursor:pointer;transition:.15s}
  .k-chip:hover{border-color:#C7CEFF}
  .k-chip.on{border-color:#4F46E5;background:#EEF2FF;color:#4338CA;box-shadow:0 6px 16px rgba(79,70,229,.18)}
  .k-chip-t{font-size:16px;font-weight:800}
  .k-chip-s{font-size:12px;opacity:.75}

  .k-plots{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
  .k-plot{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:92px;padding:14px 12px;border-radius:16px;
    border:1.5px solid #E1E6F1;background:#fff;color:#374151;cursor:pointer;transition:.15s}
  .k-plot:hover{border-color:#C7CEFF;transform:translateY(-2px)}
  .k-plot.on{border-color:#4F46E5;background:#EEF2FF;color:#4338CA;box-shadow:0 8px 18px rgba(79,70,229,.2)}
  .k-plot-no{font-size:17px;font-weight:800}
  .k-plot-sz{font-size:11px;opacity:.75}

  .k-stepper{display:inline-flex;align-items:center;border:1.5px solid #E1E6F1;border-radius:14px;overflow:hidden;background:#fff}
  .k-stepper button{width:52px;height:52px;border:none;background:#F6F8FD;font-size:24px;font-weight:700;color:#4F46E5;cursor:pointer}
  .k-stepper button:active{background:#EDEFFb}
  .k-stepper input{width:80px;height:52px;border:none;text-align:center;font-size:18px;font-weight:700;color:#182350;outline:none}
  .k-summary{margin-top:16px;font-size:15px;color:#4B5468}
  .k-summary b{color:#4338CA}

  .k-input{width:100%;height:54px;padding:0 16px;border-radius:14px;border:1.5px solid #D9DEEA;font-size:16px;
    box-sizing:border-box;outline:none;background:#fff;transition:.15s}
  .k-input:focus{border-color:#4F46E5;box-shadow:0 0 0 4px rgba(79,70,229,.12)}

  .k-primary{height:56px;padding:0 34px;border:none;border-radius:16px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;
    background:linear-gradient(135deg,#4F46E5,#3D3AF5);box-shadow:0 10px 24px rgba(61,58,245,.32);transition:.15s}
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
  .k-spin{width:38px;height:38px;border:3px solid #C7D2FE;border-top-color:#4F46E5;border-radius:50%;animation:kspin .8s linear infinite}
  @keyframes kspin{to{transform:rotate(360deg)}}
  .k-fade{animation:kfade .35s ease}
  @keyframes kfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .k-exit{position:fixed;bottom:14px;right:16px;background:transparent;color:#AEB6C7;border:none;font-size:11px;cursor:pointer;z-index:5}
  .k-exit:hover{color:#6B7391}
  @media(max-width:640px){.k-main{padding:28px 18px 80px}.k-header{padding:14px 18px}.k-steps{display:none}.k-hero{font-size:30px}}
  `}</style>
);
