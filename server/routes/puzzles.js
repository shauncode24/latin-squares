const express = require('express');
const router = express.Router();
const { getUserId } = require('../middleware/auth');
const Puzzle = require('../models/Puzzle');
const Attempt = require('../models/Attempt');
const { generatePuzzle, LETTERS, COLS } = require('../lib/generator');

const TIERS = ['low', 'medium', 'high'];

// Create a new puzzle server-side and return only what the client should see:
// revealed letters and blanks, never the solution.
router.post('/generate', async (req, res) => {
  try {
    const { difficulty } = req.body;
    if (!TIERS.includes(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be low, medium, or high' });
    }

    const { grid, mask, target, path, rounds } = generatePuzzle(difficulty);
    const puzzle = await Puzzle.create({ difficulty, grid, mask, target, path });

    const cells = grid.map((row, r) =>
      row.map((v, c) => {
        if (r === target.row && c === target.col) return null;
        return mask[r][c] ? LETTERS[v] : null;
      })
    );

    res.json({
      puzzleId: puzzle._id,
      difficulty,
      cols: COLS,
      cells,
      target,
      rounds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to generate puzzle' });
  }
});

// Grade an answer. If user is logged in, record the Attempt. Retire the puzzle (single use).
router.post('/:id/answer', async (req, res) => {
  try {
    const { letter, elapsedMs } = req.body;
    const userId = getUserId(req);

    if (!LETTERS.includes(letter)) return res.status(400).json({ error: 'invalid letter' });

    const puzzle = await Puzzle.findById(req.params.id);
    if (!puzzle) return res.status(410).json({ error: 'puzzle expired or already answered' });

    const correctLetter = LETTERS[puzzle.grid[puzzle.target.row][puzzle.target.col]];
    const correct = letter === correctLetter;

    // Only record attempt for authenticated users
    if (userId) {
      await Attempt.create({
        userId,
        difficulty: puzzle.difficulty,
        correct,
        elapsedMs: Number(elapsedMs) || 0,
      });
    }

    await Puzzle.deleteOne({ _id: puzzle._id });
    res.json({ correct, correctLetter, recorded: !!userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to grade answer' });
  }
});

// Reveal the answer without recording a graded attempt.
router.get('/:id/reveal', async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id);
    if (!puzzle) return res.status(410).json({ error: 'puzzle expired or already answered' });
    const correctLetter = LETTERS[puzzle.grid[puzzle.target.row][puzzle.target.col]];
    await Puzzle.deleteOne({ _id: puzzle._id });
    res.json({ correctLetter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to reveal answer' });
  }
});

// Return the first round's pivot cell(s), coordinates only, no letters.
router.get('/:id/hint', async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id);
    if (!puzzle) return res.status(410).json({ error: 'puzzle expired or already answered' });
    const firstRound = puzzle.path && puzzle.path.length ? puzzle.path[0] : [];
    res.json({ pivotCells: firstRound, direct: firstRound.length === 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch hint' });
  }
});

module.exports = router;
