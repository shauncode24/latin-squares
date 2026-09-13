const ROW_LABELS = ['1', '2', '3', '4', '5'];

export default function Grid({ cols, cells, target, pivotCells = [], revealedLetter, answered = false, allLetters = null }) {
  const isPivot = (r, c) => pivotCells.some(([pr, pc]) => pr === r && pc === c);

  return (
    <table className="grid">
      <thead>
        <tr>
          <th />
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cells.map((row, r) => (
          <tr key={r}>
            <th>{ROW_LABELS[r]}</th>
            {row.map((letter, c) => {
              const isTarget = r === target.row && c === target.col;
              const classNames = ['cell'];
              if (isTarget) classNames.push('target');
              else if (answered && letter === null) classNames.push('revealed');
              else if (letter === null) classNames.push('blank');
              if (isPivot(r, c)) classNames.push('pivot');

              let content = letter;
              if (isTarget) {
                content = revealedLetter || '?';
              } else if (answered && letter === null && allLetters) {
                content = allLetters[r][c];
              }

              return (
                <td key={c} className={classNames.join(' ')}>
                  {content}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
