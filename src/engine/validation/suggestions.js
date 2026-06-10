/**
 * Suggests the closest known name for an author typo.
 *
 * @param {string} value - The misspelled token.
 * @param {string[]} known - Known names.
 * @returns {string} A " Did you mean X?" hint, or "".
 */
export function didYouMean(value, known) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of known) {
    const dist = editDistance(String(value).toLowerCase(), String(candidate).toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best && bestDist <= Math.max(2, Math.floor(String(value).length / 2)) ? ` Did you mean "${best}"?` : "";
}

/**
 * Computes Levenshtein distance for short author-facing ids.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} Edit distance.
 */
export function editDistance(a, b) {
  const grid = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) {
    grid[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return grid[a.length][b.length];
}
