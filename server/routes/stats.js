const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const Attempt = require('../models/Attempt');

router.use(attachUser);
const TIERS = ['low', 'medium', 'high'];
const TIER_TARGET_MS = { low: 20000, medium: 50000, high: 75000 };

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function summarize(attempts) {
  const solved = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const times = attempts.map((a) => a.elapsedMs).filter((t) => t > 0);
  return {
    solved,
    correct,
    accuracy: solved ? Math.round((100 * correct) / solved) : null,
    avgTimeMs: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null,
    medianTimeMs: median(times),
    fastestMs: times.length ? Math.min(...times) : null,
    slowestMs: times.length ? Math.max(...times) : null,
    hinted: attempts.filter((a) => a.hintUsed).length,
  };
}

// NEW: composite Learning -> Competent -> Fast -> Exam-Ready progression per
// tier, based on sample size, accuracy, and whether average time beats the
// tier's target.
function computeMastery(byTier) {
  const mastery = {};
  for (const t of TIERS) {
    const d = byTier[t];
    if (!d || d.solved < 5 || d.accuracy == null) { mastery[t] = 'learning'; continue; }
    const fastEnough = d.avgTimeMs != null && d.avgTimeMs <= TIER_TARGET_MS[t];
    if (d.accuracy >= 90 && fastEnough && d.solved >= 15) mastery[t] = 'exam-ready';
    else if (d.accuracy >= 85 && fastEnough) mastery[t] = 'fast';
    else if (d.accuracy >= 60) mastery[t] = 'competent';
    else mastery[t] = 'learning';
  }
  return mastery;
}

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    if (!req.userId) return res.json({ overall: null, byTier: {}, byPattern: {}, streaks: null, personalBests: {}, mastery: {} });

    const all = await Attempt.find({ userId: req.userId }).lean();
    const overall = summarize(all);
    overall.totalPracticeMs = all.reduce((s, a) => s + (a.elapsedMs || 0), 0);

    const byTier = {};
    for (const t of TIERS) byTier[t] = summarize(all.filter((a) => a.difficulty === t));

    const byPattern = {};
    for (const a of all) {
      const key = a.patternTag || 'direct';
      if (!byPattern[key]) byPattern[key] = [];
      byPattern[key].push(a);
    }
    for (const key of Object.keys(byPattern)) byPattern[key] = summarize(byPattern[key]);

    const cleanByTier = {};
    for (const t of TIERS) {
      const times = all
        .filter((a) => a.difficulty === t && a.correct && a.solveQuality === 'clean')
        .map((a) => a.elapsedMs);
      cleanByTier[t] = times.length ? Math.min(...times) : null;
    }

    // Day streak from distinct practice dates
    const days = [...new Set(all.map((a) => new Date(a.createdAt).toISOString().slice(0, 10)))].sort();
    let current = 0, best = 0, run = 0, prev = null;
    for (const d of days) {
      if (prev) {
        const gap = (new Date(d) - new Date(prev)) / 86400000;
        run = gap === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      best = Math.max(best, run);
      prev = d;
    }
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    current = days.includes(today) || days.includes(yesterday) ? run : 0;

    res.json({
      overall, byTier, byPattern,
      streaks: { current, best },
      personalBests: cleanByTier,
      mastery: computeMastery(byTier),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load stats' });
  }
});

// GET /api/stats/history
router.get('/history', async (req, res) => {
  try {
    if (!req.userId) return res.json({ history: [] });
    const history = await Attempt.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('difficulty correct elapsedMs hintUsed createdAt patternTag')
      .lean();
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load history' });
  }
});

// GET /api/stats/timeseries?bucket=hourly|daily
router.get('/timeseries', async (req, res) => {
  try {
    if (!req.userId) return res.json({ series: [] });
    const bucket = req.query.bucket === 'hourly' ? 'hourly' : 'daily';
    const hours = bucket === 'hourly' ? 48 : 720;
    const since = new Date(Date.now() - hours * 3600000);
    const attempts = await Attempt.find({ userId: req.userId, createdAt: { $gte: since } })
      .select('correct elapsedMs createdAt')
      .lean();

    const groups = {};
    for (const a of attempts) {
      const d = new Date(a.createdAt);
      let key;
      if (bucket === 'hourly') {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        const hr = String(d.getHours()).padStart(2, '0');
        key = `${yr}-${mo}-${dy} ${hr}:00`;
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!groups[key]) groups[key] = { date: key, solved: 0, correct: 0, times: [] };
      groups[key].solved++;
      if (a.correct) groups[key].correct++;
      if (a.elapsedMs) groups[key].times.push(a.elapsedMs);
    }
    const series = Object.values(groups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((g) => ({
        date: g.date,
        solved: g.solved,
        correct: g.correct,
        accuracy: g.solved ? Math.round((100 * g.correct) / g.solved) : 0,
        avgTimeSec: g.times.length ? Number((g.times.reduce((s, t) => s + t, 0) / (g.times.length * 1000)).toFixed(1)) : null,
      }));

    res.json({ series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load timeseries' });
  }
});

// GET /api/stats/weakest — powers Weakness Mode + Dashboard's "do this next".
router.get('/weakest', async (req, res) => {
  try {
    if (!req.userId) return res.json({ weakest: null });
    const recent = await Attempt.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('rounds pivotDistance patternTag difficulty correct elapsedMs')
      .lean();

    const buckets = {};
    for (const a of recent) {
      const key = `${a.difficulty}:${a.rounds}:${a.patternTag}`;
      if (!buckets[key]) buckets[key] = { difficulty: a.difficulty, rounds: a.rounds, patternTag: a.patternTag, pivotDistances: [], correct: 0, total: 0 };
      buckets[key].total++;
      if (a.correct) buckets[key].correct++;
      buckets[key].pivotDistances.push(a.pivotDistance);
    }

    const MIN_SAMPLE = 5;
    let weakest = null;
    for (const b of Object.values(buckets)) {
      if (b.total < MIN_SAMPLE) continue;
      const accuracy = (100 * b.correct) / b.total;
      if (!weakest || accuracy < weakest.accuracy) {
        weakest = {
          difficulty: b.difficulty,
          rounds: b.rounds,
          patternTag: b.patternTag,
          pivotDistance: median(b.pivotDistances),
          accuracy: Math.round(accuracy),
          sampleSize: b.total,
        };
      }
    }
    res.json({ weakest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to compute weakest bucket' });
  }
});

// GET /api/stats/trend — this day vs yesterday, for the Dashboard's trend arrows
router.get('/trend', async (req, res) => {
  try {
    if (!req.userId) return res.json({ trend: null });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

    const [thisDay, prevDay] = await Promise.all([
      Attempt.find({ userId: req.userId, createdAt: { $gte: startOfToday } }).lean(),
      Attempt.find({ userId: req.userId, createdAt: { $gte: startOfYesterday, $lt: startOfToday } }).lean(),
    ]);
    const cur = summarize(thisDay);
    const prev = summarize(prevDay);
    res.json({
      trend: {
        current: cur,
        previous: prev,
        solvedDelta: cur.solved - prev.solved,
        accuracyDelta: (cur.accuracy ?? 0) - (prev.accuracy ?? 0),
        avgTimeDeltaMs: prev.avgTimeMs != null && cur.avgTimeMs != null ? cur.avgTimeMs - prev.avgTimeMs : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to compute trend' });
  }
});

module.exports = router;