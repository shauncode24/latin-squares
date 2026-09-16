const N = 5;
const ALL_LETTERS_LIST = ['A', 'B', 'C', 'D', 'E'];

function buildKnownGrid(cells, target) {
  const known = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) {
      row.push(!(r === target.row && c === target.col) && cells?.[r]?.[c] !== null && cells?.[r]?.[c] !== undefined);
    }
    known.push(row);
  }
  return known;
}

function candidatesRemaining(known, allLetters, r, c) {
  const used = new Set();
  for (let cc = 0; cc < N; cc++) {
    if (known[r]?.[cc] && allLetters?.[r]?.[cc]) used.add(allLetters[r][cc]);
  }
  for (let rr = 0; rr < N; rr++) {
    if (known[rr]?.[c] && allLetters?.[rr]?.[c]) used.add(allLetters[rr][c]);
  }
  return ALL_LETTERS_LIST.filter((l) => !used.has(l));
}

function rowColLabel(r, c, cols) {
  const colName = cols?.[c] || String.fromCharCode(65 + c);
  return `row ${r + 1}, column ${colName}`;
}

/**
 * Deterministic explanation of how the target cell is solved based on the recorded path.
 */
export function explainPuzzle({ cells, allLetters, target, path, cols }) {
  if (!cells || !allLetters || !target) return [];
  const known = buildKnownGrid(cells, target);
  const steps = [];

  if (!path || path.length === 0) {
    const cand = candidatesRemaining(known, allLetters, target.row, target.col);
    const letter = cand[0] || allLetters[target.row]?.[target.col] || '?';
    steps.push(
      `Read ${rowColLabel(target.row, target.col, cols)} directly — together the row and column rule out every letter except ${letter}.`
    );
    return steps;
  }

  for (const round of path) {
    for (const [r, c] of round) {
      const letter = allLetters[r]?.[c];
      steps.push(
        `Solve ${rowColLabel(r, c, cols)} first — with what's already known, it narrows down to ${letter}.`
      );
      if (known[r]) known[r][c] = true;
    }
  }

  const cand = candidatesRemaining(known, allLetters, target.row, target.col);
  const finalLetter = cand[0] || allLetters[target.row]?.[target.col] || '?';
  steps.push(
    `With those cells solved, ${rowColLabel(target.row, target.col, cols)} now combines to leave ${finalLetter}.`
  );

  return steps;
}
