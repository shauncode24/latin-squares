const N = 5;
const ALL_LETTERS_LIST = ['A', 'B', 'C', 'D', 'E'];

function buildKnownGrid(cells, target) {
  const known = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) {
      row.push(!(r === target.row && c === target.col) && cells[r][c] !== null);
    }
    known.push(row);
  }
  return known;
}

function candidatesRemaining(known, allLetters, r, c) {
  const used = new Set();
  for (let cc = 0; cc < N; cc++) if (known[r][cc]) used.add(allLetters[r][cc]);
  for (let rr = 0; rr < N; rr++) if (known[rr][c]) used.add(allLetters[rr][c]);
  return ALL_LETTERS_LIST.filter((l) => !used.has(l));
}

function rowColLabel(r, c, cols) {
  return `row ${r + 1}, column ${cols[c]}`;
}

/**
 * Deterministic, template-based explanation of how the target cell was
 * solvable — built directly from the solver's own recorded path, not a
 * guess. The generator already proved the exact deduction chain when it
 * built the puzzle; this just turns that chain into sentences. No AI
 * needed — a hardcoded template gets nearly all the value here and is
 * instant, free, and never wrong.
 */
function explainPuzzle({ cells, allLetters, target, path, cols }) {
  const known = buildKnownGrid(cells, target);
  const steps = [];

  if (!path || path.length === 0) {
    const cand = candidatesRemaining(known, allLetters, target.row, target.col);
    steps.push(
      `Read ${rowColLabel(target.row, target.col, cols)} directly — together the ` +
      `row and column already rule out every letter except ${cand[0] || allLetters[target.row][target.col]}.`
    );
    return steps;
  }

  for (const round of path) {
    for (const [r, c] of round) {
      const letter = allLetters[r][c];
      steps.push(
        `Solve ${rowColLabel(r, c, cols)} first — with what's already known, it narrows to ${letter}.`
      );
      known[r][c] = true;
    }
  }

  const cand = candidatesRemaining(known, allLetters, target.row, target.col);
  steps.push(
    `With those cells solved, ${rowColLabel(target.row, target.col, cols)} now combine to leave ` +
    `${cand[0] || allLetters[target.row][target.col]} as the only option.`
  );

  return steps;
}

module.exports = { explainPuzzle };