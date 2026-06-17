import { useAuth } from '../contexts/AuthContext.jsx';

export default function GMDashboard({ gameId }) {
  const { profile } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1>GM Dashboard</h1>
      <p>Game: <code>{gameId}</code></p>
      <p>Logged in as <strong>{profile?.username}</strong></p>
      {/* TODO: realm overview table, direct resource editing, fog-of-war-bypass map */}
    </div>
  );
}
