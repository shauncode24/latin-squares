import { useState } from 'react';
import { TIERS } from '../lib/constants';

export default function SessionSetupModal({ onStart, onClose }) {
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