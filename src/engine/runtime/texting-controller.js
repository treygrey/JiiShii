import {
  hasUnreadTextThreads,
  markTextThreadRead as markTextThreadReadState,
  markTextThreadUnread as markTextThreadUnreadState,
  setTextingThread
} from "../state/visual-state.js";
import { clearPhoneNotification } from "../state/phone-state.js";

/**
 * Resolves a thread command into a texting contact header.
 *
 * @param {object} runner - Active scene runner.
 * @param {object} command - Thread command.
 * @returns {object} Contact header { id, name, color, avatar, subtitle }.
 */
export function resolveThreadContact(runner, command) {
  const character = runner.characters.get(command.id) ?? { id: command.id, name: command.id };
  return {
    id: command.id,
    name: character.name ?? command.id,
    color: character.color,
    avatar: command.avatar ?? (character.name ?? command.id).slice(0, 1),
    subtitle: command.subtitle ?? ""
  };
}

/**
 * Starts a texting thread from an incoming/outgoing speaker when authored
 * script uses say() without an explicit thread() command first.
 *
 * @param {object} runner - Active scene runner.
 * @param {string} speakerId - Resolved speaker id for the current say beat.
 * @returns {void}
 */
export function ensureTextingThreadForSpeaker(runner, speakerId) {
  if (runner.state.visuals.texting?.currentThreadId) {
    return;
  }
  if (!speakerId || speakerId === "player" || speakerId === "me") {
    return;
  }
  const contact = resolveThreadContact(runner, { id: speakerId });
  setTextingThread(runner.state.visuals, contact);
  runner.activeRenderer?.setThread?.(contact);
}

/**
 * Converts scene-level phone contact metadata into the same shape used by
 * thread() commands, so cross-scene text conversations can share phone UI.
 *
 * @param {object} scene - Scene definition with optional contact metadata.
 * @returns {object|null} Normalized contact or null when the scene has none.
 */
export function resolveSceneContact(scene) {
  if (!scene?.contact) {
    return null;
  }
  const name = scene.contact.name ?? scene.id ?? "Messages";
  return {
    id: scene.contact.id ?? scene.id ?? name,
    name,
    color: scene.contact.color,
    avatar: scene.contact.avatar ?? name.slice(0, 1),
    subtitle: scene.contact.subtitle ?? ""
  };
}

/**
 * Checks whether a target scene is actually a texting story scene. Contact
 * metadata alone is not enough: streaming and IRL scenes can have contact
 * data for phone apps, and those should not masquerade as incoming texts.
 *
 * @param {object} scene - Scene definition to inspect.
 * @returns {boolean} True when the first authored surface is texting.
 */
export function sceneStartsInTexting(scene) {
  for (const command of scene?.script ?? []) {
    if (command.type === "surface" || command.type === "openLayer" || command.type === "pushSurface") {
      return command.id === "texting";
    }
  }
  return false;
}

/**
 * Checks whether a transition should feel like an interrupting new message
 * instead of pressing a VN continue button. This only applies while the
 * authored story is already inside a populated texting thread. Messages opened
 * as a phone app are navigation state, not story state, and should not create
 * an extra toast/click step before revealing the target conversation.
 *
 * @param {object} runner - Active scene runner.
 * @param {object} command - Transition command.
 * @returns {object|null} Target contact when a notification should be shown.
 */
export function getTextingTransitionNotificationContact(runner, command) {
  if (
    runner.reconstructing ||
    !runner.isStoryTextingActive() ||
    !command.target ||
    !runner.registry[command.target] ||
    typeof runner.activeRenderer?.showThreadNotification !== "function"
  ) {
    return null;
  }

  const targetScene = runner.registry[command.target];
  if (!sceneStartsInTexting(targetScene)) {
    return null;
  }

  const messageCount = runner.state.visuals.texting?.messages?.length ?? 0;
  if (messageCount === 0) {
    return null;
  }

  const currentContact = runner.state.visuals.texting?.contact ?? resolveSceneContact(runner.scene);
  const targetContact = resolveSceneContact(targetScene);
  if (!currentContact || !targetContact) {
    return null;
  }

  const currentKey = currentContact.id ?? currentContact.name;
  const targetKey = targetContact.id ?? targetContact.name;
  return currentKey !== targetKey ? targetContact : null;
}

/**
 * Marks an inbox thread unread and mirrors that state onto the Messages app
 * badge.
 *
 * @param {object} runner - Active scene runner.
 * @param {object} contact - Thread contact.
 * @param {object} [options] - Pending inbox metadata.
 * @returns {void}
 */
export function markTextThreadUnread(runner, contact, options = {}) {
  markTextThreadUnreadState(runner.state.visuals, contact, options);
  runner.state.visuals.phone.badges.texting = true;
}

/**
 * Marks an inbox thread read and clears the Messages badge once no unread
 * threads remain.
 *
 * @param {object} runner - Active scene runner.
 * @param {string} threadId - Thread id.
 * @returns {void}
 */
export function markTextThreadRead(runner, threadId) {
  markTextThreadReadState(runner.state.visuals, threadId);
  if (!hasUnreadTextThreads(runner.state.visuals)) {
    runner.state.visuals.phone.badges.texting = false;
    clearPhoneNotification(runner.state.visuals.phone, "texting");
  }
  if (!runner.reconstructing) {
    runner.save();
    runner.projectSurface("texting", { instant: true });
    runner.projectSurface("phone_home", { instant: true });
  }
}

/**
 * Opens a conversation from the Messages inbox. Pending story texts resume
 * their authored scene/command; ordinary read threads stay in the phone app
 * as scrollback.
 *
 * @param {object} runner - Active scene runner.
 * @param {string} threadId - Thread id to open.
 * @returns {boolean} True when opening consumed a pending story action.
 */
export function openTextThread(runner, threadId) {
  const thread = runner.state.visuals.texting?.threads?.[threadId] ?? null;
  if (!thread) {
    return false;
  }

  const pendingSceneId = thread.pendingSceneId;
  const pendingCommandIndex = thread.pendingCommandIndex;

  if (pendingSceneId && runner.registry[pendingSceneId]) {
    markTextThreadRead(runner, threadId);
    runner.blockingInput = false;
    runner.isWaitingForPlayer = false;
    runner.loadScene(pendingSceneId);
    return true;
  }

  if (
    Number.isFinite(pendingCommandIndex) &&
    pendingCommandIndex === runner.state.currentCommandIndex &&
    runner.state.currentSurface === "texting"
  ) {
    setTextingThread(runner.state.visuals, thread.contact);
    markTextThreadRead(runner, threadId);
    runner.activeRenderer?.setThread?.(thread.contact);
    runner.blockingInput = false;
    runner.isWaitingForPlayer = false;
    runner.advanceCommand();
    runner.save();
    runner.runUntilBlocked();
    return true;
  }

  markTextThreadRead(runner, threadId);
  return false;
}

/**
 * Finds a short inbox preview from authored text commands.
 *
 * @param {object} scene - Scene to scan.
 * @param {number} [startIndex] - Script index to begin scanning.
 * @param {string} [contactId] - Expected incoming contact id.
 * @returns {string} Preview text.
 */
export function previewIncomingText(scene, startIndex = 0, contactId = null) {
  for (const command of scene?.script?.slice(startIndex) ?? []) {
    if (command.type === "thread" && contactId && command.id !== contactId) {
      return "New message";
    }
    if (command.type === "textBlock") {
      const incoming = (command.texts ?? []).find((message) => message.id && message.id !== "player");
      if (incoming?.kind === "image") {
        return "Photo";
      }
      if (incoming?.message) {
        return incoming.message;
      }
    }
    if (command.type === "say" && command.speaker !== "player") {
      return (command.lines ?? [command.message ?? ""]).filter(Boolean).join(" ") || "New message";
    }
    if (command.type === "choice" || command.type === "transition") {
      return "New message";
    }
  }
  return "New message";
}
