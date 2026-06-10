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
