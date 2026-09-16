import { useState, useEffect } from 'react';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';
import { TIERS, TIER_LABEL, TIER_DESC, TIER_TARGET_LABEL } from '../lib/constants';
import { pivotLabel } from '../lib/format';

const PIVOT_BANDS = [
  { key: 'any', label: 'Any', targetPivotDistance: null },
  { key: 'near', label: 'Near', targetPivotDistance: 1 },
  { key: 'far', label: 'Distant', targetPivotDistance: 4 },
];

const TIER_SHORT_TAGS = {
  low: 'Direct read',
  medium: '1 pivot',
  high: '2–3 pivots',
};

// Soft, non-blocking nudge — never disables a tier, just informs.
function tierRecommendationNote(tier, mastery) {
  if (!mastery) return null;
  if (tier === 'medium' && mastery.low === 'learning') {
    return 'Still building Low — Medium is available, but Low accuracy usually pays off first.';
  }
  if (tier === 'high' && (mastery.medium === 'learning' || mastery.low === 'learning')) {
    return 'High requires chaining 2-3 deductions — comfortable Medium performance usually makes this much easier.';
  }
  return null;
}

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
  mastery,          // stats.mastery, optional
  pivotBand,        // current pivot band key
  onChangePivotBand,// (bandKey) => void
  effectiveTargetMs,// adaptive target override, optional
  isPersonalized,   // whether effectiveTargetMs came from personal data
}) {
  const [showTierGuide, setShowTierGuide] = useState(false);

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

  const targetMs = effectiveTargetMs || 10000;
  const targetLabel = effectiveTargetMs
    ? `${Math.round(effectiveTargetMs / 1000)}s${isPersonalized ? ' (personal)' : ''}`
    : TIER_TARGET_LABEL[tier];

  const elapsedSec = elapsed / 1000;
  const targetSec = targetMs / 1000;
  const deltaSec = elapsedSec - targetSec;

  return (
    <div className="drill-container">
      {/* ─── Left Panel: Streamlined Difficulty & Pivot Selection ─── */}
      <aside className="drill-sidebar-left">
        <div className="tiers-header">
          <span className="tiers-header-title">Difficulty</span>
          <button
            className={`tier-guide-toggle-btn${showTierGuide ? ' is-active' : ''}`}
            onClick={() => setShowTierGuide((v) => !v)}
            title={showTierGuide ? 'Hide difficulty descriptions' : 'Show difficulty guide'}
          >
            <Icon.Info />
          </button>
        </div>

        <div className="tiers-compact-list">
          {TIERS.map((t) => {
            const note = tierRecommendationNote(t, mastery);
            const isActive = t === tier;
            return (
              <button
                key={t}
                className={`tier-card-compact${isActive ? ' active' : ''}`}
                onClick={() => onChangeTier(t)}
                title={note || TIER_DESC[t]}
              >
                <div className="tier-card-head">
                  <span className="tier-card-title">{TIER_LABEL[t]}</span>
                  <span className="tier-card-tag">{TIER_SHORT_TAGS[t]}</span>
                  {note && <span className="tier-warning-badge" title={note}>⚠</span>}
                </div>
                {showTierGuide && (
                  <div className="tier-card-desc-collapsible">
                    <p className="tier-card-desc">{TIER_DESC[t]}</p>
                    {note && t !== tier && (
                      <div className="tier-note-text">{note}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {tier !== 'low' && onChangePivotBand && (
          <div className="session-option-group compact-pivot-group">
            <div className="session-option-label">Pivot range</div>
            <div className="session-option-row">
              {PIVOT_BANDS.map((b) => (
                <button
                  key={b.key}
                  className={`session-option-btn${pivotBand === b.key ? ' active' : ''}`}
                  onClick={() => onChangePivotBand(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ─── Center Hero: Status Bar, Grid & Answer Pad ─── */}
      <main className="drill-center">
        <div className="status-row-enhanced">
          <div className="status-meta">
            <span className="status-pattern-chip">
              <span className={`tier-badge-chip tier-${tier}`}>{TIER_LABEL[tier]}</span>
              <span className="pattern-name">
                {puzzle && puzzle.rounds > 0
                  ? `${(puzzle.patternTag || '').replace(/-/g, ' ')} · ${pivotLabel(puzzle.pivotDistance)}`
                  : 'Direct read'}
              </span>
            </span>
          </div>

          <div className="status-timing-block">
            <label className="untimed-toggle-label">
              <input type="checkbox" checked={!!untimed} onChange={onToggleUntimed} />
              <span>Untimed</span>
            </label>

            {!untimed && (
              <div className="timing-cluster">
                <div className="timing-target-chip">
                  <span className="timing-target-label">Target</span>
                  <span className="timing-target-val">{targetLabel}</span>
                </div>
                <div className={`timing-live-chip${overTime ? ' is-over' : ''}`}>
                  <span className="timing-live-val">{elapsedSec.toFixed(1)}s</span>
                  {overTime && (
                    <span className="timing-delta-badge">+{deltaSec.toFixed(1)}s</span>
                  )}
                </div>
              </div>
            )}
          </div>
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
          <Grid
            cols={puzzle?.cols}
            cells={puzzle?.cells}
            target={puzzle?.target}
            pivotCells={pivotCells}
            revealedLetter={correctLetter}
            answered={answered}
            allLetters={puzzle?.allLetters}
          />
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

        {answered && explanation && explanation.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', background: '#fafafa', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <strong style={{ color: 'var(--ink)', fontSize: 12 }}>How to solve it:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {explanation.map((step, i) => <li key={i} style={{ marginBottom: 3 }}>{step}</li>)}
            </ol>
          </div>
        )}
      </main>

      {/* ─── Right Sidebar: Structured Actions Hierarchy ─── */}
      <aside className="drill-sidebar-right">
        <div className="controls-header">
          <span className="controls-header-title">Actions</span>
        </div>

        <div className="controls-structured">
          {/* Primary Action */}
          <div className="control-section primary-section">
            {answered ? (
              <button className="btn primary btn-next-grid" onClick={onNewGrid} disabled={loading}>
                <Icon.Refresh />
                <span>Next Grid</span>
                <span className="kbd-shortcut-pill">↵ Enter</span>
              </button>
            ) : (
              <button className="btn btn-hint-prominent" onClick={onHint} disabled={!puzzle || loading}>
                <Icon.Bulb />
                <span>Hint</span>
              </button>
            )}
          </div>

          {/* Secondary Actions: Learning & Review */}
          <div className="control-section secondary-section">
            <button className="btn btn-subtle-action" onClick={onLearn}>
              <Icon.Book />
              <span>How to Solve</span>
            </button>
            {answered && (
              <button
                className="btn btn-subtle-action"
                onClick={onReview}
                disabled={loading || isGuest}
                title={isGuest ? 'Sign in to review missed puzzles' : ''}
              >
                <Icon.History />
                <span>Review Misses</span>
              </button>
            )}
          </div>

          {/* Tertiary / Escape Actions (only active when solving) */}
          {!answered && (
            <div className="control-section escape-section">
              <button className="btn btn-ghost-action" onClick={onNewGrid} disabled={loading}>
                <Icon.Refresh />
                <span>Skip Grid</span>
              </button>
              <button className="btn btn-ghost-action btn-reveal-text" onClick={onReveal} disabled={!puzzle || loading}>
                <Icon.Eye />
                <span>Reveal Answer</span>
              </button>
            </div>
          )}
        </div>

        <p className="controls-caption">
          {answered
            ? 'Press Enter (↵) to load next puzzle.'
            : 'Hint marks attempt assisted. Reveal unveils without grading.'}
        </p>
      </aside>
    </div>
  );
}