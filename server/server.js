require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const puzzleRoutes = require('./routes/puzzles');
const statsRoutes = require('./routes/stats');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/stats', statsRoutes);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dmat';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`dMAT server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
