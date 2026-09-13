import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';

const TOTAL_QUESTIONS = 25;
const TOTAL_TIME_MS = 25 * 60 * 1000;

// Roughly mirrors the real test's distribution across difficulty tiers.
const DISTRIBUTION = [
  ...Array(10).fill('low'),
  ...Array(9).fill('medium'),
  ...Array(6).fill('high'),
];

function shuffleDeck(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ExamSimulation({ onExit }) {
  const [sessionId, setSessionId] = useState(null);
  const [deck] = useState(() => shuffleDeck(DISTRIBUTION).slice(0, TOTAL_QUESTIONS));
  const [qIndex, setQIndex] = useState(0);
  const [puzzle, setPuzzle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [remainingMs, setRemainingMs] = useState(TOTAL_TIME_MS);
  const [summary, setSummary] = useState(null);
  const [prevRun, setPrevRun] = useState(null);
  const [loading, setLoading] = useState(true);

  const clockStartRef = useRef(null);
  const clockRef = useRef(null);
  const qStartRef = useRef(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [sess] = await Promise.all([
        api.createSession('simulation', 'mixed', TOTAL_QUESTIONS),
        api.getSimulationHistory().then((h) => setPrevRun(h.simulations?.[0] || null)).catch(() => setPrevRun(null)),
      ]);
      setSessionId(sess.sessionId);
      clockStartRef.current = performance.now();
      clockRef.current = setInterval(tick, 250);
      await loadQuestion(0);
    })();
    return () => clearInterval(clockRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        if (summary) {
          onExit();
        } else if (answered) {
          e.preventDefault();
          next();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answered, summary, qIndex, sessionId, onExit]);

  function tick() {
    const remaining = TOTAL_TIME_MS - (performance.now() - clockStartRef.current);
    if (remaining <= 0) {
      setRemainingMs(0);
      finish();
    } else {
      setRemainingMs(remaining);
    }
  }

  async function loadQuestion(i) {
    if (i >= deck.length) { finish(); return; }
    setLoading(true);
    setAnswered(false);
    setSelected(null);
    try {
      const data = await api.generatePuzzle(deck[i]);
      setPuzzle(data);
      qStartRef.current = performance.now();
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(letter) {
    if (answered || !puzzle) return;
    setAnswered(true);
    setSelected(letter);
    const elapsedMs = Math.round(performance.now() - qStartRef.current);
    try {
      await api.submitAnswer(puzzle.puzzleId, letter, elapsedMs, false, sessionId);
    } catch { /* keep the run going even if grading briefly fails */ }
  }

  async function next() {
    const nextI = qIndex + 1;
    setQIndex(nextI);
    await loadQuestion(nextI);
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearInterval(clockRef.current);
    try {
      const data = await api.completeSession(sessionId);
      setSummary(data?.summary || { attempted: 0, correct: 0 });
    } catch {
      setSummary({ attempted: 0, correct: 0 });
    }
  }

  if (summary) {
    const acc = summary.attempted ? Math.round((100 * summary.correct) / summary.attempted) : 0;
    const prevAcc = prevRun && prevRun.summary.attempted
      ? Math.round((100 * prevRun.summary.correct) / prevRun.summary.attempted)
      : null;
    return (
      <div className="session-summary-card">
        <div className="summary-hero-icon">⏱️</div>
        <h2>Exam Simulation Complete</h2>
        <div className="summary-stats-grid">
          <div className="stat-card">
            <div className="stat-card-val">{summary.correct}/{summary.attempted}</div>
            <div className="stat-card-lbl">Correct Answers</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{acc}%</div>
            <div className="stat-card-lbl">Overall Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{Math.round((summary.avgTimeMs || 0) / 1000)}s</div>
            <div className="stat-card-lbl">Average Speed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{Math.round((TOTAL_TIME_MS - remainingMs) / 60000)}m</div>
            <div className="stat-card-lbl">Total Time Used</div>
          </div>
        </div>
        {prevAcc != null && (
          <p className="summary-note-text">
            Last run: {prevRun.summary.correct}/{prevRun.summary.attempted} ({prevAcc}%)
            {' — '}{acc >= prevAcc ? 'improved or held steady' : 'lower than last time'}
          </p>
        )}
        <button className="btn primary btn-lg" onClick={onExit}>
          <Icon.ArrowLeft /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isOvertime = remainingMs < TOTAL_TIME_MS * 0.1;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');

  return (
    <div className="session-container">
      <div className="session-nav-bar">
        <button className="btn-back-pill" onClick={() => { clearInterval(clockRef.current); onExit(); }}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>

        <div className="session-progress-meta">
          <span className="session-q-pill">Question {qIndex + 1} of {deck.length}</span>
          <span className="session-tier-tag tier-simulation">EXAM SIMULATION</span>
          <div className={`session-live-timer ${isOvertime ? 'is-overtime' : ''}`}>
            <Icon.Clock />
            <span>{mins}:{secs}</span>
          </div>
        </div>
      </div>

      <div className="session-progress-track">
        <div className="session-progress-fill" style={{ width: `${((qIndex + 1) / deck.length) * 100}%` }} />
      </div>

      <div className="session-main-card">
        {puzzle && !loading ? (
          <Grid cols={puzzle.cols} cells={puzzle.cells} target={puzzle.target} pivotCells={[]} revealedLetter={null} answered={false} allLetters={puzzle.allLetters} />
        ) : (
          <div className="session-loading-state">
            <div className="spinner" />
            <span>Loading exam question...</span>
          </div>
        )}

        <AnswerPad onSelect={handleSelect} disabled={answered || loading || !puzzle} selected={selected} correctLetter={null} />

        <div className="session-footer-actions">
          <button className="btn primary btn-next-q" onClick={next} disabled={!answered}>
            {qIndex + 1 >= deck.length ? 'Finish Exam ★' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
}