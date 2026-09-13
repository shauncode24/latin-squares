import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import { SessionProvider } from './SessionContext';
import Stats from './components/Stats';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import LearnMode from './components/LearnMode';
import PracticeSession from './components/PracticeSession';
import ExamSimulation from './components/ExamSimulation';
import ReviewMode from './components/ReviewMode';
import GuidedPractice from './components/GuidedPractice';
import RapidFire from './components/RapidFire';
import Masthead from './components/Masthead';
import NavTabs from './components/NavTabs';
import NormalPractice from './components/NormalPractice';
import PracticeHub from './components/PracticeHub';
import SessionSetupModal from './components/SessionSetupModal';
import { TIER_TARGET_MS } from './lib/constants';
import './styles.css';

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
  const [showGuided, setShowGuided]   = useState(false); // NEW
  const [showRapidFire, setShowRapidFire] = useState(false); // NEW
  const [activeTab, setActiveTab]     = useState('normal');

  const [tier, setTier]       = useState('low');
  const [puzzle, setPuzzle]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [untimed, setUntimed] = useState(false);

  const [selected, setSelected]           = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [feedback, setFeedback]           = useState('');
  const [pivotCells, setPivotCells]       = useState([]);
  const [explanation, setExplanation]     = useState(null); // NEW

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
    setExplanation(null);
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
    setExplanation(null);
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
      setExplanation(res.explanation || null);

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
      const { correctLetter: answer, explanation: exp } = await api.revealAnswer(puzzle.puzzleId);
      setCorrectLetter(answer);
      setExplanation(exp || null);
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

  const overTime = !untimed && elapsed / 1000 > TIER_TARGET_MS[tier] / 1000;
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
    return (
      <LearnMode
        onClose={() => setShowLearn(false)}
        onStartPractice={() => { setShowLearn(false); setActiveTab('normal'); }}
        onStartGuided={() => { setShowLearn(false); setShowGuided(true); }}
      />
    );
  }
  if (showGuided) {
    return <GuidedPractice onClose={() => { setShowGuided(false); if (user) loadStats(); }} />;
  }
  if (showRapidFire) {
    return <RapidFire onExit={() => { setShowRapidFire(false); if (user) loadStats(); }} />;
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
        <Masthead
          user={user}
          status={status}
          onLogout={handleLogout}
          onSignIn={() => setShowAuth(true)}
        />

        <NavTabs
          activeTab={activeTab}
          onChange={(tab) => { setActiveTab(tab); if (tab === 'stats' && user) loadStats(); }}
        />

        {activeTab === 'normal' && (
          <NormalPractice
            tier={tier}
            onChangeTier={changeTier}
            elapsed={elapsed}
            overTime={overTime}
            error={error}
            weaknessConfig={weaknessConfig}
            onExitWeakness={() => { setWeaknessConfig(null); newPuzzle(tier); }}
            isGuest={isGuest}
            onSignIn={() => setShowAuth(true)}
            puzzle={puzzle}
            loading={loading}
            pivotCells={pivotCells}
            correctLetter={correctLetter}
            answered={answered}
            selected={selected}
            onSelectAnswer={selectAnswer}
            feedback={feedback}
            onHint={showHint}
            onReveal={reveal}
            onReview={() => setShowReview(true)}
            onLearn={() => setShowLearn(true)}
            onNewGrid={() => weaknessConfig ? newWeaknessPuzzle() : newPuzzle(tier)}
            untimed={untimed}
            onToggleUntimed={() => setUntimed((v) => !v)}
            explanation={explanation}
          />
        )}

        {activeTab === 'practice-mode' && (
          <PracticeHub
            user={user}
            onStartSession={(cfg) => setActiveSessionConfig(cfg)}
            onStartSimulation={() => setShowSimulation(true)}
            onReview={() => setShowReview(true)}
            onLearn={() => setShowLearn(true)}
            onAuth={() => setShowAuth(true)}
            onGuided={() => setShowGuided(true)}
            onRapidFire={() => setShowRapidFire(true)}
          />
        )}

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