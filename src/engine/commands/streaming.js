/**
 * Configures the streaming surface layout and channel metadata.
 *
 * @param {object} definition - Streaming layout data.
 * @returns {object} Streaming layout command.
 */
export function streamLayout(definition) {
  return {
    ...definition,
    type: "streamLayout"
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
    ...options,
    type: "streamImage",
    image
  };
}

/**
 * Plays or loops a video inside the stream window.
 *
 * @param {string} video - Stream video asset id.
 * @param {object} [options] - Stream video options.
 * @returns {object} Stream video command.
 */
export function streamVideo(video, options = {}) {
  const mode = options.mode ?? (options.loop ? "loop" : "hold");
  return {
    ...options,
    type: "streamVideo",
    video,
    mode,
    muted: options.muted !== false,
    loop: mode === "loop" || options.loop === true
  };
}

/**
 * Creates a block of streaming chat messages.
 *
 * Accepts either `streamChatBlock(messages, options)` for quick authoring or
 * `streamChatBlock(id, messages, options)` when a scene wants a named block.
 *
 * @param {string|Array<object>} idOrMessages - Optional block id, or messages.
 * @param {Array<object>|object} [messagesOrOptions] - Messages or options.
 * @param {object} [options] - Options (e.g. { concurrent: true }).
 * @returns {object} Streaming chat block command.
 */
export function streamChatBlock(idOrMessages, messagesOrOptions = {}, options = {}) {
  const hasId = typeof idOrMessages === "string";
  const messages = hasId ? messagesOrOptions : idOrMessages;
  const resolvedOptions = hasId ? options : messagesOrOptions;

  return {
    ...resolvedOptions,
    ...(hasId ? { id: idOrMessages } : {}),
    messages: Array.isArray(messages) ? messages : [],
    type: "streamChatBlock"
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
    ...overrides,
    kind: "streamChat",
    id,
    message
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
    ...options,
    type: "streamNarration",
    message
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
