import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import InlineEdit from './InlineEdit.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const TIER_NAMES  = { 1: 'Colony', 2: 'Town', 3: 'City', 4: 'Metropolis', 5: 'Megalopolis' };
const SLOT_LABELS = {
  food_tile:       'Food Tile',
  material_tile:   'Material Tile',
  energy_tile:     'Energy Tile',
  strategic_tile:  'Strategic Tile',
  production_slot: 'Production Slot',
};

function baseUpkeep(tier) { return (tier - 1) * 2; }
function maxBoxes(tier)   { return (tier * (tier + 1)) / 2; }

// Returns the realm that holds plurality of boxes, or null if neutral/tied.
function pluralityRealm(boxes) {
  const counts = {};
  for (const b of boxes) {
    if (!b.owner_realm_id) continue;
    counts[b.owner_realm_id] ??= { count: 0, realm: b.realms };
    counts[b.owner_realm_id].count++;
  }
  let max = 0, winner = null;
  for (const { count, realm } of Object.values(counts)) {
    if (count > max) { max = count; winner = realm; }
    else if (count === max) { winner = null; }
  }
  return winner;
}

const S = {
  panel:   { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '16px 18px', minWidth: 240, fontSize: 13, color: '#e2e8f0', maxHeight: 520, overflowY: 'auto' },
  heading: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  divider: { borderColor: '#1e3a5f', margin: '10px 0' },
};

export default function RegionPanel({ regionId, isGM = false, userRealmId = null, onRegionRenamed }) {
  const { session } = useAuth();
  const [region, setRegion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regionId || !session) return;
    setLoading(true);
    setRegion(null);
    fetch(`${SERVER}/api/map/regions/${regionId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(r => r.json()).then(d => { setRegion(d); setLoading(false); });
  }, [regionId, session]);

  async function renameEntity(endpoint, id, name) {
    const r = await fetch(`${SERVER}/api/map/${endpoint}/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await r.json();
    return json?.error ? { error: json.error } : null;
  }

  if (loading) return <div style={S.panel}><span style={{ color: '#475569' }}>Loading…</span></div>;
  if (!region) return null;

  const settlement = region.settlements?.[0] ?? null;
  const boxes      = settlement?.control_boxes ?? [];
  const allSlots   = region.slots ?? [];
  const resTiles   = allSlots.filter(s => s.slot_type_config?.name !== 'production_slot');
  const prodSlots  = allSlots.filter(s => s.slot_type_config?.name === 'production_slot');
  const holder     = settlement ? pluralityRealm(boxes) : null;
  const canEdit    = isGM || (userRealmId != null && holder?.id === userRealmId);

  // Militia per realm = floor(realm's boxes / 3)
  const militiaCounts = {};
  for (const b of boxes) {
    if (!b.owner_realm_id) continue;
    militiaCounts[b.owner_realm_id] ??= { name: b.realms?.name ?? '?', count: 0 };
    militiaCounts[b.owner_realm_id].count++;
  }
  const militiaRows = Object.values(militiaCounts).map(r => ({
    name: r.name, militia: Math.floor(r.count / 3),
  })).filter(r => r.militia > 0);

  return (
    <div style={S.panel}>
      {/* Region header */}
      <div style={{ fontWeight: 700, fontSize: 15 }}>
        <InlineEdit
          value={region.name}
          canEdit={canEdit}
          onSave={async name => {
            const err = await renameEntity('regions', region.id, name);
            if (!err) {
              setRegion(prev => ({ ...prev, name }));
              onRegionRenamed?.(name);
            }
            return err;
          }}
        />
      </div>
      <div style={{ color: '#475569', fontSize: 11, marginBottom: 4 }}>
        hex ({region.hex_q}, {region.hex_r})
      </div>

      {holder && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: holder.color ?? '#334155' }} />
          <span style={{ color: '#94a3b8' }}>Controlled by <strong style={{ color: '#e2e8f0' }}>{holder.name}</strong></span>
        </div>
      )}

      {/* Settlement */}
      {settlement ? (
        <>
          <hr style={S.divider} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            <InlineEdit
              value={settlement.name}
              canEdit={canEdit}
              onSave={async name => {
                const err = await renameEntity('settlements', settlement.id, name);
                if (!err) setRegion(prev => ({
                  ...prev,
                  settlements: prev.settlements.map(s => s.id === settlement.id ? { ...s, name } : s),
                }));
                return err;
              }}
            />
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {TIER_NAMES[settlement.current_tier] ?? '?'} · Tier {settlement.current_tier}
          </div>
          <div style={{ color: '#f97316', fontSize: 12, marginTop: 2 }}>
            Upkeep: {baseUpkeep(settlement.current_tier)} food / turn
          </div>

          {/* Control boxes */}
          <div style={S.heading}>
            Control Boxes — {boxes.length} / {maxBoxes(settlement.current_tier)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {boxes.map(b => {
              const r = b.realms;
              return (
                <div key={b.box_index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: '1px solid #475569', background: r?.color ?? '#1e293b' }} />
                  <span style={{ color: r ? '#e2e8f0' : '#475569' }}>
                    Box {b.box_index} — {r?.name ?? 'Neutral'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Militia */}
          <div style={S.heading}>Militia if Attacked</div>
          {militiaRows.length === 0
            ? <div style={{ color: '#475569' }}>None (need 3 boxes per militia)</div>
            : militiaRows.map(r => (
              <div key={r.name}>{r.name}: {r.militia} militia</div>
            ))
          }
        </>
      ) : (
        <div style={{ color: '#475569', marginTop: 8, fontSize: 12 }}>No settlement in this region.</div>
      )}

      {/* Resource tiles */}
      {resTiles.length > 0 && (
        <>
          <div style={S.heading}>Resource Tiles</div>
          {resTiles.map(s => (
            <div key={s.slot_index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#94a3b8' }}>{SLOT_LABELS[s.slot_type_config?.name] ?? s.slot_type_config?.name}</span>
              <span style={{ fontSize: 11, color: s.worker ? '#4ade80' : '#475569' }}>
                {s.worker ? `Worker: ${s.worker.realms?.name ?? '?'}` : 'Unworked'}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Production slots */}
      {prodSlots.length > 0 && (
        <>
          <div style={S.heading}>Production Slots</div>
          {prodSlots.map(s => (
            <div key={s.slot_index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#94a3b8' }}>Slot {s.slot_index + 1}</span>
              <span style={{ fontSize: 11, color: s.worker ? '#4ade80' : '#475569' }}>
                {s.worker ? `Assigned: ${s.worker.realms?.name ?? '?'}` : 'Empty'}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Units stationed */}
      <div style={S.heading}>Units Stationed</div>
      {(region.units ?? []).length === 0
        ? <div style={{ color: '#475569', fontSize: 12 }}>None</div>
        : (region.units ?? []).map((u, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: u.realm?.color ?? '#334155', flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{u.realm?.name ?? 'Unknown'} — {u.quantity}× {u.type}</span>
          </div>
        ))
      }
    </div>
  );
}
