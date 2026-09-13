const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getUserId } = require('../middleware/auth');
const Session = require('../models/Session');
const Attempt = require('../models/Attempt');

// POST /api/sessions — create a new session
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const { mode, difficulty, questionCount } = req.body;
    if (!['practice', 'exam'].includes(mode)) return res.status(400).json({ error: 'invalid mode' });
    if (!['low', 'medium', 'high', 'mixed'].includes(difficulty)) return res.status(400).json({ error: 'invalid difficulty' });
    if (!questionCount || questionCount < 1 || questionCount > 50) return res.status(400).json({ error: 'questionCount must be 1-50' });
    const session = await Session.create({ userId, mode, difficulty, questionCount });
    res.status(201).json({ sessionId: session._id, mode, difficulty, questionCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create session' });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const session = await Session.findOne({ _id: req.params.id, userId });
    if (!session) return res.status(404).json({ error: 'session not found' });
    const attempts = await Attempt.find({ sessionId: session._id }).sort({ createdAt: 1 }).select('-__v').lean();
    res.json({ session, attempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to get session' });
  }
});

// PATCH /api/sessions/:id/complete — finalize session and compute summary
router.patch('/:id/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'not authenticated' });
    const session = await Session.findOne({ _id: req.params.id, userId });
    if (!session) return res.status(404).json({ error: 'session not found' });
    if (session.completedAt) return res.status(409).json({ error: 'already completed' });

    const objectId = new mongoose.Types.ObjectId(session._id);
    const attempts = await Attempt.find({ sessionId: objectId }).sort({ createdAt: 1 }).lean();

    let correct = 0, hinted = 0, revealed = 0, timeSum = 0, timeCt = 0;
    let streak = 0, maxStreak = 0, curStreak = 0;
    for (const a of attempts) {
      if (a.solveQuality === 'revealed') { revealed++; curStreak = 0; continue; }
      if (a.correct) { correct++; curStreak++; } else { curStreak = 0; }
      if (a.hintUsed) hinted++;
      if (a.elapsedMs > 0) { timeSum += a.elapsedMs; timeCt++; }
      if (curStreak > maxStreak) maxStreak = curStreak;
    }

    const summary = {
      attempted: attempts.length,
      correct,
      hinted,
      revealed,
      avgTimeMs: timeCt ? Math.round(timeSum / timeCt) : null,
      streak:    maxStreak,
    };

    session.completedAt = new Date();
    session.summary = summary;
    await session.save();
    res.json({ session, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to complete session' });
  }
});

module.exports = router;
