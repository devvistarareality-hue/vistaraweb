'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../constants/api';
import { logout } from '../../redux/actions/authActions';

// ── Client-facing Kiosk self-booking (full-screen, no ERP chrome) ─────────────
// A Kiosk-role device is logged in; walk-in clients self-serve:
//   project (kiosk-enabled) → plot (or EOI if no plots) → their details → submit.
// The booking is created PENDING staff approval. Payment (Razorpay) is Phase 3.

const BRAND = '#182350', ACCENT = '#4F46E5', OK = '#16A34A';

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
  const [ref, setRef]           = useState('');         // confirmation code (EOI no / plot no)

  const isEoi = project && plots.length === 0;

  // Auth gate: must be logged in. Kiosk devices sign in as a Kiosk-role user.
  useEffect(() => {
    if (user === null) return;               // still resolving
    if (!user) router.replace('/company');
  }, [user]);

  // Load kiosk-enabled projects for this company.
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
  const eoiArea   = selType ? (+selType.plot_area || 0) * Math.max(1, parseInt(eoiUnits, 10) || 1) : 0;
  const eoiConst  = selType ? (+selType.const_area || 0) * Math.max(1, parseInt(eoiUnits, 10) || 1) : 0;

  const canContinueSelect = isEoi ? (unitTypes.length === 0 || !!eoiType) : !!plot;

  const submit = async () => {
    if (!form.client_name.trim() || !form.phone.trim() || !form.gender) {
      setErr('Please enter name, gender and phone.'); return;
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
      // Pricing is completed by staff on approval (kiosk captures the client + unit only).
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

  if (!user) return <Screen><Spinner /></Screen>;

  return (
    <Screen>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>V</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: BRAND }}>Vistara Realty</div>
            <div style={{ fontSize: 12, color: '#8492A6' }}>Self-Service Booking Kiosk</div>
          </div>
        </div>
        {step !== 'project' && (
          <button onClick={restart} style={ghostBtn}>← Start over</button>
        )}
      </div>

      {/* STEP: project */}
      {step === 'project' && (
        <div>
          <H>Select a project</H>
          {projects === null ? <Spinner /> : projects.length === 0 ? (
            <Empty>No projects are available for kiosk booking right now. Please ask our staff.</Empty>
          ) : (
            <div style={grid}>
              {projects.map((p) => (
                <button key={p.id} onClick={() => pickProject(p)} style={card}>
                  {p.cover_image_url
                    ? <img src={p.cover_image_url} alt={p.name} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
                    : <div style={{ width: '100%', height: 150, borderRadius: 12, background: '#EEF2FF', marginBottom: 12 }} />}
                  <div style={{ fontSize: 18, fontWeight: 800, color: BRAND }}>{p.name}</div>
                  {p.location && <div style={{ fontSize: 13, color: '#8492A6', marginTop: 2 }}>📍 {p.location}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP: select plot / EOI */}
      {step === 'select' && project && (
        <div>
          <H>{project.name}</H>
          {project.master_plan_url && (
            <img src={project.master_plan_url} alt="Master plan" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 12, background: '#F5F6FA', marginBottom: 20 }} />
          )}

          {isEoi ? (
            <div>
              <p style={{ fontSize: 15, color: '#374151', marginBottom: 14 }}>Plots for this project are not released yet — you can register your <b>Expression of Interest</b>.</p>
              {unitTypes.length > 0 && (
                <div style={{ maxWidth: 460 }}>
                  <Label>Unit type</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    {unitTypes.map((t) => (
                      <button key={t.type} onClick={() => setEoiType(t.type)}
                        style={{ ...chip, ...(eoiType === t.type ? chipOn : {}) }}>
                        {t.type} · {t.plot_area} sq.yd
                      </button>
                    ))}
                  </div>
                  <Label>Number of units</Label>
                  <input type="number" min="1" value={eoiUnits} onChange={(e) => setEoiUnits(e.target.value)} style={{ ...input, maxWidth: 160 }} />
                  {selType && <p style={{ fontSize: 14, color: ACCENT, marginTop: 10, fontWeight: 600 }}>Total area: {eoiArea} sq.yd{eoiConst ? `  ·  Construction: ${eoiConst} sq.yd` : ''}</p>}
                </div>
              )}
            </div>
          ) : (
            <div>
              <Label>Choose an available plot</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {plots.map((pl) => (
                  <button key={pl.id} onClick={() => setPlot(pl)}
                    style={{ ...plotChip, ...(plot?.id === pl.id ? plotChipOn : {}) }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{pl.number}</div>
                    {pl.size ? <div style={{ fontSize: 11, opacity: 0.8 }}>{pl.size} sq.yd</div> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <button disabled={!canContinueSelect} onClick={() => setStep('details')}
              style={{ ...primaryBtn, opacity: canContinueSelect ? 1 : 0.5 }}>Continue →</button>
          </div>
        </div>
      )}

      {/* STEP: client details */}
      {step === 'details' && (
        <div style={{ maxWidth: 520 }}>
          <H>Your details</H>
          <Label>Full name *</Label>
          <input value={form.client_name} onChange={(e) => setForm((s) => ({ ...s, client_name: e.target.value }))} placeholder="Your name" style={input} />
          <Label>Gender *</Label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {['Male', 'Female', 'Other'].map((g) => (
              <button key={g} onClick={() => setForm((s) => ({ ...s, gender: g }))} style={{ ...chip, ...(form.gender === g ? chipOn : {}) }}>{g}</button>
            ))}
          </div>
          <Label>Phone *</Label>
          <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="10-digit mobile" inputMode="tel" style={input} />
          <Label>Address</Label>
          <input value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} placeholder="City / address" style={input} />
          {err && <div style={errBox}>{err}</div>}
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('select')} style={ghostBtn}>← Back</button>
            <button disabled={saving} onClick={submit} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Submitting…' : 'Submit booking'}</button>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>Your request will be reviewed and confirmed by our team.</p>
        </div>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#DCFCE7', color: OK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, margin: '0 auto 20px' }}>✓</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: BRAND }}>Thank you, {form.client_name.split(' ')[0]}!</div>
          <p style={{ fontSize: 16, color: '#374151', marginTop: 10 }}>Your {isEoi ? 'Expression of Interest' : 'booking'} for <b>{project?.name}</b>{ref ? <> · <b>{ref}</b></> : null} has been submitted.</p>
          <p style={{ fontSize: 14, color: '#8492A6', marginTop: 6 }}>Our team will contact you shortly to confirm.</p>
          <button onClick={restart} style={{ ...primaryBtn, marginTop: 28 }}>Start a new booking</button>
        </div>
      )}

      {/* Discreet staff exit */}
      <button onClick={() => { dispatch(logout()); router.replace('/company'); }} style={exitBtn} title="Staff exit">Exit kiosk</button>
    </Screen>
  );
}

// ── little presentational helpers ─────────────────────────────────────────────
const Screen = ({ children }) => (
  <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#F5F7FF,#EAEEF9)', padding: '32px 40px', position: 'relative' }}>
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>{children}</div>
  </div>
);
const H = ({ children }) => <h1 style={{ fontSize: 24, fontWeight: 800, color: BRAND, marginBottom: 18 }}>{children}</h1>;
const Label = ({ children }) => <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', margin: '10px 0 6px' }}>{children}</label>;
const Empty = ({ children }) => <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 15 }}>{children}</div>;
const Spinner = () => <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 34, height: 34, border: '3px solid #C7D2FE', borderTopColor: ACCENT, borderRadius: '50%', animation: 'ksp 0.8s linear infinite' }} /><style>{`@keyframes ksp{to{transform:rotate(360deg)}}`}</style></div>;

const grid      = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 };
const card      = { background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left' };
const input     = { width: '100%', height: 48, padding: '0 14px', borderRadius: 12, border: '1.5px solid #D1D5DB', fontSize: 16, boxSizing: 'border-box', outline: 'none', background: '#fff', marginBottom: 4 };
const chip      = { padding: '10px 18px', borderRadius: 12, border: '1.5px solid #D1D5DB', background: '#fff', fontSize: 15, fontWeight: 600, color: '#374151', cursor: 'pointer' };
const chipOn    = { border: `1.5px solid ${ACCENT}`, background: '#EEF2FF', color: ACCENT };
const plotChip  = { minWidth: 84, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer', textAlign: 'center' };
const plotChipOn= { border: `2px solid ${ACCENT}`, background: '#EEF2FF', color: ACCENT };
const primaryBtn= { height: 50, padding: '0 30px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' };
const ghostBtn  = { height: 44, padding: '0 18px', background: '#fff', color: BRAND, border: '1.5px solid #D1D5DB', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const errBox    = { marginTop: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#DC2626' };
const exitBtn   = { position: 'fixed', bottom: 14, right: 16, background: 'transparent', color: '#B6BECC', border: 'none', fontSize: 11, cursor: 'pointer' };
