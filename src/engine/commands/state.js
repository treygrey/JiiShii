/**
 * Adds to a numeric variable (negative subtracts). Alias of inc.
 *
 * @param {string} key - Variable name.
 * @param {number} [by=1] - Amount to add.
 * @returns {object} Variable mutation command.
 */
export function add(key, by = 1) {
  return { type: "setVar", key, value: `${by >= 0 ? "+" : ""}${by}` };
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
 * Increments a numeric variable. Sugar over set with a relative delta.
 *
 * @param {string} key - Variable name.
 * @param {number} [by=1] - Amount to add (negative to subtract).
 * @returns {object} Variable mutation command.
 */
export function inc(key, by = 1) {
  return {
    type: "setVar",
    key,
    value: `${by >= 0 ? "+" : ""}${by}`
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
 * Branches on the variable store. `then`, `elseIf`, and `else` may contain
 * inline command arrays, while legacy string targets still jump to marks or
 * scene ids.
 *
 * Supports these common forms:
 *   condition({ if: { flag: "metRiley" }, then: [say(...)] })
 *   condition({ if: { var: "trust", atLeast: 3 }, then: [say(...)] })
 *   condition({ if: { any: [{ flag: "a" }, { flag: "b" }] }, then: [say(...)] })
 *   condition({ if: (v) => v.gold >= 5, then: [say(...)] }) // JS escape hatch
 *
 * Legacy jump form remains available:
 *   condition({ flag: "metRiley", then: "yes_mark", else: "no_mark" })
 *
 * @param {object} definition - Conditional branch definition.
 * @returns {object} Condition command.
 */
export function condition(definition) {
  return {
    type: "condition",
    ...definition
  };
}
