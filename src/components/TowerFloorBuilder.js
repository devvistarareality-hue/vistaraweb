'use client';
import { useState } from 'react';
import MediaUpload from './MediaUpload';
import { toPlanImage } from '../utils/planImage';

/* Shared by Add/Edit Project and the Manage Plots page so a tower is defined the same
   way in both — the modal is the only route in before any units exist. */
/* ─── Tower Floor Builder ───
   Plotted schemes get a flat list of plot numbers; a tower (Pratishtha: G+13) is
   defined floor by floor — each floor has its own numbering run and its own plan
   drawing. Ground is floor 0, so "Shop1–Shop12" on the ground and "101–107",
   "201–207" upward all come out of the same prefix + from/to rule. */
const ordinal = (n) => {
  if (n === 0) return 'Ground';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]) + ' Floor';
};

// A floor's units: prefix + every number from..to. Ground normally carries a word
// prefix ("Shop"), upper floors a bare 3-digit run keyed off the floor number.
function unitsForFloor(f) {
  const from = parseInt(f.from, 10), to = parseInt(f.to, 10);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  if (to - from > 200) return [];   // guard against a stray keystroke generating thousands
  const out = [];
  for (let n = from; n <= to; n++) out.push(`${f.prefix || ''}${n}`);
  return out;
}

export default function TowerFloorBuilder({ floors, setFloors, folder, existing = new Set(), onPersist, onGenerate, generating = false, note }) {

  const [msg, setMsg] = useState('');
  const [converting, setConverting] = useState(null);   // floor index mid PDF→PNG
  const persist = (next) => { if (onPersist) onPersist(next); };
  const update = (i, patch) => {
    const next = floors.map((f, ix) => (ix === i ? { ...f, ...patch } : f));
    setFloors(next); return next;
  };
  const commit = (next) => { setFloors(next); persist(next); };

  function addFloor() {
    const top = floors.reduce((m, f) => Math.max(m, Number(f.floor) || 0), -1) + 1;
    // Upper floors follow the 101/201/301 convention off the floor number.
    commit([...floors, { floor: top, label: ordinal(top), prefix: '', from: top * 100 + 1, to: top * 100 + 7, image_url: '' }]);
  }

  // Towers repeat: floors 2..13 are usually floor 1 with a different hundreds digit.
  function repeatUpTo(i, topFloor) {
    const src = floors[i];
    const base = Number(src.floor) || 0;
    const span = (parseInt(src.to, 10) || 0) - (parseInt(src.from, 10) || 0);
    const offset = (parseInt(src.from, 10) || 0) - base * 100;   // e.g. 101 - 1*100 = 1
    const next = [...floors];
    for (let fl = base + 1; fl <= topFloor; fl++) {
      if (next.some((f) => Number(f.floor) === fl)) continue;
      next.push({ floor: fl, label: ordinal(fl), prefix: src.prefix || '',
        from: fl * 100 + offset, to: fl * 100 + offset + span, image_url: src.image_url || '' });
    }
    next.sort((a, b) => (Number(a.floor) || 0) - (Number(b.floor) || 0));
    commit(next);
  }

  function removeFloor(i) {
    if (!window.confirm(`Remove ${floors[i].label} from the plan? Units already generated are kept.`)) return;
    commit(floors.filter((_, ix) => ix !== i));
  }

  async function setPlan(i, url) {
    setConverting(i); setMsg('');
    const r = await toPlanImage(url, folder, `floor_${floors[i].floor ?? i}`);
    commit(floors.map((x, ix) => (ix === i ? { ...x, image_url: r.url } : x)));
    if (r.error) setMsg('Uploaded the PDF, but could not render a preview: ' + r.error);
    setConverting(null);
  }

  const planned = floors.flatMap((f) => unitsForFloor(f).map((number) => ({ number, floor: Number(f.floor) || 0 })));
  const toCreate = planned.filter((u) => !existing.has(u.number));
  const dupes = planned.length - new Set(planned.map((u) => u.number)).size;

  const inp = { height: 34, padding: '0 9px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          
          <button type="button" onClick={addFloor} style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #C7D2FE', background: '#fff', color: '#3D5AFE', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Add Floor
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {floors.length === 0 && <p style={{ fontSize: 13, color: '#8492A6' }}>No floors yet — add one to begin.</p>}
        {floors.map((f, i) => {
          const units = unitsForFloor(f);
          const isNew = units.filter((n) => !existing.has(n)).length;
          return (
            <div key={i} style={{ border: '1.5px solid #E6EBF4', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ width: 62 }}>
                  <label style={lblSm}>Floor</label>
                  <input type="number" value={f.floor} onChange={(e) => setFloors(update(i, { floor: e.target.value }))}
                    onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                </div>
                <div style={{ width: 130 }}>
                  <label style={lblSm}>Label</label>
                  <input value={f.label || ''} onChange={(e) => setFloors(update(i, { label: e.target.value }))}
                    onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                </div>
                <div style={{ width: 96 }}>
                  <label style={lblSm}>Prefix</label>
                  <input value={f.prefix || ''} placeholder="e.g. Shop" onChange={(e) => setFloors(update(i, { prefix: e.target.value }))}
                    onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                </div>
                <div style={{ width: 78 }}>
                  <label style={lblSm}>From</label>
                  <input type="number" value={f.from} onChange={(e) => setFloors(update(i, { from: e.target.value }))}
                    onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                </div>
                <div style={{ width: 78 }}>
                  <label style={lblSm}>To</label>
                  <input type="number" value={f.to} onChange={(e) => setFloors(update(i, { to: e.target.value }))}
                    onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                </div>
                <button type="button" onClick={() => removeFloor(i)} title="Remove floor"
                  style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: units.length ? '#374151' : '#DC2626' }}>
                  {units.length
                    ? <>{units.length} unit{units.length === 1 ? '' : 's'}: <b>{units.slice(0, 3).join(', ')}{units.length > 3 ? ` … ${units[units.length - 1]}` : ''}</b>
                        {isNew === 0 && <span style={{ color: '#15803D', marginLeft: 6 }}>· all exist</span>}
                        {isNew > 0 && isNew < units.length && <span style={{ color: '#B45309', marginLeft: 6 }}>· {isNew} new</span>}</>
                    : 'Set From / To to generate unit numbers.'}
                </span>
                <button type="button" onClick={() => { const top = Number(window.prompt('Repeat this floor\'s layout up to which floor?', '13')); if (top) repeatUpTo(i, top); }}
                  style={{ padding: '5px 11px', borderRadius: 7, border: '1.5px solid #E0E6F0', background: '#fff', color: '#3D5AFE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ↓ Repeat up to…
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                {converting === i ? (
                  <span style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 600 }}>Converting PDF to an image…</span>
                ) : f.image_url ? (
                  <>
                    {/\.pdf(\?|$)/i.test(f.image_url)
                      ? <a href={f.image_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 600 }}>📄 View PDF ↗</a>
                      : <img src={f.image_url} alt={f.label} style={{ width: 78, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #E6EBF4' }} />}
                    <button type="button" onClick={() => commit(floors.map((x, ix) => ix === i ? { ...x, image_url: '' } : x))}
                      style={{ padding: '5px 11px', borderRadius: 7, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Remove plan</button>
                  </>
                ) : (
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <MediaUpload value="" label=""
                      onChange={(url) => setPlan(i, url)}
                      folder={folder} accept="image/*,application/pdf"
                      hint={`Upload ${f.label || 'floor'} plan (JPG / PNG / PDF)`} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {planned.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid #F0F3FA', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <b>{planned.length}</b> units planned across <b>{floors.length}</b> floors ·{' '}
            <span style={{ color: toCreate.length ? '#B45309' : '#15803D', fontWeight: 700 }}>
              {toCreate.length ? `${toCreate.length} to create` : 'all already created'}
            </span>
            {dupes > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}> · {dupes} duplicate number{dupes === 1 ? '' : 's'} across floors</span>}
            {note && <div style={{ fontSize: 11, color: '#8492A6', marginTop: 4 }}>{note}</div>}
          </div>
          {onGenerate && (
            <button type="button" onClick={() => onGenerate(toCreate)} disabled={generating || !toCreate.length}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff',
                background: toCreate.length && !generating ? 'linear-gradient(135deg,#182350,#3D5AFE)' : '#C7D2FE', cursor: toCreate.length && !generating ? 'pointer' : 'not-allowed' }}>
              {generating ? 'Generating…' : `Generate ${toCreate.length} Units`}
            </button>
          )}
        </div>
      )}
      {!!msg && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg[0] === '✅' ? '#15803D' : '#DC2626' }}>{msg}</p>}
    </div>
  );
}
const lblSm = { display: 'block', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 };
