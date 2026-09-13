const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },

  difficulty:    { type: String, enum: ['low', 'medium', 'high'], required: true },
  rounds:        { type: Number, required: true, default: 0 },
  pivotDistance: { type: Number, required: true, default: 0 },
  patternTag:    { type: String, default: 'direct' },

  correct:       { type: Boolean, required: true },
  selectedLetter:{ type: String, default: null }, // NEW: what they actually picked, for mistake analysis
  correctLetter: { type: String, default: null },
  solveQuality: {
    type: String,
    enum: ['clean', 'hinted', 'revealed', 'guessed', 'rushed'], // added 'rushed'
    required: true,
    default: 'clean',
  },
  hintUsed: { type: Boolean, default: false },
  elapsedMs: { type: Number, required: true, default: 0 },

  // FULL snapshot now — enough to literally re-render the original grid,
  // not just the target+path text. Needed so Review Mode can actually show
  // (and offer a fresh, same-pattern retry of) a missed puzzle.
  puzzleSnapshot: {
    cols:        { type: [String], default: [] },
    cells:       { type: mongoose.Schema.Types.Mixed, default: [] }, // masked letters, as originally shown
    allLetters:  { type: mongoose.Schema.Types.Mixed, default: [] }, // full solved grid
    target:      { row: Number, col: Number },
    path:        { type: mongoose.Schema.Types.Mixed, default: [] },
  },

  createdAt: { type: Date, default: Date.now, index: true },
});

attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, difficulty: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, patternTag: 1, createdAt: -1 });

module.exports = mongoose.model('Attempt', attemptSchema);