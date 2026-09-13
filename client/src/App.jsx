import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import { SessionProvider } from './SessionContext';
import Grid from './components/Grid';
import AnswerPad from './components/AnswerPad';
import Stats from './components/Stats';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import PracticeSession from './components/PracticeSession';
import ReviewMode from './components/ReviewMode';
import './styles.css';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const TIER_TARGET_LABEL = { low: '10-20s', medium: '40-50s', high: '65-75s' };
const TIER_TARGET_MS    = { low: 20000, medium: 50000, high: 75000 };

function SessionSetupModal({ onStart, onClose }) {
  const [mode, setMode] = useState('practice');
  const [difficulty, setDifficulty] = useState('low');
  const [count, setCount] = useState(10);
  return (
    <div className="session-modal-overlay" onClick={onClose}>
      <div className="session-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Start a Session</h3>
        <div className="session-option-group">
          <div className="session-option-label">Mode</div>
          <div className="session-option-row">
            {['practice', 'exam'].map((m) => (
              <button key={m} className={`session-option-btn${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
                {m === 'exam' ? 'Exam (no hints)' : 'Practice'}
              </button>
            ))}
          </div>
        </div>
        <div className="session-option-group">
          <div className="session-option-label">Difficulty</div>
          <div className="session-option-row">
            {[...TIERS, 'mixed'].map((d) => (
              <button key={d} className={`session-option-btn${difficulty === d ? ' active' : ''}`} onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="session-option-group">
          <div className="session-option-label">Questions</div>
          <div className="session-option-row">
            {[5, 10, 20].map((n) => (
              <button key={n} className={`session-option-btn${count === n ? ' active' : ''}`} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="session-modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onStart({ mode, difficulty, questionCount: count })}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function Game() {
  const { user, status, logout } = useAuth();

  const [guestMode, setGuestMode]     = useState(false);
  const [showAuth, setShowAuth]       = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeSessionConfig, setActiveSessionConfig] = useState(null);
  const [showReview, setShowReview]   = useState(false);

  const [tier, setTier]       = useState('low');
  const [puzzle, setPuzzle]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [selected, setSelected]           = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [feedback, setFeedback]           = useState('');
  const [pivotCells, setPivotCells]       = useState([]);

  const [elapsed, setElapsed] = useState(0);
  const startRef    = useRef(null);
  const tickRef     = useRef(null);
  const answeredRef = useRef(false);
  const hintUsedRef = useRef(false);

  const [stats, setStats]     = useState(null);
  const [history, setHistory] = useState(null);
  const [guestAttempts, setGuestAttempts] = useState([]);

  const answered = correctLetter !== null;

  // Onboarding check
  useEffect(() => {
    if (!localStorage.getItem('dmat_onboarded')) setShowOnboarding(true);
  }, []);

  // Show auth if not logged in once status resolved
  useEffect(() => {
    if (status === 'ready' && !user) setShowAuth(true);
  }, [status, user]);

  // Load stats on login
  useEffect(() => {
    if (user) { loadStats(); }
    else { setStats(null); setHistory(null); }
  }, [user]);

  async function loadStats() {
    try {
      const [statsData, historyData] = await Promise.all([api.getStats(), api.getHistory()]);
      setStats(statsData);
      setHistory(historyData.history);
    } catch { /* stats are non-critical */ }
  }

  async function newPuzzle(nextTier = tier) {
    setLoading(true);
    setError('');
    setSelected(null);
    setCorrectLetter(null);
    answeredRef.current = false;
    hintUsedRef.current = false;
    setFeedback('');
    setPivotCells([]);
    clearInterval(tickRef.current);
    try {
      const data = await api.generatePuzzle(nextTier);
      setPuzzle(data);
      startRef.current = performance.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        if (answeredRef.current) { clearInterval(tickRef.current); return; }
        setElapsed(performance.now() - startRef.current);
      }, 100);
    } catch (err) {
      setError(err.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    newPuzzle(tier);
    return () => clearInterval(tickRef.current);
  }, []);

  function changeTier(nextTier) { setTier(nextTier); newPuzzle(nextTier); }

  async function selectAnswer(letter) {
    if (answered || !puzzle) return;
    clearInterval(tickRef.current);
    answeredRef.current = true;
    const elapsedMs = Math.round(performance.now() - startRef.current);
    setSelected(letter);
    try {
      const res = await api.submitAnswer(puzzle.puzzleId, letter, elapsedMs, hintUsedRef.current, null);
      setCorrectLetter(res.correctLetter);
      const timeSec = (elapsedMs / 1000).toFixed(1);
      const target = TIER_TARGET_MS[tier];
      if (res.correct) {
        const comparison = elapsedMs <= target
          ? `${timeSec}s \u2713 (target ${target / 1000}s)`
          : `${timeSec}s (${((elapsedMs - target) / 1000).toFixed(1)}s over target)`;
        setFeedback(`Correct \u2014 ${comparison}`);
      } else {
        setFeedback(`Not quite \u2014 answer is ${res.correctLetter}`);
      }
      if (user) loadStats();
      else setGuestAttempts((prev) => [...prev, { correct: res.correct, elapsedMs }]);
    } catch (err) {
      setError(err.message || 'Could not grade that answer.');
    }
  }

  async function reveal() {
    if (answered || !puzzle) return;
    clearInterval(tickRef.current);
    answeredRef.current = true;
    try {
      const { correctLetter: answer } = await api.revealAnswer(puzzle.puzzleId);
      setCorrectLetter(answer);
      setFeedback(`Answer: ${answer}`);
    } catch (err) {
      setError(err.message || 'Could not reveal the answer.');
    }
  }

  async function showHint() {
    if (!puzzle) return;
    try {
      const { pivotCells: cells, direct } = await api.getHint(puzzle.puzzleId);
      setPivotCells(cells);
      hintUsedRef.current = true;
      setFeedback(direct
        ? "Direct read: combine the target's row and column into one set."
        : 'Solve the highlighted cell first - it forces the target.');
    } catch (err) {
      setError(err.message || 'Could not fetch a hint.');
    }
  }

  async function handleLogout() { await logout(); setShowAuth(true); setGuestMode(false); setGuestAttempts([]); }
  function handleGuest()   { setGuestMode(true); setShowAuth(false); }
  function handleAuthSuccess() { setShowAuth(false); setGuestMode(false); }

  const overTime = elapsed / 1000 > TIER_TARGET_MS[tier] / 1000;
  const isGuest  = !user;

  // Session/review screens replace the main game
  if (activeSessionConfig) {
    return (
      <PracticeSession
        config={activeSessionConfig}
        onExit={() => { setActiveSessionConfig(null); if (user) loadStats(); }}
      />
    );
  }
  if (showReview) {
    return <ReviewMode onClose={() => setShowReview(false)} />;
  }

  return (
    <>
      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}
      {showSessionModal && (
        <SessionSetupModal
          onStart={(cfg) => { setShowSessionModal(false); setActiveSessionConfig(cfg); }}
          onClose={() => setShowSessionModal(false)}
        />
      )}
      {showAuth && !user && (
        <AuthScreen onGuest={handleGuest} onSuccess={handleAuthSuccess} />
      )}

      {/* Board is inert while any overlay is open */}
      <div
        className="wrap"
        {...((showAuth && !user) || showOnboarding ? { inert: '', 'aria-hidden': 'true' } : {})}
      >
        {/* Stats above puzzle */}
        <Stats
          stats={stats}
          history={history}
          isGuest={isGuest}
          guestAttempts={guestAttempts}
          onSignUpNudge={() => setShowAuth(true)}
        />

        <header className="masthead">
          <div>
            <h1>dMAT Latin Square Drill</h1>
            <span className="sub">rows & columns only</span>
          </div>
          <div className="masthead-user">
            {status === 'loading' ? null : user ? (
              <>
                <span className="user-chip">\ud83d\udc64 {user.username}</span>
                <button className="btn-link" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <button className="btn-link" onClick={() => setShowAuth(true)}>Sign in</button>
            )}
          </div>
        </header>

        <div className="tiers">
          {TIERS.map((t) => (
            <button
              key={t}
              className={`tier-btn${t === tier ? ' active' : ''}`}
              onClick={() => changeTier(t)}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="status-row">
          <span>Target: {TIER_TARGET_LABEL[tier]}</span>
          <span className={`time${overTime ? ' over' : ''}`}>{(elapsed / 1000).toFixed(1)}s</span>
        </div>

        {error && <div className="error">{error}</div>}

        {isGuest && !showAuth && (
          <div className="guest-banner">
            \ud83c\udfae Guest mode \u2014 <button className="btn-link" onClick={() => setShowAuth(true)}>Sign in</button> to save your scores
          </div>
        )}

        <div className={`board${answered ? ' answered' : ''}`}>
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
            <div className="loading">Loading grid\u2026</div>
          )}
        </div>

        <AnswerPad
          onSelect={selectAnswer}
          disabled={answered || loading || !puzzle}
          selected={selected}
          correctLetter={correctLetter}
        />

        <div className={`feedback${feedback.startsWith('Correct') ? ' correct-text' : ''}${feedback.startsWith('Not quite') ? ' wrong-text' : ''}`}>
          {feedback || '\u00a0'}
        </div>

        <div className="controls">
          <button className="btn" onClick={showHint} disabled={!puzzle || loading}>Hint</button>
          <button className="btn" onClick={reveal} disabled={answered || !puzzle || loading}>Reveal</button>
          <button className="btn" onClick={() => setShowReview(true)} disabled={loading || isGuest} title={isGuest ? 'Sign in to review missed puzzles' : ''}>Review</button>
          <button className="btn primary" onClick={() => newPuzzle(tier)} disabled={loading}>New Grid</button>
        </div>

        {user && (
          <div className="controls" style={{ marginTop: '-14px' }}>
            <button className="btn" onClick={() => setShowSessionModal(true)} disabled={loading}>
              Practice Session
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <Game />
      </SessionProvider>
    </AuthProvider>
  );
}
