const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  grid:   { type: [[Number]], required: true },
  mask:   { type: [[Boolean]], required: true },
  target: {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  path:          { type: mongoose.Schema.Types.Mixed, default: [] },
  rounds:        { type: Number, default: 0 },
  pivotDistance: { type: Number, default: 0 },
  patternTag:    { type: String, default: 'direct' }, // 'direct' | 'single-pivot-aligned' | 'single-pivot-cross' | 'chain-2' | 'chain-3'
  hintUsed:      { type: Boolean, default: false },

  // True if the generator fell back and rounds achieved doesn't actually
  // match `difficulty`'s expected range — lets us avoid trusting a mislabeled puzzle.
  difficultyMismatch: { type: Boolean, default: false },

  createdAt:  { type: Date, default: Date.now, expires: 900 },
  answeredAt: { type: Date, default: null, expires: 1800 }, // extended from 300s so Review can retain longer
});

module.exports = mongoose.model('Puzzle', puzzleSchema);