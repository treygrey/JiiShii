import { createPhoneState, normalizePhoneState } from "./phone-state.js";

const PLAYER_TEXT_ID = "player";
const MESSAGE_RENDER_KEY = "__jiishiiMessageKey";

/**
 * Creates serializable non-sprite visual state for surfaces and background.
 *
 * @returns {object} Empty visual state.
 */
export function createVisualState() {
  return {
    background: null,
    phone: createPhoneState(),
    texting: {
      contact: null,
      messages: [],
      threads: {},
      currentThreadId: null,
      nextThreadActivityId: 1
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
  const normalized = {
    background: visuals.background ?? null,
    phone: normalizePhoneState(visuals.phone),
    texting: normalizeTextingState(visuals.texting),
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
  for (const [key, value] of Object.entries(visuals ?? {})) {
    if (!(key in normalized)) {
      normalized[key] = structuredClone(value);
    }
  }
  return normalized;
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
 * Applies a texting thread change while preserving the saved scrollback for
 * every known conversation. Rollback rebuilds this state from authored thread
 * and text commands, so a thread selected after rollback disappears naturally.
 *
 * @param {object} visuals - Visual state.
 * @param {object} contact - Thread contact.
 * @returns {void}
 */
export function setTextingThread(visuals, contact) {
  visuals.texting = normalizeTextingState(visuals.texting);
  const threadId = getTextingThreadId(contact);
  const existingThread = visuals.texting.threads[threadId] ?? null;
  const normalizedContact = structuredClone({ ...contact, id: contact.id ?? threadId });
  const thread = existingThread ?? createTextingThread(threadId, normalizedContact);

  thread.contact = { ...thread.contact, ...normalizedContact };
  thread.unread = false;
  visuals.texting.threads[threadId] = thread;
  visuals.texting.currentThreadId = threadId;
  visuals.texting.contact = structuredClone(thread.contact);
  visuals.texting.messages = structuredClone(thread.messages);
}

/**
 * Appends texting messages to visual state.
 *
 * @param {object} visuals - Visual state.
 * @param {Array<object>} messages - Texting messages.
 * @returns {Array<object>} The appended messages with stable render keys.
 */
export function appendTextMessages(visuals, messages = []) {
  visuals.texting = normalizeTextingState(visuals.texting);
  const threadId = visuals.texting.currentThreadId ?? getTextingThreadId(visuals.texting.contact);
  const thread = visuals.texting.threads[threadId]
    ?? createTextingThread(threadId, visuals.texting.contact ?? { id: threadId, name: "Messages" });
  const clonedMessages = withMessageRenderKeys(messages, threadId, thread.messages.length);

  thread.messages.push(...clonedMessages);
  if (clonedMessages.some((message) => message.id && message.id !== PLAYER_TEXT_ID)) {
    thread.lastReceivedAt = visuals.texting.nextThreadActivityId;
    visuals.texting.nextThreadActivityId += 1;
  }
  thread.preview = messagePreview(clonedMessages.at(-1)) ?? thread.preview;

  visuals.texting.threads[threadId] = thread;
  visuals.texting.currentThreadId = threadId;
  visuals.texting.contact = structuredClone(thread.contact);
  visuals.texting.messages = structuredClone(thread.messages);
  return structuredClone(clonedMessages);
}

/**
 * Marks a texting conversation unread for app badges and inbox rows.
 *
 * @param {object} visuals - Visual state.
 * @param {object} contact - Thread contact.
 * @param {object} [options] - Pending inbox metadata.
 * @param {string} [options.preview] - Inbox preview text.
 * @param {string|null} [options.pendingSceneId] - Scene to load when opened.
 * @param {number|null} [options.pendingCommandIndex] - Thread command to resume when opened.
 * @returns {void}
 */
export function markTextThreadUnread(visuals, contact, options = {}) {
  visuals.texting = normalizeTextingState(visuals.texting);
  const threadId = getTextingThreadId(contact);
  const thread = visuals.texting.threads[threadId] ?? createTextingThread(threadId, contact);
  thread.contact = { ...thread.contact, ...structuredClone(contact), id: contact.id ?? threadId };
  thread.unread = true;
  thread.preview = options.preview ?? thread.preview ?? "New message";
  thread.pendingSceneId = options.pendingSceneId ?? thread.pendingSceneId ?? null;
  thread.pendingCommandIndex = Number.isFinite(options.pendingCommandIndex)
    ? options.pendingCommandIndex
    : thread.pendingCommandIndex ?? null;
  thread.lastReceivedAt = visuals.texting.nextThreadActivityId;
  visuals.texting.nextThreadActivityId += 1;
  visuals.texting.threads[threadId] = thread;
}

/**
 * Marks a texting conversation read.
 *
 * @param {object} visuals - Visual state.
 * @param {string} threadId - Thread id.
 * @returns {void}
 */
export function markTextThreadRead(visuals, threadId) {
  visuals.texting = normalizeTextingState(visuals.texting);
  const thread = visuals.texting.threads[threadId];
  if (thread) {
    thread.unread = false;
    thread.pendingSceneId = null;
    thread.pendingCommandIndex = null;
  }
}

/**
 * Returns whether any saved texting thread is unread.
 *
 * @param {object} visuals - Visual state.
 * @returns {boolean} True when at least one text thread is unread.
 */
export function hasUnreadTextThreads(visuals) {
  const texting = normalizeTextingState(visuals?.texting);
  return Object.values(texting.threads).some((thread) => thread.unread);
}

/**
 * Normalizes the phone texting/inbox state.
 *
 * @param {object} [value] - Saved texting state.
 * @returns {object} Normalized texting state.
 */
function normalizeTextingState(value = {}) {
  const contact = value?.contact ? structuredClone(value.contact) : null;
  const threads = normalizeTextThreads(value?.threads);
  const currentThreadId = typeof value?.currentThreadId === "string" && value.currentThreadId
    ? value.currentThreadId
    : contact
      ? getTextingThreadId(contact)
      : null;
  const messages = Array.isArray(value?.messages)
    ? withMessageRenderKeys(value.messages, currentThreadId ?? "messages")
    : [];

  if (contact && currentThreadId && !threads[currentThreadId]) {
    threads[currentThreadId] = createTextingThread(currentThreadId, contact, messages);
  }

  const activeMessages = currentThreadId && threads[currentThreadId]
    ? structuredClone(threads[currentThreadId].messages)
    : messages;
  const lastActivity = Math.max(0, ...Object.values(threads).map((thread) => thread.lastReceivedAt ?? 0));
  const requestedNextActivity = Number.isFinite(value?.nextThreadActivityId)
    ? value.nextThreadActivityId
    : 1;

  return {
    contact,
    messages: activeMessages,
    threads,
    currentThreadId,
    nextThreadActivityId: Math.max(requestedNextActivity, lastActivity + 1)
  };
}

/**
 * Normalizes saved texting thread records.
 *
 * @param {unknown} value - Candidate thread record.
 * @returns {Record<string, object>} Normalized thread record.
 */
function normalizeTextThreads(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([threadId, thread]) => typeof threadId === "string" && threadId && thread)
      .map(([threadId, thread]) => [
        threadId,
        {
          id: threadId,
          contact: thread.contact ? structuredClone(thread.contact) : { id: threadId, name: threadId },
          messages: Array.isArray(thread.messages)
            ? withMessageRenderKeys(thread.messages, threadId)
            : [],
          preview: typeof thread.preview === "string" ? thread.preview : null,
          pendingSceneId: typeof thread.pendingSceneId === "string" ? thread.pendingSceneId : null,
          pendingCommandIndex: Number.isFinite(thread.pendingCommandIndex) ? thread.pendingCommandIndex : null,
          lastReceivedAt: Number.isFinite(thread.lastReceivedAt) ? thread.lastReceivedAt : 0,
          unread: Boolean(thread.unread)
        }
      ])
  );
}

/**
 * Creates a normalized thread record.
 *
 * @param {string} threadId - Thread id.
 * @param {object} contact - Contact header.
 * @param {Array<object>} [messages] - Existing messages.
 * @returns {object} Thread record.
 */
function createTextingThread(threadId, contact, messages = []) {
  const keyedMessages = withMessageRenderKeys(messages, threadId);
  const latestPreview = messagePreview(keyedMessages.at(-1));
  return {
    id: threadId,
    contact: structuredClone({ ...contact, id: contact?.id ?? threadId }),
    messages: keyedMessages,
    preview: latestPreview,
    pendingSceneId: null,
    pendingCommandIndex: null,
    lastReceivedAt: keyedMessages.some((message) => message.id && message.id !== PLAYER_TEXT_ID) ? 1 : 0,
    unread: false
  };
}

/**
 * Adds stable private render keys to texting messages.
 *
 * @param {Array<object>} messages - Message records.
 * @param {string} threadId - Owning thread id.
 * @param {number} [startIndex] - Starting message index within the thread.
 * @returns {Array<object>} Cloned keyed messages.
 */
function withMessageRenderKeys(messages = [], threadId = "messages", startIndex = 0) {
  return structuredClone(messages).map((message, index) => ({
    ...message,
    [MESSAGE_RENDER_KEY]: message?.[MESSAGE_RENDER_KEY] ?? `${threadId}:${startIndex + index}`
  }));
}

/**
 * Resolves a stable thread id.
 *
 * @param {object|null} contact - Contact header.
 * @returns {string} Stable thread id.
 */
function getTextingThreadId(contact) {
  return contact?.id ?? contact?.name ?? "messages";
}

/**
 * Converts a text message into an inbox preview.
 *
 * @param {object|undefined} message - Texting message.
 * @returns {string|null} Preview text.
 */
function messagePreview(message) {
  if (!message) {
    return null;
  }
  if (message.kind === "image") {
    return "Photo";
  }
  return typeof message.message === "string" && message.message ? message.message : null;
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
