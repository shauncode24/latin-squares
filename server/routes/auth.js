const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'dmat_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password required' });
    if (username.length < 2 || username.length > 30)
      return res.status(400).json({ error: 'username must be 2–30 characters' });
    if (password.length < 4)
      return res.status(400).json({ error: 'password must be at least 4 characters' });

    const exists = await User.findOne({ username: username.trim() });
    if (exists) return res.status(409).json({ error: 'username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: username.trim(), passwordHash });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.status(201).json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password required' });

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(401).json({ error: 'invalid username or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid username or password' });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

// GET /api/auth/me — restore session from cookie
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ userId: payload.userId, username: payload.username });
  } catch {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
    res.status(401).json({ error: 'session expired' });
  }
});

module.exports = router;
