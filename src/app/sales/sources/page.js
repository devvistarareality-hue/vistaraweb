'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, RAILWAY_URL, authHeaders } from '../../../constants/api';
import { getCache, setCache, bustCache } from '../../sales/_cache';


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
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: NAVY, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{n}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#5A6A85', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

export default function LeadSetupPage() {
  const router    = useRouter();
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq        = companyId ? `?company_id=${companyId}` : '';
  const srcKey    = `sources_${companyId || 'all'}`;

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const [tab, setTab] = useState('meta');

  // Sources tab
  const [sources, setSources] = useState([]);
  const [loadingSrc, setLoadingSrc] = useState(true);
  const [newName, setNewName]       = useState('');
  const [adding,  setAdding]        = useState(false);
  const [srcErr,  setSrcErr]        = useState('');

  // Meta tab
  const [cfg,             setCfg]             = useState(null);
  const [loadingCfg,      setLoadingCfg]      = useState(true);
  const [pat,             setPat]             = useState('');
  const [projectId,       setProjectId]       = useState('');
  const [saving,          setSaving]          = useState(false);
  const [metaMsg,         setMetaMsg]         = useState('');
  const [regen,           setRegen]           = useState(false);
  const [subscribedPages, setSubscribedPages] = useState([]);
  const [failedPages,     setFailedPages]     = useState([]);
  const [pagesData,       setPagesData]       = useState([]);
  const [refreshingPages, setRefreshingPages] = useState(false);
  const [pagesDiag,       setPagesDiag]       = useState('');
  const [editingToken,    setEditingToken]    = useState(false);

  // Form mappings
  const [mappings,    setMappings]   = useState([]);
  const [mapFormId,   setMapFormId]  = useState('');
  const [mapFormName, setMapFormName]= useState('');
  const [mapProject,  setMapProject] = useState('');
  const [mapSaving,   setMapSaving]  = useState(false);

  useEffect(() => {
    // Sources
    const cached = getCache(srcKey);
    if (cached) { setSources(cached); setLoadingSrc(false); }
    else {
      fetch(SALES_ENDPOINTS.sources + cq, { headers: authHeaders() })
        .then(r => r.json()).then(d => { const l = Array.isArray(d) ? d : []; setCache(srcKey, l); setSources(l); setLoadingSrc(false); })
        .catch(() => setLoadingSrc(false));
    }
    // Meta config + mappings
    fetch(SALES_ENDPOINTS.metaWebhookConfig + cq, { headers: authHeaders() })
      .then(r => r.json()).then(d => { setCfg(d); setPat(d.page_access_token || ''); setProjectId(d.default_project_id || ''); setSubscribedPages(d.subscribed_pages || []); setPagesData(d.pages_data || []); setLoadingCfg(false); })
      .catch(() => setLoadingCfg(false));
    fetch(SALES_ENDPOINTS.metaMappings + cq, { headers: authHeaders() })
      .then(r => r.json()).then(d => setMappings(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [companyId]);

  async function deleteSource(id) {
    if (!confirm('Delete this source?')) return;
    const res = await fetch(SALES_ENDPOINTS.source(id) + cq, { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) {
      bustCache(srcKey);
      setSources(prev => prev.filter(s => s.id !== id));
    }
  }

  async function addSource(name) {
    const n = name.trim().toLowerCase();
    if (!n) { setSrcErr('Source name is required.'); return; }
    if (sources.find(s => s.name === n)) { setSrcErr('Source already exists.'); return; }
    setAdding(true); setSrcErr('');
    const body = companyId ? { name: n, company_id: companyId } : { name: n };
    const res  = await fetch(SALES_ENDPOINTS.sources, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setSrcErr(data.detail || JSON.stringify(data)); return; }
    bustCache(srcKey); setSources(prev => [...prev, data]); setNewName('');
  }

  async function saveMetaConfig() {
    // Tokens never contain whitespace; strip any spaces/newlines a paste into the
    // multi-line box may have introduced (Meta returns "Cannot parse access token").
    const cleanPat = pat.replace(/\s+/g, '');
    if (cleanPat !== pat) setPat(cleanPat);
    setSaving(true); setMetaMsg(''); setSubscribedPages([]); setFailedPages([]); setPagesDiag('');
    const res = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ action: 'save', page_access_token: cleanPat, ...(companyId ? { company_id: companyId } : {}) }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      setCfg(prev => ({ ...prev, is_active: d.is_active, page_access_token: cleanPat }));
      setSubscribedPages(d.subscribed_pages || []);
      setFailedPages(d.failed_pages || []);
      setPagesData(d.pages_data || []);
      setMetaMsg('Saved!');
      setEditingToken(false);
    } else setMetaMsg('Error saving.');
  }

  // Re-fetch Pages & Forms from Meta (the 'save' action repopulates pages_data).
  // GET only auto-refreshes when stale (>2h), so this gives an on-demand refresh.
  async function refreshPages() {
    const cleanPat = pat.replace(/\s+/g, '');
    if (!cleanPat) { setMetaMsg('Save a Page Access Token first.'); return; }
    if (cleanPat !== pat) setPat(cleanPat);
    setRefreshingPages(true); setMetaMsg(''); setPagesDiag('');
    const cidBody = companyId ? { company_id: companyId } : {};
    try {
      const res = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'save', page_access_token: cleanPat, ...cidBody }),
      });
      const d = await res.json().catch(() => ({}));
      const pages = d.pages_data || [];
      setPagesData(pages);
      setSubscribedPages(d.subscribed_pages || []);
      if (pages.length) { setMetaMsg('Pages refreshed.'); }
      else {
        // No pages → ask Meta why (raw token/permission error) so it's actionable.
        setMetaMsg('No pages returned.');
        try {
          const dg = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ action: 'debug_forms', ...cidBody }),
          }).then(r => r.json());
          if (dg.accounts_status && dg.accounts_status !== 200) {
            const msg = dg.accounts_error?.error?.message || JSON.stringify(dg.accounts_error || {});
            setPagesDiag(`Meta rejected the token (HTTP ${dg.accounts_status}): ${msg}`);
          } else if (!(dg.pages || []).length) {
            setPagesDiag('Token is valid but no Pages are accessible. Use a User/System-User token that manages at least one Page and has the pages_show_list & leads_retrieval permissions (a single Page token won’t list pages).');
          } else {
            setPagesDiag('Pages found but their lead forms could not be read — check the leads_retrieval permission on the token.');
          }
        } catch { /* diagnostics are best-effort */ }
      }
    } catch { setMetaMsg('Error refreshing.'); }
    setRefreshingPages(false);
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
      body: JSON.stringify({ form_id: mapFormId.trim(), form_name: mapFormName.trim(), project_id: mapProject, ...(companyId ? { company_id: companyId } : {}) }),
    });
    const d = await res.json();
    setMapSaving(false);
    if (res.ok) { setMappings(prev => { const idx = prev.findIndex(m => m.form_id === d.form_id); return idx >= 0 ? prev.map((m, i) => i === idx ? d : m) : [...prev, d]; }); setMapFormId(''); setMapFormName(''); setMapProject(''); }
  }

  async function deleteMapping(id) {
    await fetch(SALES_ENDPOINTS.metaMappings, { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id, ...(companyId ? { company_id: companyId } : {}) }) });
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
        <div className="rg-2" style={{ gap: 20, alignItems: 'stretch' }}>

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
            {(() => {
              const savedTok = pat || cfg?.page_access_token || '';
              const hasToken = !!savedTok;
              const editing  = editingToken || !hasToken;   // first-time setup = editable
              const masked   = savedTok.length > 14
                ? `${savedTok.slice(0, 8)}${'•'.repeat(18)}${savedTok.slice(-4)}`
                : '••••••••';
              return (
                <div style={{ ...card, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={fieldLabel}>ACCESS TOKEN (USER / SYSTEM USER)</div>
                    {hasToken && !editing && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: GREEN, background: '#E8F8EE', padding: '3px 9px', borderRadius: 20 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} /> Connected
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#8492A6', marginBottom: 10, lineHeight: 1.5 }}>
                    Business Settings → <strong>System Users</strong> → Generate token, with <strong>pages_show_list</strong>, <strong>leads_retrieval</strong> &amp; <strong>pages_read_engagement</strong>. A single Page token won’t work.
                  </p>

                  {editing ? (
                    <>
                      <textarea
                        value={pat}
                        onChange={e => setPat(e.target.value)}
                        placeholder="EAA…your token here…"
                        rows={3}
                        autoFocus={editingToken}
                        style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 11, padding: '8px 10px' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={saveMetaConfig} disabled={saving} style={{ ...saveBtn, flex: 1, justifyContent: 'center' }}>
                          {saving ? 'Saving…' : '💾 Save Configuration'}
                        </button>
                        {hasToken && (
                          <button onClick={() => { setPat(cfg?.page_access_token || ''); setEditingToken(false); setMetaMsg(''); }}
                            style={cancelBtn}>Cancel</button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ ...codeBox, flex: 1, fontFamily: 'monospace', letterSpacing: 0.5 }}>{masked}</code>
                      <button onClick={() => { setEditingToken(true); setMetaMsg(''); setPagesDiag(''); }} style={outlineBtn}>✎ Edit</button>
                    </div>
                  )}

                  {metaMsg && <p style={{ marginTop: 8, fontSize: 12, color: metaMsg.includes('Error') || metaMsg.includes('No pages') ? '#EF4444' : GREEN }}>{metaMsg}</p>}
                  {metaMsg === 'Saved!' && failedPages.length > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: '#FFF3F3', border: '1px solid #FFCDD2', fontSize: 12 }}>
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>Failed to subscribe: </span>
                      {failedPages.join(', ')}
                    </div>
                  )}
                </div>
              );
            })()}

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <code style={{ fontSize: 11, color: '#8492A6', fontFamily: 'monospace' }}>{m.form_id}</code>
                          <CopyBtn text={m.form_id} />
                        </div>
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
                <input value={mapFormId} onChange={e => {
                  const id = e.target.value; setMapFormId(id);
                  // Auto-fill the label from the matching connected form's name.
                  const t = id.trim();
                  let nm = '';
                  for (const pg of (pagesData || [])) { const f = (pg.forms || []).find(x => String(x.id) === t); if (f) { nm = f.name || ''; break; } }
                  if (nm) setMapFormName(nm);
                }} placeholder="Form ID (e.g. 1234567890)" style={{ ...inp, width: '100%' }} />
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
              <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, backgroundColor: '#F0F7FF', border: '1px solid #C7DAFF', minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, color: '#3D5AFE', fontWeight: 700, marginBottom: 3 }}>How to find your Form ID</div>
                <div style={{ fontSize: 11, color: '#5A6A85', lineHeight: 1.6 }}>Go to <strong>Meta Ads Manager → Lead Ads Forms → your form → Preview</strong>. The ID appears in the URL: <code style={{ backgroundColor: '#E8EEFF', padding: '1px 5px', borderRadius: 4 }}>form_id=XXXXXXXX</code></div>
              </div>
            </div>

            {/* Connected Pages Cards — always shown so the feature stays discoverable
                even when Meta hasn't returned pages yet (empty state + refresh). */}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A2E' }}>Connected Pages & Forms</div>
                <button onClick={refreshPages} disabled={refreshingPages}
                  style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE', background: '#F0F3FF', border: '1.5px solid #3D5AFE40', borderRadius: 8, padding: '5px 12px', cursor: refreshingPages ? 'default' : 'pointer', opacity: refreshingPages ? 0.6 : 1 }}>
                  {refreshingPages ? 'Refreshing…' : '↻ Refresh'}
                </button>
              </div>
              {pagesData.length === 0 ? (
                <div style={{ padding: '18px 14px', borderRadius: 8, background: '#FAFBFF', border: '1px dashed #D6DEEC', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: '#5C6BC0', fontWeight: 600, marginBottom: 4 }}>No pages loaded for this company yet.</p>
                  <p style={{ fontSize: 12, color: '#8492A6' }}>
                    {pat ? 'Click Refresh to fetch your Pages & lead forms from Meta.'
                         : 'Add and save a valid Page Access Token above, then Refresh.'}
                  </p>
                  {pagesDiag && (
                    <p style={{ fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px', marginTop: 12, textAlign: 'left', lineHeight: 1.5 }}>
                      {pagesDiag}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pagesData.map(pg => {
                    const mappingMap = {};
                    mappings.forEach(m => { mappingMap[m.form_id] = m; });
                    return (
                      <details key={pg.page_id} style={{ borderRadius: 8, border: '1.5px solid #E4E8F0', overflow: 'hidden' }}>
                        <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', backgroundColor: '#F5F7FC', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: GREEN, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#182350', flex: 1 }}>{pg.page_name}</span>
                          <span style={{ fontSize: 11, color: '#8492A6', backgroundColor: '#E8EEFF', padding: '2px 8px', borderRadius: 10 }}>{pg.forms.length} forms</span>
                        </summary>
                        {pg.forms.length > 0 && (
                          <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {pg.forms.map(f => {
                              const mapped = mappingMap[f.id];
                              return (
                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, backgroundColor: mapped ? '#F0FFF4' : '#FAFAFA' }}>
                                  <span style={{ fontSize: 12, color: '#1A1A2E', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'Unnamed'}</span>
                                  <code style={{ fontSize: 10, color: '#B0BAC9', fontFamily: 'monospace', flexShrink: 0 }}>{f.id}</code>
                                  <CopyBtn text={f.id} />
                                  {mapped
                                    ? <span style={{ padding: '2px 8px', borderRadius: 10, backgroundColor: '#D1FAE5', color: '#065F46', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{mapped.project_name}</span>
                                    : <span style={{ padding: '2px 8px', borderRadius: 10, backgroundColor: '#F3F4F6', color: '#9CA3AF', fontSize: 10, flexShrink: 0 }}>No project</span>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Guide */}
          <div style={{ ...card, height: '100%', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>Setup Guide</div>
            <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 0 }}>Follow these steps to connect Meta Lead Ads</p>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', paddingTop: 4 }}>
              <Step n="1" title="Create a Meta App">Go to <strong>developers.facebook.com</strong> → My Apps → Create App. Choose <strong>Business</strong> type.</Step>
              <Step n="2" title="Add Webhooks Product">Click <strong>Add Product</strong> → select <strong>Webhooks</strong> → choose <strong>Page</strong> as subscription object.</Step>
              <Step n="3" title="Configure Webhook URL">Paste the <strong>Webhook URL</strong> and <strong>Verify Token</strong> from the left panel. Click <strong>Verify and Save</strong>.</Step>
              <Step n="4" title="Subscribe to leadgen field">After verification, find the <strong>leadgen</strong> field and click <strong>Subscribe</strong>.</Step>
              <Step n="5" title="Get a System-User Access Token">In <strong>Meta Business Settings → System Users</strong>, add/select a system user, then <strong>Generate token</strong> for your app with <strong>pages_show_list</strong>, <strong>leads_retrieval</strong> &amp; <strong>pages_read_engagement</strong>. Paste it on the left. (A single Page token won’t list your pages.)</Step>
              <Step n="6" title="Map forms to projects">Use <strong>Form → Project Routing</strong> below to map each lead form to the correct project by Form ID.</Step>
              <Step n="7" title="Test it">Use Meta's <strong>Lead Ads Testing Tool</strong> — the lead should appear in <strong>All Leads</strong> with the correct project within seconds.</Step>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: '#FFF8E1', border: '1px solid #FFE082', minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
        <div className="rg-2" style={{ gap: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Active Sources</div>
            {loadingSrc ? (
              <p style={{ color: '#8492A6', fontSize: 13 }}>Loading…</p>
            ) : sources.length === 0 ? (
              <p style={{ color: '#8492A6', fontSize: 13 }}>No sources yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sources.map(s => (
                  <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: '#F0F3FA', color: '#182350', textTransform: 'capitalize' }}>
                    {s.name}
                    <button onClick={() => deleteSource(s.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8492A6', fontSize: 14, lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}
                      title="Delete source">
                      ×
                    </button>
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
const cancelBtn = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const fieldLabel = { fontSize: 10, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, marginBottom: 6 };
const copyRow   = { display: 'flex', alignItems: 'center', gap: 8 };
const codeBox   = { flex: 1, fontSize: 11, fontFamily: 'monospace', backgroundColor: '#F5F7FC', padding: '8px 12px', borderRadius: 8, color: '#3D5AFE', wordBreak: 'break-all', border: '1px solid #E4E8F0' };
