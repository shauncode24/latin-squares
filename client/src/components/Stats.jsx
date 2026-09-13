import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Med', high: 'High' };
const HISTORY_PAGE = 10;

function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TimeseriesChart() {
  const [data, setData] = useState(null);
  const [bucket, setBucket] = useState('daily');
  const [open, setOpen] = useState(true);

  const load = useCallback((b) => {
    api.getTimeseries(b)
      .then((res) => setData(res.series.map((s) => ({
        ...s,
        accuracy: s.solved ? Math.round((100 * s.correct) / s.solved) : 0,
      }))))
      .catch(() => setData([]));
  }, []);

  useEffect(() => { load(bucket); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() { setOpen((v) => !v); }
  function switchBucket(b) { setBucket(b); setData(null); load(b); }

  return (
    <div className="timeseries-section">
      <button className="stats-collapsible-header" onClick={toggle}>
        <span>Progress over time</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <div className="seg-row">
            {['daily', 'weekly'].map((b) => (
              <button
                key={b}
                className={`seg-btn${bucket === b ? ' active' : ''}`}
                onClick={() => switchBucket(b)}
              >
                {b === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
          {!data ? (
            <div style={{ padding: '20px 0', color: 'var(--ink-soft)', fontSize: '13px' }}>Loading...</div>
          ) : data.length === 0 ? (
            <p className="stats-empty-body">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={shortDate} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => v + '%'} />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'accuracy' ? val + '%' : val,
                    name === 'accuracy' ? 'Accuracy' : name === 'solved' ? 'Solved' : 'Correct',
                  ]}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="solved" fill="#111827" name="Solved" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="correct" fill="#14b8a6" name="Correct" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#f97316" strokeWidth={2} dot={false} name="Accuracy" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}

export default function Stats({ stats, history, isGuest, guestAttempts, onSignUpNudge }) {
  const overall = stats && stats.overall;
  const byTier  = (stats && stats.byTier) || {};
  const streaks  = stats && stats.streaks;
  const pbs      = (stats && stats.personalBests) || {};
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);

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

  if (!overall || overall.solved === 0) {
    return (
      <div className="stats-panel">
        <div className="stats-empty-card">
          <p className="stats-empty-title">No attempts logged yet</p>
          <p className="stats-empty-body">
            Solve your first grid and your accuracy, timings, streak and
            per-tier breakdown will build up here.
          </p>
        </div>
      </div>
    );
  }

  const visibleHistory = history ? history.slice(0, historyShown) : [];
  const pbSummary = TIERS.filter((t) => pbs[t] != null)
    .map((t) => `${TIER_LABEL[t][0]} ${timeStr(pbs[t])}`)
    .join(', ') || '-';

  return (
    <div className="stats-panel">
      <div className="stats-header-row">
        <h2>Your practice record</h2>
        {streaks && (streaks.current > 0 || streaks.best > 0) && (
          <span className="streak-chip">{'🔥'} {streaks.current}-day streak</span>
        )}
      </div>

      <div className="stats-summary-grid">
        <div className="stat-cell"><div className="label">Solved</div><div className="num">{overall.solved}/{overall.solved}</div></div>
        <div className="stat-cell"><div className="label">Accuracy</div><div className="num">{overall.accuracy != null ? overall.accuracy + '%' : '-'}</div></div>
        <div className="stat-cell"><div className="label">Average time</div><div className="num">{timeStr(overall.avgTimeMs)}</div></div>
        <div className="stat-cell"><div className="label">Median time</div><div className="num">{timeStr(overall.medianTimeMs)}</div></div>
        <div className="stat-cell"><div className="label">Fastest</div><div className="num">{timeStr(overall.fastestMs)}</div></div>
        <div className="stat-cell"><div className="label">Slowest</div><div className="num">{timeStr(overall.slowestMs)}</div></div>
        <div className="stat-cell"><div className="label">Time practising</div><div className="num">{Math.round((overall.totalPracticeMs || 0) / 60000)}m</div></div>
        <div className="stat-cell"><div className="label">Personal bests</div><div className="num">{pbSummary}</div></div>
      </div>

      <div className="stats-tier-section">
        <div className="stats-section-title">By difficulty</div>
        <div className="by-tier-list">
          {TIERS.map((t) => {
            const d = byTier[t];
            const hasData = d && d.solved > 0;
            return (
              <div key={t} className="by-tier-row">
                <div className="by-tier-left">
                  <span className="tier-badge">{t.toUpperCase()}</span>
                  {hasData ? (
                    <span className="by-tier-figures">{d.correct}/{d.solved} · {d.accuracy}%</span>
                  ) : (
                    <span className="by-tier-empty">No attempts yet</span>
                  )}
                </div>
                {hasData && (
                  <div className="by-tier-right">
                    avg {timeStr(d.avgTimeMs)} &nbsp; {d.hinted || 0} hints &nbsp; best clean {timeStr(pbs[t])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TimeseriesChart />

      {history && history.length > 0 && (
        <div className="stats-history-section">
          <div className="stats-section-title">Recent attempts</div>
          <div className="history-list">
            {visibleHistory.map((a, i) => (
              <div key={i} className={'history-row' + (a.correct ? ' correct' : ' wrong')}>
                <span className="tier-badge">{TIER_LABEL[a.difficulty]}</span>
                <span className="history-result">{a.correct ? '\u2713' : '\u2717'}</span>
                <span className="history-time">{timeStr(a.elapsedMs)}</span>
                {a.hintUsed && <span className="history-hint" title="Hint used">\u2691</span>}
                <span className="history-ago">{relTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
          {history.length > historyShown && (
            <button className="btn-link history-load-more" onClick={() => setHistoryShown((n) => n + HISTORY_PAGE)}>
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}