const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  me:     () => request('GET',  '/api/auth/me'),
  login:  (username, password) => request('POST', '/api/auth/login',  { username, password }),
  signup: (username, password) => request('POST', '/api/auth/signup', { username, password }),
  logout: () => request('POST', '/api/auth/logout'),

  // Puzzles
  generatePuzzle: (difficulty, opts = {}) =>
    request('POST', '/api/puzzles/generate', { difficulty, ...opts }),
  submitAnswer: (puzzleId, letter, elapsedMs, hintUsed = false, sessionId = null) =>
    request('POST', `/api/puzzles/${puzzleId}/answer`, { letter, elapsedMs, hintUsed, sessionId }),
  revealAnswer: (puzzleId) =>
    request('GET',  `/api/puzzles/${puzzleId}/reveal`),
  getHint: (puzzleId) =>
    request('GET',  `/api/puzzles/${puzzleId}/hint`),

  // Stats
  getStats:      () => request('GET', '/api/stats'),
  getHistory:    () => request('GET', '/api/stats/history'),
  getTimeseries: (bucket = 'daily') => request('GET', `/api/stats/timeseries?bucket=${bucket}`),

  // Sessions
  createSession:   (mode, difficulty, questionCount) =>
    request('POST',  '/api/sessions', { mode, difficulty, questionCount }),
  getSession:      (sessionId) => request('GET',   `/api/sessions/${sessionId}`),
  completeSession: (sessionId) => request('PATCH', `/api/sessions/${sessionId}/complete`),

  // Review
  getMissed: () => request('GET', '/api/review/missed'),

  // Spaced repetition
  getDueItems:  () => request('GET',  '/api/sr/due'),
  submitReview: (difficulty, rounds, pivotDistance, correct, hintUsed) =>
    request('POST', '/api/sr/review', { difficulty, rounds, pivotDistance, correct, hintUsed }),
};
