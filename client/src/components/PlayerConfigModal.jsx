import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const RESOURCES = ['food', 'energy', 'materials', 'strategic_materials', 'igc'];
const RESOURCE_LABELS = { food: 'Food', energy: 'Energy', materials: 'Materials', strategic_materials: 'Strategic Mat.', igc: 'IGC' };

const S = {
  modal:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  box:      { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, width: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  header:   { padding: '18px 20px 0', borderBottom: '1px solid #334155' },
  tabs:     { display: 'flex', gap: 0, marginTop: 12 },
  body:     { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  label:    { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' },
  input:    { width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, boxSizing: 'border-box' },
  select:   { width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, boxSizing: 'border-box' },
  btn:      { padding: '7px 16px', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnPrim:  { background: '#1d4ed8', color: '#fff', border: 'none' },
  btnDanger:{ background: '#991b1b', color: '#fff', border: 'none', padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155' },
  row:      { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  err:      { color: '#f87171', fontSize: 12, marginTop: 8 },
  sec:      { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
};

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', fontSize: 13, cursor: 'pointer', border: 'none', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      background: 'transparent', color: active ? '#e2e8f0' : '#64748b', fontWeight: active ? 600 : 400,
    }}>{label}</button>
  );
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Tab 1: Starting Position ─────────────────────────────────────────────────
function StartingPositionTab({ gameId, realmId, settlements, token }) {
  const [form, setForm] = useState({
    settlementId: '', groundUnits: 2, scouts: 0, frigates: 2, cruisers: 0,
    resources: { food: 10, energy: 10, materials: 10, strategic_materials: 0, igc: 5 },
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setSaving(true);
    const res = await fetch(`${SERVER}/api/games/${gameId}/setup-realm`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ realmId, ...form }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error); return; }
    setDone(true);
  }

  if (done) return <div style={{ color: '#4ade80', marginTop: 12 }}>Starting position set. Reload the map to see changes.</div>;

  return (
    <form onSubmit={handleSubmit}>
      <span style={S.label}>Starting Settlement</span>
      <select value={form.settlementId} onChange={e => setForm(f => ({ ...f, settlementId: e.target.value }))} required style={{ ...S.select, marginBottom: 14 }}>
        <option value="">— select —</option>
        {settlements.map(s => <option key={s.id} value={s.id}>{s.name} (T{s.current_tier}) · {s.body?.name} · {s.system?.name}</option>)}
      </select>

      <div style={S.sec}>Ground Forces</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 14 }}>
        <label><span style={S.label}>Standard Infantry</span>
          <input type="number" min="0" value={form.groundUnits} style={S.input} onChange={e => setForm(f => ({ ...f, groundUnits: +e.target.value }))} />
        </label>
      </div>

      <div style={S.sec}>Ships (placed in settlement's system sector)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[['scouts','Scouts'],['frigates','Frigates'],['cruisers','Cruisers']].map(([k, l]) => (
          <label key={k}><span style={S.label}>{l}</span>
            <input type="number" min="0" value={form[k]} style={S.input} onChange={e => setForm(f => ({ ...f, [k]: +e.target.value }))} />
          </label>
        ))}
      </div>

      <div style={S.sec}>Starting Resources</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {RESOURCES.map(r => (
          <label key={r}><span style={S.label}>{RESOURCE_LABELS[r]}</span>
            <input type="number" min="0" value={form.resources[r] ?? 0} style={S.input}
              onChange={e => setForm(f => ({ ...f, resources: { ...f.resources, [r]: +e.target.value } }))} />
          </label>
        ))}
      </div>

      {error && <div style={S.err}>{error}</div>}
      <button type="submit" disabled={saving || !form.settlementId} style={{ ...S.btn, ...S.btnPrim, marginTop: 4 }}>
        {saving ? 'Setting up…' : 'Initialize'}
      </button>
    </form>
  );
}

// ── Tab 2: Settlement Control ────────────────────────────────────────────────
function SettlementControlTab({ gameId, realmId, settlements, token }) {
  const [settlementId, setSettlementId] = useState('');
  const [count, setCount] = useState(1);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const selected = settlements.find(s => s.id === settlementId);
  const maxBoxes = selected ? (selected.current_tier * (selected.current_tier + 1)) / 2 : 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setMsg(null); setSaving(true);
    const res = await fetch(`${SERVER}/api/gm/${gameId}/settlements/${settlementId}/assign-boxes`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ realmId, count }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error); return; }
    setMsg(`Assigned ${count} box${count !== 1 ? 'es' : ''} to realm.`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <span style={S.label}>Settlement</span>
      <select value={settlementId} onChange={e => { setSettlementId(e.target.value); setCount(1); setMsg(null); }} required style={{ ...S.select, marginBottom: 14 }}>
        <option value="">— select —</option>
        {settlements.map(s => <option key={s.id} value={s.id}>{s.name} (T{s.current_tier}) · {s.body?.name} · {s.system?.name}</option>)}
      </select>

      {selected && (
        <>
          <span style={S.label}>Control Boxes to Assign (0 – {maxBoxes})</span>
          <input type="number" min="0" max={maxBoxes} value={count} style={{ ...S.input, marginBottom: 6 }}
            onChange={e => setCount(Math.min(maxBoxes, Math.max(0, +e.target.value)))} />
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 14 }}>
            Boxes 0–{count - 1} → this realm. Boxes {count}–{maxBoxes - 1} → neutral.
          </div>
        </>
      )}

      {error && <div style={S.err}>{error}</div>}
      {msg   && <div style={{ color: '#4ade80', fontSize: 12, marginTop: 8 }}>{msg}</div>}
      <button type="submit" disabled={saving || !settlementId} style={{ ...S.btn, ...S.btnPrim }}>
        {saving ? 'Saving…' : 'Assign Boxes'}
      </button>
    </form>
  );
}

// ── Tab 3: Resources ─────────────────────────────────────────────────────────
function ResourcesTab({ gameId, realmId, token }) {
  const [amounts, setAmounts] = useState({ food: 0, energy: 0, materials: 0, strategic_materials: 0, igc: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`${SERVER}/api/gm/${gameId}/realms/${realmId}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => {
      const map = {};
      for (const row of (data ?? [])) map[row.resource] = row.amount;
      setAmounts(prev => ({ ...prev, ...map }));
      setLoading(false);
    });
  }, [gameId, realmId, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setMsg(null); setSaving(true);
    const res = await fetch(`${SERVER}/api/gm/${gameId}/realms/${realmId}/resources`, {
      method: 'PATCH', headers: authHeaders(token),
      body: JSON.stringify({ resources: amounts }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error); return; }
    setMsg('Resources updated.');
  }

  if (loading) return <div style={{ color: '#475569' }}>Loading…</div>;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Set absolute resource amounts for this realm.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {RESOURCES.map(r => (
          <label key={r}><span style={S.label}>{RESOURCE_LABELS[r]}</span>
            <input type="number" min="0" value={amounts[r] ?? 0} style={S.input}
              onChange={e => setAmounts(a => ({ ...a, [r]: +e.target.value }))} />
          </label>
        ))}
      </div>
      {error && <div style={S.err}>{error}</div>}
      {msg   && <div style={{ color: '#4ade80', fontSize: 12, marginTop: 4 }}>{msg}</div>}
      <button type="submit" disabled={saving} style={{ ...S.btn, ...S.btnPrim }}>{saving ? 'Saving…' : 'Save Resources'}</button>
    </form>
  );
}

// ── Tab 4: Units ─────────────────────────────────────────────────────────────
function UnitsTab({ gameId, realmId, token }) {
  const [units,      setUnits]      = useState([]);
  const [unitTypes,  setUnitTypes]  = useState([]);
  const [regions,    setRegions]    = useState([]);
  const [systems,    setSystems]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Add form state
  const [addType,    setAddType]    = useState('');
  const [addQty,     setAddQty]     = useState(1);
  const [locType,    setLocType]    = useState('ground'); // 'ground' | 'ship'
  const [addRegion,  setAddRegion]  = useState('');
  const [addSystem,  setAddSystem]  = useState('');
  const [addSectorQ, setAddSectorQ] = useState(0);
  const [addSectorR, setAddSectorR] = useState(0);
  const [addSaving,  setAddSaving]  = useState(false);

  // Remove state: unitId → quantity to remove
  const [removeQtys, setRemoveQtys] = useState({});
  const [removingId, setRemovingId] = useState(null);

  const selectedUnitType = unitTypes.find(t => t.id === addType);

  function loadUnits() {
    return fetch(`${SERVER}/api/gm/${gameId}/realms/${realmId}/units`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(data => setUnits(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    Promise.all([
      fetch(`${SERVER}/api/gm/${gameId}/unit-types`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${SERVER}/api/gm/${gameId}/realms/${realmId}/controlled-regions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${SERVER}/api/map/${gameId}/systems`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      loadUnits(),
    ]).then(([types, regs, syss]) => {
      setUnitTypes(Array.isArray(types) ? types : []);
      setRegions(Array.isArray(regs) ? regs : []);
      setSystems(Array.isArray(syss) ? syss : []);
      setLoading(false);
    });
  }, [gameId, realmId, token]);

  // When locType changes, reset add type to a suitable default.
  useEffect(() => {
    if (!unitTypes.length) return;
    const match = unitTypes.find(t => locType === 'ground' ? t.is_ground_unit : !t.is_ground_unit);
    setAddType(match?.id ?? '');
  }, [locType, unitTypes]);

  // Build sector dropdown options from bodies in the selected system.
  const selectedSystem = systems.find(s => s.id === addSystem);
  const sectorOptions = selectedSystem
    ? [...new Map((selectedSystem.celestial_bodies ?? []).map(b => [`${b.hex_q},${b.hex_r}`, b])).values()]
    : [];

  async function handleAdd(e) {
    e.preventDefault();
    setError(null); setAddSaving(true);
    const body = { realmId, unitTypeId: addType, quantity: addQty };
    if (locType === 'ground') {
      body.regionId = addRegion;
    } else {
      body.systemId    = addSystem;
      body.sectorHexQ  = addSectorQ;
      body.sectorHexR  = addSectorR;
    }
    const res = await fetch(`${SERVER}/api/gm/${gameId}/units`, {
      method: 'POST', headers: authHeaders(token), body: JSON.stringify(body),
    });
    const json = await res.json();
    setAddSaving(false);
    if (!res.ok) { setError(json.error); return; }
    await loadUnits();
  }

  async function handleRemove(unit) {
    const qty = removeQtys[unit.id] ?? unit.quantity;
    setRemovingId(unit.id);
    await fetch(`${SERVER}/api/gm/${gameId}/units/${unit.id}?quantity=${qty}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    setRemovingId(null);
    await loadUnits();
  }

  if (loading) return <div style={{ color: '#475569' }}>Loading…</div>;

  const groundTypes = unitTypes.filter(t => t.is_ground_unit);
  const shipTypes   = unitTypes.filter(t => !t.is_ground_unit);

  return (
    <div>
      {/* ── Add Units ── */}
      <div style={S.sec}>Add Units</div>
      <form onSubmit={handleAdd}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <label style={{ flex: 1 }}>
            <span style={S.label}>Location Type</span>
            <select value={locType} onChange={e => setLocType(e.target.value)} style={S.select}>
              <option value="ground">Ground (Region)</option>
              <option value="ship">Ship (System Sector)</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={S.label}>Unit Type</span>
            <select value={addType} onChange={e => setAddType(e.target.value)} required style={S.select}>
              <option value="">— select —</option>
              {(locType === 'ground' ? groundTypes : shipTypes).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label style={{ width: 70 }}>
            <span style={S.label}>Qty</span>
            <input type="number" min="1" value={addQty} onChange={e => setAddQty(+e.target.value)} style={S.input} />
          </label>
        </div>

        {locType === 'ground' ? (
          <label>
            <span style={S.label}>Region</span>
            <select value={addRegion} onChange={e => setAddRegion(e.target.value)} required style={{ ...S.select, marginBottom: 10 }}>
              <option value="">— select —</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 2 }}>
              <span style={S.label}>System</span>
              <select value={addSystem} onChange={e => { setAddSystem(e.target.value); setAddSectorQ(0); setAddSectorR(0); }} required style={S.select}>
                <option value="">— select —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ flex: 3 }}>
              <span style={S.label}>Sector</span>
              <select
                value={`${addSectorQ},${addSectorR}`}
                onChange={e => { const [q, r] = e.target.value.split(',').map(Number); setAddSectorQ(q); setAddSectorR(r); }}
                required={locType === 'ship'}
                style={S.select}
                disabled={!addSystem}
              >
                <option value="0,0">Center (0, 0)</option>
                {sectorOptions.map(b => (
                  <option key={`${b.hex_q},${b.hex_r}`} value={`${b.hex_q},${b.hex_r}`}>
                    {b.name} ({b.hex_q}, {b.hex_r})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && <div style={S.err}>{error}</div>}
        <button type="submit" disabled={addSaving || !addType || (locType === 'ground' ? !addRegion : !addSystem)}
          style={{ ...S.btn, ...S.btnPrim, marginBottom: 4 }}>
          {addSaving ? 'Adding…' : 'Add Units'}
        </button>
      </form>

      {/* ── Current Units ── */}
      <div style={S.sec}>Current Units</div>
      {units.length === 0
        ? <div style={{ color: '#475569', fontSize: 12 }}>No units.</div>
        : units.map(u => (
          <div key={u.id} style={{ ...S.row, background: '#0f172a', borderRadius: 4, padding: '6px 10px', marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{u.quantity}× {u.type}</span>
              <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>{u.location}</span>
            </div>
            <input
              type="number" min="1" max={u.quantity}
              value={removeQtys[u.id] ?? u.quantity}
              onChange={e => setRemoveQtys(prev => ({ ...prev, [u.id]: +e.target.value }))}
              style={{ ...S.input, width: 52, textAlign: 'center' }}
            />
            <button onClick={() => handleRemove(u)} disabled={removingId === u.id} style={S.btnDanger}>
              {removingId === u.id ? '…' : 'Remove'}
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function PlayerConfigModal({ gameId, target, onClose }) {
  const { session } = useAuth();
  const [tab, setTab] = useState('start');
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    if (!target || !session) return;
    fetch(`${SERVER}/api/games/${gameId}/settlements`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(r => r.json()).then(d => setSettlements(Array.isArray(d) ? d : []));
  }, [target, gameId, session]);

  if (!target) return null;

  const token = session?.access_token;

  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{target.realmName}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Player: {target.playerName}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={S.tabs}>
            <Tab label="Starting Position" active={tab === 'start'}    onClick={() => setTab('start')} />
            <Tab label="Settlement"        active={tab === 'settle'}   onClick={() => setTab('settle')} />
            <Tab label="Resources"         active={tab === 'res'}      onClick={() => setTab('res')} />
            <Tab label="Units"             active={tab === 'units'}    onClick={() => setTab('units')} />
          </div>
        </div>

        <div style={S.body}>
          {tab === 'start'  && <StartingPositionTab  gameId={gameId} realmId={target.realmId} settlements={settlements} token={token} />}
          {tab === 'settle' && <SettlementControlTab gameId={gameId} realmId={target.realmId} settlements={settlements} token={token} />}
          {tab === 'res'    && <ResourcesTab         gameId={gameId} realmId={target.realmId} token={token} />}
          {tab === 'units'  && <UnitsTab             gameId={gameId} realmId={target.realmId} token={token} />}
        </div>
      </div>
    </div>
  );
}
