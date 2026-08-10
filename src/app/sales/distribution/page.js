'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


function fmt(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function currentIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
}

// ── Check / cross icon ────────────────────────────────────────────────────────
function CheckIcon({ on }) {
  return on
    ? <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 800 }}>✓</span>
    : <span style={{ color: '#CBD5E1', fontSize: 14, fontWeight: 800 }}>✗</span>;
}

// Format an ISO timestamp to a local time like "5:04 PM".
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const fmtDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// ── Assigned-project chips shown under each availability name ──────────────────
function ProjectTags({ projects }) {
  if (!projects || projects.length === 0) {
    return <span style={{ fontSize: 10, color: '#B0BAC9' }}>No project assigned</span>;
  }
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {projects.map((p, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#3D5AFE', background: '#EEF2FF', padding: '1px 7px', borderRadius: 20 }}>
          {p}
        </span>
      ))}
    </span>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function WeightBar({ pct, color }) {
  return (
    <div style={{ width: 56, height: 5, backgroundColor: color + '30', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function WeightStepper({ value, onChange, color, border }) {
  const clamp = (n) => Math.min(20, Math.max(1, n));
  const btn = {
    width: 24, height: 26, borderRadius: 6, border: `1.5px solid ${border}`,
    backgroundColor: '#fff', color, fontSize: 16, fontWeight: 700, lineHeight: '1',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', padding: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button type="button" aria-label="Decrease weight" onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1} style={{ ...btn, opacity: value <= 1 ? 0.4 : 1, cursor: value <= 1 ? 'not-allowed' : 'pointer' }}>−</button>
      <input type="number" min={1} max={20} value={value}
        onChange={e => onChange(clamp(parseInt(e.target.value) || 1))}
        style={{ width: 42, padding: '3px 6px', borderRadius: 6, border: `1.5px solid ${border}`, fontSize: 12, textAlign: 'center' }} />
      <button type="button" aria-label="Increase weight" onClick={() => onChange(clamp(value + 1))}
        disabled={value >= 20} style={{ ...btn, opacity: value >= 20 ? 0.4 : 1, cursor: value >= 20 ? 'not-allowed' : 'pointer' }}>+</button>
    </div>
  );
}

// Ratio panel grouped BY PROJECT: leads for a project only split among the
// telecallers/STMs assigned to that project, so the share % is computed within
// each project group. Weight is a single value per person, shared across every
// project they belong to (editing it in one group updates it everywhere).
function ProjectRatioPanel({ title, dotColor, headColor, borderColor, bg, barColor, members, weights, setWeights }) {
  const byProject = {};
  const noProject = [];
  members.forEach(m => {
    if (!m.projects || m.projects.length === 0) { noProject.push(m); return; }
    m.projects.forEach(p => { (byProject[p] = byProject[p] || []).push(m); });
  });
  const projectNames = Object.keys(byProject).sort();
  return (
    <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: 12, padding: '14px 16px', backgroundColor: bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block' }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: headColor, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</p>
      </div>
      {members.length === 0
        ? <p style={{ fontSize: 12, color: '#8492A6' }}>No active {title.toLowerCase()}</p>
        : projectNames.length === 0
          ? <p style={{ fontSize: 12, color: '#8492A6' }}>No projects assigned yet — assign projects above so leads can route.</p>
          : projectNames.map(pn => {
              const grp   = byProject[pn];
              const total = grp.reduce((s, m) => s + (weights[m.user_id] ?? 1), 0);
              return (
                <div key={pn} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: headColor }}>{pn}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: headColor, backgroundColor: borderColor, padding: '1px 7px', borderRadius: 20 }}>{grp.length}</span>
                  </div>
                  {grp.map(m => {
                    const w   = weights[m.user_id] ?? 1;
                    const pct = total > 0 ? Math.round((w / total) * 100) : 0;
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 8, padding: '7px 10px', border: `1px solid ${borderColor}`, marginBottom: 6 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <WeightBar pct={pct} color={barColor} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: headColor, width: 30, textAlign: 'right' }}>{pct}%</span>
                        <WeightStepper value={w} color={headColor} border={borderColor}
                          onChange={val => setWeights(prev => ({ ...prev, [m.user_id]: val }))} />
                      </div>
                    );
                  })}
                  <p style={{ fontSize: 11, color: headColor, fontWeight: 600, marginTop: 2 }}>
                    Ratio: {grp.map(m => weights[m.user_id] ?? 1).join(' : ')}
                  </p>
                </div>
              );
            })
      }
      {noProject.length > 0 && (
        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, backgroundColor: '#FEF3F2', border: '1px solid #FECDCA' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#B42318', marginBottom: 3 }}>Not assigned to any project — won&apos;t receive leads:</p>
          <p style={{ fontSize: 12, color: '#912018' }}>{noProject.map(m => m.name).join(', ')}</p>
        </div>
      )}
    </div>
  );
}

export default function DistributionPage() {
  const router    = useRouter();
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff && !(user.admin_modules || []).includes('Sales')) router.replace('/sales');
  }, [user]);

  // Settings
  const [settings, setSettings]       = useState({ tc_signin_time: '10:20', tc_signout_time: '22:00', stm_signin_time: '10:20', stm_signout_time: '22:00' });
  const [settingsForm, setSettingsForm] = useState(null); // null = not editing
  const [savingSettings, setSavingSettings] = useState(false);

  // Availability
  const [availability, setAvailability] = useState([]);
  // Sign-in history — the same records the board shows for today, kept per day.
  const [availTab, setAvailTab]   = useState('today');   // 'today' | 'history'
  const [histFrom, setHistFrom]   = useState(daysAgoISO(29));
  const [histTo, setHistTo]       = useState(todayISO());
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    if (availTab !== 'history') return;
    let cancelled = false;
    setHistLoading(true);
    fetch(`${SALES_ENDPOINTS.availabilityHistory}?date_from=${histFrom}&date_to=${histTo}`,
          { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (!cancelled) setHistory(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistLoading(false); });
    return () => { cancelled = true; };
  }, [availTab, histFrom, histTo]);

  // Weights
  const [weights, setWeights]           = useState({});       // {user_id: weight}
  const [savedWeights, setSavedWeights] = useState({});
  const [allUsers, setAllUsers]         = useState([]);
  const [savingWeights, setSavingWeights] = useState(false);

  // Stats
  const [unassignedTc, setUnassignedTc] = useState(0);
  const [unassignedStm, setUnassignedStm] = useState(0);

  // Log
  const [log, setLog]                 = useState([]);
  const [clearingLog, setClearingLog] = useState(false);

  // Distribute
  const [distributing, setDistributing] = useState(null);
  const [result, setResult]             = useState(null);

  const load = useCallback(async () => {
    const cq = companyId ? `?company_id=${companyId}` : '';
    const [sRes, aRes, wRes, stRes, logRes] = await Promise.all([
      fetch(SALES_ENDPOINTS.distSettings + cq, { headers: authHeaders() }).then(r => r.json()),
      fetch(SALES_ENDPOINTS.availability  + cq, { headers: authHeaders() }).then(r => r.json()),
      fetch(SALES_ENDPOINTS.distWeight    + cq, { headers: authHeaders() }).then(r => r.json()),
      fetch(SALES_ENDPOINTS.stats         + cq, { headers: authHeaders() }).then(r => r.json()),
      fetch(SALES_ENDPOINTS.distLog       + cq, { headers: authHeaders() }).then(r => r.json()),
    ]);
    if (sRes && !sRes.detail) setSettings(sRes);
    if (Array.isArray(aRes))  setAvailability(aRes);
    if (Array.isArray(wRes)) {
      setAllUsers(wRes);
      const wMap = {};
      wRes.forEach(u => { wMap[u.user_id] = u.weight ?? 1; });
      setWeights(wMap);
      setSavedWeights(wMap);
    }
    if (stRes && !stRes.detail) {
      setUnassignedTc(stRes.new_leads ?? 0);
      setUnassignedStm(stRes.sv_done  ?? 0); // warm_transferred leads
    }
    if (Array.isArray(logRes)) setLog(logRes);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // ── Computed time-window state ──────────────────────────────────────────────
  const now = currentIST();
  const tcWindowOpen    = now >= settings.tc_signin_time  && now < settings.tc_signout_time;
  const stmWindowOpen   = now >= settings.stm_signin_time && now < settings.stm_signout_time;
  const tcAfterSignout  = now >= settings.tc_signout_time;
  const stmAfterSignout = now >= settings.stm_signout_time;

  const tcAvail  = availability.filter(a => a.role === 'telecaller' && a.is_available);
  const stmAvail = availability.filter(a => a.role === 'stm' && a.is_available);
  const allTc    = availability.filter(a => a.role === 'telecaller');
  const allStm   = availability.filter(a => a.role === 'stm');

  // ── Weights ─────────────────────────────────────────────────────────────────
  const tcUsers  = allUsers.filter(u => u.role === 'TELECALLER');
  const stmUsers = allUsers.filter(u => u.role === 'STM');
  // Project-grouped ratio uses the availability feed, which carries each user's
  // assigned projects (same source as the ProjectTags above).
  const tcMembers  = availability.filter(a => a.role === 'telecaller');
  const stmMembers = availability.filter(a => a.role === 'stm');
  const weightsChanged = Object.keys(weights).some(id => weights[id] !== savedWeights[id]);

  async function saveSettings() {
    setSavingSettings(true);
    const body = companyId ? { ...settingsForm, company_id: companyId } : settingsForm;
    await fetch(SALES_ENDPOINTS.distSettings, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
    });
    setSettings(settingsForm);
    setSettingsForm(null);
    setSavingSettings(false);
  }

  async function toggleAvail(user_id, current) {
    const res = await fetch(SALES_ENDPOINTS.availability, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ user_id, is_available: !current, ...(companyId ? { company_id: companyId } : {}) }),
    });
    if (res.ok) {
      setAvailability(prev => prev.map(a => a.user_id === user_id ? { ...a, is_available: !current } : a));
    }
  }

  async function saveWeights() {
    setSavingWeights(true);
    const updates = Object.entries(weights).map(([user_id, weight]) => ({ user_id: parseInt(user_id), weight }));
    const res = await fetch(SALES_ENDPOINTS.distWeight, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ updates, ...(companyId ? { company_id: companyId } : {}) }),
    });
    if (res.ok) setSavedWeights({ ...weights });
    setSavingWeights(false);
  }

  async function distribute(type) {
    setDistributing(type);
    setResult(null);
    const res  = await fetch(SALES_ENDPOINTS.distribute, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ type, ...(companyId ? { company_id: companyId } : {}) }),
    });
    const data = await res.json();
    setDistributing(null);
    setResult({ type, ...data, ok: res.ok });
    if (res.ok) load();
  }

  async function clearHistory() {
    if (!window.confirm('Clear all distribution history? This cannot be undone.')) return;
    setClearingLog(true);
    const cq = companyId ? `?company_id=${companyId}` : '';
    await fetch(SALES_ENDPOINTS.distLog + cq, { method: 'DELETE', headers: authHeaders() });
    setLog([]);
    setClearingLog(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Lead Distribution</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Manage availability, sign-in/sign-out times, and trigger lead assignments</p>
      </div>

      {/* Row 1: Settings + Availability */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Settings */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={cardTitle}>⚙ Distribution Settings</h2>
            {settingsForm === null && (
              <button onClick={() => setSettingsForm({ ...settings })} style={outlineBtn}>Edit</button>
            )}
          </div>

          {settingsForm ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                {/* TC */}
                <div>
                  <p style={sectionLabel}>Telecaller</p>
                  <label style={lbl}>Sign-in Time</label>
                  <input type="time" value={settingsForm.tc_signin_time}
                    onChange={e => setSettingsForm({ ...settingsForm, tc_signin_time: e.target.value })} style={inp} />
                  <p style={hint}>Distribute TC leads at or after this time</p>
                  <label style={{ ...lbl, marginTop: 10 }}>Sign-out Time</label>
                  <input type="time" value={settingsForm.tc_signout_time}
                    onChange={e => setSettingsForm({ ...settingsForm, tc_signout_time: e.target.value })} style={inp} />
                  <p style={hint}>After this time leads remain unassigned</p>
                </div>
                {/* STM */}
                <div>
                  <p style={sectionLabel}>STM</p>
                  <label style={lbl}>Sign-in Time</label>
                  <input type="time" value={settingsForm.stm_signin_time}
                    onChange={e => setSettingsForm({ ...settingsForm, stm_signin_time: e.target.value })} style={inp} />
                  <p style={hint}>Distribute STM leads at or after this time</p>
                  <label style={{ ...lbl, marginTop: 10 }}>Sign-out Time</label>
                  <input type="time" value={settingsForm.stm_signout_time}
                    onChange={e => setSettingsForm({ ...settingsForm, stm_signout_time: e.target.value })} style={inp} />
                  <p style={hint}>After this time leads remain unassigned</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={saveSettings} disabled={savingSettings} style={{ ...primaryBtn, opacity: savingSettings ? 0.6 : 1 }}>
                  {savingSettings ? 'Saving…' : 'Save Settings'}
                </button>
                <button onClick={() => setSettingsForm(null)} style={outlineBtn}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              {[
                { role: 'Telecaller', signin: settings.tc_signin_time, signout: settings.tc_signout_time },
                { role: 'STM',        signin: settings.stm_signin_time, signout: settings.stm_signout_time },
              ].map(({ role, signin, signout }) => (
                <div key={role} style={{ backgroundColor: '#E8ECF2', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={sectionLabel}>{role}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#8492A6' }}>Sign-in</span>
                      <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{signin}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#8492A6' }}>Sign-out</span>
                      <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{signout}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Availability */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <h2 style={{ ...cardTitle, marginBottom: 0 }}>👥 Availability</h2>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {[['today', 'Today'], ['history', 'History']].map(([k, lbl]) => (
                <button key={k} onClick={() => setAvailTab(k)}
                  style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${availTab === k ? '#3D5AFE' : '#E0E6F0'}`,
                    background: availTab === k ? '#3D5AFE' : '#fff',
                    color: availTab === k ? '#fff' : '#8492A6' }}>{lbl}</button>
              ))}
            </div>
          </div>

          {availTab === 'history' ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <input type="date" value={histFrom} max={histTo} onChange={e => setHistFrom(e.target.value)} style={{ ...fSel, width: 142 }} />
                <span style={{ fontSize: 12, color: '#C0C8D8' }}>→</span>
                <input type="date" value={histTo} min={histFrom} max={todayISO()} onChange={e => setHistTo(e.target.value)} style={{ ...fSel, width: 142 }} />
              </div>
              {histLoading ? <p style={{ fontSize: 12, color: '#8492A6' }}>Loading…</p>
                : history.length === 0 ? <p style={{ fontSize: 12, color: '#8492A6' }}>Nobody marked available in this range.</p>
                : history.map(day => (
                  <div key={day.date} style={{ borderTop: '1px solid #F0F3FA', padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E' }}>{fmtDay(day.date)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '1px 8px', borderRadius: 20 }}>
                        {day.telecaller_count} TC · {day.stm_count} STM
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                      {[['Telecallers', day.telecallers], ['STMs', day.stms]].map(([lbl, list]) => (
                        <div key={lbl}>
                          <p style={{ ...sectionLabel, marginBottom: 6 }}>{lbl}</p>
                          {list.length === 0
                            ? <p style={{ fontSize: 12, color: '#B0BAD0' }}>—</p>
                            : list.map(x => (
                              <div key={x.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                                <span style={{ fontSize: 12.5, color: x.is_available ? '#1A1A2E' : '#8492A6' }}>{x.name}</span>
                                {x.checked_in_at && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '1px 7px', borderRadius: 20 }}>
                                    ⏱ {fmtTime(x.checked_in_at)}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {/* Telecallers */}
            <div>
              <p style={{ ...sectionLabel, marginBottom: 8 }}>
                Telecallers · {tcAvail.length}/{allTc.length} available
              </p>
              {allTc.length === 0
                ? <p style={{ fontSize: 12, color: '#8492A6' }}>No telecallers</p>
                : allTc.map(a => (
                  <button key={a.user_id} onClick={() => toggleAvail(a.user_id, a.is_available)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', background: 'none', border: 'none', padding: '5px 0', cursor: 'pointer', textAlign: 'left' }}>
                    <CheckIcon on={a.is_available} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: a.is_available ? '#1A1A2E' : '#8492A6' }}>{a.name}</span>
                        {a.is_available && a.checked_in_at && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '1px 7px', borderRadius: 20 }}>
                            ⏱ {fmtTime(a.checked_in_at)}
                          </span>
                        )}
                      </span>
                      <ProjectTags projects={a.projects} />
                    </span>
                  </button>
                ))
              }
            </div>
            {/* STMs */}
            <div>
              <p style={{ ...sectionLabel, marginBottom: 8 }}>
                STMs · {stmAvail.length}/{allStm.length} available
              </p>
              {allStm.length === 0
                ? <p style={{ fontSize: 12, color: '#8492A6' }}>No STMs</p>
                : allStm.map(a => (
                  <button key={a.user_id} onClick={() => toggleAvail(a.user_id, a.is_available)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', background: 'none', border: 'none', padding: '5px 0', cursor: 'pointer', textAlign: 'left' }}>
                    <CheckIcon on={a.is_available} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: a.is_available ? '#1A1A2E' : '#8492A6' }}>{a.name}</span>
                        {a.is_available && a.checked_in_at && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '1px 7px', borderRadius: 20 }}>
                            ⏱ {fmtTime(a.checked_in_at)}
                          </span>
                        )}
                      </span>
                      <ProjectTags projects={a.projects} />
                    </span>
                  </button>
                ))
              }
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Row 2: Lead Distribution Ratio */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={cardTitle}>📊 Lead Distribution Ratio</h2>
            <span style={{ fontSize: 12, color: '#8492A6' }}>Per project · share splits among assigned members</span>
          </div>
          <button onClick={saveWeights} disabled={savingWeights || !weightsChanged}
            style={{ ...primaryBtn, opacity: (!weightsChanged || savingWeights) ? 0.4 : 1 }}>
            {savingWeights ? 'Saving…' : 'Save Weights'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <ProjectRatioPanel title="Telecallers" dotColor="#22C55E" headColor="#15803D"
            borderColor="#BBF7D0" bg="#F0FDF4" barColor="#22C55E"
            members={tcMembers} weights={weights} setWeights={setWeights} />
          <ProjectRatioPanel title="STMs" dotColor="#3B82F6" headColor="#1D4ED8"
            borderColor="#BFDBFE" bg="#EFF6FF" barColor="#3B82F6"
            members={stmMembers} weights={weights} setWeights={setWeights} />
        </div>
      </div>

      {/* Row 3: Distribution Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {[
          {
            type: 'telecaller',
            label: 'Telecaller Distribution',
            unassigned: unassignedTc,
            avail: tcAvail.length,
            windowOpen: tcWindowOpen,
            afterSignout: tcAfterSignout,
            signin: settings.tc_signin_time,
            signout: settings.tc_signout_time,
            accentOpen: '#BBF7D0',
            bgOpen: '#F0FDF4',
            accentClose: '#FECACA',
            bgClose: '#FEF2F2',
            badgeOpen: { bg: '#DCFCE7', color: '#15803D' },
            badgeClose: { bg: '#FEE2E2', color: '#DC2626' },
            badgeWait: { bg: '#F1F5F9', color: '#64748B' },
          },
          {
            type: 'stm',
            label: 'STM Distribution',
            unassigned: unassignedStm,
            avail: stmAvail.length,
            windowOpen: stmWindowOpen,
            afterSignout: stmAfterSignout,
            signin: settings.stm_signin_time,
            signout: settings.stm_signout_time,
            accentOpen: '#BFDBFE',
            bgOpen: '#EFF6FF',
            accentClose: '#FECACA',
            bgClose: '#FEF2F2',
            badgeOpen: { bg: '#DBEAFE', color: '#1D4ED8' },
            badgeClose: { bg: '#FEE2E2', color: '#DC2626' },
            badgeWait: { bg: '#F1F5F9', color: '#64748B' },
          },
        ].map(({ type, label, unassigned, avail, windowOpen, afterSignout, signin, signout, accentOpen, bgOpen, accentClose, bgClose, badgeOpen, badgeClose, badgeWait }) => {
          const badge   = windowOpen ? badgeOpen : afterSignout ? badgeClose : badgeWait;
          const bdrClr  = windowOpen ? accentOpen : afterSignout ? accentClose : '#E0E6F0';
          const bgClr   = windowOpen ? bgOpen : afterSignout ? bgClose : '#fff';
          const disabled = !!distributing || afterSignout || avail === 0;
          const resultThis = result?.type === type ? result : null;
          return (
            <div key={type} style={{ ...card, border: `2px solid ${bdrClr}`, backgroundColor: bgClr }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 12, color: '#8492A6' }}>
                    {unassigned} unassigned lead{unassigned !== 1 ? 's' : ''} · {avail} {type === 'telecaller' ? 'TC' : 'STM'}{avail !== 1 ? 's' : ''} signed in
                  </p>
                </div>
                <span style={{ ...badge, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  🕐 {windowOpen ? 'Window open' : afterSignout ? 'Window closed' : `Opens ${signin}`}
                </span>
              </div>

              {!windowOpen && !afterSignout && (
                <p style={{ fontSize: 11, color: '#D97706', marginBottom: 10 }}>
                  Current time ({now}) is before sign-in ({signin}). You can still distribute manually.
                </p>
              )}
              {afterSignout && (
                <p style={{ fontSize: 11, color: '#DC2626', marginBottom: 10 }}>
                  Sign-out time ({signout}) has passed. Leads will remain unassigned until tomorrow.
                </p>
              )}

              {resultThis && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontSize: 13, fontWeight: 600,
                  backgroundColor: resultThis.ok ? '#F0FDF4' : '#FEF2F2',
                  color: resultThis.ok ? '#15803D' : '#DC2626',
                }}>
                  {resultThis.ok
                    ? `✓ ${resultThis.distributed} leads distributed`
                    : `✕ ${resultThis.detail || resultThis.message || 'Failed'}`}
                  {resultThis.assignments && resultThis.distributed > 0 && (
                    <p style={{ fontSize: 11, fontWeight: 400, marginTop: 3, color: '#64748B' }}>
                      {Object.entries(resultThis.assignments).map(([n, c]) => `${n}: ${c}`).join(' · ')}
                    </p>
                  )}
                  {resultThis.message && resultThis.distributed === 0 && (
                    <p style={{ fontSize: 11, fontWeight: 400, marginTop: 3 }}>{resultThis.message}</p>
                  )}
                </div>
              )}

              <button onClick={() => distribute(type)} disabled={disabled}
                style={{ ...primaryBtn, width: '100%', opacity: disabled ? 0.45 : 1, justifyContent: 'center' }}>
                {distributing === type ? 'Distributing…' : `⚡ Distribute to ${type === 'telecaller' ? 'Telecallers' : 'STMs'}`}
              </button>
              {avail === 0 && !afterSignout && (
                <p style={{ fontSize: 11, color: '#8492A6', textAlign: 'center', marginTop: 6 }}>
                  No {type === 'telecaller' ? 'telecallers' : 'STMs'} have signed in today
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Row 4: Distribution History */}
      <div style={{ ...card, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F0F3FA' }}>
          <h2 style={cardTitle}>🕐 Recent Distribution History</h2>
          {log.length > 0 && (
            <button onClick={clearHistory} disabled={clearingLog}
              style={{ ...outlineBtn, color: '#EF4444', borderColor: '#FECACA', fontSize: 12 }}>
              {clearingLog ? 'Clearing…' : '🗑 Clear History'}
            </button>
          )}
        </div>
        {log.length === 0
          ? <p style={{ textAlign: 'center', color: '#8492A6', padding: '40px 0', fontSize: 13 }}>No distributions run yet</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F3FA' }}>
                    {['Type', 'Leads', 'Triggered By', 'When', 'Details'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '8px 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map(row => {
                    const details = row.details?.assignments
                      ? row.details.assignments.map(a => `${a.name}: ${a.count}`).join(' · ')
                      : '—';
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #F8FAFD' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFBFE'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                            backgroundColor: row.dist_type === 'telecaller' ? '#FFF8E1' : '#EFF6FF',
                            color:           row.dist_type === 'telecaller' ? '#F9A825'  : '#3B82F6',
                          }}>
                            {row.dist_type === 'telecaller' ? 'Telecaller' : 'STM'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 13 }}>{row.leads_distributed}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#1A1A2E' }}>{row.triggered_by_name ?? 'System'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#8492A6' }}>{fmt(row.created_at)}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#8492A6', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{details}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

const card       = { backgroundColor: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const cardTitle  = { fontSize: 14, fontWeight: 700, color: '#1A1A2E', margin: 0 };
const sectionLabel = { fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6 };
const lbl        = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 4 };
const hint       = { fontSize: 10, color: '#8492A6', marginTop: 3 };
const inp        = { width: '100%', height: 36, padding: '0 10px', borderRadius: 7, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const primaryBtn = { padding: '9px 18px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const outlineBtn = { padding: '7px 14px', backgroundColor: '#fff', border: '1.5px solid #E0E6F0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#1A1A2E', cursor: 'pointer' };
