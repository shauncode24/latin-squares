const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },

  // Puzzle classification
  difficulty:    { type: String, enum: ['low', 'medium', 'high'], required: true },
  rounds:        { type: Number, required: true, default: 0 },      // pivot depth (0 = direct read)
  pivotDistance: { type: Number, required: true, default: 0 },      // Manhattan dist: first pivot → target

  // Solve outcome
  correct:      { type: Boolean, required: true },
  solveQuality: {
    type: String,
    enum: ['clean', 'hinted', 'revealed', 'guessed'],
    required: true,
    default: 'clean',
  },
  hintUsed: { type: Boolean, default: false },
  elapsedMs: { type: Number, required: true, default: 0 },

  // Snapshot stored for review mode & SM-2 re-queueing
  puzzleSnapshot: {
    target: { row: Number, col: Number },
    path:   { type: mongoose.Schema.Types.Mixed, default: [] },
  },

  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound index for fast per-user queries with time filtering
attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, difficulty: 1, createdAt: -1 });

module.exports = mongoose.model('Attempt', attemptSchema);
