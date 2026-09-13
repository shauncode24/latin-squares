const express = require('express');
const router = express.Router();
const { getUserId } = require('../middleware/auth');
const Puzzle  = require('../models/Puzzle');
const Attempt = require('../models/Attempt');
const { generatePuzzle, LETTERS, COLS } = require('../lib/generator');

const TIERS = ['low', 'medium', 'high'];
// Tier target times in ms — used for clean/guessed classification
const TIER_TARGET_MS = { low: 20_000, medium: 50_000, high: 75_000 };
const GUESS_THRESHOLD_MS = 1_500;

// POST /api/puzzles/generate
router.post('/generate', async (req, res) => {
  try {
    const { difficulty, targetRounds, targetPivotDistance } = req.body;
    if (!TIERS.includes(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be low, medium, or high' });
    }

    // If weakness-targeted params are provided, loop until we hit the desired profile
    let result;
    if (targetRounds != null || targetPivotDistance != null) {
      let attempts = 0;
      do {
        result = generatePuzzle(difficulty);
        attempts++;
      } while (
        attempts < 200 &&
        (
          (targetRounds != null && result.rounds !== targetRounds) ||
          (targetPivotDistance != null &&
            Math.abs(result.pivotDistance - targetPivotDistance) > 1)
        )
      );
    } else {
      result = generatePuzzle(difficulty);
    }

    const { grid, mask, target, path, rounds, pivotDistance } = result;
    const puzzle = await Puzzle.create({
      difficulty, grid, mask, target, path, rounds, pivotDistance,
    });

    const cells = grid.map((row, r) =>
      row.map((v, c) => {
        if (r === target.row && c === target.col) return null;
        return mask[r][c] ? LETTERS[v] : null;
      })
    );

    // Send the full letter grid so client can reveal after answering
    const allLetters = grid.map((row) => row.map((v) => LETTERS[v]));

    res.json({
      puzzleId: puzzle._id,
      difficulty,
      cols: COLS,
      cells,
      allLetters,
      target,
      rounds,
      pivotDistance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to generate puzzle' });
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

    // Determine solve quality
    let solveQuality;
    if (elapsed < GUESS_THRESHOLD_MS && correct) {
      solveQuality = 'guessed';
    } else if (hintUsed) {
      solveQuality = 'hinted';
    } else {
      solveQuality = 'clean';
    }

    if (userId) {
      await Attempt.create({
        userId,
        sessionId: sessionId || null,
        difficulty: puzzle.difficulty,
        rounds: puzzle.rounds,
        pivotDistance: puzzle.pivotDistance,
        correct,
        solveQuality,
        hintUsed,
        elapsedMs: elapsed,
        puzzleSnapshot: { target: puzzle.target, path: puzzle.path },
      });
    }

    // Soft-delete: mark as answered instead of destroying the document
    await Puzzle.updateOne({ _id: puzzle._id }, { $set: { answeredAt: new Date() } });

    res.json({ correct, correctLetter, solveQuality, recorded: !!userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to grade answer' });
  }
});

// GET /api/puzzles/:id/reveal — show answer without grading
router.get('/:id/reveal', async (req, res) => {
  try {
    const userId = getUserId(req);
    const puzzle = await Puzzle.findOne({ _id: req.params.id, answeredAt: null });
    if (!puzzle) {
      return res.status(410).json({ error: 'puzzle expired or already answered' });
    }

    const correctLetter = LETTERS[puzzle.grid[puzzle.target.row][puzzle.target.col]];

    // Record a 'revealed' attempt so it shows up in stats as an ungraded use
    if (userId) {
      await Attempt.create({
        userId,
        difficulty: puzzle.difficulty,
        rounds: puzzle.rounds,
        pivotDistance: puzzle.pivotDistance,
        correct: false,
        solveQuality: 'revealed',
        hintUsed: puzzle.hintUsed,
        elapsedMs: 0,
        puzzleSnapshot: { target: puzzle.target, path: puzzle.path },
      });
    }

    await Puzzle.updateOne({ _id: puzzle._id }, { $set: { answeredAt: new Date() } });
    res.json({ correctLetter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to reveal answer' });
  }
});

// GET /api/puzzles/:id/hint — return pivot cells, mark hint as used on puzzle
router.get('/:id/hint', async (req, res) => {
  try {
    const puzzle = await Puzzle.findOne({ _id: req.params.id, answeredAt: null });
    if (!puzzle) {
      return res.status(410).json({ error: 'puzzle expired or already answered' });
    }

    // Mark hint as used on the puzzle document
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
