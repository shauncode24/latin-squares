import { useState } from 'react';

const STEPS = [
  {
    icon: '?',
    title: 'The Target Cell',
    body: 'Each puzzle has one blank cell marked with a "?". Your job is to find the correct letter for that cell using only the rows and columns of the grid.',
  },
  {
    icon: 'αβγ',
    title: 'Greek Column Labels',
    body: 'The columns are labelled α, β, γ, δ, ε (alpha through epsilon). Each letter A–E appears exactly once in every row and every column — just like a Sudoku, but simpler.',
  },
  {
    icon: '★',
    title: 'Difficulty Tiers',
    body: 'Low: the answer is readable directly from the target row and column.\nMedium: one helper cell must be solved first.\nHigh: a chain of two or three deductions is required.',
  },
];

export default function Onboarding({ onDismiss }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      localStorage.setItem('dmat_onboarded', '1');
      onDismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  const s = STEPS[step];
  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="onboarding-card">
        <div className="onboarding-icon">{s.icon}</div>
        <h2 className="onboarding-title">{s.title}</h2>
        <p className="onboarding-body">{s.body}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>
        <button className="onboarding-btn" onClick={next}>
          {isLast ? 'Got it — start playing' : 'Next'}
        </button>
        <button className="onboarding-skip" onClick={() => { localStorage.setItem('dmat_onboarded', '1'); onDismiss(); }}>
          Skip intro
        </button>
      </div>
    </div>
  );
}