// =============================================================================
// LAYER COMPOSITOR
// Manages a z-index stack of named layers (background, blur, surfaces, narration)
// so the runner can push/pop surfaces without destroying DOM. The compositor owns
// the shared blur scrim and narration box that sit above all surface-specific UI.
// =============================================================================

import { renderMarkup } from "./markup.js";

// --- PROMPT CONSTANTS ---
const DEFAULT_FLASH_DURATION_MS = 220;
const DEFAULT_SHAKE_DURATION_MS = 360;
const DEFAULT_SHAKE_INTENSITY = 10;

// --- LAYER PRESETS ---
// Each preset maps layer names to their z-index value. Layers not listed in a
// preset are hidden. The background is always on (IRL POV), and narration is
// always the topmost interactive layer.

/**
 * @typedef {Object} LayerPreset
 * @property {Record<string, number>} zOrder - Layer name → z-index value.
 */

/** @type {Record<string, LayerPreset>} */
const PRESETS = {
  // Pure IRL scene (characters, dialogue, no phone/stream). No scrim — the room
  // is the focus surface, so the background shows at full strength with sprites
  // composited directly on top (Ren'Py-style), and only the dialogue box dims.
  irl: {
    zOrder: {
      background: 0,
      irl: 2
    }
  },
  // Texting-only (phone on IRL background)
  texting: {
    zOrder: {
      background: 0,
      scrim: 1,
      texting: 2
    }
  },
  // Streaming-only (laptop on IRL background)
  streaming: {
    zOrder: {
      background: 0,
      scrim: 1,
      streaming: 2
    }
  },
  // Texting popped over an active stream — the key preset. The stream stays
  // mounted at z:1, the blur moves in front of it at z:2, and the phone
  // sits on top of the blur at z:3.
  "texting-over-stream": {
    zOrder: {
      background: 0,
      streaming: 1,
      scrim: 2,
      texting: 3
    }
  }
};

/**
 * Orchestrates a stack of named DOM layers with z-index ordering. Surfaces
 * (stream, phone, IRL) register their root elements here and the compositor
 * handles visibility and stacking via named presets.
 *
 * The compositor also owns two shared elements:
 * - **Blur scrim** — a dark/blur overlay that recesses whatever sits behind it
 * - **Narration box** — Player's internal monologue readout, always on top
 */
export class LayerCompositor {
  /**
   * @param {Element} stage - The game stage container that all layers live inside.
   * @param {object} [options] - Compositor options.
   * @param {Function} [options.getSettings] - Returns live player settings.
   * @param {Function} [options.onLog] - History logger for narration/dialogue.
   * @param {Function} [options.onAdvance] - Player advance (tap-to-continue). The
   *   narration box lives outside #game-stage, so it needs its own advance click.
   */
  constructor(stage, { getSettings, onLog, onAdvance } = {}) {
    /** @type {Element} */
    this.stage = stage;

    this.getSettings = getSettings ?? (() => ({ textSpeed: 0.6 }));
    this.onLog = onLog ?? (() => {});
    this.onAdvance = onAdvance ?? (() => {});

    /**
     * Registry of named layers. Each entry holds:
     * - `element` — the DOM node
     * - `persistent` — if true, the compositor created it (scrim, narration)
     *
     * @type {Map<string, { element: Element, persistent: boolean }>}
     */
    this.layers = new Map();

    /** @type {string | null} */
    this.activePreset = null;

    /** @type {{ isRunning: boolean, timeoutId: number | null, finishNow: Function } | null} */
    this.activeNarrationReveal = null;
    this.activeEffectTimeout = null;

    // -- Create persistent layers --

    // Background (IRL room image) — already exists as stage-bg in main.js
    // and is registered externally via registerBackground().

    // Blur scrim — recesses whatever is behind the focus surface. Registered
    // as a managed layer so the compositor can set its z-index per preset.
    this.scrimElement = this.createScrim();
    this.stage.append(this.scrimElement);
    this.registerLayer("scrim", this.scrimElement, true);

    // Shared narration box — Player's readout. NOT registered as a managed
    // layer because it is position:fixed with its own z-index (30) and
    // manages its own visibility via showNarration/hideNarration. We
    // append it to the stage's parent (.vn-root) to avoid grid transform issues.
    this.narrationBox = this.createNarrationBox();
    this.stage.parentElement.append(this.narrationBox);

    this.effectLayer = this.createEffectLayer();
    this.stage.parentElement.append(this.effectLayer);
  }

  // ===========================================================================
  // LAYER REGISTRY
  // ===========================================================================

  /**
   * Registers a named layer element with the compositor. Renderers call this
   * after mounting their surface element so the compositor can manage its
   * z-index and visibility.
   *
   * @param {string} name - Layer name (e.g. "streaming", "texting").
   * @param {Element} element - DOM element for the layer.
   * @param {boolean} [persistent=false] - True for compositor-owned layers.
   * @returns {void}
   */
  registerLayer(name, element, persistent = false) {
    this.layers.set(name, { element, persistent });
    // Force all surfaces into the same grid cell so they overlap correctly
    // instead of creating new rows in the stage grid.
    element.style.gridArea = "1 / 1";
  }

  /**
   * Removes a named layer from the registry. Does NOT remove it from the DOM —
   * the renderer owns its own teardown.
   *
   * @param {string} name - Layer name.
   * @returns {void}
   */
  unregisterLayer(name) {
    const entry = this.layers.get(name);
    if (entry && !entry.persistent) {
      this.layers.delete(name);
    }
  }

  /**
   * Checks whether a layer is registered and has a DOM element.
   *
   * @param {string} name - Layer name.
   * @returns {boolean}
   */
  hasLayer(name) {
    return this.layers.has(name);
  }

  // ===========================================================================
  // PRESET APPLICATION
  // ===========================================================================

  /**
   * Applies a named preset, reordering layers by z-index and hiding any layers
   * not included in the preset. Layers that ARE in the preset become visible.
   *
   * @param {string} presetName - One of the PRESETS keys.
   * @returns {void}
   */
  applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
      console.warn(`[LayerCompositor] Unknown preset "${presetName}".`);
      return;
    }

    this.activePreset = presetName;
    const activeLayerNames = new Set(Object.keys(preset.zOrder));

    for (const [name, entry] of this.layers) {
      if (activeLayerNames.has(name)) {
        // Layer is in the preset — set its z-index
        entry.element.style.zIndex = String(preset.zOrder[name]);

        // Only toggle visibility on non-persistent (surface) layers.
        // Persistent layers (scrim, background) manage their own visibility
        // via CSS classes rather than the hidden attribute.
        if (!entry.persistent) {
          entry.element.hidden = false;
          entry.element.style.pointerEvents = "";
        }
      } else {
        // Layer is NOT in the preset — hide surfaces, leave persistent layers alone
        if (!entry.persistent) {
          entry.element.style.zIndex = "-1";
          entry.element.hidden = true;
          entry.element.style.pointerEvents = "none";
        }
      }
    }

    // Activate/deactivate blur scrim appearance based on whether it's in the preset
    if (activeLayerNames.has("scrim")) {
      this.scrimElement.classList.add("is-visible");
    } else {
      this.scrimElement.classList.remove("is-visible");
    }
  }

  /**
   * Returns the name of the currently active preset.
   *
   * @returns {string | null}
   */
  getActivePreset() {
    return this.activePreset;
  }

  // ===========================================================================
  // PRESET RESOLUTION — derives the correct preset from the surface stack
  // ===========================================================================

  /**
   * Given the runner's current surface stack, resolves which preset to apply.
   * The surface stack is ordered bottom-to-top, e.g. ["streaming", "texting"]
   * means texting is overlaid on streaming.
   *
   * @param {string[]} surfaceStack - Active surface names, bottom to top.
   * @returns {string} Preset name.
   */
  resolvePreset(surfaceStack) {
    if (surfaceStack.length === 0) {
      return "irl";
    }

    const top = surfaceStack[surfaceStack.length - 1];
    const hasStream = surfaceStack.includes("streaming");
    const hasTexting = surfaceStack.includes("texting");

    // Two surfaces stacked: texting over streaming
    if (hasStream && hasTexting) {
      return "texting-over-stream";
    }

    // Single surface
    if (top === "streaming") return "streaming";
    if (top === "texting") return "texting";
    if (top === "irl") return "irl";

    // Fallback — treat unknown surfaces as if they're the only one
    return top;
  }

  // ===========================================================================
  // SHARED NARRATION BOX — Player's internal monologue / world readout
  // ===========================================================================

  /**
   * Creates the shared narration box DOM element.
   *
   * @returns {HTMLDivElement}
   */
  createNarrationBox() {
    const box = document.createElement("div");
    box.className = "narration-box compositor-narration";
    box.hidden = true;
    box.innerHTML = `
      <div class="dialogue-speaker"></div>
      <p class="narration-text"></p>
    `;
    // The box sits outside #game-stage, so the stage's tap-to-advance never sees
    // clicks landing on it — wire its own so the dialogue area isn't a dead spot.
    box.addEventListener("click", () => this.onAdvance());
    return box;
  }

  /**
   * Creates the blur scrim element.
   *
   * @returns {HTMLDivElement}
   */
  createScrim() {
    const scrim = document.createElement("div");
    scrim.className = "stage-scrim compositor-scrim";
    scrim.setAttribute("aria-hidden", "true");
    return scrim;
  }

  /**
   * Creates the full-view transient effect layer.
   *
   * @returns {HTMLDivElement} Effect layer.
   */
  createEffectLayer() {
    const layer = document.createElement("div");
    layer.className = "screen-effect compositor-effect";
    layer.setAttribute("aria-hidden", "true");
    return layer;
  }

  /**
   * Plays a transient full-view effect.
   *
   * @param {object} command - Effect command.
   * @returns {void}
   */
  playScreenEffect(command) {
    const type = command.type;
    if (type !== "flash" && type !== "shake") {
      return;
    }

    if (this.activeEffectTimeout) {
      clearTimeout(this.activeEffectTimeout);
      this.activeEffectTimeout = null;
    }

    const duration = Math.max(
      0,
      Number(command.duration ?? (type === "flash" ? DEFAULT_FLASH_DURATION_MS : DEFAULT_SHAKE_DURATION_MS))
    );
    this.effectLayer.className = `screen-effect compositor-effect is-${type}`;
    this.effectLayer.style.setProperty("--effect-duration", `${duration}ms`);
    this.effectLayer.style.setProperty("--effect-color", command.color ?? "rgba(255, 255, 255, 0.86)");
    this.effectLayer.style.setProperty("--shake-intensity", `${Number(command.intensity ?? DEFAULT_SHAKE_INTENSITY)}px`);
    this.stage.parentElement.style.setProperty("--effect-duration", `${duration}ms`);
    this.stage.parentElement.style.setProperty("--shake-intensity", `${Number(command.intensity ?? DEFAULT_SHAKE_INTENSITY)}px`);

    void this.effectLayer.offsetWidth;
    this.effectLayer.classList.add("is-running");
    if (type === "shake") {
      this.stage.parentElement.classList.remove("is-screen-shaking");
      void this.stage.parentElement.offsetWidth;
      this.stage.parentElement.classList.add("is-screen-shaking");
    }
    this.activeEffectTimeout = window.setTimeout(() => {
      this.effectLayer.className = "screen-effect compositor-effect";
      this.stage.parentElement.classList.remove("is-screen-shaking");
      this.activeEffectTimeout = null;
    }, duration);
  }

  /**
   * Returns a delay multiplier from the player's text speed setting.
   *
   * @returns {number} Scale factor (lower = faster).
   */
  speedScale() {
    const speed = Math.min(1, Math.max(0, this.getSettings().textSpeed ?? 0.6));
    return 1.6 - speed * 1.42;
  }

  /**
   * Shows a narration line (Player's internal monologue) in the shared box.
   * Waits for a reading beat, then signals completion.
   *
   * @param {object} command - Narration command with `.message`.
   * @param {object} options - { onComplete }.
   * @param {Function} options.onComplete - Called when the reading beat finishes.
   * @returns {void}
   */
  showNarration(command, { onComplete }) {
    this.renderNarrationInstant(command.message, null);
    this.animateNarrationIn();
    this.onLog({ kind: "narration", message: command.message });
    this.startNarrationBeat(command.message, onComplete);
  }

  /**
   * Shows a character dialogue line in the shared narration box (speaker name
   * + message). Used by the streaming surface for VN-style bottom dialogue.
   *
   * @param {object} command - Dialogue command with `.message`.
   * @param {object} speaker - Resolved speaker { name, color }.
   * @param {object} options - { onComplete }.
   * @param {Function} options.onComplete - Called when the reading beat finishes.
   * @returns {void}
   */
  showDialogue(command, speaker, { onComplete }) {
    this.renderNarrationInstant(command.message, speaker);
    this.animateNarrationIn();
    this.onLog({ kind: "dialogue", name: speaker?.name, side: "left", message: command.message });
    this.startNarrationBeat(command.message, onComplete);
  }

  /**
   * Renders narration content immediately (no animation). Used by revealBox
   * and load-replay.
   *
   * @param {string} message - Text to display.
   * @param {object | null} speaker - Speaker info or null for pure narration.
   * @returns {void}
   */
  renderNarrationInstant(message, speaker) {
    const speakerEl = this.narrationBox.querySelector(".dialogue-speaker");
    const textEl = this.narrationBox.querySelector(".narration-text");

    if (speaker) {
      speakerEl.textContent = speaker.name ?? speaker.id ?? "";
      this.narrationBox.style.setProperty("--speaker-color", speaker.color ?? "var(--fg)");
      this.narrationBox.classList.add("is-dialogue");
    } else {
      speakerEl.innerHTML = "&nbsp;";
      this.narrationBox.style.setProperty("--speaker-color", "var(--fg-muted)");
      this.narrationBox.classList.remove("is-dialogue");
    }

    textEl.innerHTML = renderMarkup(message);
    this.narrationBox.hidden = false;
  }

  /**
   * Renders the narration box for load-replay (instant, no animation beat).
   *
   * @param {string} message - Text to display.
   * @param {object | null} speaker - Speaker info or null.
   * @returns {void}
   */
  renderDialogueInstant(message, speaker) {
    this.renderNarrationInstant(message, speaker);
    this.narrationBox.classList.add("is-in");
  }

  /**
   * Triggers the slide-in animation on the narration box.
   *
   * @returns {void}
   */
  animateNarrationIn() {
    // Clear the "awaiting" glow for the new line.
    this.narrationBox.classList.remove("is-awaiting");
    // Only play the slide-in when the box is first appearing. Consecutive lines
    // keep it in place and just swap text — no per-line re-slide, which reads as
    // lag. hideNarration() removes is-in, so the slide returns on a fresh show.
    if (this.narrationBox.classList.contains("is-in")) {
      return;
    }
    // Force reflow to restart the CSS transition, then slide in.
    void this.narrationBox.offsetWidth;
    this.narrationBox.classList.add("is-in");
  }

  /**
   * Marks a fully visible narration/dialogue beat as ready for player advance.
   *
   * Text is the primary timeline. Until we add an actual typewriter reveal,
   * narration and dialogue are complete as soon as the line is visible; sprite,
   * image, and background animation should never cost the player an extra click.
   *
   * @param {string} message - Message text.
   * @param {Function} onComplete - Completion callback.
   * @returns {void}
   */
  startNarrationBeat(message, onComplete) {
    this.activeNarrationReveal = null;
    this.narrationBox.classList.add("is-awaiting");
    onComplete();
  }

  /**
   * Completes an in-flight narration reveal if one is running.
   *
   * @returns {boolean} True when a reveal was completed.
   */
  completeNarrationReveal() {
    return false;
  }

  /**
   * Hides the shared narration box.
   *
   * @returns {void}
   */
  hideNarration() {
    if (this.activeNarrationReveal?.timeoutId) {
      clearTimeout(this.activeNarrationReveal.timeoutId);
    }
    this.activeNarrationReveal = null;
    this.narrationBox.hidden = true;
    this.narrationBox.classList.remove("is-in", "is-awaiting", "is-dialogue");
  }

  // ===========================================================================
  // BACKGROUND MANAGEMENT — IRL room image (always-on baseline)
  // ===========================================================================

  /**
   * Registers the persistent IRL background and its scrim as compositor layers.
   * Called once from main.js with the existing stage-bg element.
   *
   * @param {Element} bgElement - The `stage-bg` element.
   * @returns {void}
   */
  registerBackground(bgElement) {
    this.registerLayer("background", bgElement, true);
  }

  // ===========================================================================
  // TEARDOWN
  // ===========================================================================

  /**
   * Removes all non-persistent layers (renderer surfaces). Called on full
   * scene teardown or when returning to the title menu.
   *
   * @returns {void}
   */
  teardownSurfaces() {
    this.hideNarration();
    if (this.activeEffectTimeout) {
      clearTimeout(this.activeEffectTimeout);
      this.activeEffectTimeout = null;
    }
    this.effectLayer?.classList.remove("is-running", "is-flash", "is-shake");
    this.stage.parentElement?.classList.remove("is-screen-shaking");
    for (const [name, entry] of this.layers) {
      if (!entry.persistent) {
        this.layers.delete(name);
      }
    }
    this.activePreset = null;
  }

  /**
   * Fully removes compositor-owned DOM. Used when the app shell destroys a
   * runner and later creates a fresh compositor, such as returning to title.
   *
   * @returns {void}
   */
  dispose() {
    this.teardownSurfaces();
    this.scrimElement?.remove();
    this.narrationBox?.remove();
    this.effectLayer?.remove();
    this.layers.clear();
  }
}
