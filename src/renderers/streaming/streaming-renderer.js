import { STREAMING_SURFACE } from "../../engine/surfaces/index.js";
import { createChoiceBand } from "../choice-band.js";

const CHAT_JITTER_MIN = 130;
const CHAT_JITTER_MAX = 520;

/**
 * Picks legible text color for a colored chip by luminance.
 *
 * @param {string} hex - Background color.
 * @returns {string} Readable text color.
 */
function readableTextColor(hex) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 > 0.6 ? "#16161a" : "#ffffff";
}

/**
 * Deterministic bright chat color from a username.
 *
 * @param {string} name - Chatter name.
 * @returns {string} HSL color string.
 */
function chatColor(name) {
  const safeName = String(name || "viewer");
  let hash = 0;
  for (let i = 0; i < safeName.length; i += 1) {
    hash = (hash * 31 + safeName.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 62%, 70%)`;
}

/**
 * Renders the streaming surface as a restrained browser-like stream panel over
 * the IRL background. Dialogue comes from the shared compositor box, while
 * choices use the same in-world decision band as IRL scenes.
 */
export class StreamingRenderer {
  static contract = {
    ...STREAMING_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Root element (the shared game stage).
   * @param {object} [options] - Services.
   * @param {Function} [options.getSettings] - Returns live player settings.
   * @param {Function} [options.onLog] - History logger.
   */
  constructor(appRoot, { getSettings, onLog, resolveImage } = {}) {
    this.appRoot = appRoot;
    this.getSettings = getSettings ?? (() => ({ textSpeed: 0.6 }));
    this.onLog = onLog ?? (() => {});
    this.resolveImage = resolveImage ?? (() => null);
    this.runner = null;
    this.surface = null;
    this.box = null;
    this.chatLog = null;
    this.streamWindow = null;
    this.choiceOverlay = null;
    this.activeReveal = null;
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
   * Returns a delay multiplier from the player's text speed.
   *
   * @returns {number} Scale factor.
   */
  speedScale() {
    const speed = Math.min(1, Math.max(0, this.getSettings().textSpeed ?? 0.6));
    return 1.6 - speed * 1.42;
  }

  /**
   * Mounts the stream surface (idempotent for load replay).
   *
   * @returns {void}
   */
  mount() {
    if (this.surface) {
      return;
    }

    this.surface = document.createElement("div");
    this.surface.className = "stream-shell";
    this.surface.innerHTML = `
      <div class="stream-site" role="region" aria-label="Streaming website">
        <header class="stream-browser-bar" aria-hidden="true">
          <span class="stream-browser-dot"></span>
          <span class="stream-browser-dot"></span>
          <span class="stream-browser-dot"></span>
          <span class="stream-browser-address">stream.local/channel</span>
        </header>
        <header class="stream-bar">
          <div class="stream-ch-avatar" aria-hidden="true">M</div>
          <div class="stream-bar-meta">
            <div class="stream-title">offline</div>
            <div class="stream-ch-name">streamer</div>
          </div>
          <div class="stream-status">
            <span class="stream-pill is-offline">OFFLINE</span>
            <span class="stream-viewers" hidden><span class="dot"></span><span class="vcount">0</span></span>
          </div>
        </header>
        <div class="stream-body">
          <div class="stream-window is-offline">
            <div class="stream-window-inner"><span>offline</span></div>
          </div>
          <aside class="stream-chat">
            <header>Stream chat</header>
            <div class="stream-chat-log" aria-live="polite"></div>
          </aside>
        </div>
      </div>
    `;
    this.appRoot.append(this.surface);

    this.chatLog = this.surface.querySelector(".stream-chat-log");
    this.streamWindow = this.surface.querySelector(".stream-window");
  }

  /**
   * Removes the stream surface, dialogue box, and choice overlay.
   *
   * @returns {void}
   */
  unmount() {
    if (this.activeReveal?.timeoutId) {
      clearTimeout(this.activeReveal.timeoutId);
    }
    this.activeReveal = null;
    this.surface?.remove();
    this.choiceOverlay?.remove();
    this.surface = null;
    this.choiceOverlay = null;
    this.chatLog = null;
    this.streamWindow = null;
  }

  /**
   * Clears chat and transient UI (used on load replay).
   *
   * @returns {void}
   */
  reset() {
    if (this.chatLog) {
      this.chatLog.innerHTML = "";
    }
    this.clearChoices();
    this.activeReveal = null;
  }

  /**
   * Projects runner-owned streaming state into the stream DOM.
   *
   * @param {object} streamingState - Streaming visual state.
   * @returns {void}
   */
  renderStreamingState(streamingState) {
    if (!this.surface) {
      return;
    }
    this.reset();
    if (streamingState?.layout) {
      this.setStreamLayout(streamingState.layout);
    }
    this.setStreamTitle(streamingState?.title ?? "offline");
    this.setStreamWindow(streamingState?.window ?? { state: "offline" });
    if (typeof streamingState?.viewers === "number") {
      this.setViewers(streamingState.viewers);
    }
    for (const entry of streamingState?.chat ?? []) {
      if (entry.kind === "system") {
        this.addStreamSystem(entry.text);
      } else if (entry.kind === "post") {
        this.addStreamPost(entry.message);
      } else {
        this.renderChatMessage(entry);
      }
    }
  }

  // ---- Stream chrome (instant) ----

  /**
   * Applies channel metadata.
   *
   * @param {object} command - Stream layout command.
   * @returns {void}
   */
  setStreamLayout(command) {
    if (!this.surface) {
      return;
    }
    const name = command.streamerName ?? command.streamer ?? "streamer";
    const color = command.color ?? "#FB6F92";
    const avatar = this.surface.querySelector(".stream-ch-avatar");
    avatar.textContent = (command.avatar ?? name.slice(0, 1)).toUpperCase();
    avatar.style.background = color;
    avatar.style.color = readableTextColor(color);
    this.surface.querySelector(".stream-ch-name").textContent = name;
    if (command.title) {
      this.setStreamTitle(command.title);
    }
    if (typeof command.viewers === "number") {
      this.setViewers(command.viewers);
    }
  }

  /**
   * Updates the title bar.
   *
   * @param {string} text - Stream title.
   * @returns {void}
   */
  setStreamTitle(text) {
    const el = this.surface?.querySelector(".stream-title");
    if (el) {
      el.textContent = text;
    }
  }

  /**
   * Sets the viewer counter.
   *
   * @param {number} count - Viewer count.
   * @returns {void}
   */
  setViewers(count) {
    const el = this.surface?.querySelector(".vcount");
    if (el) {
      el.textContent = String(count);
    }
  }

  /**
   * Sets the stream window state: offline / live / ended.
   *
   * @param {object} command - { state, image }.
   * @returns {void}
   */
  setStreamWindow(command) {
    if (!this.streamWindow) {
      return;
    }
    const pill = this.surface.querySelector(".stream-pill");
    const viewers = this.surface.querySelector(".stream-viewers");
    this.streamWindow.classList.remove("is-offline", "is-live", "is-ended");

    if (command.state === "live") {
      this.streamWindow.classList.add("is-live");
      const url = command.image ? this.resolveImage(command.image) : null;
      this.streamWindow.innerHTML = url
        ? `<img src="${url}" alt="stream" />`
        : `<div class="stream-window-inner stream-window-live"><span>on cam</span></div>`;
      pill.className = "stream-pill is-live";
      pill.textContent = "LIVE";
      viewers.hidden = false;
    } else if (command.state === "ended") {
      this.streamWindow.classList.add("is-ended");
      this.streamWindow.innerHTML = `<div class="stream-window-inner"><span>stream ended</span></div>`;
      pill.className = "stream-pill is-offline";
      pill.textContent = "OFFLINE";
      viewers.hidden = true;
    } else {
      this.streamWindow.classList.add("is-offline");
      this.streamWindow.innerHTML = `<div class="stream-window-inner"><span>offline</span></div>`;
      pill.className = "stream-pill is-offline";
      pill.textContent = "OFFLINE";
      viewers.hidden = true;
    }
  }

  // ---- Chat ----

  /**
   * Renders one chat row.
   *
   * @param {object} message - { id, message } chat item.
   * @returns {void}
   */
  renderChatMessage(message = {}) {
    if (!this.chatLog) {
      return;
    }
    const row = document.createElement("div");
    row.className = "chat-row";
    const name = message.id ?? message.name ?? "viewer";
    const span = document.createElement("span");
    span.className = "chat-name";
    span.textContent = name;
    span.style.color = message.color ?? chatColor(name);
    const body = document.createElement("span");
    body.className = "chat-text";
    body.textContent = message.message ?? message.text ?? "";
    row.append(span, body);
    this.chatLog.append(row);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  /**
   * Reveals a chat block, popping each message in on a random short interval,
   * then holds for a tap.
   *
   * @param {object} command - Stream chat block command.
   * @param {object} options - { onComplete }.
   * @returns {void}
   */
  showStreamChatBlock(command, { onComplete }) {
    const pending = [...command.messages];
    const revealState = {
      isRunning: true,
      pending,
      timeoutId: null,
      finishNow: () => {
        clearTimeout(revealState.timeoutId);
        for (const m of revealState.pending) {
          this.renderChatMessage(m);
        }
        revealState.pending.length = 0;
        revealState.isRunning = false;
        this.activeReveal = null;
        onComplete();
      }
    };
    this.activeReveal = revealState;
    const step = () => {
      if (!revealState.pending.length) {
        revealState.isRunning = false;
        this.activeReveal = null;
        onComplete();
        return;
      }
      this.renderChatMessage(revealState.pending.shift());
      const jitter = CHAT_JITTER_MIN + Math.random() * (CHAT_JITTER_MAX - CHAT_JITTER_MIN);
      revealState.timeoutId = window.setTimeout(step, jitter * this.speedScale());
    };
    step();
  }

  /**
   * Renders a chat block instantly (load replay).
   *
   * @param {object} command - Stream chat block command.
   * @returns {void}
   */
  renderStreamChatBlockInstant(command) {
    for (const m of command.messages) {
      this.renderChatMessage(m);
    }
  }

  /**
   * Shows a stream image as a readable beat.
   *
   * @param {object} command - Stream image command.
   * @param {object} options - { onComplete }.
   * @returns {void}
   */
  showStreamImage(command, { onComplete }) {
    this.setStreamWindow({ state: "live", image: command.image });
    this.activeReveal = {
      isRunning: true,
      timeoutId: null,
      finishNow: () => {
        this.activeReveal = null;
        onComplete();
      }
    };
  }

  /**
   * Inserts a system line into chat.
   *
   * @param {string} text - System message.
   * @returns {void}
   */
  addStreamSystem(text) {
    if (!this.chatLog) {
      return;
    }
    const row = document.createElement("div");
    row.className = "chat-system";
    row.textContent = text;
    this.chatLog.append(row);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  /**
   * Inserts the player's mod post into chat (highlighted).
   *
   * @param {string} message - Chat message.
   * @returns {void}
   */
  addStreamPost(message) {
    if (!this.chatLog) {
      return;
    }
    const row = document.createElement("div");
    row.className = "chat-row chat-row--mod";
    row.innerHTML = `<span class="chat-badge">MOD</span><span class="chat-name">Player</span>`;
    const body = document.createElement("span");
    body.className = "chat-text";
    body.textContent = message;
    row.append(body);
    this.chatLog.append(row);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  // ---- Narration is now handled by the LayerCompositor ----
  // The streaming renderer no longer creates or manages a narration box.
  // showNarration(), showDialogue(), hideNarration() are routed through the
  // compositor's shared narration element.

  // ---- Choice (center-screen VN menu) ----

  /**
   * Shows the center-screen choice menu.
   *
   * @param {object} choiceCommand - Choice command.
   * @param {object} options - { onSelect }.
   * @returns {void}
   */
  showChoice(choiceCommand, { onSelect }) {
    this.clearChoices();
    const overlay = createChoiceBand(choiceCommand, onSelect);
    this.appRoot.append(overlay);
    this.choiceOverlay = overlay;
  }

  /**
   * Removes the choice menu.
   *
   * @returns {void}
   */
  clearChoices() {
    this.choiceOverlay?.remove();
    this.choiceOverlay = null;
  }

  // ---- Reveal control ----

  /**
   * Completes an in-flight reveal (chat pop-in or box reading beat).
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

  // ---- Compatibility stubs / unused-but-called ----

  /**
   * Legacy stream image → live window. Kept for compatibility.
   *
   * @param {object} command - Stream image command.
   * @returns {void}
   */
  renderStreamImageInstant(command) {
    this.setStreamWindow({ state: "live", image: command.image });
  }

  /**
   * No-op narration instant compat.
   *
   * @returns {void}
   */
  renderStreamNarrationInstant() {}

  /**
   * Shows an end affordance (handled by transition/scene end elsewhere).
   *
   * @returns {void}
   */
  showEnd() {}

  /**
   * Save-status sink (the quick menu owns confirmation now).
   *
   * @returns {void}
   */
  setSaveStatus() {}
}
