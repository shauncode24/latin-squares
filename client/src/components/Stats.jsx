export default function Stats({ stats }) {
  const overall = stats?.overall;
  return (
    <div className="stats">
      <div className="stat">
        <div className="num">{overall?.solved ?? 0}</div>
        <div className="label">solved</div>
      </div>
      <div className="stat">
        <div className="num">{overall?.accuracy != null ? `${overall.accuracy}%` : '\u2014'}</div>
        <div className="label">accuracy</div>
      </div>
      <div className="stat">
        <div className="num">
          {overall?.avgTimeMs != null ? `${(overall.avgTimeMs / 1000).toFixed(1)}s` : '\u2014'}
        </div>
        <div className="label">avg time</div>
      </div>
    </div>
  );
}
