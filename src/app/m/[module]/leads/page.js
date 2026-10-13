'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { SalesLeadsContent } from '../../../sales/leads/page';
import { PartnerActivityModal } from '../_PartnerActivity';

import Icon from '../../../../components/Icon';
import { confirmDialog } from '../../../../lib/notify';
import Loader from '../../../../components/Loader';
import { errText } from '../../../../lib/apiError';
const NAVY  = 'var(--text)';
const BLUE  = 'var(--accent)';
const RED   = 'var(--danger)';

const CATEGORY_OPTIONS = [
  { value: 'premium',  label: 'Premium' },
  { value: 'normal',   label: 'Normal' },
  { value: 'referral', label: 'Referral' },
];
const CATEGORY_COLOR = {
  premium:  { bg: 'var(--warning-soft)', color: 'var(--warning)' },
  normal:   { bg: 'var(--accent-soft)', color: BLUE },
  referral: { bg: 'var(--success-soft)', color: 'var(--success)' },
};
const SEGMENT_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'residential', label: 'Residential' },
  { value: 'industrial',  label: 'Industrial' },
  { value: 'both',        label: 'Both' },
];

// City is a broad dropdown (state-wide); Area stays free text for the actual
// locality within it — every CP is Gujarat-based for now, so this is a flat
// list rather than a state->city cascade.
const GUJARAT_CITIES = [
  'Ahmedabad', 'Amreli', 'Anand', 'Ankleshwar', 'Bardoli', 'Bharuch', 'Bhavnagar', 'Bhuj',
  'Botad', 'Chhota Udepur', 'Dahod', 'Deesa', 'Dhoraji', 'Dholka', 'Gandhidham', 'Gandhinagar',
  'Godhra', 'Gondal', 'Halol', 'Himatnagar', 'Idar', 'Jamnagar', 'Jetpur', 'Junagadh', 'Kalol',
  'Keshod', 'Khambhat', 'Kheda', 'Mahuva', 'Mehsana', 'Modasa', 'Morbi', 'Nadiad', 'Navsari',
  'Palanpur', 'Patan', 'Porbandar', 'Rajkot', 'Rajpipla', 'Sanand', 'Sidhpur', 'Surat',
  'Surendranagar', 'Talaja', 'Umreth', 'Una', 'Unjha', 'Upleta', 'Vadnagar', 'Vadodara',
  'Valsad', 'Vapi', 'Veraval', 'Vijapur', 'Viramgam', 'Visnagar', 'Vyara', 'Wankaner',
];

// Date only: the time a partner was keyed in is noise, the day is the fact.
function fmtAdded(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CategoryBadge({ category }) {
  const c = CATEGORY_COLOR[category] || { bg: 'var(--surface-2)', color: 'var(--muted)' };
  const label = CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category || '—';
  return (
    <span className="nx-badge" style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color }}>
      {label}
    </span>
  );
}

const EMPTY_CP_FORM = { name: '', contact_no: '', firm_name: '', category: 'normal', segment: '', city: '', area: '', date_added: '', is_active: true };

function ChannelPartnerModal({ initial, onClose, onSaved, onDelete }) {
  // One partner per contact number. Checked while the number is typed rather than
  // on submit, so nobody fills in the whole form only to be told the broker is
  // already there. The server enforces it regardless (409) — this is the courtesy.
  const [dupe, setDupe] = useState(null);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState(initial ? {
    name: initial.name || '', contact_no: initial.contact_no || '',
    firm_name: initial.firm_name || '', category: initial.category || 'normal',
    segment: initial.segment || '', city: initial.city || '', area: initial.area || '',
    is_active: initial.is_active !== false,
  } : EMPTY_CP_FORM);
  const [cityOther, setCityOther] = useState(!!initial?.city && !GUJARAT_CITIES.includes(initial.city));
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const isEdit = !!initial;

  // Ten digits is the whole of an Indian mobile and also what the server matches
  // on, so there is nothing to ask about before then.
  const digits = (form.contact_no || '').replace(/\D/g, '');
  useEffect(() => {
    if (digits.length < 10) { setDupe(null); setChecking(false); return; }
    let dead = false;
    setChecking(true);
    // Debounced: typing a number fires this on nearly every keystroke otherwise.
    const t = setTimeout(() => {
      const qs = `?contact_no=${encodeURIComponent(form.contact_no)}`
        + (initial?.id ? `&exclude=${initial.id}` : '');
      fetch(SALES_ENDPOINTS.partnerLookup(qs), { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!dead) { setDupe(d && d.exists ? d : null); setChecking(false); } })
        .catch(() => { if (!dead) setChecking(false); });
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [digits, form.contact_no, initial?.id]);

  async function save() {
    if (!form.name.trim())       { setErr('CP Name is required.');    return; }
    if (!form.contact_no.trim()) { setErr('Contact No is required.'); return; }
    if (dupe) { setErr(`${dupe.name || 'Another partner'} already has this contact number.`); return; }
    setSaving(true); setErr('');
    try {
      const url = isEdit ? SALES_ENDPOINTS.channelPartner(initial.id) : SALES_ENDPOINTS.channelPartners;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, name: form.name.trim(), contact_no: form.contact_no.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 is the duplicate rule — it names who holds the number, so show that
        // beside the field as well, not only as an error line.
        if (res.status === 409 && data.existing) setDupe({ ...data.existing, exists: true });
        setErr(errText(data, 'Something went wrong — please try again.'));
        setSaving(false);
        return;
      }
      onSaved(data);
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <div className="nx-modal-backdrop cpm-backdrop" onClick={onClose}>
      <div className="nx-modal cpm" onClick={(e) => e.stopPropagation()}>
        {/* Same header as the lead modal: who it is, and their number. */}
        <div className="nx-modal-head cpm-head">
          <div>
            <div className="cpm-title">{isEdit ? (initial.name || 'Channel Partner') : 'Add Channel Partner'}</div>
            <div className="cpm-sub">{isEdit ? (initial.contact_no || '') : 'Fill in the partner\'s details'}</div>
          </div>
          <button type="button" className="cpm-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        <div className="cpm-body">
          <div className="cpm-sec">Contact info</div>
          <div className="cpm-grid">
            <label className="cpm-f"><span>CP Name *</span>
              <input className="nx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Shah" />
            </label>
            <label className="cpm-f"><span>Contact No *</span>
              <input className={`nx-input${dupe ? ' cpd-bad' : ''}`} value={form.contact_no}
                onChange={(e) => setForm({ ...form, contact_no: e.target.value })} placeholder="e.g. 98765 43210" />
              <div className="cpd-state">
                {checking && <span className="cpd-checking">Checking…</span>}
                {dupe && (
                  <span className="cpd-dupe">
                    Already a channel partner:{' '}
                    <strong>{dupe.name || 'Unnamed'}</strong>
                    {dupe.firm_name ? ` · ${dupe.firm_name}` : ''}
                    {dupe.is_active === false ? ' (inactive)' : ''}
                  </span>
                )}
              </div>
            </label>
          </div>

          <div className="cpm-sec">Firm</div>
          <div className="cpm-grid">
            <label className="cpm-f cpm-wide"><span>Firm Name</span>
              <input className="nx-input" value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} placeholder="e.g. Shah Realty" />
            </label>
            <label className="cpm-f"><span>Category</span>
              <select className="nx-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="cpm-f"><span>Segment</span>
              <select className="nx-input" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                {SEGMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="cpm-sec">Location</div>
          <div className="cpm-grid">
            <label className="cpm-f"><span>City</span>
              <select className="nx-input" value={cityOther ? 'Other' : (form.city || '')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'Other') { setCityOther(true); setForm({ ...form, city: '' }); }
                  else { setCityOther(false); setForm({ ...form, city: v }); }
                }}>
                <option value="">— Select —</option>
                {GUJARAT_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
              {cityOther && (
                <input className="nx-input cpm-gap" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Enter city" />
              )}
            </label>
            <label className="cpm-f"><span>Area</span>
              <input className="nx-input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Vastrapur" />
            </label>
          </div>

          <div className="cpm-sec">Status</div>
          <div className="cpm-grid">
            {!isEdit && (
              <label className="cpm-f"><span>Date Added</span>
                <input className="nx-input" type="date" value={form.date_added} max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, date_added: e.target.value })} />
                <small className="cpm-hint">Leave blank to use today. Set this if the partnership started earlier.</small>
              </label>
            )}
            <div className="cpm-f"><span>Partner status</span>
              <div className="cpm-seg">
                {[[true, 'Active'], [false, 'Inactive']].map(([val, label]) => (
                  <button key={label} type="button" className={`nx-btn nx-btn-md nx-toggle${form.is_active === val ? ' is-on' : ''}`}
                    onClick={() => setForm({ ...form, is_active: val })}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          {err && <div className="nx-note bad cpm-err">{err}</div>}
        </div>

        <div className="cpm-foot">
          {isEdit && onDelete && (
            <button type="button" className="nx-btn nx-btn-md nx-btn-ghost cpd-del cpm-delete" onClick={() => onDelete(initial)}>Delete</button>
          )}
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving || !!dupe}
            title={dupe ? 'This contact number already belongs to a channel partner' : undefined}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Channel Partner'}
          </button>
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
  const [activeCp, setActiveCp] = useState(null);      // whose follow-ups/visits are open

  const load = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.channelPartners + cq, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setCps(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function del(cp) {
    if (!(await confirmDialog(`Remove ${cp.name}? Leads already linked to them keep their history.`))) return false;
    const res = await fetch(SALES_ENDPOINTS.channelPartner(cp.id) + cq, { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) { setCps((prev) => prev.filter((c) => c.id !== cp.id)); return true; }
    return false;
  }

  const needle = search.trim().toLowerCase();
  const filteredCps = !needle ? cps : cps.filter((cp) =>
    [cp.name, cp.contact_no, cp.firm_name].some((v) => (v || '').toLowerCase().includes(needle)));

  return (
    <div>
      {/* Same shape as CP Leads: a top card (title, add, search), then the table
          in its own flush card. */}
      <div className="nx-card cpd-top">
        <div className="cpd-head">
          <div className="cpd-title">Channel Partners {loading ? '' : `(${filteredCps.length})`}</div>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => setModalCp(null)}>+ Add Channel Partner</button>
        </div>
        <input className="nx-input cpd-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact no or firm name…" />
      </div>
      {loading ? (
        <div className="nx-card cpd-card cpd-empty"><Loader label="Loading…" /></div>
      ) : cps.length === 0 ? (
        <div className="nx-card cpd-card cpd-empty">No channel partners yet. Add the first one above.</div>
      ) : filteredCps.length === 0 ? (
        <div className="nx-card cpd-card cpd-empty">No channel partners match "{search}".</div>
      ) : (
        <div className="nx-card cpd-card">
          <table className="nx-table cpd-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Firm</th>
                <th>Type</th>
                <th>Location</th>
                <th>Added</th>
                <th>Status</th>
                <th className="cpd-num">Leads</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredCps.map((cp) => {
                const seg = cp.segment ? SEGMENT_OPTIONS.find((o) => o.value === cp.segment)?.label : '';
                // City and area together; the same place typed in both shows once.
                const place = [cp.area, cp.city].filter(Boolean)
                  .filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i).join(', ');
                return (
                  <tr key={cp.id} className="cpd-row" onClick={() => setModalCp(cp)}>
                    {/* The number is not on the list — it shows in the partner's details. */}
                    <td><div className="cpd-name">{cp.name}</div></td>
                    <td className="cpd-firm">{cp.firm_name || '—'}</td>
                    <td>
                      <CategoryBadge category={cp.category} />
                      {seg && <div className="cpd-sub">{seg}</div>}
                    </td>
                    <td className="cpd-place">{place || '—'}</td>
                    {/* When the partnership started. The Add form can backdate this,
                        so it is not always the row's creation timestamp. */}
                    <td className="cpd-nowrap">{fmtAdded(cp.created_at)}</td>
                    <td><span className={`cpa-chip ${cp.is_active ? 'cpa-chip-ok' : 'cpa-chip-mute'}`}>{cp.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="cpd-num">{cp.lead_count ?? 0}</td>
                    <td>
                      <button className="nx-btn nx-btn-sm nx-btn-soft cpd-nowrap" onClick={(e) => { e.stopPropagation(); setActiveCp(cp); }}>
                        {cp.follow_up_count || cp.site_visit_count
                          ? `${cp.follow_up_count || 0} FU · ${cp.site_visit_count || 0} SV`
                          : 'Schedule'}
                      </button>
                    </td>
                  </tr>
                );
              })}
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
          onDelete={async (cp) => { if (await del(cp)) setModalCp(undefined); }}
        />
      )}

      {activeCp && (
        <PartnerActivityModal
          partner={activeCp}
          companyId={companyId}
          // Reload on close rather than per change: the counts in this table are
          // annotated server-side, so they only move when the list is refetched.
          onClose={() => { setActiveCp(null); load(); }}
        />
      )}
    </div>
  );
}

export default function ChannelPartnerLeadsPage() {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [tab, setTab] = useState('leads');

  if (!user) return null;

  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }

  return (
    <>
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase' }}>Channel Partner</span>
        </div>

        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 14, backgroundColor: 'var(--surface-3)', marginBottom: 24, gap: 2 }}>
          {[{ key: 'leads', label: 'CP Leads' }, { key: 'details', label: 'CP Details' }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
              borderRadius: 8, backgroundColor: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? NAVY : 'var(--muted)',
              boxShadow: tab === t.key ? '0 1px 4px rgba(var(--ink-rgb),0.15)' : 'none',
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

const card       = { backgroundColor: 'var(--surface)', borderRadius: 18, padding: '20px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' };
const inp        = { height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const lbl        = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const th         = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td         = { padding: '10px 14px', fontSize: 13, color: 'var(--text)' };
const saveBtn    = { padding: '9px 16px', backgroundColor: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn  = { padding: '9px 16px', backgroundColor: 'var(--surface-2)', color: 'var(--muted)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const overlay    = { position: 'fixed', inset: 0, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal      = { backgroundColor: 'var(--surface)', borderRadius: 20, width: '90%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader= { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--surface-2)' };
const closeBtn   = { background: 'none', border: 'none', fontSize: 16, color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px' };
