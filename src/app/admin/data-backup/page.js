'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { isSuperAdmin } from '../../../lib/moduleAccess';

const GREEN = '#15803D';
const RED   = '#DC2626';
const AMBER = '#B45309';

const STATUS_CFG = {
  success: { label: 'Success', color: GREEN, bg: '#ECFDF3' },
  failed:  { label: 'Failed',  color: RED,   bg: '#FEF2F2' },
  running: { label: 'Running', color: AMBER, bg: '#FFFBEB' },
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function DataBackupPage() {
  const user = useSelector((s) => s.auth.user);
  const superAdmin = isSuperAdmin(user);

  const [settings, setSettings] = useState(null);
  const [frequency, setFrequency] = useState('weekly');
  const [enabled, setEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const loadSettings = useCallback(() => {
    fetch(SALES_ENDPOINTS.backupSettings, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setSettings(d); setFrequency(d.frequency); setEnabled(d.is_enabled); } });
  }, []);

  const loadRecords = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.backups, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRecords(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!superAdmin) return;
    loadSettings();
    loadRecords();
  }, [superAdmin, loadSettings, loadRecords]);

  async function saveSettings() {
    setSavingSettings(true); setSettingsMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupSettings, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ frequency, is_enabled: enabled }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSettings(d); setSettingsMsg('✅ Saved.'); }
      else setSettingsMsg('Error: ' + (d.detail || res.status));
    } catch (e) { setSettingsMsg(e.message); }
    setSavingSettings(false);
  }

  async function runNow() {
    setRunning(true); setRunMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupRun, { method: 'POST', headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setRunMsg('✅ Backup completed.');
      else setRunMsg('Backup failed: ' + (d.error_message || d.detail || res.status));
      loadRecords();
    } catch (e) { setRunMsg(e.message); }
    setRunning(false);
  }

  async function download(id) {
    setDownloadingId(id);
    try {
      const res = await fetch(SALES_ENDPOINTS.backupDownload(id), { headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      else alert('Could not get a download link: ' + (d.detail || res.status));
    } catch (e) { alert(e.message); }
    setDownloadingId(null);
  }

  if (!superAdmin) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Super admin access only.</div>;
  }

  const dirty = settings && (frequency !== settings.frequency || enabled !== settings.is_enabled);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 780 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Data Backup</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 20 }}>
        A full backup of every business record (leads, bookings, projects, Club 1000, users) is taken
        automatically on the schedule below and stored securely. Restoring a backup is a deliberate,
        assisted operation — not a button here — ask your platform admin when you actually need one restored.
      </p>

      {/* Schedule */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 14 }}>
          Backup Schedule
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
              style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 160 }}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', height: 40 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Automatic backups enabled
          </label>
          <button onClick={saveSettings} disabled={!dirty || savingSettings}
            style={{ height: 40, padding: '0 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
              background: dirty ? '#182350' : '#C7D2FE', color: '#fff', cursor: dirty && !savingSettings ? 'pointer' : 'not-allowed' }}>
            {savingSettings ? 'Saving…' : 'Save'}
          </button>
        </div>
        {settings?.updated_by_name && (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
            Last changed by {settings.updated_by_name} · {fmtDateTime(settings.updated_at)}
          </p>
        )}
        {!!settingsMsg && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: settingsMsg[0] === '✅' ? GREEN : RED }}>{settingsMsg}</p>}
      </div>

      {/* Run now */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Run a backup right now</div>
          <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>Doesn't affect the schedule above — useful before a risky change.</div>
        </div>
        <button onClick={runNow} disabled={running}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800,
            background: running ? '#93A3F5' : '#3D5AFE', color: '#fff', cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? 'Backing up…' : 'Run Backup Now'}
        </button>
      </div>
      {!!runMsg && <p style={{ marginTop: -8, marginBottom: 18, fontSize: 13, fontWeight: 600, color: runMsg[0] === '✅' ? GREEN : RED }}>{runMsg}</p>}

      {/* History */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F0F3FA' }}>
          Backup History
        </div>
        {loading ? (
          <p style={{ padding: 18, color: '#8492A6', fontSize: 13 }}>Loading…</p>
        ) : records.length === 0 ? (
          <p style={{ padding: 18, color: '#8492A6', fontSize: 13 }}>No backups yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={th}>Size</th>
                <th style={th}>Triggered By</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.running;
                return (
                  <tr key={r.id}>
                    <td style={td}>{fmtDateTime(r.started_at)}</td>
                    <td style={td}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td style={td}>{fmtSize(r.file_size_bytes)}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{r.triggered_by_name || 'Automatic'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {r.status === 'success' && (
                        <button onClick={() => download(r.id)} disabled={downloadingId === r.id}
                          style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE', background: 'none', border: '1.5px solid #3D5AFE40', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                          {downloadingId === r.id ? '…' : '⬇ Download'}
                        </button>
                      )}
                      {r.status === 'failed' && r.error_message && (
                        <span title={r.error_message} style={{ fontSize: 11, color: RED }}>⚠ {r.error_message.slice(0, 40)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };
