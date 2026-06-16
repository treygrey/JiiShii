import { renderMarkup } from "../../engine/dom/markup.js";
import { TEXTING_SURFACE } from "../../engine/surfaces/index.js";
import { escapeHtml } from "../html.js";
import {
  PHONE_ADVANCE_DEAD_ZONE_EVENTS,
  bindPhoneAdvanceDeadZones,
  bindPhoneNavigation,
  createPhoneFrame,
  readableTextColor,
  stopPhoneStoryAdvance
} from "../phone/phone-frame.js";

const DEFAULT_TEXT_WAIT_TIME = 480;
const PLAYER_REVEAL_DELAY = 140;
const DEFAULT_PLAYER_BUBBLE_COLOR = "#4a90e2";
const DEFAULT_NPC_BUBBLE_COLOR = "#d1d5db";
const PLAYER_MESSAGE_IDS = new Set(["player", "me", "you"]);

/**
 * Extracts the clock text from a contact subtitle without depending on a
 * specific separator glyph.
 *
 * @param {string} subtitle - Contact subtitle.
 * @returns {string} Phone status time.
 */
function statusTimeFromSubtitle(subtitle) {
  const value = String(subtitle ?? "").trim();
  return value ? value.split(/\s+/).pop() : "14:30";
}

/**
 * Renders the texting surface: per-message typing indicators, grouped bubbles,
 * date separators, photo attachments, choices, transitions, a tap-to-continue
 * hint, and the center-screen narration overlay.
 */
export class TextingRenderer {
  static contract = {
    ...TEXTING_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Root element for the texting surface.
   * @param {object} [options] - Renderer services.
   * @param {Function} [options.getSettings] - Returns live player settings.
   * @param {Function} [options.onLog] - Called with each revealed message.
   */
  constructor(appRoot, { getSettings, onLog, resolveImage } = {}) {
    this.appRoot = appRoot;
    this.getSettings = getSettings ?? (() => ({ textSpeed: 0.6 }));
    this.onLog = onLog ?? (() => {});
    this.resolveImage = resolveImage ?? (() => null);
    this.runner = null;
    this.surface = null;
    this.phoneFrame = null;
    this.messageList = null;
    this.composerArea = null;
    this.choiceTray = null;
    this.typingIndicator = null;
    this.notificationHost = null;
    this.saveStatus = null;
    this.activeReveal = null;
    this.lastSide = null;
    this.selectedThreadId = null;
    this.lastTextingState = null;
    this.lastCharacters = null;
    this.documentNavigationHandler = null;
  }

  /**
   * Connects the renderer to the scene runner.
   *
   * @param {object} runner - Scene runner.
   * @returns {void}
   */
  bindRunner(runner) {
    this.runner = runner;
  }

  /**
   * Returns a multiplier for reveal delays based on the player's text speed.
   *
   * @returns {number} Delay scale factor.
   */
  speedScale() {
    const speed = Math.min(1, Math.max(0, this.getSettings().textSpeed ?? 0.6));
    return 1.6 - speed * 1.42;
  }

  /**
   * Mounts the texting surface and the shared narration overlay. Idempotent so
   * load replay does not append duplicates.
   *
   * @param {object} context - Current scene context.
   * @returns {void}
   */
  mount(context) {
    if (this.surface) {
      return;
    }

    const contact = context?.scene?.contact ?? { name: "Contact", avatar: "C", subtitle: "" };

    this.surface = document.createElement("div");
    this.surface.className = "texting-shell";
    this.surface.innerHTML = createPhoneFrame({
      bodyHtml: `
        <header class="phone-header">
          <button class="icon-button thread-back-button" type="button" tabindex="-1" title="Back" aria-label="Back" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="header-id">
            <div class="header-avatar" aria-hidden="true"></div>
            <h1></h1>
          </div>
          <button class="icon-button thread-call-button" type="button" tabindex="-1" title="Call" aria-label="Call">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l5-3v10l-5-3"></path><rect x="3" y="7" width="12" height="10" rx="2.5"></rect></svg>
          </button>
        </header>
        <div class="phone-notification-host" aria-live="polite"></div>
        <div class="message-list" aria-live="polite"></div>
        <div class="typing-indicator message-row message-row--left" hidden>
          <div class="message-bubble typing-bubble"><span></span><span></span><span></span></div>
        </div>
        <footer class="composer-area">
          <div class="choice-tray" aria-label="Reply choices"></div>
          <p class="save-status" aria-live="polite"></p>
        </footer>
      `,
      statusTime: statusTimeFromSubtitle(contact.subtitle)
    });
    this.appRoot.append(this.surface);

    this.phoneFrame = this.surface.querySelector(".phone-frame");
    this.messageList = this.surface.querySelector(".message-list");
    this.composerArea = this.surface.querySelector(".composer-area");
    this.choiceTray = this.surface.querySelector(".choice-tray");
    this.typingIndicator = this.surface.querySelector(".typing-indicator");
    this.notificationHost = this.surface.querySelector(".phone-notification-host");
    this.saveStatus = this.surface.querySelector(".save-status");
    this.setThreadHeader(contact);
    this.surface.querySelector(".thread-back-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.selectedThreadId = null;
      this.renderThreadList(this.lastTextingState, { characters: this.lastCharacters });
    });
    this.bindDocumentNavigation();
    this.bindAdvanceDeadZones();
  }

  /**
   * Captures Android nav clicks before stage-level handlers can swallow them.
   *
   * @returns {void}
   */
  bindDocumentNavigation() {
    this.unbindDocumentNavigation();
    this.documentNavigationHandler = bindPhoneNavigation(this.surface, {
      onBack: () => this.handleSystemBack(),
      onHome: () => this.runner?.openPhoneApp?.("home"),
      isHomeEnabled: () => this.runner?.state?.visuals?.phone?.isButtonEnabled !== false
    });
  }

  /**
   * Removes document-level Android nav capture.
   *
   * @returns {void}
   */
  unbindDocumentNavigation() {
    if (!this.documentNavigationHandler) {
      return;
    }
    this.documentNavigationHandler();
    this.documentNavigationHandler = null;
  }

  /**
   * Marks phone chrome as non-story input. The message thread remains tappable
   * for normal advance, while status/header/navigation controls behave like
   * real OS/app UI and never consume a story click.
   *
   * @returns {void}
   */
  bindAdvanceDeadZones() {
    bindPhoneAdvanceDeadZones(this.surface, {
      selector: ".status-bar, .phone-header, .phone-nav-bar"
    });
  }

  /**
   * Handles the Android-style system back button inside the texting chrome.
   * Texting can be either a phone app or the active story surface. Back only
   * navigates phone-app state; story rollback remains a VN-level control.
   *
   * @returns {void}
   */
  handleSystemBack() {
    if (this.selectedThreadId && this.runner?.isTextingInboxMode?.()) {
      this.selectedThreadId = null;
      this.renderThreadList(this.lastTextingState, { characters: this.lastCharacters });
      return;
    }
    if (this.runner?.isPhoneOpen?.()) {
      this.runner.goBackPhoneApp?.();
    }
  }

  /**
   * Enables Android back only when it can navigate phone-app state.
   * Story-driven texting is already the destination, so Back is a no-op there
   * instead of acting like rollback or popping the player out of the story.
   *
   * @returns {void}
   */
  updateSystemBackButton() {
    const backButton = this.surface?.querySelector("[data-phone-nav='back']");
    if (!backButton) {
      return;
    }
    const canNavigatePhone = Boolean(this.runner?.isPhoneOpen?.());
    backButton.disabled = !canNavigatePhone;
    backButton.setAttribute("aria-disabled", String(!canNavigatePhone));
  }

  /**
   * Removes the texting surface and narration overlay when switching surfaces.
   *
   * @returns {void}
   */
  unmount() {
    if (this.activeReveal?.timeoutId) {
      clearTimeout(this.activeReveal.timeoutId);
    }
    this.activeReveal = null;
    this.unbindDocumentNavigation();
    this.surface?.remove();
    this.surface = null;
    this.messageList = null;
    this.composerArea = null;
    this.choiceTray = null;
    this.typingIndicator = null;
    this.notificationHost = null;
    this.tapHint = null;
    this.saveStatus = null;
    this.selectedThreadId = null;
    this.lastTextingState = null;
    this.lastCharacters = null;
  }

  /**
   * Switches the phone to another conversation header. Bubble colors follow
   * each message's sender automatically.
   *
   * @param {object} contact - { name, color, avatar, subtitle }.
   * @returns {void}
   */
  setThread(contact) {
    if (!this.surface) {
      return;
    }
    this.clearThreadNotification();
    this.selectedThreadId = contact?.id ?? contact?.name ?? null;
    this.setThreadHeader(contact);
    this.reset();
  }

  /**
   * Shows a tappable in-phone notification for a different message thread.
   * This is phone chrome, so tapping it must not bubble into story advance.
   *
   * @param {object} contact - Incoming thread contact.
   * @param {object} options - Notification callbacks.
   * @param {Function} options.onSelect - Called when the player opens it.
   * @returns {void}
   */
  showThreadNotification(contact, { onSelect }) {
    if (!this.notificationHost) {
      onSelect();
      return;
    }
    this.clearThreadNotification();

    const button = document.createElement("button");
    button.className = "phone-thread-notification";
    button.type = "button";
    button.innerHTML = `
      <span class="phone-thread-notification-avatar" aria-hidden="true"></span>
      <span class="phone-thread-notification-copy">
        <strong>${escapeHtml(contact.name ?? "Messages")}</strong>
        <span>New message</span>
      </span>
    `;

    const avatar = button.querySelector(".phone-thread-notification-avatar");
    avatar.textContent = contact.avatar ?? (contact.name ?? "?").slice(0, 1);
    if (contact.color) {
      avatar.style.background = contact.color;
      avatar.style.color = readableTextColor(contact.color);
    }

    for (const eventName of PHONE_ADVANCE_DEAD_ZONE_EVENTS) {
      button.addEventListener(eventName, stopPhoneStoryAdvance);
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.clearThreadNotification();
      onSelect();
    });

    this.notificationHost.append(button);
  }

  /**
   * Shows a generic phone-app notification using the existing Android toast
   * style. This keeps authored phone notifications working even while the
   * player is already inside a text thread.
   *
   * @param {object} notification - Shared phone notification state.
   * @param {object} options - Notification callbacks.
   * @param {Function} options.onSelect - Called when the player opens it.
   * @returns {void}
   */
  showPhoneToast(notification, { onSelect } = {}) {
    this.showThreadNotification({
      name: notification?.text ?? "Notification",
      avatar: (notification?.app ?? "!").slice(0, 1).toUpperCase(),
      color: "#5f6368"
    }, { onSelect });
  }

  /**
   * Removes any visible phone-thread notification.
   *
   * @returns {void}
   */
  clearThreadNotification() {
    if (this.notificationHost) {
      this.notificationHost.innerHTML = "";
    }
  }

  /**
   * Projects runner-owned texting state into the phone DOM.
   *
   * @param {object} textingState - Texting visual state.
   * @param {object} options - Projection options.
   * @param {Map<string, object>} options.characters - Character defaults.
   * @returns {void}
   */
  renderTextingState(textingState, { characters }) {
    this.lastTextingState = textingState;
    this.lastCharacters = characters;
    if (!this.surface || !this.messageList) {
      return;
    }
    this.updateSystemBackButton();
    if (this.shouldShowInbox()) {
      if (this.selectedThreadId) {
        this.renderThreadById(textingState, { characters }, this.selectedThreadId);
        return;
      }
      this.renderThreadList(textingState, { characters });
      return;
    }
    this.selectedThreadId = textingState?.currentThreadId ?? null;
    this.renderThread(textingState?.contact, textingState?.messages ?? [], { characters });
  }

  /**
   * Returns whether Messages is being opened as a phone app rather than as the
   * active story-driving texting surface.
   *
   * @returns {boolean} True when the inbox should be shown first.
   */
  shouldShowInbox() {
    return Boolean(this.runner?.isTextingInboxMode?.());
  }

  /**
   * Renders the conversation selection screen.
   *
   * @param {object} textingState - Texting visual state.
   * @param {object} options - Projection options.
   * @param {Map<string, object>} options.characters - Character defaults.
   * @returns {void}
   */
  renderThreadList(textingState = {}, { characters } = {}) {
    if (!this.surface) {
      return;
    }
    this.selectedThreadId = null;
    this.setInboxHeader();
    this.reset();
    const threads = this.sortedThreads(textingState);
    if (!threads.length) {
      this.messageList.innerHTML = `<div class="phone-empty-state">No conversations</div>`;
      return;
    }
    const threadList = document.createElement("div");
    threadList.className = "thread-list";
    for (const thread of threads) {
      threadList.append(this.renderThreadRow(thread, characters));
    }
    this.messageList.append(threadList);
  }

  /**
   * Renders one conversation row for the inbox.
   *
   * @param {object} thread - Thread state.
   * @param {Map<string, object>} characters - Character defaults.
   * @returns {Element} Thread row button.
   */
  renderThreadRow(thread, characters) {
    const contact = this.resolveThreadContact(thread, characters);
    const latestMessage = thread.messages.at(-1);
    const preview = latestMessage?.kind === "image"
      ? "Photo"
      : thread.preview ?? latestMessage?.message ?? "New message";
    const button = document.createElement("button");
    button.className = `thread-list-row${thread.unread ? " is-unread" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="thread-list-avatar" aria-hidden="true"></span>
      <span class="thread-list-copy">
        <strong>${escapeHtml(contact.name ?? thread.id)}</strong>
        <span>${escapeHtml(preview)}</span>
      </span>
      ${thread.unread ? `<span class="thread-unread-dot" aria-label="Unread"></span>` : ""}
    `;
    const avatar = button.querySelector(".thread-list-avatar");
    avatar.textContent = contact.avatar ?? (contact.name ?? thread.id).slice(0, 1);
    if (contact.color) {
      avatar.style.background = contact.color;
      avatar.style.color = readableTextColor(contact.color);
    }
    for (const eventName of PHONE_ADVANCE_DEAD_ZONE_EVENTS) {
      button.addEventListener(eventName, stopPhoneStoryAdvance);
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.selectedThreadId = thread.id;
      if (this.runner?.openTextThread?.(thread.id)) {
        return;
      }
      this.renderThreadById(this.lastTextingState, { characters: this.lastCharacters }, thread.id);
    });
    return button;
  }

  /**
   * Renders one saved conversation by id.
   *
   * @param {object} textingState - Texting visual state.
   * @param {object} options - Projection options.
   * @param {string} threadId - Thread id.
   * @returns {void}
   */
  renderThreadById(textingState = {}, { characters } = {}, threadId) {
    const thread = textingState?.threads?.[threadId];
    if (!thread) {
      this.selectedThreadId = null;
      this.renderThreadList(textingState, { characters });
      return;
    }
    this.renderThread(this.resolveThreadContact(thread, characters), thread.messages, { characters });
  }

  /**
   * Renders a message thread.
   *
   * @param {object} contact - Contact header.
   * @param {Array<object>} messages - Thread messages.
   * @param {object} options - Projection options.
   * @param {Map<string, object>} options.characters - Character defaults.
   * @returns {void}
   */
  renderThread(contact, messages = [], { characters } = {}) {
    if (!this.surface || !this.messageList) {
      return;
    }
    if (contact) {
      this.setThreadHeader(contact);
    }
    this.reset();
    for (const message of messages) {
      this.renderMessage(message, characters);
    }
  }

  /**
   * Sorts conversations by most recent received text.
   *
   * @param {object} textingState - Texting visual state.
   * @returns {Array<object>} Sorted threads.
   */
  sortedThreads(textingState = {}) {
    return Object.values(textingState?.threads ?? {})
      .sort((left, right) => (right.lastReceivedAt ?? 0) - (left.lastReceivedAt ?? 0));
  }

  /**
   * Resolves thread contact defaults.
   *
   * @param {object} thread - Thread state.
   * @param {Map<string, object>} characters - Character defaults.
   * @returns {object} Contact header.
   */
  resolveThreadContact(thread, characters) {
    const contact = thread.contact ?? { id: thread.id, name: thread.id };
    const character = characters?.get?.(contact.id) ?? {};
    return { ...character, ...contact };
  }

  /**
   * Sets the app header for the inbox.
   *
   * @returns {void}
   */
  setInboxHeader() {
    this.surface?.querySelector(".thread-back-button")?.setAttribute("hidden", "");
    this.surface?.querySelector(".thread-call-button")?.setAttribute("hidden", "");
    this.surface?.querySelector(".header-avatar")?.setAttribute("hidden", "");
    const nameEl = this.surface?.querySelector(".header-id h1");
    if (nameEl) {
      nameEl.textContent = "Messages";
    }
  }

  /**
   * Updates the thread header without clearing messages.
   *
   * @param {object} contact - Thread contact.
   * @returns {void}
   */
  setThreadHeader(contact) {
    if (!this.surface) {
      return;
    }
    const avatar = this.surface.querySelector(".header-avatar");
    const nameEl = this.surface.querySelector(".header-id h1");
    const subtitleEl = this.surface.querySelector(".thread-title p");
    this.surface.querySelector(".thread-back-button")?.toggleAttribute("hidden", !this.shouldShowInbox());
    this.surface.querySelector(".thread-call-button")?.removeAttribute("hidden");
    avatar?.removeAttribute("hidden");
    if (avatar) {
      avatar.textContent = contact.avatar ?? (contact.name ?? "?").slice(0, 1);
      if (contact.color) {
        avatar.style.background = contact.color;
        avatar.style.color = readableTextColor(contact.color);
      }
    }
    if (nameEl) {
      nameEl.textContent = contact.name ?? "Messages";
    }
    if (subtitleEl && contact.subtitle) {
      subtitleEl.textContent = contact.subtitle;
    }
  }

  /**
   * Clears rendered messages and transient UI.
   *
   * @returns {void}
   */
  reset() {
    if (this.messageList) {
      this.messageList.innerHTML = "";
    }
    this.lastSide = null;
    this.clearChoices();
    this.hideTyping();
    this.hideTapHint();
    this.activeReveal = null;
  }

  /**
   * Reveals a text block one message at a time, showing a typing indicator
   * before incoming (NPC) messages only.
   *
   * @param {object} blockCommand - Text block command.
   * @param {object} options - Render options.
   * @param {Map<string, object>} options.characters - Character defaults.
   * @param {Function} options.onComplete - Completion callback.
   * @returns {void}
   */
  showTextBlock(blockCommand, { characters, onComplete }) {
    this.hideTapHint();
    this.clearChoices();

    const revealState = {
      isRunning: true,
      pending: [...blockCommand.texts],
      characters,
      timeoutId: null,
      // Seed from the last rendered side so a new contact say() that follows the
      // player's reply still gets the longer "starting to type" pause.
      prevWasPlayer: this.lastSide === "right",
      finishNow: () => {
        clearTimeout(revealState.timeoutId);
        for (const message of revealState.pending) {
          this.renderMessage(message, characters);
        }
        revealState.pending.length = 0;
        revealState.isRunning = false;
        this.hideTyping();
        this.activeReveal = null;
        this.showTapHint();
        onComplete();
      }
    };

    this.activeReveal = revealState;
    this.revealNextMessage(revealState, onComplete);
  }

  /**
   * Reveals the next pending message in the active block.
   *
   * @param {object} revealState - Active reveal state.
   * @param {Function} onComplete - Completion callback.
   * @returns {void}
   */
  revealNextMessage(revealState, onComplete) {
    if (!revealState.pending.length) {
      revealState.isRunning = false;
      this.hideTyping();
      this.activeReveal = null;
      this.showTapHint();
      onComplete();
      return;
    }

    const message = revealState.pending[0];
    const isPlayer = message.id === "player";

    const render = () => {
      revealState.pending.shift();
      this.renderMessage(message, revealState.characters);
      revealState.prevWasPlayer = isPlayer;
      this.revealNextMessage(revealState, onComplete);
    };

    if (isPlayer) {
      this.hideTyping();
      revealState.timeoutId = window.setTimeout(render, PLAYER_REVEAL_DELAY);
      return;
    }

    this.showTyping();
    let wait = (message.waitTime ?? DEFAULT_TEXT_WAIT_TIME) * this.speedScale();
    // Be twice as patient before the first reply after the player sends a
    // message; the rest of the burst keeps its normal cadence.
    if (revealState.prevWasPlayer) {
      wait *= 2;
    }
    revealState.timeoutId = window.setTimeout(() => {
      this.hideTyping();
      render();
    }, wait);
  }

  // ---- Narration is now handled by the LayerCompositor ----
  // The texting renderer no longer creates or manages a narration overlay.
  // showNarration() and hideNarration() are routed through the compositor's
  // shared narration element.

  /**
   * Renders a block instantly, used when rebuilding a loaded save.
   *
   * @param {object} blockCommand - Text block command.
   * @param {object} options - Render options.
   * @param {Map<string, object>} options.characters - Character defaults.
   * @returns {void}
   */
  renderTextBlockInstant(blockCommand, { characters }) {
    for (const message of blockCommand.texts) {
      this.renderMessage(message, characters);
    }
  }

  /**
   * Completes the active reveal if one is running.
   *
   * @returns {boolean} True when a reveal was completed.
   */
  completeActiveReveal() {
    if (!this.activeReveal?.isRunning) {
      return false;
    }
    this.activeReveal.finishNow();
    return true;
  }

  /**
   * Shows stacked reply choices in the composer tray.
   *
   * @param {object} choiceCommand - Choice command.
   * @param {object} options - Choice callbacks.
   * @param {Function} options.onSelect - Selection callback.
   * @returns {void}
   */
  showChoice(choiceCommand, { onSelect }) {
    this.hideTapHint();
    this.choiceTray.innerHTML = "";
    this.choiceTray.classList.remove("is-transition");
    this.composerArea?.classList.add("is-active");

    for (const option of choiceCommand.options) {
      const button = document.createElement("button");
      button.className = "choice-button";
      if (option.seen) {
        button.classList.add("is-seen");
      }
      button.type = "button";
      button.textContent = option.text;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(option);
      });
      this.choiceTray.append(button);
    }
    this.scrollToLatest();
  }

  /**
   * Shows a single full-width transition/continue button.
   *
   * @param {object} command - Transition command.
   * @param {object} options - Callbacks.
   * @param {Function} options.onSelect - Selection callback.
   * @returns {void}
   */
  showTransition(command, { onSelect }) {
    this.hideTyping();
    this.hideTapHint();
    this.choiceTray.innerHTML = "";
    this.choiceTray.classList.add("is-transition");
    this.composerArea?.classList.add("is-active");

    const button = document.createElement("button");
    button.className = "transition-button";
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(command.text)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect();
    });
    this.choiceTray.append(button);
    this.scrollToLatest();
  }

  /**
   * Clears the choice/transition tray.
   *
   * @returns {void}
   */
  clearChoices() {
    if (this.choiceTray) {
      this.choiceTray.innerHTML = "";
      this.choiceTray.classList.remove("is-transition");
    }
    this.composerArea?.classList.remove("is-active");
  }

  /**
   * Shows an end-of-scene affordance.
   *
   * @returns {void}
   */
  showEnd() {
    this.hideTyping();
    this.hideTapHint();
    this.clearChoices();
    const endMessage = document.createElement("div");
    endMessage.className = "scene-end";
    endMessage.textContent = "End of scene";
    this.messageList.append(endMessage);
    this.scrollToLatest();
  }

  /**
   * Updates save/load status text.
   *
   * @param {string} message - Status message.
   * @returns {void}
   */
  setSaveStatus(message) {
    if (!this.saveStatus) {
      return;
    }
    this.saveStatus.textContent = message;
    window.setTimeout(() => {
      if (this.saveStatus && this.saveStatus.textContent === message) {
        this.saveStatus.textContent = "";
      }
    }, 1400);
  }

  /**
   * Renders one message: a date separator (when timestamped), then a grouped
   * text bubble or photo attachment.
   *
   * @param {object} message - Message item.
   * @param {Map<string, object>} characters - Character defaults.
   * @returns {void}
   */
  renderMessage(message, characters) {
    if (!this.messageList) {
      return;
    }
    const resolved = this.resolveMessage(message, characters);
    const renderKey = resolved.__jiishiiMessageKey;
    if (renderKey && this.hasRenderedMessage(renderKey)) {
      return;
    }
    this.onLog(resolved);

    if (resolved.timestamp) {
      const separator = document.createElement("div");
      separator.className = "thread-time";
      separator.textContent = resolved.timestamp;
      this.messageList.append(separator);
      this.lastSide = null;
    }

    const side = resolved.side ?? "left";
    const row = document.createElement("article");
    row.className = `message-row message-row--${side}`;
    if (renderKey) {
      row.dataset.messageKey = renderKey;
    }
    if (this.lastSide === side) {
      row.classList.add("is-grouped");
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (resolved.color) {
      bubble.style.background = resolved.color;
      bubble.style.color = readableTextColor(resolved.color);
    }

    if (resolved.kind === "image") {
      bubble.classList.add("has-photo");
      const figure = document.createElement("figure");
      figure.className = "photo-attachment";
      const url = this.resolveImage(resolved.image);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Photo";
        img.dataset.lightbox = url;
        img.style.cursor = "zoom-in";
        figure.append(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "photo-placeholder";
        placeholder.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.4"></rect><circle cx="8.5" cy="10" r="1.8"></circle><path d="M3 16l5-4 4 3 3-2 6 4"></path></svg>`;
        figure.append(placeholder);
      }
      bubble.append(figure);
    } else {
      const body = document.createElement("p");
      body.innerHTML = renderMarkup(resolved.message);
      bubble.append(body);
    }

    row.append(bubble);
    this.messageList.append(row);
    this.lastSide = side;
    this.scrollToLatest();
  }

  /**
   * Checks whether a state-owned text message is already in the DOM.
   *
   * @param {string} renderKey - Private render key stored on visual messages.
   * @returns {boolean} True when the message has already rendered.
   */
  hasRenderedMessage(renderKey) {
    return [...this.messageList.querySelectorAll("[data-message-key]")]
      .some((element) => element.dataset.messageKey === renderKey);
  }

  /**
   * Resolves character defaults and message-level overrides.
   *
   * @param {object} message - Message item.
   * @param {Map<string, object>} characters - Character defaults.
   * @returns {object} Resolved message.
   */
  resolveMessage(message, characters) {
    const isPlayerMessage = PLAYER_MESSAGE_IDS.has(message.id);
    const character = characters.get(message.id) ?? {
      id: message.id,
      name: message.id,
      color: isPlayerMessage ? DEFAULT_PLAYER_BUBBLE_COLOR : DEFAULT_NPC_BUBBLE_COLOR,
      side: isPlayerMessage ? "right" : "left"
    };
    return { ...character, ...message };
  }

  /**
   * Shows the typing indicator at the bottom of the thread.
   *
   * @returns {void}
   */
  showTyping() {
    if (!this.typingIndicator) {
      return;
    }
    this.typingIndicator.hidden = false;
    this.scrollToLatest();
  }

  /**
   * Hides the typing indicator.
   *
   * @returns {void}
   */
  hideTyping() {
    if (this.typingIndicator) {
      this.typingIndicator.hidden = true;
    }
  }

  /**
   * Signals that the current text burst has finished by leaving a quiet status
   * marker in the typing indicator lane.
   *
   * @returns {void}
   */
  showTapHint() {
    this.hideTyping();
  }

  /**
   * Clears the ready marker from the typing indicator lane.
   *
   * @returns {void}
   */
  hideTapHint() {
    this.hideTyping();
  }

  /**
   * Keeps the latest message visible.
   *
   * @returns {void}
   */
  scrollToLatest() {
    if (this.messageList) {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }
  }
}
