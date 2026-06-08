export const IRL_POSITION_PRESETS = {
  "far-left": { x: "14%", z: 18 },
  left: { x: "28%", z: 24 },
  center: { x: "50%", z: 30 },
  right: { x: "72%", z: 24 },
  "far-right": { x: "86%", z: 18 },
  offscreenLeft: { x: "-18%", z: 12 },
  offscreenRight: { x: "118%", z: 12 },
  nearLeft: { x: "36%", scale: 1.08, z: 34 },
  nearRight: { x: "64%", scale: 1.08, z: 34 }
};

const DEFAULT_REPLACEMENT = "cut";
const VALID_REPLACEMENTS = new Set(["cut", "dip", "flip"]);

export const IRL_TRANSITION_PRESETS = {
  cut: { duration: 0, easing: "linear", replacement: "cut" },
  dissolve: { duration: 260, easing: "ease", replacement: "cut" },
  fade: { duration: 320, easing: "ease", replacement: "cut" },
  move: { duration: 400, easing: "ease", replacement: "cut" },
  ease: { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)", replacement: "cut" },
  moveInLeft: { duration: 420, easing: "ease", enterFrom: "offscreenLeft", replacement: "cut" },
  moveInRight: { duration: 420, easing: "ease", enterFrom: "offscreenRight", replacement: "cut" },
  moveOutLeft: { duration: 320, easing: "ease", exitTo: "offscreenLeft", replacement: "cut" },
  moveOutRight: { duration: 320, easing: "ease", exitTo: "offscreenRight", replacement: "cut" },
  replaceCut: { duration: 0, easing: "linear", replacement: "cut" },
  replaceDip: { duration: 180, easing: "ease", replacement: "dip" },
  replaceFlip: { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)", replacement: "flip" }
};

const irlTransitionRegistry = new Map(
  Object.entries(IRL_TRANSITION_PRESETS).map(([name, preset]) => [name, normalizeTransitionPreset(preset)])
);

/**
 * Returns a valid duration override or null when the value should be ignored.
 *
 * @param {unknown} duration - Candidate duration in milliseconds.
 * @returns {number|null} Normalized duration.
 */
function normalizeDurationOverride(duration) {
  return typeof duration === "number" && Number.isFinite(duration) && duration >= 0
    ? duration
    : null;
}

/**
 * Returns a valid CSS easing override or null when the value should be ignored.
 *
 * @param {unknown} easing - Candidate easing string.
 * @returns {string|null} Normalized easing.
 */
function normalizeEasingOverride(easing) {
  return typeof easing === "string" && easing.trim().length > 0
    ? easing.trim()
    : null;
}

/**
 * Normalizes a sprite transition descriptor before registration or resolution.
 *
 * @param {object} preset - Transition descriptor.
 * @returns {object} Normalized transition descriptor.
 */
function normalizeTransitionPreset(preset = {}) {
  return {
    ...preset,
    duration: normalizeDurationOverride(preset.duration) ?? IRL_TRANSITION_PRESETS.dissolve.duration,
    easing: normalizeEasingOverride(preset.easing) ?? IRL_TRANSITION_PRESETS.dissolve.easing,
    replacement: VALID_REPLACEMENTS.has(preset.replacement) ? preset.replacement : DEFAULT_REPLACEMENT
  };
}

/**
 * Registers or replaces an IRL sprite transition preset.
 *
 * Keep descriptors declarative so skip, load replay, and instant reconstruction
 * can stay deterministic. Supported replacement modes are "cut", "dip", and
 * "flip"; movement can use enterFrom/exitTo placement ids.
 *
 * @param {string} name - Transition preset id used by show/move/hide commands.
 * @param {object} preset - Transition descriptor.
 * @returns {void}
 */
export function registerIrlSpriteTransition(name, preset) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("IRL sprite transition: name must be a non-empty string.");
  }
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    throw new Error(`IRL sprite transition "${name}": preset must be an object.`);
  }
  irlTransitionRegistry.set(name, normalizeTransitionPreset(preset));
}

/**
 * Lists known IRL position preset names.
 *
 * @returns {string[]} Position preset ids.
 */
export function listIrlPositionPresets() {
  return Object.keys(IRL_POSITION_PRESETS);
}

/**
 * Lists known IRL sprite transition preset names.
 *
 * @returns {string[]} Transition preset ids.
 */
export function listIrlTransitionPresets() {
  return [...irlTransitionRegistry.keys()];
}

/**
 * Checks whether a position preset exists.
 *
 * @param {string} value - Candidate preset id.
 * @returns {boolean} True when known.
 */
export function hasIrlPositionPreset(value) {
  return value == null || Object.hasOwn(IRL_POSITION_PRESETS, value);
}

/**
 * Checks whether a sprite transition preset exists.
 *
 * @param {string} value - Candidate preset id.
 * @returns {boolean} True when known.
 */
export function hasIrlTransitionPreset(value) {
  return value == null || irlTransitionRegistry.has(value);
}

/**
 * Resolves an authored sprite placement into concrete CSS-facing values.
 *
 * @param {object} sprite - Sprite state.
 * @returns {object} Resolved placement values.
 */
export function resolveIrlPlacement(sprite = {}) {
  const preset = IRL_POSITION_PRESETS[sprite.at] ?? IRL_POSITION_PRESETS[sprite.side] ?? {};
  return {
    x: sprite.x ?? preset.x ?? null,
    y: sprite.y ?? preset.y ?? null,
    scale: sprite.scale ?? preset.scale ?? 1,
    alpha: sprite.alpha ?? preset.alpha ?? 1,
    z: sprite.z ?? preset.z ?? null,
    layer: sprite.layer ?? "characters"
  };
}

/**
 * Resolves an authored sprite transition into timing and enter/exit behavior.
 *
 * @param {string|null} transition - Transition preset id.
 * @param {object} [options] - Optional command-level overrides.
 * @param {number} [options.duration] - Duration override in milliseconds.
 * @param {string} [options.easing] - CSS easing override.
 * @returns {object} Transition descriptor.
 */
export function resolveIrlTransition(transition, options = {}) {
  const preset = irlTransitionRegistry.get(transition) ?? irlTransitionRegistry.get("dissolve");
  return {
    ...preset,
    duration: normalizeDurationOverride(options.duration) ?? preset.duration,
    easing: normalizeEasingOverride(options.easing) ?? preset.easing,
    replacement: VALID_REPLACEMENTS.has(options.replacement) ? options.replacement : preset.replacement
  };
}
