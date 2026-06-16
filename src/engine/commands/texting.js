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
    ...overrides,
    type: "thread",
    id
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
    ...overrides,
    kind: "text",
    id,
    message
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
    ...overrides,
    kind: "image",
    id,
    image
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
    texts: [{ ...options, kind: "image", id, image }]
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
