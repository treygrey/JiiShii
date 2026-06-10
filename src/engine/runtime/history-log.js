import { appendHistoryEntry, cloneHistoryState } from "../history-state.js";

/**
 * Records one reader-visible line in the runner-owned backlog.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} entry - History entry.
 * @returns {void}
 */
export function recordHistory(runner, entry) {
  if (runner.reconstructing) {
    return;
  }
  runner.state.history ??= [];
  appendHistoryEntry(runner.state.history, {
    ...entry,
    surface: entry.surface ?? runner.state.currentSurface ?? null,
    sceneId: runner.state.currentSceneId,
    commandIndex: runner.state.currentCommandIndex
  });
}

/**
 * Records a batch of reader-visible text/chat messages.
 *
 * @param {object} runner - Scene runner instance.
 * @param {Array<object>} messages - Message objects from a text/chat block.
 * @param {string} surface - Surface id that produced the messages.
 * @returns {void}
 */
export function recordMessageHistory(runner, messages = [], surface) {
  for (const message of messages) {
    const text = message.message ?? message.text ?? "";
    runner.recordHistory({
      kind: message.kind ?? "text",
      speaker: message.id ?? null,
      name: message.name ?? message.id ?? null,
      side: message.side ?? null,
      message: text,
      surface
    });
  }
}

/**
 * Records reader-visible IRL dialogue lines from a grouped line block.
 *
 * @param {object} runner - Scene runner instance.
 * @param {Array<object>} lines - Line block entries.
 * @param {string} surface - Surface id that produced the lines.
 * @returns {void}
 */
export function recordLineHistory(runner, lines = [], surface = "irl") {
  for (const line of lines) {
    const speakerId = line.id ? runner.aliasSpeaker(line.id) : null;
    const speaker = runner.characters.get(speakerId) ?? { id: speakerId, name: speakerId };
    runner.recordHistory({
      kind: "dialogue",
      speaker: speakerId,
      name: speaker.name ?? speakerId,
      side: speaker.side ?? "left",
      message: line.message ?? "",
      surface
    });
  }
}

/**
 * Returns a detached copy of the reader history.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {object[]} History entries.
 */
export function getHistory(runner) {
  return cloneHistoryState(runner.state.history);
}
