'use client';
// The exact details entered on the booking form — client, property, rates, amounts
// and the payment schedule. Built for the Accounts & Finance review screen and now
// shared with Sales and Channel Partner: the same deal read by three teams should
// not be three different renderings of it, least of all three sets of rounding.
//
// `accent` colours the group headings so the block sits in whichever module shows it.

const money0 = (n) => (n === '' || n == null) ? '—' : '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const val = (v) => (v === '' || v == null) ? '—' : String(v);
const Row2 = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--surface-2)' }}>
    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
  </div>
);
const Group = ({ title, children, accent = 'var(--success)' }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{title}</div>
    {children}
  </div>
);

// The exact details entered on the booking form (client, property, rates, amounts, schedule).
// Due dates are stored yyyy-mm-dd; show them as dd-mm-yyyy for the accounts view.
export function fmtDate(d) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(d || ''));
  return m ? `${m[3].padStart(2, '0')}-${m[2].padStart(2, '0')}-${m[1]}` : (d || '—');
}

// created_at/approved_at are full ISO timestamps — show date + time (IST, matches
// the backend's TIME_ZONE) for booking/approval time-of-day, not just the date.
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  return `${date}, ${time}`;
}

export default function BookingDetails({ b, accent = 'var(--success)' }) {
  const rawInsts = Array.isArray(b.installments) ? b.installments : [];
  // Sort the payment schedule by due date ascending (yyyy-mm-dd sorts chronologically).
  const insts = [...rawInsts].sort((a, x) => String(a.date || '').localeCompare(String(x.date || '')));
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-strong)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Group title="Client & Property" accent={accent}>
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
          <Row2 label="Booking Time" value={fmtDateTime(b.created_at)} />
          <Row2 label="Approved At" value={fmtDateTime(b.approved_at)} />
          <Row2 label="Pricing" value={String(b.formula_set || '').toUpperCase() || '—'} />
          <Row2 label="Plot Area" value={`${val(b.area)} ${b.area_unit || ''}`.trim()} />
          <Row2 label="Construction Area" value={val(b.const_area)} />
        </Group>
        <Group title="Rates & Amounts" accent={accent}>
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
          {/* Kalrav-3 / Ankhol / Industrial split maintenance into deposit + advance;
              plain Kalrav books a single Maintenance amount and leaves both at 0. Test
              numerically — DRF serialises decimals as strings, so "0.00" is truthy and
              a `maint_deposit || maintenance` fallback would never fire. */}
          {(Number(b.maint_deposit) || Number(b.maint_advance)) ? (
            <>
              <Row2 label="Maintenance Deposit" value={money0(b.maint_deposit)} />
              {Number(b.maint_advance) ? <Row2 label="Maintenance Advance" value={money0(b.maint_advance)} /> : null}
            </>
          ) : (
            <Row2 label="Maintenance" value={money0(b.maintenance)} />
          )}
          <Row2 label="Legal Charges" value={money0(b.legal_charges)} />
          <Row2 label="Total Legal & Other" value={money0(b.total_extra)} />
          {Number(b.discount) ? <Row2 label="Discount" value={money0(b.discount)} /> : null}
          {Number(b.extra_work_amount) ? <Row2 label="Extra Work" value={money0(b.extra_work_amount)} /> : null}
          <Row2 label="Final Amount" value={money0(b.final_amount)} />
        </Group>
      </div>
      {insts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Payment Schedule</div>
          <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['#', 'Due Date', '%', 'Amount', 'Type'].map((h) => <th key={h} style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 10, padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {insts.map((i, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--surface-2)' }}>{idx + 1}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--surface-2)' }}>{fmtDate(i.date)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--surface-2)' }}>{i.pct != null ? i.pct + '%' : '—'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--surface-2)', fontWeight: 700 }}>{money0(i.amt)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--surface-2)', color: 'var(--muted)' }}>{i.isNsd ? 'Extra Work' : i.isExtra ? 'Legal & Other' : 'Unit Price'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
