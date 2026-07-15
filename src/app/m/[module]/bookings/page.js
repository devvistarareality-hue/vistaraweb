'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';

const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const isEoi = (b) => String(b.plot_numbers || '').toUpperCase().startsWith('EOI');

// Open the confidential LOI/EOI PDF via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the document.');
  } catch { alert('Could not open the document.'); }
}

// Download the signed PDF to disk (fetch the blob so it saves instead of opening).
async function downloadLoi(b) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(b.id), { headers: authHeaders() });
    const d = await r.json();
    if (!r.ok || !d.url) { alert('Could not download the document.'); return; }
    const name = `${isEoi(b) ? 'EOI' : 'LOI'}_${(b.project_name || '').replace(/\s+/g, '_')}_${(b.plot_numbers || b.plot_number || '').replace(/[\s,]+/g, '')}_${(b.client_name || '').replace(/\s+/g, '_')}.pdf`;
    try {
      const blob = await (await fetch(d.url)).blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
    } catch { window.open(d.url, '_blank', 'noopener,noreferrer'); }  // CORS fallback → open
  } catch { alert('Could not download the document.'); }
}

function statusPill(s) {
  const map = { pending: ['#B45309', '#FEF3C7'], sold: ['#15803D', '#E8F5E9'], rejected: ['#DC2626', '#FEE2E2'], hold: ['#B45309', '#FEF3C7'] };
  const [c, bg] = map[s] || ['#6B7280', '#F3F4F6'];
  return { display: 'inline-block', fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}

const money0 = (n) => (n === '' || n == null) ? '—' : '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const val = (v) => (v === '' || v == null) ? '—' : String(v);
const Row2 = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
    <span style={{ fontSize: 11, color: '#8492A6', fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 12, color: '#1A1A2E', fontWeight: 700, textAlign: 'right' }}>{value}</span>
  </div>
);
const Group = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{title}</div>
    {children}
  </div>
);

// The exact details entered on the booking form (client, property, rates, amounts, schedule).
function BookingDetails({ b }) {
  const insts = Array.isArray(b.installments) ? b.installments : [];
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #CBD5E1' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Group title="Client & Property">
          <Row2 label="Client" value={val(b.client_name)} />
          <Row2 label="Phone" value={val(b.phone)} />
          <Row2 label="Gender" value={val(b.gender)} />
          <Row2 label="Address" value={val(b.address)} />
          <Row2 label="Source" value={val(b.source)} />
          {b.cp_name ? <Row2 label="Reference / CP" value={val(b.cp_name)} /> : null}
          <Row2 label="Project" value={val(b.project_name)} />
          <Row2 label="Unit" value={val(b.plot_numbers || b.plot_number)} />
          <Row2 label="Type" value={val(b.villa_type || b.bunglow_type)} />
          <Row2 label="STM" value={val(b.stm_name)} />
          <Row2 label="Booking Date" value={val(b.booking_date)} />
          <Row2 label="Pricing" value={String(b.formula_set || '').toUpperCase() || '—'} />
          <Row2 label="Plot Area" value={`${val(b.area)} ${b.area_unit || ''}`.trim()} />
          <Row2 label="Construction Area" value={val(b.const_area)} />
        </Group>
        <Group title="Rates & Amounts">
          <Row2 label="Land Rate" value={money0(b.land_rate)} />
          <Row2 label="Development Rate" value={money0(b.dev_rate)} />
          <Row2 label="Construction Rate" value={money0(b.const_rate)} />
          {Number(b.sale_deed_rate) ? <Row2 label="Sale Deed Rate" value={money0(b.sale_deed_rate)} /> : null}
          <Row2 label="Sale Deed %" value={b.sale_deed_pct != null ? b.sale_deed_pct + '%' : '—'} />
          {Number(b.land_sale_deed) ? <Row2 label="Land Sale Deed" value={money0(b.land_sale_deed)} /> : null}
          {Number(b.const_agreement) ? <Row2 label="Construction Agreement" value={money0(b.const_agreement)} /> : null}
          {Number(b.premium_location) ? <Row2 label="Premium Location" value={money0(b.premium_location)} /> : null}
          <Row2 label="Plot Basic" value={money0(b.plot_basic)} />
          <Row2 label="Plot Development" value={money0(b.plot_dev)} />
          <Row2 label="Construction Amount" value={money0(b.const_amt)} />
          <Row2 label="Unit Price" value={money0(b.sale_deed)} />
          <Row2 label="Stamp Duty" value={money0(b.stamp_duty)} />
          <Row2 label="Registration" value={money0(b.reg_fees)} />
          <Row2 label="GST" value={money0(b.gst)} />
          <Row2 label="Maintenance Deposit" value={money0(b.maint_deposit || b.maintenance)} />
          {Number(b.maint_advance) ? <Row2 label="Maintenance Advance" value={money0(b.maint_advance)} /> : null}
          <Row2 label="Legal Charges" value={money0(b.legal_charges)} />
          <Row2 label="Total Legal & Other" value={money0(b.total_extra)} />
          {Number(b.discount) ? <Row2 label="Discount" value={money0(b.discount)} /> : null}
          {Number(b.extra_work_amount) ? <Row2 label="Extra Work" value={money0(b.extra_work_amount)} /> : null}
          <Row2 label="Final Amount" value={money0(b.final_amount)} />
        </Group>
      </div>
      {insts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Payment Schedule</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['#', 'Due Date', '%', 'Amount', 'Type'].map((h) => <th key={h} style={{ textAlign: 'left', color: '#8492A6', fontWeight: 700, fontSize: 10, padding: '4px 6px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>)}</tr></thead>
            <tbody>
              {insts.map((i, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9' }}>{i.no || idx + 1}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9' }}>{i.date || '—'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9' }}>{i.pct != null ? i.pct + '%' : '—'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9', fontWeight: 700 }}>{money0(i.amt)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9', color: '#8492A6' }}>{i.isNsd ? 'Extra Work' : i.isExtra ? 'Legal & Other' : 'Unit Price'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Accounts & Finance — read-only view of every sales booking (LOI + EOI), grouped by
// project. The accounts team can review details and open the signed document; no editing.
export default function ModuleBookingsPage() {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});
  const toggle = (pn) => setOpen((o) => ({ ...o, [pn]: !o[pn] }));
  const [detailsOpen, setDetailsOpen] = useState({});
  const toggleDetails = (id) => setDetailsOpen((o) => ({ ...o, [id]: !o[id] }));

  useEffect(() => {
    setLoading(true); setErr('');
    fetch(SALES_ENDPOINTS.bookingsAll + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((s) => { setErr(s === 403 ? 'You do not have access to bookings.' : 'Could not load bookings.'); setLoading(false); });
  }, [companyId]);

  const groups = {};
  rows.forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  projectNames.forEach((pn) => groups[pn].sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || ''))));

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Bookings</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>All sales bookings (LOI &amp; EOI), project-wise · view only</p>

      <div style={{ marginTop: 22 }}>
        {loading ? <p style={{ color: '#8492A6' }}>Loading…</p>
        : err ? <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 12, padding: '14px 18px', fontSize: 13 }}>{err}</div>
        : projectNames.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>No bookings yet.</div>
        ) : projectNames.map((pn) => (
          <div key={pn} style={{ marginBottom: 12 }}>
            <div onClick={() => toggle(pn)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)', border: open[pn] ? '1.5px solid #99F6E4' : '1.5px solid transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                🏢 {pn} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {groups[pn].length} booking{groups[pn].length === 1 ? '' : 's'}</span>
              </div>
              <span style={{ color: '#8492A6', fontSize: 13, fontWeight: 800, transform: open[pn] ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            </div>
            {open[pn] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {groups[pn].map((b) => (
                  <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                          {isEoi(b)
                            ? <span style={{ color: '#E4571A' }}>{b.plot_numbers}</span>
                            : <>Plot {b.plot_numbers || b.plot_number || b.area}</>}
                          <span style={{ color: '#8492A6', fontWeight: 600 }}> · {b.client_name || '—'}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0D9488', background: '#CCFBF1', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>{isEoi(b) ? 'EOI' : 'LOI'}</span>
                          {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>R{b.revision_no}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>{b.phone} · Booked {b.booking_date || '—'} · STM {b.stm_name || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0D47A1' }}>{rupee(b.final_amount)}</div>
                        <div style={{ marginTop: 4 }}><span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span></div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => toggleDetails(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {detailsOpen[b.id] ? '▲ Hide Details' : '▾ Details'}
                      </button>
                      {b.loi_document && <>
                        <button onClick={() => openLoi(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #99F6E4', background: '#fff', color: '#0D9488', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📄 View {isEoi(b) ? 'EOI' : 'LOI'}</button>
                        <button onClick={() => downloadLoi(b)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0D9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Download {isEoi(b) ? 'EOI' : 'LOI'}</button>
                      </>}
                    </div>
                    {detailsOpen[b.id] && <BookingDetails b={b} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
