import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';

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
      <div className="session-summary">
        <h2>Simulation Complete</h2>
        <div className="summary-stats">
          <div className="stat"><div className="num">{summary.correct}/{summary.attempted}</div><div className="label">correct</div></div>
          <div className="stat"><div className="num">{acc}%</div><div className="label">accuracy</div></div>
          <div className="stat"><div className="num">{Math.round((summary.avgTimeMs || 0) / 1000)}s</div><div className="label">avg time</div></div>
          <div className="stat"><div className="num">{Math.round((TOTAL_TIME_MS - remainingMs) / 60000)}m</div><div className="label">time used</div></div>
        </div>
        {prevAcc != null && (
          <p className="summary-note">
            Last run: {prevRun.summary.correct}/{prevRun.summary.attempted} ({prevAcc}%)
            {' — '}{acc >= prevAcc ? 'improved or held steady' : 'lower than last time'}
          </p>
        )}
        <button className="btn primary" onClick={onExit}>Back</button>
      </div>
    );
  }

  const overTime = remainingMs < TOTAL_TIME_MS * 0.1;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');

  return (
    <div className="session-wrap">
      <div className="session-header">
        <div className="session-progress-label">Question {qIndex + 1} of {deck.length}</div>
        <div className="session-progress-bar">
          <div className="session-progress-fill" style={{ width: `${(qIndex / deck.length) * 100}%` }} />
        </div>
        <span className={`time${overTime ? ' over' : ''}`} style={{ fontFamily: 'var(--mono)' }}>{mins}:{secs}</span>
        <button className="btn-link" onClick={() => { clearInterval(clockRef.current); onExit(); }}>← Exit</button>
      </div>

      {puzzle && !loading ? (
        <Grid cols={puzzle.cols} cells={puzzle.cells} target={puzzle.target} pivotCells={[]} revealedLetter={null} answered={false} allLetters={puzzle.allLetters} />
      ) : (
        <div className="loading">Loading…</div>
      )}

      <AnswerPad onSelect={handleSelect} disabled={answered || loading || !puzzle} selected={selected} correctLetter={null} />

      <div className="controls">
        <button className="btn primary" onClick={next} disabled={!answered}>
          {qIndex + 1 >= deck.length ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
}