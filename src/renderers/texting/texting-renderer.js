import { renderMarkup } from "../../engine/markup.js";
import { TEXTING_SURFACE } from "../../engine/surface-modules.js";

const DEFAULT_TEXT_WAIT_TIME = 480;
const PLAYER_REVEAL_DELAY = 140;

/**
 * Picks a legible text color (near-black or white) for a given bubble color
 * based on perceived luminance, so light identity colors stay readable.
 *
 * @param {string} hex - Bubble background color, e.g. "#FB6F92".
 * @returns {string} "#16161a" for light backgrounds, "#ffffff" for dark.
 */
function readableTextColor(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  return luminance > 0.6 ? "#16161a" : "#ffffff";
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
    this.choiceTray = null;
    this.typingIndicator = null;
    this.saveStatus = null;
    this.activeReveal = null;
    this.lastSide = null;
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
    this.surface.innerHTML = `
      <section class="phone-frame" aria-label="Phone">
        <div class="phone-notch" aria-hidden="true"></div>
        <div class="status-bar">
          <span class="status-time">${contact.subtitle ? contact.subtitle.split("·").pop().trim() : "14:30"}</span>
          <span class="status-icons" aria-label="Phone status">
            <span class="wifi-dot" aria-hidden="true"></span>
            <span class="signal-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="battery-icon" aria-hidden="true"></span>
          </span>
        </div>
        <section class="phone-screen">
          <header class="phone-header">
            <button class="icon-button" type="button" tabindex="-1" title="Back" aria-label="Back">
              <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div class="header-id">
              <div class="header-avatar" aria-hidden="true"${contact.color ? ` style="background:${contact.color};color:${readableTextColor(contact.color)}"` : ""}>${contact.avatar ?? contact.name?.slice(0, 1) ?? "?"}</div>
              <h1>${contact.name ?? "Messages"}</h1>
            </div>
            <button class="icon-button" type="button" tabindex="-1" title="FaceTime" aria-label="Call">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l5-3v10l-5-3"></path><rect x="3" y="7" width="12" height="10" rx="2.5"></rect></svg>
            </button>
          </header>
          <div class="message-list" aria-live="polite"></div>
          <div class="typing-indicator message-row message-row--left" hidden>
            <div class="message-bubble typing-bubble"><span></span><span></span><span></span></div>
          </div>
          <footer class="composer-area">
            <div class="choice-tray" aria-label="Reply choices"></div>
            <p class="save-status" aria-live="polite"></p>
          </footer>
        </section>
      </section>
    `;
    this.appRoot.append(this.surface);

    this.phoneFrame = this.surface.querySelector(".phone-frame");
    this.messageList = this.surface.querySelector(".message-list");
    this.choiceTray = this.surface.querySelector(".choice-tray");
    this.typingIndicator = this.surface.querySelector(".typing-indicator");
    this.saveStatus = this.surface.querySelector(".save-status");
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
    this.surface?.remove();
    this.surface = null;
    this.messageList = null;
    this.choiceTray = null;
    this.typingIndicator = null;
    this.tapHint = null;
    this.saveStatus = null;
  }

  /**
   * Switches the phone to another conversation: re-titles the header and clears
   * the thread. Bubble colors follow each message's sender automatically.
   *
   * @param {object} contact - { name, color, avatar, subtitle }.
   * @returns {void}
   */
  setThread(contact) {
    if (!this.surface) {
      return;
    }
    const avatar = this.surface.querySelector(".header-avatar");
    const nameEl = this.surface.querySelector(".header-id h1");
    const subtitleEl = this.surface.querySelector(".thread-title p");
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
    this.reset();
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
    if (textingState?.contact) {
      this.setThreadHeader(textingState.contact);
    }
    this.reset();
    for (const message of textingState?.messages ?? []) {
      this.renderMessage(message, characters);
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

    for (const option of choiceCommand.options) {
      const button = document.createElement("button");
      button.className = "choice-button";
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

    const button = document.createElement("button");
    button.className = "transition-button";
    button.type = "button";
    button.innerHTML = `<span>${command.text}</span><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
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
    const resolved = this.resolveMessage(message, characters);
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
    if (this.lastSide === side) {
      row.classList.add("is-grouped");
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    // Incoming bubbles wear the speaker's identity color (Player's outgoing blue
    // is handled in CSS). Text color flips to stay legible on light hues.
    if (side === "left" && resolved.color) {
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
   * Resolves character defaults and message-level overrides.
   *
   * @param {object} message - Message item.
   * @param {Map<string, object>} characters - Character defaults.
   * @returns {object} Resolved message.
   */
  resolveMessage(message, characters) {
    const character = characters.get(message.id) ?? {
      id: message.id,
      name: message.id,
      color: "#d1d5db",
      side: "left"
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
   * Signals "tap to continue" with a soft breathing glow around the phone edge
   * instead of an explicit icon.
   *
   * @returns {void}
   */
  showTapHint() {
    this.phoneFrame?.classList.add("is-awaiting");
  }

  /**
   * Clears the tap-to-continue edge glow.
   *
   * @returns {void}
   */
  hideTapHint() {
    this.phoneFrame?.classList.remove("is-awaiting");
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
