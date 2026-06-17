import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate('/games', { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp) {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username, registrationCode }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); setLoading(false); return; }
      setError('Check your email and click the confirmation link, then sign in.');
      setLoading(false);
      return;
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) { setError(signInErr.message); setLoading(false); return; }
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h1>Realms and Rulers</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email<br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
        </div>
        {isSignUp && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label>Username<br />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Registration Code<br />
                <input type="text" value={registrationCode} onChange={e => setRegistrationCode(e.target.value)} placeholder="Leave blank if GM" />
              </label>
            </div>
          </>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginRight: 8 }}>
          {loading ? 'Loading…' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }}>
          {isSignUp ? 'Already have an account?' : 'Need an account?'}
        </button>
      </form>
    </div>
  );
}
