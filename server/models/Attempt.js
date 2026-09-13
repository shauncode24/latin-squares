const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  correct: { type: Boolean, required: true },
  elapsedMs: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Attempt', attemptSchema);
