const express = require('express');
const router = express.Router();
const { getUserId } = require('../middleware/auth');
const Puzzle  = require('../models/Puzzle');
const Attempt = require('../models/Attempt');
const { generatePuzzle, generateTargetedPuzzle, LETTERS, COLS, TIER_ROUNDS } = require('../lib/generator');

const TIERS = ['low', 'medium', 'high'];
const GUESS_THRESHOLD_MS = 1_500;

function buildResponsePayload(puzzle) {
  const { grid, mask, target, difficulty, rounds, pivotDistance, patternTag, difficultyMismatch, _id } = puzzle;
  const cells = grid.map((row, r) =>
    row.map((v, c) => {
      if (r === target.row && c === target.col) return null;
      return mask[r][c] ? LETTERS[v] : null;
    })
  );
  const allLetters = grid.map((row) => row.map((v) => LETTERS[v]));
  return {
    puzzleId: _id,
    difficulty,
    cols: COLS,
    cells,
    allLetters,
    target,
    rounds,
    pivotDistance,
    patternTag,
    difficultyMismatch,
  };
}

// POST /api/puzzles/generate
router.post('/generate', async (req, res) => {
  try {
    const { difficulty, targetRounds, targetPivotDistance } = req.body;
    if (!TIERS.includes(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be low, medium, or high' });
    }

    let result;
    if (targetRounds != null || targetPivotDistance != null) {
      result = generateTargetedPuzzle(targetRounds, targetPivotDistance, difficulty);
    } else {
      result = generatePuzzle(difficulty);
    }

    const { grid, mask, target, path, rounds, pivotDistance, patternTag, difficultyMismatch } = result;
    const puzzle = await Puzzle.create({
      difficulty: result.difficulty || difficulty,
      grid, mask, target, path, rounds, pivotDistance, patternTag, difficultyMismatch,
    });

    res.json(buildResponsePayload(puzzle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to generate puzzle' });
  }
});

// NEW: POST /api/puzzles/practice-similar
// Given a previous rounds/pivotDistance profile (from a missed Attempt, or
// from Weakness Mode's computed weak bucket), generate a fresh puzzle with
// the same structural profile — this is what makes Review Mode and
// Weakness Mode actually functional instead of decorative.
router.post('/practice-similar', async (req, res) => {
  try {
    const { rounds, pivotDistance, difficulty } = req.body;
    const result = generateTargetedPuzzle(rounds, pivotDistance, difficulty || 'medium');
    const puzzle = await Puzzle.create({
      difficulty: result.difficulty,
      grid: result.grid, mask: result.mask, target: result.target,
      path: result.path, rounds: result.rounds, pivotDistance: result.pivotDistance,
      patternTag: result.patternTag, difficultyMismatch: result.difficultyMismatch,
    });
    res.json(buildResponsePayload(puzzle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to generate similar puzzle' });
  }
});

// POST /api/puzzles/:id/answer
router.post('/:id/answer', async (req, res) => {
  try {
    const { letter, elapsedMs, hintUsed = false, sessionId = null } = req.body;
    const userId = getUserId(req);

    if (!LETTERS.includes(letter)) {
      return res.status(400).json({ error: 'invalid letter' });
    }

    const puzzle = await Puzzle.findOne({ _id: req.params.id, answeredAt: null });
    if (!puzzle) {
      return res.status(410).json({ error: 'puzzle expired or already answered' });
    }

    const correctLetter = LETTERS[puzzle.grid[puzzle.target.row][puzzle.target.col]];
    const correct = letter === correctLetter;
    const elapsed = Number(elapsedMs) || 0;
    const isFast = elapsed < GUESS_THRESHOLD_MS;

    // FIX: previously a fast WRONG answer fell through to 'clean', which
    // mislabeled rushed guesses as careful reasoning in the stats. Now:
    //   hint used         -> 'hinted'   (regardless of speed)
    //   fast + correct     -> 'guessed'  (still worth flagging as unverified)
    //   fast + wrong        -> 'rushed'   (NEW category — distinct mistake type)
    //   otherwise           -> 'clean'
    let solveQuality;
    if (hintUsed) {
      solveQuality = 'hinted';
    } else if (isFast && correct) {
      solveQuality = 'guessed';
    } else if (isFast && !correct) {
      solveQuality = 'rushed';
    } else {
      solveQuality = 'clean';
    }

    if (userId) {
      const cells = puzzle.grid.map((row, r) =>
        row.map((v, c) => {
          if (r === puzzle.target.row && c === puzzle.target.col) return null;
          return puzzle.mask[r][c] ? LETTERS[v] : null;
        })
      );
      const allLetters = puzzle.grid.map((row) => row.map((v) => LETTERS[v]));

      await Attempt.create({
        userId,
        sessionId: sessionId || null,
        difficulty: puzzle.difficulty,
        rounds: puzzle.rounds,
        pivotDistance: puzzle.pivotDistance,
        patternTag: puzzle.patternTag,
        correct,
        selectedLetter: letter,
        correctLetter,
        solveQuality,
        hintUsed,
        elapsedMs: elapsed,
        puzzleSnapshot: {
          cols: COLS,
          cells,
          allLetters,
          target: puzzle.target,
          path: puzzle.path,
        },
      });
    }

    await Puzzle.updateOne({ _id: puzzle._id }, { $set: { answeredAt: new Date() } });

    // Return the pivot chain too, so the client can show the deduction
    // path automatically on any wrong (or slow) answer, not only when the
    // user pre-emptively asked for a hint.
    res.json({
      correct,
      correctLetter,
      solveQuality,
      recorded: !!userId,
      pivotCells: puzzle.path && puzzle.path.length ? puzzle.path[0] : [],
      rounds: puzzle.rounds,
      pivotDistance: puzzle.pivotDistance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to grade answer' });
  }
});

// GET /api/puzzles/:id/reveal
router.get('/:id/reveal', async (req, res) => {
  try {
    const userId = getUserId(req);
    const puzzle = await Puzzle.findOne({ _id: req.params.id, answeredAt: null });
    if (!puzzle) {
      return res.status(410).json({ error: 'puzzle expired or already answered' });
    }

    const correctLetter = LETTERS[puzzle.grid[puzzle.target.row][puzzle.target.col]];

    if (userId) {
      const cells = puzzle.grid.map((row, r) =>
        row.map((v, c) => {
          if (r === puzzle.target.row && c === puzzle.target.col) return null;
          return puzzle.mask[r][c] ? LETTERS[v] : null;
        })
      );
      const allLetters = puzzle.grid.map((row) => row.map((v) => LETTERS[v]));

      await Attempt.create({
        userId,
        difficulty: puzzle.difficulty,
        rounds: puzzle.rounds,
        pivotDistance: puzzle.pivotDistance,
        patternTag: puzzle.patternTag,
        correct: false,
        selectedLetter: null,
        correctLetter,
        solveQuality: 'revealed',
        hintUsed: puzzle.hintUsed,
        elapsedMs: 0,
        puzzleSnapshot: { cols: COLS, cells, allLetters, target: puzzle.target, path: puzzle.path },
      });
    }

    await Puzzle.updateOne({ _id: puzzle._id }, { $set: { answeredAt: new Date() } });
    res.json({ correctLetter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to reveal answer' });
  }
});

// GET /api/puzzles/:id/hint
router.get('/:id/hint', async (req, res) => {
  try {
    const puzzle = await Puzzle.findOne({ _id: req.params.id, answeredAt: null });
    if (!puzzle) {
      return res.status(410).json({ error: 'puzzle expired or already answered' });
    }
    if (!puzzle.hintUsed) {
      await Puzzle.updateOne({ _id: puzzle._id }, { $set: { hintUsed: true } });
    }
    const firstRound = puzzle.path && puzzle.path.length ? puzzle.path[0] : [];
    res.json({ pivotCells: firstRound, direct: firstRound.length === 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch hint' });
  }
});

module.exports = router;