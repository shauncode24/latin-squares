import { useEffect, useState } from 'react';
import Grid from './Grid';
import { Icon } from './icons';
import { TIERS, TIER_LABEL } from '../lib/constants';

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
    id: 0,
    tabLabel: '1. Direct Elimination',
    difficulty: 'low',
    title: 'Direct Row & Column Elimination',
    badge: 'Low Difficulty',
    summary:
      'Every row and column in a 5×5 Latin Square must contain all five letters (A, B, C, D, E) exactly once. When a target cell’s row and column already show four distinct letters, the missing fifth letter is forced to be the answer.',
    target: { row: 2, col: 2 },
    targetColName: 'γ',
    targetRowName: '3',
    reveal: [[2, 0], [2, 1], [2, 3], [2, 4], [0, 2], [1, 2], [3, 2], [4, 2]],
    pivot: [],
    analysis: {
      rowLetters: ['C', 'D', 'A', 'B'],
      colLetters: ['C', 'D', 'A', 'B'],
      ruledOut: ['A', 'B', 'C', 'D'],
      answer: 'E',
      steps: [
        'Scan Row 3: contains C, D, A, B.',
        'Scan Column γ: contains C, D, A, B.',
        'Combine unique letters in both: {A, B, C, D}.',
        'Only E remains — Target is forced to be E.',
      ],
    },
  },
  {
    id: 1,
    tabLabel: '2. Finding a Pivot',
    difficulty: 'medium',
    title: 'Using an Intersecting Pivot Cell',
    badge: 'Medium Difficulty',
    summary:
      'When the target’s row and column alone leave 2 or more candidate letters, look for a nearby unsolved cell in the same row or column (a "pivot") that can be solved directly. Solving the pivot eliminates another letter from the target.',
    target: { row: 1, col: 3 },
    targetColName: 'δ',
    targetRowName: '2',
    reveal: [[1, 0], [1, 1], [0, 3], [2, 3], [3, 3], [1, 4]],
    pivot: [[1, 1]],
    analysis: {
      rowLetters: ['B', 'C', 'A'],
      colLetters: ['D', 'E', 'A'],
      ruledOut: ['A', 'B', 'C', 'D', 'E (via pivot)'],
      answer: 'E',
      steps: [
        'Check Target (Row 2, Col δ): Row has {B, C, A}, Col has {D, E, A}. Candidates remain: {E}.',
        'Pivot at (Row 2, Col β) shares Row 2. Its own column reveals {B, C, D, E}.',
        'Solving the pivot eliminates another letter from Row 2.',
        'With candidates eliminated, Target is locked in.',
      ],
    },
  },
  {
    id: 2,
    tabLabel: '3. Chaining Pivots',
    difficulty: 'high',
    title: 'Multi-Step Pivot Chains',
    badge: 'High Difficulty',
    summary:
      'On High-tier grids, solving the target requires a chain of deductions: Pivot 1 unlocks Pivot 2, which then forces the target cell. Work outward one cell at a time — never guess.',
    target: { row: 0, col: 4 },
    targetColName: 'ε',
    targetRowName: '1',
    reveal: [[0, 0], [1, 4], [2, 4], [0, 1], [0, 2]],
    pivot: [[1, 4], [0, 3]],
    analysis: {
      rowLetters: ['A', 'B', 'C'],
      colLetters: ['A', 'B', 'C'],
      ruledOut: ['A', 'B', 'C', 'D (via chain)'],
      answer: 'E',
      steps: [
        'Target (Row 1, Col ε) cannot be solved directly — too few visible cells.',
        'Locate Pivot 1 at (Row 2, Col ε) — solved by its own row and column.',
        'Use Pivot 1 to solve Pivot 2 at (Row 1, Col δ).',
        'Now Row 1 contains {A, B, C, D}, forcing Target to be E.',
      ],
    },
  },
];

export default function LearnMode({ onClose, onStartPractice, onStartGuided }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const cells = maskExcept(s.reveal);
  const isLast = step === STEPS.length - 1;

  // Keyboard navigation: Left/Right arrows to change step, Escape to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) {
        setStep((v) => v + 1);
      } else if (e.key === 'ArrowLeft' && step > 0) {
        setStep((v) => v - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, onClose]);

  return (
    <div className="wrap review-page-container">
      {/* Top Header Bar */}
      <div className="review-top-bar">
        <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <div className="review-summary-pills">
          <span className="summary-pill low">1. Direct</span>
          <span className="summary-pill medium">2. Single Pivot</span>
          <span className="summary-pill high">3. Chain Pivot</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="learn-hero-card">
        <div>
          <h1 className="review-hero-title">How to Solve Latin Squares</h1>
          <p className="review-hero-sub">
            Master the systematic elimination methods tested on the dMAT exam.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="learn-step-tabs">
          {STEPS.map((st, i) => (
            <button
              key={st.id}
              className={`learn-step-tab ${i === step ? 'active' : ''}`}
              onClick={() => setStep(i)}
            >
              <span className={`learn-tab-badge tier-${st.difficulty}`}>{TIER_LABEL[st.difficulty]}</span>
              <span className="learn-tab-title">{st.tabLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Tutorial Layout */}
      <div className="learn-content-grid">
        {/* Left Column: Logic Breakdown */}
        <div className="learn-logic-card">
          <div className="learn-card-header">
            <span className={`tier-tag tier-${s.difficulty}`}>{s.badge}</span>
            <h2 className="learn-step-heading">{s.title}</h2>
          </div>

          <p className="learn-step-summary">{s.summary}</p>

          {/* Step-by-Step Walkthrough Box */}
          <div className="learn-breakdown-box">
            <div className="breakdown-box-title">
              <Icon.Target />
              <span>Step-by-Step Logic Walkthrough</span>
            </div>
            <ol className="breakdown-steps-list">
              {s.analysis.steps.map((stText, idx) => (
                <li key={idx} className="breakdown-step-item">
                  <span className="step-num">{idx + 1}</span>
                  <span className="step-text">{stText}</span>
                </li>
              ))}
            </ol>

            <div className="breakdown-result-row">
              <span className="result-label">Deduction Result:</span>
              <span className="result-target-pill">Target ({s.targetRowName}, {s.targetColName}) = <strong>{s.analysis.answer}</strong></span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="learn-nav-controls">
            <button
              className="btn learn-btn-prev"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
            >
              <Icon.ArrowLeft /> Previous Technique
            </button>

            {isLast ? (
              <button className="btn primary learn-btn-next" onClick={onStartPractice || onClose}>
                Start Practicing →
              </button>
            ) : (
              <button className="btn primary learn-btn-next" onClick={() => setStep((v) => v + 1)}>
                Next Technique →
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Visual Board Display */}
        <div className="learn-board-card">
          <div className="learn-board-header">
            <span className="board-header-title">Interactive Visualizer</span>
            <span className="board-coords-hint">Target at Row {s.targetRowName}, Col {s.targetColName}</span>
          </div>

          <div className="learn-grid-wrapper">
            <Grid
              cols={COLS}
              cells={cells}
              target={s.target}
              pivotCells={s.pivot}
              answered={false}
              allLetters={ALL_LETTERS}
            />
          </div>

          {/* Board Legend */}
          <div className="learn-board-legend">
            <div className="legend-item">
              <span className="legend-icon-target" />
              <span>Target Cell (?)</span>
            </div>
            {s.pivot.length > 0 && (
              <div className="legend-item">
                <span className="legend-icon-pivot" />
                <span>Pivot Cell ({s.pivot.length})</span>
              </div>
            )}
            <div className="legend-item">
              <span className="legend-icon-filled" />
              <span>Revealed Letter</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Practice CTA */}
      <div className="learn-cta-card">
        <div className="learn-cta-content">
          <div className="cta-icon-box">
            <Icon.Lightbulb />
          </div>
          <div>
            <h3>Ready to put this into practice?</h3>
            <p>Try step-by-step guided practice with hints, or jump straight into timed drills.</p>
          </div>
        </div>
        <div className="learn-cta-buttons">
          {onStartGuided && (
            <button className="btn learn-cta-secondary" onClick={onStartGuided}>
              Try Guided Practice
            </button>
          )}
          {onStartPractice && (
            <button className="btn primary learn-cta-primary" onClick={onStartPractice}>
              Start Practice Drill →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}