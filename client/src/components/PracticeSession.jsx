import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useSession } from '../SessionContext';
import { timeStr } from '../lib/format';
import Grid from './Grid';
import AnswerPad from './AnswerPad';

const TIERS = ['low', 'medium', 'high'];
const TIER_TARGET_MS = { low: 20000, medium: 50000, high: 75000 };

export default function PracticeSession({ config, onExit }) {
  const { startSession, recordAttempt, endSession } = useSession();
  const [sessionId, setSessionId] = useState(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [pivotCells, setPivotCells] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState(null);
  const startRef = useRef(null);
  const tickRef = useRef(null);
  const answeredRef = useRef(false);

  const { mode, difficulty, questionCount } = config;
  const isExam = mode === 'exam';

  useEffect(() => {
    (async () => {
      const sess = await startSession(mode, difficulty, questionCount);
      setSessionId(sess.sessionId);
      await loadNextPuzzle(sess.sessionId, 0);
    })();
    return () => clearInterval(tickRef.current);
  }, []);

  async function loadNextPuzzle(sid, qNum) {
    if (qNum >= questionCount) {
      await finishSession(sid);
      return;
    }
    setLoading(true);
    setAnswered(false);
    answeredRef.current = false;
    setCorrectLetter(null);
    setSelected(null);
    setHintUsed(false);
    setPivotCells([]);
    setFeedback('');
    clearInterval(tickRef.current);
    try {
      const data = await api.generatePuzzle(difficulty === 'mixed' ? TIERS[qNum % 3] : difficulty);
      setPuzzle(data);
      startRef.current = performance.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        if (answeredRef.current) { clearInterval(tickRef.current); return; }
        setElapsed(performance.now() - startRef.current);
      }, 100);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(letter) {
    if (answered || !puzzle) return;
    clearInterval(tickRef.current);
    answeredRef.current = true;
    const elapsedMs = Math.round(performance.now() - startRef.current);
    setSelected(letter);

    const res = await api.submitAnswer(puzzle.puzzleId, letter, elapsedMs, hintUsed, sessionId);
    setCorrectLetter(res.correctLetter);
    setAnswered(true);
    recordAttempt({ correct: res.correct, hintUsed, elapsedMs, solveQuality: res.solveQuality });

    // NEW: automatically surface the deduction chain on a wrong or
    // slow answer, even in practice mode without a hint request —
    // this is the actual teaching moment, not just "here's the letter."
    if (!isExam && !res.correct) {
      setPivotCells(res.pivotCells || []);
    }

    if (!isExam) {
      const target = TIER_TARGET_MS[puzzle.difficulty] / 1000;
      const timeSec = (elapsedMs / 1000).toFixed(1);
      if (res.correct) {
        const overUnder = elapsedMs <= TIER_TARGET_MS[puzzle.difficulty]
          ? `${timeSec}s (target ${target}s)`
          : `${timeSec}s (${((elapsedMs - TIER_TARGET_MS[puzzle.difficulty]) / 1000).toFixed(1)}s over target)`;
        setFeedback('Correct — ' + overUnder);
      } else {
        setFeedback(`Wrong — answer was ${res.correctLetter}. Highlighted cell shows how to find it.`);
      }
    }
  }

  async function handleHint() {
    if (answered || !puzzle || isExam) return;
    const { pivotCells: cells, direct } = await api.getHint(puzzle.puzzleId);
    setPivotCells(cells);
    setHintUsed(true);
    setFeedback(direct ? "Direct read: combine the target's row and column." : 'Solve the highlighted cell first.');
  }

  async function next() {
    const nextQ = questionNum + 1;
    setQuestionNum(nextQ);
    await loadNextPuzzle(sessionId, nextQ);
  }

  async function finishSession(sid) {
    const data = await endSession(sid || sessionId);
    setSummary(data?.summary || null);
  }

  if (summary) {
    const acc = summary.attempted ? Math.round((100 * summary.correct) / summary.attempted) : 0;
    return (
      <div className="session-summary">
        <h2>Session Complete</h2>
        <div className="summary-stats">
          <div className="stat"><div className="num">{summary.correct}/{summary.attempted}</div><div className="label">correct</div></div>
          <div className="stat"><div className="num">{acc}%</div><div className="label">accuracy</div></div>
          <div className="stat"><div className="num">{timeStr(summary.avgTimeMs)}</div><div className="label">avg time</div></div>
          <div className="stat"><div className="num">{summary.streak}</div><div className="label">best run this session</div></div>
        </div>
        {summary.hinted > 0 && <p className="summary-note">{summary.hinted} hint{summary.hinted > 1 ? 's' : ''} used</p>}
        <button className="btn primary" onClick={onExit}>Back to practice</button>
      </div>
    );
  }

  return (
    <div className="session-wrap">
      <div className="session-header">
        <div className="session-progress-label">
          Question {questionNum + 1} of {questionCount}
        </div>
        <div className="session-progress-bar">
          <div className="session-progress-fill" style={{ width: `${(questionNum / questionCount) * 100}%` }} />
        </div>
        <button className="btn-link" onClick={onExit}>← Exit</button>
      </div>

      {puzzle && !loading ? (
        <Grid
          cols={puzzle.cols}
          cells={puzzle.cells}
          target={puzzle.target}
          pivotCells={pivotCells}
          revealedLetter={correctLetter}
          answered={answered}
          allLetters={puzzle.allLetters}
        />
      ) : (
        <div className="loading">Loading…</div>
      )}

      <AnswerPad onSelect={handleSelect} disabled={answered || loading || !puzzle} selected={selected} correctLetter={correctLetter} />

      {!isExam && <div className="feedback">{feedback || '\u00a0'}</div>}

      <div className="controls">
        {!isExam && (
          <button className="btn" onClick={handleHint} disabled={answered || !puzzle || loading}>Hint</button>
        )}
        {answered ? (
          <button className="btn primary" onClick={next}>
            {questionNum + 1 >= questionCount ? 'Finish' : 'Next →'}
          </button>
        ) : (
          <span className={`time${elapsed / 1000 > (TIER_TARGET_MS[puzzle?.difficulty || 'low'] / 1000) ? ' over' : ''}`}>
            {(elapsed / 1000).toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}