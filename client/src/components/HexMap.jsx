import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import HexGrid from './HexGrid.jsx';
import RegionPanel from './RegionPanel.jsx';
import InlineEdit from './InlineEdit.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const SYSTEM_POSITIONS = [
  [0, 0],
  [1, 0], [0, 1], [-1, 1],
  [-1, 0], [0, -1], [1, -1],
];

const BODY_COLOR = {
  star:          '#78350f',
  planet:        '#164e63',
  moon:          '#1e2a3a',
  asteroid_belt: '#3f2a00',
  dyson_sphere:  '#312e81',
  space_station: '#134e4a',
};

const BODY_TYPE_LABEL = {
  star:          'Star',
  planet:        'Planet',
  moon:          'Moon',
  asteroid_belt: 'Asteroid Belt',
  dyson_sphere:  'Dyson Sphere',
  space_station: 'Space Station',
};

const TIER_NAMES = { 1: 'Colony', 2: 'Town', 3: 'City', 4: 'Metropolis', 5: 'Megalopolis' };

// Fill colors per settlement tier (0 = no settlement).
const TIER_FILL = {
  0: '#0b1520',
  1: '#0a2a15',
  2: '#0c3a1e',
  3: '#0a4822',
  4: '#085826',
  5: '#05612c',
};

// Returns the realm holding plurality of boxes, or null if neutral/tied.
function pluralityHolder(boxes = []) {
  const counts = {};
  for (const b of boxes) {
    if (!b.owner_realm_id) continue;
    counts[b.owner_realm_id] ??= { count: 0, realm: b.realms };
    counts[b.owner_realm_id].count++;
  }
  let max = 0, winner = null;
  for (const { count, realm } of Object.values(counts)) {
    if (count > max)        { max = count; winner = realm; }
    else if (count === max) { winner = null; }
  }
  return winner;
}

function buildSystemHexes(bodies) {
  // Sort so lowest orbit_order is first → it becomes the 'primary' body for the sector.
  const sorted = [...bodies].sort((a, b) => (a.orbit_order ?? 99) - (b.orbit_order ?? 99));
  const byPos = {};
  for (const b of sorted) {
    const key = `${b.hex_q},${b.hex_r}`;
    (byPos[key] ??= []).push(b);
  }
  return SYSTEM_POSITIONS.map(([q, r]) => {
    const key     = `${q},${r}`;
    const here    = byPos[key] ?? [];
    const primary = here[0];
    const isStar  = primary?.body_type === 'star';
    const isEmpty = here.length === 0;

    let label = '', sublabel = '';
    if (isStar)     { label = '★'; sublabel = primary.name; }
    else if (primary) {
      label    = primary.name;
      sublabel = here.length > 1 ? `+${here.length - 1}` : (BODY_TYPE_LABEL[primary.body_type] ?? '');
    }

    return {
      id: key, q, r, bodies: here, label, sublabel, isStar, isEmpty,
      color:       isEmpty ? '#080f1a' : (BODY_COLOR[primary?.body_type] ?? '#1e293b'),
      strokeColor: isEmpty ? '#2d3748' : undefined,
    };
  });
}

const PANEL    = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '14px 18px', fontSize: 13, color: '#e2e8f0' };
const SEC_HEAD = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 };

// Fixed column widths so the hex grid never shifts when side panels open/close.
const LEFT_COL  = 200; // ships sidebar (body view only)
const RIGHT_COL = 280; // detail panels (all views)

// Two-column layout (no left panel): hex | right-panel-slot
const TWO_COL_GRID = {
  display: 'grid',
  gridTemplateColumns: `1fr ${RIGHT_COL}px`,
  gap: 16,
  alignItems: 'flex-start',
};

// Three-column layout (body view): ships | hex | right-panel-slot
const THREE_COL_GRID = {
  display: 'grid',
  gridTemplateColumns: `${LEFT_COL}px 1fr ${RIGHT_COL}px`,
  gap: 16,
  alignItems: 'flex-start',
  minHeight: 520,
};

export default function HexMap({ gameId, initialSystemId = null, isGM = false, userRealmId = null }) {
  const { session } = useAuth();

  const [systems,       setSystems]       = useState([]);

  // Galaxy view: system highlighted in side panel (not drilled in yet).
  const [panelSystem,   setPanelSystem]   = useState(null);
  const [panelSummary,  setPanelSummary]  = useState(null);  // lazy-loaded

  // System drilled into.
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [bodies,          setBodies]         = useState([]);
  const [selectedHexKey,  setSelectedHexKey] = useState(null);
  const [shipsBySector,   setShipsBySector]  = useState({});

  const [selectedBody,   setSelectedBody]   = useState(null);
  const [regions,        setRegions]        = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [loading,        setLoading]        = useState(true);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  function authFetch(url, opts = {}) {
    const { method = 'GET', body } = opts;
    return fetch(`${SERVER}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${sessionRef.current?.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).then(r => r.json());
  }

  async function rename(endpoint, id, newName) {
    const result = await authFetch(`/api/map/${endpoint}/${id}`, { method: 'PATCH', body: { name: newName } });
    return result?.error ? { error: result.error } : null;
  }

  // Load systems list (lightweight — bodies only).
  useEffect(() => {
    if (!session) return;
    authFetch(`/api/map/${gameId}/systems`).then(data => {
      const list = Array.isArray(data) ? data : [];
      setSystems(list);
      if (initialSystemId) {
        const sys = list.find(s => s.id === initialSystemId);
        if (sys) enterSystem(sys);
      }
      setLoading(false);
    });
  }, [gameId, session, initialSystemId]);

  // Lazy-load galaxy panel summary when user selects a system in galaxy view.
  useEffect(() => {
    if (!panelSystem) { setPanelSummary(null); return; }
    setPanelSummary(null);
    authFetch(`/api/map/systems/${panelSystem.id}/summary`).then(data => {
      setPanelSummary(data?.settlements ? data : { settlements: [], realms: [] });
    });
  }, [panelSystem]);

  // Reset when entering a system, then load ship positions.
  useEffect(() => {
    if (!selectedSystem) return;
    setBodies(selectedSystem.celestial_bodies ?? []);
    setSelectedHexKey(null);
    setSelectedBody(null);
    setRegions([]);
    setSelectedRegion(null);
    setShipsBySector({});
    authFetch(`/api/map/systems/${selectedSystem.id}/ships`).then(data => {
      setShipsBySector(data && typeof data === 'object' && !data.error ? data : {});
    });
  }, [selectedSystem]);

  // Load regions when a body is selected.
  useEffect(() => {
    if (!selectedBody) return;
    setRegions([]);
    setSelectedRegion(null);
    authFetch(`/api/map/bodies/${selectedBody.id}/regions`).then(data => {
      setRegions(Array.isArray(data) ? data : []);
    });
  }, [selectedBody]);

  function enterSystem(sys) {
    setSelectedSystem(sys);
    setPanelSystem(null);
    setPanelSummary(null);
    setShipsBySector({});
  }

  function resetToGalaxy() {
    setSelectedSystem(null);
    setPanelSystem(null);
    setPanelSummary(null);
    setSelectedHexKey(null);
    setSelectedBody(null);
    setRegions([]);
    setSelectedRegion(null);
    setShipsBySector({});
  }

  if (loading) return <div style={{ padding: 16, color: '#94a3b8' }}>Loading map…</div>;

  // ── Derived display data ─────────────────────────────────────────────────
  const systemHexes = systems.map(s => ({ id: s.id, q: s.hex_q, r: s.hex_r, label: s.name }));

  const systemDisplayHexes = selectedSystem ? buildSystemHexes(bodies) : [];

  const bodiesInSelectedHex = selectedHexKey
    ? (systemDisplayHexes.find(h => h.id === selectedHexKey)?.bodies ?? [])
    : [];

  // Region hexes — fog-of-war aware, tier fill, realm border, unit overlay.
  // visibility field: 'visible' | 'scouted' | 'dark'. Defaults to 'visible' when absent (GM or unset).
  function buildBodyHexes(regionList) {
    return regionList.map(rg => {
      const visibility = rg.visibility ?? 'visible';
      const settlement = Array.isArray(rg.settlements) ? rg.settlements[0] ?? null : null;

      if (visibility === 'dark') {
        return {
          id:          rg.id,
          q:           rg.hex_q,
          r:           rg.hex_r,
          label:       null,
          sublabel:    null,
          color:       '#0a0f1a',
          strokeColor: '#1e293b',
          dimLabel:    false,
          units:       [],
        };
      }

      if (visibility === 'scouted') {
        const tier = settlement?.current_tier ?? 0;
        return {
          id:          rg.id,
          q:           rg.hex_q,
          r:           rg.hex_r,
          label:       settlement ? settlement.name : null,
          sublabel:    settlement ? TIER_NAMES[tier] ?? null : null,
          color:       '#1a1f2e',
          strokeColor: '#334155',
          dimLabel:    true,
          units:       [],
        };
      }

      // visible (default)
      const boxes   = Array.isArray(settlement?.control_boxes) ? settlement.control_boxes : [];
      const holder  = pluralityHolder(boxes);
      const tier    = settlement?.current_tier ?? 0;
      return {
        id:          rg.id,
        q:           rg.hex_q,
        r:           rg.hex_r,
        label:       rg.name ?? `(${rg.hex_q},${rg.hex_r})`,
        sublabel:    settlement ? `⬡ ${settlement.name}` : null,
        color:       TIER_FILL[tier] ?? TIER_FILL[0],
        strokeColor: holder?.color ?? undefined,
        dimLabel:    false,
        units:       rg.units ?? [],
      };
    });
  }

  const regionHexes = buildBodyHexes(regions);

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 16, color: '#e2e8f0' }}>

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
        <span
          onClick={resetToGalaxy}
          style={{ color: selectedSystem ? '#3b82f6' : '#94a3b8', cursor: selectedSystem ? 'pointer' : 'default', fontWeight: selectedSystem ? 400 : 600 }}
        >
          Galaxy
        </span>
        {selectedSystem && (
          <>
            <span style={{ color: '#334155' }}>›</span>
            {selectedBody ? (
              <span
                onClick={() => { setSelectedBody(null); setRegions([]); setSelectedHexKey(null); setSelectedRegion(null); }}
                style={{ color: '#3b82f6', cursor: 'pointer' }}
              >
                {selectedSystem.name}
              </span>
            ) : (
              <InlineEdit
                value={selectedSystem.name}
                canEdit={isGM}
                style={{ color: '#94a3b8', fontWeight: 600 }}
                onSave={async name => {
                  const err = await rename('systems', selectedSystem.id, name);
                  if (!err) {
                    setSystems(prev => prev.map(s => s.id === selectedSystem.id ? { ...s, name } : s));
                    setSelectedSystem(prev => ({ ...prev, name }));
                  }
                  return err;
                }}
              />
            )}
          </>
        )}
        {selectedBody && (
          <>
            <span style={{ color: '#334155' }}>›</span>
            <InlineEdit
              value={selectedBody.name}
              canEdit={isGM}
              style={{ color: '#94a3b8', fontWeight: 600 }}
              onSave={async name => {
                const err = await rename('bodies', selectedBody.id, name);
                if (!err) {
                  setBodies(prev => prev.map(b => b.id === selectedBody.id ? { ...b, name } : b));
                  setSelectedBody(prev => ({ ...prev, name }));
                }
                return err;
              }}
            />
          </>
        )}
      </div>

      {/* ── Galaxy view ────────────────────────────────────────────────────── */}
      {!selectedSystem && (
        <div style={TWO_COL_GRID}>
          {/* Hex — always occupies the left column */}
          <HexGrid
            hexes={systemHexes}
            size={80}
            selectedId={panelSystem?.id}
            onSelect={h => setPanelSystem(systems.find(s => s.id === h.id))}
            onDoubleClick={h => { const sys = systems.find(s => s.id === h.id); if (sys) enterSystem(sys); }}
          />

          {/* Right slot — always present so hex never shifts */}
          <div>
            {panelSystem && (
              <div style={PANEL}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                  <InlineEdit
                    value={panelSystem.name}
                    canEdit={isGM}
                    onSave={async name => {
                      const err = await rename('systems', panelSystem.id, name);
                      if (!err) {
                        setSystems(prev => prev.map(s => s.id === panelSystem.id ? { ...s, name } : s));
                        setPanelSystem(prev => ({ ...prev, name }));
                      }
                      return err;
                    }}
                  />
                </div>

                {!panelSummary ? (
                  <div style={{ color: '#475569', fontSize: 12 }}>Loading…</div>
                ) : (
                  <>
                    <div style={SEC_HEAD}>Realm Presence</div>
                    {panelSummary.realms.length === 0
                      ? <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>None — unclaimed.</div>
                      : panelSummary.realms.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color ?? '#334155', flexShrink: 0 }} />
                          <span>{r.name}</span>
                          <span style={{ color: '#475569', fontSize: 11 }}>({r.settCount} settlement{r.settCount !== 1 ? 's' : ''})</span>
                        </div>
                      ))
                    }
                    {panelSummary.settlements.length > 0 && (
                      <>
                        <div style={{ ...SEC_HEAD, marginTop: 12 }}>Settlements</div>
                        {panelSummary.settlements.map((s, i) => (
                          <div key={i} style={{ marginBottom: 6, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {s.holder && <div style={{ width: 8, height: 8, borderRadius: 2, background: s.holder.color ?? '#334155', flexShrink: 0 }} />}
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                              <span style={{ color: '#64748b' }}>· {TIER_NAMES[s.tier] ?? `Tier ${s.tier}`}</span>
                            </div>
                            <div style={{ color: '#475569', fontSize: 11, paddingLeft: s.holder ? 14 : 0 }}>{s.bodyName}</div>
                          </div>
                        ))}
                      </>
                    )}
                    <div style={{ ...SEC_HEAD, marginTop: 12 }}>Military Presence</div>
                    <div style={{ color: '#475569', fontSize: 12 }}>No ships detected.</div>
                  </>
                )}

                <button
                  onClick={() => enterSystem(panelSystem)}
                  style={{ marginTop: 14, width: '100%', padding: '8px 0', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Enter System →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── System view ────────────────────────────────────────────────────── */}
      {selectedSystem && !selectedBody && (
        <div style={TWO_COL_GRID}>
          {/* Hex — always occupies the left column */}
          <HexGrid
            hexes={systemDisplayHexes}
            size={72}
            selectedId={selectedHexKey}
            onSelect={h => { setSelectedHexKey(h.id); setSelectedBody(null); setRegions([]); setSelectedRegion(null); }}
            onDoubleClick={h => {
              const nonStar = (h.bodies ?? []).find(b => b.body_type !== 'star');
              if (nonStar) { setSelectedHexKey(h.id); setSelectedBody(nonStar); }
            }}
            onBackgroundDoubleClick={resetToGalaxy}
          />

          {/* Right slot — always present so hex never shifts */}
          <div>
            {selectedHexKey && (
              <div style={PANEL}>
                <div style={SEC_HEAD}>Ships Present</div>
                {(shipsBySector[selectedHexKey] ?? []).length === 0
                  ? <div style={{ color: '#475569', fontSize: 12, marginBottom: 10 }}>None</div>
                  : (shipsBySector[selectedHexKey] ?? []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.realm?.color ?? '#334155', flexShrink: 0 }} />
                      <span style={{ fontSize: 12 }}>{s.realm?.name ?? 'Unknown'} — {s.quantity}× {s.type}</span>
                    </div>
                  ))
                }
                {bodiesInSelectedHex.length === 0 ? (
                  <div style={{ fontWeight: 600, color: '#64748b', marginTop: 8 }}>Empty Sector</div>
                ) : bodiesInSelectedHex.map((b, i) => (
                  <div key={b.id} style={{ marginTop: 12, paddingTop: 12, borderTop: i === 0 ? '1px solid #334155' : 'none' }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      <InlineEdit
                        value={b.name}
                        canEdit={isGM}
                        onSave={async name => {
                          const err = await rename('bodies', b.id, name);
                          if (!err) setBodies(prev => prev.map(bd => bd.id === b.id ? { ...bd, name } : bd));
                          return err;
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{BODY_TYPE_LABEL[b.body_type] ?? b.body_type}</div>
                    {b.body_type !== 'star' && (
                      <div onClick={() => setSelectedBody(b)} style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer' }}>
                        Explore surface →
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Body / region view ─────────────────────────────────────────────── */}
      {selectedBody && (() => {
        // Primary body per sector = lowest orbit_order, skip star as primary
        const bodyByKey = {};
        for (const b of [...bodies].sort((a, z) => (a.orbit_order ?? 99) - (z.orbit_order ?? 99))) {
          const key = `${b.hex_q},${b.hex_r}`;
          if (!bodyByKey[key] || b.body_type !== 'star') bodyByKey[key] ??= b;
        }
        const sectors = Object.entries(shipsBySector);
        return (
          <div style={THREE_COL_GRID}>
            {/* Left: ships in system */}
            <div style={PANEL}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{selectedSystem?.name} — Ships</div>
              {sectors.length === 0
                ? <div style={{ color: '#475569', fontSize: 12 }}>No ships in system.</div>
                : sectors.map(([key, ships]) => {
                  const body = bodyByKey[key];
                  return (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        {body ? body.name : `Sector (${key})`}
                      </div>
                      {ships.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: s.realm?.color ?? '#334155', flexShrink: 0 }} />
                          <span style={{ fontSize: 12 }}>{s.realm?.name ?? '?'} — {s.quantity}× {s.type}</span>
                        </div>
                      ))}
                    </div>
                  );
                })
              }
            </div>

            {/* Centre: region hex grid — always in the same column */}
            <div style={{ height: 520 }}>
              <HexGrid
                hexes={regionHexes}
                size={90}
                labelSize={12}
                sublabelSize={10}
                selectedId={selectedRegion?.id}
                onSelect={h => setSelectedRegion(regions.find(r => r.id === h.id))}
                onDoubleClick={h => setSelectedRegion(regions.find(r => r.id === h.id))}
                onBackgroundDoubleClick={() => { setSelectedBody(null); setRegions([]); setSelectedRegion(null); setSelectedHexKey(null); }}
                panZoom
              />
            </div>

            {/* Right slot — always present so hex never shifts */}
            <div>
              {selectedRegion && (
                <RegionPanel
                  regionId={selectedRegion.id}
                  isGM={isGM}
                  userRealmId={userRealmId}
                  onRegionRenamed={name => setRegions(prev => prev.map(r => r.id === selectedRegion.id ? { ...r, name } : r))}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* Hint */}
      <div style={{ fontSize: 12, color: '#334155', marginTop: 10 }}>
        {!selectedSystem && !panelSystem && 'Click a system to preview it. Double-click to enter directly.'}
        {!selectedSystem && panelSystem && 'Double-click or press "Enter System →" to explore. Click elsewhere to close.'}
        {selectedSystem && !selectedBody && !selectedHexKey && 'Click a sector to inspect it. Double-click a body sector to enter it. Double-click empty space to return to galaxy.'}
        {selectedSystem && !selectedBody && selectedHexKey && bodiesInSelectedHex.length > 0 && 'Double-click this sector to explore its surface. Double-click empty space to return to galaxy.'}
        {selectedBody && !selectedRegion && 'Click a region for details. Double-click empty space to return to system view.'}
      </div>
    </div>
  );
}
