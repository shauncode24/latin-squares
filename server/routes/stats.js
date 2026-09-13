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

// NEW: standard deviation of solve times — used as a "consistency" signal.
// Two students can share the same average time but very different reliability;
// avg/median alone can't distinguish them.
function stddev(nums) {
  if (!nums.length) return null;
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
  return Math.round(Math.sqrt(variance));
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
    consistencyMs: times.length ? stddev(times) : null, // NEW
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

// NEW: turns raw solveQuality/patternTag data into plain-language mistake
// diagnosis instead of leaving it as unread badges in Review Mode.
// Deterministic — no AI needed, this is a straightforward aggregation.
function computeDiagnosis(all) {
  const buckets = {};
  for (const a of all) {
    const key = `${a.difficulty}:${a.patternTag || 'direct'}`;
    if (!buckets[key]) {
      buckets[key] = {
        difficulty: a.difficulty,
        patternTag: a.patternTag || 'direct',
        total: 0, correct: 0, rushed: 0, cleanWrong: 0, hinted: 0,
      };
    }
    const b = buckets[key];
    b.total++;
    if (a.correct) b.correct++;
    if (!a.correct) {
      if (a.solveQuality === 'rushed') b.rushed++;
      else if (a.solveQuality === 'clean') b.cleanWrong++;
    }
    if (a.solveQuality === 'hinted') b.hinted++;
  }

  const MIN_SAMPLE = 5;
  const messages = [];
  for (const b of Object.values(buckets)) {
    if (b.total < MIN_SAMPLE) continue;
    const accuracy = Math.round((100 * b.correct) / b.total);
    if (accuracy >= 85) continue; // not weak enough to flag

    const wrongTotal = b.total - b.correct;
    if (wrongTotal === 0) continue;

    const rushedShare = b.rushed / wrongTotal;
    const cleanWrongShare = b.cleanWrong / wrongTotal;
    const hintedShare = b.hinted / b.total;

    let message;
    if (rushedShare >= 0.5) {
      message = `At ${b.difficulty} / ${b.patternTag}, most mistakes come from answering too fast (${Math.round(rushedShare * 100)}% of misses were rushed). Finish the elimination before picking a letter.`;
    } else if (cleanWrongShare >= 0.5) {
      message = `At ${b.difficulty} / ${b.patternTag}, you're taking your time but still landing wrong (${Math.round(cleanWrongShare * 100)}% of misses were careful attempts). This looks like a technique gap on this pattern, not a speed problem.`;
    } else if (hintedShare >= 0.4) {
      message = `At ${b.difficulty} / ${b.patternTag}, you're leaning on hints often (${Math.round(hintedShare * 100)}% of attempts). Try a few unaided first.`;
    } else {
      message = `At ${b.difficulty} / ${b.patternTag}, accuracy is ${accuracy}% over ${b.total} attempts — worth targeted practice.`;
    }

    messages.push({ difficulty: b.difficulty, patternTag: b.patternTag, accuracy, sampleSize: b.total, message });
  }

  messages.sort((a, b) => a.accuracy - b.accuracy); // worst first
  return messages.slice(0, 5);
}

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    if (!req.userId) return res.json({ overall: null, byTier: {}, byPattern: {}, streaks: null, personalBests: {}, mastery: {}, diagnosis: [] });

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
      diagnosis: computeDiagnosis(all), // NEW
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

// GET /api/stats/timeseries?view=hourly|daily&interval=15min|30min|1hr
// Returns per-difficulty keyed data per bucket for grouped bar + best-fit line chart.
router.get('/timeseries', async (req, res) => {
  try {
    if (!req.userId) return res.json({ series: [] });

    const view     = req.query.view === 'daily' ? 'daily' : 'hourly';
    const interval = ['15min', '30min', '1hr'].includes(req.query.interval)
      ? req.query.interval : '1hr';

    let bucketMs, numBuckets, dateKeyFn;

    if (view === 'daily') {
      bucketMs = 24 * 3600000;
      numBuckets = 30;
      dateKeyFn = (ts) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
    } else {
      if (interval === '15min') {
        bucketMs = 15 * 60000;
        numBuckets = 96;
      } else if (interval === '30min') {
        bucketMs = 30 * 60000;
        numBuckets = 96;
      } else {
        bucketMs = 60 * 60000;
        numBuckets = 72;
      }
      dateKeyFn = (ts) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} `
             + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      };
    }

    const now = Date.now();
    const currentBucketTs = Math.floor(now / bucketMs) * bucketMs;
    const startBucketTs = currentBucketTs - (numBuckets - 1) * bucketMs;

    const groups = {};
    for (let ts = startBucketTs; ts <= currentBucketTs; ts += bucketMs) {
      const key = dateKeyFn(ts);
      groups[key] = { date: key, bucketTs: ts };
    }

    const since = new Date(startBucketTs);
    const attempts = await Attempt.find({ userId: req.userId, createdAt: { $gte: since } })
      .select('correct elapsedMs createdAt difficulty')
      .lean();

    for (const a of attempts) {
      const ts       = new Date(a.createdAt).getTime();
      const bucketTs = Math.floor(ts / bucketMs) * bucketMs;
      const key      = dateKeyFn(bucketTs);

      if (!groups[key]) groups[key] = { date: key, bucketTs };
      const diff = a.difficulty;
      if (!groups[key][diff]) groups[key][diff] = { solved: 0, correct: 0, times: [] };
      groups[key][diff].solved++;
      if (a.correct) groups[key][diff].correct++;
      if (a.elapsedMs > 0) groups[key][diff].times.push(a.elapsedMs);
    }

    const series = Object.values(groups)
      .sort((a, b) => a.bucketTs - b.bucketTs)
      .map((g) => {
        const point = { date: g.date };
        for (const tier of ['low', 'medium', 'high']) {
          const t = g[tier];
          point[`${tier}_solved`]     = t ? t.solved : 0;
          point[`${tier}_accuracy`]   = t ? Math.round((100 * t.correct) / t.solved) : null;
          point[`${tier}_avgTimeSec`] = t && t.times.length
            ? Number((t.times.reduce((s, x) => s + x, 0) / (t.times.length * 1000)).toFixed(1))
            : null;
        }
        return point;
      });

    res.json({ series, view, interval });
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