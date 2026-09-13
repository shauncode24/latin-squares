import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useSession } from '../SessionContext';
import { timeStr } from '../lib/format';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';

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
  }, [answered, summary, questionNum, sessionId, onExit]);

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
      <div className="session-summary-card">
        <div className="summary-hero-icon">🏆</div>
        <h2>Practice Session Complete</h2>
        <div className="summary-stats-grid">
          <div className="stat-card">
            <div className="stat-card-val">{summary.correct}/{summary.attempted}</div>
            <div className="stat-card-lbl">Correct Answers</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{acc}%</div>
            <div className="stat-card-lbl">Accuracy Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{timeStr(summary.avgTimeMs)}</div>
            <div className="stat-card-lbl">Average Speed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{summary.streak}</div>
            <div className="stat-card-lbl">Best Run Streak</div>
          </div>
        </div>
        {summary.hinted > 0 && <p className="summary-note-text">💡 {summary.hinted} hint{summary.hinted > 1 ? 's' : ''} requested during this drill</p>}
        <button className="btn primary btn-lg" onClick={onExit}>
          <Icon.ArrowLeft /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isOvertime = elapsed / 1000 > (TIER_TARGET_MS[puzzle?.difficulty || 'low'] / 1000);

  return (
    <div className="session-container">
      {/* Header bar with Back button & session stats */}
      <div className="session-nav-bar">
        <button className="btn-back-pill" onClick={onExit}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>

        <div className="session-progress-meta">
          <span className="session-q-pill">Question {questionNum + 1} of {questionCount}</span>
          {puzzle && (
            <span className={`session-tier-tag tier-${puzzle.difficulty}`}>
              {puzzle.difficulty.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="session-progress-track">
        <div
          className="session-progress-fill"
          style={{ width: `${((questionNum + 1) / questionCount) * 100}%` }}
        />
      </div>

      {/* Practice Question Card */}
      <div className="session-main-card">
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
          <div className="session-loading-state">
            <div className="spinner" />
            <span>Loading deduction grid...</span>
          </div>
        )}

        <AnswerPad
          onSelect={handleSelect}
          disabled={answered || loading || !puzzle}
          selected={selected}
          correctLetter={correctLetter}
        />

        {!isExam && (
          <div className={`session-feedback-box ${feedback.startsWith('Correct') ? 'is-correct' : feedback ? 'is-wrong' : ''}`}>
            {feedback || '\u00a0'}
          </div>
        )}

        <div className="session-footer-actions">
          {!isExam && (
            <button className="btn btn-hint" onClick={handleHint} disabled={answered || !puzzle || loading}>
              <Icon.Bulb /> Hint
            </button>
          )}

          {answered ? (
            <button className="btn primary btn-next-q" onClick={next}>
              {questionNum + 1 >= questionCount ? 'Finish Session ★' : 'Next Question →'}
            </button>
          ) : (
            <div className={`session-live-timer ${isOvertime ? 'is-overtime' : ''}`}>
              <Icon.Clock />
              <span>{(elapsed / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}