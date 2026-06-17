'use client';
import { useState, useEffect } from 'react';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const PRESET_SOURCES = ['meta', 'google', 'referral', 'walk-in', 'ivr', 'portal', 'other'];

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding,  setAdding]  = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    fetch(SALES_ENDPOINTS.sources, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setSources(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addSource(name) {
    const n = name.trim().toLowerCase();
    if (!n) { setErr('Source name is required.'); return; }
    if (sources.find((s) => s.name === n)) { setErr('Source already exists.'); return; }
    setAdding(true); setErr('');
    const res  = await fetch(SALES_ENDPOINTS.sources, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: n }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setErr(data.detail || JSON.stringify(data)); return; }
    setSources((prev) => [...prev, data]);
    setNewName('');
  }

  const existingNames = new Set(sources.map((s) => s.name));

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Lead Sources</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Manage where your leads come from</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Existing sources */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Active Sources</h2>
          {loading ? (
            <p style={{ color: '#8492A6', fontSize: 13 }}>Loading…</p>
          ) : sources.length === 0 ? (
            <p style={{ color: '#8492A6', fontSize: 13 }}>No sources yet. Add one →</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sources.map((s) => (
                <span key={s.id} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  backgroundColor: '#F0F3FA', color: '#182350', textTransform: 'capitalize',
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add source */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Add Source</h2>

          {/* Quick add presets */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 8 }}>QUICK ADD</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {PRESET_SOURCES.filter((n) => !existingNames.has(n)).map((name) => (
              <button key={name} onClick={() => addSource(name)} disabled={adding}
                style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px dashed #E0E6F0', backgroundColor: '#fff', fontSize: 12, color: '#8492A6', cursor: 'pointer', textTransform: 'capitalize' }}>
                + {name}
              </button>
            ))}
            {PRESET_SOURCES.every((n) => existingNames.has(n)) && (
              <p style={{ fontSize: 12, color: '#8492A6' }}>All presets added.</p>
            )}
          </div>

          {/* Custom add */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 8 }}>CUSTOM</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSource(newName)}
              placeholder="e.g. instagram, naukri…"
              style={{ ...inp, flex: 1 }}
            />
            <button onClick={() => addSource(newName)} disabled={adding || !newName}
              style={{ ...saveBtn, opacity: (adding || !newName) ? 0.5 : 1 }}>
              {adding ? '…' : 'Add'}
            </button>
          </div>
          {err && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}

const inp    = { height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const saveBtn = { padding: '9px 16px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const card   = { backgroundColor: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
