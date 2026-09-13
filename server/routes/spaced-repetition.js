const express = require('express');
const router = express.Router();
const { getUserId } = require('../middleware/auth');
const SpacedRepetition = require('../models/SpacedRepetition');
const Attempt = require('../models/Attempt');

/**
 * SM-2 algorithm update.
 * quality: 0-5 (0-1 = fail, 2-5 = pass)
 */
function sm2Update(record, quality) {
  let { interval, repetitions, easeFactor } = record;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + interval);
  return { interval, repetitions, easeFactor, dueAt, lastReviewAt: new Date() };
}

function pivotBucket(d) {
  if (d <= 1) return 0;
  if (d <= 3) return 2;
  return 4;
}

function patternKey(difficulty, rounds, pivotDistance) {
  return `${difficulty}:${rounds}:${pivotBucket(pivotDistance)}`;
}

// GET /api/sr/due — get due patterns with counts
router.get('/due', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const now = new Date();
    const due = await SpacedRepetition.find({ userId, dueAt: { $lte: now } })
      .sort({ dueAt: 1 })
      .limit(20)
      .lean();
    res.json({ due });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch due items' });
  }
});

// POST /api/sr/review — update SM-2 record after a review attempt
router.post('/review', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const { difficulty, rounds, pivotDistance, correct, hintUsed } = req.body;

    // Map outcome to SM-2 quality (0-5)
    let quality;
    if (!correct) quality = 1;
    else if (hintUsed) quality = 3;
    else quality = 5;

    const key = patternKey(difficulty, rounds, pivotDistance);
    let record = await SpacedRepetition.findOne({ userId, patternKey: key });
    if (!record) {
      record = new SpacedRepetition({ userId, patternKey: key });
    }
    const updates = sm2Update(record, quality);
    Object.assign(record, updates);
    await record.save();

    res.json({ patternKey: key, nextDue: record.dueAt, interval: record.interval });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update SR record' });
  }
});

module.exports = router;
