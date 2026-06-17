export default function ObserverView({ gameId }) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Observer View</h1>
      <p>Game: <code>{gameId}</code></p>
      {/* TODO: read-only galaxy map */}
    </div>
  );
}
