const express = require('express');
const router = express.Router();
const Attempt = require('../models/Attempt');

router.get('/', async (req, res) => {
  try {
    const clientId = req.query.clientId || req.header('x-client-id');
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const rows = await Attempt.aggregate([
      { $match: { clientId } },
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

module.exports = router;
