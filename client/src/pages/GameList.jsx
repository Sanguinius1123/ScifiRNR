import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function GameList() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('game_participants')
        .select('role, games(id, name, current_turn, current_phase)')
        .eq('profile_id', profile?.id);
      if (!error) setGames(data ?? []);
      setLoading(false);
    }
    if (profile) fetchGames();
  }, [profile]);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your Games</h1>
        <div>
          <span style={{ marginRight: 12 }}>{profile?.username}</span>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </div>
      {loading && <p>Loading…</p>}
      {!loading && games.length === 0 && <p>You haven't been added to any games yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {games.map(({ role, games: game }) => (
          <li
            key={game.id}
            onClick={() => navigate(`/game/${game.id}`)}
            style={{ padding: 12, border: '1px solid #ccc', marginBottom: 8, cursor: 'pointer' }}
          >
            <strong>{game.name}</strong>
            <span style={{ marginLeft: 12, color: '#888' }}>
              Turn {game.current_turn} · {game.current_phase} · {role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
