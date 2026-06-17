import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import GMDashboard from './GMDashboard.jsx';
import PlayerPortal from './PlayerPortal.jsx';
import ObserverView from './ObserverView.jsx';

export default function GameView() {
  const { gameId } = useParams();
  const { profile } = useAuth();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      const { data } = await supabase
        .from('game_participants')
        .select('role')
        .eq('game_id', gameId)
        .eq('profile_id', profile?.id)
        .single();
      setRole(data?.role ?? null);
      setLoading(false);
    }
    if (profile) fetchRole();
  }, [gameId, profile]);

  if (loading) return <div>Loading…</div>;
  if (!role) return <div>You are not a participant in this game.</div>;

  if (role === 'gm') return <GMDashboard gameId={gameId} />;
  if (role === 'player') return <PlayerPortal gameId={gameId} />;
  return <ObserverView gameId={gameId} />;
}
