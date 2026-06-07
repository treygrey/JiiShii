/**
 * Creates a full scene definition.
 *
 * @param {object} definition - Scene metadata and script commands.
 * @param {string} definition.id - Unique scene id.
 * @param {Array<object>} [definition.characters] - Scene character declarations.
 * @param {Array<object>} definition.script - Ordered scene command list.
 * @returns {object} Scene definition.
 */
export function scene(definition) {
  return {
    characters: [],
    ...definition
  };
}

/**
 * References a global character while allowing scene-specific overrides.
 *
 * @param {string} id - Global character id.
 * @param {object} [overrides] - Scene-specific character fields.
 * @returns {object} Character declaration command.
 */
export function useCharacter(id, overrides = {}) {
  return {
    type: "character",
    id,
    useGlobal: true,
    overrides
  };
}

/**
 * Declares a scene-local character.
 *
 * @param {object} definition - Character presentation defaults.
 * @param {string} definition.id - Character id used by script commands.
 * @param {string} definition.name - Display name.
 * @param {string} definition.color - Accent color.
 * @param {"left" | "right" | "center"} definition.side - Default message side.
 * @returns {object} Character declaration command.
 */
export function character(definition) {
  return {
    type: "character",
    useGlobal: false,
    ...definition
  };
}

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

// =============================================================================
// Writer-facing vocabulary (Programming for English Majors). These are the
// names scenes are authored in; several are friendly aliases over the
// lower-level commands above, kept so old scenes keep working.
// =============================================================================

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
 * Creates a block of text messages that reveal as one player-advance unit.
 *
 * @param {Array<object>} texts - Text or image message items.
 * @returns {object} Text block command.
 */
export function block(texts) {
  return {
    type: "textBlock",
    texts
  };
}

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
    type: "pause",
    duration,
    ...options
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
 *   background("demo_room_day")                          → gentle dissolve
 *   background("demo_room_night", { transition: "cut" }) → instant
 *   background("demo_hall_day", { transition: "fade_to_black", duration: 900 })
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
 * Options: `outfit`, `expression`, `side`/`at`, `flip`, transform fields
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
 * The one verb for someone speaking. The active stage decides how it looks —
 * a bubble on texting, a dialogue-box line on irl/streaming.
 *
 *   say("alex", "hi")          → Alex
 *   say("hi")                 → the default voice (first in the scene's cast)
 *   say("alex", ["a", "b"])    → Alex, several lines (one tap on texting)
 *   say("alex", "hi", { ... }) → with overrides (timestamp, waitTime, focus)
 *
 * Distinguishing the forms: if the 2nd argument is text or a list, the 1st is
 * the speaker. If the 2nd argument is an options object (or absent), the 1st is
 * the line and the default voice speaks it.
 *
 * @param {string|Array<string>} a - Speaker id, or the line(s) for the default voice.
 * @param {string|Array<string>|object} [b] - Line(s), or options.
 * @param {object} [c] - Options.
 * @returns {object} Say command.
 */
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
 * Plays a one-shot sound effect.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Sound options.
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
 * Plays a one-shot voice line.
 *
 * @param {string} id - Audio asset id.
 * @param {object} [options] - Voice options.
 * @returns {object} Voice command.
 */
export function voice(id, options = {}) {
  return {
    type: "voice",
    id,
    ...options
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
 * Configures the streaming surface layout and channel metadata.
 *
 * @param {object} definition - Streaming layout data.
 * @returns {object} Streaming layout command.
 */
export function streamLayout(definition) {
  return {
    type: "streamLayout",
    ...definition
  };
}

/**
 * Displays an image in the stream window.
 *
 * @param {string} image - Stream image asset id.
 * @param {object} [options] - Stream image options.
 * @returns {object} Stream image command.
 */
export function streamImage(image, options = {}) {
  return {
    type: "streamImage",
    image,
    ...options
  };
}

/**
 * Creates a block of streaming chat messages.
 *
 * @param {Array<object>} messages - Stream chat message items.
 * @param {object} [options] - Options (e.g. { concurrent: true }).
 * @returns {object} Streaming chat block command.
 */
export function streamChatBlock(messages, options = {}) {
  return {
    type: "streamChatBlock",
    messages,
    ...options
  };
}

/**
 * Creates one streaming chat message.
 *
 * @param {string} id - Chatter id.
 * @param {string} message - Chat message body.
 * @param {object} [overrides] - Chat display overrides.
 * @returns {object} Streaming chat message.
 */
export function streamChat(id, message, overrides = {}) {
  return {
    kind: "streamChat",
    id,
    message,
    ...overrides
  };
}

/**
 * Creates a streaming narration block.
 *
 * @param {string} message - Narration text.
 * @param {object} [options] - Narration options.
 * @returns {object} Streaming narration command.
 */
export function streamNarration(message, options = {}) {
  return {
    type: "streamNarration",
    message,
    ...options
  };
}

/**
 * Sets or updates the stream's title bar (instant, no tap).
 *
 * @param {string} text - Title text.
 * @returns {object} Stream title command.
 */
export function streamTitle(text) {
  return {
    type: "streamTitle",
    text
  };
}

/**
 * Sets the stream window state (instant, no tap). "offline" shows the gray
 * waiting box, "live" shows the streamer image, "ended" goes black.
 *
 * @param {"offline" | "live" | "ended"} state - Window state.
 * @param {string | null} [image] - Streamer image id for the live state.
 * @returns {object} Stream window command.
 */
export function streamWindow(state, image = null) {
  return {
    type: "streamWindow",
    state,
    image
  };
}

/**
 * Inserts a system line into chat (e.g. a timeout or "stream ended"). Instant.
 *
 * @param {string} text - System message.
 * @returns {object} Stream system command.
 */
export function streamSystem(text) {
  return {
    type: "streamSystem",
    text
  };
}

/**
 * Posts a message into chat as Player (mod-highlighted). Instant. Usually the
 * result of a choice.
 *
 * @param {string} message - Chat message body.
 * @returns {object} Stream post command.
 */
export function streamPost(message) {
  return {
    type: "streamPost",
    message
  };
}

/**
 * Switches the texting surface to another conversation thread (clears the
 * thread and re-titles it for the new contact). Instant.
 *
 * @param {string} id - Contact character id.
 * @param {object} [overrides] - Header overrides (e.g. subtitle).
 * @returns {object} Thread command.
 */
export function thread(id, overrides = {}) {
  return {
    type: "thread",
    id,
    ...overrides
  };
}

/**
 * Creates a text message item.
 *
 * @param {string} id - Speaker id.
 * @param {string} message - Message body.
 * @param {object} [overrides] - Message-level presentation overrides.
 * @returns {object} Text message item.
 */
export function text(id, message, overrides = {}) {
  return {
    kind: "text",
    id,
    message,
    ...overrides
  };
}

/**
 * Creates an image message item.
 *
 * @param {string} id - Speaker id.
 * @param {string} image - Image asset id.
 * @param {object} [overrides] - Message-level presentation overrides.
 * @returns {object} Image message item.
 */
export function textImage(id, image, overrides = {}) {
  return {
    kind: "image",
    id,
    image,
    ...overrides
  };
}

/**
 * A photo someone sends in a texting thread — a self-contained image beat
 * (one tap). The active stage shows it as a photo attachment.
 *
 * @param {string} id - Sender character id.
 * @param {string} image - Image asset id.
 * @param {object} [options] - Overrides (timestamp, waitTime, caption).
 * @returns {object} Text block command containing one image.
 */
export function photo(id, image, options = {}) {
  return {
    type: "textBlock",
    texts: [{ kind: "image", id, image, ...options }]
  };
}

/**
 * Creates a non-branching authored player reply.
 *
 * @param {string} message - Player reply body.
 * @param {object} [overrides] - Message-level presentation overrides.
 * @returns {object} Player text message item.
 */
export function reply(message, overrides = {}) {
  return text("player", message, overrides);
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
 * Branches on the variable store. Supports three forms:
 *   condition({ flag: "metRiley", then, else })          // truthy var check
 *   condition({ if: (v) => v.gold >= 5, then, else })   // predicate over vars
 *   condition({ var: "die", op: ">=", value: 4, then, else })  // comparison
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
