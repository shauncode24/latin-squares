import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';
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

const TIER_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PAGE_SIZE = 8;

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
                  Pattern: {retryItem.patternTag || 'Direct'}
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
              Analyze previous incorrect or hinted attempts, inspect original boards, and drill customized variations.
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
            const hasSnapshot = !!(a.puzzleSnapshot && a.puzzleSnapshot.cells && a.puzzleSnapshot.cells.length);
            const isPeekOpen = !!expandedSnapshots[a._id];

            return (
              <div key={a._id} className={`review-card-item ${isWrong ? 'status-wrong' : 'status-hinted'}`}>
                {/* Card Top Meta */}
                <div className="review-card-top">
                  <div className="review-card-badges">
                    <span className={`tier-tag tier-${a.difficulty}`}>
                      {TIER_LABEL[a.difficulty] || a.difficulty}
                    </span>

                    {isWrong ? (
                      <span className="badge-quality badge-wrong">
                        <Icon.Cross /> Wrong Choice
                      </span>
                    ) : a.solveQuality === 'hinted' ? (
                      <span className="badge-quality badge-hinted">
                        <Icon.Bulb /> Hinted
                      </span>
                    ) : a.solveQuality === 'revealed' ? (
                      <span className="badge-quality badge-revealed">
                        <Icon.Eye /> Revealed
                      </span>
                    ) : (
                      <span className="badge-quality badge-other">
                        {QUALITY_LABEL[a.solveQuality] || a.solveQuality}
                      </span>
                    )}

                    <span className="badge-time">
                      <Icon.Clock /> {timeStr(a.elapsedMs)}
                    </span>
                  </div>

                  <span className="review-card-ago">{relTime(a.createdAt)}</span>
                </div>

                {/* Card Body Info */}
                <div className="review-card-body">
                  {/* Diagnosis / Answer comparison */}
                  {isWrong && a.selectedLetter && (
                    <div className="review-answer-compare">
                      <div className="compare-item picked">
                        <span className="compare-label">Your Pick:</span>
                        <span className="compare-val wrong">{a.selectedLetter}</span>
                      </div>
                      <span className="compare-arrow">→</span>
                      <div className="compare-item correct">
                        <span className="compare-label">Correct:</span>
                        <span className="compare-val correct">{a.correctLetter}</span>
                      </div>
                    </div>
                  )}

                  {/* Puzzle Specs */}
                  <div className="review-specs-row">
                    <span className="spec-tag">
                      <strong>Rounds:</strong> {a.rounds}
                    </span>
                    <span className="spec-tag">
                      <strong>Pivot Distance:</strong> {a.pivotDistance}
                    </span>
                    <span className="spec-tag">
                      <strong>Pattern:</strong> {a.patternTag || 'direct'}
                    </span>
                  </div>
                </div>

                {/* Expandable Original Grid Snapshot */}
                {hasSnapshot && isPeekOpen && (
                  <div className="review-snapshot-preview">
                    <div className="snapshot-preview-header">
                      <span>Original Puzzle Layout:</span>
                    </div>
                    <div className="snapshot-grid-container">
                      <Grid
                        cols={a.puzzleSnapshot.cols || ['α', 'β', 'γ', 'δ', 'ε']}
                        cells={a.puzzleSnapshot.cells}
                        target={a.puzzleSnapshot.target}
                        revealedLetter={a.correctLetter}
                        answered={true}
                        allLetters={a.puzzleSnapshot.allLetters || []}
                      />
                    </div>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="review-card-actions">
                  {hasSnapshot && (
                    <button className="btn-peek-snapshot" onClick={() => toggleSnapshot(a._id)}>
                      {isPeekOpen ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                      <span>{isPeekOpen ? 'Hide Original Board' : 'View Original Board'}</span>
                    </button>
                  )}

                  <button className="btn-drill-similar" onClick={() => startRetry(a)}>
                    <Icon.Target />
                    <span>Practice Similar Puzzle</span>
                  </button>
                </div>
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