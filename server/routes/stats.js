const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getUserId } = require('../middleware/auth');
const Attempt = require('../models/Attempt');

// GET /api/stats — aggregated summary + per-tier breakdown
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });

    const objectId = new mongoose.Types.ObjectId(userId);

    const rows = await Attempt.aggregate([
      { $match: { userId: objectId } },
      {
        $group: {
          _id: '$difficulty',
          solved: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } },
          avgTimeMs: { $avg: '$elapsedMs' },
        },
      },
    ]);

    const byTier = {};
    let solved = 0;
    let correct = 0;
    let timeSum = 0;

    for (const r of rows) {
      byTier[r._id] = {
        solved: r.solved,
        correct: r.correct,
        accuracy: r.solved ? Math.round((100 * r.correct) / r.solved) : null,
        avgTimeMs: Math.round(r.avgTimeMs || 0),
      };
      solved += r.solved;
      correct += r.correct;
      timeSum += (r.avgTimeMs || 0) * r.solved;
    }

    const overall = {
      solved,
      correct,
      accuracy: solved ? Math.round((100 * correct) / solved) : null,
      avgTimeMs: solved ? Math.round(timeSum / solved) : null,
    };

    res.json({ overall, byTier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch stats' });
  }
});

// GET /api/stats/history — last 50 attempts newest-first
router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });

    const objectId = new mongoose.Types.ObjectId(userId);

    const history = await Attempt.find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('difficulty correct elapsedMs createdAt -_id')
      .lean();

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch history' });
  }
});

module.exports = router;
