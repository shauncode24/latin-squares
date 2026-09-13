const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  grid: { type: [[Number]], required: true }, // full solution, 0-4 per cell (never sent to client)
  mask: { type: [[Boolean]], required: true }, // which cells are revealed
  target: {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  path: { type: mongoose.Schema.Types.Mixed, default: [] }, // pivot-cell chain, for hints
  // Puzzles are single-use and short-lived: auto-delete 15 minutes after creation
  // so abandoned puzzles don't pile up in the collection.
  createdAt: { type: Date, default: Date.now, expires: 900 },
});

module.exports = mongoose.model('Puzzle', puzzleSchema);
