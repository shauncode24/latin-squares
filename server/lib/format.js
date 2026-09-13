/**
 * Shared formatting utilities — used server-side (require) and client-side (import).
 */

/** Format milliseconds as "12.3s" */
function timeStr(ms) {
  if (ms == null) return '-';
  return (ms / 1000).toFixed(1) + 's';
}

/** Format accuracy as "73%" or null if no data */
function pct(correct, solved) {
  if (!solved) return null;
  return Math.round((100 * correct) / solved) + '%';
}

/** Human-readable relative time: "just now", "5m ago", "2h ago", "3d ago" */
function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

module.exports = { timeStr, pct, relTime };
