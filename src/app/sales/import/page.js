'use client';
import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const AUTO_PATTERNS = {
  name:      /^(full.?name|name|customer.?name|lead.?name|first.?name|fullname)$/i,
  name2:     /^(last.?name|surname|family.?name|lastname)$/i,
  phone:     /^(phone|phone.?number|mobile|mobile.?number|contact|cell|phone_number|phonenumber)$/i,
  alt_phone: /^(alt.?phone|alternate.*phone|phone.?2|secondary.?phone|other.?phone|alt_phone)$/i,
  email:     /^(email|e.?mail|email.?address)$/i,
  campaign:  /^(campaign|campaign.?name|meta.?campaign|utm.?campaign|ad.?campaign|campaign_name)$/i,
  adset:     /^(adset|adset.?name|ad.?set|ad.?group.?name|adgroup)$/i,
  creative:  /^(ad.?name|creative|creative.?name|ad.?creative|advertisement.?name)$/i,
  date:      /^(date|created|created.?at|submission.?date|timestamp|lead.?date)$/i,
};

// Lifecycle columns from the Full-Pipeline template — auto-mapped by exact header name.
const PIPELINE_FIELDS = [
  'project', 'source', 'requirement', 'budget_min', 'budget_max', 'preferred_location', 'overall_status',
  'telecaller_id', 'telecaller_status', 'telecaller_remarks',
  'stm_id', 'stm_status', 'stm_remarks',
  'sv_scheduled_date', 'sv_visited_date', 'sv_status', 'sv_referred_by_id', 'sv_remarks',
  'closure_date', 'closure_status', 'unit_no', 'unit_type', 'booking_amount', 'total_amount', 'closure_remarks',
];

function autoDetect(headers) {
  const m = { name: '', name2: '', phone: '', alt_phone: '', email: '', campaign: '', adset: '', creative: '', date: '' };
  for (const key of Object.keys(AUTO_PATTERNS)) {
    const match = headers.find((h) => AUTO_PATTERNS[key].test(h.trim()));
    if (match) m[key] = match;
  }
  // Pipeline columns: exact snake_case header match (as produced by the template).
  for (const f of PIPELINE_FIELDS) {
    const match = headers.find((h) => h.trim().toLowerCase() === f);
    if (match) m[f] = match;
  }
  return m;
}

function getCell(raw, col) {
  if (!col) return '';
  const val = raw[col];
  if (val instanceof Date) return val.toISOString();
  return String(val ?? '').trim();
}

function applyMapping(raw, m) {
  let name = getCell(raw, m.name);
  if (m.name2) { const last = getCell(raw, m.name2); if (last) name = name ? `${name} ${last}` : last; }
  const out = {
    name, phone: getCell(raw, m.phone), alt_phone: getCell(raw, m.alt_phone), email: getCell(raw, m.email),
    campaign: getCell(raw, m.campaign), adset: getCell(raw, m.adset), creative: getCell(raw, m.creative), date: getCell(raw, m.date),
  };
  for (const f of PIPELINE_FIELDS) out[f] = getCell(raw, m[f]);
  return out;
}

const BATCH = 200;

export default function ImportPage() {
  const router  = useRouter();
  const user    = useSelector((s) => s.auth.user);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const fileRef = useRef(null);
  const [step,      setStep]      = useState(1);
  const [projects,  setProjects]  = useState([]);
  const [sources,   setSources]   = useState([]);
  const [users,     setUsers]     = useState([]);
  const [fileName,  setFileName]  = useState('');
  const [headers,   setHeaders]   = useState([]);
  const [rawRows,   setRawRows]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const [projectId, setProjectId] = useState('');
  const [sourceId,  setSourceId]  = useState('');
  const [parsing,   setParsing]   = useState(false);
  const [preview,   setPreview]   = useState([]);
  const [totalValid,   setTotalValid]   = useState(0);
  const [totalInvalid, setTotalInvalid] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [result,    setResult]    = useState(null);

  useEffect(() => {
    fetch(SALES_ENDPOINTS.projects + '?active_only=true', { headers: authHeaders() }).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setProjects(d); });
    fetch(SALES_ENDPOINTS.sources, { headers: authHeaders() }).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setSources(d); });
    fetch(SALES_ENDPOINTS.usersSlim, { headers: authHeaders() }).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setUsers(d); }).catch(() => {});
  }, []);

  async function handleFile(file) {
    setParsing(true);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!data.length) { setParsing(false); return; }
      const hdrs = Object.keys(data[0]);
      setHeaders(hdrs);
      setRawRows(data);
      setMapping(autoDetect(hdrs));
    } catch { alert('Failed to parse file'); }
    finally { setParsing(false); }
  }

  function buildPreview() {
    if (!mapping.name || !mapping.phone) { alert('Map Name and Phone columns first'); return; }
    let valid = 0, invalid = 0;
    const rows = rawRows.map((raw, idx) => {
      const mapped = applyMapping(raw, mapping);
      let error;
      if (!mapped.name) error = 'Missing name';
      else if (!mapped.phone || mapped.phone.replace(/\D/g, '').length < 7) error = 'Invalid phone';
      if (error) invalid++; else valid++;
      return { idx, ...mapped, valid: !error, error };
    });
    setPreview(rows);
    setTotalValid(valid);
    setTotalInvalid(invalid);
    setStep(2);
  }

  async function runImport() {
    setStep(3);
    setImporting(true);
    setProgress(0);
    const valid = preview.filter((r) => r.valid);
    const batches = [];
    for (let i = 0; i < valid.length; i += BATCH) batches.push(valid.slice(i, i + BATCH));

    let imported = 0, duplicates = 0, errors = 0, siteVisits = 0, closures = 0, failed = [];

    for (let b = 0; b < batches.length; b++) {
      const leads = batches[b].map((r) => {
        const lead = {
          name: r.name, phone: r.phone, alt_phone: r.alt_phone || '',
          email: r.email || '', campaign: r.campaign || '', adset: r.adset || '',
          creative: r.creative || '', lead_date: r.date || '',
        };
        for (const f of PIPELINE_FIELDS) lead[f] = r[f] || '';
        return lead;
      });
      const res  = await fetch(SALES_ENDPOINTS.import_, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ leads, project_id: projectId || null, source_id: sourceId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        imported   += data.imported || 0;
        duplicates += data.duplicates || 0;
        errors     += data.errors || 0;
        siteVisits += data.site_visits || 0;
        closures   += data.closures || 0;
        failed     = failed.concat(data.failed || []);
      } else {
        errors += batches[b].length;
      }
      setProgress(Math.round(((b + 1) / batches.length) * 100));
    }
    setResult({ imported, duplicates, errors, siteVisits, closures, failed });
    setImporting(false);
  }

  function reset() {
    setStep(1); setFileName(''); setHeaders([]); setRawRows([]);
    setMapping({}); setProjectId(''); setSourceId('');
    setPreview([]); setResult(null); setProgress(0);
  }

  async function downloadTemplate(type) {
    // Full lifecycle template (exceljs) — every column from lead → telecaller → STM →
    // site visit → closure, WITH dropdowns on the status / project / source columns,
    // plus a Reference sheet for the team id ↔ name lookup.
    if (type === 'full') {
      const xlMod = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = xlMod.Workbook ? xlMod : (xlMod.default || xlMod);

      const cols = [
        'name', 'phone', 'alt_phone', 'email', 'project', 'source', 'campaign', 'adset', 'ad_name',
        'requirement', 'budget_min', 'budget_max', 'preferred_location', 'lead_date', 'overall_status',
        'telecaller_id', 'telecaller_status', 'telecaller_remarks',
        'stm_id', 'stm_status', 'stm_remarks',
        'sv_scheduled_date', 'sv_visited_date', 'sv_status', 'sv_referred_by_id', 'sv_remarks',
        'closure_date', 'closure_status', 'unit_no', 'unit_type', 'booking_amount', 'total_amount', 'closure_remarks',
      ];
      const STATUS = {
        overall_status: 'new,assigned,contacted,not_reachable,warm_transferred,hot,warm,cold,not_interested,sv_scheduled,sv_done,closed,lost',
        telecaller_status: 'warm,cold,not_interested,not_reachable,callback',
        stm_status: 'hot,warm,cold,not_interested,sv_scheduled,sv_done,closed',
        sv_status: 'scheduled,completed,cancelled,no_show',
        closure_status: 'booked,cancelled,refunded',
      };
      const tcId = users.find((u) => /tele/i.test(u.designation || u.role || ''))?.id ?? users[0]?.id ?? '';
      const stmId = users.find((u) => /stm|sales|manager/i.test(u.designation || u.role || ''))?.id ?? users[1]?.id ?? users[0]?.id ?? '';
      const ex1 = { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@example.com', source: (sources[0]?.name || 'meta'), campaign: 'Meta - Luxury Homes', ad_name: 'Video 2BHK', lead_date: '01-05-2025', overall_status: 'new', telecaller_id: tcId, telecaller_status: 'callback', telecaller_remarks: 'Call back evening' };
      const ex2 = { name: 'Priya Mehta', phone: '9988776655', email: 'priya@example.com', project: (projects[0]?.name || 'Kalrav'), source: (sources[0]?.name || 'walk-in'), lead_date: '02-04-2025', overall_status: 'closed', telecaller_id: tcId, telecaller_status: 'warm', stm_id: stmId, stm_status: 'closed', sv_scheduled_date: '05-04-2025', sv_visited_date: '06-04-2025', sv_status: 'completed', sv_remarks: 'Liked plot A-12', closure_date: '08-04-2025', closure_status: 'booked', unit_no: 'A-12', unit_type: '2BHK', booking_amount: '200000', total_amount: '5000000', closure_remarks: 'Token received' };

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Leads');
      const refSheet = wb.addWorksheet('Reference — IDs & values');
      const lists = wb.addWorksheet('Lists'); lists.state = 'hidden';

      ws.addRow(cols);
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF182350' } };
      const rowFrom = (o) => cols.map((c) => o[c] ?? '');
      ws.addRow(rowFrom(ex1));
      ws.addRow(rowFrom(ex2));
      ws.columns = cols.map((c) => ({ width: Math.min(26, Math.max(12, c.length + 3)) }));
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      // Hidden helper ranges feeding the project/source dropdowns.
      const projNames = projects.map((p) => p.name).filter(Boolean);
      const srcNames = sources.map((s) => s.name).filter(Boolean);
      projNames.forEach((n, i) => { lists.getCell(`A${i + 1}`).value = n; });
      srcNames.forEach((n, i) => { lists.getCell(`B${i + 1}`).value = n; });

      const colLetter = (idx) => { let s = '', n = idx; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
      const colOf = (name) => colLetter(cols.indexOf(name) + 1);

      // Mark required columns (name, phone) with a red header so they stand out.
      ['name', 'phone'].forEach((f) => {
        const cell = ws.getCell(`${colOf(f)}1`);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC62828' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });
      // Highlight the closure columns (the "sold" record) in purple — closure_date
      // is what actually creates the Closure, so the whole group is grouped by colour.
      ['closure_date', 'closure_status', 'unit_no', 'unit_type', 'booking_amount', 'total_amount', 'closure_remarks'].forEach((f) => {
        const cell = ws.getCell(`${colOf(f)}1`);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });
      const MAXROW = 1000;
      const addDV = (name, formula) => ws.dataValidations.add(`${colOf(name)}2:${colOf(name)}${MAXROW}`, {
        type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true,
        errorStyle: 'warning', errorTitle: 'Pick from the list', error: 'Use one of the dropdown values.',
      });
      for (const [field, vals] of Object.entries(STATUS)) addDV(field, `"${vals}"`);
      if (projNames.length) addDV('project', `Lists!$A$1:$A$${projNames.length}`);
      if (srcNames.length) addDV('source', `Lists!$B$1:$B$${srcNames.length}`);

      refSheet.addRow(['— TEAM — put this id in telecaller_id / stm_id / sv_referred_by_id —']);
      refSheet.addRow(['id', 'name', 'role / designation', 'phone']).font = { bold: true };
      users.forEach((u) => refSheet.addRow([u.id, u.name, (u.designation || u.role || ''), u.phone || '']));
      refSheet.addRow([]);
      refSheet.addRow(['— ALLOWED VALUES (the Leads sheet has dropdowns for these) —']);
      refSheet.addRow(['overall_status', STATUS.overall_status.replace(/,/g, ', ')]);
      refSheet.addRow(['telecaller_status', STATUS.telecaller_status.replace(/,/g, ', ')]);
      refSheet.addRow(['stm_status', STATUS.stm_status.replace(/,/g, ', ')]);
      refSheet.addRow(['sv_status', STATUS.sv_status.replace(/,/g, ', ')]);
      refSheet.addRow(['closure_status', STATUS.closure_status.replace(/,/g, ', ')]);
      refSheet.addRow([]);
      refSheet.addRow(['— NOTES —']);
      refSheet.addRow(['Header colours: RED = required (name, phone). PURPLE = closure columns (fill closure_date to record a sold deal).']);
      refSheet.addRow(['Dates: dd-mm-yyyy (e.g. 08-04-2025).']);
      refSheet.addRow(['project / source: pick from the dropdown (must already exist). Leave blank to skip.']);
      refSheet.addRow(['Fill any sv_* column to create a Site Visit. Fill closure_date to create a Closure.']);
      refSheet.addRow(['overall_status auto-fills from the furthest stage if you leave it blank.']);
      refSheet.columns = [{ width: 24 }, { width: 62 }, { width: 22 }, { width: 16 }];

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'vistara_pipeline_import_template.xlsx'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    const XLSX = await import('xlsx');

    const rows = type === 'meta' ? [
      { full_name: 'Rahul Sharma', phone_number: '9876543210', alt_phone: '', email: 'rahul@example.com', campaign_name: 'Meta - Luxury Homes May 2025', ad_name: 'Video - 2BHK Walkthrough', lead_date: '01-05-2025' },
      { full_name: 'Priya Mehta',  phone_number: '9988776655', alt_phone: '', email: '',                  campaign_name: 'Meta - 2BHK Campaign',          ad_name: 'Carousel',             lead_date: '02-05-2025' },
    ] : [
      { full_name: 'Rahul Sharma', phone_number: '9876543210', alt_phone: '', email: 'rahul@example.com', lead_date: '01-05-2025' },
      { full_name: 'Priya Mehta',  phone_number: '9988776655', alt_phone: '', email: '',                  lead_date: '02-05-2025' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, type === 'meta' ? 'meta_leads_template.xlsx' : 'general_leads_template.xlsx');
  }

  function ColSelect({ field, label }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#8492A6', width: 160, flexShrink: 0 }}>{label}</span>
        <select value={mapping[field] || ''} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))} style={{ ...inp, flex: 1 }}>
          <option value="">— skip —</option>
          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Import Leads</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>Upload Excel or CSV — Meta Ads export, CRM export, or any spreadsheet</p>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 6 }}>Download template</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => downloadTemplate('full')} style={{ ...outlineBtn, borderColor: '#3D5AFE', color: '#3D5AFE', fontWeight: 700 }}>↓ Full Pipeline</button>
            <button onClick={() => downloadTemplate('meta')} style={outlineBtn}>↓ Meta Ads</button>
            <button onClick={() => downloadTemplate('general')} style={outlineBtn}>↓ General</button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {['Upload & Map', 'Preview', 'Import'].map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, backgroundColor: step === s ? '#182350' : step > s ? '#2E7D32' : '#E0E6F0', color: step >= s ? '#fff' : '#8492A6' }}>
                {step > s ? '✓' : s}
              </span>
              <span style={{ fontSize: 13, color: step === s ? '#1A1A2E' : '#8492A6', fontWeight: step === s ? 600 : 400 }}>{label}</span>
              {i < 2 && <span style={{ color: '#D1D5DB', margin: '0 4px' }}>›</span>}
            </div>
          );
        })}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          <div
            style={{ border: `2px dashed ${rawRows.length ? '#2E7D32' : '#D1D5DB'}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', backgroundColor: rawRows.length ? '#F0FDF4' : '#FAFBFE' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {parsing ? (
              <p style={{ color: '#8492A6' }}>Parsing file…</p>
            ) : rawRows.length ? (
              <>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32', marginBottom: 4 }}>📊 {fileName}</p>
                <p style={{ color: '#8492A6', fontSize: 13 }}>{rawRows.length.toLocaleString()} rows · {headers.length} columns · Click to change</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>Drop file here or click to browse</p>
                <p style={{ color: '#8492A6', fontSize: 13 }}>Supports .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {rawRows.length > 0 && (
            <>
              {/* Project + Source */}
              <div style={card}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>Assign imported leads to</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Project *</label>
                    <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inp}>
                      <option value="">Select project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Lead Source *</label>
                    <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={inp}>
                      <option value="">Select source</option>
                      {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Column mapping */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>Map columns</h3>
                  <span style={{ fontSize: 11, color: '#8492A6', backgroundColor: '#F0F3FA', padding: '3px 8px', borderRadius: 6 }}>Auto-detected</span>
                </div>
                <ColSelect field="name"      label="Full Name *" />
                <ColSelect field="name2"     label="Last Name (optional)" />
                <ColSelect field="phone"     label="Phone *" />
                <ColSelect field="alt_phone" label="Alt Phone" />
                <ColSelect field="email"     label="Email" />
                <ColSelect field="campaign"  label="Campaign Name" />
                <ColSelect field="creative"  label="Ad / Creative Name" />
                <ColSelect field="date"      label="Lead Date" />

                {(() => {
                  const detected = PIPELINE_FIELDS.filter((f) => mapping[f]);
                  if (!detected.length) return null;
                  return (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E0E6F0' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>✓ {detected.length} pipeline columns auto-detected (telecaller, STM, site visit &amp; closure)</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {detected.map((f) => <span key={f} style={{ fontSize: 11, fontWeight: 600, color: '#3D5AFE', background: '#EEF1FF', padding: '3px 8px', borderRadius: 6 }}>{f}</span>)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Raw preview */}
              <div style={{ ...card, overflowX: 'auto' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>File preview — first 5 rows</p>
                <table style={{ ...tbl, fontSize: 12 }}>
                  <thead><tr style={{ backgroundColor: '#F8FAFD' }}>{headers.map((h) => <th key={h} style={{ ...th, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rawRows.slice(0, 5).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F0F3FA' }}>{headers.map((h) => <td key={h} style={{ ...tdS, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r[h] instanceof Date ? r[h].toLocaleDateString() : (r[h] ?? ''))}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={buildPreview} style={saveBtn}>Preview Import →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="rg-3" style={{ gap: 12 }}>
            {[
              { label: 'Total rows', value: rawRows.length, color: '#1A1A2E' },
              { label: 'Ready to import', value: totalValid, color: '#2E7D32' },
              { label: 'Will be skipped', value: totalInvalid, color: '#EF4444' },
            ].map((s) => (
              <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</p>
                <p style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {totalInvalid > 0 && (
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
              ⚠ Rows missing Name or a valid Phone will be skipped. Duplicate phone numbers will be flagged in leads.
            </div>
          )}

          <div style={{ ...card, overflowX: 'auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Mapped preview — first 20 rows</p>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}><tr>{['#','Name','Phone','Email','Campaign','Valid?'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.slice(0, 20).map((r) => (
                  <tr key={r.idx} style={{ borderBottom: '1px solid #F0F3FA', backgroundColor: !r.valid ? '#FFF5F5' : '' }}>
                    <td style={tdS}>{r.idx + 1}</td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{r.name || <span style={{ color: '#EF4444' }}>—</span>}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{r.phone || <span style={{ color: '#EF4444' }}>—</span>}</td>
                    <td style={tdS}>{r.email || '—'}</td>
                    <td style={{ ...tdS, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign || '—'}</td>
                    <td style={tdS}>
                      {r.valid
                        ? <span style={{ color: '#2E7D32', fontWeight: 700 }}>✓ OK</span>
                        : <span style={{ color: '#EF4444', fontWeight: 700 }}>{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={outlineBtn}>← Back</button>
            <button onClick={runImport} disabled={totalValid === 0} style={{ ...saveBtn, opacity: totalValid === 0 ? 0.5 : 1 }}>
              Import {totalValid.toLocaleString()} leads →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {importing ? (
            <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A2E', marginBottom: 8 }}>Importing leads…</p>
              <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 20 }}>Please don't close this tab</p>
              <div style={{ height: 8, backgroundColor: '#E0E6F0', borderRadius: 4, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                <div style={{ height: '100%', backgroundColor: '#182350', borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 12, color: '#8492A6', marginTop: 8 }}>{progress}%</p>
            </div>
          ) : result && (
            <>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>✓ Import complete</p>
              <div className="rg-3" style={{ gap: 12 }}>
                {[
                  { label: 'New leads imported', value: result.imported, color: '#2E7D32' },
                  { label: 'Duplicates flagged', value: result.duplicates, color: '#F9A825' },
                  { label: 'Errors / failed', value: result.errors, color: '#EF4444' },
                ].map((s) => (
                  <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                    <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</p>
                    <p style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {(result.siteVisits > 0 || result.closures > 0) && (
                <div className="rg-3" style={{ gap: 12 }}>
                  {[
                    { label: 'Site visits created', value: result.siteVisits, color: '#0D47A1' },
                    { label: 'Closures created', value: result.closures, color: '#7C3AED' },
                  ].map((s) => (
                    <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                      <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{(s.value || 0).toLocaleString()}</p>
                      <p style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#1E40AF' }}>
                <strong>What happens next?</strong><br />
                Rows that carried a <strong>telecaller_id / stm_id</strong> are linked to those people with their statuses, site visits and closures — visible everywhere (Leads, My Conversions, Reports) on web and app. Rows with no owner come in as <strong>new</strong> and are auto-sent to <strong>Distribution</strong>.
              </div>
              <button onClick={reset} style={outlineBtn}>Import another file</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const card = { backgroundColor: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const tbl  = { width: '100%', borderCollapse: 'collapse' };
const th   = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: 0.5 };
const tdS  = { padding: '8px 12px', fontSize: 12 };
const saveBtn   = { padding: '10px 22px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const outlineBtn = { padding: '8px 16px', backgroundColor: '#fff', border: '1.5px solid #E0E6F0', borderRadius: 9, fontSize: 13, color: '#1A1A2E', fontWeight: 600, cursor: 'pointer' };
