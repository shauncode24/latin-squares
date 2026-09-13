import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function AuthScreen({ onGuest, onSuccess }) {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(username.trim(), password);
      } else {
        await signup(username.trim(), password);
      }
      // AuthContext updates user → close the auth screen
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">◈</span>
          <h2>dMAT Latin Square</h2>
          <p>Track your performance over time</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Log in
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Username
            <input
              className="auth-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              minLength={2}
              maxLength={30}
              required
              placeholder="Enter username"
              disabled={loading}
            />
          </label>
          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              minLength={4}
              required
              placeholder="Enter password"
              disabled={loading}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="auth-guest" onClick={onGuest}>
          Play as Guest
          <span className="auth-guest-note">Scores won't be saved</span>
        </button>
      </div>
    </div>
  );
}
