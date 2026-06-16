import { createPhoneState, normalizePhoneState } from "./phone-state.js";
import {
  normalizeBackgroundMedia,
  normalizeStreamMedia
} from "./media-state.js";

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
      window: { state: "offline", image: null, media: null },
      viewers: null,
      chat: []
    },
    phoneCall: {
      active: false,
      contact: null,
      mode: "voice",
      title: "",
      canHangUp: false,
      log: true,
      status: "idle",
      transcript: [],
      startedAt: null
    },
    calls: {
      recents: [],
      voicemails: [],
      selectedTab: "recents"
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
    background: normalizeBackgroundMedia(visuals.background),
    phone: normalizePhoneState(visuals.phone),
    texting: normalizeTextingState(visuals.texting),
    streaming: {
      layout: visuals.streaming?.layout ?? null,
      title: visuals.streaming?.title ?? "offline",
      window: normalizeStreamWindowState(visuals.streaming?.window),
      viewers: visuals.streaming?.viewers ?? null,
      chat: Array.isArray(visuals.streaming?.chat)
        ? structuredClone(visuals.streaming.chat)
        : []
    },
    phoneCall: normalizePhoneCallState(visuals.phoneCall),
    calls: normalizeCallsState(visuals.calls)
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
 * Normalizes stream window state while preserving the legacy `image` field.
 *
 * @param {object} [windowState] - Saved or live stream window state.
 * @returns {object} Normalized stream window state.
 */
function normalizeStreamWindowState(windowState = {}) {
  const state = windowState?.state ?? "offline";
  const image = windowState?.image ?? windowState?.media?.asset ?? null;
  return {
    state,
    image,
    media: windowState?.media
      ? normalizeStreamMedia(windowState.media)
      : image
        ? normalizeStreamMedia({ kind: "image", asset: image, image })
        : null
  };
}

/**
 * Stores the active background.
 *
 * @param {object} visuals - Visual state.
 * @param {object|null} background - Background command state.
 * @returns {void}
 */
export function setBackgroundState(visuals, background) {
  visuals.background = normalizeBackgroundMedia(background);
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
  const image = command.image ?? (command.media?.kind === "image" ? command.media.asset : null);
  visuals.streaming.window = {
    state: command.state ?? "offline",
    image,
    media: command.media
      ? normalizeStreamMedia(command.media)
      : image
        ? normalizeStreamMedia({ kind: "image", asset: image, image, ...command })
        : null
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

/**
 * Starts the active phone call state.
 *
 * @param {object} visuals - Visual state.
 * @param {object} contact - Resolved call contact.
 * @param {object} command - Call command.
 * @param {number} commandIndex - Current command index.
 * @returns {object} Active call state.
 */
export function startPhoneCallState(visuals, contact, command = {}, commandIndex = 0) {
  visuals.phoneCall = normalizePhoneCallState(visuals.phoneCall);
  visuals.phoneCall = {
    active: true,
    contact: structuredClone(contact),
    mode: normalizeCallMode(command.mode),
    title: command.title ?? "On call",
    canHangUp: command.canHangUp === true,
    log: command.log !== false,
    status: "active",
    transcript: [],
    startedAt: command.startedAt ?? commandIndex
  };
  return visuals.phoneCall;
}

/**
 * Appends a transcript line to the active phone call.
 *
 * @param {object} visuals - Visual state.
 * @param {object} line - Transcript line.
 * @returns {object} Stored line.
 */
export function appendPhoneCallTranscript(visuals, line) {
  visuals.phoneCall = normalizePhoneCallState(visuals.phoneCall);
  const entry = {
    id: line.id ?? null,
    name: line.name ?? line.id ?? "",
    kind: line.kind ?? "dialogue",
    message: line.message ?? "",
    side: line.side ?? "left"
  };
  visuals.phoneCall.transcript.push(entry);
  return structuredClone(entry);
}

/**
 * Ends the active phone call and optionally writes a recent-call entry.
 *
 * @param {object} visuals - Visual state.
 * @param {object} [options] - End call options.
 * @returns {object|null} Created recent-call entry.
 */
export function endPhoneCallState(visuals, options = {}) {
  visuals.phoneCall = normalizePhoneCallState(visuals.phoneCall);
  visuals.calls = normalizeCallsState(visuals.calls);
  const activeCall = visuals.phoneCall;
  if (!activeCall.active) {
    return null;
  }
  const status = normalizeCallStatus(options.status);
  let recent = null;
  if (activeCall.log !== false && options.log !== false && activeCall.contact) {
    recent = {
      id: options.id ?? `call:${activeCall.contact.id ?? activeCall.contact.name}:${activeCall.startedAt}`,
      contact: structuredClone(activeCall.contact),
      mode: activeCall.mode,
      status,
      title: options.title ?? activeCall.title ?? "",
      transcript: structuredClone(activeCall.transcript)
    };
    visuals.calls.recents = [
      recent,
      ...visuals.calls.recents.filter((entry) => entry.id !== recent.id)
    ];
  }
  visuals.phoneCall = {
    ...activeCall,
    active: false,
    status
  };
  return recent;
}

/**
 * Adds or updates a voicemail entry in the Calls app.
 *
 * @param {object} calls - Mutable calls app state.
 * @param {object} command - Voicemail command.
 * @param {object} contact - Resolved contact.
 * @returns {object} Stored voicemail.
 */
export function saveVoicemailState(calls, command, contact) {
  const voicemail = {
    id: command.id,
    contact: structuredClone(contact),
    text: command.text ?? command.message ?? "",
    audio: command.audio ?? null,
    read: false,
    transcript: Array.isArray(command.transcript)
      ? structuredClone(command.transcript)
      : []
  };
  calls.voicemails = [
    voicemail,
    ...calls.voicemails.filter((entry) => entry.id !== command.id)
  ];
  return voicemail;
}

/**
 * Normalizes the authored phone call state.
 *
 * @param {object} [value] - Candidate call state.
 * @returns {object} Normalized call state.
 */
function normalizePhoneCallState(value = {}) {
  return {
    active: Boolean(value?.active),
    contact: value?.contact ? structuredClone(value.contact) : null,
    mode: normalizeCallMode(value?.mode),
    title: value?.title ?? "",
    canHangUp: value?.canHangUp === true,
    log: value?.log !== false,
    status: value?.status ?? "idle",
    transcript: Array.isArray(value?.transcript)
      ? value.transcript.map((line) => ({
          id: line?.id ?? null,
          name: line?.name ?? line?.id ?? "",
          kind: line?.kind ?? "dialogue",
          message: line?.message ?? "",
          side: line?.side ?? "left"
        }))
      : [],
    startedAt: value?.startedAt ?? null
  };
}

/**
 * Normalizes Calls phone app state.
 *
 * @param {object} [value] - Candidate calls state.
 * @returns {object} Normalized calls state.
 */
function normalizeCallsState(value = {}) {
  return {
    recents: Array.isArray(value?.recents)
      ? value.recents
          .filter((entry) => entry?.id)
          .map((entry) => ({
            id: entry.id,
            contact: entry.contact ? structuredClone(entry.contact) : null,
            mode: normalizeCallMode(entry.mode),
            status: normalizeCallStatus(entry.status),
            title: entry.title ?? "",
            transcript: Array.isArray(entry.transcript) ? structuredClone(entry.transcript) : []
          }))
      : [],
    voicemails: Array.isArray(value?.voicemails)
      ? value.voicemails
          .filter((entry) => entry?.id)
          .map((entry) => ({
            id: entry.id,
            contact: entry.contact ? structuredClone(entry.contact) : null,
            text: entry.text ?? "",
            audio: entry.audio ?? null,
            read: Boolean(entry.read),
            transcript: Array.isArray(entry.transcript) ? structuredClone(entry.transcript) : []
          }))
      : [],
    selectedTab: value?.selectedTab === "voicemail" ? "voicemail" : "recents"
  };
}

/**
 * Normalizes a phone call mode.
 *
 * @param {unknown} value - Candidate mode.
 * @returns {"voice"|"video"|"voicemail"} Call mode.
 */
function normalizeCallMode(value) {
  return ["voice", "video", "voicemail"].includes(value) ? value : "voice";
}

/**
 * Normalizes a phone call completion status.
 *
 * @param {unknown} value - Candidate status.
 * @returns {"completed"|"missed"|"declined"|"failed"} Call status.
 */
function normalizeCallStatus(value) {
  return ["completed", "missed", "declined", "failed"].includes(value) ? value : "completed";
}
