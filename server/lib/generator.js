const N = 5;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const COLS = ['\u03b1', '\u03b2', '\u03b3', '\u03b4', '\u03b5']; // α β γ δ ε

const TIER_ROUNDS = {
  low: [0],
  medium: [1],
  high: [2, 3],
};

function computePivotDistance(path, target) {
  if (!path || path.length === 0 || path[0].length === 0) return 0;
  const [pr, pc] = path[0][0];
  return Math.abs(pr - target.row) + Math.abs(pc - target.col);
}

// NEW: classify the puzzle by *structure*, not just depth, so stats can
// answer "what type of Latin Square am I bad at."
function computePatternTag(path, rounds, target) {
  if (rounds === 0 || !path || path.length === 0 || path[0].length === 0) {
    return 'direct';
  }
  if (rounds === 1) {
    const [pr, pc] = path[0][0];
    const aligned = pr === target.row || pc === target.col;
    return aligned ? 'single-pivot-aligned' : 'single-pivot-cross';
  }
  return rounds >= 3 ? 'chain-3' : 'chain-2';
}

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

/**
 * Core single-attempt generator. Returns null if it can't hit `desiredRounds`
 * within the attempt budget — caller decides whether to fall back.
 */
function attemptGenerate(desiredRounds, maxAttempts = 400) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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

    let reached = desiredRounds.includes(cur.rounds);
    let extraTries = 0;

    for (const [r, c] of candidates) {
      if (reached && extraTries > 4) break;
      if (!mask[r][c]) continue;

      mask[r][c] = false;
      const test = computeRounds(grid, mask, tr, tc);
      const ok =
        test.rounds !== -1 &&
        (reached ? desiredRounds.includes(test.rounds) : test.rounds <= Math.max(...desiredRounds));

      if (ok) {
        cur = test;
        if (desiredRounds.includes(cur.rounds)) {
          if (reached) extraTries++;
          reached = true;
        }
      } else {
        mask[r][c] = true;
      }
    }

    if (reached) {
      const target = { row: tr, col: tc };
      const pivotDistance = computePivotDistance(cur.path, target);
      const patternTag = computePatternTag(cur.path, cur.rounds, target);
      return { grid, mask, target, path: cur.path, rounds: cur.rounds, pivotDistance, patternTag };
    }
  }
  return null;
}

/**
 * Public entry point for a plain difficulty-tier request.
 * FIX: previously, a silent fallback could return a puzzle whose actual
 * `rounds` didn't match the requested tier, while the caller stored the
 * *requested* difficulty label anyway. Now the fallback is explicitly
 * flagged so the caller can decide what to do (currently: still serve it,
 * but mark difficultyMismatch=true rather than lying about it in stats).
 */
function generatePuzzle(difficulty) {
  const desired = TIER_ROUNDS[difficulty];
  if (!desired) throw new Error('Unknown difficulty: ' + difficulty);

  const result = attemptGenerate(desired, 400);
  if (result) return { ...result, difficultyMismatch: false };

  // Fallback: fully revealed grid, always a direct read (rounds === 0).
  const grid = randomLatinSquare();
  const target = { row: 2, col: 2 };
  const mask = [];
  for (let r = 0; r < N; r++) mask.push(new Array(N).fill(true));
  mask[target.row][target.col] = false;
  const cur = computeRounds(grid, mask, target.row, target.col);
  const pivotDistance = computePivotDistance(cur.path, target);
  const patternTag = computePatternTag(cur.path, cur.rounds, target);
  const mismatch = !desired.includes(cur.rounds);

  return {
    grid, mask, target, path: cur.path, rounds: cur.rounds,
    pivotDistance, patternTag, difficultyMismatch: mismatch,
  };
}

/**
 * NEW: the function the weakness-targeting feature actually needed.
 * Loops across difficulty tiers (not just one) to find a puzzle matching
 * a specific rounds/pivotDistance profile — used by Weakness Mode and by
 * Review Mode's "practice a similar one" retry.
 */
function generateTargetedPuzzle(targetRounds, targetPivotDistance, fallbackDifficulty = 'medium') {
  let tier = fallbackDifficulty;
  for (const [t, rs] of Object.entries(TIER_ROUNDS)) {
    if (targetRounds != null && rs.includes(targetRounds)) tier = t;
  }
  const desired = targetRounds != null ? [targetRounds] : TIER_ROUNDS[tier];

  let best = null;
  for (let i = 0; i < 200; i++) {
    const result = attemptGenerate(desired, 40);
    if (!result) continue;
    if (targetPivotDistance == null) return { ...result, difficulty: tier, difficultyMismatch: false };
    if (Math.abs(result.pivotDistance - targetPivotDistance) <= 1) {
      return { ...result, difficulty: tier, difficultyMismatch: false };
    }
    if (!best) best = result; // keep a fallback candidate matching rounds at least
  }
  if (best) return { ...best, difficulty: tier, difficultyMismatch: false };

  const fallback = generatePuzzle(tier);
  return { ...fallback, difficulty: tier };
}

module.exports = {
  N, LETTERS, COLS, TIER_ROUNDS,
  generatePuzzle, generateTargetedPuzzle,
  computeRounds, computePivotDistance, computePatternTag,
};