import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';

const TOTAL_QUESTIONS = 25;
const TOTAL_TIME_MS = 25 * 60 * 1000;

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
  const [order] = useState(() => shuffleDeck(DISTRIBUTION).slice(0, TOTAL_QUESTIONS));
  const [status, setStatus] = useState(() => new Array(TOTAL_QUESTIONS).fill('unseen'));
  const [queue, setQueue] = useState(() => order.map((_, i) => i));
  const [puzzle, setPuzzle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [remainingMs, setRemainingMs] = useState(TOTAL_TIME_MS);
  const [summary, setSummary] = useState(null);
  const [prevRun, setPrevRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReviewGate, setShowReviewGate] = useState(false); // NEW

  const clockStartRef = useRef(null);
  const clockRef = useRef(null);
  const qStartRef = useRef(null);
  const finishingRef = useRef(false);
  // NEW: cache the actual generated puzzle per slot index, so revisiting a
  // skipped/flagged slot shows the SAME question instead of a fresh one —
  // matching how a real exam's "flag and return" behaves.
  const puzzleCacheRef = useRef({});

  const currentSlot = queue[0];
  const answeredCount = status.filter((s) => s === 'answered').length;
  const flaggedCount = status.filter((s) => s === 'flagged').length;
  const unseenRemaining = status.filter((s) => s === 'unseen').length;

  useEffect(() => {
    (async () => {
      const [sess] = await Promise.all([
        api.createSession('simulation', 'mixed', TOTAL_QUESTIONS),
        api.getSimulationHistory().then((h) => setPrevRun(h.simulations?.[0] || null)).catch(() => setPrevRun(null)),
      ]);
      setSessionId(sess.sessionId);
      clockStartRef.current = performance.now();
      clockRef.current = setInterval(tick, 250);
      await loadSlot(queue[0]);
    })();
    return () => clearInterval(clockRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        if (summary) {
          onExit();
        } else if (answered && !showReviewGate) {
          e.preventDefault();
          advance();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, summary, queue, sessionId, onExit, showReviewGate]);

  function tick() {
    const remaining = TOTAL_TIME_MS - (performance.now() - clockStartRef.current);
    if (remaining <= 0) {
      setRemainingMs(0);
      finish();
    } else {
      setRemainingMs(remaining);
    }
  }

  // UPDATED: loadSlot now takes a *slot index* (not just a tier), and checks
  // the cache before generating a new puzzle.
  async function loadSlot(slotIndex) {
    setLoading(true);
    setAnswered(false);
    setSelected(null);
    try {
      const cached = puzzleCacheRef.current[slotIndex];
      if (cached) {
        setPuzzle(cached);
        qStartRef.current = performance.now();
        return;
      }
      const data = await api.generatePuzzle(order[slotIndex]);
      puzzleCacheRef.current[slotIndex] = data;
      setPuzzle(data);
      qStartRef.current = performance.now();
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(letter) {
    if (answered || !puzzle || currentSlot == null) return;
    setAnswered(true);
    setSelected(letter);
    const elapsedMs = Math.round(performance.now() - qStartRef.current);
    try {
      await api.submitAnswer(puzzle.puzzleId, letter, elapsedMs, false, sessionId);
    } catch { /* keep the run going even if grading briefly fails */ }
    setStatus((prev) => {
      const next = prev.slice();
      next[currentSlot] = 'answered';
      return next;
    });
    // Answered slot's cached puzzle can be dropped — it's graded now and
    // won't be revisited.
    delete puzzleCacheRef.current[currentSlot];
  }

  // Real-exam triage: leave this question, come back to it later — now
  // actually returns to the SAME puzzle via the cache, not a fresh one.
  async function skipCurrent() {
    if (currentSlot == null || answered || queue.length <= 1) return;
    const slotToRequeue = currentSlot;
    // Cache the puzzle currently on screen before moving away from it.
    if (puzzle) puzzleCacheRef.current[slotToRequeue] = puzzle;
    const nextQueue = [...queue.slice(1), slotToRequeue];
    setStatus((prev) => {
      const next = prev.slice();
      if (next[slotToRequeue] === 'unseen') next[slotToRequeue] = 'flagged';
      return next;
    });
    setQueue(nextQueue);
    await loadSlot(nextQueue[0]);
  }

  async function advance() {
    const restOfQueue = queue.slice(1);
    setQueue(restOfQueue);
    if (restOfQueue.length === 0) {
      // NEW: if flagged/unanswered items remain, gate on a review screen
      // instead of silently finishing — mirrors a real exam's "review
      // before submit" step.
      if (flaggedCount > 0 || unseenRemaining > 0) {
        setShowReviewGate(true);
        return;
      }
      finish();
      return;
    }
    await loadSlot(restOfQueue[0]);
  }

  // NEW: jump back into a specific flagged/unanswered slot from the review gate.
  async function resumeSlot(slotIndex) {
    setShowReviewGate(false);
    const rest = queue.filter((s) => s !== slotIndex);
    setQueue([slotIndex, ...rest]);
    await loadSlot(slotIndex);
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearInterval(clockRef.current);
    setShowReviewGate(false);
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

    const fh = summary.firstHalf;
    const sh = summary.secondHalf;
    const hasPacing = fh && sh && (fh.accuracy != null || sh.accuracy != null);
    const fatigueDrop = hasPacing && fh.accuracy != null && sh.accuracy != null && sh.accuracy < fh.accuracy - 10;

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

        {hasPacing && (
          <p className="summary-note-text">
            First half: {fh.accuracy ?? '-'}% accuracy, {fh.avgTimeMs ? Math.round(fh.avgTimeMs / 1000) + 's' : '-'} avg
            {' · '}
            Second half: {sh.accuracy ?? '-'}% accuracy, {sh.avgTimeMs ? Math.round(sh.avgTimeMs / 1000) + 's' : '-'} avg
            {fatigueDrop && <><br />Accuracy dropped notably in the back half — a sign of fatigue or time pressure late in the run.</>}
          </p>
        )}

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

  // NEW: pre-submit review gate
  if (showReviewGate) {
    const pendingSlots = status
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s === 'flagged' || s === 'unseen');

    return (
      <div className="session-container">
        <div className="session-summary-card" style={{ maxWidth: 640 }}>
          <h2>Review Before Submitting</h2>
          <p className="summary-note-text">
            You have {pendingSlots.length} question{pendingSlots.length > 1 ? 's' : ''} not yet
            answered ({flaggedCount} flagged, {unseenRemaining} unseen). Revisit them now, or submit as-is.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '16px 0' }}>
            {pendingSlots.map(({ i }) => (
              <button
                key={i}
                className="session-option-btn"
                style={{ width: 'auto', padding: '8px 14px' }}
                onClick={() => resumeSlot(i)}
              >
                {status[i] === 'flagged' ? '🚩 ' : ''}Q{i + 1} ({order[i]})
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn primary btn-lg" onClick={finish}>Submit Anyway</button>
          </div>
        </div>
      </div>
    );
  }

  const isOvertime = remainingMs < TOTAL_TIME_MS * 0.1;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');
  const isLast = queue.length <= 1;

  return (
    <div className="session-container">
      <div className="session-nav-bar">
        <button className="btn-back-pill" onClick={() => { clearInterval(clockRef.current); onExit(); }}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>

        <div className="session-progress-meta">
          <span className="session-q-pill">{answeredCount} of {TOTAL_QUESTIONS} answered</span>
          {flaggedCount > 0 && (
            <span className="session-q-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
              🚩 {flaggedCount} flagged
            </span>
          )}
          <span className="session-tier-tag tier-simulation">EXAM SIMULATION</span>
          <div className={`session-live-timer ${isOvertime ? 'is-overtime' : ''}`}>
            <Icon.Clock />
            <span>{mins}:{secs}</span>
          </div>
        </div>
      </div>

      <div className="session-progress-track">
        <div className="session-progress-fill" style={{ width: `${(answeredCount / TOTAL_QUESTIONS) * 100}%` }} />
      </div>

      <div className="session-main-card">
        <Grid
          cols={puzzle?.cols}
          cells={puzzle?.cells}
          target={puzzle?.target}
          pivotCells={[]}
          revealedLetter={null}
          answered={false}
          allLetters={puzzle?.allLetters}
        />

        <AnswerPad onSelect={handleSelect} disabled={answered || loading || !puzzle} selected={selected} correctLetter={null} />

        <div className="session-footer-actions">
          {!answered && (
            <button className="btn" onClick={skipCurrent} disabled={loading || isLast}>
              Skip — come back later
            </button>
          )}
          <button className="btn primary btn-next-q" onClick={advance} disabled={!answered}>
            {isLast ? 'Finish Exam ★' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
}