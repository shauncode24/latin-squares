import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const COLS = ['\u03b1', '\u03b2', '\u03b3', '\u03b4', '\u03b5'];
const QUALITY_LABEL = {
  clean: '? Clean',
  hinted: '? Hinted',
  revealed: '?? Revealed',
  guessed: '? Guessed',
};

export default function ReviewMode({ onClose }) {
  const [missed, setMissed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMissed()
      .then((data) => setMissed(data.missed))
      .catch(() => setMissed([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading review�</div>;
  if (!missed || missed.length === 0) {
    return (
      <div className="review-empty">
        <p>No missed or hinted puzzles yet. Keep playing!</p>
        <button className="btn primary" onClick={onClose}>Back</button>
      </div>
    );
  }

  return (
    <div className="review-wrap">
      <div className="review-header">
        <h2>Review Missed Puzzles</h2>
        <button className="btn-link" onClick={onClose}>? Close</button>
      </div>
      <div className="review-list">
        {missed.map((a, i) => (
          <div key={i} className={`review-item${a.correct ? ' correct' : ' wrong'}`}>
            <div className="review-meta">
              <span className={`tier-badge tier-badge-${a.difficulty}`}>{a.difficulty}</span>
              <span className="review-quality">{QUALITY_LABEL[a.solveQuality] || a.solveQuality}</span>
              <span className="review-time">{timeStr(a.elapsedMs)}</span>
              <span className="review-ago">{relTime(a.createdAt)}</span>
            </div>
            <div className="review-info">
              Rounds: {a.rounds} � Pivot distance: {a.pivotDistance}
            </div>
            {a.puzzleSnapshot?.path?.length > 0 && (
              <div className="review-path">
                Pivot chain: {a.puzzleSnapshot.path.map((round, ri) =>
                  round.map(([r, c]) => `(${r + 1},${COLS[c]})`).join(' ')
                ).join(' ? ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
