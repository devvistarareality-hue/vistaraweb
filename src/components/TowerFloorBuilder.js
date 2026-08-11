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
// A multi-block tower puts the block in front — "A-101" — so unit numbers stay unique
// across blocks that repeat the same numbering, which they normally do.
export function blockPrefix(f) { return f && f.block ? `${f.block}-` : ''; }
export function unitsForFloor(f) {
  const from = parseInt(f.from, 10), to = parseInt(f.to, 10);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  if (to - from > 200) return [];   // guard against a stray keystroke generating thousands
  const out = [];
  for (let n = from; n <= to; n++) out.push(`${blockPrefix(f)}${f.prefix || ''}${n}`);
  return out;
}
// Distinct blocks in definition order; [''] for a single-block tower.
export function blocksOf(floors) {
  const seen = [];
  (floors || []).forEach((f) => { const b = f.block || ''; if (!seen.includes(b)) seen.push(b); });
  return seen.length ? seen : [''];
}

export default function TowerFloorBuilder({ floors, setFloors, folder, existing = new Set(), onPersist, onGenerate, generating = false, note, industrial = false }) {

  const [msg, setMsg] = useState('');
  const [converting, setConverting] = useState(null);   // floor index mid PDF→PNG
  const persist = (next) => { if (onPersist) onPersist(next); };
  const update = (i, patch) => {
    const next = floors.map((f, ix) => (ix === i ? { ...f, ...patch } : f));
    setFloors(next); return next;
  };
  const commit = (next) => { setFloors(next); persist(next); };

  function addFloor(block = '') {
    const inBlock = floors.filter((f) => (f.block || '') === block);
    const top = inBlock.reduce((m, f) => Math.max(m, Number(f.floor) || 0), -1) + 1;
    // Upper floors follow the 101/201/301 convention off the floor number.
    commit([...floors, { block, floor: top, label: ordinal(top), prefix: '', from: top * 100 + 1, to: top * 100 + 7, image_url: '' }]);
  }

  // Blocks are lettered A, B, C… — the next free letter, so adding one is one click.
  function addBlock() {
    const used = blocksOf(floors).filter(Boolean);
    let letter = 'A';
    for (let i = 0; i < 26; i++) { const c = String.fromCharCode(65 + i); if (!used.includes(c)) { letter = c; break; } }
    const existingUnlettered = floors.some((f) => !(f.block || ''));
    // First block added to an unlettered tower: name the existing floors "A" so the
    // two are distinguishable, rather than leaving a nameless block beside a named one.
    const base = existingUnlettered ? floors.map((f) => ({ ...f, block: f.block || 'A' })) : floors;
    const next = existingUnlettered && letter === 'A' ? 'B' : letter;
    const top = 0;
    commit([...base, { block: next, floor: top, label: ordinal(top), prefix: '', from: 1, to: 7, image_url: '' }]);
  }

  // Renaming a block moves every floor under it, so unit numbers follow.
  function renameBlock(from, to) {
    commit(floors.map((f) => ((f.block || '') === from ? { ...f, block: to } : f)));
  }

  function removeBlock(block) {
    const n = floors.filter((f) => (f.block || '') === block).length;
    if (!window.confirm(`Remove Block ${block || '—'} and its ${n} floor${n === 1 ? '' : 's'} from the plan? Units already generated are kept.`)) return;
    commit(floors.filter((f) => (f.block || '') !== block));
  }

  // Towers repeat: floors 2..13 are usually floor 1 with a different hundreds digit.
  function repeatUpTo(i, topFloor) {
    const src = floors[i];
    const base = Number(src.floor) || 0;
    const span = (parseInt(src.to, 10) || 0) - (parseInt(src.from, 10) || 0);
    const offset = (parseInt(src.from, 10) || 0) - base * 100;   // e.g. 101 - 1*100 = 1
    const blk = src.block || '';
    const next = [...floors];
    for (let fl = base + 1; fl <= topFloor; fl++) {
      // Only within this block — Block B having a 5th floor must not stop Block A getting one.
      if (next.some((f) => (f.block || '') === blk && Number(f.floor) === fl)) continue;
      next.push({ block: blk, floor: fl, label: ordinal(fl), prefix: src.prefix || '',
        from: fl * 100 + offset, to: fl * 100 + offset + span, image_url: src.image_url || '' });
    }
    next.sort((a, b) => String(a.block || '').localeCompare(String(b.block || '')) || (Number(a.floor) || 0) - (Number(b.floor) || 0));
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
          
          <button type="button" onClick={addBlock} style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #C7D2FE', background: '#fff', color: '#3D5AFE', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Add Block
          </button>
          {/* Industrial blocks are single-level — no floor concept, so no way to add one. */}
          {!industrial && (
            <button type="button" onClick={() => addFloor(blocksOf(floors)[0] || '')} style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #C7D2FE', background: '#fff', color: '#3D5AFE', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Add Floor
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {floors.length === 0 && <p style={{ fontSize: 13, color: '#8492A6' }}>{industrial ? 'No blocks yet — add one to begin.' : 'No floors yet — add one to begin.'}</p>}
        {/* Grouped by block. A single-block tower has one unnamed group and looks
            exactly as it did before blocks existed. */}
        {blocksOf(floors).map((blk) => {
          const rows = floors.map((f, i) => ({ f, i })).filter(({ f }) => (f.block || '') === blk);
          if (!rows.length) return null;
          const blkUnits = rows.reduce((n, { f }) => n + unitsForFloor(f).length, 0);
          return (
        <div key={`blk-${blk}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(blocksOf(floors).length > 1 || blk) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6 }}>Block</span>
              <input value={blk} onChange={(e) => renameBlock(blk, e.target.value.trim().toUpperCase())}
                placeholder="A" style={{ ...inp, width: 64, fontWeight: 800, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: '#8492A6' }}>{industrial ? `${blkUnits} units` : `${rows.length} floor${rows.length === 1 ? '' : 's'} · ${blkUnits} units`}</span>
              {!industrial && (
                <button type="button" onClick={() => addFloor(blk)}
                  style={{ padding: '5px 11px', borderRadius: 7, border: '1.5px solid #E0E6F0', background: '#fff', color: '#3D5AFE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Floor</button>
              )}
              <button type="button" onClick={() => removeBlock(blk)}
                style={{ padding: '5px 11px', borderRadius: 7, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Remove block</button>
            </div>
          )}
          {rows.map(({ f, i }) => {
          const units = unitsForFloor(f);
          const isNew = units.filter((n) => !existing.has(n)).length;
          return (
            <div key={i} style={{ border: '1.5px solid #E6EBF4', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {/* Industrial blocks are single-level — the floor number is meaningless. */}
                {!industrial && (
                  <div style={{ width: 62 }}>
                    <label style={lblSm}>Floor</label>
                    <input type="number" value={f.floor} onChange={(e) => setFloors(update(i, { floor: e.target.value }))}
                      onBlur={() => persist(floors)} style={{ ...inp, width: '100%' }} />
                  </div>
                )}
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
                {!industrial && (
                  <button type="button" onClick={() => { const top = Number(window.prompt('Repeat this floor\'s layout up to which floor?', '13')); if (top) repeatUpTo(i, top); }}
                    style={{ padding: '5px 11px', borderRadius: 7, border: '1.5px solid #E0E6F0', background: '#fff', color: '#3D5AFE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ↓ Repeat up to…
                  </button>
                )}
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
          );
        })}
      </div>

      {planned.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid #F0F3FA', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <b>{planned.length}</b> units planned
            {industrial
              ? (blocksOf(floors).filter(Boolean).length > 0 && <> across <b>{blocksOf(floors).filter(Boolean).length}</b> block{blocksOf(floors).filter(Boolean).length === 1 ? '' : 's'}</>)
              : <> across <b>{floors.length}</b> floor{floors.length === 1 ? '' : 's'}
                  {blocksOf(floors).filter(Boolean).length > 1 && <> in <b>{blocksOf(floors).filter(Boolean).length}</b> blocks</>}</>} ·{' '}
            <span style={{ color: toCreate.length ? '#B45309' : '#15803D', fontWeight: 700 }}>
              {toCreate.length ? `${toCreate.length} to create` : 'all already created'}
            </span>
            {dupes > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}> · {dupes} duplicate number{dupes === 1 ? '' : 's'} across {industrial ? 'blocks' : 'floors'}</span>}
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
