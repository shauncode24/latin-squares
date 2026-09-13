const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Med', high: 'High' };

function timeStr(ms) {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function Stats({ stats, history, isGuest }) {
  const overall = stats?.overall;
  const byTier = stats?.byTier || {};

  if (isGuest) {
    return (
      <div className="stats stats-guest">
        <p className="stats-guest-msg">
          <span className="stats-guest-icon">📊</span>
          Sign in to track your scores and history
        </p>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      {/* Overall summary */}
      <div className="stats-summary">
        <div className="stat">
          <div className="num">{overall?.solved ?? 0}</div>
          <div className="label">solved</div>
        </div>
        <div className="stat">
          <div className="num">
            {overall?.accuracy != null ? `${overall.accuracy}%` : '—'}
          </div>
          <div className="label">accuracy</div>
        </div>
        <div className="stat">
          <div className="num">{timeStr(overall?.avgTimeMs)}</div>
          <div className="label">avg time</div>
        </div>
      </div>

      {/* Per-tier breakdown */}
      {overall?.solved > 0 && (
        <div className="stats-tier-section">
          <div className="stats-section-title">By difficulty</div>
          <table className="tier-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Solved</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => {
                const d = byTier[t];
                if (!d) return null;
                return (
                  <tr key={t}>
                    <td>
                      <span className={`tier-badge tier-badge-${t}`}>{TIER_LABEL[t]}</span>
                    </td>
                    <td>{d.solved}</td>
                    <td>{d.correct}</td>
                    <td>{d.accuracy != null ? `${d.accuracy}%` : '—'}</td>
                    <td>{timeStr(d.avgTimeMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History list */}
      {history && history.length > 0 && (
        <div className="stats-history-section">
          <div className="stats-section-title">Recent attempts</div>
          <div className="history-list">
            {history.map((a, i) => (
              <div key={i} className={`history-row${a.correct ? ' correct' : ' wrong'}`}>
                <span className={`tier-badge tier-badge-${a.difficulty}`}>
                  {TIER_LABEL[a.difficulty]}
                </span>
                <span className="history-result">{a.correct ? '✓' : '✗'}</span>
                <span className="history-time">{timeStr(a.elapsedMs)}</span>
                <span className="history-ago">{relTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overall?.solved === 0 && (
        <p className="stats-empty">No attempts yet — solve a puzzle to start tracking!</p>
      )}
    </div>
  );
}
