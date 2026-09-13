import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import Grid from './components/Grid';
import AnswerPad from './components/AnswerPad';
import Stats from './components/Stats';
import AuthScreen from './components/AuthScreen';
import './styles.css';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const TIER_TARGET_LABEL = { low: '10–20s', medium: '40–50s', high: '65–75s' };
const TIER_TARGET_SECONDS = { low: 20, medium: 50, high: 75 };

function Game() {
  const { user, status, logout } = useAuth();

  // null  = auth screen not yet dismissed
  // true  = user chose "guest" explicitly
  const [guestMode, setGuestMode] = useState(false);
  // Whether to show the auth screen (shown on load until user logs in or picks guest)
  const [showAuth, setShowAuth] = useState(false);

  const [tier, setTier] = useState('low');
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [pivotCells, setPivotCells] = useState([]);

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const tickRef = useRef(null);
  // Ref so the interval closure can read latest answered state without stale capture
  const answeredRef = useRef(false);

  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);

  const answered = correctLetter !== null;

  // Once auth status is resolved, show auth screen if not logged in
  useEffect(() => {
    if (status === 'ready' && !user) {
      setShowAuth(true);
    }
  }, [status, user]);

  // Load stats whenever the user state changes (login/logout)
  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      setStats(null);
      setHistory(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadStats() {
    try {
      const [statsData, historyData] = await Promise.all([
        api.getStats(),
        api.getHistory(),
      ]);
      setStats(statsData);
      setHistory(historyData.history);
    } catch {
      // stats are a nice-to-have; ignore silently
    }
  }

  async function newPuzzle(nextTier = tier) {
    setLoading(true);
    setError('');
    setSelected(null);
    setCorrectLetter(null);
    answeredRef.current = false;
    setFeedback('');
    setPivotCells([]);
    clearInterval(tickRef.current);

    try {
      const data = await api.generatePuzzle(nextTier);
      setPuzzle(data);
      startRef.current = performance.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        // Timer bug fix: stop ticking once the puzzle is answered
        if (answeredRef.current) {
          clearInterval(tickRef.current);
          return;
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTier(nextTier) {
    setTier(nextTier);
    newPuzzle(nextTier);
  }

  async function selectAnswer(letter) {
    if (answered || !puzzle) return;
    clearInterval(tickRef.current);
    answeredRef.current = true;
    const elapsedMs = performance.now() - startRef.current;
    setSelected(letter);

    try {
      const { correct, correctLetter: answer } = await api.submitAnswer(
        puzzle.puzzleId,
        letter,
        Math.round(elapsedMs)
      );
      setCorrectLetter(answer);
      setFeedback(
        correct
          ? `Correct — ${(elapsedMs / 1000).toFixed(1)}s`
          : `Not quite — answer is ${answer}`
      );
      if (user) loadStats();
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
      setFeedback(
        direct
          ? "Direct read: combine the target's row and column into one set."
          : 'Solve the highlighted cell first — it forces the target.'
      );
    } catch (err) {
      setError(err.message || 'Could not fetch a hint.');
    }
  }

  async function handleLogout() {
    await logout();
    setShowAuth(true);
    setGuestMode(false);
  }

  function handleGuest() {
    setGuestMode(true);
    setShowAuth(false);
  }

  function handleAuthSuccess() {
    setShowAuth(false);
    setGuestMode(false);
  }

  const overTime = elapsed / 1000 > TIER_TARGET_SECONDS[tier];
  const isGuest = !user;

  // Show auth overlay if needed (but let the game be visible behind it
  // so the user can see what they're signing into)
  return (
    <>
      {showAuth && !user && (
        <AuthScreen
          onGuest={handleGuest}
          onSuccess={handleAuthSuccess}
        />
      )}

      <div className="wrap">
        <header className="masthead">
          <div>
            <h1>dMAT Latin Square Drill</h1>
            <span className="sub">rows &amp; columns only</span>
          </div>
          <div className="masthead-user">
            {status === 'loading' ? null : user ? (
              <>
                <span className="user-chip">👤 {user.username}</span>
                <button className="btn-link" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <button className="btn-link" onClick={() => setShowAuth(true)}>
                Sign in
              </button>
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
            🎮 Guest mode — <button className="btn-link" onClick={() => setShowAuth(true)}>Sign in</button> to save your scores
          </div>
        )}

        <div className="board">
          {puzzle && !loading ? (
            <Grid
              cols={puzzle.cols}
              cells={puzzle.cells}
              target={puzzle.target}
              pivotCells={pivotCells}
              revealedLetter={correctLetter}
            />
          ) : (
            <div className="loading">Loading grid…</div>
          )}
        </div>

        <AnswerPad
          onSelect={selectAnswer}
          disabled={answered || loading || !puzzle}
          selected={selected}
          correctLetter={correctLetter}
        />

        <div
          className={`feedback${feedback.startsWith('Correct') ? ' correct-text' : ''}${
            feedback.startsWith('Not quite') ? ' wrong-text' : ''
          }`}
        >
          {feedback || '\u00a0'}
        </div>

        <div className="controls">
          <button className="btn" onClick={showHint} disabled={!puzzle || loading}>
            Hint
          </button>
          <button className="btn" onClick={reveal} disabled={answered || !puzzle || loading}>
            Reveal
          </button>
          <button className="btn primary" onClick={() => newPuzzle(tier)} disabled={loading}>
            New Grid
          </button>
        </div>

        <Stats stats={stats} history={history} isGuest={isGuest} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Game />
    </AuthProvider>
  );
}
