/**
 * Starts or changes the background music track.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Music options.
 * @returns {object} Music command.
 */
export function music(id, options = {}) {
  return {
    type: "music",
    id,
    ...options
  };
}

/**
 * Stops the current background music track.
 *
 * @param {object} [options] - Stop options, e.g. { fadeOut }.
 * @returns {object} Stop-music command.
 */
export function stopMusic(options = {}) {
  return {
    type: "stopMusic",
    ...options
  };
}

/**
 * Starts or changes the looping ambience track.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Ambience options.
 * @returns {object} Ambience command.
 */
export function ambience(id, options = {}) {
  return {
    type: "ambience",
    id,
    ...options
  };
}

/**
 * Applies a reusable durable music/ambience preset.
 *
 * @param {string} id - Audio scene preset id.
 * @param {object} [options] - Audio scene options, e.g. { transition }.
 * @returns {object} Audio-scene command.
 */
export function audioScene(id, options = {}) {
  return {
    type: "audioScene",
    id,
    ...options
  };
}

/**
 * Stops the current ambience loop.
 *
 * @param {object} [options] - Stop options, e.g. { fadeOut }.
 * @returns {object} Stop-ambience command.
 */
export function stopAmbience(options = {}) {
  return {
    type: "stopAmbience",
    ...options
  };
}

/**
 * Plays a transient sound effect. Add `{ as: "handle" }` when the sound should
 * be addressable later with stopSound(), such as a looping machine, shower, or
 * phone buzz that must cut off on a later beat.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Sound options: volume, fadeIn, fadeOut, rate,
 * loop, duration, start, end, as. Timing fields are milliseconds.
 * @returns {object} Sound command.
 */
export function sound(id, options = {}) {
  return {
    type: "sound",
    id,
    ...options
  };
}

/**
 * Stops a named transient sound effect that was started with sound(id, { as }).
 *
 * @param {string} handle - Author-facing sound handle.
 * @param {object} [options] - Stop options, e.g. { fadeOut }.
 * @returns {object} Stop-sound command.
 */
export function stopSound(handle, options = {}) {
  return {
    type: "stopSound",
    id: handle,
    ...options
  };
}

/**
 * Plays a transient voice line, replacing any current voice line.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Voice options: volume, fadeIn, fadeOut, rate,
 * duration, start, end. Timing fields are milliseconds.
 * @returns {object} Voice command.
 */
export function voice(id, options = {}) {
  return {
    type: "voice",
    id,
    ...options
  };
}
