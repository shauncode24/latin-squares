import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Med', high: 'High' };

function TimeseriesChart() {
  const [data, setData] = useState(null);
  const [bucket, setBucket] = useState('daily');
  const [open, setOpen] = useState(false);

  const load = useCallback((b) => {
    api.getTimeseries(b)
      .then((res) => setData(res.series))
      .catch(() => setData([]));
  }, []);

  function toggle() {
    if (!open && !data) load(bucket);
    setOpen((v) => !v);
  }

  function switchBucket(b) {
    setBucket(b);
    setData(null);
    load(b);
  }

  return (
    <div className="timeseries-section">
      <button className="stats-section-title timeseries-toggle" onClick={toggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}>
        Progress over time {open ? '\u25b2' : '\u25bc'}
      </button>
      {open && (
        <>
          <div className="timeseries-bucket-row" style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
            {['daily', 'weekly'].map((b) => (
              <button key={b}
                style={{ padding: '4px 10px', fontSize: '11px', fontFamily: 'inherit',
                  border: '1px solid', borderColor: bucket === b ? 'var(--accent)' : 'var(--line)',
                  background: bucket === b ? 'var(--accent-soft)' : 'var(--panel)',
                  color: bucket === b ? 'var(--accent)' : 'var(--ink-soft)',
                  borderRadius: '3px', cursor: 'pointer' }}
                onClick={() => switchBucket(b)}>
                {b === 'daily' ? 'Last 30 days' : 'Last 12 weeks'}
              </button>
            ))}
          </div>
          {!data ? (
            <div style={{ padding: '20px 0', color: 'var(--ink-soft)', fontSize: '13px' }}>Loading...</div>
          ) : data.length === 0 ? (
            <p className="stats-empty">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'avgTimeMs' ? timeStr(val) : val,
                    name === 'avgTimeMs' ? 'Avg time' : name,
                  ]}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="solved"  stroke="#8a9190" dot={false} name="Solved" />
                <Line type="monotone" dataKey="correct" stroke="#1f6f5c" dot={false} name="Correct" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}

// FIX: was computed off global accuracy only. Now flags a specific tier.
function AdaptiveBanner({ stats }) {
  if (!stats || !stats.byTier) return null;
  for (const t of TIERS) {
    const d = stats.byTier[t];
    if (!d || d.solved < 5) continue;
    if (d.accuracy >= 90) {
      return <div className="adaptive-banner good">Strong on {TIER_LABEL[t]} ({d.accuracy}%) — try the next difficulty up.</div>;
    }
    if (d.accuracy != null && d.accuracy < 60) {
      return <div className="adaptive-banner warn">{TIER_LABEL[t]} accuracy is {d.accuracy}% — worth reinforcing before moving up.</div>;
    }
  }
  return null;
}

function WeaknessCard({ onPractice }) {
  const [weakest, setWeakest] = useState(undefined); // undefined = loading

  useEffect(() => {
    api.getWeakest().then((d) => setWeakest(d.weakest)).catch(() => setWeakest(null));
  }, []);

  if (weakest === undefined || !weakest) return null;

  return (
    <div className="adaptive-banner warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span>
        Weakest spot: {weakest.difficulty} / {weakest.patternTag.replace(/-/g, ' ')} — {weakest.accuracy}% over last {weakest.sampleSize}
      </span>
      <button className="btn-link" onClick={() => onPractice(weakest)}>Practice this →</button>
    </div>
  );
}

export default function Stats({ stats, history, isGuest, guestAttempts, onSignUpNudge, onPracticeWeakness }) {
  const overall = stats && stats.overall;
  const byTier  = (stats && stats.byTier) || {};
  const streaks  = stats && stats.streaks;
  const pbs      = (stats && stats.personalBests) || {};

  if (isGuest) {
    const solved  = (guestAttempts && guestAttempts.length) || 0;
    const correct = guestAttempts ? guestAttempts.filter((a) => a.correct).length : 0;
    const showNudge = solved >= 3;
    return (
      <div className="stats stats-guest">
        {solved > 0 && (
          <p className="stats-guest-session">
            This session: <strong>{correct}/{solved}</strong> correct
          </p>
        )}
        <p className="stats-guest-msg">
          <span className="stats-guest-icon">{'📊'}</span>
          {showNudge ? (
            <>Nice work! <button className="btn-link" onClick={onSignUpNudge}>Sign up</button> to save your history.</>
          ) : (
            'Sign in to track your scores and history'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <AdaptiveBanner stats={stats} />
      {onPracticeWeakness && <WeaknessCard onPractice={onPracticeWeakness} />}

      {streaks && (streaks.current > 0 || streaks.best > 0) && (
        <div className="streaks-row">
          <span className="streak-chip">{'🔥'} {streaks.current} day practice streak</span>
          {streaks.best > streaks.current && (
            <span className="streak-best">Best: {streaks.best}</span>
          )}
        </div>
      )}

      <div className="stats-summary">
        <div className="stat">
          <div className="num">{(overall && overall.solved) || 0}</div>
          <div className="label">solved</div>
        </div>
        <div className="stat">
          <div className="num">{overall && overall.accuracy != null ? overall.accuracy + '%' : '-'}</div>
          <div className="label">accuracy</div>
        </div>
        <div className="stat">
          <div className="num">{timeStr(overall && overall.avgTimeMs)}</div>
          <div className="label">avg time</div>
        </div>
      </div>

      {overall && overall.solved > 0 && (
        <div className="stats-tier-section">
          <div className="stats-section-title">Timing detail</div>
          <div className="pbs-row">
            <div className="pb-chip"><span>Median</span><span className="pb-time">{timeStr(overall.medianTimeMs)}</span></div>
            <div className="pb-chip"><span>Fastest</span><span className="pb-time">{timeStr(overall.fastestMs)}</span></div>
            <div className="pb-chip"><span>Slowest</span><span className="pb-time">{timeStr(overall.slowestMs)}</span></div>
            <div className="pb-chip"><span>Total practice</span><span className="pb-time">{Math.round((overall.totalPracticeMs || 0) / 60000)}m</span></div>
          </div>
        </div>
      )}

      {Object.keys(pbs).length > 0 && (
        <div className="stats-tier-section">
          <div className="stats-section-title">Personal bests (fastest clean solve)</div>
          <div className="pbs-row">
            {TIERS.map((t) => pbs[t] != null ? (
              <div key={t} className="pb-chip">
                <span className={'tier-badge tier-badge-' + t}>{TIER_LABEL[t]}</span>
                <span className="pb-time">{timeStr(pbs[t])}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {overall && overall.solved > 0 && (
        <div className="stats-tier-section">
          <div className="stats-section-title">By difficulty</div>
          <table className="tier-table">
            <thead>
              <tr><th>Tier</th><th>Solved</th><th>Accuracy</th><th>Hints</th><th>Avg time</th></tr>
            </thead>
            <tbody>
              {TIERS.map((t) => {
                const d = byTier[t];
                if (!d) return null;
                return (
                  <tr key={t}>
                    <td><span className={'tier-badge tier-badge-' + t}>{TIER_LABEL[t]}</span></td>
                    <td>{d.solved}</td>
                    <td>{d.accuracy != null ? d.accuracy + '%' : '-'}</td>
                    <td>{d.hinted || 0}</td>
                    <td>{timeStr(d.avgTimeMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TimeseriesChart />

      {history && history.length > 0 && (
        <div className="stats-history-section">
          <div className="stats-section-title">Recent attempts</div>
          <div className="history-list">
            {history.map((a, i) => (
              <div key={i} className={'history-row' + (a.correct ? ' correct' : ' wrong')}>
                <span className={'tier-badge tier-badge-' + a.difficulty}>{TIER_LABEL[a.difficulty]}</span>
                <span className="history-result">{a.correct ? '\u2713' : '\u2717'}</span>
                <span className="history-time">{timeStr(a.elapsedMs)}</span>
                {a.hintUsed && <span className="history-hint" title="Hint used">\u2691</span>}
                <span className="history-ago">{relTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!overall || overall.solved === 0) && (
        <p className="stats-empty">No attempts yet - solve a puzzle to start tracking!</p>
      )}
    </div>
  );
}