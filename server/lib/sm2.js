const MIN_EASE = 1.3;

/**
 * Buckets raw pivotDistance into a coarse range so pattern keys stay stable
 * across puzzles that are structurally "the same kind of hard."
 */
function pivotBucket(pivotDistance) {
  const d = pivotDistance || 0;
  if (d <= 1) return '0-1';
  if (d <= 3) return '2-3';
  return '4+';
}

/**
 * Mutates `record` (a SpacedRepetition doc, or any object with the same
 * fields) in place, applying one SM-2 review step. `correct` is treated as
 * a binary signal mapped onto SM-2's 0–5 quality scale (5 = perfect recall,
 * 2 = failed recall) since the app doesn't collect a finer-grained rating.
 */
function applySM2(record, correct) {
  const quality = correct ? 5 : 2;

  if (correct) {
    record.repetitions = (record.repetitions || 0) + 1;
    if (record.repetitions === 1) record.interval = 1;
    else if (record.repetitions === 2) record.interval = 6;
    else record.interval = Math.round((record.interval || 1) * (record.easeFactor || 2.5));
  } else {
    record.repetitions = 0;
    record.interval = 1;
  }

  const ease = (record.easeFactor || 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  record.easeFactor = Math.max(MIN_EASE, ease);

  record.lastReviewAt = new Date();
  record.dueAt = new Date(Date.now() + record.interval * 86400000);
  return record;
}

module.exports = { pivotBucket, applySM2 };