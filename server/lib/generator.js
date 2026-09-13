const N = 5;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const COLS = ['\u03b1', '\u03b2', '\u03b3', '\u03b4', '\u03b5']; // α β γ δ ε

const TIER_ROUNDS = {
  low: [0],
  medium: [1],
  high: [2, 3],
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomLatinSquare() {
  const base = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) row.push((r + c) % N);
    base.push(row);
  }
  const rowPerm = shuffle([0, 1, 2, 3, 4]);
  const colPerm = shuffle([0, 1, 2, 3, 4]);
  const symPerm = shuffle([0, 1, 2, 3, 4]);

  const grid = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) {
      const v = base[rowPerm[r]][colPerm[c]];
      row.push(symPerm[v]);
    }
    grid.push(row);
  }
  return grid;
}

function getCandidates(r, c, grid, known) {
  const used = new Set();
  for (let cc = 0; cc < N; cc++) if (known[r][cc]) used.add(grid[r][cc]);
  for (let rr = 0; rr < N; rr++) if (known[rr][c]) used.add(grid[rr][c]);
  const cand = [];
  for (let v = 0; v < N; v++) if (!used.has(v)) cand.push(v);
  return cand;
}

/**
 * Simulates the "no notes, rows+columns only" deduction the dMAT format
 * requires. At each round it resolves every currently-forced cell
 * simultaneously (mirrors the Four-Sightings / global elimination style
 * of reasoning) and reports which round the target cell collapses to a
 * single candidate in.
 *   rounds === 0  -> direct read (target forced by its own row+col)
 *   rounds === 1  -> one pivot cell needed
 *   rounds === 2/3 -> chained deduction
 *   rounds === -1 -> not solvable by simple row/col elimination alone
 */
function computeRounds(grid, mask, tr, tc) {
  const known = mask.map((row) => row.slice());
  const path = [];
  let round = 0;

  while (true) {
    const targetCand = getCandidates(tr, tc, grid, known);
    if (targetCand.length === 1) return { rounds: round, path };

    const newlySolved = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!known[r][c] && !(r === tr && c === tc)) {
          const cand = getCandidates(r, c, grid, known);
          if (cand.length === 1) newlySolved.push([r, c]);
        }
      }
    }

    if (newlySolved.length === 0) return { rounds: -1, path };
    for (const [r, c] of newlySolved) known[r][c] = true;
    path.push(newlySolved);
    round++;
    if (round > 6) return { rounds: -1, path };
  }
}

function generatePuzzle(difficulty) {
  const desired = TIER_ROUNDS[difficulty];
  if (!desired) throw new Error('Unknown difficulty: ' + difficulty);

  for (let attempt = 0; attempt < 400; attempt++) {
    const grid = randomLatinSquare();
    const tr = Math.floor(Math.random() * N);
    const tc = Math.floor(Math.random() * N);

    const mask = [];
    for (let r = 0; r < N; r++) mask.push(new Array(N).fill(true));
    mask[tr][tc] = false;

    let cur = computeRounds(grid, mask, tr, tc);
    if (cur.rounds === -1) continue;

    let candidates = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!(r === tr && c === tc)) candidates.push([r, c]);
      }
    }
    candidates = shuffle(candidates);

    let reached = desired.includes(cur.rounds);
    let extraTries = 0;

    for (const [r, c] of candidates) {
      if (reached && extraTries > 4) break;
      if (!mask[r][c]) continue;

      mask[r][c] = false;
      const test = computeRounds(grid, mask, tr, tc);
      const ok =
        test.rounds !== -1 &&
        (reached ? desired.includes(test.rounds) : test.rounds <= Math.max(...desired));

      if (ok) {
        cur = test;
        if (desired.includes(cur.rounds)) {
          if (reached) extraTries++;
          reached = true;
        }
      } else {
        mask[r][c] = true; // revert
      }
    }

    if (reached) {
      return { grid, mask, target: { row: tr, col: tc }, path: cur.path, rounds: cur.rounds };
    }
  }

  // Fallback: fully revealed grid, always a direct read.
  const grid = randomLatinSquare();
  const target = { row: 2, col: 2 };
  const mask = [];
  for (let r = 0; r < N; r++) mask.push(new Array(N).fill(true));
  mask[target.row][target.col] = false;
  const cur = computeRounds(grid, mask, target.row, target.col);
  return { grid, mask, target, path: cur.path, rounds: cur.rounds };
}

module.exports = { N, LETTERS, COLS, TIER_ROUNDS, generatePuzzle, computeRounds };
