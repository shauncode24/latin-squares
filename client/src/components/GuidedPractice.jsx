import { useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';
import { TIERS, TIER_LABEL } from '../lib/constants';

// Bridges LearnMode (watch a fixed example) and NormalPractice (solve alone,
// timed). Untimed. Instead of one hint, the solver's own deduction chain can
// be revealed one round at a time before the user commits to an answer.
export default function GuidedPractice({ onClose }) {
  const [difficulty, setDifficulty] = useState('medium');
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revealedRound, setRevealedRound] = useState(-1); // -1 = nothing revealed
  const [revealedCells, setRevealedCells] = useState([]);
  const [displayCells, setDisplayCells] = useState(null);
  const [totalRounds, setTotalRounds] = useState(0);
  const [isDirect, setIsDirect] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [correctLetter, setCorrectLetter] = useState(null);
  const [explanation, setExplanation] = useState(null);

  async function startPuzzle(diff = difficulty) {
    setLoading(true);
    setAnswered(false);
    setSelected(null);
    setCorrectLetter(null);
    setExplanation(null);
    setRevealedRound(-1);
    setRevealedCells([]);
    try {
      const data = await api.generatePuzzle(diff);
      setPuzzle(data);
      setDisplayCells(data.cells.map((row) => row.slice()));
      setTotalRounds(data.rounds);
      setIsDirect(data.rounds === 0);
    } finally {
      setLoading(false);
    }
  }

  async function revealNextStep() {
    if (!puzzle) return;
    const nextRound = revealedRound + 1;
    const { pivotCells: cells } = await api.getHint(puzzle.puzzleId, nextRound);
    setRevealedRound(nextRound);
    setRevealedCells((prev) => [...prev, ...cells]);

    if (cells.length && puzzle.allLetters) {
      setDisplayCells((prev) => {
        const next = prev.map((row) => row.slice());
        for (const [r, c] of cells) next[r][c] = puzzle.allLetters[r][c];
        return next;
      });
    }
  }

  async function handleSelect(letter) {
    if (answered || !puzzle) return;
    setSelected(letter);
    setAnswered(true);
    // elapsedMs is fixed and irrelevant here — this mode is explicitly
    // untimed, so we don't want the server's fast-answer heuristic
    // (rushed/guessed) firing on an untimed guided attempt.
    const res = await api.submitAnswer(puzzle.puzzleId, letter, 5000, revealedRound >= 0, null);
    setCorrectLetter(res.correctLetter);
    setExplanation(res.explanation || null);
  }

  const canRevealMore = puzzle && !isDirect && revealedRound + 1 < totalRounds;
  const allStepsShown = puzzle && (isDirect || revealedRound + 1 >= totalRounds);

  if (!puzzle) {
    return (
      <div className="wrap review-page-container">
        <div className="review-top-bar">
          <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
            <Icon.ArrowLeft />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <div className="review-hero-card">
          <h1 className="review-hero-title">Guided Practice</h1>
          <p className="review-hero-sub">
            Untimed. Reveal the solver's deduction chain one step at a time, then
            try the target yourself whenever you're ready — no clock running.
          </p>
          <div className="session-option-group" style={{ marginTop: 16 }}>
            <div className="session-option-label">Difficulty</div>
            <div className="session-option-row">
              {TIERS.map((d) => (
                <button
                  key={d}
                  className={`session-option-btn${difficulty === d ? ' active' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {TIER_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary btn-lg" style={{ marginTop: 16 }} onClick={() => startPuzzle(difficulty)} disabled={loading}>
            {loading ? 'Loading…' : 'Start'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap review-page-container">
      <div className="review-top-bar">
        <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <span className={`tier-tag tier-${difficulty}`}>{TIER_LABEL[difficulty]}</span>
      </div>

      <div className="review-practice-card">
        <div className="review-practice-header">
          <h2 className="review-practice-title">Guided Practice — Untimed</h2>
          <p className="review-practice-sub">
            {isDirect
              ? 'This one reads directly from the row and column — no pivot needed.'
              : `${totalRounds} deduction step${totalRounds === 1 ? '' : 's'} before the target opens up. Reveal them one at a time, or try it cold.`}
          </p>
        </div>

        <div className="review-board-area">
          <Grid
            cols={puzzle.cols}
            cells={displayCells}
            target={puzzle.target}
            pivotCells={revealedCells}
            revealedLetter={correctLetter}
            answered={answered}
            allLetters={puzzle.allLetters}
          />

          {!answered && (
            <div className="review-answerpad-wrap">
              <AnswerPad onSelect={handleSelect} disabled={loading} selected={selected} correctLetter={null} />
            </div>
          )}

          {answered && (
            <div className={`review-feedback-banner ${selected === correctLetter ? 'feedback-correct' : 'feedback-wrong'}`}>
              <div className="feedback-text">
                {selected === correctLetter ? <strong>Correct.</strong> : <strong>Not quite — answer is {correctLetter}.</strong>}
                {explanation && explanation.length > 0 && (
                  <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {explanation.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                  </ol>
                )}
              </div>
            </div>
          )}

          <div className="review-practice-controls">
            {!answered && canRevealMore && (
              <button className="btn review-action-btn-secondary" onClick={revealNextStep}>
                <Icon.Bulb /> Show next step {totalRounds > 0 ? `(${revealedRound + 2}/${totalRounds})` : ''}
              </button>
            )}
            {!answered && allStepsShown && !isDirect && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>All steps shown — try the target.</span>
            )}
            {answered && (
              <button className="btn primary review-action-btn" onClick={() => startPuzzle(difficulty)}>
                <Icon.Refresh /> Next Puzzle
              </button>
            )}
            <button className="btn review-action-btn-secondary" onClick={() => setPuzzle(null)}>
              Change Difficulty
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}