const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getClientId() {
  let id = localStorage.getItem('dmat-client-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('dmat-client-id', id);
  }
  return id;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': getClientId(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  generatePuzzle: (difficulty) =>
    request('/api/puzzles/generate', {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
    }),

  submitAnswer: (puzzleId, letter, elapsedMs) =>
    request(`/api/puzzles/${puzzleId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ letter, elapsedMs, clientId: getClientId() }),
    }),

  revealAnswer: (puzzleId) => request(`/api/puzzles/${puzzleId}/reveal`),

  getHint: (puzzleId) => request(`/api/puzzles/${puzzleId}/hint`),

  getStats: () => request(`/api/stats?clientId=${getClientId()}`),
};

export { getClientId };
