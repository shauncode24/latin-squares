import { useEffect, useState } from 'react';
import { api } from '../api';
import { timeStr, relTime } from '../lib/format';
import Grid from './Grid';
import AnswerPad from './AnswerPad';

const QUALITY_LABEL = {
  clean: 'Clean',
  hinted: 'Hinted',
  revealed: 'Revealed',
  guessed: 'Guessed',
  rushed: 'Rushed',
};

export default function ReviewMode({ onClose }) {
  const [missed, setMissed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryItem, setRetryItem] = useState(null); // the Attempt being retried
  const [retryPuzzle, setRetryPuzzle] = useState(null);
  const [retryAnswer, setRetryAnswer] = useState(null);

  useEffect(() => {
    api.getMissed()
      .then((data) => setMissed(data.missed))
      .catch(() => setMissed([]))
      .finally(() => setLoading(false));
  }, []);

  async function startRetry(item) {
    setRetryItem(item);
    setRetryPuzzle(null);
    setRetryAnswer(null);
    // Generates a NEW puzzle with the same rounds/pivotDistance profile —
    // not the literal old grid, since the user already knows that answer.
    const data = await api.generateSimilar(item.rounds, item.pivotDistance, item.difficulty);
    setRetryPuzzle(data);
  }

  async function handleRetrySelect(letter) {
    if (!retryPuzzle || retryAnswer) return;
    const res = await api.submitAnswer(retryPuzzle.puzzleId, letter, 0, false, null);
    setRetryAnswer({ letter, correctLetter: res.correctLetter, correct: res.correct });
  }

  if (loading) return <div className="loading">Loading review…</div>;

  if (retryItem) {
    return (
      <div className="review-wrap">
        <div className="review-header">
          <h2>Practice a similar one</h2>
          <button className="btn-link" onClick={() => setRetryItem(null)}>← Back</button>
        </div>
        {!retryPuzzle ? (
          <div className="loading">Generating…</div>
        ) : (
          <>
            <Grid
              cols={retryPuzzle.cols}
              cells={retryPuzzle.cells}
              target={retryPuzzle.target}
              pivotCells={retryAnswer ? (retryPuzzle.path?.[0] || []) : []}
              revealedLetter={retryAnswer?.correctLetter}
              answered={!!retryAnswer}
              allLetters={retryPuzzle.allLetters}
            />
            <AnswerPad
              onSelect={handleRetrySelect}
              disabled={!!retryAnswer}
              selected={retryAnswer?.letter}
              correctLetter={retryAnswer?.correctLetter}
            />
            {retryAnswer && (
              <div className={`feedback ${retryAnswer.correct ? 'correct-text' : 'wrong-text'}`}>
                {retryAnswer.correct ? 'Correct this time!' : `Still ${retryAnswer.correctLetter} — try another.`}
              </div>
            )}
            <div className="controls">
              <button className="btn primary" onClick={() => startRetry(retryItem)}>Another similar one</button>
              <button className="btn" onClick={() => setRetryItem(null)}>Done</button>
            </div>
          </>
        )}
      </div>
    );
  }

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
        <button className="btn-link" onClick={onClose}>× Close</button>
      </div>
      <div className="review-list">
        {missed.map((a) => (
          <div key={a._id} className={`review-item${a.correct ? ' correct' : ' wrong'}`}>
            <div className="review-meta">
              <span className={`tier-badge tier-badge-${a.difficulty}`}>{a.difficulty}</span>
              <span className="review-quality">{QUALITY_LABEL[a.solveQuality] || a.solveQuality}</span>
              <span className="review-time">{timeStr(a.elapsedMs)}</span>
              <span className="review-ago">{relTime(a.createdAt)}</span>
            </div>
            <div className="review-info">
              Rounds: {a.rounds} · Pivot distance: {a.pivotDistance} · Pattern: {a.patternTag}
              {a.selectedLetter && !a.correct && (
                <> · You picked {a.selectedLetter}, answer was {a.correctLetter}</>
              )}
            </div>
            <button className="btn-link" onClick={() => startRetry(a)}>Practice a similar one →</button>
          </div>
        ))}
      </div>
    </div>
  );
}