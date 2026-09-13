import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr } from '../lib/format';
import DueReviews from './DueReviews';

function Arrow({ delta, invert = false }) {
  if (delta == null || delta === 0) return <span className="trend-flat">–</span>;
  const good = invert ? delta < 0 : delta > 0;
  return <span className={good ? 'trend-up' : 'trend-down'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>;
}

export default function Dashboard({ stats }) {
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    api.getTrend().then((d) => setTrend(d.trend)).catch(() => setTrend(null));
  }, []);

  if (!stats || !stats.overall || stats.overall.solved === 0) return null;

  return (
    <div className="dashboard">
      <DueReviews />

      {trend && (trend.current.solved > 0 || trend.previous.solved > 0) && (
        <div className="dashboard-trend-row">
          <div className="trend-item">
            <span className="trend-label">Solved this day</span>
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