const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function AnswerPad({ onSelect, disabled, selected, correctLetter }) {
  return (
    <div className="answers">
      {LETTERS.map((letter) => {
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
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
