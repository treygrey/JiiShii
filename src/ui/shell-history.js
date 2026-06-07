/**
 * Builds display rows for the player history overlay.
 *
 * @param {Array<object>} history - Runner-owned history entries.
 * @returns {Array<object>} History row view models.
 */
export function createHistoryRows(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter((entry) => typeof entry?.message === "string" && entry.message.length > 0)
    .map((entry) => {
      const kind = entry.kind === "narration" ? "narration" : "dialogue";
      return {
        kind,
        speaker: kind === "narration" ? null : entry.name ?? entry.speaker ?? "???",
        side: entry.side ?? "left",
        surface: entry.surface ?? null,
        message: entry.message
      };
    });
}

/**
 * Returns the small surface label shown beside history speakers.
 *
 * @param {string|null} surface - Surface id.
 * @returns {string} Human-readable surface label.
 */
export function historySurfaceLabel(surface) {
  if (!surface) {
    return "";
  }
  return surface.toUpperCase();
}
