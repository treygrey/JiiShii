/**
 * Creates serializable non-sprite visual state for surfaces and background.
 *
 * @returns {object} Empty visual state.
 */
export function createVisualState() {
  return {
    background: null,
    texting: {
      contact: null,
      messages: []
    },
    streaming: {
      layout: null,
      title: "offline",
      window: { state: "offline", image: null },
      viewers: null,
      chat: []
    }
  };
}

/**
 * Normalizes partial or older non-sprite visual state.
 *
 * @param {object} [visuals] - Saved visual state.
 * @returns {object} Normalized visual state.
 */
export function normalizeVisualState(visuals = {}) {
  return {
    background: visuals.background ?? null,
    texting: {
      contact: visuals.texting?.contact ?? null,
      messages: Array.isArray(visuals.texting?.messages)
        ? structuredClone(visuals.texting.messages)
        : []
    },
    streaming: {
      layout: visuals.streaming?.layout ?? null,
      title: visuals.streaming?.title ?? "offline",
      window: visuals.streaming?.window ?? { state: "offline", image: null },
      viewers: visuals.streaming?.viewers ?? null,
      chat: Array.isArray(visuals.streaming?.chat)
        ? structuredClone(visuals.streaming.chat)
        : []
    }
  };
}

/**
 * Deep-clones non-sprite visual state.
 *
 * @param {object} visuals - Visual state.
 * @returns {object} Detached visual state.
 */
export function cloneVisualState(visuals) {
  return normalizeVisualState(structuredClone(visuals ?? createVisualState()));
}

/**
 * Stores the active background.
 *
 * @param {object} visuals - Visual state.
 * @param {object|null} background - Background command state.
 * @returns {void}
 */
export function setBackgroundState(visuals, background) {
  visuals.background = background ? { ...background } : null;
}

/**
 * Applies a texting thread change and clears prior messages.
 *
 * @param {object} visuals - Visual state.
 * @param {object} contact - Thread contact.
 * @returns {void}
 */
export function setTextingThread(visuals, contact) {
  visuals.texting.contact = structuredClone(contact);
  visuals.texting.messages = [];
}

/**
 * Appends texting messages to visual state.
 *
 * @param {object} visuals - Visual state.
 * @param {Array<object>} messages - Texting messages.
 * @returns {void}
 */
export function appendTextMessages(visuals, messages = []) {
  visuals.texting.messages.push(...structuredClone(messages));
}

/**
 * Applies stream layout metadata to visual state.
 *
 * @param {object} visuals - Visual state.
 * @param {object} command - Stream layout command.
 * @returns {void}
 */
export function setStreamLayoutState(visuals, command) {
  visuals.streaming.layout = structuredClone(command);
  if (command.title) {
    visuals.streaming.title = command.title;
  }
  if (typeof command.viewers === "number") {
    visuals.streaming.viewers = command.viewers;
  }
}

/**
 * Applies stream title text.
 *
 * @param {object} visuals - Visual state.
 * @param {string} title - Stream title.
 * @returns {void}
 */
export function setStreamTitleState(visuals, title) {
  visuals.streaming.title = title;
}

/**
 * Applies stream window state.
 *
 * @param {object} visuals - Visual state.
 * @param {object} command - Stream window command.
 * @returns {void}
 */
export function setStreamWindowState(visuals, command) {
  visuals.streaming.window = {
    state: command.state ?? "offline",
    image: command.image ?? null
  };
}

/**
 * Appends stream chat/system/mod entries.
 *
 * @param {object} visuals - Visual state.
 * @param {Array<object>} entries - Stream chat entries.
 * @returns {void}
 */
export function appendStreamChat(visuals, entries = []) {
  visuals.streaming.chat.push(...structuredClone(entries));
}
