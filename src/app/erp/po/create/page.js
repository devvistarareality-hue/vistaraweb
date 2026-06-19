'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_MASTER, ERP_EXECUTION, ERP_PURCHASE } from '../../../../constants/api';

const ORANGE = '#E65100';

function Select({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: value ? '#1A1A2E' : '#8492A6', background: disabled ? '#F5F6FA' : '#fff', outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: '#1A1A2E', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}

const emptyLine = () => ({ pr_line: null, pr_line_id: '', qty_ordered: '', unit_rate: '', uom: '', tax_pct: '0' });

export default function CreatePOPage() {
  const router = useRouter();
  const [vendors,    setVendors]    = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [prLines,    setPRLines]    = useState([]);
  const [vendorId,   setVendorId]   = useState('');
  const [projectId,  setProjectId]  = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [remarks,    setRemarks]    = useState('');
  const [lines,      setLines]      = useState([emptyLine()]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  useEffect(() => { loadMaster(); }, []);

  async function loadMaster() {
    const token = localStorage.getItem('access_token');
    const h = { Authorization: `Bearer ${token}` };
    const [vendRes, prjRes] = await Promise.all([
      fetch(ERP_MASTER.vendors, { headers: h }),
      fetch(ERP_MASTER.projects, { headers: h }),
    ]);
    if (vendRes.ok) { const d = await vendRes.json(); setVendors((Array.isArray(d) ? d : d.results || []).map((v) => ({ id: v.id, label: v.name }))); }
    if (prjRes.ok)  { const d = await prjRes.json(); setProjects((Array.isArray(d) ? d : d.results || []).map((p) => ({ id: p.id, label: p.name }))); }
  }

  async function handleProjectChange(pid) {
    setProjectId(pid);
    setPRLines([]);
    setLines([emptyLine()]);
    if (!pid) return;
    const token = localStorage.getItem('access_token');
    const h = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${ERP_EXECUTION.prs}?project=${pid}&status=Approved`, { headers: h });
    if (!res.ok) return;
    const data = await res.json();
    const prs  = Array.isArray(data) ? data : (data.results || []);
    const allLines = [];
    for (const pr of prs) {
      const dr = await fetch(ERP_EXECUTION.pr(pr.id), { headers: h });
      if (!dr.ok) continue;
      const prDetail = await dr.json();
      (prDetail.lines || []).forEach((l) => {
        allLines.push({
          id:           l.id,
          label:        `PR ${prDetail.pr_no} — ${l.item_name} (${l.activity_code})`,
          uom:          l.uom,
          qty_required: l.qty_required,
          activity:     l.activity,
          item_code:    l.item_code,
        });
      });
    }
    setPRLines(allLines);
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      if (patch.pr_line_id) {
        const found = prLines.find((p) => String(p.id) === String(patch.pr_line_id));
        if (found) {
          updated.pr_line  = found;
          updated.uom      = found.uom || '';
          updated.qty_ordered = String(found.qty_required);
        }
      }
      return updated;
    }));
  }

  function totalAmount() {
    return lines.reduce((s, l) => s + (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_rate) || 0), 0);
  }

  async function handleSubmit() {
    setError(''); setSuccess('');
    if (!vendorId)  { setError('Please select a vendor.');  return; }
    if (!projectId) { setError('Please select a project.'); return; }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.pr_line_id) { setError(`Line ${i + 1}: Select a PR line.`); return; }
      if (!l.qty_ordered || parseFloat(l.qty_ordered) <= 0) { setError(`Line ${i + 1}: Enter valid quantity.`); return; }
      if (!l.unit_rate   || parseFloat(l.unit_rate)  <= 0) { setError(`Line ${i + 1}: Enter unit rate.`); return; }
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const body = {
        project:       parseInt(projectId),
        vendor:        parseInt(vendorId),
        delivery_date: deliveryDate || null,
        payment_terms: parseInt(paymentTerms) || 30,
        remarks,
        lines: lines.map((l) => ({
          pr_line:     parseInt(l.pr_line_id),
          activity:    l.pr_line?.activity,
          project:     parseInt(projectId),
          item_code:   l.pr_line?.item_code,
          qty_ordered: parseFloat(l.qty_ordered),
          unit_rate:   parseFloat(l.unit_rate),
          uom:         l.uom,
          tax_pct:     parseFloat(l.tax_pct) || 0,
        })),
      };
      const res = await fetch(ERP_PURCHASE.pos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`PO ${data.po_no} created successfully!`);
        setTimeout(() => router.push('/erp/po'), 1600);
      } else {
        const e = await res.json();
        setError(JSON.stringify(e));
      }
    } catch { setError('Network error. Please try again.'); }
    setSaving(false);
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.push('/erp/po')} style={{ background: '#FFF3E0', border: 'none', borderRadius: 10, padding: '8px 14px', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>New Purchase Order</h1>
          <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 0' }}>Create a PO from approved purchase requisitions</p>
        </div>
      </div>

      {error   && <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', color: '#C62828', fontSize: 13, marginBottom: 20 }}>{error}</div>}
      {success && <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 10, padding: '12px 16px', color: '#2E7D32', fontSize: 13, marginBottom: 20 }}>{success}</div>}

      <div style={{ background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, marginTop: 0, marginBottom: 20 }}>PO DETAILS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Select label="PROJECT *" value={projectId} onChange={handleProjectChange} options={projects} placeholder="Select project..." />
          <Select label="VENDOR *" value={vendorId} onChange={setVendorId} options={vendors} placeholder="Select vendor..." />
          <Input label="DELIVERY DATE" value={deliveryDate} onChange={setDeliveryDate} type="date" />
          <Input label="PAYMENT TERMS (DAYS)" value={paymentTerms} onChange={setPaymentTerms} type="number" placeholder="30" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>REMARKS</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional remarks..."
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: '#1A1A2E', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Lines */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, margin: 0 }}>PO LINES * (from approved PRs)</h3>
        <button onClick={() => setLines((prev) => [...prev, emptyLine()])}
          style={{ background: '#FFF3E0', border: 'none', borderRadius: 8, padding: '7px 14px', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          + Add Line
        </button>
      </div>

      {!projectId && (
        <div style={{ background: '#FFF3E0', borderRadius: 10, padding: '12px 16px', color: '#E65100', fontSize: 13, marginBottom: 16 }}>
          ℹ️ Select a project to load approved PR lines.
        </div>
      )}

      {lines.map((line, idx) => (
        <div key={idx} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${ORANGE}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>Line {idx + 1}</span>
            {lines.length > 1 && (
              <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                style={{ background: '#FFEBEE', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#C62828', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                Remove
              </button>
            )}
          </div>

          <Select label="APPROVED PR LINE *" value={line.pr_line_id}
            onChange={(v) => updateLine(idx, { pr_line_id: v })}
            options={prLines.map((p) => ({ id: p.id, label: p.label }))}
            placeholder={projectId ? (prLines.length ? 'Select PR line...' : 'No approved PRs for this project') : 'Select project first'}
            disabled={!projectId}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px' }}>
            <Input label="QTY ORDERED *" value={line.qty_ordered} onChange={(v) => updateLine(idx, { qty_ordered: v })} type="number" placeholder="0" />
            <Input label="UOM" value={line.uom} onChange={(v) => updateLine(idx, { uom: v })} placeholder="Nos" />
            <Input label="UNIT RATE *" value={line.unit_rate} onChange={(v) => updateLine(idx, { unit_rate: v })} type="number" placeholder="₹0.00" />
            <Input label="TAX %" value={line.tax_pct} onChange={(v) => updateLine(idx, { tax_pct: v })} type="number" placeholder="18" />
          </div>

          {line.qty_ordered && line.unit_rate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #F0F4FA', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#8492A6', fontWeight: 600 }}>Line Total:</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>
                ₹{((parseFloat(line.qty_ordered) || 0) * (parseFloat(line.unit_rate) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      ))}

      {/* Grand total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#FFF3E0', borderRadius: 14, padding: '16px 20px', marginTop: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: ORANGE }}>Grand Total (excl. tax)</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: ORANGE }}>₹{totalAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: ORANGE, border: 'none', borderRadius: 12, padding: '16px', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 12 }}
      >
        {saving ? 'Creating...' : '🛒 Create Purchase Order'}
      </button>
    </div>
  );
}
