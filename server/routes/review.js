const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const Attempt = require('../models/Attempt');

router.use(attachUser);

// GET /api/review/missed — wrong, hinted, revealed, or rushed attempts
router.get('/missed', async (req, res) => {
  try {
    if (!req.userId) return res.json({ missed: [] });
    const missed = await Attempt.find({
      userId: req.userId,
      $or: [
        { correct: false },
        { solveQuality: { $in: ['hinted', 'revealed', 'rushed'] } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      missed: missed.map((a) => ({
        _id: a._id,
        difficulty: a.difficulty,
        rounds: a.rounds,
        pivotDistance: a.pivotDistance,
        patternTag: a.patternTag,
        correct: a.correct,
        selectedLetter: a.selectedLetter,
        correctLetter: a.correctLetter,
        solveQuality: a.solveQuality,
        elapsedMs: a.elapsedMs,
        createdAt: a.createdAt,
        puzzleSnapshot: a.puzzleSnapshot, // full grid — Review can now actually render it
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load missed puzzles' });
  }
});

module.exports = router;