import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';
import { Icon } from './icons';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const HISTORY_PAGE = 8;

const TIER_COLORS = {
  low:    '#6366f1',
  medium: '#f59e0b',
  high:   '#ef4444',
};

const METRIC_TABS = [
  { key: 'solved',     label: 'Volume',   unit: '',  suffix: '_solved' },
  { key: 'accuracy',   label: 'Accuracy', unit: '%', suffix: '_accuracy' },
  { key: 'avgTimeSec', label: 'Speed',    unit: 's', suffix: '_avgTimeSec' },
];

const TIER_TARGETS_SEC = { low: 20, medium: 50, high: 75 };
const MIN_PX_PER_POINT = 56;

function fmtDate(iso, view) {
  if (!iso) return '';
  if (view === 'daily') {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const time = iso.slice(11, 16);
  if (iso.slice(11, 13) === '00' && iso.slice(14, 16) === '00') {
    const d = new Date(iso.replace(' ', 'T') + ':00');
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return time;
}

function BarTooltip({ active, payload, label, metric, diffFilter, view }) {
  if (!active || !payload?.length) return null;
  const mt = METRIC_TABS.find(t => t.key === metric);
  const unit = mt?.unit || '';

  const barEntries = payload.filter(p => p.dataKey !== '_trend' && p.value != null && p.value !== 0);
  const trendEntry = payload.find(p => p.dataKey === '_trend');

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-header">{fmtDate(label, view)}</div>
      <div className="chart-tooltip-body">
        {barEntries.map(entry => (
          <div key={entry.dataKey} className="chart-tooltip-row">
            <span className="tooltip-dot" style={{ background: entry.fill || entry.stroke }} />
            <span className="tooltip-label">{entry.name}:</span>
            <span className="tooltip-val">{entry.value}{unit}</span>
          </div>
        ))}
        {trendEntry?.value != null && (
          <div className="chart-tooltip-row chart-tooltip-trend">
            <span className="tooltip-dot" style={{ background: '#374151' }} />
            <span className="tooltip-label">Trend:</span>
            <span className="tooltip-val">{trendEntry.value}{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceChart({ byTier, pbs }) {
  const [data,       setData]       = useState(null);
  const [view,       setView]       = useState('hourly');
  const [interval,   setInterval]   = useState('1hr');
  const [metric,     setMetric]     = useState('solved');
  const [diffFilter, setDiffFilter] = useState('all');
  const [loading,    setLoading]    = useState(true);
  const scrollRef                   = useRef(null);
  const [containerW, setContainerW] = useState(700);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (el.scrollWidth > el.clientWidth) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const load = useCallback((v, iv) => {
    setLoading(true);
    api.getTimeseries(v, iv)
      .then(res => { setData(res.series || []); setLoading(false); })
      .catch(() => { setData([]); setLoading(false); });
  }, []);

  useEffect(() => { load(view, interval); }, [view, interval, load]);

  const mt = METRIC_TABS.find(t => t.key === metric);
  const suffix = mt?.suffix || '_solved';
  const unit   = mt?.unit   || '';

  const chartData = data ?? [];

  const chartW      = Math.max(containerW, chartData.length * MIN_PX_PER_POINT);
  const needsScroll = chartW > containerW + 8;

  useEffect(() => {
    if (!loading && chartData.length > 0 && scrollRef.current) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, chartData.length, view, interval]);

  const handleMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeftStart.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (scrollRef.current) {
        scrollRef.current.style.cursor = 'grab';
      }
    }
  };

  const activeTiers = diffFilter === 'all' ? TIERS : [diffFilter];
  const barSize     = diffFilter === 'all' ? 10 : 16;

  const tierSpeedData = TIERS.map(t => {
    const d = byTier[t];
    const avgSec  = d?.avgTimeMs ? Math.round(d.avgTimeMs / 100) / 10 : null;
    const target  = TIER_TARGETS_SEC[t];
    const bestSec = pbs[t] ? Math.round(pbs[t] / 100) / 10 : null;
    return { tier: t, avgSec, target, bestSec, underTarget: avgSec != null && avgSec <= target };
  });

  return (
    <div className="perf-chart-section">
      <div className="stats-card chart-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-card-title">Activity Timeline</h3>
            <p className="chart-card-sub">Bar chart with trend line — use filters to explore your data</p>
          </div>
        </div>

        <div className="chart-filter-row">
          <div className="chart-filter-group">
            <div className="chart-seg-group">
              <button className={`chart-seg-btn${view === 'hourly' ? ' active' : ''}`} onClick={() => setView('hourly')}>Hourly</button>
              <button className={`chart-seg-btn${view === 'daily'  ? ' active' : ''}`} onClick={() => setView('daily')}>Daily</button>
            </div>
          </div>

          {view === 'hourly' && (
            <div className="chart-filter-group">
              <div className="chart-seg-group">
                {[{k:'15min',l:'15 min'},{k:'30min',l:'30 min'},{k:'1hr',l:'1 hr'}].map(iv => (
                  <button
                    key={iv.k}
                    className={`chart-seg-btn${interval === iv.k ? ' active' : ''}`}
                    onClick={() => setInterval(iv.k)}
                  >{iv.l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="chart-filter-group">
            <div className="chart-seg-group">
              {[{k:'all',l:'All'},{k:'low',l:'Low'},{k:'medium',l:'Med'},{k:'high',l:'High'}].map(d => (
                <button
                  key={d.k}
                  className={`chart-seg-btn${diffFilter === d.k ? ' active' : ''}`}
                  onClick={() => setDiffFilter(d.k)}
                >{d.l}</button>
              ))}
            </div>
          </div>

          <div className="chart-filter-group">
            <div className="chart-seg-group">
              {METRIC_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`chart-seg-btn${metric === tab.key ? ' active' : ''}`}
                  onClick={() => setMetric(tab.key)}
                >{tab.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="chart-scroll-outer"
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {loading ? (
            <div className="chart-state-box">Loading...</div>
          ) : !chartData.length ? (
            <div className="chart-state-box">No activity in this time range yet.</div>
          ) : (
            <>
              {needsScroll && <div className="chart-scroll-hint">← scroll to see full range →</div>}
              <div className="chart-scroll-inner" style={{ width: chartW }}>
                <ResponsiveContainer width="100%" height={290}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -2, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.07)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={v => fmtDate(v, view)}
                      axisLine={false}
                      tickLine={false}
                      padding={{ left: 16, right: 16 }}
                      interval={Math.max(0, Math.ceil(chartData.length / 12) - 1)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}${unit}`}
                      domain={metric === 'accuracy' ? [0, 100] : ['auto', 'auto']}
                      width={40}
                      allowDecimals={metric !== 'solved'}
                    />
                    <Tooltip content={<BarTooltip metric={metric} diffFilter={diffFilter} view={view} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    {activeTiers.map(tier => (
                      <Bar
                        key={tier}
                        dataKey={`${tier}${suffix}`}
                        name={TIER_LABEL[tier]}
                        fill={TIER_COLORS[tier]}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={barSize}
                        opacity={0.85}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-bar-legend">
                {activeTiers.map(t => (
                  <span key={t} className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: TIER_COLORS[t] }} />
                    {TIER_LABEL[t]}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="stats-card speed-target-card">
        <div className="card-header-simple">
          <h3>Speed vs. Target Time</h3>
          <p className="chart-card-sub" style={{ marginBottom: '20px' }}>Your average solve time per tier compared to the passing threshold</p>
        </div>
        <div className="speed-tier-list">
          {tierSpeedData.map(({ tier, avgSec, target, bestSec, underTarget }) => {
            const barPct = avgSec == null ? 0 : Math.min(100, (avgSec / (target * 1.5)) * 100);
            const targetPct = Math.min(100, (target / (target * 1.5)) * 100);
            return (
              <div key={tier} className="speed-tier-row">
                <div className="speed-tier-head">
                  <span className={`tier-tag tier-${tier}`}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                  <div className="speed-tier-values">
                    {avgSec != null ? (
                      <>
                        <span className={`speed-val ${underTarget ? 'under-target' : 'over-target'}`}>
                          {avgSec}s avg
                        </span>
                        <span className="speed-badge">
                          {underTarget
                            ? `✓ ${(target - avgSec).toFixed(1)}s under target`
                            : `${(avgSec - target).toFixed(1)}s over ${target}s target`}
                        </span>
                      </>
                    ) : (
                      <span className="speed-no-data">No data yet</span>
                    )}
                    {bestSec != null && <span className="speed-best">Best clean: {bestSec}s</span>}
                  </div>
                </div>
                <div className="speed-bar-track">
                  {avgSec != null && (
                    <div
                      className={`speed-bar-fill ${underTarget ? 'fill-good' : 'fill-bad'}`}
                      style={{ width: `${barPct}%` }}
                    />
                  )}
                  <div className="speed-target-marker" style={{ left: `${targetPct}%` }} />
                </div>
                <div className="speed-track-labels">
                  <span>0s</span>
                  <span style={{ marginLeft: `${targetPct}%` }} className="target-label-text">Target: {target}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Stats({ stats, history, isGuest, guestAttempts, onSignUpNudge }) {
  const overall = stats && stats.overall;
  const byTier  = (stats && stats.byTier) || {};
  const byPattern = (stats && stats.byPattern) || {}; // NEW
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
  const patternEntries = Object.entries(byPattern)
    .filter(([, d]) => d.solved > 0)
    .sort((a, b) => b[1].solved - a[1].solved);

  return (
    <div className="stats-dashboard">
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

      <PerformanceChart byTier={byTier} pbs={pbs} />

      <div className="stats-bottom-grid">
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
                      <span>Consistency: <strong>{d.consistencyMs != null ? `±${timeStr(d.consistencyMs)}` : '-'}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* NEW: Pattern Breakdown — surfaces the pivot-distance / pattern-tag
            sub-axis longitudinally, using byPattern which was already
            computed server-side but never rendered until now. */}
        {patternEntries.length > 0 && (
          <div className="stats-card">
            <div className="card-header-simple">
              <h3>Pattern Breakdown</h3>
            </div>
            <div className="tier-breakdown-list">
              {patternEntries.map(([pattern, d]) => (
                <div key={pattern} className="tier-breakdown-item">
                  <div className="tier-item-head">
                    <div className="tier-item-title">
                      <span className="tier-tag" style={{ background: '#f3f4f6', color: 'var(--ink)' }}>
                        {pattern.replace(/-/g, ' ')}
                      </span>
                      <span className="tier-item-solved">{d.correct}/{d.solved} solved</span>
                    </div>
                    <span className="tier-item-time">Avg {timeStr(d.avgTimeMs)}</span>
                  </div>
                  <div className="tier-progress-bar-bg">
                    <div className="tier-progress-bar-fill" style={{ width: `${d.accuracy || 0}%`, background: '#6366f1' }} />
                  </div>
                  <div className="tier-item-meta">
                    <span>Accuracy: <strong>{d.accuracy}%</strong></span>
                    <span>Consistency: <strong>{d.consistencyMs != null ? `±${timeStr(d.consistencyMs)}` : '-'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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