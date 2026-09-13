import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';
import { Icon } from './icons';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const HISTORY_PAGE = 8;

function formatChartDate(iso, bucket) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    if (bucket === 'hourly') return iso.slice(11, 16);
    return iso;
  }
  if (bucket === 'hourly') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label, bucket }) {
  if (!active || !payload || !payload.length) return null;
  const dateStr = formatChartDate(label, bucket);
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-header">{dateStr}</div>
      <div className="chart-tooltip-body">
        {payload.map((entry, index) => {
          const seriesColor = entry.dataKey === 'solved' ? '#38bdf8' : '#60a5fa';
          return (
            <div key={index} className="chart-tooltip-row">
              <span className="tooltip-dot" style={{ background: seriesColor }} />
              <span className="tooltip-label">{entry.name}:</span>
              <span className="tooltip-val">
                {entry.name === 'Accuracy' ? `${entry.value}%` : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PerformanceChart() {
  const [data, setData] = useState(null);
  const [bucket, setBucket] = useState('daily');
  const [loading, setLoading] = useState(true);

  const load = useCallback((b) => {
    setLoading(true);
    api.getTimeseries(b)
      .then((res) => {
        setData(res.series || []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(bucket);
  }, [bucket, load]);

  return (
    <div className="stats-card chart-card">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-card-title">Performance & Activity Trend</h3>
          <p className="chart-card-sub">Track your accuracy and solved drills over time</p>
        </div>
        <div className="chart-seg-group">
          <button
            className={`chart-seg-btn${bucket === 'hourly' ? ' active' : ''}`}
            onClick={() => setBucket('hourly')}
          >
            Hour to Hour
          </button>
          <button
            className={`chart-seg-btn${bucket === 'daily' ? ' active' : ''}`}
            onClick={() => setBucket('daily')}
          >
            Day to Day
          </button>
        </div>
      </div>

      <div className="chart-wrapper">
        {loading ? (
          <div className="chart-state-box">Loading trend data...</div>
        ) : !data || data.length === 0 ? (
          <div className="chart-state-box">No practice activity logged for this time range yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => formatChartDate(v, bucket)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip bucket={bucket} />} />
              <Legend
                wrapperStyle={{ paddingTop: '14px', fontSize: '12px' }}
                iconType="circle"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="solved"
                name="Solved Grids"
                stroke="#111827"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#111827' }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="accuracy"
                name="Accuracy"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
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
      <div className="stats-guest-card">
        {solved > 0 && (
          <div className="guest-stat-badge">
            Current Session: <strong>{correct}/{solved}</strong> solved correctly
          </div>
        )}
        <div className="guest-nudge-box">
          <span className="guest-nudge-icon">📊</span>
          <div>
            <h4>Track your long-term progress</h4>
            <p>
              {showNudge ? (
                <>Great job! <button className="btn-link" onClick={onSignUpNudge}>Sign up</button> to save your history and view performance charts.</>
              ) : (
                'Sign in to save your practice streaks, timings, and level mastery statistics.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!overall || overall.solved === 0) {
    return (
      <div className="stats-empty-card">
        <div className="stats-empty-icon">📈</div>
        <h3>No attempts logged yet</h3>
        <p>Complete your first Latin Square drill to see accuracy charts, average timings, and tier statistics build up here.</p>
      </div>
    );
  }

  const visibleHistory = history ? history.slice(0, historyShown) : [];

  return (
    <div className="stats-dashboard">
      {/* Top Header Metrics Row */}
      <div className="stats-hero-grid">
        <div className="hero-stat-card">
          <div className="stat-card-icon bg-blue">
            <Icon.CheckCircle />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Total Solved</span>
            <div className="stat-card-val">{overall.solved}</div>
            <span className="stat-card-sub">{overall.correct} clean answers</span>
          </div>
        </div>

        <div className="hero-stat-card">
          <div className="stat-card-icon bg-emerald">
            <Icon.Target />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Overall Accuracy</span>
            <div className="stat-card-val">{overall.accuracy != null ? `${overall.accuracy}%` : '-'}</div>
            <span className="stat-card-sub">Success rate</span>
          </div>
        </div>

        <div className="hero-stat-card">
          <div className="stat-card-icon bg-amber">
            <Icon.Clock />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Average Time</span>
            <div className="stat-card-val">{timeStr(overall.avgTimeMs)}</div>
            <span className="stat-card-sub">Fastest: {timeStr(overall.fastestMs)}</span>
          </div>
        </div>

        <div className="hero-stat-card">
          <div className="stat-card-icon bg-purple">
            <Icon.Flame />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Streak</span>
            <div className="stat-card-val">{streaks?.current || 0} <span className="unit">days</span></div>
            <span className="stat-card-sub">Best streak: {streaks?.best || 0}d</span>
          </div>
        </div>
      </div>

      {/* Main Line Chart Section */}
      <PerformanceChart />

      {/* Bottom Grid: Tier Breakdown + Recent History */}
      <div className="stats-bottom-grid">
        {/* Tier Mastery Section */}
        <div className="stats-card">
          <div className="card-header-simple">
            <h3>Mastery by Difficulty</h3>
          </div>
          <div className="tier-breakdown-list">
            {TIERS.map((t) => {
              const d = byTier[t];
              const hasData = d && d.solved > 0;
              const acc = hasData ? d.accuracy : 0;
              return (
                <div key={t} className="tier-breakdown-item">
                  <div className="tier-item-head">
                    <div className="tier-item-title">
                      <span className={`tier-tag tier-${t}`}>{TIER_LABEL[t]}</span>
                      <span className="tier-item-solved">{hasData ? `${d.correct}/${d.solved} solved` : 'No attempts'}</span>
                    </div>
                    {hasData && <span className="tier-item-time">Avg {timeStr(d.avgTimeMs)}</span>}
                  </div>
                  <div className="tier-progress-bar-bg">
                    <div
                      className={`tier-progress-bar-fill fill-${t}`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>
                  {hasData && (
                    <div className="tier-item-meta">
                      <span>Accuracy: <strong>{acc}%</strong></span>
                      <span>Best Clean: <strong>{pbs[t] ? timeStr(pbs[t]) : '-'}</strong></span>
                      <span>Hints: <strong>{d.hinted || 0}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Attempts History */}
        <div className="stats-card">
          <div className="card-header-simple">
            <h3>Recent Attempts</h3>
          </div>
          {history && history.length > 0 ? (
            <>
              <div className="activity-feed">
                {visibleHistory.map((a, i) => (
                  <div key={i} className={`activity-row ${a.correct ? 'is-correct' : 'is-wrong'}`}>
                    <div className="activity-status-icon">
                      {a.correct ? '✓' : '✕'}
                    </div>
                    <div className="activity-info">
                      <span className={`tier-badge-sm tier-${a.difficulty}`}>{a.difficulty}</span>
                      <span className="activity-time">{timeStr(a.elapsedMs)}</span>
                      {a.hintUsed && <span className="hint-pill" title="Hint requested">Hint used</span>}
                    </div>
                    <span className="activity-ago">{relTime(a.createdAt)}</span>
                  </div>
                ))}
              </div>
              {history.length > historyShown && (
                <button
                  className="btn-load-more"
                  onClick={() => setHistoryShown((n) => n + HISTORY_PAGE)}
                >
                  Show More History
                </button>
              )}
            </>
          ) : (
            <div className="empty-sub-card">No recent attempt history available.</div>
          )}
        </div>
      </div>
    </div>
  );
}