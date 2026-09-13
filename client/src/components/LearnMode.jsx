import { useState } from 'react';
import Grid from './Grid';

const COLS = ['α', 'β', 'γ', 'δ', 'ε'];

const ALL_LETTERS = [
  ['A', 'B', 'C', 'D', 'E'],
  ['B', 'C', 'D', 'E', 'A'],
  ['C', 'D', 'E', 'A', 'B'],
  ['D', 'E', 'A', 'B', 'C'],
  ['E', 'A', 'B', 'C', 'D'],
];

function maskExcept(reveal) {
  return ALL_LETTERS.map((row, r) =>
    row.map((v, c) => (reveal.some(([rr, cc]) => rr === r && cc === c) ? v : null))
  );
}

const STEPS = [
  {
    title: 'Reading directly',
    body: 'The target sits at row 3, column γ. List every letter already filled in that row and that column — together they rule out candidates until only one letter is left.',
    target: { row: 2, col: 2 },
    reveal: [[2, 0], [2, 1], [2, 3], [2, 4], [0, 2], [1, 2], [3, 2], [4, 2]],
    pivot: [],
  },
  {
    title: 'Finding a pivot',
    body: "Sometimes the target row and column alone leave two possible letters. Look for a nearby cell — the pivot — whose own row and column already narrow it to one letter. Solve that first, then re-check the target.",
    target: { row: 1, col: 3 },
    reveal: [[1, 0], [1, 1], [0, 3], [2, 3], [3, 3], [1, 4]],
    pivot: [[1, 1]],
  },
  {
    title: 'Chaining pivots',
    body: 'On High-difficulty puzzles, one pivot forces a second pivot, which then forces the target. Work outward one solved cell at a time — never skip ahead or guess.',
    target: { row: 0, col: 4 },
    reveal: [[0, 0], [1, 4], [2, 4]],
    pivot: [[1, 4]],
  },
];

export default function LearnMode({ onClose }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const cells = maskExcept(s.reveal);
  const isLast = step === STEPS.length - 1;

  return (
    <div className="learn-wrap">
      <div className="review-header">
        <h2>How to Solve</h2>
        <button className="btn-link" onClick={onClose}>× Close</button>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{s.title}</h3>
      <p className="learn-body">{s.body}</p>
      <div className="board">
        <Grid
          cols={COLS}
          cells={cells}
          target={s.target}
          pivotCells={s.pivot}
          answered={false}
          allLetters={ALL_LETTERS}
        />
      </div>
      <div className="onboarding-dots">
        {STEPS.map((_, i) => (
          <span key={i} className={`onboarding-dot${i === step ? ' active' : ''}`} />
        ))}
      </div>
      <div className="controls">
        <button className="btn" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>
          ← Back
        </button>
        {isLast ? (
          <button className="btn primary" onClick={onClose}>Done</button>
        ) : (
          <button className="btn primary" onClick={() => setStep((v) => v + 1)}>Next →</button>
        )}
      </div>
    </div>
  );
}