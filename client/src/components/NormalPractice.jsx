import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';
import { TIERS, TIER_LABEL, TIER_DESC, TIER_TARGET_LABEL } from '../lib/constants';

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
}) {
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
          <span className={`time${overTime ? ' over' : ''}`}>{(elapsed / 1000).toFixed(1)}s</span>
        </div>

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