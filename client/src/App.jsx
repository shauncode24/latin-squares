import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import Grid from './components/Grid';
import AnswerPad from './components/AnswerPad';
import Stats from './components/Stats';
import './styles.css';

const TIERS = ['low', 'medium', 'high'];
const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const TIER_TARGET_LABEL = { low: '10\u201320s', medium: '40\u201350s', high: '65\u201375s' };
const TIER_TARGET_SECONDS = { low: 20, medium: 50, high: 75 };

export default function App() {
  const [tier, setTier] = useState('low');
  const [puzzle, setPuzzle] = useState(null); // { puzzleId, cols, cells, target, rounds }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [pivotCells, setPivotCells] = useState([]);

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const tickRef = useRef(null);

  const [stats, setStats] = useState(null);

  const answered = correctLetter !== null;

  async function loadStats() {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch {
      // stats are a nice-to-have; ignore failures silently
    }
  }

  async function newPuzzle(nextTier = tier) {
    setLoading(true);
    setError('');
    setSelected(null);
    setCorrectLetter(null);
    setFeedback('');
    setPivotCells([]);
    clearInterval(tickRef.current);

    try {
      const data = await api.generatePuzzle(nextTier);
      setPuzzle(data);
      startRef.current = performance.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
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
    loadStats();
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
        correct ? `Correct \u2014 ${(elapsedMs / 1000).toFixed(1)}s` : `Not quite \u2014 answer is ${answer}`
      );
      loadStats();
    } catch (err) {
      setError(err.message || 'Could not grade that answer.');
    }
  }

  async function reveal() {
    if (answered || !puzzle) return;
    clearInterval(tickRef.current);
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
          ? 'Direct read: combine the target\u2019s row and column into one set.'
          : 'Solve the highlighted cell first \u2014 it forces the target.'
      );
    } catch (err) {
      setError(err.message || 'Could not fetch a hint.');
    }
  }

  const overTime = elapsed / 1000 > TIER_TARGET_SECONDS[tier];

  return (
    <div className="wrap">
      <header className="masthead">
        <h1>dMAT Latin Square Drill</h1>
        <span className="sub">rows &amp; columns only</span>
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
          <div className="loading">Loading grid\u2026</div>
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

      <Stats stats={stats} />
    </div>
  );
}
