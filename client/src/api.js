const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',           // send/receive httpOnly cookies
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(message);
  }

  // 204 No Content has no body
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  /** Returns { username } */
  me: () => request('GET', '/api/auth/me'),

  /** Returns { username } */
  login: (username, password) =>
    request('POST', '/api/auth/login', { username, password }),

  /** Returns { username } */
  signup: (username, password) =>
    request('POST', '/api/auth/signup', { username, password }),

  /** Clears the session cookie */
  logout: () => request('POST', '/api/auth/logout'),

  // ── Puzzles ─────────────────────────────────────────────────────────────
  /**
   * Generate a new puzzle for the given tier ('low' | 'medium' | 'high').
   * Returns { puzzleId, cols, cells, target }
   */
  generatePuzzle: (tier) =>
    request('POST', '/api/puzzles/generate', { difficulty: tier }),

  /**
   * Submit the player's answer letter for a puzzle.
   * Returns { correct: boolean, correctLetter: string }
   */
  submitAnswer: (puzzleId, letter, elapsedMs) =>
    request('POST', `/api/puzzles/${puzzleId}/answer`, { letter, elapsedMs }),

  /**
   * Reveal the correct answer without scoring.
   * Returns { correctLetter: string }
   */
  revealAnswer: (puzzleId) =>
    request('GET', `/api/puzzles/${puzzleId}/reveal`),

  /**
   * Get a hint for the current puzzle.
   * Returns { pivotCells: Array<{row, col}>, direct: boolean }
   */
  getHint: (puzzleId) =>
    request('GET', `/api/puzzles/${puzzleId}/hint`),

  // ── Stats ────────────────────────────────────────────────────────────────
  /**
   * Get aggregate stats for the logged-in user.
   * Returns { totalSolved, accuracy, avgTime, ... }
   */
  getStats: () => request('GET', '/api/stats'),

  /**
   * Get recent puzzle history for the logged-in user.
   * Returns { history: Array<{ puzzleId, correct, elapsedMs, tier, ... }> }
   */
  getHistory: () => request('GET', '/api/stats/history'),
};
