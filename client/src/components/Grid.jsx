const DEFAULT_COLS = ['α', 'β', 'γ', 'δ', 'ε'];
const ROW_LABELS = ['1', '2', '3', '4', '5'];
const EMPTY_CELLS = Array.from({ length: 5 }, () => Array(5).fill(null));
const DEFAULT_TARGET = { row: -1, col: -1 };

export default function Grid({
  cols = DEFAULT_COLS,
  cells = EMPTY_CELLS,
  target = DEFAULT_TARGET,
  pivotCells = [],
  revealedLetter,
  answered = false,
  allLetters = null
}) {
  const safeCols = cols && cols.length === 5 ? cols : DEFAULT_COLS;
  const safeCells = cells && cells.length === 5 ? cells : EMPTY_CELLS;
  const safeTarget = target || DEFAULT_TARGET;

  const isPivot = (r, c) => pivotCells && pivotCells.some(([pr, pc]) => pr === r && pc === c);

  return (
    <table className="grid">
      <thead>
        <tr>
          <th />
          {safeCols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {safeCells.map((row, r) => (
          <tr key={r}>
            <th>{ROW_LABELS[r]}</th>
            {row.map((letter, c) => {
              const isTarget = r === safeTarget.row && c === safeTarget.col;
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
