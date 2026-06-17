import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import supabase from '../lib/supabase.js';
import HexMap from '../components/HexMap.jsx';
import PlayerPortal from './PlayerPortal.jsx';
import PlayerConfigModal from '../components/PlayerConfigModal.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export default function GMDashboard({ gameId }) {
  const { profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [realms, setRealms] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const autocompleteRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [configTarget, setConfigTarget] = useState(null); // { realmId, playerName, realmName }

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    let cancelled = false;
    async function fetchGame() {
      const token = sessionRef.current?.access_token;
      if (!token) return;
      const res = await fetch(`${SERVER}/api/games/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!cancelled) {
        setGame(data);
        setParticipants(data.game_participants ?? []);
        setLoading(false);
      }
    }
    fetchGame();
    return () => { cancelled = true; };
  }, [gameId]);

  useEffect(() => {
    supabase.from('profiles').select('id, username').then(({ data }) => {
      if (data) setAllProfiles(data);
    });
  }, []);

  useEffect(() => {
    if (!gameId) return;
    supabase.from('realms').select('id, profile_id, name').eq('game_id', gameId).then(({ data }) => {
      if (data) setRealms(data);
    });
  }, [gameId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  const players = participants.filter(p => p.role === 'player');

  const participantIds = new Set(participants.map(p => p.profiles?.id));
  const suggestions = allProfiles.filter(p =>
    !participantIds.has(p.id) &&
    p.username.toLowerCase().includes(addUsername.toLowerCase())
  );

  function selectSuggestion(username) {
    setAddUsername(username);
    setDropdownOpen(false);
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    const res = await fetch(`${SERVER}/api/games/${gameId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ username: addUsername.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error);
    } else {
      setParticipants(prev => [...prev, { role: 'player', profiles: json.profiles }]);
      setAddUsername('');
    }
    setAdding(false);
  }

  async function handleDeleteGame() {
    setDeleting(true);
    const res = await fetch(`${SERVER}/api/games/${gameId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      navigate('/games');
    } else {
      const json = await res.json();
      alert(json.error ?? 'Failed to delete game');
      setDeleting(false);
    }
  }

  if (viewingPlayer) {
    return (
      <div>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #eee', display: 'flex', gap: 8 }}>
          <button onClick={() => setViewingPlayer(null)}>← Back to Dashboard</button>
          <span style={{ lineHeight: '30px', color: '#666' }}>
            Viewing: <strong>{viewingPlayer.username}</strong>
          </span>
        </div>
        <PlayerPortal gameId={gameId} profileId={viewingPlayer.id} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => navigate('/games')}>← Games List</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{profile?.username}</span>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <h1>{game?.name} — GM Dashboard</h1>

      <HexMap gameId={gameId} isGM={true} />

      <h2 style={{ marginTop: 32 }}>Players</h2>
      <form onSubmit={handleAddPlayer} style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 360 }}>
        <div ref={autocompleteRef} style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={addUsername}
            onChange={e => { setAddUsername(e.target.value); setDropdownOpen(true); setAddError(null); }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search username…"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          {dropdownOpen && suggestions.length > 0 && (
            <ul style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              margin: 0, padding: 0, listStyle: 'none',
              border: '1px solid #ccc', background: '#fff',
              maxHeight: 200, overflowY: 'auto', zIndex: 10,
            }}>
              {suggestions.map(p => (
                <li
                  key={p.id}
                  onMouseDown={() => selectSuggestion(p.username)}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  {p.username}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" disabled={adding || !addUsername.trim()}>
          {adding ? 'Adding…' : 'Add Player'}
        </button>
      </form>
      {addError && <p style={{ color: 'red' }}>{addError}</p>}

      {players.length === 0
        ? <p style={{ color: '#888' }}>No players in this game yet.</p>
        : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {players.map(({ profiles: p }) => {
              const realm = realms.find(r => r.profile_id === p.id);
              return (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span>{p.username}</span>
                  {realm && <span style={{ fontSize: 12, color: '#888' }}>({realm.name})</span>}
                  <button onClick={() => setViewingPlayer(p)}>View Portal</button>
                  {realm && (
                    <button onClick={() => setConfigTarget({ realmId: realm.id, playerName: p.username, realmName: realm.name })}>
                      ⚙ Configure
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )
      }

      <PlayerConfigModal gameId={gameId} target={configTarget} onClose={() => setConfigTarget(null)} />

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 8, maxWidth: 400, width: '100%' }}>
            <h2 style={{ marginTop: 0 }}>Delete "{game?.name}"?</h2>
            <p>This will permanently delete the game and all its data. This cannot be undone.</p>
            <p>Type <strong>DELETE</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                onClick={handleDeleteGame}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                style={{ color: '#fff', background: '#c00', borderColor: '#c00' }}
              >
                {deleting ? 'Deleting…' : 'Delete Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TODO: realm overview table, direct resource editing */}

      {/* Delete Game — fixed bottom-right */}
      <button
        onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          color: '#fff', background: '#991b1b', border: 'none',
          padding: '10px 18px', borderRadius: 6, cursor: 'pointer',
        }}
      >
        Delete Game
      </button>
    </div>
  );
}
