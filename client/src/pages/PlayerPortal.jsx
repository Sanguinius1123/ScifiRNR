import { useEffect, useState } from 'react';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import HexMap from '../components/HexMap.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const RESOURCE_LABELS = {
  food: 'Food',
  energy: 'Energy',
  materials: 'Materials',
  strategic_materials: 'Strategic Materials',
  igc: 'IGC',
};

async function findCapitalSystemId(capitalSettlementId) {
  if (!capitalSettlementId) return null;
  const { data: sett } = await supabase
    .from('settlements').select('region_id').eq('id', capitalSettlementId).single();
  if (!sett) return null;
  const { data: region } = await supabase
    .from('regions').select('body_id').eq('id', sett.region_id).single();
  if (!region) return null;
  const { data: body } = await supabase
    .from('celestial_bodies').select('system_id').eq('id', region.body_id).single();
  return body?.system_id ?? null;
}

// profileId can be passed by the GM to view a player's portal.
// When omitted, the logged-in user views their own portal.
export default function PlayerPortal({ gameId, profileId: propProfileId }) {
  const { profile, session, signOut } = useAuth();
  const [realm, setRealm] = useState(null);
  const [influence, setInfluence] = useState(null);
  const [capitalSystemId, setCapitalSystemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [description, setDescription] = useState('');
  const [descSaved, setDescSaved] = useState(false);

  const isOwnPortal = !propProfileId;
  const isGM = profile?.global_role === 'gm';
  const canEdit = isOwnPortal || isGM;
  const targetProfileId = propProfileId ?? profile?.id;

  useEffect(() => {
    async function fetchRealm() {
      const { data: realmData } = await supabase
        .from('realms')
        .select('id, name, color, description, capital_settlement_id, realm_resources(resource, amount)')
        .eq('game_id', gameId)
        .eq('profile_id', targetProfileId)
        .single();

      if (realmData) {
        setRealm(realmData);
        setDescription(realmData.description ?? '');
        const [infResult, sysId] = await Promise.all([
          supabase.from('realm_influence').select('influence').eq('realm_id', realmData.id).single(),
          findCapitalSystemId(realmData.capital_settlement_id),
        ]);
        setInfluence(infResult.data?.influence ?? 0);
        setCapitalSystemId(sysId);
      }

      setLoading(false);
    }
    if (targetProfileId) fetchRealm();
  }, [gameId, targetProfileId]);

  async function handleCreateRealm() {
    setCreating(true);
    const res = await fetch(`${SERVER}/api/realms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ game_id: gameId }),
    });
    const data = await res.json();
    if (res.ok) {
      setRealm(data);
      setDescription(data.description ?? '');
    }
    setCreating(false);
  }

  async function handleSaveName(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === realm.name) { setEditingName(false); return; }
    const res = await fetch(`${SERVER}/api/realms/${realm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) setRealm(prev => ({ ...prev, name: trimmed }));
    setEditingName(false);
  }

  async function handleSaveDescription() {
    if (description === (realm.description ?? '')) return;
    const res = await fetch(`${SERVER}/api/realms/${realm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ description }),
    });
    if (res.ok) {
      setRealm(prev => ({ ...prev, description }));
      setDescSaved(true);
      setTimeout(() => setDescSaved(false), 2000);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!realm) {
    return (
      <div style={{ padding: 24 }}>
        {isOwnPortal && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={signOut}>Sign Out</button>
          </div>
        )}
        <h2>Welcome, {profile?.username}</h2>
        {isOwnPortal ? (
          <>
            <p>You don't have a realm yet in this game.</p>
            <button onClick={handleCreateRealm} disabled={creating}>
              {creating ? 'Setting up…' : 'Create My Realm'}
            </button>
          </>
        ) : (
          <p style={{ color: '#94a3b8' }}>This player hasn't created their realm yet.</p>
        )}
      </div>
    );
  }

  const resources = Object.fromEntries(
    (realm.realm_resources ?? []).map(r => [r.resource, r.amount])
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Sign out — own portal only */}
      {isOwnPortal && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={signOut}>Sign Out</button>
        </div>
      )}

      {/* Realm name */}
      {canEdit && editingName ? (
        <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            autoFocus
            style={{ fontSize: 24, fontWeight: 700, flex: 1 }}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditingName(false)}>Cancel</button>
        </form>
      ) : (
        <h1
          onClick={canEdit ? () => { setNameInput(realm.name); setEditingName(true); } : undefined}
          style={{ marginBottom: 16, cursor: canEdit ? 'text' : 'default', display: 'flex', alignItems: 'center', gap: 8 }}
          title={canEdit ? 'Click to rename' : undefined}
        >
          {realm.name}
          {canEdit && <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 400 }}>✎</span>}
        </h1>
      )}

      <HexMap gameId={gameId} initialSystemId={capitalSystemId} userRealmId={realm?.id} />

      {/* Resources */}
      <h2 style={{ marginTop: 32 }}>Resources</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
            <tr key={key}>
              <td style={{ padding: '4px 16px 4px 0' }}>{label}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{resources[key] ?? 0}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '4px 16px 4px 0' }}>Influence</td>
            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{influence ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Lore */}
      <h2 style={{ marginTop: 32 }}>Realm Lore</h2>
      <textarea
        value={description}
        onChange={e => canEdit && setDescription(e.target.value)}
        onBlur={canEdit ? handleSaveDescription : undefined}
        readOnly={!canEdit}
        placeholder={canEdit ? 'Write the history, culture, and lore of your realm here…' : 'No lore written yet.'}
        rows={6}
        style={{
          width: '100%', maxWidth: 600, boxSizing: 'border-box', resize: 'vertical',
          background: canEdit ? undefined : '#f8f8f8', color: canEdit ? undefined : '#555',
        }}
      />
      {canEdit && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, height: 16 }}>
          {descSaved ? 'Saved.' : 'Auto-saves when you click away.'}
        </div>
      )}

      {/* TODO: workers, territory list, trade goods */}
    </div>
  );
}
