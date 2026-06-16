/**
 * Creates a narration message item for the texting surface. Narration renders
 * centered and without a chat bubble, used for phone handling, time jumps, or
 * Player's physical context. Mix it inside a block() alongside text() items.
 *
 * @param {string} message - Narration text.
 * @param {object} [overrides] - Item-level overrides (e.g. waitTime).
 * @returns {object} Narration message item.
 */
export function narration(message, overrides = {}) {
  return {
    kind: "narration",
    id: "__narration",
    message,
    ...overrides
  };
}

/**
 * Standalone narration beat. Renders in the shared bottom dialogue box (no
 * speaker), advanced by a tap.
 *
 * @param {string} message - Narration text.
 * @param {object} [overrides] - Command overrides (e.g. waitTime).
 * @returns {object} Narration command.
 */
export function narrate(message, overrides = {}) {
  return {
    type: "narration",
    message,
    ...overrides
  };
}

/**
 * A character speaking aloud, rendered in the shared bottom dialogue box with
 * their name in their color. Used on the IRL and streaming surfaces (e.g. Alex
 * talking on camera). Advanced by a tap.
 *
 * @param {string} id - Speaker character id.
 * @param {string} message - Spoken line.
 * @param {object} [overrides] - Command overrides.
 * @returns {object} Dialogue command.
 */
export function dialogue(id, message, overrides = {}) {
  return {
    type: "dialogue",
    id,
    message,
    ...overrides
  };
}

/**
 * Flashes the full game view. Pair with sound()/pause() for impact beats.
 *
 * @param {object} [options] - Flash options, e.g. { color, duration }.
 * @returns {object} Flash command.
 */
export function flash(options = {}) {
  return {
    type: "flash",
    ...options
  };
}

/**
 * Shakes the full game view. Pair with sound()/pause() for impact beats.
 *
 * @param {object} [options] - Shake options, e.g. { intensity, duration }.
 * @returns {object} Shake command.
 */
export function shake(options = {}) {
  return {
    type: "shake",
    ...options
  };
}

/**
 * Sets the active IRL background.
 *
 *   background("backgrounds/demo-room-day")                          → gentle dissolve
 *   background("backgrounds/demo-room-night", { transition: "cut" }) → instant
 *   background("backgrounds/demo-hall-day", { transition: "fade_to_black", duration: 900 })
 *
 * Presets: "dissolve" (default crossfade), "cut" (instant), "fade_to_black"
 * (dip through black — good for time skips). Duration is in milliseconds.
 *
 * @param {string} id - Background asset id.
 * @param {object} [options] - { transition, duration }.
 * @returns {object} Background command.
 */
export function background(id, options = {}) {
  return {
    type: "background",
    id,
    ...options
  };
}

/**
 * Shows or updates an IRL character sprite.
 *
 *   show("alex", { outfit: "hoodie", expression: "happy", side: "left" })
 *   show("riley", { side: "right", flip: true })   // mirror to face into scene
 *
 * Options: `outfit`, `expression`, `body`, `side`/`at`, `flip`, transform fields
 * (`x`, `y`, `scale`, `alpha`, `z`, `layer`), and motion fields
 * (`transition`, `duration`, `easing`). Staging and motion fields are sticky:
 * they persist across later show()/expression changes until set again.
 *
 * @param {object} [options] - Sprite staging and motion options.
 * @returns {object} Show-character command.
 */
export function show(id, options = {}) {
  return {
    type: "showCharacter",
    id,
    ...options
  };
}

/**
 * Removes an IRL character sprite from the stage.
 *
 * @param {string} id - Character id.
 * @returns {object} Hide-character command.
 */
export function hide(id, options = {}) {
  return {
    type: "hideCharacter",
    id,
    ...options
  };
}

/**
 * Removes every visible IRL character sprite.
 *
 * @param {object} [options] - Hide options, e.g. { transition, duration, easing }.
 * @returns {object} Hide-all command.
 */
export function hideAll(options = {}) {
  return {
    type: "hideAllCharacters",
    ...options
  };
}

/**
 * Clears every IRL displayable on the stage: characters, CGs, foreground
 * images, and focus. The background remains active.
 *
 * @param {object} [options] - Clear options, e.g. { transition, duration, easing }.
 * @returns {object} Clear-stage command.
 */
export function clearStage(options = {}) {
  return {
    type: "clearIrlStage",
    ...options
  };
}

/**
 * Changes a visible IRL character's expression without restating outfit/pose.
 *
 * @param {string} id - Character id.
 * @param {string} value - Expression id.
 * @param {object} [options] - Expression options, e.g. { transition, duration, easing }.
 * @returns {object} Expression command.
 */
export function expression(id, value, options = {}) {
  return {
    type: "setCharacterExpression",
    id,
    expression: value,
    ...options
  };
}

/**
 * Moves or restages a visible IRL character.
 *
 * @param {string} id - Character id.
 * @param {object|string} placement - Position preset or transform fields.
 * @param {object} [options] - Additional transform or motion fields.
 * @returns {object} Move-character command.
 */
export function move(id, placement, options = {}) {
  const placementOptions = typeof placement === "string" ? { at: placement } : { ...(placement ?? {}) };
  return {
    type: "moveCharacter",
    id,
    ...placementOptions,
    ...options
  };
}

/**
 * Shows a full-screen IRL event illustration.
 *
 * @param {string} asset - Image asset id.
 * @param {object} [options] - CG staging and motion options.
 * @returns {object} Show-CG command.
 */
export function cg(asset, options = {}) {
  return {
    type: "showIrlImage",
    id: options.id ?? "__cg",
    asset,
    kind: "cg",
    ...options
  };
}

/**
 * Clears the active full-screen IRL event illustration.
 *
 * @param {object} [options] - Clear options, e.g. { transition, duration, easing }.
 * @returns {object} Clear-CG command.
 */
export function clearCg(options = {}) {
  return {
    type: "clearIrlImage",
    kind: "cg",
    ...options
  };
}

/**
 * Shows or updates a general IRL image displayable, such as a prop or document.
 *
 * @param {string} id - Stable displayable id.
 * @param {string} asset - Image asset id.
 * @param {object} [options] - Image staging and motion options.
 * @returns {object} Show-image command.
 */
export function image(id, asset, options = {}) {
  return {
    type: "showIrlImage",
    id,
    asset,
    kind: "image",
    ...options
  };
}

/**
 * Moves or restages a visible IRL image displayable without changing its asset.
 *
 * @param {string} id - Stable displayable id.
 * @param {object|string} placement - Position preset or transform fields.
 * @param {object} [options] - Additional transform or motion fields.
 * @returns {object} Move-image command.
 */
export function moveImage(id, placement, options = {}) {
  const placementOptions = typeof placement === "string" ? { at: placement } : { ...(placement ?? {}) };
  return {
    type: "moveIrlImage",
    id,
    kind: "image",
    ...placementOptions,
    ...options
  };
}

/**
 * Clears a general IRL image displayable.
 *
 * @param {string} id - Stable displayable id.
 * @param {object} [options] - Clear options, e.g. { transition, duration, easing }.
 * @returns {object} Clear-image command.
 */
export function clearImage(id, options = {}) {
  return {
    type: "clearIrlImage",
    id,
    kind: "image",
    ...options
  };
}

/**
 * Shows or updates an advanced IRL media displayable.
 *
 * @param {string} id - Stable displayable id.
 * @param {object} options - Media options including kind and asset.
 * @returns {object} Show-media command.
 */
export function media(id, options = {}) {
  return {
    ...options,
    type: "showIrlImage",
    id,
    kind: options.kind ?? "image"
  };
}

/**
 * Moves or restages an advanced IRL media displayable.
 *
 * @param {string} id - Stable displayable id.
 * @param {object|string} placement - Position preset or transform fields.
 * @param {object} [options] - Additional transform or timing fields.
 * @returns {object} Move-media command.
 */
export function moveMedia(id, placement, options = {}) {
  const placementOptions = typeof placement === "string" ? { at: placement } : { ...(placement ?? {}) };
  return {
    ...placementOptions,
    ...options,
    type: "moveIrlImage",
    id,
    kind: "media"
  };
}

/**
 * Clears an advanced IRL media displayable.
 *
 * @param {string} id - Stable displayable id.
 * @param {object} [options] - Clear options, e.g. { transition, duration }.
 * @returns {object} Clear-media command.
 */
export function clearMedia(id, options = {}) {
  return {
    ...options,
    type: "clearIrlImage",
    id,
    kind: "media"
  };
}

/**
 * The one verb for someone speaking. The active stage decides how it looks:
 * a bubble on texting, a dialogue-box line on IRL/streaming.
 *
 * @param {string|Array<string>} a - Speaker id, or line(s) for the default voice.
 * @param {string|Array<string>|object} [b] - Line(s), or options.
 * @param {object} [c] - Options such as timestamp, waitTime, or expression.
 * @returns {object} Say command.
 */
export function say(a, b, c) {
  let speaker;
  let lines;
  let options;
  if (typeof b === "string" || Array.isArray(b)) {
    speaker = a;
    lines = b;
    options = c ?? {};
  } else {
    speaker = null;
    lines = a;
    options = b ?? {};
  }
  return {
    type: "say",
    speaker,
    lines: Array.isArray(lines) ? lines : [lines],
    ...options
  };
}

/**
 * Creates a block of IRL dialogue lines.
 *
 * @param {Array<object>} lines - Dialogue line items.
 * @returns {object} IRL line block command.
 */
export function lineBlock(lines) {
  return {
    type: "lineBlock",
    lines
  };
}

/**
 * Creates one IRL dialogue line.
 *
 * @param {string} id - Speaker id.
 * @param {string} message - Dialogue text.
 * @param {object} [overrides] - Line-level presentation overrides.
 * @returns {object} IRL dialogue line.
 */
export function line(id, message, overrides = {}) {
  return {
    kind: "line",
    id,
    message,
    ...overrides
  };
}

/**
 * Creates a player choice command.
 *
 * @param {object} definition - Choice metadata.
 * @param {string} definition.id - Choice id recorded in save state.
 * @param {Array<object>} definition.options - Selectable choice options.
 * @returns {object} Choice command.
 */
export function choice(definition) {
  // New form: choice([ "string" | { text, goto?, set?, showIf? } ]).
  if (Array.isArray(definition)) {
    return { type: "choice", options: definition.map(normalizeOption) };
  }
  // Legacy form: choice({ id, options: [...] }).
  return {
    type: "choice",
    ...definition,
    options: (definition.options ?? []).map(normalizeOption)
  };
}

/**
 * Normalizes a choice option: a bare string becomes `{ text }`.
 *
 * @param {string|object} option - Raw option.
 * @returns {object} Normalized option.
 */
function normalizeOption(option) {
  return typeof option === "string" ? { text: option } : { ...option };
}

/**
 * Plays a full-screen video cutscene and waits for it to finish.
 * Works on any surface; the video layer is compositor-owned.
 *
 *   video("intro_cutscene")
 *   video("ending_credits", { skippable: false, volume: 0.8 })
 *
 * @param {string} id - Discovered video asset id.
 * @param {object} [options] - Playback options.
 * @param {boolean} [options.skippable] - Click/tap skips the cutscene (default true).
 * @param {number} [options.volume] - Playback volume 0..1 (default 1, scaled by master).
 * @param {boolean} [options.loop] - Loop until skipped (default false; implies skippable).
 * @returns {object} Video command.
 */
export function video(id, options = {}) {
  const loop = options.loop === true;
  return {
    type: "video",
    id,
    skippable: loop ? true : options.skippable !== false,
    volume: Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume)) : 1,
    loop,
    mode: options.mode ?? (loop ? "loop" : "hold"),
    startAt: options.startAt ?? null,
    endAt: options.endAt ?? null,
    fit: options.fit ?? "cover",
    position: options.position ?? "center",
    muted: options.muted === true
  };
}
