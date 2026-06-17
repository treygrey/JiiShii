import {
  createPersistentState,
  isBeatSeen,
  isChoiceOptionSeen,
  markBeatSeen,
  markChoiceOptionSeen,
  normalizePersistentState,
  prefixedPersistentFlags,
  setPersistentFlag,
  unlockExtra
} from "../state/persistent-state.js";

const FALLBACK_PERSISTENT = new Map();

/**
 * Loads persistent cross-playthrough state from storage.
 *
 * @param {string} storageKey - Persistent storage key.
 * @returns {object} Normalized persistent state.
 */
export function loadPersistentState(storageKey) {
  let raw = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  if (!raw) {
    raw = FALLBACK_PERSISTENT.get(storageKey) ?? null;
  }
  if (!raw) {
    return createPersistentState();
  }
  try {
    return normalizePersistentState(JSON.parse(raw));
  } catch {
    return createPersistentState();
  }
}

/**
 * Writes persistent state, falling back to memory when storage is unavailable.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function savePersistentState(runner) {
  const payload = JSON.stringify(runner.persistent);
  try {
    localStorage.setItem(runner.storageKeys.persistent, payload);
    FALLBACK_PERSISTENT.delete(runner.storageKeys.persistent);
  } catch {
    FALLBACK_PERSISTENT.set(runner.storageKeys.persistent, payload);
  }
}

/**
 * Marks the runner's active readable beat as seen.
 *
 * Also records whether the beat had been seen *before* this presentation,
 * because marking happens at display time — skip mode needs the pre-display
 * answer to know whether it is still inside read text.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function markActiveBeatSeen(runner) {
  const sceneId = runner.scene?.id;
  const commandIndex = runner.activeBeatCommandIndex ?? runner.state.currentCommandIndex;
  if (runner.reconstructing) {
    // Beats re-presented by rollback/load were read before by definition.
    runner.activeBeatWasSeen = isBeatSeen(runner.persistent, sceneId, commandIndex);
    return;
  }
  const newlySeen = markBeatSeen(runner.persistent, sceneId, commandIndex);
  runner.activeBeatWasSeen = !newlySeen;
  if (newlySeen) {
    savePersistentState(runner);
  }
}

/**
 * Returns whether the beat currently on screen had been seen before this
 * presentation. Skip mode uses this to stop fast-forwarding at unread text.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True when the active beat was seen on a previous visit.
 */
export function isCurrentBeatSeen(runner) {
  return Boolean(runner.activeBeatWasSeen);
}

/**
 * Records the selected option of a choice beat.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} choiceCommand - Choice command shown to the player.
 * @param {object} option - Selected option.
 * @returns {void}
 */
export function recordChoiceSeen(runner, choiceCommand, option) {
  // Choices are not readable beats, so activeBeatCommandIndex is stale here.
  // The script pointer still sits on the choice command until selection
  // resolves, so currentCommandIndex is the choice's own index.
  const commandIndex = runner.state.currentCommandIndex;
  if (
    markChoiceOptionSeen(runner.persistent, runner.scene?.id, commandIndex, choiceOptionKey(option))
  ) {
    savePersistentState(runner);
  }
}

/**
 * Annotates visible choice options with `seen` for renderer indicators.
 *
 * @param {object} runner - Scene runner instance.
 * @param {Array<object>} options - Visible choice options.
 * @returns {Array<object>} Options with seen annotations.
 */
export function annotateSeenChoiceOptions(runner, options) {
  const commandIndex = runner.state.currentCommandIndex;
  return options.map((option) =>
    isChoiceOptionSeen(runner.persistent, runner.scene?.id, commandIndex, choiceOptionKey(option))
      ? { ...option, seen: true }
      : option
  );
}

/**
 * Unlocks an extras entry and persists when newly unlocked.
 *
 * @param {object} runner - Scene runner instance.
 * @param {"gallery"|"music"} category - Extras category.
 * @param {string} id - Asset or track id.
 * @returns {void}
 */
export function unlockPersistentExtra(runner, category, id) {
  if (unlockExtra(runner.persistent, category, id)) {
    savePersistentState(runner);
  }
}

/**
 * Sets a persistent flag and persists when changed.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} key - Flag name.
 * @param {*} value - Flag value.
 * @returns {void}
 */
export function setRunnerPersistentFlag(runner, key, value) {
  if (setPersistentFlag(runner.persistent, key, value)) {
    savePersistentState(runner);
  }
}

/**
 * Builds the variable view used by showIf and condition evaluation:
 * story vars, `save:`-prefixed save vars, and `persistent:` flags.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {object} Merged condition variable view.
 */
export function conditionVars(runner) {
  return {
    ...runner.state.vars,
    ...prefixedSaveVars(runner.state.saveVars),
    ...prefixedPersistentFlags(runner.persistent)
  };
}

/**
 * Returns save-persistent vars keyed for condition lookups (`save:name`).
 *
 * @param {object} saveVars - Save-persistent variable store.
 * @returns {object} Prefixed save var record.
 */
function prefixedSaveVars(saveVars) {
  const prefixed = {};
  for (const [key, value] of Object.entries(saveVars ?? {})) {
    prefixed[`save:${key}`] = value;
  }
  return prefixed;
}

/**
 * Returns the stable persistence key for one choice option.
 *
 * Prefers the option's own identity (id, then text) over its route target —
 * two different options frequently share one target mark, and they must not
 * collapse into a single seen record.
 *
 * @param {object} option - Choice option.
 * @returns {string} Option key.
 */
export function choiceOptionKey(option) {
  return option.id ?? option.text ?? option.goto;
}
