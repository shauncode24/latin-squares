import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';
import { TIER_LABEL, TIER_TARGET_MS } from '../lib/constants';
import { explainPuzzle } from '../lib/explainer';
import Grid from './Grid';
import AnswerPad from './AnswerPad';
import { Icon } from './icons';

const QUALITY_LABEL = {
  clean: 'Clean',
  hinted: 'Hinted',
  revealed: 'Revealed',
  guessed: 'Guessed',
  rushed: 'Rushed',
};

const PAGE_SIZE = 8;

function formatPattern(patternTag) {
  if (!patternTag || patternTag === 'direct') return 'Direct Read';
  if (patternTag === 'single-pivot-cross') return 'Single Pivot Cross';
  if (patternTag === 'single-pivot-aligned') return 'Single Pivot Aligned';
  if (patternTag === 'chain-2') return 'Two-Pivot Chain';
  if (patternTag === 'chain-3') return 'Three-Pivot Chain';
  return patternTag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDiagnosis(item, targetMs) {
  const targetSec = Math.round(targetMs / 1000) + 's';
  const timeSec = (item.elapsedMs / 1000).toFixed(1) + 's';

  if (item.solveQuality === 'revealed') {
    return {
      title: 'Solution Revealed',
      text: `Target (${item.correctLetter}) was revealed before submitting. Trace the step-by-step logic below and try a similar puzzle to master the deduction.`,
      type: 'revealed',
    };
  }

  if (item.solveQuality === 'rushed' || (!item.correct && item.elapsedMs < targetMs * 0.4)) {
    return {
      title: 'Rushed Selection',
      text: `Answered in ${timeSec} (Target: ${targetSec}) before completely checking row and column candidates. Taking an extra 2-3s to verify eliminates simple slips.`,
      type: 'rushed',
    };
  }

  if (item.hintUsed && item.hintRequestedAtMs && item.hintRequestedAtMs < 4000) {
    return {
      title: 'Early Hint Dependency',
      text: `Hint requested within ${(item.hintRequestedAtMs / 1000).toFixed(1)}s. Try scanning the target's intersecting lines and neighbor cells first before asking for help.`,
      type: 'hinted',
    };
  }

  if (item.patternTag === 'direct' && !item.correct) {
    return {
      title: 'Direct Elimination Slip',
      text: `Missed an existing letter in the target row or column. Verify the full set of 4 seen letters before locking in your choice.`,
      type: 'wrong',
    };
  }

  if ((item.patternTag?.includes('pivot') || item.rounds >= 1) && !item.correct) {
    return {
      title: 'Pivot Deduction Overlooked',
      text: `The target could not be solved in one step. An intermediate pivot cell had to be resolved first to unlock the target.`,
      type: 'wrong',
    };
  }

  if (item.elapsedMs > targetMs * 1.5) {
    return {
      title: 'Time Bottleneck',
      text: `Took ${timeSec} vs ${targetSec} target. The deduction was tricky; targeted repetition helps you spot the critical pivot faster.`,
      type: 'overtime',
    };
  }

  if (!item.correct) {
    return {
      title: 'Elimination Gap',
      text: `Selected ${item.selectedLetter || 'an incorrect letter'} instead of ${item.correctLetter}. Inspect the solved board below to trace the exact logical path.`,
      type: 'wrong',
    };
  }

  return {
    title: 'Technique Calibration',
    text: `Attempt required assistance or exceeded target pacing. Practice similar patterns to build speed and accuracy.`,
    type: 'neutral',
  };
}

export default function ReviewMode({ onClose }) {
  const [missed, setMissed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [diffFilter, setDiffFilter] = useState('all'); // 'all' | 'low' | 'medium' | 'high'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'wrong' | 'hinted' | 'revealed'
  const [expandedSnapshots, setExpandedSnapshots] = useState({});

  // Retry / Practice Similar State
  const [retryItem, setRetryItem] = useState(null);
  const [retryPuzzle, setRetryPuzzle] = useState(null);
  const [retryAnswer, setRetryAnswer] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);

  useEffect(() => {
    api.getMissed()
      .then((data) => setMissed(data.missed || []))
      .catch(() => setMissed([]))
      .finally(() => setLoading(false));
  }, []);

  const startRetry = useCallback(async (item) => {
    setRetryItem(item);
    setRetryPuzzle(null);
    setRetryAnswer(null);
    setRetryLoading(true);
    try {
      const data = await api.generateSimilar(item.rounds, item.pivotDistance, item.difficulty);
      setRetryPuzzle(data);
    } catch (e) {
      console.error('Failed to generate similar puzzle', e);
    } finally {
      setRetryLoading(false);
    }
  }, []);

  async function handleRetrySelect(letter) {
    if (!retryPuzzle || retryAnswer) return;
    try {
      const res = await api.submitAnswer(retryPuzzle.puzzleId, letter, 0, false, null);
      setRetryAnswer({ letter, correctLetter: res.correctLetter, correct: res.correct });
    } catch (e) {
      console.error('Failed to submit retry answer', e);
    }
  }

  // Handle keyboard shortcuts (Escape to go back, Enter to get another similar one)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (retryItem) {
          setRetryItem(null);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && retryAnswer && retryItem) {
        startRetry(retryItem);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [retryItem, retryAnswer, onClose, startRetry]);

  function toggleSnapshot(id) {
    setExpandedSnapshots((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // ─── Render: Retry / Practice Similar View ──────────────────────────────
  if (retryItem) {
    return (
      <div className="wrap review-page-container">
        {/* Top Navigation */}
        <div className="review-top-bar">
          <button className="review-nav-btn" onClick={() => setRetryItem(null)}>
            <Icon.ArrowLeft />
            <span>Back to Missed List</span>
          </button>
          <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
            Back to Dashboard
          </button>
        </div>

        {/* Retry Practice Card */}
        <div className="review-practice-card">
          <div className="review-practice-header">
            <div>
              <div className="review-practice-badge-row">
                <span className={`tier-tag tier-${retryItem.difficulty}`}>
                  {TIER_LABEL[retryItem.difficulty] || retryItem.difficulty}
                </span>
                <span className="review-pattern-chip">
                  {formatPattern(retryItem.patternTag)}
                </span>
                <span className="review-pattern-chip">
                  {retryItem.rounds} {retryItem.rounds === 1 ? 'Round' : 'Rounds'} · Pivot Dist: {retryItem.pivotDistance}
                </span>
              </div>
              <h2 className="review-practice-title">Targeted Practice</h2>
              <p className="review-practice-sub">
                Solving a freshly generated puzzle with identical logical depth and pivot constraints.
              </p>
            </div>
          </div>

          {retryLoading || !retryPuzzle ? (
            <div className="review-practice-loading">
              <div className="practice-spinner" />
              <span>Generating targeted puzzle...</span>
            </div>
          ) : (
            <div className="review-board-area">
              <Grid
                cols={retryPuzzle.cols}
                cells={retryPuzzle.cells}
                target={retryPuzzle.target}
                pivotCells={retryAnswer ? (retryPuzzle.path?.[0] || []) : []}
                revealedLetter={retryAnswer?.correctLetter}
                answered={!!retryAnswer}
                allLetters={retryPuzzle.allLetters}
              />

              <div className="review-answerpad-wrap">
                <AnswerPad
                  onSelect={handleRetrySelect}
                  disabled={!!retryAnswer}
                  selected={retryAnswer?.letter}
                  correctLetter={retryAnswer?.correctLetter}
                />
              </div>

              {retryAnswer && (
                <div className={`review-feedback-banner ${retryAnswer.correct ? 'feedback-correct' : 'feedback-wrong'}`}>
                  {retryAnswer.correct ? (
                    <>
                      <span className="feedback-icon"><Icon.CheckCircle /></span>
                      <div className="feedback-text">
                        <strong>Spot on!</strong> Clean solution for this pattern.
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="feedback-icon"><Icon.Cross /></span>
                      <div className="feedback-text">
                        <strong>Incorrect.</strong> The correct target letter is <strong>{retryAnswer.correctLetter}</strong>.
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="review-practice-controls">
                {retryAnswer && (
                  <button className="btn primary review-action-btn" onClick={() => startRetry(retryItem)}>
                    <Icon.Refresh /> Another Similar One (Enter)
                  </button>
                )}
                <button className="btn review-action-btn-secondary" onClick={() => setRetryItem(null)}>
                  Done with this pattern
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="wrap review-page-container">
        <div className="review-top-bar">
          <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
            <Icon.ArrowLeft />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <div className="review-loading-state">
          <div className="practice-spinner" />
          <span>Loading your missed puzzles...</span>
        </div>
      </div>
    );
  }

  // ─── Filter Logic ────────────────────────────────────────────────────────
  const allMissed = missed || [];
  const lowCount = allMissed.filter(m => m.difficulty === 'low').length;
  const medCount = allMissed.filter(m => m.difficulty === 'medium').length;
  const highCount = allMissed.filter(m => m.difficulty === 'high').length;

  const filtered = allMissed.filter((item) => {
    if (diffFilter !== 'all' && item.difficulty !== diffFilter) return false;
    if (typeFilter === 'wrong' && item.correct) return false;
    if (typeFilter === 'hinted' && item.solveQuality !== 'hinted') return false;
    if (typeFilter === 'revealed' && item.solveQuality !== 'revealed') return false;
    return true;
  });

  const visible = filtered.slice(0, shown);

  // ─── Main Review List View ──────────────────────────────────────────────
  return (
    <div className="wrap review-page-container">
      {/* Top Header Navigation */}
      <div className="review-top-bar">
        <button className="review-nav-btn review-dashboard-btn" onClick={onClose}>
          <Icon.ArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <div className="review-summary-pills">
          <span className="summary-pill total">Total: {allMissed.length}</span>
          <span className="summary-pill low">Low: {lowCount}</span>
          <span className="summary-pill medium">Med: {medCount}</span>
          <span className="summary-pill high">High: {highCount}</span>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="review-hero-card">
        <div className="review-hero-header">
          <div>
            <h1 className="review-hero-title">Review Missed Puzzles</h1>
            <p className="review-hero-sub">
              Analyze previous mistakes and hints, inspect step-by-step logic, and drill targeted variations.
            </p>
          </div>
        </div>

        {/* Filter Controls Row */}
        {allMissed.length > 0 && (
          <div className="review-filters-bar">
            {/* Difficulty filter */}
            <div className="review-filter-group">
              <span className="review-filter-label">Difficulty:</span>
              <div className="review-filter-pills">
                {[
                  { k: 'all', l: `All (${allMissed.length})` },
                  { k: 'low', l: `Low (${lowCount})` },
                  { k: 'medium', l: `Med (${medCount})` },
                  { k: 'high', l: `High (${highCount})` },
                ].map((f) => (
                  <button
                    key={f.k}
                    className={`review-filter-pill ${diffFilter === f.k ? 'active' : ''}`}
                    onClick={() => { setDiffFilter(f.k); setShown(PAGE_SIZE); }}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Issue Type filter */}
            <div className="review-filter-group">
              <span className="review-filter-label">Issue:</span>
              <div className="review-filter-pills">
                {[
                  { k: 'all', l: 'All Issues' },
                  { k: 'wrong', l: 'Wrong Choices' },
                  { k: 'hinted', l: 'Hinted' },
                  { k: 'revealed', l: 'Revealed' },
                ].map((f) => (
                  <button
                    key={f.k}
                    className={`review-filter-pill ${typeFilter === f.k ? 'active' : ''}`}
                    onClick={() => { setTypeFilter(f.k); setShown(PAGE_SIZE); }}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {allMissed.length === 0 ? (
        <div className="review-empty-card">
          <div className="review-empty-icon">
            <Icon.CheckCircle />
          </div>
          <h3>All Caught Up!</h3>
          <p>You have no missed or hinted puzzles logged. Keep practicing to build up your speed and accuracy stats!</p>
          <button className="btn primary review-empty-btn" onClick={onClose}>
            Back to Dashboard
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="review-empty-card">
          <h3>No matching puzzles</h3>
          <p>No missed puzzles match your current filter settings.</p>
          <button className="btn" onClick={() => { setDiffFilter('all'); setTypeFilter('all'); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        /* Missed Cards List */
        <div className="review-cards-list">
          {visible.map((a) => {
            const isWrong = !a.correct;
            const isRevealed = a.solveQuality === 'revealed';
            const isHinted = a.solveQuality === 'hinted' || (a.hintUsed && a.correct);
            const isRushed = a.solveQuality === 'rushed';
            const hasSnapshot = !!(a.puzzleSnapshot && a.puzzleSnapshot.cells && a.puzzleSnapshot.cells.length);
            const isPeekOpen = !!expandedSnapshots[a._id];

            const targetMs = TIER_TARGET_MS[a.difficulty] || 50000;
            const targetSecNum = targetMs / 1000;
            const elapsedSecNum = a.elapsedMs / 1000;
            const deltaSec = elapsedSecNum - targetSecNum;

            let deltaStr = '';
            let deltaClass = 'delta-neutral';
            if (deltaSec > 0) {
              deltaStr = `+${deltaSec.toFixed(1)}s over`;
              deltaClass = 'delta-over';
            } else {
              deltaStr = `${Math.abs(deltaSec).toFixed(1)}s under`;
              deltaClass = 'delta-under';
            }

            // Result text
            let resultText = 'Incorrect';
            let resultClass = 'wrong';
            if (isRevealed) {
              resultText = `Revealed (${a.correctLetter || '?'})`;
              resultClass = 'revealed';
            } else if (isWrong && a.selectedLetter) {
              resultText = `Incorrect (${a.selectedLetter} → ${a.correctLetter})`;
              resultClass = 'wrong';
            } else if (isWrong) {
              resultText = `Incorrect (Expected ${a.correctLetter})`;
              resultClass = 'wrong';
            } else if (isHinted) {
              resultText = `Solved with Hint (${a.correctLetter})`;
              resultClass = 'hinted';
            } else {
              resultText = `Correct (${a.correctLetter})`;
              resultClass = 'correct';
            }

            // Hint text
            let hintText = 'No';
            if (isRevealed) {
              hintText = 'Revealed';
            } else if (a.hintUsed || isHinted) {
              if (a.hintRequestedAtMs) {
                hintText = `Yes (${(a.hintRequestedAtMs / 1000).toFixed(1)}s)`;
              } else {
                hintText = 'Yes';
              }
            }

            const diagnosis = getDiagnosis(a, targetMs);

            // Explanation steps for expanded drawer
            let explanationSteps = [];
            if (hasSnapshot) {
              explanationSteps = explainPuzzle({
                cells: a.puzzleSnapshot.cells,
                allLetters: a.puzzleSnapshot.allLetters,
                target: a.puzzleSnapshot.target,
                path: a.puzzleSnapshot.path,
                cols: a.puzzleSnapshot.cols,
              });
            }

            return (
              <div
                key={a._id}
                className={`review-card-item ${
                  isWrong ? 'status-wrong' : isRevealed ? 'status-revealed' : isHinted ? 'status-hinted' : 'status-clean'
                }`}
              >
                {/* ─── 1. Card Top: Difficulty · Pattern · Round Spec & Badges ─── */}
                <div className="review-card-header">
                  <div className="review-card-title-group">
                    <span className={`tier-tag tier-${a.difficulty}`}>
                      {TIER_LABEL[a.difficulty] || a.difficulty}
                    </span>
                    <span className="review-pattern-title">
                      {formatPattern(a.patternTag)}
                    </span>
                    <span className="review-sub-spec">
                      {a.rounds} {a.rounds === 1 ? 'Round' : 'Rounds'} · Pivot Dist: {a.pivotDistance}
                    </span>
                  </div>

                  <div className="review-card-meta-right">
                    {isWrong ? (
                      <span className="badge-quality badge-wrong">
                        <Icon.Cross /> Wrong Choice
                      </span>
                    ) : isRevealed ? (
                      <span className="badge-quality badge-revealed">
                        <Icon.Eye /> Revealed
                      </span>
                    ) : isHinted ? (
                      <span className="badge-quality badge-hinted">
                        <Icon.Bulb /> Hinted
                      </span>
                    ) : isRushed ? (
                      <span className="badge-quality badge-rushed">
                        <Icon.Zap /> Rushed
                      </span>
                    ) : (
                      <span className="badge-quality badge-other">
                        {QUALITY_LABEL[a.solveQuality] || a.solveQuality}
                      </span>
                    )}

                    <span className="review-card-ago">{relTime(a.createdAt)}</span>
                  </div>
                </div>

                {/* ─── 2. Card Summary Metrics (4-column horizontal diagnostic grid) ─── */}
                <div className="review-metrics-grid">
                  {/* Your time */}
                  <div className="review-metric-col">
                    <span className="metric-label">Your time</span>
                    <div className="metric-value-row">
                      <span className="metric-val-main">{(a.elapsedMs / 1000).toFixed(1)}s</span>
                      <span className={`metric-delta-tag ${deltaClass}`}>{deltaStr}</span>
                    </div>
                  </div>

                  {/* Target benchmark */}
                  <div className="review-metric-col">
                    <span className="metric-label">Target</span>
                    <div className="metric-value-row">
                      <span className="metric-val-main">{targetSecNum}s</span>
                      <span className="metric-val-hint">benchmark</span>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="review-metric-col">
                    <span className="metric-label">Result</span>
                    <div className="metric-value-row">
                      <span className={`metric-val-main result-${resultClass}`}>{resultText}</span>
                    </div>
                  </div>

                  {/* Hint */}
                  <div className="review-metric-col">
                    <span className="metric-label">Hint</span>
                    <div className="metric-value-row">
                      <span className="metric-val-main">{hintText}</span>
                    </div>
                  </div>
                </div>

                {/* ─── 3. "What went wrong?" / Diagnosis Callout ─── */}
                <div className={`review-diagnosis-banner diagnosis-${diagnosis.type}`}>
                  <div className="diagnosis-icon-wrapper">
                    {diagnosis.type === 'wrong' || diagnosis.type === 'rushed' ? (
                      <Icon.Cross />
                    ) : diagnosis.type === 'hinted' ? (
                      <Icon.Bulb />
                    ) : (
                      <Icon.Info />
                    )}
                  </div>
                  <div className="diagnosis-content">
                    <span className="diagnosis-heading">What went wrong?</span>
                    <div className="diagnosis-text-wrap">
                      <strong className="diagnosis-title">{diagnosis.title}: </strong>
                      <span className="diagnosis-desc">{diagnosis.text}</span>
                    </div>
                  </div>
                </div>

                {/* ─── 4. Card Actions Footer ─── */}
                <div className="review-card-actions">
                  <button
                    className={`btn-review-toggle ${isPeekOpen ? 'active' : ''}`}
                    onClick={() => toggleSnapshot(a._id)}
                  >
                    <span>{isPeekOpen ? 'Hide attempt' : 'Review attempt'}</span>
                    {isPeekOpen ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                  </button>

                  <button className="btn-drill-similar" onClick={() => startRetry(a)}>
                    <span>Practice similar</span>
                    <Icon.ArrowRight />
                  </button>
                </div>

                {/* ─── 5. Expandable Attempt Drawer (Review attempt ▾) ─── */}
                {isPeekOpen && (
                  <div className="review-expanded-drawer">
                    <div className="expanded-drawer-grid">
                      {/* Left: Original Puzzle Board & Answer Comparison */}
                      <div className="expanded-board-col">
                        <div className="expanded-col-header">
                          <span className="expanded-col-title">Original Puzzle Board</span>
                          <span className="expanded-col-sub">
                            Target at row {(a.puzzleSnapshot?.target?.row ?? 0) + 1}, col {a.puzzleSnapshot?.cols?.[a.puzzleSnapshot?.target?.col] || ((a.puzzleSnapshot?.target?.col ?? 0) + 1)}
                          </span>
                        </div>

                        {hasSnapshot ? (
                          <div className="expanded-grid-container">
                            <Grid
                              cols={a.puzzleSnapshot.cols || ['α', 'β', 'γ', 'δ', 'ε']}
                              cells={a.puzzleSnapshot.cells}
                              target={a.puzzleSnapshot.target}
                              pivotCells={a.puzzleSnapshot.path?.[0] || []}
                              revealedLetter={a.correctLetter}
                              answered={true}
                              allLetters={a.puzzleSnapshot.allLetters || []}
                            />
                          </div>
                        ) : (
                          <div className="expanded-no-snapshot">
                            Snapshot layout not recorded for this attempt.
                          </div>
                        )}

                        {/* Answer Comparison Pills */}
                        <div className="expanded-answers-bar">
                          <div className={`expanded-answer-card ${a.correct ? 'is-correct' : 'is-wrong'}`}>
                            <span className="answer-card-label">Your Pick</span>
                            <span className="answer-card-value">
                              {a.selectedLetter || (isRevealed ? 'Revealed' : 'None')}
                            </span>
                          </div>
                          <span className="answer-compare-arrow">→</span>
                          <div className="expanded-answer-card is-target">
                            <span className="answer-card-label">Correct Target</span>
                            <span className="answer-card-value">{a.correctLetter}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Step-by-Step Explanation & Action CTA */}
                      <div className="expanded-details-col">
                        <div className="expanded-col-header">
                          <span className="expanded-col-title">How to Solve It</span>
                          <span className="expanded-col-sub">Step-by-step logical deduction</span>
                        </div>

                        <div className="expanded-explanation-card">
                          {explanationSteps.length > 0 ? (
                            <ol className="explanation-steps-list">
                              {explanationSteps.map((step, idx) => (
                                <li key={idx} className="explanation-step-item">
                                  <span className="step-badge">{idx + 1}</span>
                                  <span className="step-text">{step}</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="no-explanation-text">
                              Direct read: combine the target cell's row and column into one set to determine the missing letter.
                            </p>
                          )}
                        </div>

                        {/* Similar Puzzle Action Callout */}
                        <div className="expanded-practice-box">
                          <div className="expanded-practice-info">
                            <strong>Ready to master this pattern?</strong>
                            <p>Generate a fresh puzzle with identical logical depth ({a.rounds} rounds, distance {a.pivotDistance}).</p>
                          </div>
                          <button className="btn primary expanded-practice-btn" onClick={() => startRetry(a)}>
                            <Icon.Target />
                            <span>Practice Similar Puzzle</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Load More */}
      {filtered.length > shown && (
        <div className="review-load-more-wrap">
          <button className="btn review-load-more-btn" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show more ({filtered.length - shown} remaining)
          </button>
        </div>
      )}
    </div>
  );
}