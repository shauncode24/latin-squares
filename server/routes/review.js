const express = require('express');
const router = express.Router();
const { getUserId } = require('../middleware/auth');
const Attempt = require('../models/Attempt');

// GET /api/review/missed — last 20 incorrect or hinted attempts with puzzle snapshots
router.get('/missed', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });

    const missed = await Attempt.find({
      userId,
      $or: [{ correct: false }, { solveQuality: 'hinted' }, { solveQuality: 'revealed' }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('difficulty rounds pivotDistance correct solveQuality elapsedMs puzzleSnapshot createdAt -_id')
      .lean();

    res.json({ missed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch missed attempts' });
  }
});

module.exports = router;
