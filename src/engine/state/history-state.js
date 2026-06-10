const MAX_HISTORY_ENTRIES = 500;

/**
 * Creates the serializable reader history state.
 *
 * @returns {object[]} Empty history list.
 */
export function createHistoryState() {
  return [];
}

/**
 * Normalizes an older or partial history state.
 *
 * @param {Array<object>} [history] - Saved history entries.
 * @returns {object[]} Normalized history entries.
 */
export function normalizeHistoryState(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .map((entry) => ({
      kind: entry.kind ?? "dialogue",
      speaker: entry.speaker ?? null,
      name: entry.name ?? null,
      side: entry.side ?? null,
      message: entry.message ?? "",
      surface: entry.surface ?? null,
      sceneId: entry.sceneId ?? null,
      commandIndex: Number.isInteger(entry.commandIndex) ? entry.commandIndex : null
    }))
    .filter((entry) => typeof entry.message === "string" && entry.message.length > 0);
}

/**
 * Clones reader history for rollback snapshots.
 *
 * @param {Array<object>} history - History entries.
 * @returns {object[]} Detached history entries.
 */
export function cloneHistoryState(history) {
  return normalizeHistoryState(structuredClone(history ?? createHistoryState()));
}

/**
 * Appends one reader-visible history entry.
 *
 * @param {Array<object>} history - Mutable history list.
 * @param {object} entry - History entry.
 * @returns {void}
 */
export function appendHistoryEntry(history, entry) {
  const normalizedEntry = normalizeHistoryState([entry])[0];
  if (!normalizedEntry) {
    return;
  }
  history.push(normalizedEntry);
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }
}
