const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode:          { type: String, enum: ['practice', 'exam', 'simulation'], required: true },
  difficulty:    { type: String, enum: ['low', 'medium', 'high', 'mixed'], required: true },
  questionCount: { type: Number, required: true },

  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },

  // Computed at completion
  summary: {
    attempted: { type: Number, default: 0 },
    correct:   { type: Number, default: 0 },
    hinted:    { type: Number, default: 0 },
    revealed:  { type: Number, default: 0 },
    avgTimeMs: { type: Number, default: null },
    streak:    { type: Number, default: 0 }, // max consecutive correct within session
    // NEW: per-difficulty breakdown, populated on completion. Used by
    // ExamSimulation's tier distribution reporting.
    byTier:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
});

module.exports = mongoose.model('Session', sessionSchema);