import { useEffect } from 'react';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';
import { TIERS, TIER_LABEL, TIER_DESC, TIER_TARGET_LABEL } from '../lib/constants';
import { pivotLabel } from '../lib/format';

export default function NormalPractice({
  tier,
  onChangeTier,
  elapsed,
  overTime,
  error,
  weaknessConfig,
  onExitWeakness,
  isGuest,
  onSignIn,
  puzzle,
  loading,
  pivotCells,
  correctLetter,
  answered,
  selected,
  onSelectAnswer,
  feedback,
  onHint,
  onReveal,
  onReview,
  onLearn,
  onNewGrid,
  untimed,
  onToggleUntimed,
  explanation,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        if (!loading && (answered || puzzle)) {
          e.preventDefault();
          onNewGrid();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, answered, puzzle, onNewGrid]);

  return (
    <div className="drill-container">
      <aside className="drill-sidebar-left">
        <div className="tiers">
          {TIERS.map((t) => (
            <button
              key={t}
              className={`tier-card${t === tier ? ' active' : ''}`}
              onClick={() => onChangeTier(t)}
            >
              <div className="tier-card-title">{TIER_LABEL[t]}</div>
              <div className="tier-card-desc">{TIER_DESC[t]}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="drill-center">
        <div className="status-row">
          <span>Target: {TIER_TARGET_LABEL[tier]}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={!!untimed} onChange={onToggleUntimed} />
              Untimed
            </label>
            {!untimed && (
              <span className={`time${overTime ? ' over' : ''}`}>{(elapsed / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* Pivot-distance & pattern info */}
        {puzzle && puzzle.rounds > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
              {(puzzle.patternTag || '').replace(/-/g, ' ')} · {pivotLabel(puzzle.pivotDistance)}
            </span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {weaknessConfig && (
          <div className="guest-banner">
            🎯 Weakness Mode — {weaknessConfig.difficulty} / rounds {weaknessConfig.rounds}
            {' '}<button className="btn-link" onClick={onExitWeakness}>Exit</button>
          </div>
        )}

        {isGuest && (
          <div className="guest-banner">
            🎮 Guest mode — <button className="btn-link" onClick={onSignIn}>Sign in</button> to save your scores
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
          onSelect={onSelectAnswer}
          disabled={answered || loading || !puzzle}
          selected={selected}
          correctLetter={correctLetter}
        />

        <div className={`feedback${feedback.startsWith('Correct') ? ' correct-text' : ''}${feedback.startsWith('Not quite') ? ' wrong-text' : ''}`}>
          {feedback || '\u00a0'}
        </div>

        {/* Deterministic step-by-step walkthrough after a wrong answer */}
        {answered && explanation && explanation.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', background: '#fafafa', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <strong style={{ color: 'var(--ink)', fontSize: 12 }}>How to solve it:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {explanation.map((step, i) => <li key={i} style={{ marginBottom: 3 }}>{step}</li>)}
            </ol>
          </div>
        )}
      </main>

      <aside className="drill-sidebar-right">
        <div className="controls">
          <button className="btn" onClick={onHint} disabled={!puzzle || loading}>
            <Icon.Bulb /> Hint
          </button>
          <button className="btn" onClick={onReveal} disabled={answered || !puzzle || loading}>
            <Icon.Eye /> Reveal
          </button>
          <button className="btn" onClick={onReview} disabled={loading || isGuest} title={isGuest ? 'Sign in to review missed puzzles' : ''}>
            <Icon.History /> Review
          </button>
          <button className="btn" onClick={onLearn}>
            <Icon.Book /> How to Solve
          </button>
          <button className="btn primary" onClick={onNewGrid} disabled={loading}>
            <Icon.Refresh /> New grid
          </button>
        </div>

        <p className="controls-caption">Hint marks the attempt as hint-assisted. Reveal shows the answer without grading it.</p>
      </aside>
    </div>
  );
}