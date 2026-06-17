'use client';
import { useState, useEffect } from 'react';
import { SALES_ENDPOINTS, RAILWAY_URL } from '../../../constants/api';
import { getCache, setCache, bustCache } from '../../sales/_cache';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const PRESET_SOURCES = ['meta', 'google', 'referral', 'walk-in', 'ivr', 'portal', 'other'];
const NAVY = '#182350';
const BLUE = '#3D5AFE';
const GREEN = '#2E7D32';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} style={{ padding: '6px 12px', borderRadius: 7, border: '1.5px solid #D0D8E8', backgroundColor: copied ? '#E8F5E9' : '#fff', color: copied ? GREEN : '#5A6A85', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: NAVY, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{n}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#5A6A85', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

export default function LeadSetupPage() {
  const [tab, setTab] = useState('meta');

  // Sources tab
  const [sources, setSources] = useState([]);
  const [loadingSrc, setLoadingSrc] = useState(true);
  const [newName, setNewName]       = useState('');
  const [adding,  setAdding]        = useState(false);
  const [srcErr,  setSrcErr]        = useState('');

  // Meta tab
  const [cfg,        setCfg]        = useState(null);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [pat,        setPat]        = useState('');
  const [projectId,  setProjectId]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [metaMsg,    setMetaMsg]    = useState('');
  const [regen,      setRegen]      = useState(false);

  // Form mappings
  const [mappings,    setMappings]   = useState([]);
  const [mapFormId,   setMapFormId]  = useState('');
  const [mapFormName, setMapFormName]= useState('');
  const [mapProject,  setMapProject] = useState('');
  const [mapSaving,   setMapSaving]  = useState(false);

  useEffect(() => {
    // Sources
    const cached = getCache('sources');
    if (cached) { setSources(cached); setLoadingSrc(false); }
    else {
      fetch(SALES_ENDPOINTS.sources, { headers: authHeaders() })
        .then(r => r.json()).then(d => { const l = Array.isArray(d) ? d : []; setCache('sources', l); setSources(l); setLoadingSrc(false); })
        .catch(() => setLoadingSrc(false));
    }
    // Meta config + mappings
    fetch(SALES_ENDPOINTS.metaWebhookConfig, { headers: authHeaders() })
      .then(r => r.json()).then(d => { setCfg(d); setPat(d.page_access_token || ''); setProjectId(d.default_project_id || ''); setLoadingCfg(false); })
      .catch(() => setLoadingCfg(false));
    fetch(SALES_ENDPOINTS.metaMappings, { headers: authHeaders() })
      .then(r => r.json()).then(d => setMappings(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function addSource(name) {
    const n = name.trim().toLowerCase();
    if (!n) { setSrcErr('Source name is required.'); return; }
    if (sources.find(s => s.name === n)) { setSrcErr('Source already exists.'); return; }
    setAdding(true); setSrcErr('');
    const res  = await fetch(SALES_ENDPOINTS.sources, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: n }) });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setSrcErr(data.detail || JSON.stringify(data)); return; }
    bustCache('sources'); setSources(prev => [...prev, data]); setNewName('');
  }

  async function saveMetaConfig() {
    setSaving(true); setMetaMsg('');
    const res = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ action: 'save', page_access_token: pat, default_project_id: projectId || null }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setCfg(prev => ({ ...prev, is_active: d.is_active, page_access_token: pat })); setMetaMsg('Saved successfully!'); }
    else setMetaMsg('Error saving.');
  }

  async function regenerateToken() {
    setRegen(true);
    const res = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ action: 'regenerate_token' }),
    });
    const d = await res.json();
    setRegen(false);
    if (res.ok) setCfg(prev => ({ ...prev, verify_token: d.verify_token }));
  }

  async function addMapping() {
    if (!mapFormId.trim() || !mapProject) return;
    setMapSaving(true);
    const res = await fetch(SALES_ENDPOINTS.metaMappings, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ form_id: mapFormId.trim(), form_name: mapFormName.trim(), project_id: mapProject }),
    });
    const d = await res.json();
    setMapSaving(false);
    if (res.ok) { setMappings(prev => { const idx = prev.findIndex(m => m.form_id === d.form_id); return idx >= 0 ? prev.map((m, i) => i === idx ? d : m) : [...prev, d]; }); setMapFormId(''); setMapFormName(''); setMapProject(''); }
  }

  async function deleteMapping(id) {
    await fetch(SALES_ENDPOINTS.metaMappings, { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id }) });
    setMappings(prev => prev.filter(m => m.id !== id));
  }

  const webhookUrl = `${RAILWAY_URL}/api/sales/webhooks/meta/`;
  const existingNames = new Set(sources.map(s => s.name));

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Lead Setup</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Configure lead sources and connect external platforms</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E4E8F0', paddingBottom: 0 }}>
        {[{ key: 'meta', label: '🔗 Meta Integration' }, { key: 'sources', label: '📋 Lead Sources' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: 'none', borderBottom: tab === t.key ? `2px solid ${NAVY}` : '2px solid transparent',
            color: tab === t.key ? NAVY : '#8492A6', marginBottom: -2, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── META TAB ─── */}
      {tab === 'meta' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>

          {/* Left: Config */}
          <div>
            {/* Status */}
            <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: cfg?.is_active ? '#E8F5E9' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {cfg?.is_active ? '✅' : '⚠️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: cfg?.is_active ? GREEN : '#C62828' }}>
                  {cfg?.is_active ? 'Connected' : 'Not Connected'}
                </div>
                <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>
                  {cfg?.is_active
                    ? `${cfg.total_leads_received} leads received${cfg.last_lead_at ? ' · Last: ' + new Date(cfg.last_lead_at).toLocaleDateString() : ''}`
                    : 'Add your Page Access Token to activate'}
                </div>
              </div>
              {cfg?.is_active && (
                <div style={{ padding: '5px 12px', borderRadius: 20, backgroundColor: '#E8F5E9', color: GREEN, fontSize: 11, fontWeight: 800 }}>LIVE</div>
              )}
            </div>

            {/* Webhook URL */}
            <div style={card}>
              <div style={fieldLabel}>WEBHOOK URL</div>
              <p style={{ fontSize: 11, color: '#8492A6', marginBottom: 10 }}>Paste this URL in Meta for Developers → Webhooks → Callback URL</p>
              <div style={copyRow}>
                <code style={codeBox}>{webhookUrl}</code>
                <CopyBtn text={webhookUrl} />
              </div>
            </div>

            {/* Verify Token */}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={fieldLabel}>VERIFY TOKEN</div>
              <p style={{ fontSize: 11, color: '#8492A6', marginBottom: 10 }}>Paste this in Meta for Developers → Webhooks → Verify Token</p>
              {loadingCfg ? <div style={{ color: '#8492A6', fontSize: 13 }}>Loading…</div> : (
                <>
                  <div style={copyRow}>
                    <code style={codeBox}>{cfg?.verify_token || '—'}</code>
                    {cfg?.verify_token && <CopyBtn text={cfg.verify_token} />}
                  </div>
                  <button onClick={regenerateToken} disabled={regen} style={{ ...outlineBtn, marginTop: 10 }}>
                    {regen ? 'Regenerating…' : '↻ Regenerate Token'}
                  </button>
                </>
              )}
            </div>

            {/* Page Access Token + Project */}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={fieldLabel}>PAGE ACCESS TOKEN</div>
              <p style={{ fontSize: 11, color: '#8492A6', marginBottom: 10 }}>From Meta Business Suite → Settings → Page Access Tokens</p>
              <textarea
                value={pat}
                onChange={e => setPat(e.target.value)}
                placeholder="EAA…your token here…"
                rows={3}
                style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 11, padding: '8px 10px' }}
              />

              <div style={{ marginTop: 14 }}>
                <div style={fieldLabel}>DEFAULT PROJECT FOR META LEADS</div>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  style={{ ...inp, width: '100%', marginTop: 6 }}>
                  <option value="">— Auto-assign to no project —</option>
                  {(cfg?.projects || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button onClick={saveMetaConfig} disabled={saving} style={{ ...saveBtn, marginTop: 16, width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving…' : '💾 Save Configuration'}
              </button>
              {metaMsg && <p style={{ marginTop: 8, fontSize: 12, color: metaMsg.includes('Error') ? '#EF4444' : GREEN }}>{metaMsg}</p>}
            </div>

            {/* Form → Project Mapping */}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Form → Project Routing</div>
              <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 16, lineHeight: 1.6 }}>
                Map each Meta Lead Ads form to a project so leads are auto-classified on arrival.
              </p>
              {mappings.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {mappings.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, backgroundColor: '#F5F7FC', border: '1px solid #E4E8F0', marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{m.form_name || 'Unnamed Form'}</div>
                        <div style={{ fontSize: 11, color: '#8492A6', fontFamily: 'monospace' }}>{m.form_id}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>→</span>
                        <span style={{ padding: '3px 10px', borderRadius: 20, backgroundColor: '#E8EEFF', color: BLUE, fontSize: 12, fontWeight: 700 }}>{m.project_name}</span>
                        <span style={{ fontSize: 11, color: '#8492A6' }}>{m.total_leads} leads</span>
                      </div>
                      <button onClick={() => deleteMapping(m.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={mapFormId} onChange={e => setMapFormId(e.target.value)} placeholder="Form ID (e.g. 1234567890)" style={{ ...inp, width: '100%' }} />
                <input value={mapFormName} onChange={e => setMapFormName(e.target.value)} placeholder="Form label (e.g. Kalrav Form)" style={{ ...inp, width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={mapProject} onChange={e => setMapProject(e.target.value)} style={{ ...inp, flex: 1 }}>
                  <option value="">— Select Project —</option>
                  {(cfg?.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={addMapping} disabled={mapSaving || !mapFormId || !mapProject} style={{ ...saveBtn, opacity: (!mapFormId || !mapProject) ? 0.5 : 1 }}>
                  {mapSaving ? '…' : '+ Add'}
                </button>
              </div>
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, backgroundColor: '#F0F7FF', border: '1px solid #C7DAFF' }}>
                <div style={{ fontSize: 11, color: '#3D5AFE', fontWeight: 700, marginBottom: 3 }}>How to find your Form ID</div>
                <div style={{ fontSize: 11, color: '#5A6A85', lineHeight: 1.6 }}>Go to <strong>Meta Ads Manager → Lead Ads Forms → your form → Preview</strong>. The ID appears in the URL: <code style={{ backgroundColor: '#E8EEFF', padding: '1px 5px', borderRadius: 4 }}>form_id=XXXXXXXX</code></div>
              </div>
            </div>
          </div>

          {/* Right: Guide */}
          <div style={{ ...card, height: '100%', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Setup Guide</div>
              <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 16 }}>Follow these steps to connect Meta Lead Ads</p>
              <Step n="1" title="Create a Meta App">Go to <strong>developers.facebook.com</strong> → My Apps → Create App. Choose <strong>Business</strong> type.</Step>
              <Step n="2" title="Add Webhooks Product">In your app dashboard, click <strong>Add Product</strong> → select <strong>Webhooks</strong> → choose <strong>Page</strong>.</Step>
              <Step n="3" title="Configure Webhook URL">Click <strong>Subscribe to this object</strong>. Paste the <strong>Webhook URL</strong> and <strong>Verify Token</strong> from the left. Click <strong>Verify and Save</strong>.</Step>
              <Step n="4" title="Subscribe to leadgen field">After verification, find the <strong>leadgen</strong> field in the list and click <strong>Subscribe</strong>.</Step>
              <Step n="5" title="Get Page Access Token">Go to <strong>Meta Business Suite → Settings → Advanced → Page Access Tokens</strong>. Generate a long-lived token and paste it on the left.</Step>
              <Step n="6" title="Map forms to projects">Use the <strong>Form → Project Routing</strong> section to map each lead form to the correct project by Form ID.</Step>
              <Step n="7" title="Test it">Use Meta's <strong>Lead Ads Testing Tool</strong> to send a test lead — it should appear in <strong>All Leads</strong> with the correct project assigned.</Step>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: '#FFF8E1', border: '1px solid #FFE082' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E65100', marginBottom: 4 }}>Important</div>
              <div style={{ fontSize: 12, color: '#7A5000', lineHeight: 1.6 }}>
                The webhook URL must be HTTPS and publicly accessible — <code>localhost</code> will not work. Your Railway deployment URL is used automatically.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SOURCES TAB ─── */}
      {tab === 'sources' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Active Sources</div>
            {loadingSrc ? (
              <p style={{ color: '#8492A6', fontSize: 13 }}>Loading…</p>
            ) : sources.length === 0 ? (
              <p style={{ color: '#8492A6', fontSize: 13 }}>No sources yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sources.map(s => (
                  <span key={s.id} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: '#F0F3FA', color: '#182350', textTransform: 'capitalize' }}>
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Add Source</div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 8 }}>QUICK ADD</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {PRESET_SOURCES.filter(n => !existingNames.has(n)).map(name => (
                <button key={name} onClick={() => addSource(name)} disabled={adding}
                  style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px dashed #E0E6F0', backgroundColor: '#fff', fontSize: 12, color: '#8492A6', cursor: 'pointer', textTransform: 'capitalize' }}>
                  + {name}
                </button>
              ))}
              {PRESET_SOURCES.every(n => existingNames.has(n)) && <p style={{ fontSize: 12, color: '#8492A6' }}>All presets added.</p>}
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 8 }}>CUSTOM</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSource(newName)}
                placeholder="e.g. instagram, naukri…" style={{ ...inp, flex: 1 }} />
              <button onClick={() => addSource(newName)} disabled={adding || !newName}
                style={{ ...saveBtn, opacity: (adding || !newName) ? 0.5 : 1 }}>
                {adding ? '…' : 'Add'}
              </button>
            </div>
            {srcErr && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{srcErr}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const card      = { backgroundColor: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const inp       = { height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const saveBtn   = { padding: '9px 16px', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const outlineBtn = { padding: '7px 14px', backgroundColor: '#fff', color: '#5A6A85', border: '1.5px solid #D0D8E8', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const fieldLabel = { fontSize: 10, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, marginBottom: 6 };
const copyRow   = { display: 'flex', alignItems: 'center', gap: 8 };
const codeBox   = { flex: 1, fontSize: 11, fontFamily: 'monospace', backgroundColor: '#F5F7FC', padding: '8px 12px', borderRadius: 8, color: '#3D5AFE', wordBreak: 'break-all', border: '1px solid #E4E8F0' };
