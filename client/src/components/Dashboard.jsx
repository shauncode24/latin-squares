import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr } from '../lib/format';
import { TIERS, TIER_LABEL } from '../lib/constants';
import DueReviews from './DueReviews';
import ReadinessReport from './ReadinessReport'; // NEW

function Arrow({ delta, invert = false }) {
  if (delta == null || delta === 0) return <span className="trend-flat">–</span>;
  const good = invert ? delta < 0 : delta > 0;
  return <span className={good ? 'trend-up' : 'trend-down'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>;
}

const MASTERY_LABEL = {
  learning: 'Learning',
  competent: 'Competent',
  fast: 'Fast',
  'exam-ready': 'Exam Ready',
};

function nextFocus(mastery) {
  if (!mastery) return null;
  for (const t of TIERS) {
    if (mastery[t] && mastery[t] !== 'exam-ready') {
      return { tier: t, state: mastery[t] };
    }
  }
  return null;
}

export default function Dashboard({ stats, onPracticeWeakness }) {
  const [trend, setTrend] = useState(null);
  const [weakest, setWeakest] = useState(undefined);

  const [aiDiagnosis, setAiDiagnosis] = useState(null);
  const [aiDiagnosisLoading, setAiDiagnosisLoading] = useState(false);
  const [aiStrategy, setAiStrategy] = useState(null);
  const [aiStrategyLoading, setAiStrategyLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    api.getTrend().then((d) => setTrend(d.trend)).catch(() => setTrend(null));
    api.getWeakest().then((d) => setWeakest(d.weakest)).catch(() => setWeakest(null));
  }, []);

  async function requestAiDiagnosis() {
    if (!stats?.diagnosis?.length) return;
    setAiDiagnosisLoading(true);
    setAiError('');
    try {
      const res = await api.getAiDiagnosis(stats.diagnosis);
      setAiDiagnosis(res.narration);
    } catch {
      setAiError('AI coaching is temporarily unavailable.');
    } finally {
      setAiDiagnosisLoading(false);
    }
  }

  async function requestAiStrategy() {
    setAiStrategyLoading(true);
    setAiError('');
    try {
      const res = await api.getAiStrategy();
      setAiStrategy(res.insufficientData ? 'Not enough recent attempts yet — keep practicing and check back.' : res.narration);
    } catch {
      setAiError('AI coaching is temporarily unavailable.');
    } finally {
      setAiStrategyLoading(false);
    }
  }

  if (!stats || !stats.overall || stats.overall.solved === 0) return null;

  const mastery = stats.mastery || {};
  const focus = nextFocus(mastery);
  const diagnosis = stats.diagnosis || [];

  return (
    <div className="dashboard">
      <ReadinessReport />

      <DueReviews />

      {weakest && (
        <div className="dashboard-next">
          <div className="dashboard-next-label">Do this next</div>
          <div className="dashboard-next-row">
            <span>
              {weakest.reason === 'speed' ? 'Slowest pattern' : 'Weakest pattern'}: <strong>{TIER_LABEL[weakest.difficulty] || weakest.difficulty}</strong>
              {' '}/ {weakest.patternTag} —{' '}
              {weakest.reason === 'speed'
                ? `${weakest.accuracy}% accurate but averaging ${Math.round((weakest.avgTimeMs || 0) / 1000)}s vs a ${Math.round((weakest.targetMs || 0) / 1000)}s target`
                : `${weakest.accuracy}% accuracy over ${weakest.sampleSize} attempts`}
            </span>
            <button
              className="btn primary"
              style={{ width: 'auto', flexShrink: 0 }}
              onClick={() => onPracticeWeakness && onPracticeWeakness(weakest)}
            >
              Practice this →
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-mastery-row">
        {TIERS.map((t) => {
          const state = mastery[t] || 'learning';
          return (
            <div key={t} className={`mastery-chip mastery-${state}`}>
              <span className="mastery-tier">{TIER_LABEL[t]}</span>
              <span className="mastery-state">{MASTERY_LABEL[state]}</span>
            </div>
          );
        })}
      </div>

      {focus && (
        <div className="dashboard-next">
          <div className="dashboard-next-label">Suggested focus</div>
          <div className="dashboard-next-row">
            <span>
              {focus.state === 'learning' &&
                `You're still building consistency at ${TIER_LABEL[focus.tier]}. Stay here until accuracy and speed both clear target.`}
              {focus.state === 'competent' &&
                `Your accuracy at ${TIER_LABEL[focus.tier]} is solid — now work on speed to hit the time target.`}
              {focus.state === 'fast' &&
                `${TIER_LABEL[focus.tier]} is nearly there — a few more clean, fast solves and you'll be exam-ready.`}
            </span>
          </div>
        </div>
      )}

      {diagnosis.length > 0 && (
        <div className="dashboard-next">
          <div className="dashboard-next-label">Why you're missing these</div>
          {diagnosis.map((d, i) => (
            <div key={i} className="dashboard-next-row" style={{ marginBottom: i < diagnosis.length - 1 ? 6 : 0 }}>
              <span>{d.message}</span>
            </div>
          ))}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            {!aiDiagnosis && (
              <button className="btn-link" onClick={requestAiDiagnosis} disabled={aiDiagnosisLoading}>
                {aiDiagnosisLoading ? 'Coaching…' : '✨ Get AI coaching on this'}
              </button>
            )}
            {aiDiagnosis && (
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, whiteSpace: 'pre-line' }}>{aiDiagnosis}</p>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-next">
        <div className="dashboard-next-label">Strategy check</div>
        {!aiStrategy && (
          <button className="btn-link" onClick={requestAiStrategy} disabled={aiStrategyLoading}>
            {aiStrategyLoading ? 'Analyzing your recent attempts…' : '✨ Analyze my solving approach'}
          </button>
        )}
        {aiStrategy && (
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, whiteSpace: 'pre-line' }}>{aiStrategy}</p>
        )}
      </div>

      {aiError && <div className="error">{aiError}</div>}

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