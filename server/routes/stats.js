const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getUserId } = require('../middleware/auth');
const Attempt = require('../models/Attempt');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const objectId = new mongoose.Types.ObjectId(userId);

    // --- Per-tier aggregation ---
    const rows = await Attempt.aggregate([
      { $match: { userId: objectId, solveQuality: { $ne: 'revealed' } } },
      {
        $group: {
          _id: '$difficulty',
          solved:    { $sum: 1 },
          correct:   { $sum: { $cond: ['$correct', 1, 0] } },
          clean:     { $sum: { $cond: [{ $eq: ['$solveQuality', 'clean'] }, 1, 0] } },
          hinted:    { $sum: { $cond: [{ $eq: ['$solveQuality', 'hinted'] }, 1, 0] } },
          guessed:   { $sum: { $cond: [{ $eq: ['$solveQuality', 'guessed'] }, 1, 0] } },
          avgTimeMs: { $avg: '$elapsedMs' },
        },
      },
    ]);

    const byTier = {};
    let totalSolved = 0, totalCorrect = 0, timeSum = 0;
    for (const r of rows) {
      byTier[r._id] = {
        solved:    r.solved,
        correct:   r.correct,
        clean:     r.clean,
        hinted:    r.hinted,
        guessed:   r.guessed,
        accuracy:  r.solved ? Math.round((100 * r.correct) / r.solved) : null,
        avgTimeMs: Math.round(r.avgTimeMs || 0),
      };
      totalSolved  += r.solved;
      totalCorrect += r.correct;
      timeSum      += (r.avgTimeMs || 0) * r.solved;
    }

    const overall = {
      solved:    totalSolved,
      correct:   totalCorrect,
      accuracy:  totalSolved ? Math.round((100 * totalCorrect) / totalSolved) : null,
      avgTimeMs: totalSolved ? Math.round(timeSum / totalSolved) : null,
    };

    // --- Streaks (consecutive calendar days with >= 1 correct) ---
    const dailyCorrect = await Attempt.aggregate([
      { $match: { userId: objectId, correct: true } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const days = dailyCorrect.map((d) => d._id);
    let currentStreak = 0, bestStreak = 0, streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    let expected = today;
    for (const day of days) {
      if (day === expected) {
        streak++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
    currentStreak = streak;

    // Best streak — scan all days in order
    const allDays = [...days].reverse();
    let run = 0;
    for (let i = 0; i < allDays.length; i++) {
      if (i === 0) { run = 1; continue; }
      const prev = new Date(allDays[i - 1]);
      prev.setDate(prev.getDate() + 1);
      if (prev.toISOString().slice(0, 10) === allDays[i]) {
        run++;
      } else {
        run = 1;
      }
      if (run > bestStreak) bestStreak = run;
    }
    if (run > bestStreak) bestStreak = run;

    // --- Personal bests (fastest clean solve per tier) ---
    const pbRows = await Attempt.aggregate([
      { $match: { userId: objectId, correct: true, solveQuality: 'clean' } },
      {
        $group: {
          _id: '$difficulty',
          fastestMs: { $min: '$elapsedMs' },
        },
      },
    ]);
    const personalBests = {};
    for (const r of pbRows) personalBests[r._id] = r.fastestMs;

    res.json({
      overall,
      byTier,
      streaks:       { current: currentStreak, best: bestStreak },
      personalBests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch stats' });
  }
});

// GET /api/stats/history
router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const objectId = new mongoose.Types.ObjectId(userId);

    const history = await Attempt.find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('difficulty correct elapsedMs solveQuality hintUsed rounds createdAt -_id')
      .lean();

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch history' });
  }
});

// GET /api/stats/timeseries?bucket=daily|weekly
router.get('/timeseries', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const objectId = new mongoose.Types.ObjectId(userId);
    const bucket = req.query.bucket === 'weekly' ? 'weekly' : 'daily';

    const format = bucket === 'daily' ? '%Y-%m-%d' : '%Y-W%V';
    const lookbackDays = bucket === 'daily' ? 30 : 84; // 30 days or 12 weeks
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const rows = await Attempt.aggregate([
      { $match: { userId: objectId, createdAt: { $gte: since }, solveQuality: { $ne: 'revealed' } } },
      {
        $group: {
          _id:       { $dateToString: { format, date: '$createdAt' } },
          solved:    { $sum: 1 },
          correct:   { $sum: { $cond: ['$correct', 1, 0] } },
          avgTimeMs: { $avg: '$elapsedMs' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      bucket,
      series: rows.map((r) => ({
        date:      r._id,
        solved:    r.solved,
        correct:   r.correct,
        avgTimeMs: Math.round(r.avgTimeMs || 0),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch timeseries' });
  }
});

module.exports = router;
