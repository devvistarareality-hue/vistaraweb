'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { SalesLeadsContent } from '../../leads/page';

const NAVY  = '#182350';
const BLUE  = '#3D5AFE';
const RED   = '#EF4444';

const CATEGORY_OPTIONS = [
  { value: 'premium',  label: 'Premium' },
  { value: 'normal',   label: 'Normal' },
  { value: 'referral', label: 'Referral' },
];
const CATEGORY_COLOR = {
  premium:  { bg: '#FEF3C7', color: '#B45309' },
  normal:   { bg: '#E8EEFF', color: BLUE },
  referral: { bg: '#E8F5E9', color: '#2E7D32' },
};
const SEGMENT_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'residential', label: 'Residential' },
  { value: 'industrial',  label: 'Industrial' },
  { value: 'both',        label: 'Both' },
];

function CategoryBadge({ category }) {
  const c = CATEGORY_COLOR[category] || { bg: '#F0F3FA', color: '#8492A6' };
  const label = CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category || '—';
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color }}>
      {label}
    </span>
  );
}

const EMPTY_CP_FORM = { name: '', contact_no: '', firm_name: '', category: 'normal', segment: '', area: '', date_added: '', is_active: true };

function ChannelPartnerModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || '', contact_no: initial.contact_no || '',
    firm_name: initial.firm_name || '', category: initial.category || 'normal',
    segment: initial.segment || '', area: initial.area || '',
    is_active: initial.is_active !== false,
  } : EMPTY_CP_FORM);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const isEdit = !!initial;

  async function save() {
    if (!form.name.trim())       { setErr('CP Name is required.');    return; }
    if (!form.contact_no.trim()) { setErr('Contact No is required.'); return; }
    setSaving(true); setErr('');
    try {
      const url = isEdit ? SALES_ENDPOINTS.channelPartner(initial.id) : SALES_ENDPOINTS.channelPartners;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, name: form.name.trim(), contact_no: form.contact_no.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || JSON.stringify(data)); setSaving(false); return; }
      onSaved(data);
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>{isEdit ? 'Edit Channel Partner' : 'Add Channel Partner'}</div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <label style={lbl}>CP Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Ramesh Shah" style={{ ...inp, width: '100%', marginBottom: 14 }} />

          <label style={lbl}>Contact No *</label>
          <input value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })}
            placeholder="e.g. 98765 43210" style={{ ...inp, width: '100%', marginBottom: 14 }} />

          <label style={lbl}>Firm Name</label>
          <input value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
            placeholder="e.g. Shah Realty" style={{ ...inp, width: '100%', marginBottom: 14 }} />

          <label style={lbl}>Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={{ ...inp, width: '100%', marginBottom: 14, cursor: 'pointer' }}>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <label style={lbl}>Segment</label>
          <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}
            style={{ ...inp, width: '100%', marginBottom: 14, cursor: 'pointer' }}>
            {SEGMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <label style={lbl}>Area</label>
          <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder="e.g. Vastrapur, Ahmedabad" style={{ ...inp, width: '100%', marginBottom: 14 }} />

          {!isEdit && (
            <>
              <label style={lbl}>Date Added</label>
              <input type="date" value={form.date_added} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, date_added: e.target.value })}
                style={{ ...inp, maxWidth: 220, marginBottom: 4 }} />
              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14 }}>Leave blank to use today. Set this if the partnership actually started earlier.</p>
            </>
          )}

          <label style={lbl}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[[true, 'Active'], [false, 'Inactive']].map(([val, label]) => {
              const active = form.is_active === val;
              const color = val ? '#2E7D32' : '#8492A6';
              return (
                <button key={label} type="button" onClick={() => setForm({ ...form, is_active: val })}
                  style={{ flex: 1, padding: '9px 8px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? color : '#E0E6F0'}`, background: active ? color : '#fff', color: active ? '#fff' : color }}>
                  {label}
                </button>
              );
            })}
          </div>

          {err && <p style={{ color: RED, fontSize: 12, marginTop: 10 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={save} disabled={saving} style={{ ...saveBtn, flex: 1, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Channel Partner'}
            </button>
            <button onClick={onClose} style={cancelBtn}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CpDetailsTab({ companyId }) {
  const cq = companyId ? `?company_id=${companyId}` : '';
  const [cps,      setCps]      = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modalCp,  setModalCp]  = useState(undefined); // undefined = closed, null = add, object = edit
  const [search,   setSearch]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.channelPartners + cq, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setCps(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function del(cp) {
    if (!window.confirm(`Remove ${cp.name}? Leads already linked to them keep their history.`)) return;
    const res = await fetch(SALES_ENDPOINTS.channelPartner(cp.id) + cq, { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) setCps((prev) => prev.filter((c) => c.id !== cp.id));
  }

  const needle = search.trim().toLowerCase();
  const filteredCps = !needle ? cps : cps.filter((cp) =>
    [cp.name, cp.contact_no, cp.firm_name].some((v) => (v || '').toLowerCase().includes(needle)));

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Channel Partners {loading ? '' : `(${filteredCps.length})`}</div>
        <button onClick={() => setModalCp(null)} style={saveBtn}>+ Add Channel Partner</button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, contact no or firm name…" style={{ ...inp, width: '100%', marginBottom: 16 }} />
      {loading ? (
        <p style={{ color: '#8492A6', fontSize: 13 }}>Loading…</p>
      ) : cps.length === 0 ? (
        <p style={{ color: '#8492A6', fontSize: 13 }}>No channel partners yet. Add the first one above.</p>
      ) : filteredCps.length === 0 ? (
        <p style={{ color: '#8492A6', fontSize: 13 }}>No channel partners match "{search}".</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Contact No</th>
                <th style={th}>Firm Name</th>
                <th style={th}>Category</th>
                <th style={th}>Segment</th>
                <th style={th}>Area</th>
                <th style={th}>Status</th>
                <th style={th}>Leads</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredCps.map((cp) => (
                <tr key={cp.id} style={{ borderTop: '1px solid #F0F3FA' }}>
                  <td style={{ ...td, fontWeight: 600, color: '#1A1A2E' }}>{cp.name}</td>
                  <td style={td}>{cp.contact_no}</td>
                  <td style={td}>{cp.firm_name || '—'}</td>
                  <td style={td}><CategoryBadge category={cp.category} /></td>
                  <td style={td}>{cp.segment ? SEGMENT_OPTIONS.find((o) => o.value === cp.segment)?.label : '—'}</td>
                  <td style={td}>{cp.area || '—'}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: cp.is_active ? '#E8F5E9' : '#F0F3FA', color: cp.is_active ? '#2E7D32' : '#8492A6' }}>
                      {cp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={td}>{cp.lead_count ?? 0}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModalCp(cp)} style={{ ...iconBtn, color: BLUE }}>Edit</button>
                    <button onClick={() => del(cp)} style={{ ...iconBtn, color: RED }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalCp !== undefined && (
        <ChannelPartnerModal
          initial={modalCp}
          onClose={() => setModalCp(undefined)}
          onSaved={(saved) => {
            setCps((prev) => modalCp ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]);
            setModalCp(undefined);
          }}
        />
      )}
    </div>
  );
}

export default function ChannelPartnerLeadsPage() {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [tab, setTab] = useState('leads');

  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return (
    <>
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#8492A6', textTransform: 'uppercase' }}>Channel Partner</span>
        </div>

        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 10, backgroundColor: '#EEF1F7', marginBottom: 24, gap: 2 }}>
          {[{ key: 'leads', label: 'CP Leads' }, { key: 'details', label: 'CP Details' }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
              borderRadius: 8, backgroundColor: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? NAVY : '#8492A6',
              boxShadow: tab === t.key ? '0 1px 4px rgba(24,35,80,0.15)' : 'none',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'details' && (
        <div style={{ padding: '0 28px 24px' }}>
          <CpDetailsTab companyId={companyId} />
        </div>
      )}
      {tab === 'leads' && <SalesLeadsContent adminView cpOnly />}
    </>
  );
}

const card       = { backgroundColor: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const inp        = { height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const lbl        = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const tbl        = { width: '100%', borderCollapse: 'collapse', minWidth: 720 };
const th         = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td         = { padding: '10px 14px', fontSize: 13, color: '#1A1A2E' };
const saveBtn    = { padding: '9px 16px', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn  = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 8px' };
const overlay    = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal      = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader= { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn   = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
