import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';
import { TIERS, TIER_LABEL } from '../lib/constants';

const DURATIONS = [
  { label: '1 min', ms: 60000 },
  { label: '3 min', ms: 180000 },
  { label: '5 min', ms: 300000 },
];
const ADVANCE_DELAY_MS = 450;

// Pure automaticity training: no hints, no review, no "Next" click — puzzles
// chain automatically the instant you answer, for a fixed window of time.
// Distinct from Session mode (paced, click-through) and Exam mode (fixed
// question count, full simulation).
export default function RapidFire({ onExit }) {
  const [difficulty, setDifficulty] = useState('low');
  const [durationMs, setDurationMs] = useState(DURATIONS[1].ms);
  const [started, setStarted] = useState(false);

  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [summary, setSummary] = useState(null);

  const attempted = useRef(0);
  const correctCount = useRef(0);
  const times = useRef([]);
  const streak = useRef(0);
  const bestStreak = useRef(0);

  const clockStartRef = useRef(null);
  const clockRef = useRef(null);
  const qStartRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => () => clearInterval(clockRef.current), []);

  async function begin() {
    attempted.current = 0;
    correctCount.current = 0;
    times.current = [];
    streak.current = 0;
    bestStreak.current = 0;
    finishedRef.current = false;
    setSummary(null);
    setStarted(true);
    clockStartRef.current = performance.now();
    setRemainingMs(durationMs);
    clockRef.current = setInterval(tick, 250);
    await loadNext();
  }

  function tick() {
    const remaining = durationMs - (performance.now() - clockStartRef.current);
    if (remaining <= 0) {
      setRemainingMs(0);
      finish();
    } else {
      setRemainingMs(remaining);
    }
  }

  async function loadNext() {
    if (finishedRef.current) return;
    setLoading(true);
    setSelected(null);
    setCorrectLetter(null);
    try {
      const data = await api.generatePuzzle(difficulty);
      if (finishedRef.current) return;
      setPuzzle(data);
      qStartRef.current = performance.now();
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(letter) {
    if (!puzzle || correctLetter !== null || finishedRef.current) return;
    setSelected(letter);
    const elapsedMs = Math.round(performance.now() - qStartRef.current);
    try {
      const res = await api.submitAnswer(puzzle.puzzleId, letter, elapsedMs, false, null);
      setCorrectLetter(res.correctLetter);
      attempted.current += 1;
      times.current.push(elapsedMs);
      if (res.correct) {
        correctCount.current += 1;
        streak.current += 1;
        bestStreak.current = Math.max(bestStreak.current, streak.current);
      } else {
        streak.current = 0;
      }
    } catch { /* skip a failed grade and keep the drill moving */ }

    setTimeout(() => {
      if (!finishedRef.current) loadNext();
    }, ADVANCE_DELAY_MS);
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(clockRef.current);
    const avgTimeMs = times.current.length
      ? Math.round(times.current.reduce((s, t) => s + t, 0) / times.current.length)
      : null;
    setSummary({
      attempted: attempted.current,
      correct: correctCount.current,
      avgTimeMs,
      bestStreak: bestStreak.current,
    });
  }

  if (!started || summary) {
    return (
      <div className="wrap review-page-container">
        <div className="review-top-bar">
          <button className="review-nav-btn review-dashboard-btn" onClick={onExit}>
            <Icon.ArrowLeft />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {summary ? (
          <div className="session-summary-card">
            <div className="summary-hero-icon">⚡</div>
            <h2>Rapid-Fire Drill Complete</h2>
            <div className="summary-stats-grid">
              <div className="stat-card">
                <div className="stat-card-val">{summary.correct}/{summary.attempted}</div>
                <div className="stat-card-lbl">Correct Answers</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-val">{summary.attempted ? Math.round((100 * summary.correct) / summary.attempted) : 0}%</div>
                <div className="stat-card-lbl">Accuracy</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-val">{summary.avgTimeMs ? (summary.avgTimeMs / 1000).toFixed(1) : '-'}s</div>
                <div className="stat-card-lbl">Average Speed</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-val">{summary.bestStreak}</div>
                <div className="stat-card-lbl">Best Streak</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn primary btn-lg" onClick={begin}>Run it again</button>
              <button className="btn btn-lg" onClick={onExit}>Back to Dashboard</button>
            </div>
          </div>
        ) : (
          <div className="review-hero-card">
            <h1 className="review-hero-title">Rapid-Fire Drill</h1>
            <p className="review-hero-sub">
              No hints, no review, no clicking "Next" — puzzles chain automatically
              the moment you answer. Pure automaticity training for a fixed window.
            </p>

            <div className="session-option-group" style={{ marginTop: 16 }}>
              <div className="session-option-label">Difficulty</div>
              <div className="session-option-row">
                {TIERS.map((d) => (
                  <button key={d} className={`session-option-btn${difficulty === d ? ' active' : ''}`} onClick={() => setDifficulty(d)}>
                    {TIER_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="session-option-group">
              <div className="session-option-label">Duration</div>
              <div className="session-option-row">
                {DURATIONS.map((d) => (
                  <button key={d.ms} className={`session-option-btn${durationMs === d.ms ? ' active' : ''}`} onClick={() => setDurationMs(d.ms)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn primary btn-lg" style={{ marginTop: 16 }} onClick={begin}>
              Start Drill
            </button>
          </div>
        )}
      </div>
    );
  }

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');
  const isOvertime = remainingMs < durationMs * 0.15;

  return (
    <div className="session-container">
      <div className="session-nav-bar">
        <button className="btn-back-pill" onClick={() => { clearInterval(clockRef.current); onExit(); }}>
          <Icon.ArrowLeft />
          <span>End Drill</span>
        </button>
        <div className="session-progress-meta">
          <span className="session-q-pill">{attempted.current} answered</span>
          <span className={`session-tier-tag tier-${difficulty}`}>{TIER_LABEL[difficulty].toUpperCase()}</span>
          <div className={`session-live-timer ${isOvertime ? 'is-overtime' : ''}`}>
            <Icon.Clock />
            <span>{mins}:{secs}</span>
          </div>
        </div>
      </div>

      <div className="session-main-card">
        <Grid
          cols={puzzle?.cols}
          cells={puzzle?.cells}
          target={puzzle?.target}
          pivotCells={[]}
          revealedLetter={correctLetter}
          answered={correctLetter !== null}
          allLetters={puzzle?.allLetters}
        />

        <AnswerPad
          onSelect={handleSelect}
          disabled={loading || !puzzle || correctLetter !== null}
          selected={selected}
          correctLetter={correctLetter}
        />
      </div>
    </div>
  );
}