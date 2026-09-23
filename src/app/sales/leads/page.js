'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { getCache, setCache, bustCache } from '../../sales/_cache';

import Icon from '../../../components/Icon';
import { confirmDialog } from '../../../lib/notify';
import Loader from '../../../components/Loader';
import { can } from '../../../lib/moduleAccess';
function bustLeadsCache() {
  // The Sales cache lives in localStorage under the 'sc_' prefix (see _cache.js),
  // so clear the leads_* keys from localStorage — not sessionStorage.
  if (typeof window === 'undefined') return;
  Object.keys(localStorage).filter((k) => k.startsWith('sc_leads_')).forEach((k) => localStorage.removeItem(k));
}

const PAGE_SIZE = 25;

// Lead requirement options (mirror sales/models.py LEAD_PURPOSE_CHOICES + BUDGET_BUCKETS)
const CITY_OPTIONS = ['Ahmedabad', 'Vadodara'];
const PURPOSE_OPTIONS = [
  { value: 'investment', label: 'Investment' },
  { value: 'end_use', label: 'End Use' },
  { value: 'other', label: 'Other' },
];
const BUDGET_OPTIONS = [
  { value: 'lt_10l', label: 'Less than ₹10 Lakh' },
  { value: '10_50l', label: '₹10 – 50 Lakh' },
  { value: '50l_1cr', label: '₹50 Lakh – ₹1 Cr' },
  { value: '1_2cr', label: '₹1 – 2 Cr' },
  { value: '2_3cr', label: '₹2 – 3 Cr' },
  { value: '3_5cr', label: '₹3 – 5 Cr' },
  { value: 'gt_5cr', label: 'Above ₹5 Cr' },
];

const STATUS_COLOR = {
  new:              'var(--accent)',
  assigned:         'var(--accent-deep)',
  contacted:        'var(--success)',
  not_reachable:    'var(--muted)',
  warm_transferred: 'var(--warning-2)',
  hot:              'var(--danger)',
  warm:             'var(--warning-2)',
  cold:             'var(--accent)',
  not_interested:   'var(--muted)',
  sv_scheduled:     'var(--warning-2)',
  sv_done:          'var(--success)',
  closed:           'var(--success)',
  lost:             'var(--danger)',
};

const ALL_STATUSES = ['new','assigned','contacted','not_reachable','warm_transferred','hot','warm','cold','not_interested','sv_scheduled','sv_done','closed','lost'];

const OUTCOME_COLOR = { hot: 'var(--danger)', warm: 'var(--warning-2)', cold: 'var(--accent)', not_interested: 'var(--text-3)' };

// `outcome` (SV Hot/Warm/Cold, only meaningful for sv_done) is shown alongside
// the stage — "SV DONE · HOT" — rather than replacing it, so the pipeline stage
// and the visit's outcome are both visible without conflating the two.
function StatusBadge({ status, outcome }) {
  const color = STATUS_COLOR[status] || 'var(--muted)';
  return (
    <span className="nx-badge" style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`, color }}>
      {status?.replace(/_/g, ' ').toUpperCase()}
      {status === 'sv_done' && outcome && (
        <span style={{ color: OUTCOME_COLOR[outcome] || color }}> · {outcome.replace(/_/g, ' ').toUpperCase()}</span>
      )}
    </span>
  );
}

function DupBadge({ count }) {
  return (
    <span title={`Duplicate phone — seen ${count || 1} time(s) before`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800, backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger-2)', letterSpacing: 0.3 }}>
      <Icon name="alert" /> DUP
    </span>
  );
}

/* ── Toast Notification ── */
function DupToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {toasts.map((t) => (
        <div className="nx-card" key={t.id} style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--danger-2)', borderLeft: '4px solid var(--danger)', borderRadius: 16, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'slideIn 0.25s ease' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}><Icon name="alert" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', marginBottom: 2 }}>Duplicate Lead</div>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{t.phone} · already in system</div>
          </div>
          <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost" onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 0 }}><Icon name="x" /></button>
        </div>
      ))}
    </div>
  );
}


// ── Add Lead Modal ──────────────────────────────────────────────────────────
function TransferLeadModal({ lead, stms, onClose, onDone }) {
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const options = (stms || []).filter((u) => String(u.id) !== String(lead.stm));

  async function submit() {
    if (!to) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(SALES_ENDPOINTS.leadTransfers, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ lead: lead.id, to_stm: to, reason: reason.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'Could not request the transfer.'); setBusy(false); return; }
      onDone();
    } catch { setErr('Could not request the transfer.'); setBusy(false); }
  }

  const inp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)' };
  return (
    <div className="nx-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,16,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: 'min(100%, 460px)', boxShadow: '0 18px 50px rgba(var(--ink-rgb),0.28)', overflow: 'hidden' }}>
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '16px 20px' }}>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>Transfer to another STM</p>
          <p style={{ color: '#CCE5FF', fontSize: 12, margin: '3px 0 0' }}>{lead.name}{lead.project_name ? ` · ${lead.project_name}` : ''}</p>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            Needs approval from this project&rsquo;s booking approvers. The lead stays with you until then.
          </p>
          <select className="nx-input" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">Select the STM to transfer to…</option>
            {options.map((u) => <option key={u.id} value={u.id}>{u.name}{u.user_code ? ` · ${u.user_code}` : ''}</option>)}
          </select>
          {options.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--warning)', margin: 0 }}>No other STM in your company to transfer to.</p>
          )}
          <textarea className="nx-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it moving? (optional)"
            style={{ ...inp, height: 64, padding: '8px 12px', resize: 'vertical' }} />
          {!!err && <p style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} style={{ padding: '10px 18px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button className="nx-btn nx-btn-md nx-btn-primary" onClick={submit} disabled={!to || busy}
              style={{ padding: '10px 20px', background: (!to || busy) ? 'var(--blue-2)' : 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: (!to || busy) ? 'default' : 'pointer' }}>
              {busy ? 'Sending…' : 'Request transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cpLabel(cp) { return `${cp.name}${cp.firm_name ? ` · ${cp.firm_name}` : ''}`; }

// Channel Partner Name is picked from a list that can run into the hundreds — a
// plain <select> makes finding one by scrolling painful. This is a type-to-filter
// combobox: click it to open, type any part of the name/firm to narrow the list,
// click a result to pick it — same open/query/onMouseDown pattern as the Club 1000
// reference-name autocomplete (club1000/_AddInvestorModal.js).
function ChannelPartnerPicker({ value, onChange, options, inputStyle, placeholder = 'Search channel partner…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.id) === String(value));
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => cpLabel(o).toLowerCase().includes(q)) : options;

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={open ? query : (selected ? cpLabel(selected) : '')}
        placeholder={placeholder}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
      />
      {open && (
        <div className="nx-popover" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
          background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(var(--ink-rgb),0.14)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--faint)' }}>No match</div>
          ) : filtered.map((cp, i) => (
            <div key={cp.id}
              onMouseDown={() => { onChange(String(cp.id)); setQuery(''); setOpen(false); }}
              style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--surface-2)' : 'none', color: 'var(--text)' }}>
              {cpLabel(cp)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Shown right under whichever status field was actually set to Not Qualified
// (TC Status or STM/CP Status) — the reason applies to the lead as a whole,
// but it belongs next to the decision that produced it, not tacked onto the
// end of the form.
function NotQualifiedFields({ reason, note, onReason, onNote, lblStyle, selStyle, taStyle }) {
  return (
    <div className="nx-callout-danger">
      <div className="nx-callout-danger-title">Not Qualified</div>
      <div style={{ marginBottom: reason === 'other' ? 12 : 0 }}> {/* inline-ok: spacing toggles only when the Note field below appears */}
        <label style={lblStyle}>Reason<span className="nx-required">*</span></label>
        <select className="nx-input" value={reason || ''} onChange={(e) => onReason(e.target.value)} style={selStyle}>
          <option value="">— Select reason —</option>
          <option value="religion">Religion</option>
          <option value="caste">Caste</option>
          <option value="budget">Budget</option>
          <option value="other">Other</option>
        </select>
      </div>
      {reason === 'other' && (
        <div>
          <label style={lblStyle}>Note<span className="nx-required">*</span></label>
          <textarea className="nx-input" value={note || ''} onChange={(e) => onNote(e.target.value)} placeholder="Reason details" rows={2} style={taStyle} />
        </div>
      )}
    </div>
  );
}

function AddLeadModal({ projects, sources, telecallers = [], stms = [], cps = [], cpOnly = false, channelPartners = [], prefill = null, onClose, onAdded }) {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const _desig = (user?.designation || '').toLowerCase();
  const _isTelecaller = can(user, 'sales.pipeline.telecalling');
  const _isStm = can(user, 'sales.pipeline.stm');
  const _isCpHead = _desig.includes('cp cluster head');
  const _isCp = can(user, 'sales.pipeline.cp') || _isCpHead;
  const _isAdminMgr = !(_isTelecaller || _isStm || _isCp);
  const showTC  = _isAdminMgr || _isTelecaller;
  const showStm = _isAdminMgr || _isStm || _isCp;
  const TC_STATUSES  = ['warm', 'cold', 'not_interested', 'not_reachable', 'callback', 'not_qualified'];
  const STM_STATUSES = ['hot', 'warm', 'cold', 'not_interested', 'sv_scheduled', 'sv_done', 'closed', 'not_qualified'];
  // In the Channel Partner section, Source is fixed to the "Channel Partner"
  // LeadSource (created on demand by the parent) rather than freely chosen.
  const cpSource = cpOnly ? sources.find((s) => (s.name || '').toLowerCase() === 'channel partner') : null;
  const [form, setForm] = useState({ name: prefill?.name || '', phone: prefill?.phone || '', alt_phone: '', email: '', project: '', source: '', channel_partner: '', city: '', address: '', purpose: [], budget_bucket: '', telecaller: '', stm: '', telecaller_status: '', telecaller_remarks: '', stm_status: '', stm_remarks: '', disqualify_reason: '', disqualify_note: '', lead_date: '' });
  const isNotQualified = form.telecaller_status === 'not_qualified' || form.stm_status === 'not_qualified';
  useEffect(() => {
    if (cpOnly && cpSource && !form.source) setForm((f) => ({ ...f, source: cpSource.id }));
  }, [cpOnly, cpSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live duplicate check: as the phone number (and project) settle, look up
  // whether this contact already has a lead. Same project → submitting here
  // will update that lead in place, not create a new one (see backend
  // LeadListView.post's merge path). Different project → informational only,
  // a separate lead gets created as usual.
  const [dupMatch, setDupMatch] = useState(null);
  useEffect(() => {
    const digits = (form.phone || '').replace(/\D/g, '');
    if (digits.length < 10) { setDupMatch(null); return undefined; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${SALES_ENDPOINTS.leadSearch}?search=${digits.slice(-10)}`, { headers: authHeaders() });
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) { setDupMatch(null); return; }
        const sameProject = form.project ? rows.find((r) => String(r.project_id) === String(form.project)) : null;
        setDupMatch({ ...(sameProject || rows[0]), sameProject: !!sameProject });
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [form.phone, form.project]);
  // "Assign STM" list is scoped to the project picked above — an STM assigned
  // to specific projects (Team Users → Assign) only shows for those; refetch
  // whenever the project selection changes.
  const [salesCpUsers, setSalesCpUsers] = useState([]);
  const salesCpReqId = useRef(0);
  useEffect(() => {
    if (!cpOnly || !(_isCpHead || _isAdminMgr)) return;
    // form.project starts empty and gets set moments later once seeded, so an
    // earlier (unscoped) request can resolve AFTER a later (project-scoped)
    // one and clobber it back to the unfiltered list — guard by request order.
    const reqId = ++salesCpReqId.current;
    const cq = (companyId ? `&company_id=${companyId}` : '') + (form.project ? `&project_id=${form.project}` : '');
    fetch(SALES_ENDPOINTS.salesCpUsers + cq, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { if (reqId === salesCpReqId.current) setSalesCpUsers(Array.isArray(d) ? d : []); })
      .catch(() => { if (reqId === salesCpReqId.current) setSalesCpUsers([]); });
  }, [cpOnly, _isCpHead, _isAdminMgr, companyId, form.project]);
  const [cityOther, setCityOther] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // A walk-in IS the site visit — the client turned up. So picking that source
  // puts the lead straight at sv_done and dates the visit by when they walked in
  // (the Lead Received Date), not by when the STM got round to typing it in.
  const srcName = (id) => (sources.find((x) => String(x.id) === String(id))?.name || '').toLowerCase();
  const isWalkIn = /walk\s*-?\s*in/.test(srcName(form.source));
  // Same inline outcome capture as the Lead Detail modal — a manual lead created
  // directly at STM Status = sv_done needs its visit outcome too, recorded on an
  // auto-created completed SiteVisit right after the lead itself.
  const [svOutcome, setSvOutcome] = useState('');
  const [svVisitedDate, setSvVisitedDate] = useState(new Date().toLocaleDateString('en-CA'));
  // Same inline scheduler as the Lead Detail modal — filled in here it's created
  // right after the lead itself, so a manual lead can arrive with its first call booked.
  const [fuForm, setFuForm] = useState({ role_context: (_isStm || cpOnly) ? 'stm' : 'telecaller', scheduled_at: '', remarks: '' });
  const addLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
  const addInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)' };
  const addSel = { ...addInp, cursor: 'pointer' };
  const addTa  = { ...addInp, height: 56, padding: '8px 12px', resize: 'vertical' };

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.phone) { setErr('Name and phone are required.'); return; }
    if (!form.project) { setErr('Project is required.'); return; }
    if (!form.source)  { setErr('Source is required.'); return; }
    // A rep logging a lead by hand has just spoken to them, so the disposition and
    // the note are the point of the record — without them the lead lands in the
    // queue looking untouched. Required for the rep's own section only; an admin
    // entering someone else's lead has no call to write up.
    if (_isTelecaller && (!form.telecaller_status || !(form.telecaller_remarks || '').trim())) {
      setErr('Pick a TC status and add remarks.'); return;
    }
    if (_isStm && (!form.stm_status || !(form.stm_remarks || '').trim())) {
      setErr('Pick an STM status and add remarks.'); return;
    }
    if (cpOnly && !form.channel_partner) { setErr('Channel Partner is required.'); return; }
    if (isNotQualified && !form.disqualify_reason) { setErr('Pick a reason for Not Qualified.'); return; }
    if (form.disqualify_reason === 'other' && !(form.disqualify_note || '').trim()) { setErr('Add a note for the Other reason.'); return; }
    if (showStm && form.stm_status === 'sv_done' && (!svOutcome || !svVisitedDate)) {
      setErr(isWalkIn
        ? 'A walk-in is a completed visit — pick how it went (Hot / Warm / Cold / Not Interested) and the visit date.'
        : 'Please pick a visit outcome and visit date.');
      return;
    }
    setSaving(true);
    const body = { name: form.name, phone: form.phone };
    if (form.alt_phone) body.alt_phone = form.alt_phone;
    if (form.email)     body.email     = form.email;
    if (form.project)   body.project   = form.project;
    if (form.source)    body.source    = form.source;
    if (form.channel_partner) body.channel_partner = form.channel_partner;
    if (form.city)            body.city          = form.city;
    if (form.address)         body.address       = form.address;
    if (form.purpose?.length) body.purpose       = form.purpose;
    if (form.budget_bucket)   body.budget_bucket = form.budget_bucket;
    if (form.lead_date)       body.lead_date     = form.lead_date;
    if (cpOnly) {
      // A Channel Partner lead is owned by whoever adds it by default — but a
      // CP Cluster Head can hand it straight to a CP Executive (Assign CP) or
      // a Sales-side person assigned to the project (Assign STM) instead, no
      // approval step.
      body.stm = (_isCpHead && form.stm) ? form.stm : user?.id;
    } else {
      if (_isAdminMgr && form.telecaller)         body.telecaller = form.telecaller;
      if ((_isAdminMgr || _isCpHead) && form.stm) body.stm        = form.stm;
    }
    if (showTC && form.telecaller_status)   body.telecaller_status  = form.telecaller_status;
    if (showTC && form.telecaller_remarks)  body.telecaller_remarks = form.telecaller_remarks;
    if (showStm && form.stm_status)         body.stm_status         = form.stm_status;
    if (showStm && form.stm_remarks)        body.stm_remarks        = form.stm_remarks;
    if (isNotQualified && form.disqualify_reason) {
      body.disqualify_reason = form.disqualify_reason;
      if (form.disqualify_reason === 'other') body.disqualify_note = form.disqualify_note;
    }

    const res = await fetch(SALES_ENDPOINTS.leads, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setSaving(false); setErr(data.detail || JSON.stringify(data)); return; }

    // A lead created directly at STM Status = sv_done needs the visit itself on
    // record too — same as marking a scheduled visit done, just with no prior
    // "scheduled" row to complete. Best-effort: the lead is already saved.
    if (showStm && form.stm_status === 'sv_done' && data?.id && svOutcome && svVisitedDate) {
      const now = new Date();
      const visitedAt = new Date(`${svVisitedDate}T00:00:00`);
      visitedAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
      const visitedIso = visitedAt.toISOString();
      try {
        await fetch(SALES_ENDPOINTS.siteVisits, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            lead: data.id, project: form.project || null,
            scheduled_at: visitedIso, visited_at: visitedIso, status: 'completed',
            stm: form.stm || user?.id,
            // data.telecaller (not form.telecaller) — when this Add Lead call merged
            // into an existing telecaller-held lead (same phone+project), the returned
            // record carries that telecaller, and their work should be credited with
            // this visit even though this form never showed a Telecaller field.
            referred_by_telecaller: data.telecaller || null,
            outcome: svOutcome, remarks: form.stm_remarks || '',
          }),
        });
      } catch { /* ignore */ }
    }

    // Schedule the first follow-up against the lead we just created. Best-effort: the
    // lead is already saved, so a failure here must not read as "lead not added".
    if (fuForm.scheduled_at && data?.id) {
      const assignedTo = fuForm.role_context === 'telecaller'
        ? (form.telecaller || user?.id)
        : (form.stm || user?.id);
      if (assignedTo) {
        try {
          await fetch(SALES_ENDPOINTS.followUps, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({
              lead: data.id, assigned_to: assignedTo, role_context: fuForm.role_context,
              scheduled_at: fuForm.scheduled_at, remarks: fuForm.remarks, status: 'pending',
            }),
          });
        } catch { /* ignore */ }
      }
    }

    setSaving(false);
    onAdded(data);
    onClose();
  }

  return (
    <div className="nx-modal-backdrop" style={overlay}>
      <div className="nx-modal" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, width: '90%', maxWidth: 520, boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Add Manual Lead</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Fill in the details to create a new lead</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></button>
        </div>

        <form onSubmit={submit} style={{ padding: '22px 24px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Contact Info */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Contact Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 18 }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Client name', required: true },
              { label: 'Phone',     key: 'phone', type: 'text', placeholder: '+91 99999 99999', required: true },
              { label: 'Alt. Phone', key: 'alt_phone', type: 'text', placeholder: 'Optional' },
              { label: 'Email',     key: 'email', type: 'email', placeholder: 'Optional' },
            ].map(({ label, key, type, placeholder, required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>
                  {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
                </label>
                <input className="nx-input" type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={addLbl}>Lead Received Date</label>
            <input className="nx-input" type="date" value={form.lead_date} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setForm({ ...form, lead_date: e.target.value });
                // A walk-in's visit happened the day they walked in.
                if (isWalkIn) setSvVisitedDate(e.target.value || new Date().toLocaleDateString('en-CA'));
              }}
              style={{ ...addInp, maxWidth: 220 }} />
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>Leave blank to use today. Set this if the lead actually came in earlier (e.g. a walk-in logged a day later).</p>
          </div>

          {/* Requirement */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Requirement</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
            <div>
              <label style={addLbl}>City</label>
              <select className="nx-input" value={cityOther ? 'Other' : (form.city || '')}
                onChange={(e) => { const v = e.target.value; if (v === 'Other') { setCityOther(true); setForm({ ...form, city: '' }); } else { setCityOther(false); setForm({ ...form, city: v }); } }}
                style={addSel}>
                <option value="">— Select —</option>
                {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
              {cityOther && (
                <input className="nx-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Enter city" style={{ ...addInp, marginTop: 8 }} />
              )}
            </div>
            <div>
              <label style={addLbl}>Budget</label>
              <select className="nx-input" value={form.budget_bucket || ''} onChange={(e) => setForm({ ...form, budget_bucket: e.target.value })} style={addSel}>
                <option value="">— Select —</option>
                {BUDGET_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={addLbl}>Address</label>
            <textarea className="nx-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address"
              style={{ ...addInp, height: 56, padding: '8px 12px', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={addLbl}>Purpose</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {PURPOSE_OPTIONS.map((p) => {
                const on = (form.purpose || []).includes(p.value);
                return (
                  <button className={`nx-btn nx-btn-md nx-toggle${on ? ' is-on' : ''}`} key={p.value} type="button"
                    onClick={() => setForm((f) => { const cur = Array.isArray(f.purpose) ? f.purpose : []; return { ...f, purpose: on ? cur.filter((x) => x !== p.value) : [...cur, p.value] }; })}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: on ? '1px solid var(--accent)' : '1px solid var(--border)', background: on ? 'var(--accent-softer)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)' }}>
                    {on ? <Icon name="check" /> : ''}{p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project & Source */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Assignment</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Project<span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <select className="nx-input" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}
                  style={{ width: '100%', height: 40, padding: '0 32px 0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)', appearance: 'none', cursor: 'pointer', color: form.project ? 'var(--text)' : 'var(--faint)' }}>
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--faint)', fontSize: 12 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Source<span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span></label>
              {cpOnly ? (
                <div style={{ ...addInp, display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600 }}>Channel Partner</div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select className="nx-input" value={form.source} onChange={(e) => {
                      const v = e.target.value;
                      const walkIn = /walk\s*-?\s*in/.test(srcName(v));
                      setForm((f) => ({ ...f, source: v, ...(walkIn && showStm ? { stm_status: 'sv_done' } : {}) }));
                      if (walkIn) setSvVisitedDate(form.lead_date || new Date().toLocaleDateString('en-CA'));
                    }}
                    style={{ width: '100%', height: 40, padding: '0 32px 0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)', appearance: 'none', cursor: 'pointer', color: form.source ? 'var(--text)' : 'var(--faint)', textTransform: 'capitalize' }}>
                    <option value="">Select source</option>
                    {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--faint)', fontSize: 12 }}>▾</span>
                </div>
              )}
            </div>
            {cpOnly && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Channel Partner Name<span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span></label>
                <ChannelPartnerPicker
                  value={form.channel_partner}
                  onChange={(id) => setForm({ ...form, channel_partner: id })}
                  options={channelPartners}
                  inputStyle={addInp}
                />
              </div>
            )}
          </div>

          {dupMatch && (
            <div className="nx-callout-info">
              {dupMatch.sameProject ? (
                <>Already a lead here: <b>{dupMatch.name}</b> · {dupMatch.status}{dupMatch.telecaller_name ? ` · TC: ${dupMatch.telecaller_name}` : ''}{dupMatch.stm_name ? ` · ${dupMatch.is_cp ? 'CP' : 'STM'}: ${dupMatch.stm_name}` : ''}. Adding this will update that lead, not create a new one.</>
              ) : (
                <>This number already has a lead in <b>{dupMatch.project_name || 'another project'}</b>{dupMatch.telecaller_name || dupMatch.stm_name ? ` (${dupMatch.telecaller_name || dupMatch.stm_name})` : ''}. A separate lead will be created for this project instead.</>
              )}
            </div>
          )}

          {/* Telecaller (Pre-Sales) — a Channel Partner lead skips telecaller calling
              entirely: it goes straight into the STM pipeline. */}
          {showTC && !cpOnly && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Telecaller (Pre-Sales)</div>
              {_isAdminMgr && (
                <div style={{ marginBottom: 12 }}>
                  <label style={addLbl}>Assign Telecaller</label>
                  <select className="nx-input" value={form.telecaller} onChange={(e) => setForm({ ...form, telecaller: e.target.value })} style={addSel}>
                    <option value="">— None —</option>
                    {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={addLbl}>TC Status{_isTelecaller &&  <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <select className="nx-input" value={form.telecaller_status} onChange={(e) => setForm({ ...form, telecaller_status: e.target.value })} style={addSel}>
                  <option value="">— None —</option>
                  {TC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {form.telecaller_status === 'not_qualified' && (
                <NotQualifiedFields reason={form.disqualify_reason} note={form.disqualify_note}
                  onReason={(v) => setForm({ ...form, disqualify_reason: v })} onNote={(v) => setForm({ ...form, disqualify_note: v })}
                  lblStyle={addLbl} selStyle={addSel} taStyle={addTa} />
              )}
              <div style={{ marginBottom: 18 }}>
                <label style={addLbl}>TC Remarks{_isTelecaller &&  <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <textarea className="nx-input" value={form.telecaller_remarks} onChange={(e) => setForm({ ...form, telecaller_remarks: e.target.value })} placeholder={_isTelecaller ? 'What was discussed' : 'Optional'} style={addTa} />
              </div>
            </>
          )}

          {/* STM (Sales) — labelled CP for Channel Partners (same underlying field) */}
          {showStm && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>{cpOnly ? 'Status' : _isCp ? 'CP (Channel Partner)' : 'STM (Sales)'}</div>
              {/* A Channel Partner lead is automatically owned by whoever adds it —
                  no telecaller/STM assignment step, unlike a regular lead. */}
              {cpOnly && (
                <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 12 }}>Assigned to you ({user?.name}) automatically.</p>
              )}
              {_isAdminMgr && !cpOnly && (
                <div style={{ marginBottom: 12 }}>
                  <label style={addLbl}>Assign STM</label>
                  <select className="nx-input" value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={addSel}>
                    <option value="">— None —</option>
                    {stms.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                </div>
              )}
              {cpOnly && (_isCpHead || _isAdminMgr) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={addLbl}>Assign CP</label>
                  <select className="nx-input" value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={addSel}>
                    <option value="">— None —</option>
                    {cps.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                </div>
              )}
              {cpOnly && (_isCpHead || _isAdminMgr) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={addLbl}>Assign STM</label>
                  <select className="nx-input" value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={addSel}>
                    <option value="">— None —</option>
                    {salesCpUsers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>Users assigned to this project. Assigns directly — no approval step.</p>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={addLbl}>{cpOnly ? 'Lead Status' : _isCp ? 'CP Status' : 'STM Status'}{_isStm && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <select className="nx-input" value={form.stm_status} onChange={(e) => setForm({ ...form, stm_status: e.target.value })} style={addSel}>
                  <option value="">— None —</option>
                  {STM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {form.stm_status === 'not_qualified' && (
                <NotQualifiedFields reason={form.disqualify_reason} note={form.disqualify_note}
                  onReason={(v) => setForm({ ...form, disqualify_reason: v })} onNote={(v) => setForm({ ...form, disqualify_note: v })}
                  lblStyle={addLbl} selStyle={addSel} taStyle={addTa} />
              )}
              <div style={{ marginBottom: 18 }}>
                <label style={addLbl}>{cpOnly ? 'Lead Remarks' : _isCp ? 'CP Remarks' : 'STM Remarks'}{_isStm && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <textarea className="nx-input" value={form.stm_remarks} onChange={(e) => setForm({ ...form, stm_remarks: e.target.value })} placeholder={_isStm ? 'What was discussed' : 'Optional'} style={addTa} />
              </div>

              {/* A lead added directly at sv_done needs its visit outcome recorded too —
                  same panel as the Lead Detail modal's inline "Visit Outcome". */}
              {form.stm_status === 'sv_done' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ color: 'var(--success)' }}><Icon name="pin" /></span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Visit Outcome <span style={{ color: 'var(--danger)' }}>*</span></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[['hot', 'Hot', 'var(--danger)'], ['warm', 'Warm', 'var(--warning-2)'], ['cold', 'Cold', 'var(--accent)'], ['not_interested', 'Not Interested', 'var(--text-3)']].map(([val, label, color]) => {
                      const active = svOutcome === val;
                      return (
                        <button className={`nx-btn nx-btn-md nx-toggle${active ? ' is-on' : ''}`} key={val} type="button" onClick={() => setSvOutcome(val)}
                          style={{ flex: '1 1 100px', padding: '10px 8px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${color}`, background: active ? color : 'var(--surface)', color: active ? '#fff' : color }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...addLbl, color: 'var(--success)' }}>Visit Date *</label>
                    <input className="nx-input" type="date" value={svVisitedDate} max={new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setSvVisitedDate(e.target.value)} style={addInp} />
                  </div>
                  {!svOutcome && <p style={{ fontSize: 11, color: 'var(--success)', margin: '8px 0 0' }}>
                    {isWalkIn
                      ? 'Walk-in — the visit already happened, so an outcome is required.'
                      : 'Pick how the visit went — recorded on the site visit.'}
                  </p>}
                </div>
              )}
            </>
          )}

          {/* ── FOLLOW-UPS ── mirrors the Lead Detail modal's inline scheduler */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Follow-ups</div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 16, border: '1px solid var(--surface-3)', marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Schedule Follow-up</div>
            <div style={{ display: 'grid', gridTemplateColumns: (_isAdminMgr && !cpOnly) ? '1fr 1fr' : '1fr', gap: '10px 14px', marginBottom: 10 }}>
              {/* Role picker only for admins/managers — telecaller/STM portals auto-set
                  their own role, and a Channel Partner lead has no telecaller stage
                  at all so it's always scheduled against the STM/CP role. */}
              {_isAdminMgr && !cpOnly && (
                <div>
                  <label style={addLbl}>Role</label>
                  <select className="nx-input" value={fuForm.role_context} onChange={(e) => setFuForm({ ...fuForm, role_context: e.target.value })} style={addSel}>
                    <option value="telecaller">Telecaller</option>
                    <option value="stm">STM</option>
                  </select>
                </div>
              )}
              <div>
                <label style={addLbl}>Date &amp; Time</label>
                <input className="nx-input" type="datetime-local" value={fuForm.scheduled_at}
                  onChange={(e) => setFuForm({ ...fuForm, scheduled_at: e.target.value })} style={addInp} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={addLbl}>Remarks</label>
              <textarea className="nx-input" value={fuForm.remarks} onChange={(e) => setFuForm({ ...fuForm, remarks: e.target.value })}
                placeholder="Call notes, instructions…" rows={2} style={addTa} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>Optional — pick a date &amp; time and it's scheduled when you click Add Lead below.</p>
          </div>

          {err && (
            <div style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 8, padding: '9px 12px', marginBottom: 16, fontSize: 12, color: 'var(--danger)' }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="nx-btn nx-btn-md nx-btn-secondary" type="button" onClick={onClose}
              style={{ padding: '10px 20px', backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button className="nx-btn nx-btn-md nx-btn-primary" type="submit" disabled={saving}
              style={{ padding: '10px 24px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 100 }}>
              {saving ? 'Adding…' : '+ Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Detail Modal ───────────────────────────────────────────────────────
const HISTORY_LABEL = {
  created:            'Lead Created',
  status:             'Overall Status',
  telecaller_status:  'TC Status',
  stm_status:         'STM Status',
  telecaller_remarks: 'TC Remarks',
  stm_remarks:        'STM Remarks',
  telecaller:         'Telecaller Assigned',
  stm:                'STM Assigned',
  warm_transfer:      'Transferred to STM',
  site_visit:         'Site Visit',
  closure:            'Closure',
};
const HISTORY_COLOR = {
  created:            'var(--text-3)',
  status:             'var(--accent)',
  telecaller_status:  'var(--success)',
  stm_status:         'var(--warning-2)',
  telecaller_remarks: 'var(--success)',
  stm_remarks:        'var(--warning-2)',
  telecaller:         'var(--accent-deep)',
  stm:                'var(--success)',
  warm_transfer:      'var(--danger)',
  site_visit:         'var(--warning-2)',
  closure:            'var(--success)',
};

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function LeadDetailModal({ lead, projects, sources, telecallers, stms, cpOnly = false, channelPartners = [], onClose, onUpdated }) {
  const router = useRouter();
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  // Only admins/managers may (re)assign telecaller / STM. Telecaller & Sales Executive
  // portals can update status & remarks but cannot reassign leads.
  const _desig = (user?.designation || '').toLowerCase();
  const _isTelecaller = can(user, 'sales.pipeline.telecalling');
  const _isStm = can(user, 'sales.pipeline.stm');
  const _isCpHead = _desig.includes('cp cluster head');
  const _isCp  = can(user, 'sales.pipeline.cp') || _isCpHead;
  const canAssign = !(_isTelecaller || _isStm || _isCp);
  // Telecallers see only the Telecaller (TC) section; STMs / CPs (exec + cluster
  // head) see only the STM/CP section. Admins/managers see both.
  const showTC  = canAssign || _isTelecaller;
  const showStm = canAssign || _isStm || _isCp;
  const [activeTab, setActiveTab] = useState('detail');
  const [detail,    setDetail]    = useState(null);
  const [form, setForm] = useState({});
  const [cityOther, setCityOther] = useState(false);  // City = "Other" → free-text box
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState('');   // required-field validation message
  // "Assign STM" list is scoped to the lead's currently selected project — an
  // STM assigned to specific projects (Team Users → Assign) only shows for
  // those; refetch whenever the project selection changes.
  const [salesCpUsers, setSalesCpUsers] = useState([]);
  const salesCpReqId = useRef(0);
  useEffect(() => {
    if (!cpOnly || !(_isCpHead || canAssign)) return;
    // form starts as {} and gets seeded with the real project a moment later
    // (see the lead-seeding effect below), so an earlier (unscoped) request
    // can resolve AFTER the later (project-scoped) one and clobber it back to
    // the unfiltered list — guard by request order.
    const reqId = ++salesCpReqId.current;
    const cq = (companyId ? `&company_id=${companyId}` : '') + (form.project ? `&project_id=${form.project}` : '');
    fetch(SALES_ENDPOINTS.salesCpUsers + cq, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { if (reqId === salesCpReqId.current) setSalesCpUsers(Array.isArray(d) ? d : []); })
      .catch(() => { if (reqId === salesCpReqId.current) setSalesCpUsers([]); });
  }, [cpOnly, _isCpHead, canAssign, companyId, form.project]);

  // Followup form
  const [fuForm,    setFuForm]    = useState({ role_context: (_isStm || cpOnly) ? 'stm' : 'telecaller', scheduled_at: '', remarks: '' });
  // Inline "schedule site visit" when STM sets status = sv_scheduled
  const [svScheduledAt, setSvScheduledAt] = useState('');
  const [svRemarks,     setSvRemarks]     = useState('');
  // Inline visit outcome when STM sets status = sv_done — recorded on the
  // auto-created/completed SiteVisit, same as the dedicated Site Visits "Mark
  // Done" flow. Does not change the lead's own stm_status (stays "sv done").
  const [svOutcome, setSvOutcome] = useState('');
  const [svVisitedDate, setSvVisitedDate] = useState('');

  useEffect(() => {
    setForm({
      name: lead.name || '', alt_phone: lead.alt_phone || '', email: lead.email || '',
      status: lead.status,
      telecaller: lead.telecaller || '', telecaller_status: lead.telecaller_status || '',
      telecaller_remarks: lead.telecaller_remarks || '',
      stm: lead.stm || '', stm_status: lead.stm_status || '', stm_remarks: lead.stm_remarks || '',
      disqualify_reason: lead.disqualify_reason || '', disqualify_note: lead.disqualify_note || '',
      project: lead.project || '', source: lead.source || '', channel_partner: lead.channel_partner || '',
      // City/Address/Purpose/Budget now ship in the list payload → prefill instantly,
      // no waiting on the detail fetch.
      city: lead.city || '', address: lead.address || '',
      purpose: Array.isArray(lead.purpose) ? lead.purpose : [],
      budget_bucket: lead.budget_bucket || '',
    });
    setCityOther(!!lead.city && !CITY_OPTIONS.includes(lead.city));
    setActiveTab('detail');
    setDetail(null);
    setSvScheduledAt('');
    setSvRemarks('');
    // A lead already at sv_done carries its visit's outcome on the list row
    // (LeadListView annotates it) — prefill instantly instead of forcing a
    // re-pick every time the lead is reopened; the exact visit date is refined
    // below once the full site-visit record arrives.
    setSvOutcome(lead.stm_status === 'sv_done' ? (lead.sv_outcome || '') : '');
    const defaultVisitedDate = new Date().toLocaleDateString('en-CA');
    setSvVisitedDate(defaultVisitedDate);
    async function loadDetail() {
      const res = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
      // The list row this form was seeded from can be stale (fetched before someone
      // else's later update) — every save resends `status`/`stm_status`/`telecaller_status`
      // regardless of whether they were touched, so a stale value silently regresses a
      // status another user already advanced (e.g. STM sets warm, then an unrelated
      // resave reverts it to warm_transferred). Once the authoritative record arrives,
      // correct any of these three the user hasn't already started editing.
      setForm((f) => ({
        ...f,
        status: f.status === lead.status ? data.status : f.status,
        stm_status: f.stm_status === (lead.stm_status || '') ? (data.stm_status || '') : f.stm_status,
        telecaller_status: f.telecaller_status === (lead.telecaller_status || '') ? (data.telecaller_status || '') : f.telecaller_status,
      }));
      // Refine the sv_done prefill with the actual latest completed visit — its real
      // outcome and the date it happened on, rather than just today's date.
      if (data.stm_status === 'sv_done') {
        const latestSv = (data.site_visits || [])
          .filter((v) => v.status === 'completed' && v.visited_at)
          .sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))[0];
        if (latestSv) {
          setSvOutcome((cur) => cur || latestSv.outcome || '');
          const realDate = new Date(latestSv.visited_at).toLocaleDateString('en-CA');
          setSvVisitedDate((cur) => (cur === defaultVisitedDate ? realDate : cur));
        }
      }
    }
    loadDetail();
  }, [lead?.id]);

  const isNotQualified = form.telecaller_status === 'not_qualified' || form.stm_status === 'not_qualified';

  async function save() {
    // Telecaller / STM portals must record their status + remarks before saving.
    if (_isTelecaller && (!form.telecaller_status || !(form.telecaller_remarks || '').trim())) {
      setSaveErr('Please set TC Status and add TC Remarks before saving.'); return;
    }
    if (_isStm && (!form.stm_status || !(form.stm_remarks || '').trim())) {
      setSaveErr('Please set STM Status and add STM Remarks before saving.'); return;
    }
    if (isNotQualified && !form.disqualify_reason) {
      setSaveErr('Pick a reason for Not Qualified.'); return;
    }
    if (form.disqualify_reason === 'other' && !(form.disqualify_note || '').trim()) {
      setSaveErr('Add a note for the Other reason.'); return;
    }
    if (form.stm_status === 'sv_done' && (!svOutcome || !svVisitedDate)) {
      setSaveErr('Please pick a visit outcome and visit date.'); return;
    }
    setSaveErr('');
    setSaving(true);
    if (cpOnly && !form.channel_partner) { setSaveErr('Channel Partner is required.'); setSaving(false); return; }
    const body = {
      status: form.status,
      alt_phone: form.alt_phone || '',
      email: form.email || '',
      telecaller_remarks: form.telecaller_remarks,
      stm_remarks: form.stm_remarks,
      city: form.city || '',
      address: form.address || '',
      purpose: form.purpose || [],
      budget_bucket: form.budget_bucket || '',
    };
    if (form.name)             body.name             = form.name;
    if (form.telecaller)       body.telecaller       = form.telecaller;
    if (form.telecaller_status)body.telecaller_status= form.telecaller_status;
    if (form.stm)              body.stm              = form.stm;
    // "closed" is NOT persisted from the dropdown — a lead only becomes CLOSED when
    // its booking is approved (the backend sets stm_status='closed' on approval).
    // Picking "closed" here just routes the STM into the booking flow below.
    if (form.stm_status && form.stm_status !== 'closed') body.stm_status = form.stm_status;
    if (isNotQualified && form.disqualify_reason) {
      body.disqualify_reason = form.disqualify_reason;
      body.disqualify_note = form.disqualify_reason === 'other' ? (form.disqualify_note || '') : '';
    }
    if (form.project)          body.project          = form.project;
    if (form.source)           body.source           = form.source;
    if (cpOnly)                body.channel_partner  = form.channel_partner;
    const res = await fetch(SALES_ENDPOINTS.lead(lead.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
      let updated = null;
      try { updated = await res.json(); } catch { /* ignore */ }

      // Auto-create a follow-up if one was filled in the inline Schedule Follow-up form.
      if (fuForm.scheduled_at) {
        const assignedTo = fuForm.role_context === 'telecaller'
          ? (form.telecaller || user?.id)
          : (form.stm || user?.id);
        if (assignedTo) {
          try {
            await fetch(SALES_ENDPOINTS.followUps, {
              method: 'POST', headers: authHeaders(),
              body: JSON.stringify({
                lead: lead.id, assigned_to: assignedTo, role_context: fuForm.role_context,
                scheduled_at: fuForm.scheduled_at, remarks: fuForm.remarks, status: 'pending',
              }),
            });
          } catch { /* ignore */ }
        }
      }

      // Only act on an ACTUAL transition into sv_scheduled/sv_done this save — otherwise
      // resaving an already sv_done lead (e.g. just to update remarks) re-ran this block
      // every time and created a fresh duplicate "completed" site visit each time.
      const stmStatusChanged = lead.stm_status !== form.stm_status;

      // STM scheduled a visit → auto-create the site-visit entry
      if (stmStatusChanged && form.stm_status === 'sv_scheduled' && svScheduledAt) {
        try {
          await fetch(SALES_ENDPOINTS.siteVisits, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({
              lead: lead.id, project: form.project || null,
              scheduled_at: new Date(svScheduledAt).toISOString(),
              status: 'scheduled', stm: form.stm || user?.id,
              referred_by_telecaller: form.telecaller || null,
              remarks: svRemarks || '',
            }),
          });
        } catch { /* ignore */ }
      }

      // STM marked sv_done → complete the latest pending visit (or create a completed one)
      if (stmStatusChanged && form.stm_status === 'sv_done') {
        try {
          const svRes = await fetch(`${SALES_ENDPOINTS.siteVisits}?lead_id=${lead.id}`, { headers: authHeaders() });
          const list = svRes.ok ? await svRes.json() : [];
          const pending = (Array.isArray(list) ? list : []).filter(v => v.status === 'scheduled')
            .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0];
          // Keeps the current time-of-day but lets the date itself be backdated to
          // when the visit actually happened.
          const visitedNow = new Date();
          const visitedAt = new Date(`${svVisitedDate}T00:00:00`);
          visitedAt.setHours(visitedNow.getHours(), visitedNow.getMinutes(), visitedNow.getSeconds(), 0);
          const visitedIso = visitedAt.toISOString();
          if (pending) {
            await fetch(SALES_ENDPOINTS.siteVisit(pending.id), {
              method: 'PATCH', headers: authHeaders(),
              body: JSON.stringify({ status: 'completed', visited_at: visitedIso, outcome: svOutcome, remarks: form.stm_remarks || '' }),
            });
          } else {
            await fetch(SALES_ENDPOINTS.siteVisits, {
              method: 'POST', headers: authHeaders(),
              body: JSON.stringify({
                lead: lead.id, project: form.project || null,
                scheduled_at: visitedIso, visited_at: visitedIso, status: 'completed',
                stm: form.stm || user?.id, referred_by_telecaller: form.telecaller || null,
                outcome: svOutcome, remarks: form.stm_remarks || '',
              }),
            });
          }
        } catch { /* ignore */ }
      }

      // STM/CP marked closed → save the lead, then jump straight into the booking
      // flow with this lead prefilled. The unit map lets them pick plot(s) and the
      // booking form records the actual closure/booking. A CP lead routes into the
      // CP module's own closure/[id] route (not plain /sales/closure) so a CP
      // manager stays inside their module instead of getting bounced back to the
      // CP dashboard by the module boundary guard in sales/layout.js.
      if (form.stm_status === 'closed') {
        try {
          sessionStorage.setItem('closure_sv', JSON.stringify({
            lead: lead.id, lead_name: form.name || lead.name, lead_phone: lead.phone || '',
            project: form.project || null,
          }));
        } catch { /* ignore */ }
        setSaving(false);
        onUpdated(updated);
        onClose();
        const closureBase = cpOnly ? '/m/cp/closure' : '/sales/closure';
        router.push(form.project ? `${closureBase}/${form.project}` : closureBase);
        return;
      }

      setSaving(false);
      onUpdated(updated);
      onClose();
    } else {
      setSaving(false);
    }
  }

  async function markFollowupDone(fuId) {
    const res = await fetch(SALES_ENDPOINTS.followUp(fuId), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDetail(d => ({ ...d, follow_ups: d.follow_ups.map(f => f.id === fuId ? updated : f) }));
    }
  }

  const TC_STATUSES  = ['warm','cold','not_interested','not_reachable','callback','not_qualified'];
  const STM_STATUSES = ['hot','warm','cold','not_interested','sv_scheduled','sv_done','closed','not_qualified'];

  const tabStyle = (key) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: 'none', borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
    color: activeTab === key ? 'var(--accent)' : 'var(--muted)',
  });

  const fuStatusColor = { pending: 'var(--warning-2)', completed: 'var(--success)', missed: 'var(--danger)', rescheduled: 'var(--success)' };

  const mInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)' };
  const mSel = { ...mInp, cursor: 'pointer' };
  const mTa  = { ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' };
  const mLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
  const mSec = { fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 };

  return (
    <div className="nx-modal-backdrop" style={overlay}>
      <div className="nx-modal" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, width: '92%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)', overflow: 'hidden' }}>
        {/* Gradient Header */}
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: 8 }}>
              {lead.name}
              {lead.is_duplicate && <span style={{ fontSize: 9, fontWeight: 800, backgroundColor: 'var(--danger-solid)', color: '#fff', padding: '2px 7px', borderRadius: 6 }}><Icon name="alert" /> DUP</span>}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-2)', flexShrink: 0, backgroundColor: 'var(--accent-softer)' }}>
          {[['detail','Detail'],['history','History']].map(([k,label]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={tabStyle(k)}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* ── DETAIL TAB ── */}
          {activeTab === 'detail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* Contact Info */}
              <div style={mSec}>Contact Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                <div>
                  <label style={mLbl}>Name</label>
                  <input className="nx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={mInp}
                    onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                </div>
                <div>
                  <label style={mLbl}>Alternate Phone</label>
                  <input className="nx-input" value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} style={mInp} placeholder="Alt. number"
                    onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                </div>
                <div>
                  <label style={mLbl}>Email</label>
                  <input className="nx-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={mInp} placeholder="Optional"
                    onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                </div>
              </div>

              {/* Requirement */}
              <div style={mSec}>Requirement</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <div>
                  <label style={mLbl}>City</label>
                  <select className="nx-input"
                    value={cityOther ? 'Other' : (form.city || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'Other') { setCityOther(true); setForm((f) => ({ ...f, city: '' })); }
                      else { setCityOther(false); setForm((f) => ({ ...f, city: v })); }
                    }}
                    style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— Select —</option>
                    {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                  {cityOther && (
                    <input className="nx-input" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })}
                      style={{ ...mInp, marginTop: 8 }} placeholder="Enter city"
                      onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                  )}
                </div>
                <div>
                  <label style={mLbl}>Budget</label>
                  <select className="nx-input" value={form.budget_bucket || ''} onChange={(e) => setForm({ ...form, budget_bucket: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— Select —</option>
                    {BUDGET_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={mLbl}>Address</label>
                <textarea className="nx-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ ...mInp, minHeight: 56, resize: 'vertical' }} placeholder="Address"
                  onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={mLbl}>Purpose</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {PURPOSE_OPTIONS.map((p) => {
                    const on = (form.purpose || []).includes(p.value);
                    return (
                      <button className={`nx-btn nx-btn-md nx-toggle${on ? ' is-on' : ''}`} key={p.value} type="button"
                        onClick={() => setForm((f) => {
                          const cur = Array.isArray(f.purpose) ? f.purpose : [];
                          return { ...f, purpose: on ? cur.filter((x) => x !== p.value) : [...cur, p.value] };
                        })}
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: on ? 'var(--accent-softer)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)',
                        }}>
                        {on ? <Icon name="check" /> : ''}{p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment */}
              <div style={mSec}>Assignment</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                <div>
                  <label style={mLbl}>Overall Status</label>
                  {canAssign ? (
                    <select className="nx-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  ) : (
                    // Auto-derived from the workflow — read-only for telecallers / STMs.
                    <div style={{ ...mInp, display: 'flex', alignItems: 'center', background: 'var(--surface-2)', color: 'var(--text)', textTransform: 'capitalize' }}>
                      {(form.status || '—').replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                <div>
                  <label style={mLbl}>Project</label>
                  <select className="nx-input" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">—</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {cpOnly && (
                  <div>
                    <label style={mLbl}>Source</label>
                    <div style={{ ...mInp, display: 'flex', alignItems: 'center', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 600 }}>Channel Partner</div>
                  </div>
                )}
                {cpOnly && (
                  <div>
                    <label style={mLbl}>Channel Partner Name<span style={{ color: 'var(--danger)' }}>*</span></label>
                    <ChannelPartnerPicker
                      value={form.channel_partner}
                      onChange={(id) => setForm({ ...form, channel_partner: id })}
                      options={channelPartners}
                      inputStyle={mInp}
                    />
                  </div>
                )}
              </div>

              {/* Telecaller — a Channel Partner lead skips telecaller calling entirely,
                  so this whole section (read-only summary included) never applies. */}
              {/* Read-only for STM/CP once the lead reaches them — they can't edit TC
                  fields, but they should be able to see what the telecaller found out. */}
              {!showTC && !cpOnly && (lead.telecaller_name || lead.telecaller_remarks) && (
                <div style={{ ...mSec, marginBottom: 6 }}>Telecaller (Pre-Sales)</div>
              )}
              {!showTC && !cpOnly && (lead.telecaller_name || lead.telecaller_remarks) && (
                <div style={{ marginBottom: 18, padding: 12, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--surface-3)' }}>
                  {lead.telecaller_name && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Telecaller: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{lead.telecaller_name}</span>{lead.telecaller_status ? ` · ${lead.telecaller_status.replace(/_/g, ' ')}` : ''}</p>
                  )}
                  {lead.telecaller_remarks && (
                    <p style={{ fontSize: 13, color: 'var(--text)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{lead.telecaller_remarks}</p>
                  )}
                </div>
              )}
              {showTC && !cpOnly && (<>
              <div style={mSec}>Telecaller (Pre-Sales)</div>
              <div style={{ display: 'grid', gridTemplateColumns: canAssign ? '1fr 1fr' : '1fr', gap: '12px 16px', marginBottom: 12 }}>
                {canAssign && (
                <div>
                  <label style={mLbl}>Assign Telecaller</label>
                  <select className="nx-input" value={form.telecaller} onChange={(e) => setForm({ ...form, telecaller: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                </div>
                )}
                <div>
                  <label style={mLbl}>TC Status {_isTelecaller && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                  <select className="nx-input" value={form.telecaller_status} onChange={(e) => setForm({ ...form, telecaller_status: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {TC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {form.telecaller_status === 'not_qualified' && (
                <NotQualifiedFields reason={form.disqualify_reason} note={form.disqualify_note}
                  onReason={(v) => setForm({ ...form, disqualify_reason: v })} onNote={(v) => setForm({ ...form, disqualify_note: v })}
                  lblStyle={mLbl} selStyle={mSel} taStyle={mTa} />
              )}
              <div style={{ marginBottom: 18 }}>
                <label style={mLbl}>TC Remarks {_isTelecaller && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <textarea className="nx-input" value={form.telecaller_remarks} onChange={(e) => setForm({ ...form, telecaller_remarks: e.target.value })}
                  rows={2} style={{ ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
              </div>
              </>)}

              {/* STM — labelled CP for Channel Partners (same underlying field) */}
              {showStm && (<>
              <div style={mSec}>{cpOnly ? 'Status' : _isCp ? 'CP (Channel Partner)' : 'STM (Sales)'}</div>
              {/* A Channel Partner lead is owned by whoever added it — no reassignment
                  step, unlike a regular lead. */}
              {cpOnly && (
                <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 12 }}>Assigned to {lead.stm_name || 'you'} automatically.</p>
              )}
              {cpOnly && (_isCpHead || canAssign) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={mLbl}>Assign STM</label>
                  <select className="nx-input" value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {salesCpUsers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>Users assigned to this project. Assigns directly — no approval step.</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: (canAssign && !cpOnly) ? '1fr 1fr' : '1fr', gap: '12px 16px', marginBottom: 12 }}>
                {canAssign && !cpOnly && (
                <div>
                  <label style={mLbl}>Assign STM</label>
                  <select className="nx-input" value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {stms.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
                  </select>
                </div>
                )}
                <div>
                  <label style={mLbl}>{cpOnly ? 'Lead Status' : _isCp ? 'CP Status' : 'STM Status'} {_isStm && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                  <select className="nx-input" value={form.stm_status} onChange={(e) => setForm({ ...form, stm_status: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                    <option value="">— None —</option>
                    {STM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {form.stm_status === 'not_qualified' && (
                <NotQualifiedFields reason={form.disqualify_reason} note={form.disqualify_note}
                  onReason={(v) => setForm({ ...form, disqualify_reason: v })} onNote={(v) => setForm({ ...form, disqualify_note: v })}
                  lblStyle={mLbl} selStyle={mSel} taStyle={mTa} />
              )}
              <div style={{ marginBottom: 18 }}>
                <label style={mLbl}>{cpOnly ? 'Lead Remarks' : _isCp ? 'CP Remarks' : 'STM Remarks'} {_isStm && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <textarea className="nx-input" value={form.stm_remarks} onChange={(e) => setForm({ ...form, stm_remarks: e.target.value })}
                  rows={2} style={{ ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
              </div>

              {/* Inline site-visit scheduling when STM picks "sv_scheduled" */}
              {form.stm_status === 'sv_scheduled' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ color: 'var(--success)' }}><Icon name="pin" /></span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Schedule Site Visit</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                    <div>
                      <label style={{ ...mLbl, color: 'var(--success)' }}>Date &amp; Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input className="nx-input" type="datetime-local" value={svScheduledAt} onChange={(e) => setSvScheduledAt(e.target.value)} style={mInp} />
                    </div>
                    <div>
                      <label style={{ ...mLbl, color: 'var(--success)' }}>Visit Remarks</label>
                      <input className="nx-input" value={svRemarks} onChange={(e) => setSvRemarks(e.target.value)} placeholder="Location, notes…" style={mInp} />
                    </div>
                  </div>
                  {!svScheduledAt && <p style={{ fontSize: 11, color: 'var(--success)', margin: '8px 0 0' }}>Set a date &amp; time to create a site visit entry automatically on save.</p>}
                </div>
              )}

              {/* Inline visit outcome when STM picks "sv_done" — recorded on the
                  SiteVisit itself (rolls into the SV Hot/Warm/Cold dashboard tiles),
                  same as the dedicated Site Visits "Mark Done" flow. The lead's own
                  STM Status stays "sv done". Uses STM Remarks above as the visit's
                  remarks — no separate field needed since it's already required. */}
              {form.stm_status === 'sv_done' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ color: 'var(--success)' }}><Icon name="pin" /></span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Visit Outcome <span style={{ color: 'var(--danger)' }}>*</span></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[['hot', 'Hot', 'var(--danger)'], ['warm', 'Warm', 'var(--warning-2)'], ['cold', 'Cold', 'var(--accent)'], ['not_interested', 'Not Interested', 'var(--text-3)']].map(([val, label, color]) => {
                      const active = svOutcome === val;
                      return (
                        <button className={`nx-btn nx-btn-md nx-toggle${active ? ' is-on' : ''}`} key={val} type="button" onClick={() => setSvOutcome(val)}
                          style={{ flex: '1 1 100px', padding: '10px 8px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${color}`, background: active ? color : 'var(--surface)', color: active ? '#fff' : color }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...mLbl, color: 'var(--success)' }}>Visit Date *</label>
                    <input className="nx-input" type="date" value={svVisitedDate} max={new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setSvVisitedDate(e.target.value)} style={mInp} />
                  </div>
                  {!svOutcome && <p style={{ fontSize: 11, color: 'var(--success)', margin: '8px 0 0' }}>Pick how the visit went — recorded on the site visit.</p>}
                </div>
              )}

              {/* STM picked "closed" → the footer button becomes "Record Closure"
                  and on save jumps into the booking flow with this lead prefilled. */}
              {form.stm_status === 'closed' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--success)' }}><Icon name="check-circle" /></span>
                  <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                    Saving takes you to the booking flow — pick the plot(s) and record the booking for this lead.
                  </span>
                </div>
              )}
              </>)}

              {(lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name) && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px', marginBottom: 18 }}>
                  <div style={mSec}>Meta Ads Info</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lead.meta_campaign_name && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', minWidth: 72 }}>CAMPAIGN</span><span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{lead.meta_campaign_name}</span></div>}
                    {lead.meta_adset_name    && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', minWidth: 72 }}>AD SET</span><span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{lead.meta_adset_name}</span></div>}
                    {lead.meta_ad_name       && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', minWidth: 72 }}>AD NAME</span><span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{lead.meta_ad_name}</span></div>}
                  </div>
                </div>
              )}

              {/* ── FOLLOW-UPS (inline in Detail, above the Save bar) ── */}
              <div style={{ borderTop: '1px solid var(--surface-2)', margin: '4px 0 0', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={mSec}>Follow-ups</div>
                {/* Add new followup */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 16, border: '1px solid var(--surface-3)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Schedule Follow-up</div>
                  <div style={{ display: 'grid', gridTemplateColumns: (canAssign && !cpOnly) ? '1fr 1fr' : '1fr', gap: '10px 14px', marginBottom: 10 }}>
                    {/* Role picker only for admins/managers — telecaller/STM portals auto-set
                        their own role, and a Channel Partner lead has no telecaller stage. */}
                    {canAssign && !cpOnly && (
                      <div>
                        <label style={mLbl}>Role</label>
                        <select className="nx-input" value={fuForm.role_context} onChange={(e) => setFuForm({ ...fuForm, role_context: e.target.value })} style={{ ...mInp, cursor: 'pointer' }}>
                          <option value="telecaller">Telecaller</option>
                          <option value="stm">STM</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={mLbl}>Date & Time</label>
                      <input className="nx-input" type="datetime-local" value={fuForm.scheduled_at}
                        onChange={(e) => setFuForm({ ...fuForm, scheduled_at: e.target.value })} style={mInp} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={mLbl}>Remarks</label>
                    <textarea className="nx-input" value={fuForm.remarks} onChange={(e) => setFuForm({ ...fuForm, remarks: e.target.value })}
                      placeholder="Call notes, instructions…" rows={2}
                      style={{ ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>Pick a date &amp; time and it's added when you click Save Changes below.</p>
                </div>

                {/* Existing followups */}
                {!detail && <Loader variant="inline" size="sm" label="Loading…" />}
                {detail?.follow_ups?.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>No follow-ups scheduled yet.</p>
                )}
                {detail?.follow_ups?.map((fu) => (
                  <div key={fu.id} style={{ border: '1.5px solid var(--surface-3)', borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                          color: fu.role_context === 'stm' ? 'var(--warning-2)' : 'var(--success)' }}>
                          {fu.role_context?.toUpperCase()}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 14,
                          backgroundColor: `color-mix(in srgb, ${(fuStatusColor[fu.status] || 'var(--muted-solid)')} 9%, transparent)`,
                          color: fuStatusColor[fu.status] || 'var(--muted)' }}>
                          {fu.status}
                        </span>
                      </div>
                      {fu.status === 'pending' && (
                        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => markFollowupDone(fu.id)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, border: '1.5px solid var(--success)', color: 'var(--success)', background: 'var(--surface)', cursor: 'pointer' }}>
                          Mark Done
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px' }}>{fmtDateTime(fu.scheduled_at)}</p>
                    {fu.assigned_to_name && <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Assigned to: {fu.assigned_to_name}</p>}
                    {fu.remarks && <p style={{ fontSize: 12, color: 'var(--text)', margin: '6px 0 0' }}>{fu.remarks}</p>}
                    {fu.status === 'completed' && fu.completed_at && (
                      <p style={{ fontSize: 11, color: 'var(--success)', margin: '4px 0 0' }}><Icon name="check" /> Done {fmtDateTime(fu.completed_at)}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Save bar — at the very bottom, below Follow-ups */}
              {saveErr && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-2)', color: 'var(--danger)', borderRadius: 14, padding: '10px 14px', fontSize: 13, fontWeight: 600, margin: '18px 0 4px' }}>{saveErr}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--surface-2)', marginTop: 20, paddingTop: 16 }}>
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 24px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 120 }}>
                  {saving ? 'Saving…' : (form.stm_status === 'closed' ? 'Record Closure →' : 'Save Changes')}
                </button>
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div>
              {/* Lead received event */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="nx-dot-icon"><Icon name="download" /></div>
                  <div style={{ width: 2, flex: 1, backgroundColor: 'var(--surface-2)', marginTop: 4 }} />
                </div>
                <div style={{ paddingBottom: 18, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Lead Received</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0' }}>
                    Source: {lead.source_name || '—'} · Project: {lead.project_name || '—'}
                    {cpOnly && <> · Channel Partner: {lead.channel_partner_name || '—'}</>}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--faint)', margin: '3px 0 0' }}>{fmtDateTime(lead.created_at)}</p>
                </div>
              </div>

              {/* History entries */}
              {!detail && <Loader variant="inline" size="sm" label="Loading…" />}
              {detail && detail.history?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', marginTop: 24 }}>No changes recorded yet.</p>
              )}
              {(detail?.history || []).filter(h => h.field_changed !== 'created').map((h, idx, arr) => {
                const isLast = idx === arr.length - 1;
                const color  = HISTORY_COLOR[h.field_changed] || 'var(--muted)';
                const icon   = h.field_changed === 'created'       ? 'download'
                             : h.field_changed === 'warm_transfer' ? 'flame'
                             : h.field_changed === 'telecaller'    ? 'user'
                             : h.field_changed === 'stm'           ? 'building'
                             : h.field_changed === 'site_visit'    ? 'home'
                             : h.field_changed === 'closure'       ? 'check-circle'
                             : h.field_changed.includes('remarks') ? 'note'
                             : h.field_changed.includes('status')  ? 'refresh' : 'pencil';
                // Lead-flow events (created / assignment / transfer / closure) and free-text
                // remarks read as a single value, not a before→after transition.
                const singleValue = ['created', 'warm_transfer', 'closure', 'telecaller_remarks', 'stm_remarks'].includes(h.field_changed) || !h.old_value;
                // Auto events have no changed_by; label them "System (auto)".
                const byLabel = h.changed_by_name
                  || (['created', 'telecaller', 'stm'].includes(h.field_changed) ? 'System (auto)' : null);
                return (
                  <div key={h.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color }}><Icon name={icon} size={15} /></div>
                      {!isLast && <div style={{ width: 2, flex: 1, backgroundColor: 'var(--surface-2)', marginTop: 4 }} />}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{HISTORY_LABEL[h.field_changed] || h.field_changed}</p>
                      <p style={{ fontSize: 12, color: 'var(--text)', margin: '3px 0 0', whiteSpace: 'pre-wrap' }}>
                        {singleValue ? (
                          // Remarks run past new_value's 100-char DB cap — the full text
                          // lives in `remarks` instead, fall back to new_value elsewhere.
                          <span style={{ color, fontWeight: 600 }}>{(h.field_changed.includes('remarks') ? h.remarks : null) || h.new_value || '—'}</span>
                        ) : (
                          <>
                            <span style={{ color: 'var(--muted)' }}>{h.old_value || '—'}</span>
                            {' → '}
                            <span style={{ color, fontWeight: 600 }}>{h.new_value || '—'}</span>
                          </>
                        )}
                      </p>
                      {byLabel && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>by {byLabel}</p>}
                      <p style={{ fontSize: 11, color: 'var(--faint)', margin: '2px 0 0' }}>{fmtDateTime(h.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Leads Page ─────────────────────────────────────────────────────────
export function SalesLeadsContent({ adminView = false, cpOnly = false }) {
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  // Telecallers & Sales Executives (STM) cannot delete leads — only admins/managers.
  const _desig = (user?.designation || '').toLowerCase();
  const isTelecaller = can(user, 'sales.pipeline.telecalling');
  const isStm        = can(user, 'sales.pipeline.stm');
  const isCp         = can(user, 'sales.pipeline.cp');
  const isCpHead     = _desig.includes('cp cluster head');
  const isCpAny      = isCp || isCpHead;
  const isCaller     = isTelecaller || isStm || isCp;       // CP Head sees the full team list (no work split)
  const canDelete    = !isCaller;
  // Each scoped role only sees its own status filter; admins/managers see all.
  // CP Cluster Heads use the CP view (no telecaller/STM filters), like CP Execs.
  const isAdminMgr   = !isTelecaller && !isStm && !isCpAny;
  const showTcStatus = isAdminMgr || isTelecaller;          // telecaller working status
  const showStmStatus= isAdminMgr || isStm || isCpAny;      // STM/CP working status
  const showAssignees= isAdminMgr;                          // telecaller/STM picker dropdowns
  // Telecaller / STM portals split their assigned leads into "To Call" (pending) vs
  // "Called" (already actioned) so they can tell what's left to work.
  const [workTab,     setWorkTab]     = useState('pending'); // 'pending' | 'called'
  const [leads,       setLeads]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [projects,    setProjects]    = useState([]);
  const [sources,     setSources]     = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [stms,        setStms]        = useState([]);
  const [cps,         setCps]         = useState([]);
  // The referral-partner directory (distinct from `cps` above, which is CP
  // Executive/Cluster Head EMPLOYEES) — only needed when this list is the
  // Channel Partner section's CP Leads tab.
  const [channelPartners, setChannelPartners] = useState([]);
  // Everyone with Channel Partner module access — replaces the Telecaller/STM
  // filters in this section, since a CP lead never has a telecaller and its
  // "STM" is really just whoever added it (see cp_module in TelecallerListView).
  const [cpModuleUsers, setCpModuleUsers] = useState([]);
  const [filters, setFilters] = useState({
    search: '', status: '', project_id: '', source_id: '',
    telecaller_id: '', stm_id: '', telecaller_status: '', stm_status: '',
    campaign: '', is_duplicate: false, unassigned: false, date_from: '', date_to: '',
  });
  // Seed filters from the URL so dashboard stat cards can deep-link into a
  // filtered view (?status=new, ?date_from=today, ?telecaller_status=hot, …).
  // Done in an effect (not a lazy initializer) because during Next client
  // navigation window.location isn't committed when the initializer runs.
  // `seeded` gates the first fetch so we don't briefly show all leads.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const today = new Date().toISOString().slice(0, 10);
    const df = p.get('date_from');
    setFilters((f) => ({
      ...f,
      status:            p.get('status') || '',
      project_id:        p.get('project_id') || '',
      source_id:         p.get('source_id') || '',
      telecaller_status: p.get('telecaller_status') || '',
      stm_status:        p.get('stm_status') || '',
      unassigned:        p.get('unassigned') === 'true',
      date_from:         df === 'today' ? today : (df || ''),
      date_to:           df === 'today' ? today : (p.get('date_to') || ''),
    }));
    if (p.get('tab') === 'called') setWorkTab('called');
    setSeeded(true);
  }, []);
  // Search box is debounced: typing updates `searchText` instantly (responsive UI)
  // but only commits to `filters.search` (which triggers the fetch) after a pause —
  // so typing "ramesh" fires one request, not six.
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);
  const [addModal,    setAddModal]    = useState(false);
  const [addPrefill,  setAddPrefill]  = useState(null);
  // A "Search Lead" lookup on the Dashboard that came up empty hands off here to
  // open Add Lead pre-filled with whatever was searched, instead of making the
  // person retype it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('quick_add_lead');
      if (raw) {
        sessionStorage.removeItem('quick_add_lead');
        setAddPrefill(JSON.parse(raw));
        setAddModal(true);
      }
    } catch (_) {}
  }, []);
  const [selected,    setSelected]    = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Transfer straight from the row — the lead the STM is handing on, or null.
  const [xferLead, setXferLead] = useState(null);
  // Leads that already have a request awaiting approval, so the row shows that
  // instead of offering to raise a second one (the server would reject it anyway).
  const [pendingXfers, setPendingXfers] = useState({});
  const loadPendingXfers = useCallback(() => {
    if (!isStm) return;
    fetch(`${SALES_ENDPOINTS.leadTransfers}?status=pending`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setPendingXfers(Object.fromEntries((Array.isArray(rows) ? rows : []).map((x) => [x.lead, x]))))
      .catch(() => {});
  }, [isStm]);
  useEffect(() => { loadPendingXfers(); }, [loadPendingXfers]);
  const [deleting,    setDeleting]    = useState(false);
  const [dupToasts,   setDupToasts]   = useState([]);

  function showDupToast(lead) {
    const id = Date.now() + Math.random();
    setDupToasts((t) => [...t, { id, name: lead.name, phone: lead.phone }]);
    setTimeout(() => setDupToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }
  function dismissToast(id) { setDupToasts((t) => t.filter((x) => x.id !== id)); }

  const loadMeta = useCallback(async () => {
    const cq = companyId ? `?company_id=${companyId}` : '';
    // Telecaller/STM endpoints already carry `?crm_role=…`, so the company filter
    // must be appended with `&` — using `?` produces a malformed double-`?` URL
    // that swallows both crm_role and company_id (backend then returns ALL users).
    const cqUser = companyId ? `&company_id=${companyId}` : '';
    const cqExtra = companyId ? `?active_only=true&company_id=${companyId}` : '?active_only=true';
    const pKey = `projects_${companyId || 'all'}`;
    const sKey = `sources_${companyId || 'all'}`;
    const cachedP = getCache(pKey);
    const cachedS = getCache(sKey);
    if (cachedP) setProjects(cachedP);
    if (cachedS) setSources(cachedS);
    // Telecaller / STM / CP portals never show the assign dropdowns, so don't fetch
    // the (potentially large) telecaller & STM user lists for them. An STM is the
    // exception for the STM list: they cannot assign, but they do need it to pick a
    // transfer target (see TransferLeadModal).
    const [pRes, sRes, tRes, sRes2, cRes, cpDirRes, cpUsersRes] = await Promise.all([
      cachedP ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.projects + cqExtra, { headers: authHeaders() }).then((r) => r.json()),
      cachedS ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.sources + cq,       { headers: authHeaders() }).then((r) => r.json()),
      (isCaller || cpOnly) ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.telecallers + cqUser, { headers: authHeaders() }).then((r) => r.json()),
      ((isCaller && !isStm) || cpOnly) ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.stms + cqUser, { headers: authHeaders() }).then((r) => r.json()),
      // CP managers (cluster heads) assign leads to their CP executives —
      // only within the Channel Partner section itself, never the regular
      // Sales "Add Lead"/"Edit Lead" forms.
      (cpOnly && isCpHead) ? fetch(SALES_ENDPOINTS.cps + cqUser, { headers: authHeaders() }).then((r) => r.json()) : Promise.resolve(null),
      // The Channel Partner section's referral-partner directory (CP Details).
      cpOnly ? fetch(SALES_ENDPOINTS.channelPartners + cq, { headers: authHeaders() }).then((r) => r.json()) : Promise.resolve(null),
      // Who a CP lead can be filtered by — everyone with CP module access, not
      // telecallers/STMs (a CP lead never has either).
      cpOnly ? fetch(SALES_ENDPOINTS.cpModuleUsers + cqUser, { headers: authHeaders() }).then((r) => r.json()) : Promise.resolve(null),
      // NOTE: the "Assign STM" list (Sales-module users, project-scoped) is
      // fetched inside each modal itself, keyed on the selected project — see
      // salesCpUsers state in AddLeadModal/LeadDetailModal.
    ]);
    if (pRes) { const p = Array.isArray(pRes) ? pRes : []; setCache(pKey, p); setProjects(p); }
    let resolvedSources = cachedS || null;
    if (sRes) { resolvedSources = Array.isArray(sRes) ? sRes : []; setCache(sKey, resolvedSources); setSources(resolvedSources); }
    if (tRes)  setTelecallers(Array.isArray(tRes)  ? tRes  : []);
    if (sRes2) setStms(       Array.isArray(sRes2) ? sRes2 : []);
    if (cRes)  setCps(        Array.isArray(cRes)  ? cRes  : []);
    if (cpDirRes) setChannelPartners(Array.isArray(cpDirRes) ? cpDirRes : []);
    if (cpUsersRes) setCpModuleUsers(Array.isArray(cpUsersRes) ? cpUsersRes : []);
    // Every CP lead must be tagged with a "Channel Partner" source — create that
    // LeadSource on first use in a company that doesn't have one yet, the same way
    // a company would add any other source under Lead Setup.
    if (cpOnly && resolvedSources && !resolvedSources.some((x) => (x.name || '').toLowerCase() === 'channel partner')) {
      try {
        const body = companyId ? { name: 'channel partner', company_id: companyId } : { name: 'channel partner' };
        const r2 = await fetch(SALES_ENDPOINTS.sources, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
        if (r2.ok) {
          const newSrc = await r2.json();
          const updated = [...resolvedSources, newSrc];
          setCache(sKey, updated);
          setSources(updated);
        }
      } catch (_) {}
    }
  }, [companyId, isCaller, isStm, isCpHead, cpOnly]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (isCaller) {
      params.set('work', workTab);
      if (isStm && workTab === 'pending') {
        // An STM's queue is ordered by when the lead was handed to them, most
        // recent first — not creation date (a lead can exist long before it
        // reaches this STM), and not the telecaller's oldest-first FIFO below.
        params.set('ordering', '-stm_assigned_at');
      } else {
        // Pending = oldest-first (FIFO) so new leads queue at the bottom and never
        // bury the lead being worked; Called = most recently actioned first.
        params.set('ordering', workTab === 'pending' ? 'created_at' : '-updated_at');
      }
    }
    if (companyId)               params.set('company_id',       companyId);
    if (filters.search)          params.set('search',           filters.search);
    if (filters.status)          params.set('status',           filters.status);
    if (filters.project_id)      params.set('project_id',       filters.project_id);
    if (filters.source_id)       params.set('source_id',        filters.source_id);
    if (filters.telecaller_id)   params.set('telecaller_id',    filters.telecaller_id);
    if (filters.stm_id)          params.set('stm_id',           filters.stm_id);
    if (filters.telecaller_status) params.set('telecaller_status', filters.telecaller_status);
    if (filters.stm_status)      params.set('stm_status',       filters.stm_status);
    if (filters.campaign)        params.set('campaign',         filters.campaign);
    if (filters.is_duplicate)    params.set('is_duplicate',     'true');
    if (filters.unassigned)      params.set('unassigned',       'true');
    if (filters.date_from)       params.set('date_from',        filters.date_from);
    if (filters.date_to)         params.set('date_to',          filters.date_to);
    if (adminView)               params.set('admin_view', '1');
    if (cpOnly)                  params.set('cp_only', 'true');
    const cacheKey = `leads_${params.toString()}`;
    const cached = getCache(cacheKey);
    if (cached) { setLeads(cached.results); setTotal(cached.count); setLoading(false); return; }

    const res  = await fetch(`${SALES_ENDPOINTS.leads}?${params}`, { headers: authHeaders() });
    const data = await res.json();
    setCache(cacheKey, { results: data.results ?? [], count: data.count ?? 0 });
    setLeads(data.results ?? []);
    setTotal(data.count ?? 0);
    setLoading(false);
  }, [page, filters, companyId, isCaller, workTab, adminView, cpOnly]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  // Opened from a link such as the Log's (?open=<lead id>): show that lead's details.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id || !/^\d+$/.test(id)) return;
    loadDetail({ id });
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  useEffect(() => { if (seeded) loadLeads(); }, [loadLeads, seeded]);
  useEffect(() => { setPage(1); }, [filters, companyId, workTab]);

  // Track latest lead ID to detect new arrivals on tab focus
  const lastLeadIdRef  = React.useRef(null);
  const [newLeadBanner, setNewLeadBanner] = React.useState(0);

  useEffect(() => {
    if (page !== 1) return;
    // Baseline for the new-leads banner = newest assigned lead id. The pending tab is
    // ordered oldest-first, so leads[0] is NOT the newest there — fetch it separately.
    if (isCaller) {
      (async () => {
        try {
          const res  = await fetch(`${SALES_ENDPOINTS.leads}?page=1&page_size=1`, { headers: authHeaders() });
          const data = await res.json();
          const results = data.results ?? [];
          lastLeadIdRef.current = results.length ? results[0].id : 0;
          setNewLeadBanner(0);
        } catch { /* ignore */ }
      })();
    } else if (leads.length) {
      lastLeadIdRef.current = leads[0].id;
      setNewLeadBanner(0);
    }
  }, [leads, isCaller, page]);

  useEffect(() => {
    const checkNewLeads = async () => {
      if (lastLeadIdRef.current === null) return;
      try {
        const res  = await fetch(`${SALES_ENDPOINTS.leads}?page=1&page_size=5`, { headers: authHeaders() });
        const data = await res.json();
        const results = data.results ?? [];
        if (results.length && results[0].id !== lastLeadIdRef.current) {
          const count = results.filter(r => r.id > lastLeadIdRef.current).length;
          setNewLeadBanner(count || 1);
        }
      } catch { /* ignore */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') checkNewLeads(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  async function loadDetail(lead) {
    const res  = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
    const data = await res.json();
    setSelected(data);
  }

  // Update the saved lead in place so the list never re-sorts and the row the user
  // just worked stays put. In the caller "To Call" tab, an actioned lead drops out.
  function onLeadUpdated(updated) {
    bustLeadsCache();
    if (!updated) { loadLeads(); return; }
    const actioned = isTelecaller ? !!updated.telecaller_status : isStm ? !!updated.stm_status : false;
    if (isCaller && workTab === 'pending' && actioned) {
      setLeads((prev) => prev.filter((l) => l.id !== updated.id));
      setTotal((t) => Math.max(0, t - 1));
    } else {
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
    }
  }

  async function deleteLead(id) {
    if (!(await confirmDialog('Delete this lead permanently?'))) return;
    await fetch(SALES_ENDPOINTS.lead(id), { method: 'DELETE', headers: authHeaders() });
    bustLeadsCache();
    loadLeads();
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    if (!(await confirmDialog(`Delete ${selectedIds.size} leads permanently?`))) return;
    setDeleting(true);
    await fetch(SALES_ENDPOINTS.bulkDelete, {
      method: 'DELETE', headers: authHeaders(),
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setSelectedIds(new Set());
    setDeleting(false);
    bustLeadsCache();
    loadLeads();
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page-pad">
      <DupToast toasts={dupToasts} onDismiss={dismissToast} />

      {/* New leads notification banner */}
      {newLeadBanner > 0 && (
        <div className="nx-notice">
          <div className="nx-notice-main">
            <span className="nx-notice-dot"><Icon name="bell" /></span>
            <span className="nx-notice-text">
              {newLeadBanner} new lead{newLeadBanner > 1 ? 's' : ''} arrived
            </span>
          </div>
          <button className="nx-btn nx-btn-sm nx-btn-soft"
            onClick={() => { bustLeadsCache(); setPage(1); loadLeads(); setNewLeadBanner(0); }}>
            Refresh
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>All Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {total.toLocaleString()} {isCaller ? (workTab === 'pending' ? 'to call' : 'called') : 'total leads'}
            {selectedIds.size > 0 && <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canDelete && selectedIds.size > 0 && (
            <button className="nx-btn nx-btn-md nx-btn-danger" onClick={bulkDelete} disabled={deleting} style={{ ...saveBtn, backgroundColor: 'var(--danger-solid)' }}>
              {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
          )}
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => setAddModal(true)} style={saveBtn}>+ Add Lead</button>
        </div>
      </div>

      {/* To Call / Called split — telecaller & STM portals only */}
      {isCaller && (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--surface-3)', marginBottom: 18 }}>
          {[['pending', 'To Call'], ['called', 'Called']].map(([key, label]) => {
            const active = workTab === key;
            return (
              <button key={key} onClick={() => setWorkTab(key)}
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none',
                  color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {(() => {
        const sf = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
        const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const today = localDate(new Date());
        const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
        const TC_STATUSES  = ['warm','cold','not_interested','not_reachable','callback','not_qualified'];
        const STM_STATUSES = ['hot','warm','cold','not_interested','sv_scheduled','sv_done','closed','not_qualified'];
        const anyFilter = filters.search || filters.status || filters.project_id || filters.source_id ||
          filters.telecaller_id || filters.stm_id || filters.telecaller_status || filters.stm_status ||
          filters.campaign || filters.is_duplicate || filters.unassigned || filters.date_from || filters.date_to;
        const clearAll = () => { setSearchText(''); setFilters({ search:'', status:'', project_id:'', source_id:'', telecaller_id:'', stm_id:'', telecaller_status:'', stm_status:'', campaign:'', is_duplicate:false, unassigned:false, date_from:'', date_to:'' }); };

        const fSel = {
          height: 36, padding: '0 10px', borderRadius: 8,
          border: '1.5px solid var(--surface-3)', fontSize: 12, background: 'var(--surface-2)',
          cursor: 'pointer', outline: 'none', color: 'var(--text)', fontWeight: 500,
        };
        const activeSelStyle = (val) => val ? { ...fSel, borderColor: 'var(--accent)', background: 'var(--accent-softer)', color: 'var(--accent)', fontWeight: 600 } : fSel;
        const qBtn = (active) => ({
          height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', border: 'none',
          background: active ? 'var(--strong)' : 'var(--surface-2)',
          color: active ? '#fff' : 'var(--muted)',
          transition: 'all 0.15s',
        });
        const divider = { width: 1, height: 24, background: 'var(--surface-3)', flexShrink: 0 };

        return (
          <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 18, border: '1.5px solid var(--surface-3)', marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

            {/* Search bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-2)' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)' }}><Icon name="search" /></span>
                <input className="nx-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search name, phone, email…"
                  style={{ width: '100%', height: 40, padding: '0 16px 0 38px', borderRadius: 14, border: '1.5px solid var(--surface-3)', fontSize: 13, background: 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' }} />
              </div>
            </div>

            {/* Row 1: Date range + quick buttons + project + tc/stm status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--surface-2)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Date</span>
              <input className="nx-input" type="date" value={filters.date_from} onChange={(e) => sf('date_from', e.target.value)} style={{ ...fSel, width: 136 }} />
              <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>→</span>
              <input className="nx-input" type="date" value={filters.date_to} onChange={(e) => sf('date_to', e.target.value)} style={{ ...fSel, width: 136 }} />
              <div style={divider} />
              <select className="nx-input nx-input-sm nx-filter-sel"
                value={(filters.date_from === today && filters.date_to === today) ? 'today'
                     : (filters.date_from === daysAgo(6) && filters.date_to === today) ? 'week'
                     : (filters.date_from === daysAgo(29) && filters.date_to === today) ? 'month' : ''}
                onChange={(e) => {
                  const k = e.target.value;
                  sf('date_from', k === 'today' ? today : k === 'week' ? daysAgo(6) : k === 'month' ? daysAgo(29) : '');
                  sf('date_to', k ? today : '');
                }}>
                <option value="">Any date</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              <div style={divider} />
              <select value={filters.project_id} onChange={(e) => sf('project_id', e.target.value)} style={activeSelStyle(filters.project_id)}>
                <option value="">All Projects</option>
                <option value="none">— No Project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {showTcStatus && (
              <select value={filters.telecaller_status} onChange={(e) => sf('telecaller_status', e.target.value)} style={activeSelStyle(filters.telecaller_status)}>
                <option value="">TC Status</option>
                {TC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              )}
              {showStmStatus && (
              <select value={filters.stm_status} onChange={(e) => sf('stm_status', e.target.value)} style={activeSelStyle(filters.stm_status)}>
                <option value="">{cpOnly ? 'Lead Status' : isCpAny ? 'CP Status' : 'STM Status'}</option>
                {STM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              )}
              {anyFilter && (
                <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={clearAll} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--danger-3)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
                  <Icon name="x" /> Clear all
                </button>
              )}
            </div>

            {/* Row 2: Status + Source + Telecaller + STM + Campaign + Duplicates */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px' }}>
              {showAssignees && (
              <select value={filters.status} onChange={(e) => sf('status', e.target.value)} style={activeSelStyle(filters.status)}>
                <option value="">All Statuses</option>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              )}
              <select value={filters.source_id} onChange={(e) => sf('source_id', e.target.value)} style={activeSelStyle(filters.source_id)}>
                <option value="">All Sources</option>
                {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
              </select>
              {showAssignees && !cpOnly && (
              <select value={filters.telecaller_id} onChange={(e) => sf('telecaller_id', e.target.value)} style={activeSelStyle(filters.telecaller_id)}>
                <option value="">All Telecallers</option>
                {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              )}
              {showAssignees && !cpOnly && (
              <select value={filters.stm_id} onChange={(e) => sf('stm_id', e.target.value)} style={activeSelStyle(filters.stm_id)}>
                <option value="">All STMs</option>
                {stms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              )}
              {showAssignees && cpOnly && (
              <select value={filters.stm_id} onChange={(e) => sf('stm_id', e.target.value)} style={activeSelStyle(filters.stm_id)}>
                <option value="">All Team Members</option>
                {cpModuleUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              )}
              <input className="nx-input" value={filters.campaign} onChange={(e) => sf('campaign', e.target.value)}
                placeholder="Campaign name…"
                style={{ ...fSel, width: 170, background: filters.campaign ? 'var(--accent-softer)' : 'var(--surface-2)', borderColor: filters.campaign ? 'var(--accent)' : 'var(--surface-3)', color: filters.campaign ? 'var(--accent)' : 'var(--text)' }} />
              <label className={`nx-check${filters.is_duplicate ? ' is-on' : ''}`}>
                <input type="checkbox" checked={filters.is_duplicate} onChange={(e) => sf('is_duplicate', e.target.checked)} />
                Duplicates only
              </label>
              <label className={`nx-check${filters.unassigned ? ' is-on' : ''}`}>
                <input type="checkbox" checked={filters.unassigned} onChange={(e) => sf('unassigned', e.target.checked)} />
                Unassigned only
              </label>
            </div>
          </div>
        );
      })()}

      {xferLead && (
        <TransferLeadModal lead={xferLead} stms={stms} onClose={() => setXferLead(null)}
          onDone={() => { setXferLead(null); loadPendingXfers(); }} />
      )}

      {/* Table */}
      <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 18, boxShadow: '0 2px 8px rgba(140,148,160,0.18)', overflowX: 'auto' }}>
        <div>
          <table className="nx-table" style={tbl}>
            <thead style={{ backgroundColor: 'var(--surface-2)' }}>
              <tr>
                <th style={th}>
                  {canDelete && <input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} />}
                </th>
                {['Name', 'Project', 'Source',
                  ...(cpOnly ? ['Channel Partner'] : []),
                  ...(showTcStatus ? ['Telecaller'] : []),
                  ...(showStmStatus ? [isCpAny ? 'CP' : 'STM'] : []),
                  ...(showTcStatus ? ['TC Status'] : []),
                  ...(showStmStatus ? [cpOnly ? 'Lead Status' : isCpAny ? 'CP Status' : 'STM Status'] : []),
                  'Overall', 'Received', ''].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(cpOnly ? 12 : 11)].map((__, j) => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <div className="s-skel" style={{ height: 14, width: j === 0 ? 16 : j === 1 ? 120 : 80, borderRadius: 6 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={cpOnly ? 12 : 11} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>No leads found</td></tr>
              ) : leads.map((l) => (
                <tr key={l.id}
                  style={{ borderBottom: '1px solid var(--surface-2)', cursor: 'pointer', backgroundColor: l.is_duplicate ? 'var(--danger-soft)' : '', borderLeft: l.is_duplicate ? '3px solid var(--danger)' : '3px solid transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = l.is_duplicate ? 'var(--danger-soft)' : 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = l.is_duplicate ? 'var(--danger-soft)' : ''}>
                  <td style={td} onClick={(e) => { e.stopPropagation(); if (canDelete) toggleSelect(l.id); }}>
                    {canDelete && <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />}
                  </td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{l.name}</span>
                      {l.is_duplicate && <DupBadge count={l.duplicate_count} />}
                    </div>
                    {(l.meta_campaign_name || l.meta_adset_name || l.meta_ad_name) && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                        {[l.meta_campaign_name, l.meta_adset_name, l.meta_ad_name].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--muted)' }} onClick={() => loadDetail(l)}>{l.project_name || '—'}</td>
                  <td style={{ ...td, color: 'var(--muted)', textTransform: 'capitalize' }} onClick={() => loadDetail(l)}>{l.source_name || '—'}</td>
                  {cpOnly && <td style={{ ...td, color: 'var(--muted)' }} onClick={() => loadDetail(l)}>{l.channel_partner_name || '—'}</td>}
                  {showTcStatus && <td style={{ ...td, color: 'var(--text)', fontSize: 12 }} onClick={() => loadDetail(l)}>{l.telecaller_name || <span style={{ color: 'var(--border-strong)' }}>—</span>}</td>}
                  {showStmStatus && <td style={{ ...td, color: 'var(--text)', fontSize: 12 }} onClick={() => loadDetail(l)}>{l.stm_name || <span style={{ color: 'var(--border-strong)' }}>—</span>}</td>}
                  {showTcStatus && <td style={td} onClick={() => loadDetail(l)}>
                    {l.telecaller_status ? <StatusBadge status={l.telecaller_status} /> : <span style={{ color: 'var(--border-strong)' }}>—</span>}
                  </td>}
                  {showStmStatus && <td style={td} onClick={() => loadDetail(l)}>
                    {l.stm_status ? <StatusBadge status={l.stm_status} outcome={l.sv_outcome} /> : <span style={{ color: 'var(--border-strong)' }}>—</span>}
                  </td>}
                  <td style={td} onClick={() => loadDetail(l)}><StatusBadge status={l.status} outcome={l.sv_outcome} /></td>
                  <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }} onClick={() => loadDetail(l)}>
                    {/* An STM cares about when THEY received the lead, not when it first
                        entered the system — fall back to created_at for leads with no
                        stamped stm_assigned_at (e.g. self-sourced). */}
                    {(() => { const d = (isStm && l.stm_assigned_at) ? l.stm_assigned_at : l.created_at; return (
                      <>
                        <div>{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)' }}>{new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                      </>
                    ); })()}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      {/* Hand the lead on without having to open it first. */}
                      {isStm && !!l.stm && (pendingXfers[l.id] ? (
                        <span title={`Awaiting approval — requested for ${pendingXfers[l.id].to_stm_name || 'another STM'}`}
                          style={{ background: 'var(--warning-soft)', border: '1.5px solid var(--peach)', color: 'var(--warning)', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>
                          ⏳ Transfer pending
                        </span>
                      ) : (
                        <button className="nx-btn nx-btn-sm nx-btn-secondary" title="Transfer to another STM"
                          onClick={(e) => { e.stopPropagation(); setXferLead(l); }}
                          style={{ background: 'var(--surface)', border: '1.5px solid var(--blue-2)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>
                          ⇄ Transfer
                        </button>
                      ))}
                      {canDelete && (
                      <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost" onClick={(e) => { e.stopPropagation(); deleteLead(l.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>
                        <Icon name="x" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--surface-2)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn}>← Prev</button>
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                const pg = i + 1;
                return (
                  <button className={`nx-btn nx-btn-sm nx-toggle${page === pg ? ' is-on' : ''}`} key={pg} onClick={() => setPage(pg)}
                    style={{ ...pgBtn, backgroundColor: page === pg ? 'var(--strong)' : '', color: page === pg ? '#fff' : 'var(--text)' }}>
                    {pg}
                  </button>
                );
              })}
              <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {addModal && (
        <AddLeadModal projects={projects} sources={sources} telecallers={telecallers} stms={stms} cps={cps}
          cpOnly={cpOnly} channelPartners={channelPartners} prefill={addPrefill}
          onClose={() => { setAddModal(false); setAddPrefill(null); }} onAdded={(lead) => { if (lead?.is_duplicate) showDupToast(lead); loadLeads(); }} />
      )}
      {selected && (
        <LeadDetailModal lead={selected} projects={projects} sources={sources} telecallers={telecallers} stms={stms}
          cpOnly={cpOnly} channelPartners={channelPartners}
          onClose={() => setSelected(null)} onUpdated={onLeadUpdated} />
      )}
    </div>
  );
}

export default function SalesLeadsPage() {
  return <SalesLeadsContent />;
}

// Shared styles
const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const tbl = { width: '100%', borderCollapse: 'collapse', minWidth: 960 };
const th  = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td  = { padding: '10px 14px', fontSize: 13 };
const pgBtn = { padding: '5px 12px', borderRadius: 7, border: '1.5px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: 12, color: 'var(--text)', cursor: 'pointer' };
const saveBtn   = { padding: '9px 20px', backgroundColor: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '9px 16px', backgroundColor: 'var(--surface-2)', color: 'var(--muted)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const overlay   = { position: 'fixed', inset: 0, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal     = { backgroundColor: 'var(--surface)', borderRadius: 20, width: '90%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--surface-2)' };
const closeBtn  = { background: 'none', border: 'none', fontSize: 16, color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px' };
