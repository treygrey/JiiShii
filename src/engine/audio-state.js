/**
 * Creates the serializable audio state owned by the runner.
 *
 * @returns {object} Empty audio state.
 */
export function createAudioState() {
  return {
    music: null,
    ambience: null
  };
}

/**
 * Normalizes an older or partial audio state into the current shape.
 *
 * @param {object} [audio] - Saved audio state.
 * @returns {object} Normalized audio state.
 */
export function normalizeAudioState(audio = {}) {
  return {
    music: audio.music
      ? {
          id: audio.music.id,
          volume: audio.music.volume ?? 1,
          loop: audio.music.loop !== false,
          fadeIn: audio.music.fadeIn ?? 0,
          fadeOut: audio.music.fadeOut ?? 0
        }
      : null,
    ambience: audio.ambience
      ? {
          id: audio.ambience.id,
          volume: audio.ambience.volume ?? 1,
          loop: audio.ambience.loop !== false,
          fadeIn: audio.ambience.fadeIn ?? 0,
          fadeOut: audio.ambience.fadeOut ?? 0
        }
      : null
  };
}

/**
 * Clones audio state for rollback snapshots.
 *
 * @param {object} audio - Audio state.
 * @returns {object} Detached audio state.
 */
export function cloneAudioState(audio) {
  return normalizeAudioState(structuredClone(audio ?? createAudioState()));
}

/**
 * Sets the currently playing music track in runner state.
 *
 * @param {object} audio - Mutable audio state.
 * @param {object} command - Music command.
 * @returns {void}
 */
export function applyMusicState(audio, command) {
  const state = normalizeAudioState(audio);
  audio.music = {
    id: command.id,
    volume: command.volume ?? state.music?.volume ?? 1,
    loop: command.loop !== false,
    fadeIn: command.fadeIn ?? 0,
    fadeOut: command.fadeOut ?? command.fadeIn ?? state.music?.fadeOut ?? 0
  };
}

/**
 * Clears the currently playing music track in runner state.
 *
 * @param {object} audio - Mutable audio state.
 * @returns {void}
 */
export function clearMusicState(audio) {
  audio.music = null;
}

/**
 * Sets the currently playing ambience loop in runner state.
 *
 * @param {object} audio - Mutable audio state.
 * @param {object} command - Ambience command.
 * @returns {void}
 */
export function applyAmbienceState(audio, command) {
  const state = normalizeAudioState(audio);
  audio.ambience = {
    id: command.id,
    volume: command.volume ?? state.ambience?.volume ?? 1,
    loop: command.loop !== false,
    fadeIn: command.fadeIn ?? 0,
    fadeOut: command.fadeOut ?? command.fadeIn ?? state.ambience?.fadeOut ?? 0
  };
}

/**
 * Applies a reusable audio scene to durable music and ambience state.
 *
 * @param {object} audio - Mutable audio state.
 * @param {object} audioScene - Preset with optional music/ambience entries.
 * @param {object} [options] - Audio scene options.
 * @param {number} [options.transition] - Fade duration for replacement.
 * @returns {void}
 */
export function applyAudioSceneState(audio, audioScene = {}, options = {}) {
  const transition = typeof options.transition === "number" && Number.isFinite(options.transition) && options.transition >= 0
    ? options.transition
    : null;

  if (audioScene.music === null) {
    clearMusicState(audio);
  } else if (audioScene.music) {
    applyMusicState(audio, {
      ...audioScene.music,
      fadeIn: audioScene.music.fadeIn ?? transition ?? 0,
      fadeOut: audioScene.music.fadeOut ?? transition ?? audioScene.music.fadeIn ?? 0
    });
  }

  if (audioScene.ambience === null) {
    clearAmbienceState(audio);
  } else if (audioScene.ambience) {
    applyAmbienceState(audio, {
      ...audioScene.ambience,
      fadeIn: audioScene.ambience.fadeIn ?? transition ?? 0,
      fadeOut: audioScene.ambience.fadeOut ?? transition ?? audioScene.ambience.fadeIn ?? 0
    });
  }
}

/**
 * Clears the currently playing ambience loop in runner state.
 *
 * @param {object} audio - Mutable audio state.
 * @returns {void}
 */
export function clearAmbienceState(audio) {
  audio.ambience = null;
}
