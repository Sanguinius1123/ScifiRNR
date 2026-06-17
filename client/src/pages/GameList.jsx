import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export default function GameList() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState(null);
  const [newGameName, setNewGameName] = useState('');
  const [creatingGame, setCreatingGame] = useState(false);

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
    else if (session) setLoading(false); // authenticated but no profile yet
  }, [profile, session]);

  async function handleCreateGame(e) {
    e.preventDefault();
    if (!newGameName.trim()) return;
    setCreatingGame(true);
    const res = await fetch(`${SERVER}/api/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: newGameName.trim() }),
    });
    const json = await res.json();
    if (res.ok) {
      setNewGameName('');
      navigate(`/game/${json.id}`);
    }
    setCreatingGame(false);
  }

  async function handleSetUsername(e) {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, username });
    if (error) setUsernameError(error.message);
    else window.location.reload();
  }

  // Authenticated but profile row doesn't exist yet — ask for username.
  if (!loading && session && !profile) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
        <h2>Choose a username</h2>
        <form onSubmit={handleSetUsername}>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <button type="submit" style={{ marginLeft: 8 }}>Save</button>
        </form>
        {usernameError && <p style={{ color: 'red' }}>{usernameError}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your Games</h1>
        <div>
          <span style={{ marginRight: 12 }}>{profile?.username}</span>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </div>
      {profile?.global_role === 'gm' && (
        <form onSubmit={handleCreateGame} style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newGameName}
            onChange={e => setNewGameName(e.target.value)}
            placeholder="New game name…"
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={creatingGame}>
            {creatingGame ? 'Creating…' : 'Create Game'}
          </button>
        </form>
      )}
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
