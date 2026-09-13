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
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-page-inner">
        
        <h1 className="auth-brand-title">dMAT Latin Square Drill</h1>
        <p className="auth-brand-subtitle">
          Timed 5×5 deduction practice — rows and columns only.
          Track accuracy, pivot depth and solve speed across three
          difficulty tiers.
        </p>

        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); setError(''); }}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); }}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-label">
              <span>Username</span>
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
              <span>Password</span>
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

            {error && (
              <div className="auth-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button className="auth-guest" type="button" onClick={onGuest}>
            Play as guest
          </button>
          <p className="auth-guest-caption">
            Guest scores aren't saved — no streaks, history or review list.
          </p>
        </div>
      </div>
    </div>
  );
}