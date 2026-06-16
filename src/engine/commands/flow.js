/**
 * Switches the active presentation surface.
 *
 * @param {"texting" | "irl" | "streaming"} id - Surface id.
 * @returns {object} Surface command.
 */
export function surface(id) {
  return {
    type: "surface",
    id
  };
}

/**
 * Sets the base stage (the medium of the scene). Replaces the current stack.
 *
 * @param {"texting" | "irl" | "streaming"} id - Stage id.
 * @returns {object} Surface command.
 */
export function stage(id) {
  return { type: "surface", id };
}

/**
 * Opens a stage as a layer OVER the current one (e.g. the phone over a stream).
 * The top layer becomes active — everything after routes there until close().
 *
 * @param {"texting" | "irl" | "streaming"} id - Stage id to overlay.
 * @returns {object} Open-layer command.
 */
export function open(id) {
  return { type: "openLayer", id };
}

/**
 * Closes the named overlay layer, revealing (and reactivating) what's beneath.
 *
 * @param {string} id - Stage id to close.
 * @returns {object} Close-layer command.
 */
export function close(id) {
  return { type: "closeLayer", id };
}

/**
 * Goes to a mark in this scene OR to another scene by id. The validator
 * guarantees the target is exactly one of those and that it exists.
 *
 * @param {string} target - A mark name or a scene id.
 * @returns {object} Goto command.
 */
export function goto(target) {
  return { type: "goto", target };
}

/**
 * Names a spot in the scene that goto() can jump to. Alias of label.
 *
 * @param {string} name - Mark name.
 * @returns {object} Label command.
 */
export function mark(name) {
  return { type: "label", id: name };
}

/**
 * Pushes a surface on top of the current one.
 *
 * @param {"texting" | "irl" | "streaming"} id - Surface id.
 * @returns {object} pushSurface command.
 */
export function pushSurface(id) {
  return {
    type: "pushSurface",
    id
  };
}

/**
 * Pops the top surface off the stack.
 *
 * @returns {object} popSurface command.
 */
export function popSurface() {
  return {
    type: "popSurface"
  };
}

/**
 * Creates a label target for jumps.
 *
 * @param {string} id - Label id.
 * @returns {object} Label command.
 */
export function label(id) {
  return {
    type: "label",
    id
  };
}

/**
 * Creates a prominent forward-transition button. Clicking it loads the target
 * scene id when one is registered, otherwise it ends the current scene. Used
 * for authored convergence jumps (internal label target) and end-of-scene
 * continue buttons (scene id or null).
 *
 * @param {string} text - Button label. Use "__continue" for an internal jump.
 * @param {string | null} [target] - Scene id, label, or null to end the scene.
 * @returns {object} Transition command.
 */
export function transition(text, target = null) {
  return {
    type: "transition",
    text,
    target
  };
}

/**
 * Waits for a timed beat before continuing. A player tap skips the remaining
 * time, making this useful for silence, sound effects, or reaction beats.
 *
 * @param {number} [duration=1000] - Pause duration in milliseconds.
 * @param {object} [options] - Pause options.
 * @returns {object} Pause command.
 */
export function pause(duration = 1000, options = {}) {
  return {
    ...options,
    type: "pause",
    duration
  };
}

/**
 * Creates a direct jump command.
 *
 * @param {string} target - Target label id.
 * @returns {object} Jump command.
 */
export function jump(target) {
  return {
    type: "jump",
    target
  };
}

/**
 * Creates an explicit scene end command.
 *
 * @returns {object} End command.
 */
export function endScene() {
  return {
    type: "endScene"
  };
}
