import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import supabase from '../lib/supabase.js';
import HexGrid from '../components/HexGrid.jsx';

const BODY_TYPE_LABEL = {
  planet: 'Planet',
  moon: 'Moon',
  asteroid_belt: 'Asteroid Belt',
  dyson_sphere: 'Dyson Sphere',
  space_station: 'Space Station',
};

export default function MapView() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [systems, setSystems] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [bodies, setBodies] = useState([]);
  const [selectedBody, setSelectedBody] = useState(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('systems')
      .select('id, name, hex_q, hex_r')
      .eq('game_id', gameId)
      .then(({ data }) => { setSystems(data ?? []); setLoading(false); });
  }, [gameId]);

  useEffect(() => {
    if (!selectedSystem) return;
    setBodies([]);
    setSelectedBody(null);
    setRegions([]);
    setSelectedRegion(null);
    supabase
      .from('celestial_bodies')
      .select('id, name, body_type, orbit_order')
      .eq('system_id', selectedSystem.id)
      .order('orbit_order')
      .then(({ data }) => setBodies(data ?? []));
  }, [selectedSystem]);

  useEffect(() => {
    if (!selectedBody) return;
    setRegions([]);
    setSelectedRegion(null);
    supabase
      .from('regions')
      .select('id, name, hex_q, hex_r, settlements(id, name, current_tier)')
      .eq('body_id', selectedBody.id)
      .then(({ data }) => setRegions(data ?? []));
  }, [selectedBody]);

  if (loading) return <div style={{ padding: 24, color: '#e2e8f0' }}>Loading map…</div>;

  const systemHexes = systems.map(s => ({
    id: s.id, q: s.hex_q, r: s.hex_r, label: s.name,
  }));

  const regionHexes = regions.map(rg => ({
    id: rg.id,
    q: rg.hex_q,
    r: rg.hex_r,
    label: rg.name ?? `(${rg.hex_q},${rg.hex_r})`,
    sublabel: rg.settlements?.[0]?.name ?? null,
  }));

  const panelStyle = {
    minWidth: 200, border: '1px solid #334155', borderRadius: 8,
    padding: '16px 20px', cursor: 'pointer',
    background: '#1e293b', color: '#e2e8f0', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ padding: 24, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, fontSize: 14 }}>
        <button onClick={() => navigate(`/game/${gameId}`)} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
          ← Dashboard
        </button>
        <span
          onClick={() => { setSelectedSystem(null); setSelectedBody(null); setSelectedRegion(null); }}
          style={{ color: selectedSystem ? '#3b82f6' : '#e2e8f0', cursor: selectedSystem ? 'pointer' : 'default' }}
        >
          Galaxy
        </span>
        {selectedSystem && (
          <>
            <span style={{ color: '#475569' }}>›</span>
            <span
              onClick={() => { setSelectedBody(null); setSelectedRegion(null); }}
              style={{ color: selectedBody ? '#3b82f6' : '#e2e8f0', cursor: selectedBody ? 'pointer' : 'default' }}
            >
              {selectedSystem.name}
            </span>
          </>
        )}
        {selectedBody && (
          <>
            <span style={{ color: '#475569' }}>›</span>
            <span style={{ color: '#e2e8f0' }}>{selectedBody.name}</span>
          </>
        )}
      </div>

      {/* Galaxy */}
      {!selectedSystem && (
        <>
          <h2 style={{ marginTop: 0 }}>Galaxy Map</h2>
          <HexGrid
            hexes={systemHexes}
            size={80}
            onSelect={h => setSelectedSystem(systems.find(s => s.id === h.id))}
            selectedId={null}
          />
          <p style={{ color: '#475569', fontSize: 13, marginTop: 8 }}>Click a system to explore it.</p>
        </>
      )}

      {/* System — body cards */}
      {selectedSystem && !selectedBody && (
        <>
          <h2 style={{ marginTop: 0 }}>{selectedSystem.name}</h2>
          {bodies.length === 0
            ? <p style={{ color: '#475569' }}>No bodies in this system.</p>
            : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {bodies.map((b, i) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBody(b)}
                    style={{ ...panelStyle, borderLeft: '3px solid #3b82f6' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
                  >
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      Orbit {i + 1}
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{b.name}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                      {BODY_TYPE_LABEL[b.body_type] ?? b.body_type}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
          <p style={{ color: '#475569', fontSize: 13, marginTop: 16 }}>Click a body to see its regions.</p>
        </>
      )}

      {/* Body — region hex grid + detail panel */}
      {selectedBody && (
        <>
          <h2 style={{ marginTop: 0 }}>{selectedBody.name}</h2>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <HexGrid
                hexes={regionHexes}
                size={90}
                onSelect={h => setSelectedRegion(regions.find(r => r.id === h.id))}
                selectedId={selectedRegion?.id}
              />
              <p style={{ color: '#475569', fontSize: 13, marginTop: 8 }}>Click a region for details.</p>
            </div>

            {selectedRegion && (
              <div style={{ ...panelStyle, cursor: 'default', minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{selectedRegion.name}</div>
                {selectedRegion.settlements?.length > 0
                  ? selectedRegion.settlements.map(st => (
                    <div key={st.id}>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Settlement</div>
                      <div style={{ fontWeight: 600 }}>{st.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Tier {st.current_tier}</div>
                    </div>
                  ))
                  : <div style={{ color: '#475569', fontSize: 13 }}>No settlement</div>
                }
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
