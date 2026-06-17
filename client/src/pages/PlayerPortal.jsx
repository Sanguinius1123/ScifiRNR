import { useEffect, useState } from 'react';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const RESOURCE_LABELS = {
  food: 'Food',
  energy: 'Energy',
  materials: 'Materials',
  strategic_materials: 'Strategic Materials',
  igc: 'IGC',
};

export default function PlayerPortal({ gameId }) {
  const { profile } = useAuth();
  const [realm, setRealm] = useState(null);
  const [influence, setInfluence] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealm() {
      const { data: realmData } = await supabase
        .from('realms')
        .select('id, name, color, realm_resources(resource, amount)')
        .eq('game_id', gameId)
        .eq('profile_id', profile?.id)
        .single();

      setRealm(realmData);

      if (realmData) {
        const { data: infData } = await supabase
          .from('realm_influence')
          .select('influence')
          .eq('realm_id', realmData.id)
          .single();
        setInfluence(infData?.influence ?? 0);
      }

      setLoading(false);
    }
    if (profile) fetchRealm();
  }, [gameId, profile]);

  if (loading) return <div>Loading…</div>;
  if (!realm) return <div>No realm found for this game.</div>;

  const resources = Object.fromEntries(
    (realm.realm_resources ?? []).map(r => [r.resource, r.amount])
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{realm.name}</h1>
      <h2>Resources</h2>
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
      {/* TODO: workers, territory list, trade goods */}
    </div>
  );
}
