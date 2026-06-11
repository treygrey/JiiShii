// =============================================================================
// Persistent state — the cross-playthrough domain. Unlike story state it never
// rolls back and never lives inside save envelopes; unlike player settings it
// is game progress, not preference. It powers seen-text skip, seen-choice
// indicators, extras gallery/music unlocks, and route-completion flags.
// =============================================================================

/** Current persistent-state schema version. */
export const PERSISTENT_VERSION = 1;

/** Prefix that exposes persistent flags to showIf/condition lookups. */
export const PERSISTENT_FLAG_PREFIX = "persistent:";

/**
 * Creates an empty persistent state.
 *
 * @returns {object} Serializable persistent state.
 */
export function createPersistentState() {
  return {
    version: PERSISTENT_VERSION,
    seen: {},
    choices: {},
    unlocks: {
      gallery: {},
      music: {}
    },
    flags: {}
  };
}

/**
 * Normalizes raw (possibly corrupt or older) persistent state.
 *
 * @param {object} [value] - Parsed persistent payload.
 * @returns {object} Normalized persistent state.
 */
export function normalizePersistentState(value) {
  const created = createPersistentState();
  if (!value || typeof value !== "object") {
    return created;
  }
  return {
    version: PERSISTENT_VERSION,
    seen: normalizeNestedRecord(value.seen),
    choices: normalizeChoiceRecord(value.choices),
    unlocks: {
      gallery: normalizeBooleanRecord(value.unlocks?.gallery),
      music: normalizeBooleanRecord(value.unlocks?.music)
    },
    flags: normalizeFlagRecord(value.flags)
  };
}

/**
 * Marks one readable beat as seen.
 *
 * @param {object} persistent - Mutable persistent state.
 * @param {string} sceneId - Scene id.
 * @param {number} commandIndex - Beat command index.
 * @returns {boolean} True when this beat was newly seen.
 */
export function markBeatSeen(persistent, sceneId, commandIndex) {
  if (!sceneId || !Number.isFinite(commandIndex)) {
    return false;
  }
  const sceneSeen = (persistent.seen[sceneId] ??= {});
  if (sceneSeen[commandIndex]) {
    return false;
  }
  sceneSeen[commandIndex] = 1;
  return true;
}

/**
 * Returns whether a readable beat has been seen on any playthrough.
 *
 * @param {object} persistent - Persistent state.
 * @param {string} sceneId - Scene id.
 * @param {number} commandIndex - Beat command index.
 * @returns {boolean} True when seen.
 */
export function isBeatSeen(persistent, sceneId, commandIndex) {
  return Boolean(persistent?.seen?.[sceneId]?.[commandIndex]);
}

/**
 * Records a selected choice option.
 *
 * @param {object} persistent - Mutable persistent state.
 * @param {string} sceneId - Scene id.
 * @param {number} commandIndex - Choice command index.
 * @param {string} optionKey - Stable option key.
 * @returns {boolean} True when this option was newly recorded.
 */
export function markChoiceOptionSeen(persistent, sceneId, commandIndex, optionKey) {
  if (!sceneId || !Number.isFinite(commandIndex) || !optionKey) {
    return false;
  }
  const sceneChoices = (persistent.choices[sceneId] ??= {});
  const optionRecord = (sceneChoices[commandIndex] ??= {});
  if (optionRecord[optionKey]) {
    return false;
  }
  optionRecord[optionKey] = 1;
  return true;
}

/**
 * Returns whether a choice option was selected on any playthrough.
 *
 * @param {object} persistent - Persistent state.
 * @param {string} sceneId - Scene id.
 * @param {number} commandIndex - Choice command index.
 * @param {string} optionKey - Stable option key.
 * @returns {boolean} True when previously selected.
 */
export function isChoiceOptionSeen(persistent, sceneId, commandIndex, optionKey) {
  return Boolean(persistent?.choices?.[sceneId]?.[commandIndex]?.[optionKey]);
}

/**
 * Unlocks one extras entry (gallery image or music track).
 *
 * @param {object} persistent - Mutable persistent state.
 * @param {"gallery"|"music"} category - Extras category.
 * @param {string} id - Asset or track id.
 * @returns {boolean} True when newly unlocked.
 */
export function unlockExtra(persistent, category, id) {
  const record = persistent?.unlocks?.[category];
  if (!record || !id || record[id]) {
    return false;
  }
  record[id] = 1;
  return true;
}

/**
 * Returns whether an extras entry is unlocked.
 *
 * @param {object} persistent - Persistent state.
 * @param {"gallery"|"music"} category - Extras category.
 * @param {string} id - Asset or track id.
 * @returns {boolean} True when unlocked.
 */
export function isExtraUnlocked(persistent, category, id) {
  return Boolean(persistent?.unlocks?.[category]?.[id]);
}

/**
 * Sets one persistent flag (route completion, endings, NG+ unlocks).
 *
 * @param {object} persistent - Mutable persistent state.
 * @param {string} key - Flag name without the `persistent:` prefix.
 * @param {*} value - Flag value.
 * @returns {boolean} True when the stored value changed.
 */
export function setPersistentFlag(persistent, key, value) {
  if (!key || typeof key !== "string") {
    return false;
  }
  const name = stripFlagPrefix(key);
  if (persistent.flags[name] === value) {
    return false;
  }
  persistent.flags[name] = value;
  return true;
}

/**
 * Reads one persistent flag.
 *
 * @param {object} persistent - Persistent state.
 * @param {string} key - Flag name, with or without the `persistent:` prefix.
 * @returns {*} Flag value.
 */
export function readPersistentFlag(persistent, key) {
  return persistent?.flags?.[stripFlagPrefix(key)];
}

/**
 * Returns persistent flags keyed for condition lookups (`persistent:name`).
 *
 * @param {object} persistent - Persistent state.
 * @returns {object} Prefixed flag record.
 */
export function prefixedPersistentFlags(persistent) {
  const prefixed = {};
  for (const [key, value] of Object.entries(persistent?.flags ?? {})) {
    prefixed[`${PERSISTENT_FLAG_PREFIX}${key}`] = value;
  }
  return prefixed;
}

/**
 * Strips the condition-lookup prefix from a flag name.
 *
 * @param {string} key - Flag name.
 * @returns {string} Bare flag name.
 */
function stripFlagPrefix(key) {
  return String(key).startsWith(PERSISTENT_FLAG_PREFIX)
    ? String(key).slice(PERSISTENT_FLAG_PREFIX.length)
    : String(key);
}

/**
 * Normalizes a two-level seen record.
 *
 * @param {object} [value] - Candidate record.
 * @returns {object} Normalized record.
 */
function normalizeNestedRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [sceneId, entries] of Object.entries(value)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      continue;
    }
    const sceneRecord = {};
    for (const [index, marked] of Object.entries(entries)) {
      if (marked && /^\d+$/.test(index)) {
        sceneRecord[index] = 1;
      }
    }
    if (Object.keys(sceneRecord).length > 0) {
      normalized[sceneId] = sceneRecord;
    }
  }
  return normalized;
}

/**
 * Normalizes the three-level choice record.
 *
 * @param {object} [value] - Candidate record.
 * @returns {object} Normalized record.
 */
function normalizeChoiceRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [sceneId, indexes] of Object.entries(value)) {
    if (!indexes || typeof indexes !== "object" || Array.isArray(indexes)) {
      continue;
    }
    const sceneRecord = {};
    for (const [index, options] of Object.entries(indexes)) {
      if (!options || typeof options !== "object" || Array.isArray(options) || !/^\d+$/.test(index)) {
        continue;
      }
      const optionRecord = {};
      for (const [optionKey, marked] of Object.entries(options)) {
        if (marked && optionKey) {
          optionRecord[optionKey] = 1;
        }
      }
      if (Object.keys(optionRecord).length > 0) {
        sceneRecord[index] = optionRecord;
      }
    }
    if (Object.keys(sceneRecord).length > 0) {
      normalized[sceneId] = sceneRecord;
    }
  }
  return normalized;
}

/**
 * Normalizes a flat truthy-unlock record.
 *
 * @param {object} [value] - Candidate record.
 * @returns {object} Normalized record.
 */
function normalizeBooleanRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [key, marked] of Object.entries(value)) {
    if (marked && key) {
      normalized[key] = 1;
    }
  }
  return normalized;
}

/**
 * Normalizes the persistent flag record to JSON-safe primitives.
 *
 * @param {object} [value] - Candidate record.
 * @returns {object} Normalized record.
 */
function normalizeFlagRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [key, flag] of Object.entries(value)) {
    if (!key) {
      continue;
    }
    if (
      typeof flag === "boolean" ||
      typeof flag === "string" ||
      (typeof flag === "number" && Number.isFinite(flag))
    ) {
      normalized[key] = flag;
    }
  }
  return normalized;
}
