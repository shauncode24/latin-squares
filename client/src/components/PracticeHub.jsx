import { useState } from 'react';
import { Icon } from './icons';
import { TIERS } from '../lib/constants';
import DueReviews from './DueReviews';

export default function PracticeHub({ user, onStartSession, onStartSimulation, onReview, onLearn, onAuth, onGuided, onRapidFire }) {
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
                Strict 25-minute test conditions with 25 mixed puzzles matching real test distribution. Skip and flag questions to return to later, just like the real exam.
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

        {/* Card 3: Guided Practice — NEW */}
        <div className="hub-card">
          <div className="hub-card-header">
            <div className="hub-card-icon"><Icon.Lightbulb /></div>
            <div>
              <h3 className="hub-card-title">Guided Practice</h3>
              <p className="hub-card-desc">
                Untimed. Reveal the deduction chain one step at a time before you commit to an answer — a bridge between watching and solving alone.
              </p>
            </div>
          </div>
          <div className="hub-card-footer">
            <button className="btn primary" style={{ width: '100%' }} onClick={onGuided}>
              Start Guided Practice →
            </button>
          </div>
        </div>

        {/* Card 4: Rapid-Fire Drill — NEW */}
        <div className="hub-card">
          <div className="hub-card-header">
            <div className="hub-card-icon"><Icon.Zap /></div>
            <div>
              <h3 className="hub-card-title">Rapid-Fire Drill</h3>
              <p className="hub-card-desc">
                No hints, no review, no "Next" click. Puzzles chain back-to-back for a fixed window — pure automaticity training.
              </p>
            </div>
          </div>
          <div className="hub-card-footer">
            <button className="btn primary" style={{ width: '100%' }} onClick={onRapidFire}>
              Start Drill →
            </button>
          </div>
        </div>

        {/* Card 5: Review & Learn */}
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