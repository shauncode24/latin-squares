const mongoose = require('mongoose');

/**
 * SM-2 spaced repetition record per user per pattern.
 * Pattern key = "difficulty:rounds:pivotDistanceBucket"
 * e.g. "medium:1:2" = medium difficulty, 1 pivot, pivot 1-2 cells away
 */
const srSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patternKey: { type: String, required: true }, // "difficulty:rounds:pivotBucket"

  // SM-2 fields
  interval:    { type: Number, default: 1 },    // days until next review
  repetitions: { type: Number, default: 0 },    // successful reviews in a row
  easeFactor:  { type: Number, default: 2.5 },  // SM-2 ease factor (min 1.3)
  dueAt:       { type: Date,   default: Date.now },
  lastReviewAt:{ type: Date,   default: null },
});

// One record per user per pattern
srSchema.index({ userId: 1, patternKey: 1 }, { unique: true });
srSchema.index({ userId: 1, dueAt: 1 });

module.exports = mongoose.model('SpacedRepetition', srSchema);
