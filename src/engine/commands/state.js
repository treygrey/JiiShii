/**
 * Adds to a numeric variable (negative subtracts).
 *
 * @param {string} key - Variable name.
 * @param {number} [by=1] - Amount to add.
 * @returns {object} Variable mutation command.
 */
export function add(key, by = 1) {
  return { type: "setVar", key, value: `${by >= 0 ? "+" : ""}${by}` };
}

/**
 * Adds to a save-persistent numeric variable. Save-persistent vars are stored
 * in saves and survive rollback, but do not persist across new games.
 *
 * @param {string} key - Save-persistent variable name.
 * @param {number} [by=1] - Amount to add.
 * @returns {object} Save-persistent variable mutation command.
 */
export function saveAdd(key, by = 1) {
  return { type: "setSaveVar", key, value: `${by >= 0 ? "+" : ""}${by}` };
}

/**
 * Creates a flag mutation command.
 *
 * @param {string} key - Flag key.
 * @param {boolean} value - Flag value.
 * @returns {object} Flag mutation command.
 */
export function setFlag(key, value = true) {
  return {
    type: "setFlag",
    key,
    value
  };
}

/**
 * Clears a flag (sets it false). Sugar over setFlag.
 *
 * @param {string} key - Flag key.
 * @returns {object} Flag mutation command.
 */
export function clearFlag(key) {
  return {
    type: "setFlag",
    key,
    value: false
  };
}

/**
 * Creates a save-persistent flag mutation command.
 *
 * @param {string} key - Save-persistent flag key.
 * @param {boolean} value - Flag value.
 * @returns {object} Save-persistent flag mutation command.
 */
export function saveFlag(key, value = true) {
  return {
    type: "setSaveVar",
    key,
    value
  };
}

/**
 * Clears a save-persistent flag.
 *
 * @param {string} key - Save-persistent flag key.
 * @returns {object} Save-persistent flag mutation command.
 */
export function clearSaveFlag(key) {
  return {
    type: "setSaveVar",
    key,
    value: false
  };
}

/**
 * Sets a variable. The value may be absolute (number/boolean/string) or a
 * relative delta string like "+1" / "-2".
 *
 * @param {string} key - Variable name.
 * @param {number|string|boolean} value - Absolute value or "+N"/"-N" delta.
 * @returns {object} Variable mutation command.
 */
export function set(key, value) {
  return {
    type: "setVar",
    key,
    value
  };
}

/**
 * Sets a save-persistent variable. The value may be absolute or a relative
 * delta string like "+1" / "-2".
 *
 * @param {string} key - Save-persistent variable name.
 * @param {number|string|boolean} value - Absolute value or "+N"/"-N" delta.
 * @returns {object} Save-persistent variable mutation command.
 */
export function saveVar(key, value) {
  return {
    type: "setSaveVar",
    key,
    value
  };
}

/**
 * Draws a seeded random integer in [min, max] into a variable. Deterministic
 * under replay/rollback because it advances the PRNG stored in state.
 *
 * @param {string} key - Variable to store the result in.
 * @param {number} min - Inclusive lower bound.
 * @param {number} max - Inclusive upper bound.
 * @returns {object} Roll command.
 */
export function roll(key, min, max) {
  return {
    type: "roll",
    key,
    min,
    max
  };
}

/**
 * Sets a cross-playthrough persistent flag (route completion, endings,
 * New Game+ unlocks). Persistent flags never roll back, survive across
 * saves and playthroughs, and are readable in conditions and showIf with
 * the `persistent:` prefix, e.g. `showIf: "persistent:alex_route_done"`.
 *
 * @param {string} key - Flag name (stored without any prefix).
 * @param {*} [value] - Flag value; defaults to true.
 * @returns {object} Persist-flag command.
 */
export function persistFlag(key, value = true) {
  return {
    type: "persistFlag",
    key,
    value
  };
}

/**
 * Pauses the story and collects typed player text into a variable.
 * Works on any surface; the input panel is compositor-owned like narration.
 *
 *   input("player_name", { prompt: "What's your name?", default: "Riley" })
 *
 * @param {string} key - Variable to store the submitted text in.
 * @param {object} [options] - Input presentation options.
 * @param {string} [options.prompt] - Prompt text above the field.
 * @param {string} [options.placeholder] - Field placeholder text.
 * @param {string} [options.default] - Prefilled value.
 * @param {number} [options.maxLength] - Maximum accepted length.
 * @param {boolean} [options.allowEmpty] - Accept an empty submission.
 * @returns {object} Input command.
 */
export function input(key, options = {}) {
  return {
    type: "input",
    key,
    prompt: options.prompt ?? "",
    placeholder: options.placeholder ?? "",
    default: options.default ?? "",
    maxLength: options.maxLength ?? 40,
    allowEmpty: options.allowEmpty === true
  };
}

/**
 * Branches on the variable store. `then`, `elseIf`, and `else` may contain
 * inline command arrays, while string targets route to marks or scene ids.
 *
 * Supports these common forms:
 *   condition({ if: { flag: "metRiley" }, then: [say(...)] })
 *   condition({ if: { var: "trust", atLeast: 3 }, then: [say(...)] })
 *   condition({ if: { any: [{ flag: "a" }, { flag: "b" }] }, then: [say(...)] })
 *   condition({ if: (v) => v.gold >= 5, then: [say(...)] }) // JS escape hatch
 *
 * Target form remains available:
 *   condition({ if: { flag: "metRiley" }, then: "yes_mark", else: "no_mark" })
 *
 * @param {object} definition - Conditional branch definition.
 * @returns {object} Condition command.
 */
export function condition(definition) {
  return {
    ...definition,
    type: "condition"
  };
}
