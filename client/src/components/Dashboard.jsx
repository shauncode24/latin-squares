import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr } from '../lib/format';
import DueReviews from './DueReviews';

const MASTERY_LABEL = {
  learning: 'Learning',
  competent: 'Competent',
  fast: 'Fast',
  'exam-ready': 'Exam-Ready',
};
const TIER_LABEL = { low: 'Low', medium: 'Med', high: 'High' };
const TIERS = ['low', 'medium', 'high'];

function Arrow({ delta, invert = false }) {
  if (delta == null || delta === 0) return <span className="trend-flat">–</span>;
  const good = invert ? delta < 0 : delta > 0;
  return <span className={good ? 'trend-up' : 'trend-down'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>;
}

export default function Dashboard({ stats, onPracticeWeakness }) {
  const [trend, setTrend] = useState(null);
  const [weakest, setWeakest] = useState(undefined);

  useEffect(() => {
    api.getTrend().then((d) => setTrend(d.trend)).catch(() => setTrend(null));
    api.getWeakest().then((d) => setWeakest(d.weakest)).catch(() => setWeakest(null));
  }, []);

  if (!stats || !stats.overall || stats.overall.solved === 0) return null;

  const mastery = stats.mastery || {};

  let nextAction = null;
  if (weakest) {
    nextAction = {
      text: `Practice ${weakest.difficulty} / ${weakest.patternTag.replace(/-/g, ' ')} — ${weakest.accuracy}% over your last ${weakest.sampleSize}`,
      onClick: () => onPracticeWeakness(weakest),
    };
  } else {
    const lowestTier = TIERS.find((t) => mastery[t] === 'learning' || mastery[t] === 'competent');
    if (lowestTier) {
      nextAction = {
        text: `Keep practicing ${TIER_LABEL[lowestTier]} — you're ${MASTERY_LABEL[mastery[lowestTier]].toLowerCase()} on this tier`,
        onClick: null,
      };
    }
  }

  return (
    <div className="dashboard">
      <DueReviews />

      {nextAction && (
        <div className="dashboard-next">
          <div className="dashboard-next-label">Do this next</div>
          <div className="dashboard-next-row">
            <span>{nextAction.text}</span>
            {nextAction.onClick && <button className="btn-link" onClick={nextAction.onClick}>Go →</button>}
          </div>
        </div>
      )}

      <div className="dashboard-mastery-row">
        {TIERS.map((t) => (
          <div key={t} className={`mastery-chip mastery-${mastery[t] || 'learning'}`}>
            <span className="mastery-tier">{TIER_LABEL[t]}</span>
            <span className="mastery-state">{MASTERY_LABEL[mastery[t] || 'learning']}</span>
          </div>
        ))}
      </div>

      {trend && (trend.current.solved > 0 || trend.previous.solved > 0) && (
        <div className="dashboard-trend-row">
          <div className="trend-item">
            <span className="trend-label">Solved this week</span>
            <span className="trend-value">{trend.current.solved} <Arrow delta={trend.solvedDelta} /></span>
          </div>
          <div className="trend-item">
            <span className="trend-label">Accuracy</span>
            <span className="trend-value">{trend.current.accuracy != null ? trend.current.accuracy + '%' : '-'} <Arrow delta={trend.accuracyDelta} /></span>
          </div>
          <div className="trend-item">
            <span className="trend-label">Avg time</span>
            <span className="trend-value">
              {timeStr(trend.current.avgTimeMs)}{' '}
              <Arrow delta={trend.avgTimeDeltaMs != null ? Math.round(trend.avgTimeDeltaMs / 1000) : null} invert />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}