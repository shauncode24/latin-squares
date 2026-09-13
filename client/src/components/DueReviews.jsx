import { useEffect, useState } from 'react';
import { api } from '../api';
import Grid from './Grid';
import AnswerPad from './AnswerPad';

export default function DueReviews() {
  const [due, setDue] = useState(undefined); // undefined = loading
  const [active, setActive] = useState(null);
  const [puzzle, setPuzzle] = useState(null);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    api.getDueItems().then((d) => setDue(d.due)).catch(() => setDue([]));
  }, []);

  async function start(item) {
    setActive(item);
    setAnswer(null);
    setPuzzle(null);
    const data = await api.generateSimilar(item.rounds, item.pivotDistance, item.difficulty);
    setPuzzle(data);
  }

  async function handleSelect(letter) {
    if (!puzzle || answer) return;
    const res = await api.submitAnswer(puzzle.puzzleId, letter, 0, false, null);
    setAnswer({ letter, correctLetter: res.correctLetter, correct: res.correct });
    await api.submitReview(active.difficulty, active.rounds, active.pivotDistance, res.correct, false);
  }

  function nextDue() {
    const rest = due.filter((d) => d.patternKey !== active.patternKey);
    setDue(rest);
    setActive(null);
    setPuzzle(null);
    setAnswer(null);
  }

  if (due === undefined || (due.length === 0 && !active)) return null;

  if (active) {
    return (
      <div className="due-review-active">
        <div className="review-header">
          <h3 style={{ margin: 0, fontSize: 14 }}>Spaced review — {active.difficulty}</h3>
          <button className="btn-link" onClick={() => { setActive(null); setPuzzle(null); }}>← Back</button>
        </div>
        {!puzzle ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <Grid
              cols={puzzle.cols}
              cells={puzzle.cells}
              target={puzzle.target}
              pivotCells={answer ? (puzzle.path?.[0] || []) : []}
              revealedLetter={answer?.correctLetter}
              answered={!!answer}
              allLetters={puzzle.allLetters}
            />
            <AnswerPad onSelect={handleSelect} disabled={!!answer} selected={answer?.letter} correctLetter={answer?.correctLetter} />
            {answer && (
              <div className={`feedback ${answer.correct ? 'correct-text' : 'wrong-text'}`}>
                {answer.correct ? 'Correct — interval extended.' : `Missed — answer was ${answer.correctLetter}. Back in the queue sooner.`}
              </div>
            )}
            {answer && (
              <div className="controls">
                <button className="btn primary" onClick={nextDue}>Next due item →</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="adaptive-banner good" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span>{due.length} pattern{due.length > 1 ? 's' : ''} due for spaced review</span>
      <button className="btn-link" onClick={() => start(due[0])}>Review now →</button>
    </div>
  );
}