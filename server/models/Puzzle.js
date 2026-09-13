const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  grid:   { type: [[Number]], required: true },    // full solution, 0-4 per cell (never sent to client)
  mask:   { type: [[Boolean]], required: true },   // which cells are revealed
  target: {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  path:          { type: mongoose.Schema.Types.Mixed, default: [] }, // pivot-cell chain
  rounds:        { type: Number, default: 0 },   // pivot depth computed at generation
  pivotDistance: { type: Number, default: 0 },   // Manhattan distance: first pivot → target
  hintUsed:      { type: Boolean, default: false },

  // Lifecycle
  // Unanswered puzzles auto-delete 15 min after creation (abandoned sessions).
  createdAt:  { type: Date, default: Date.now, expires: 900 },
  // Answered puzzles soft-deleted: answeredAt is set, then expire 5 min later for review window.
  answeredAt: { type: Date, default: null, expires: 300 },
});

module.exports = mongoose.model('Puzzle', puzzleSchema);
