import { Icon } from './icons';

export default function Masthead({ user, status, onLogout, onSignIn }) {
  return (
    <header className="masthead">
      <div className="masthead-brand">
        <div className="brand-logo-sm masthead-logo" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="masthead-logo-svg">
            <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="10.75" y="2" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4" />
            <rect x="19.5" y="2" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="2" y="10.75" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4" />
            <rect x="10.75" y="10.75" width="6.5" height="6.5" rx="1.5" fill="#3b82f6" />
            <rect x="19.5" y="10.75" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4" />
            <rect x="2" y="19.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="10.75" y="19.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4" />
            <rect x="19.5" y="19.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.9" />
          </svg>
        </div>
        <div className="masthead-title-group">
          <div className="masthead-heading-row">
            <h1 className="masthead-title">dMAT Latin Square Drill</h1>
            <span className="masthead-badge">5×5 Drill</span>
          </div>
          <span className="masthead-subtitle">Timed deduction practice — rows and columns only</span>
        </div>
      </div>
      <div className="masthead-user">
        {status === 'loading' ? null : user ? (
          <div className="user-profile-pill">
            <span className="user-avatar-badge">{user.username.charAt(0).toUpperCase()}</span>
            <span className="signed-in-label">
              <strong>{user.username}</strong>
            </span>
            <button className="btn-logout" onClick={onLogout} title="Log out" aria-label="Log out">
              <Icon.Logout />
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <button className="btn-signin-primary" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}