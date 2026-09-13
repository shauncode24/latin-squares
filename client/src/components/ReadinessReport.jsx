import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr } from '../lib/format';
import { TIERS, TIER_LABEL } from '../lib/constants';

const VERDICT_LABEL = {
  ready: 'Ready',
  building: 'Building',
  'not-ready': 'Not Ready',
};
const VERDICT_CLASS = {
  ready: 'mastery-exam-ready',
  building: 'mastery-fast',
  'not-ready': 'mastery-learning',
};

export default function ReadinessReport() {
  const [data, setData] = useState(undefined); // undefined = loading

  useEffect(() => {
    api.getReadiness().then(setData).catch(() => setData(null));
  }, []);

  if (data === undefined) return null;
  if (!data || data.insufficientData) {
    return (
      <div className="stats-card" style={{ marginBottom: 20 }}>
        <div className="card-header-simple"><h3>Readiness</h3></div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Keep practicing — readiness assessment needs at least 10 logged attempts
          {data?.solved != null ? ` (currently ${data.solved})` : ''}.
        </p>
      </div>
    );
  }

  const { axes, verdict, summary } = data;

  return (
    <div className="stats-card" style={{ marginBottom: 20 }}>
      <div className="card-header-simple"><h3>DMAT Readiness</h3></div>

      <p style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 0, marginBottom: 18 }}>{summary}</p>

      <div className="dashboard-mastery-row" style={{ marginBottom: 18 }}>
        {TIERS.map((t) => (
          <div key={t} className={`mastery-chip ${VERDICT_CLASS[verdict[t]]}`}>
            <span className="mastery-tier">{TIER_LABEL[t]}</span>
            <span className="mastery-state">{VERDICT_LABEL[verdict[t]]}</span>
          </div>
        ))}
      </div>

      <div className="tier-breakdown-list">
        {TIERS.map((t) => {
          const cov = axes.patternCoverage[t];
          const missing = axes.missingPatterns[t] || [];
          const d = axes.byTier[t];
          return (
            <div key={t} className="tier-breakdown-item">
              <div className="tier-item-head">
                <div className="tier-item-title">
                  <span className={`tier-tag tier-${t}`}>{TIER_LABEL[t]}</span>
                  <span className="tier-item-solved">
                    Pattern coverage: {cov.covered}/{cov.total}
                  </span>
                </div>
                {d && d.solved > 0 && <span className="tier-item-time">Consistency ±{timeStr(axes.consistency[t])}</span>}
              </div>
              {missing.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                  Not yet covered: {missing.join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {axes.examPerformance && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-soft)' }}>
          Last {axes.examPerformance.runsCompleted} exam simulation{axes.examPerformance.runsCompleted > 1 ? 's' : ''}:
          {' '}latest accuracy <strong style={{ color: 'var(--ink)' }}>{axes.examPerformance.latestAccuracy}%</strong>,
          {' '}trend <strong style={{ color: 'var(--ink)' }}>{axes.examPerformance.trend}</strong>.
        </div>
      )}
    </div>
  );
}