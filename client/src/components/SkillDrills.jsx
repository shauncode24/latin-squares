import { useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import { Icon } from './icons';
import { TIERS, TIER_LABEL } from '../lib/constants';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const CLASSIFY_OPTIONS = [
  { key: 'direct', label: 'Direct read' },
  { key: 'pivot', label: 'Single pivot' },
  { key: 'chain', label: 'Multi-step chain' },
];

function tagToClassifyKey(patternTag) {
  if (patternTag === 'direct') return 'direct';
  if (patternTag === 'single-pivot-aligned' || patternTag === 'single-pivot-cross') return 'pivot';
  return 'chain'; // chain-2, chain-3
}

// Given the masked cells + target, compute the actual remaining candidate
// letters using ONLY what's visible in the target's row and column — the
// same operation the real solver does, done client-side, without ever
// looking at the hidden answer.
function computeCandidates(cells, target) {
  const used = new Set();
  const { row, col } = target;
  for (let c = 0; c < 5; c++) {
    if (cells[row][c] != null) used.add(cells[row][c]);
  }
  for (let r = 0; r < 5; r++) {
    if (cells[r][col] != null) used.add(cells[r][col]);
  }
  return LETTERS.filter((l) => !used.has(l));
}

// Masks everything except the target's row and column, so the eliminate
// drill isolates that one operation instead of showing the whole grid.
function isolateRowCol(cells, target) {
  return cells.map((row, r) =>
    row.map((v, c) => (r === target.row || c === target.col ? v : null))
  );
}

export default function SkillDrills({ onClose }) {
  const [mode, setMode] = useState(null); // null | 'eliminate' | 'classify'
  const [difficulty, setDifficulty] = useState('medium');
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // --- Eliminate drill state ---
  const [selected, setSelected] = useState(new Set());
  const [elimSubmitted, setElimSubmitted] = useState(false);
  const [candidates, setCandidates] = useState([]);

  // --- Classify drill state ---
  const [classifyPicked, setClassifyPicked] = useState(null);

  async function startElimination(diff = difficulty) {
    setLoading(true);
    setElimSubmitted(false);
    setSelected(new Set());
    try {
      const data = await api.generatePuzzle(diff);
      const cand = computeCandidates(data.cells, data.target);
      setCandidates(cand);
      setPuzzle(data);
    } finally {
      setLoading(false);
    }
  }

  async function startClassify(diff = difficulty) {
    setLoading(true);
    setClassifyPicked(null);
    try {
      const data = await api.generatePuzzle(diff);
      setPuzzle(data);
    } finally {
      setLoading(false);
    }
  }

  function toggleLetter(letter) {
    if (elimSubmitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  function submitElimination() {
    if (elimSubmitted || !puzzle) return;
    const correctSet = new Set(candidates);
    const isExact = selected.size === correctSet.size && [...selected].every((l) => correctSet.has(l));
    setElimSubmitted(true);
    setScore((s) => ({ correct: s.correct + (isExact ? 1 : 0), total: s.total + 1 }));
  }

  function pickClassify(key) {
    if (classifyPicked || !puzzle) return;
    const correctKey = tagToClassifyKey(puzzle.patternTag);
    setClassifyPicked(key);
    setScore((s) => ({ correct: s.correct + (key === correctKey ? 1 : 0), total: s.total + 1 }));
  }

  // ─── Mode picker ─────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="wrap review-page-container">
        <div className="review-top-bar">
          <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
            <Icon.ArrowLeft />
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div className="review-hero-card">
          <h1 className="review-hero-title">Foundational Skill Drills</h1>
          <p className="review-hero-sub">
            Full puzzles bundle three skills together: spotting structure, eliminating
            candidates, and reading the final answer. These drills isolate the first two
            so you can build them to automaticity before chaining them under time pressure.
          </p>
        </div>

        <div className="practice-hub-grid">
          <div className="hub-card">
            <div className="hub-card-header">
              <div className="hub-card-icon"><Icon.Target /></div>
              <div>
                <h3 className="hub-card-title">Candidate Elimination</h3>
                <p className="hub-card-desc">
                  See only the target's row and column. Select every letter that's still
                  possible — no guessing the final answer, just the elimination step itself.
                </p>
              </div>
            </div>
            <div className="hub-card-footer">
              <button className="btn primary" style={{ width: '100%' }} onClick={() => { setMode('eliminate'); startElimination(); }}>
                Start Elimination Drill →
              </button>
            </div>
          </div>

          <div className="hub-card">
            <div className="hub-card-header">
              <div className="hub-card-icon"><Icon.Grid /></div>
              <div>
                <h3 className="hub-card-title">Pattern Recognition</h3>
                <p className="hub-card-desc">
                  Glance at a puzzle and classify its structure — direct read, single
                  pivot, or multi-step chain — before you'd normally start solving.
                </p>
              </div>
            </div>
            <div className="hub-card-footer">
              <button className="btn primary" style={{ width: '100%' }} onClick={() => { setMode('classify'); startClassify(); }}>
                Start Classification Drill →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const accuracy = score.total ? Math.round((100 * score.correct) / score.total) : null;

  // ─── Elimination drill ───────────────────────────────────────
  if (mode === 'eliminate') {
    const isolated = puzzle ? isolateRowCol(puzzle.cells, puzzle.target) : null;
    return (
      <div className="wrap review-page-container">
        <div className="review-top-bar">
          <button className="review-nav-btn review-dashboard-btn" onClick={() => setMode(null)}>
            <Icon.ArrowLeft />
            <span>Back to Skill Drills</span>
          </button>
          <div className="review-summary-pills">
            <span className="summary-pill">Score: {score.correct}/{score.total}{accuracy != null ? ` (${accuracy}%)` : ''}</span>
            <span className={`tier-tag tier-${difficulty}`}>{TIER_LABEL[difficulty]}</span>
          </div>
        </div>

        <div className="session-option-group" style={{ marginBottom: 12 }}>
          <div className="session-option-label">Difficulty</div>
          <div className="session-option-row">
            {TIERS.map((d) => (
              <button
                key={d}
                className={`session-option-btn${difficulty === d ? ' active' : ''}`}
                onClick={() => { setDifficulty(d); startElimination(d); }}
              >
                {TIER_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="review-practice-card">
          <div className="review-practice-header">
            <h2 className="review-practice-title">Which letters are still possible?</h2>
            <p className="review-practice-sub">
              Only the target's row and column are shown. Select every letter that hasn't
              been ruled out yet by those two lines — don't try to solve to a single answer.
            </p>
          </div>

          {loading || !puzzle ? (
            <div className="review-practice-loading">
              <div className="practice-spinner" />
              <span>Loading…</span>
            </div>
          ) : (
            <div className="review-board-area">
              <Grid cols={puzzle.cols} cells={isolated} target={puzzle.target} answered={false} allLetters={null} />

              <div className="answer-pad-container">
                <div className="answers">
                  {LETTERS.map((letter) => {
                    const isSelected = selected.has(letter);
                    const isCorrectAnswer = candidates.includes(letter);
                    const classNames = ['answer-btn'];
                    if (elimSubmitted) {
                      if (isCorrectAnswer) classNames.push('correct');
                      else if (isSelected) classNames.push('wrong');
                    } else if (isSelected) {
                      classNames.push('selected');
                    }
                    return (
                      <button
                        key={letter}
                        className={classNames.join(' ')}
                        onClick={() => toggleLetter(letter)}
                        disabled={elimSubmitted}
                      >
                        <span className="answer-letter">{letter}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="answer-hint">Tap every letter you believe is still a valid candidate, then submit.</p>
              </div>

              {elimSubmitted ? (
                <div className={`review-feedback-banner ${selected.size === candidates.length && candidates.every((l) => selected.has(l)) ? 'feedback-correct' : 'feedback-wrong'}`}>
                  <div className="feedback-text">
                    Remaining candidates were: <strong>{candidates.join(', ')}</strong>
                  </div>
                </div>
              ) : null}

              <div className="review-practice-controls">
                {!elimSubmitted ? (
                  <button className="btn primary review-action-btn" onClick={submitElimination} disabled={selected.size === 0}>
                    Submit
                  </button>
                ) : (
                  <button className="btn primary review-action-btn" onClick={() => startElimination(difficulty)}>
                    <Icon.Refresh /> Next
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Classify drill ──────────────────────────────────────────
  const correctKey = puzzle ? tagToClassifyKey(puzzle.patternTag) : null;
  return (
    <div className="wrap review-page-container">
      <div className="review-top-bar">
        <button className="review-nav-btn review-dashboard-btn" onClick={() => setMode(null)}>
          <Icon.ArrowLeft />
          <span>Back to Skill Drills</span>
        </button>
        <div className="review-summary-pills">
          <span className="summary-pill">Score: {score.correct}/{score.total}{accuracy != null ? ` (${accuracy}%)` : ''}</span>
          <span className={`tier-tag tier-${difficulty}`}>{TIER_LABEL[difficulty]}</span>
        </div>
      </div>

      <div className="session-option-group" style={{ marginBottom: 12 }}>
        <div className="session-option-label">Difficulty</div>
        <div className="session-option-row">
          {TIERS.map((d) => (
            <button
              key={d}
              className={`session-option-btn${difficulty === d ? ' active' : ''}`}
              onClick={() => { setDifficulty(d); startClassify(d); }}
            >
              {TIER_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="review-practice-card">
        <div className="review-practice-header">
          <h2 className="review-practice-title">What structure is this puzzle?</h2>
          <p className="review-practice-sub">
            Before solving, classify the puzzle's structure. This trains fast recognition —
            knowing your approach before you start eliminating.
          </p>
        </div>

        {loading || !puzzle ? (
          <div className="review-practice-loading">
            <div className="practice-spinner" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="review-board-area">
            <Grid cols={puzzle.cols} cells={puzzle.cells} target={puzzle.target} answered={false} allLetters={null} />

            <div className="review-practice-controls" style={{ flexWrap: 'wrap' }}>
              {CLASSIFY_OPTIONS.map((opt) => {
                const classNames = ['session-option-btn'];
                if (classifyPicked) {
                  if (opt.key === correctKey) classNames.push('active');
                } else if (classifyPicked === opt.key) {
                  classNames.push('active');
                }
                return (
                  <button
                    key={opt.key}
                    className={classNames.join(' ')}
                    onClick={() => pickClassify(opt.key)}
                    disabled={!!classifyPicked}
                    style={{ minWidth: 140 }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {classifyPicked && (
              <div className={`review-feedback-banner ${classifyPicked === correctKey ? 'feedback-correct' : 'feedback-wrong'}`}>
                <div className="feedback-text">
                  This was <strong>{puzzle.patternTag.replace(/-/g, ' ')}</strong> ({puzzle.rounds} deduction round{puzzle.rounds === 1 ? '' : 's'}).
                </div>
              </div>
            )}

            {classifyPicked && (
              <div className="review-practice-controls">
                <button className="btn primary review-action-btn" onClick={() => startClassify(difficulty)}>
                  <Icon.Refresh /> Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}