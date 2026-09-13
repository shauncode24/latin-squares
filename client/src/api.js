const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

async function request(method, path, body) {
  const options = {
    method,
    credentials: 'include',
    headers: {},
  };

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch { /* non-JSON error */ }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  me:     () => request('GET',  '/api/auth/me'),
  login:  (username, password) => request('POST', '/api/auth/login',  { username, password }),
  signup: (username, password) => request('POST', '/api/auth/signup', { username, password }),
  logout: () => request('POST', '/api/auth/logout'),

  generatePuzzle: (difficulty = 'medium', opts = {}) =>
    request('POST', '/api/puzzles/generate', { difficulty, ...opts }),
  generateSimilar: (rounds, pivotDistance, difficulty = 'medium') =>
    request('POST', '/api/puzzles/practice-similar', { rounds, pivotDistance, difficulty }),
  // UPDATED: accepts optional hintRequestedAtMs for the hint-timing signal.
  submitAnswer: (puzzleId, letter, elapsedMs = 0, hintUsed = false, sessionId = null, hintRequestedAtMs = null) =>
    request('POST', `/api/puzzles/${puzzleId}/answer`, { letter, elapsedMs, hintUsed, sessionId, hintRequestedAtMs }),
  revealAnswer: (puzzleId) => request('GET', `/api/puzzles/${puzzleId}/reveal`),
  getHint: (puzzleId, round = 0) => request('GET', `/api/puzzles/${puzzleId}/hint?round=${round}`),

  getStats:      () => request('GET', '/api/stats'),
  getHistory:    () => request('GET', '/api/stats/history'),
  getTimeseries: (view = 'hourly', interval = '1hr') =>
    request('GET', `/api/stats/timeseries?view=${view}&interval=${interval}`),
  getWeakest:    () => request('GET', '/api/stats/weakest'),
  getTrend:      () => request('GET', '/api/stats/trend'),
  // NEW
  getPersonalTargets: () => request('GET', '/api/stats/personal-targets'),
  getReadiness:       () => request('GET', '/api/stats/readiness'),

  createSession:   (mode, difficulty, questionCount) =>
    request('POST',  '/api/sessions', { mode, difficulty, questionCount }),
  getSession:      (sessionId) => request('GET',   `/api/sessions/${sessionId}`),
  completeSession: (sessionId) => request('PATCH', `/api/sessions/${sessionId}/complete`),
  getSimulationHistory: () => request('GET', '/api/sessions/simulations/history'),

  getMissed: () => request('GET', '/api/review/missed'),

  getDueItems:  () => request('GET',  '/api/sr/due'),
  submitReview: (difficulty, rounds, pivotDistance, correct, hintUsed) =>
    request('POST', '/api/sr/review', { difficulty, rounds, pivotDistance, correct, hintUsed }),

  getAiDiagnosis: (diagnosis) => request('POST', '/api/coach/diagnosis', { diagnosis }),
  getAiStrategy:  () => request('GET', '/api/coach/strategy'),
};