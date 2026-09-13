/** Format milliseconds as "12.3s" */
export function timeStr(ms) {
  if (ms == null) return '-';
  return (ms / 1000).toFixed(1) + 's';
}

/** Format accuracy as "73%" or null if no data */
export function pct(correct, solved) {
  if (!solved) return null;
  return Math.round((100 * correct) / solved) + '%';
}

/** Human-readable relative time */
export function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}
