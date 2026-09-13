const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const Attempt = require('../models/Attempt');
const Session = require('../models/Session');

router.use(attachUser);
const TIERS = ['low', 'medium', 'high'];
const TIER_TARGET_MS = { low: 20000, medium: 50000, high: 75000 };

// Which pattern tags belong to which difficulty tier — used by the
// readiness model's "pattern coverage" axis.
const TIER_PATTERNS = {
  low:    ['direct'],
  medium: ['single-pivot-aligned', 'single-pivot-cross'],
  high:   ['chain-2', 'chain-3'],
};
const ALL_PATTERNS = ['direct', 'single-pivot-aligned', 'single-pivot-cross', 'chain-2', 'chain-3'];
const COVERAGE_MIN_SAMPLE = 5;
const COVERAGE_MIN_ACCURACY = 70;

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function percentile(sortedNums, p) {
  if (!sortedNums.length) return null;
  const idx = Math.min(sortedNums.length - 1, Math.floor(sortedNums.length * p));
  return sortedNums[idx];
}

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
    consistencyMs: times.length ? stddev(times) : null,
    fastestMs: times.length ? Math.min(...times) : null,
    slowestMs: times.length ? Math.max(...times) : null,
    hinted: attempts.filter((a) => a.hintUsed).length,
  };
}

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

// UPDATED: now also folds in hint-timing signal (hintRequestedAtMs) to
// distinguish "reached for a hint almost immediately" (didn't attempt
// elimination) from "hinted after visibly struggling" (attempted, got stuck).
function computeDiagnosis(all) {
  const buckets = {};
  for (const a of all) {
    const key = `${a.difficulty}:${a.patternTag || 'direct'}`;
    if (!buckets[key]) {
      buckets[key] = {
        difficulty: a.difficulty,
        patternTag: a.patternTag || 'direct',
        total: 0, correct: 0, rushed: 0, cleanWrong: 0, hinted: 0,
        quickHints: 0, struggledHints: 0,
      };
    }
    const b = buckets[key];
    b.total++;
    if (a.correct) b.correct++;
    if (!a.correct) {
      if (a.solveQuality === 'rushed') b.rushed++;
      else if (a.solveQuality === 'clean') b.cleanWrong++;
    }
    if (a.solveQuality === 'hinted') {
      b.hinted++;
      // NEW: split hint requests by how quickly they were requested.
      if (a.hintRequestedAtMs != null) {
        if (a.hintRequestedAtMs < 3000) b.quickHints++;
        else b.struggledHints++;
      }
    }
  }

  const MIN_SAMPLE = 5;
  const messages = [];
  for (const b of Object.values(buckets)) {
    if (b.total < MIN_SAMPLE) continue;
    const accuracy = Math.round((100 * b.correct) / b.total);
    if (accuracy >= 85) continue;

    const wrongTotal = b.total - b.correct;
    if (wrongTotal === 0) continue;

    const rushedShare = b.rushed / wrongTotal;
    const cleanWrongShare = b.cleanWrong / wrongTotal;
    const hintedShare = b.hinted / b.total;
    const quickHintShare = b.hinted > 0 ? b.quickHints / b.hinted : 0;

    let message;
    if (rushedShare >= 0.5) {
      message = `At ${b.difficulty} / ${b.patternTag}, most mistakes come from answering too fast (${Math.round(rushedShare * 100)}% of misses were rushed). Finish the elimination before picking a letter.`;
    } else if (hintedShare >= 0.4 && quickHintShare >= 0.6) {
      // NEW branch: hint use is high AND most of those hints were requested
      // almost immediately — this reads as "not attempting elimination",
      // not "getting stuck", which needs different advice.
      message = `At ${b.difficulty} / ${b.patternTag}, you're requesting hints almost immediately (${Math.round(quickHintShare * 100)}% of hints came within 3s) rather than attempting elimination first. Try scanning the row and column yourself before asking for help.`;
    } else if (cleanWrongShare >= 0.5) {
      message = `At ${b.difficulty} / ${b.patternTag}, you're taking your time but still landing wrong (${Math.round(cleanWrongShare * 100)}% of misses were careful attempts). This looks like a technique gap on this pattern, not a speed problem.`;
    } else if (hintedShare >= 0.4) {
      message = `At ${b.difficulty} / ${b.patternTag}, you're leaning on hints often (${Math.round(hintedShare * 100)}% of attempts), typically after some genuine effort. Try a few unaided first to build the pattern into memory.`;
    } else {
      message = `At ${b.difficulty} / ${b.patternTag}, accuracy is ${accuracy}% over ${b.total} attempts — worth targeted practice.`;
    }

    messages.push({ difficulty: b.difficulty, patternTag: b.patternTag, accuracy, sampleSize: b.total, message });
  }

  messages.sort((a, b) => a.accuracy - b.accuracy);
  return messages.slice(0, 5);
}

// NEW: combines accuracy weakness AND speed weakness into one ranked list.
// Previously /weakest only ever surfaced low-accuracy buckets, so a bucket
// where the user is accurate but consistently over time-target was
// invisible. Each bucket gets a 0-100 "priority" score blending both.
function computeWeaknessCandidates(recent) {
  const buckets = {};
  for (const a of recent) {
    const key = `${a.difficulty}:${a.rounds}:${a.patternTag}`;
    if (!buckets[key]) {
      buckets[key] = {
        difficulty: a.difficulty, rounds: a.rounds, patternTag: a.patternTag,
        pivotDistances: [], correct: 0, total: 0, times: [],
      };
    }
    const b = buckets[key];
    b.total++;
    if (a.correct) b.correct++;
    b.pivotDistances.push(a.pivotDistance);
    if (a.elapsedMs > 0) b.times.push(a.elapsedMs);
  }

  const candidates = [];
  for (const b of Object.values(buckets)) {
    if (b.total < COVERAGE_MIN_SAMPLE) continue;
    const accuracy = (100 * b.correct) / b.total;
    const target = TIER_TARGET_MS[b.difficulty] || TIER_TARGET_MS.medium;
    const avgTime = b.times.length ? b.times.reduce((s, t) => s + t, 0) / b.times.length : null;

    const accuracyDeficit = Math.max(0, 100 - accuracy); // 0-100, higher = worse
    const speedDeficit = avgTime != null
      ? Math.max(0, Math.min(100, ((avgTime - target) / target) * 100)) // % over target, capped
      : 0;

    // Weighted blend: accuracy matters more than speed for "weakest",
    // but a purely-accurate-yet-very-slow bucket can still surface.
    const priority = accuracyDeficit * 0.7 + speedDeficit * 0.3;
    const reason = accuracyDeficit >= speedDeficit ? 'accuracy' : 'speed';

    candidates.push({
      difficulty: b.difficulty,
      rounds: b.rounds,
      patternTag: b.patternTag,
      pivotDistance: median(b.pivotDistances),
      accuracy: Math.round(accuracy),
      avgTimeMs: avgTime != null ? Math.round(avgTime) : null,
      targetMs: target,
      sampleSize: b.total,
      priority: Math.round(priority),
      reason,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
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
      diagnosis: computeDiagnosis(all),
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

// GET /api/stats/weakest — UPDATED: now speed-aware, not accuracy-only.
router.get('/weakest', async (req, res) => {
  try {
    if (!req.userId) return res.json({ weakest: null, weakestList: [] });
    const recent = await Attempt.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('rounds pivotDistance patternTag difficulty correct elapsedMs')
      .lean();

    const ranked = computeWeaknessCandidates(recent);
    res.json({
      weakest: ranked[0] || null,
      weakestList: ranked.slice(0, 5), // top few, for future UI use
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to compute weakest bucket' });
  }
});

// GET /api/stats/trend
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

// NEW: GET /api/stats/personal-targets
// Adaptive per-tier time targets based on the user's own recent clean-solve
// times (75th percentile of last 10), instead of a fixed global constant.
// Floored at half the static default so a small lucky sample can't produce
// an unreasonably aggressive target.
router.get('/personal-targets', async (req, res) => {
  try {
    if (!req.userId) return res.json({ targets: TIER_TARGET_MS, personalized: false });

    const targets = {};
    let anyPersonalized = false;

    for (const t of TIERS) {
      const recent = await Attempt.find({
        userId: req.userId, difficulty: t, correct: true, solveQuality: 'clean',
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('elapsedMs')
        .lean();

      const times = recent.map((a) => a.elapsedMs).filter((x) => x > 0).sort((a, b) => a - b);
      if (times.length >= 5) {
        const p75 = percentile(times, 0.75);
        targets[t] = Math.max(p75, Math.round(TIER_TARGET_MS[t] * 0.5));
        anyPersonalized = true;
      } else {
        targets[t] = TIER_TARGET_MS[t];
      }
    }

    res.json({ targets, personalized: anyPersonalized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to compute personal targets' });
  }
});

// NEW: GET /api/stats/readiness
// Synthesizes existing signals (mastery, pattern coverage, exam-sim
// performance, consistency) into a structured per-tier verdict, instead of
// leaving the user to mentally combine Stats + Dashboard + Exam summaries.
router.get('/readiness', async (req, res) => {
  try {
    if (!req.userId) return res.json({ insufficientData: true });

    const all = await Attempt.find({ userId: req.userId }).lean();
    if (all.length < 10) return res.json({ insufficientData: true, solved: all.length });

    const byTier = {};
    for (const t of TIERS) byTier[t] = summarize(all.filter((a) => a.difficulty === t));
    const mastery = computeMastery(byTier);

    const byPattern = {};
    for (const a of all) {
      const key = a.patternTag || 'direct';
      if (!byPattern[key]) byPattern[key] = [];
      byPattern[key].push(a);
    }

    // Pattern coverage per tier: of the patterns that belong to this tier,
    // how many has the user actually demonstrated competence on?
    const patternCoverage = {};
    const missingPatterns = {};
    for (const t of TIERS) {
      const relevant = TIER_PATTERNS[t];
      let covered = 0;
      const missing = [];
      for (const p of relevant) {
        const attempts = byPattern[p] || [];
        const acc = attempts.length ? (100 * attempts.filter((a) => a.correct).length) / attempts.length : 0;
        if (attempts.length >= COVERAGE_MIN_SAMPLE && acc >= COVERAGE_MIN_ACCURACY) {
          covered++;
        } else {
          missing.push(p);
        }
      }
      patternCoverage[t] = { covered, total: relevant.length };
      missingPatterns[t] = missing;
    }

    // Exam-condition performance: pull the last few completed simulations.
    const simSessions = await Session.find({
      userId: req.userId, mode: 'simulation', completedAt: { $ne: null },
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .select('summary completedAt')
      .lean();

    let examPerformance = null;
    if (simSessions.length > 0) {
      const latest = simSessions[0].summary;
      const latestAcc = latest.attempted ? Math.round((100 * latest.correct) / latest.attempted) : null;
      let trend = 'flat';
      if (simSessions.length >= 2) {
        const prev = simSessions[1].summary;
        const prevAcc = prev.attempted ? Math.round((100 * prev.correct) / prev.attempted) : null;
        if (latestAcc != null && prevAcc != null) {
          if (latestAcc > prevAcc + 3) trend = 'improving';
          else if (latestAcc < prevAcc - 3) trend = 'declining';
        }
      }
      examPerformance = {
        runsCompleted: simSessions.length,
        latestAccuracy: latestAcc,
        latestAvgTimeMs: latest.avgTimeMs,
        trend,
      };
    }

    // Per-tier verdict: combine mastery label + pattern coverage. A tier
    // can't be "ready" if it hasn't demonstrated every relevant pattern,
    // even if raw accuracy/speed numbers look fine in aggregate.
    const verdict = {};
    for (const t of TIERS) {
      const cov = patternCoverage[t];
      const fullyCovered = cov.covered === cov.total;
      if (mastery[t] === 'exam-ready' && fullyCovered) verdict[t] = 'ready';
      else if (mastery[t] === 'learning' || cov.covered === 0) verdict[t] = 'not-ready';
      else verdict[t] = 'building';
    }

    const readyTiers = TIERS.filter((t) => verdict[t] === 'ready');
    const notReadyTiers = TIERS.filter((t) => verdict[t] === 'not-ready');

    let summary;
    if (readyTiers.length === TIERS.length) {
      summary = 'Exam-ready across all difficulty tiers — every pattern type is covered at strong accuracy and speed.';
    } else if (notReadyTiers.length === TIERS.length) {
      summary = 'Still in the early building phase across all tiers. Focus on accuracy before worrying about speed.';
    } else {
      const readyStr = readyTiers.length ? readyTiers.join(', ') : 'none';
      const gapTier = notReadyTiers[0] || TIERS.find((t) => verdict[t] === 'building');
      const gapPatterns = missingPatterns[gapTier] || [];
      summary = `Ready on: ${readyStr}. Biggest gap is ${gapTier}${
        gapPatterns.length ? ` — missing coverage on ${gapPatterns.join(', ')}` : ''
      }.`;
    }

    res.json({
      insufficientData: false,
      axes: {
        byTier,
        mastery,
        patternCoverage,
        missingPatterns,
        examPerformance,
        consistency: Object.fromEntries(TIERS.map((t) => [t, byTier[t].consistencyMs])),
      },
      verdict,
      summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to compute readiness' });
  }
});

module.exports = router;