const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const Attempt = require('../models/Attempt');
const { narrateDiagnosis, narrateStrategy } = require('../lib/aiCoach');

router.use(attachUser);

function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'sign in required' });
  next();
}

// POST /api/coach/diagnosis  { diagnosis: [...] }
// The client sends the diagnosis array it already got from /api/stats, so
// this route stays a thin narration layer and never re-derives the numbers.
router.post('/diagnosis', requireAuth, async (req, res) => {
  try {
    const { diagnosis } = req.body;
    if (!diagnosis || !diagnosis.length) return res.json({ narration: null });
    const narration = await narrateDiagnosis(diagnosis);
    res.json({ narration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI coaching is temporarily unavailable' });
  }
});

// GET /api/coach/strategy — analyzes the last 40 attempts in chronological order
router.get('/strategy', requireAuth, async (req, res) => {
  try {
    const recent = await Attempt.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(40)
      .select('difficulty patternTag rounds pivotDistance correct elapsedMs hintUsed createdAt')
      .lean();
    recent.reverse(); // chronological
    if (recent.length < 5) return res.json({ narration: null, insufficientData: true });
    const narration = await narrateStrategy(recent);
    res.json({ narration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI coaching is temporarily unavailable' });
  }
});

module.exports = router;