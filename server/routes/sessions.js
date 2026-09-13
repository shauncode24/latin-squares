const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const Session = require('../models/Session');
const Attempt = require('../models/Attempt');
const SpacedRepetition = require('../models/SpacedRepetition');
const { applySM2, pivotBucket } = require('../lib/sm2');

router.use(attachUser);

function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'sign in required' });
  next();
}

// POST /api/sessions
router.post('/', requireAuth, async (req, res) => {
  try {
    const { mode, difficulty, questionCount } = req.body;
    if (!['practice', 'exam', 'simulation'].includes(mode)) {
      return res.status(400).json({ error: 'invalid mode' });
    }
    if (!questionCount || questionCount < 1) {
      return res.status(400).json({ error: 'questionCount must be a positive number' });
    }
    const session = await Session.create({
      userId: req.userId,
      mode,
      difficulty: difficulty || 'mixed',
      questionCount,
    });
    res.status(201).json({
      sessionId: session._id,
      mode: session.mode,
      difficulty: session.difficulty,
      questionCount: session.questionCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to start session' });
  }
});

// GET /api/sessions/simulations/history — must come before /:id so it isn't
// swallowed as an id param.
router.get('/simulations/history', requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.userId,
      mode: 'simulation',
      completedAt: { $ne: null },
    })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('summary completedAt questionCount')
      .lean();
    res.json({ simulations: sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load simulation history' });
  }
});

// GET /api/sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!session) return res.status(404).json({ error: 'session not found' });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load session' });
  }
});

// PATCH /api/sessions/:id/complete
router.patch('/:id/complete', requireAuth, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'session not found' });
    if (session.completedAt) return res.json({ summary: session.summary });

    const attempts = await Attempt.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean();

    const attempted = attempts.length;
    const correct = attempts.filter((a) => a.correct).length;
    const hinted = attempts.filter((a) => a.hintUsed).length;
    const revealed = attempts.filter((a) => a.solveQuality === 'revealed').length;
    const times = attempts.map((a) => a.elapsedMs).filter((t) => t > 0);
    const avgTimeMs = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;

    let streak = 0, run = 0;
    for (const a of attempts) {
      run = a.correct ? run + 1 : 0;
      streak = Math.max(streak, run);
    }

    const byTier = {};
    for (const a of attempts) {
      if (!byTier[a.difficulty]) byTier[a.difficulty] = { attempted: 0, correct: 0 };
      byTier[a.difficulty].attempted++;
      if (a.correct) byTier[a.difficulty].correct++;
    }

    session.summary = { attempted, correct, hinted, revealed, avgTimeMs, streak, byTier };
    session.completedAt = new Date();
    await session.save();

    // Feed every attempt from this session into the spaced-repetition
    // scheduler too, so session-based practice (not just ad-hoc /api/sr/review
    // calls from Review/Weakness mode) builds real review history.
    for (const a of attempts) {
      const patternKey = `${a.difficulty}:${a.rounds}:${pivotBucket(a.pivotDistance)}`;
      let record = await SpacedRepetition.findOne({ userId: req.userId, patternKey });
      if (!record) record = new SpacedRepetition({ userId: req.userId, patternKey });
      applySM2(record, a.correct);
      await record.save();
    }

    res.json({ summary: session.summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to complete session' });
  }
});

module.exports = router;