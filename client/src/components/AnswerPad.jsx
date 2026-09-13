import { useEffect } from 'react';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function AnswerPad({ onSelect, disabled, selected, correctLetter }) {
  useEffect(() => {
    if (disabled) return;
    function handleKey(e) {
      const key = e.key.toUpperCase();
      const byLetter = LETTERS.includes(key) ? key : null;
      const byNumber = /^[1-5]$/.test(e.key) ? LETTERS[Number(e.key) - 1] : null;
      const letter = byLetter || byNumber;
      if (letter) onSelect(letter);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [disabled, onSelect]);

  return (
    <>
      <div className="answers">
        {LETTERS.map((letter, i) => {
          const classNames = ['answer-btn'];
          if (correctLetter) {
            if (letter === correctLetter) classNames.push('correct');
            else if (letter === selected) classNames.push('wrong');
          }
          return (
            <button
              key={letter}
              className={classNames.join(' ')}
              disabled={disabled}
              onClick={() => onSelect(letter)}
              title={`Press ${letter} or ${i + 1}`}
            >
              <span className="answer-letter">{letter}</span>
              <span className="answer-num">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="answer-hint">Tap an option, press A–E / 1–5, or press Enter for Next.</p>
    </>
  );
}