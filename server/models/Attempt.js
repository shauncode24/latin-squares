const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },

  difficulty:    { type: String, enum: ['low', 'medium', 'high'], required: true },
  rounds:        { type: Number, required: true, default: 0 },
  pivotDistance: { type: Number, required: true, default: 0 },
  patternTag:    { type: String, default: 'direct' },

  correct:       { type: Boolean, required: true },
  selectedLetter:{ type: String, default: null },
  correctLetter: { type: String, default: null },
  solveQuality: {
    type: String,
    enum: ['clean', 'hinted', 'revealed', 'guessed', 'rushed'],
    required: true,
    default: 'clean',
  },
  hintUsed: { type: Boolean, default: false },
  // NEW: elapsed ms *at the moment the hint was requested*, relative to
  // puzzle start. null if no hint was requested. This lets diagnosis tell
  // apart "asked for help immediately" (didn't attempt elimination) from
  // "struggled for a while, then asked" (attempted but stuck) — both
  // currently collapse into the same `hintUsed: true` flag otherwise.
  hintRequestedAtMs: { type: Number, default: null },
  elapsedMs: { type: Number, required: true, default: 0 },

  puzzleSnapshot: {
    cols:        { type: [String], default: [] },
    cells:       { type: mongoose.Schema.Types.Mixed, default: [] },
    allLetters:  { type: mongoose.Schema.Types.Mixed, default: [] },
    target:      { row: Number, col: Number },
    path:        { type: mongoose.Schema.Types.Mixed, default: [] },
  },

  createdAt: { type: Date, default: Date.now, index: true },
});

attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, difficulty: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, patternTag: 1, createdAt: -1 });

module.exports = mongoose.model('Attempt', attemptSchema);