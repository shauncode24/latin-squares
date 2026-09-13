import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import { SessionProvider } from './SessionContext';
import Grid from './components/Grid';
import AnswerPad from './components/AnswerPad';
import Stats from './components/Stats';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import LearnMode from './components/LearnMode';
import PracticeSession from './components/PracticeSession';
import ExamSimulation from './components/ExamSimulation';
import ReviewMode from './components/ReviewMode';
import DueReviews from './components/DueReviews';
import './styles.css';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const TIER_DESC = {
  low: 'Direct read — the answer sits in a row or column with a single blank.',
  medium: 'One pivot — solve a neighbouring cell first, then read the target.',
  high: 'Two or more pivots — a chain of deductions before the target opens up.',
};
const TIER_TARGET_LABEL = { low: '10-20s', medium: '40-50s', high: '65-75s' };
const TIER_TARGET_MS    = { low: 20000, medium: 50000, high: 75000 };

/* Minimal inline icon set (no external icon lib in this project) */
const Icon = {
  Logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Bulb: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 2Z" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Book: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  Timer: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

function SessionSetupModal({ onStart, onClose }) {
  const [mode, setMode] = useState('practice');
  const [difficulty, setDifficulty] = useState('low');
  const [count, setCount] = useState(10);
  return (
    <div
      className="session-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Start a session"
    >
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

function PracticeHub({ user, onStartSession, onStartSimulation, onReview, onLearn, onAuth }) {
  const [mode, setMode] = useState('practice');
  const [difficulty, setDifficulty] = useState('low');
  const [count, setCount] = useState(10);

  return (
    <div className="practice-hub">
      {user && <DueReviews />}

      <div className="practice-hub-grid">
        {/* Card 1: Custom Practice Session */}
        <div className="hub-card">
          <div className="hub-card-header">
            <div className="hub-card-icon"><Icon.List /></div>
            <div>
              <h3 className="hub-card-title">Practice Session</h3>
              <p className="hub-card-desc">Targeted question blocks with customized difficulty and pacing.</p>
            </div>
          </div>

          <div className="hub-card-body">
            <div className="session-option-group">
              <div className="session-option-label">Mode</div>
              <div className="session-option-row">
                {['practice', 'exam'].map((m) => (
                  <button
                    key={m}
                    className={`session-option-btn${mode === m ? ' active' : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m === 'exam' ? 'Exam (no hints)' : 'Practice'}
                  </button>
                ))}
              </div>
            </div>

            <div className="session-option-group">
              <div className="session-option-label">Difficulty</div>
              <div className="session-option-row">
                {[...TIERS, 'mixed'].map((d) => (
                  <button
                    key={d}
                    className={`session-option-btn${difficulty === d ? ' active' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="session-option-group">
              <div className="session-option-label">Questions</div>
              <div className="session-option-row">
                {[5, 10, 20].map((n) => (
                  <button
                    key={n}
                    className={`session-option-btn${count === n ? ' active' : ''}`}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hub-card-footer">
            {user ? (
              <button
                className="btn primary"
                style={{ width: '100%' }}
                onClick={() => onStartSession({ mode, difficulty, questionCount: count })}
              >
                Start Practice Session →
              </button>
            ) : (
              <button className="btn primary" style={{ width: '100%' }} onClick={onAuth}>
                Sign in to Start Practice
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Full Exam Simulation */}
        <div className="hub-card">
          <div className="hub-card-header">
            <div className="hub-card-icon"><Icon.Timer /></div>
            <div>
              <h3 className="hub-card-title">Full Exam Simulation</h3>
              <p className="hub-card-desc">
                Strict 25-minute test conditions with 25 mixed puzzles matching real test distribution.
              </p>
            </div>
          </div>

          <div className="hub-card-body">
            <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', lineHeight: '1.6' }}>
              <div>• <strong>10 Low</strong> (direct single-row/col read)</div>
              <div>• <strong>9 Medium</strong> (1-pivot deductions)</div>
              <div>• <strong>6 High</strong> (2+ pivot complex chains)</div>
              <div style={{ marginTop: '10px' }}>Pacing target: <strong>60 seconds</strong> average per grid.</div>
            </div>
          </div>

          <div className="hub-card-footer">
            {user ? (
              <button
                className="btn primary"
                style={{ width: '100%' }}
                onClick={onStartSimulation}
              >
                Launch Full Simulation →
              </button>
            ) : (
              <button className="btn primary" style={{ width: '100%' }} onClick={onAuth}>
                Sign in to Take Simulation
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Review & Learn */}
        <div className="hub-card">
          <div className="hub-card-header">
            <div className="hub-card-icon"><Icon.Book /></div>
            <div>
              <h3 className="hub-card-title">Techniques & Review</h3>
              <p className="hub-card-desc">Review your past mistakes or learn the deduction algorithms.</p>
            </div>
          </div>

          <div className="hub-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn" style={{ justifyContent: 'flex-start', padding: '12px 14px' }} onClick={onLearn}>
              <Icon.Book /> Interactive "How to Solve" Tutorial
            </button>
            <button className="btn" style={{ justifyContent: 'flex-start', padding: '12px 14px' }} onClick={onReview}>
              <Icon.History /> Review Missed Puzzles
            </button>
          </div>
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
  const [showLearn, setShowLearn]     = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [activeTab, setActiveTab]     = useState('normal'); // 'normal' | 'practice-mode' | 'stats'

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
  const [weaknessConfig, setWeaknessConfig] = useState(null);

  const answered = correctLetter !== null;

  useEffect(() => {
    if (!localStorage.getItem('dmat_onboarded')) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    if (status === 'ready' && !user) setShowAuth(true);
  }, [status, user]);

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

  function startWeaknessPractice(weakest) {
    setWeaknessConfig({
      rounds: weakest.rounds,
      pivotDistance: weakest.pivotDistance,
      difficulty: weakest.difficulty,
    });
    setActiveTab('normal');
  }

  async function newWeaknessPuzzle() {
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
      const data = await api.generateSimilar(weaknessConfig.rounds, weaknessConfig.pivotDistance, weaknessConfig.difficulty);
      setPuzzle(data);
      setTier(data.difficulty);
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
    if (weaknessConfig) newWeaknessPuzzle();
  }, [weaknessConfig]);

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

      if (!res.correct) {
        setPivotCells(res.pivotCells || []);
      }

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
  if (showSimulation) {
    return <ExamSimulation onExit={() => { setShowSimulation(false); if (user) loadStats(); }} />;
  }
  if (showLearn) {
    return <LearnMode onClose={() => setShowLearn(false)} />;
  }

  const anyOverlayOpen = (showAuth && !user) || showOnboarding || showSessionModal;

  if (showAuth && !user) {
    return <AuthScreen onGuest={handleGuest} onSuccess={handleAuthSuccess} />;
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

      <div
        className="wrap"
        {...(anyOverlayOpen ? { inert: '', 'aria-hidden': 'true' } : {})}
      >
        <header className="masthead">
          <div className="masthead-brand">
            <div className="brand-logo-sm" />
            <div>
              <h1>dMAT Latin Square Drill</h1>
              <span className="sub">rows & columns only</span>
            </div>
          </div>
          <div className="masthead-user">
            {status === 'loading' ? null : user ? (
              <>
                <span className="signed-in-label">Signed in as <strong>{user.username}</strong></span>
                <button className="btn-outline-sm" onClick={handleLogout}>
                  <Icon.Logout /> Log out
                </button>
              </>
            ) : (
              <button className="btn-link" onClick={() => setShowAuth(true)}>Sign in</button>
            )}
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="nav-tabs" aria-label="Main Navigation">
          <button
            className={`nav-tab${activeTab === 'normal' ? ' active' : ''}`}
            onClick={() => setActiveTab('normal')}
          >
            <Icon.Grid /> Normal Practice
          </button>
          <button
            className={`nav-tab${activeTab === 'practice-mode' ? ' active' : ''}`}
            onClick={() => setActiveTab('practice-mode')}
          >
            <Icon.Timer /> Practice Mode
          </button>
          <button
            className={`nav-tab${activeTab === 'stats' ? ' active' : ''}`}
            onClick={() => { setActiveTab('stats'); if (user) loadStats(); }}
          >
            <Icon.Chart /> Stats
          </button>
        </nav>

        {/* Tab 1: Normal Practice */}
        {activeTab === 'normal' && (
          <div className="drill-container">
            <div className="tiers">
              {TIERS.map((t) => (
                <button
                  key={t}
                  className={`tier-card${t === tier ? ' active' : ''}`}
                  onClick={() => changeTier(t)}
                >
                  <div className="tier-card-title">{TIER_LABEL[t]}</div>
                  <div className="tier-card-desc">{TIER_DESC[t]}</div>
                </button>
              ))}
            </div>

            <div className="status-row">
              <span>Target: {TIER_TARGET_LABEL[tier]}</span>
              <span className={`time${overTime ? ' over' : ''}`}>{(elapsed / 1000).toFixed(1)}s</span>
            </div>

            {error && <div className="error">{error}</div>}

            {weaknessConfig && (
              <div className="guest-banner">
                🎯 Weakness Mode — {weaknessConfig.difficulty} / rounds {weaknessConfig.rounds}
                {' '}<button className="btn-link" onClick={() => { setWeaknessConfig(null); newPuzzle(tier); }}>Exit</button>
              </div>
            )}

            {isGuest && (
              <div className="guest-banner">
                🎮 Guest mode — <button className="btn-link" onClick={() => setShowAuth(true)}>Sign in</button> to save your scores
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
                <div className="loading">Loading grid…</div>
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
              <button className="btn" onClick={showHint} disabled={!puzzle || loading}>
                <Icon.Bulb /> Hint
              </button>
              <button className="btn" onClick={reveal} disabled={answered || !puzzle || loading}>
                <Icon.Eye /> Reveal
              </button>
              <button className="btn" onClick={() => setShowReview(true)} disabled={loading || isGuest} title={isGuest ? 'Sign in to review missed puzzles' : ''}>
                <Icon.History /> Review
              </button>
              <button className="btn" onClick={() => setShowLearn(true)}>
                <Icon.Book /> How to Solve
              </button>
              <button
                className="btn primary"
                onClick={() => weaknessConfig ? newWeaknessPuzzle() : newPuzzle(tier)}
                disabled={loading}
              >
                <Icon.Refresh /> New grid
              </button>
            </div>

            <p className="controls-caption">Hint marks the attempt as hint-assisted. Reveal shows the answer without grading it.</p>
          </div>
        )}

        {/* Tab 2: Practice Mode */}
        {activeTab === 'practice-mode' && (
          <PracticeHub
            user={user}
            onStartSession={(cfg) => setActiveSessionConfig(cfg)}
            onStartSimulation={() => setShowSimulation(true)}
            onReview={() => setShowReview(true)}
            onLearn={() => setShowLearn(true)}
            onAuth={() => setShowAuth(true)}
          />
        )}

        {/* Tab 3: Stats */}
        {activeTab === 'stats' && (
          <div className="stats-tab-content">
            {!isGuest && (
              <Dashboard
                stats={stats}
                onPracticeWeakness={startWeaknessPractice}
              />
            )}

            <Stats
              stats={stats}
              history={history}
              isGuest={isGuest}
              guestAttempts={guestAttempts}
              onSignUpNudge={() => setShowAuth(true)}
            />
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