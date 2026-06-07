/** Default crossfade duration (ms) when a beat does not specify one. */
export const DEFAULT_BACKGROUND_TRANSITION_DURATION = 520;

/** Default background transition preset used by a bare `background(id)`. */
export const DEFAULT_BACKGROUND_TRANSITION = "dissolve";

/** Built-in background transition metadata shared by validator and runtime. */
export const BACKGROUND_TRANSITION_PRESETS = {
  cut: {
    id: "cut",
    label: "Cut"
  },
  dissolve: {
    id: "dissolve",
    label: "Dissolve"
  },
  fade_to_black: {
    id: "fade_to_black",
    label: "Fade to black"
  }
};

/**
 * Lists known background transition preset names.
 *
 * @returns {string[]} Preset ids.
 */
export function listBackgroundTransitionPresets() {
  return Object.keys(BACKGROUND_TRANSITION_PRESETS);
}

/**
 * Reports whether a background transition preset is known.
 *
 * @param {string|null|undefined} transition - Authored transition id.
 * @returns {boolean} True when the transition is built in.
 */
export function hasBackgroundTransitionPreset(transition) {
  return Boolean(transition && BACKGROUND_TRANSITION_PRESETS[transition]);
}
