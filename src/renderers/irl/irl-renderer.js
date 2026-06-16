import { resolveIrlPlacement, resolveIrlTransition } from "../../engine/dom/irl-stage-direction.js";
import { IRL_SURFACE } from "../../engine/surfaces/index.js";
import { createChoiceBand } from "../choice-band.js";

const DEFAULT_OUTFIT = "hoodie";
const DEFAULT_EXPRESSION = "neutral";
const DEFAULT_BODY = "default";

/**
 * Converts a recipe layer id into a CSS-safe class suffix.
 *
 * @param {string} value - Recipe layer id.
 * @returns {string} CSS-safe suffix.
 */
function classSuffix(value) {
  return String(value ?? "layer").replace(/[^a-z0-9_-]/gi, "-");
}

/**
 * Renders the IRL VN surface as a compositor layer: a transparent stage that
 * sits on the shared background and shows layered character sprites
 * (outfit + head + expression). Dialogue and choices come from the shared
 * compositor box and center menu; this renderer owns only the sprites.
 */
export class IrlRenderer {
  static contract = {
    ...IRL_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - The shared game stage.
   * @param {object} [options] - Renderer services.
   */
  constructor(appRoot, { getSettings, onLog, resolveImage, resolveVideo, resolveSprite, resolveExpression } = {}) {
    this.appRoot = appRoot;
    this.getSettings = getSettings ?? (() => ({ textSpeed: 0.6 }));
    this.onLog = onLog ?? (() => {});
    this.resolveImage = resolveImage ?? (() => null);
    this.resolveVideo = resolveVideo ?? (() => null);
    this.resolveSprite = resolveSprite ?? (() => ({ layers: [] }));
    this.resolveExpression = resolveExpression ?? (() => null);
    this.runner = null;
    this.surface = null;
    this.imageLayer = null;
    this.mediaLayers = {};
    this.characterLayer = null;
    this.choiceOverlay = null;
    /** @type {Map<string, object>} id -> current projected image state. */
    this.images = new Map();
    /** @type {Map<string, object>} id -> current projected sprite state. */
    this.sprites = new Map();
    /** @type {Map<string, string>} character id -> "fullbody"|"cropped". */
    this.spriteCanvas = new Map();
    /** @type {Map<string, number>} character id -> pending exit timer. */
    this.spriteExitTimers = new Map();
    /** @type {Map<string, number>} image id -> pending exit timer. */
    this.imageExitTimers = new Map();
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
   * Mounts the IRL surface (idempotent for load replay).
   *
   * @returns {void}
   */
  mount() {
    if (this.surface) {
      return;
    }
    this.surface = document.createElement("div");
    this.surface.className = "irl-shell";
    this.surface.innerHTML = `
      <div class="irl-stage">
        <div class="irl-image-layer irl-media-layer irl-media-layer--behind" data-media-layer="behind"></div>
        <div class="irl-character-layer"></div>
        <div class="irl-image-layer irl-media-layer irl-media-layer--front" data-media-layer="front"></div>
        <div class="irl-image-layer irl-media-layer--cg" data-media-layer="cg"></div>
        <div class="irl-image-layer irl-media-layer--overlay" data-media-layer="overlay"></div>
      </div>
    `;
    this.appRoot.append(this.surface);
    this.mediaLayers = Object.fromEntries(
      [...this.surface.querySelectorAll("[data-media-layer]")].map((layer) => [layer.dataset.mediaLayer, layer])
    );
    this.imageLayer = this.mediaLayers.front;
    this.characterLayer = this.surface.querySelector(".irl-character-layer");
  }

  /**
   * Removes the IRL surface and choice overlay.
   *
   * @returns {void}
   */
  unmount() {
    this.clearExitTimers();
    this.surface?.remove();
    this.choiceOverlay?.remove();
    this.surface = null;
    this.imageLayer = null;
    this.mediaLayers = {};
    this.characterLayer = null;
    this.choiceOverlay = null;
  }

  /**
   * Clears sprites and transient UI.
   *
   * @returns {void}
   */
  reset() {
    this.images.clear();
    this.sprites.clear();
    this.clearExitTimers();
    for (const layer of Object.values(this.mediaLayers)) {
      layer.innerHTML = "";
    }
    if (this.characterLayer) {
      this.characterLayer.innerHTML = "";
    }
    this.clearChoices();
  }

  /**
   * Clears every pending sprite/image exit timer.
   *
   * @returns {void}
   */
  clearExitTimers() {
    for (const timer of this.spriteExitTimers.values()) {
      window.clearTimeout(timer);
    }
    for (const timer of this.imageExitTimers.values()) {
      window.clearTimeout(timer);
    }
    this.spriteExitTimers.clear();
    this.imageExitTimers.clear();
  }

  /**
   * Stores a sprite exit timer, replacing any older pending removal.
   *
   * @param {string} id - Character id.
   * @param {number} timer - Timeout id.
   * @returns {void}
   */
  setSpriteExitTimer(id, timer) {
    this.clearSpriteExitTimer(id);
    this.spriteExitTimers.set(id, timer);
  }

  /**
   * Cancels a pending sprite removal.
   *
   * @param {string} id - Character id.
   * @returns {void}
   */
  clearSpriteExitTimer(id) {
    const timer = this.spriteExitTimers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      this.spriteExitTimers.delete(id);
    }
  }

  /**
   * Stores an image exit timer, replacing any older pending removal.
   *
   * @param {string} id - Image displayable id.
   * @param {number} timer - Timeout id.
   * @returns {void}
   */
  setImageExitTimer(id, timer) {
    this.clearImageExitTimer(id);
    this.imageExitTimers.set(id, timer);
  }

  /**
   * Cancels a pending image removal.
   *
   * @param {string} id - Image displayable id.
   * @returns {void}
   */
  clearImageExitTimer(id) {
    const timer = this.imageExitTimers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      this.imageExitTimers.delete(id);
    }
  }

  // ---- Sprites ----

  /**
   * Shows or updates a character sprite, compositing outfit + head + expression.
   *
   * @param {object} command - Show-character command { id, outfit, expression, side }.
   * @param {object} options - { characters }.
   * @returns {void}
   */
  showCharacter(command, { characters }) {
    if (!this.characterLayer) {
      return;
    }
    const id = command.id;
    const prev = this.sprites.get(id) ?? {};
    const character = characters.get(id) ?? {};
    const outfit = command.outfit ?? prev.outfit ?? character.defaultOutfit ?? DEFAULT_OUTFIT;
    const expression = command.expression ?? prev.expression ?? character.defaultExpression ?? DEFAULT_EXPRESSION;
    const body = command.body ?? prev.body ?? character.defaultBody ?? DEFAULT_BODY;
    const overrideSide = command.side ?? prev.side;
    // Horizontal mirror for staging variety / facing into the scene. Sticky:
    // once set it persists across expression/outfit changes until set again.
    const flip = command.flip ?? prev.flip ?? false;

    this._renderSprite({
      id,
      outfit,
      expression,
      body,
      side: overrideSide,
      flip,
      at: command.at ?? prev.at ?? overrideSide ?? null,
      x: command.x ?? prev.x ?? null,
      y: command.y ?? prev.y ?? null,
      scale: command.scale ?? prev.scale ?? 1,
      alpha: command.alpha ?? prev.alpha ?? 1,
      z: command.z ?? prev.z ?? null,
      layer: command.layer ?? prev.layer ?? "characters",
      transition: command.transition ?? prev.transition ?? null,
      duration: command.duration ?? prev.duration ?? null,
      easing: command.easing ?? prev.easing ?? null
    });
    this._updateSpritePositions(null);
  }

  /**
   * Projects runner-owned IRL sprite state into this renderer's DOM/cache.
   *
   * @param {object} spriteState - IRL sprite state { visible, focus }.
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace figures without transition.
   * @returns {void}
   */
  renderSpriteState(spriteState, { instant = false, vars = {} } = {}) {
    if (!this.characterLayer) {
      return;
    }

    const visible = spriteState?.visible ?? [];
    const images = spriteState?.images ?? [];
    const visibleIds = new Set(visible.map((sprite) => sprite.id));
    const imageIds = new Set(images.map((image) => image.id));

    for (const id of [...this.images.keys()]) {
      if (!imageIds.has(id)) {
        this._removeImageElement(id, instant);
      }
    }

    for (const image of images) {
      this._renderImage(image, { instant });
    }

    for (const id of [...this.sprites.keys()]) {
      if (!visibleIds.has(id)) {
        this._removeSpriteElement(id, instant);
      }
    }

    for (const sprite of visible) {
      this._renderSprite(sprite, { instant, vars });
    }

    this._updateSpritePositions(spriteState?.focus ?? null);
  }

  /**
   * Creates or updates one IRL image displayable from runner-owned state.
   *
   * @private
   * @param {object} image - Image projection.
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace without transition.
   * @returns {void}
   */
  _renderImage(image, { instant = false } = {}) {
    const mediaLayer = this._mediaLayerFor(image);
    if (!mediaLayer) {
      return;
    }

    this.images.set(image.id, { ...image });
    this.clearImageExitTimer(image.id);
    let element = this.surface.querySelector(`[data-image-id="${image.id}"]`);
    const isNewElement = !element;
    if (!element) {
      element = document.createElement("div");
      element.className = "irl-image";
      element.dataset.imageId = image.id;
    }
    if (element.parentElement !== mediaLayer) {
      mediaLayer.append(element);
    }

    element.classList.remove("is-leaving");
    element.dataset.kind = image.kind ?? "image";
    element.dataset.mediaKind = image.kind === "video" ? "video" : "image";
    element.dataset.fit = image.fit ?? "contain";
    element.style.setProperty("--image-fit", image.fit ?? (image.kind === "cg" ? "cover" : "contain"));
    element.style.setProperty("--image-position", image.position ?? "center");
    this._applyImageTransform(element, image, { instant, isNewElement });

    const url = image.kind === "video" ? this.resolveVideo(image.asset) : this.resolveImage(image.asset);
    if (url) {
      this._renderMediaElement(element, image, url);
    } else {
      element.innerHTML = `<div class="irl-image-placeholder">${image.asset}</div>`;
    }
  }

  /**
   * Gets the DOM layer that should contain an IRL media displayable.
   *
   * @private
   * @param {object} image - Media projection.
   * @returns {HTMLElement|null} DOM layer.
   */
  _mediaLayerFor(image = {}) {
    const layer = image.kind === "cg" ? "cg" : image.layer ?? "front";
    return this.mediaLayers[layer] ?? this.mediaLayers.front ?? null;
  }

  /**
   * Renders an image or video tag inside an IRL media container.
   *
   * @private
   * @param {HTMLElement} element - Media container.
   * @param {object} image - Media projection.
   * @param {string} url - Resolved asset URL.
   * @returns {void}
   */
  _renderMediaElement(element, image, url) {
    if (image.kind !== "video") {
      element.innerHTML = `<img class="irl-image-media" src="${url}" alt="" />`;
      return;
    }
    let video = element.querySelector("video");
    if (!video) {
      element.innerHTML = "";
      video = document.createElement("video");
      video.className = "irl-image-media";
      video.playsInline = true;
      element.append(video);
    }
    if (video.dataset.src !== url) {
      video.dataset.src = url;
      video.src = url;
    }
    video.loop = image.loop === true;
    video.muted = image.muted === true;
    video.volume = Math.min(1, Math.max(0, image.volume ?? 1));
    if (Number.isFinite(image.startAt)) {
      video.currentTime = image.startAt / 1000;
    }
    if (Number.isFinite(image.endAt)) {
      video.ontimeupdate = () => {
        if (!video.loop && video.currentTime >= image.endAt / 1000) {
          video.pause();
        }
      };
    } else {
      video.ontimeupdate = null;
    }
    video.play?.()?.catch?.(() => {
      video.muted = true;
      video.play?.();
    });
  }

  /**
   * Applies placement and transition fields to an image displayable.
   *
   * @private
   * @param {HTMLElement} element - Image container.
   * @param {object} image - Image projection.
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Skip authored animation.
   * @param {boolean} [options.isNewElement] - True when this image just mounted.
   * @returns {void}
   */
  _applyImageTransform(element, image = {}, { instant = false, isNewElement = false } = {}) {
    const placement = resolveIrlPlacement(image);
    const transition = resolveIrlTransition(image.transition, image);
    element.dataset.transition = image.transition ?? "dissolve";
    element.style.setProperty("--image-duration", `${instant ? 0 : transition.duration}ms`);
    element.style.setProperty("--image-easing", transition.easing);

    if (!instant && isNewElement && transition.enterFrom) {
      this._writeImagePlacement(element, {
        ...placement,
        ...resolveIrlPlacement({ at: transition.enterFrom }),
        alpha: 0
      });
      requestAnimationFrame(() => this._writeImagePlacement(element, placement));
      return;
    }

    this._writeImagePlacement(element, placement);
  }

  /**
   * Writes concrete image placement values.
   *
   * @private
   * @param {HTMLElement} element - Image container.
   * @param {object} placement - Resolved placement values.
   * @returns {void}
   */
  _writeImagePlacement(element, placement) {
    const { x, y, scale, alpha, z, layer } = placement;
    element.style.setProperty("--image-x", x == null ? "50%" : typeof x === "number" ? `${x}%` : String(x));
    element.style.setProperty("--image-y", y == null ? "50%" : typeof y === "number" ? `${y}%` : String(y));
    if (placement.width == null) {
      element.style.removeProperty("--image-width");
    } else {
      element.style.setProperty("--image-width", typeof placement.width === "number" ? `${placement.width}%` : String(placement.width));
    }
    if (placement.height == null) {
      element.style.removeProperty("--image-height");
    } else {
      element.style.setProperty("--image-height", typeof placement.height === "number" ? `${placement.height}%` : String(placement.height));
    }
    element.style.setProperty("--image-scale", String(scale ?? 1));
    element.style.setProperty("--image-alpha", String(alpha ?? 1));
    element.style.setProperty("--image-z", String(z ?? 45));
    element.dataset.layer = layer ?? "front";
  }

  /**
   * Removes an image displayable element and cache entry.
   *
   * @private
   * @param {string} id - Image displayable id.
   * @param {boolean} instant - Remove without transition.
   * @returns {void}
   */
  _removeImageElement(id, instant) {
    const image = this.images.get(id) ?? {};
    this.images.delete(id);
    const element = this.surface?.querySelector(`[data-image-id="${id}"]`);
    if (!element) {
      return;
    }
    if (instant) {
      this.clearImageExitTimer(id);
      element.remove();
      return;
    }
    const transition = resolveIrlTransition(image.transition, image);
    element.style.setProperty("--image-duration", `${transition.duration}ms`);
    element.style.setProperty("--image-easing", transition.easing);
    if (transition.exitTo) {
      this._writeImagePlacement(element, {
        ...resolveIrlPlacement(image),
        ...resolveIrlPlacement({ at: transition.exitTo }),
        alpha: 0
      });
    }
    element.classList.add("is-leaving");
    this.setImageExitTimer(id, window.setTimeout(() => {
      this.imageExitTimers.delete(id);
      element.remove();
    }, Math.max(transition.duration, 260)));
  }

  /**
   * Creates or updates one sprite element from runner-owned sprite data.
   *
   * @private
   * @param {object} sprite - Sprite projection.
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace figure instantly.
   * @returns {void}
   */
  _renderSprite(sprite, { instant = false, vars = {} } = {}) {
    if (!this.characterLayer) {
      return;
    }

    const { id, outfit, expression, body, side, flip } = sprite;
    this.sprites.set(id, {
      outfit,
      expression,
      body: body ?? DEFAULT_BODY,
      side: side ?? null,
      flip: Boolean(flip),
      at: sprite.at ?? null,
      x: sprite.x ?? null,
      y: sprite.y ?? null,
      scale: sprite.scale ?? 1,
      alpha: sprite.alpha ?? 1,
      z: sprite.z ?? null,
      layer: sprite.layer ?? "characters",
      transition: sprite.transition ?? null,
      duration: sprite.duration ?? null,
      easing: sprite.easing ?? null
    });
    this.clearSpriteExitTimer(id);

    let element = this.characterLayer.querySelector(`[data-character-id="${id}"]`);
    const isNewElement = !element;
    if (!element) {
      element = document.createElement("div");
      element.className = "irl-sprite";
      element.dataset.characterId = id;
      element.dataset.canvas = this.spriteCanvas.get(id) ?? "fullbody";
      this.characterLayer.append(element);
    }

    element.classList.remove("is-leaving");
    element.style.setProperty("--flip", flip ? "-1" : "1");
    const projectedSprite = this.sprites.get(id);
    const transition = this._applySpriteTransform(element, projectedSprite, { instant, isNewElement });
    this._renderFigure(element, id, outfit, expression, body ?? DEFAULT_BODY, { instant, vars, transition });
  }

  /**
   * Applies authored transform fields to a sprite element.
   *
   * @private
   * @param {HTMLElement} element - Sprite container.
   * @param {object} sprite - Projected sprite state.
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Skip authored animation.
   * @param {boolean} [options.isNewElement] - True when this sprite just mounted.
   * @returns {object} Resolved transition descriptor.
   */
  _applySpriteTransform(element, sprite = {}, { instant = false, isNewElement = false } = {}) {
    const placement = resolveIrlPlacement(sprite);
    const transition = resolveIrlTransition(sprite.transition, sprite);
    element.dataset.transition = sprite.transition ?? "dissolve";
    element.style.setProperty("--sprite-duration", `${instant ? 0 : transition.duration}ms`);
    element.style.setProperty("--sprite-easing", transition.easing);

    if (!instant && isNewElement && transition.enterFrom) {
      this._writePlacement(element, {
        ...placement,
        ...resolveIrlPlacement({ at: transition.enterFrom }),
        alpha: 0
      });
      requestAnimationFrame(() => this._writePlacement(element, placement));
      return transition;
    }

    this._writePlacement(element, placement);
    return transition;
  }

  /**
   * Writes concrete placement values into a sprite element.
   *
   * @private
   * @param {HTMLElement} element - Sprite container.
   * @param {object} placement - Resolved placement values.
   * @returns {void}
   */
  _writePlacement(element, placement) {
    const { x, y, scale, alpha, z, layer } = placement;

    if (x != null) {
      element.style.setProperty("--x", typeof x === "number" ? `${x}%` : String(x));
      element.dataset.manualX = "true";
    } else {
      element.dataset.manualX = "false";
    }

    if (y != null) {
      element.style.setProperty("--ground", typeof y === "number" ? `${y}%` : String(y));
    } else {
      element.style.removeProperty("--ground");
    }

    element.style.setProperty("--depth", String(scale));
    element.style.setProperty("--alpha", String(alpha));

    if (z != null) {
      element.style.setProperty("--z", String(z));
      element.dataset.manualZ = "true";
    } else {
      element.dataset.manualZ = "false";
    }

    element.dataset.layer = layer ?? "characters";
  }

  /**
   * Swaps a visible sprite's expression, crossfading to the new composite so
   * the change reads as a soft dissolve rather than a hard pop.
   *
   * @param {string} id - Character id.
   * @param {string} expression - Expression name.
   * @returns {void}
   */
  setExpression(id, expression) {
    const state = this.sprites.get(id);
    if (!state || !this.characterLayer) {
      return;
    }
    state.expression = expression;
    const element = this.characterLayer.querySelector(`[data-character-id="${id}"]`);
    if (element) {
      const transition = resolveIrlTransition(state.transition, state);
      this._renderFigure(element, id, state.outfit, expression, state.body ?? DEFAULT_BODY, { transition });
    }
  }

  /**
   * Renders a fresh composite (outfit + head + expression) on top of whatever
   * the sprite is currently showing and crossfades it in, then removes the old
   * composite. Because the new figure fades in OVER the old one (which stays at
   * full opacity beneath until covered), unchanged layers never dip — only the
   * pixels that actually differ (a new outfit, a new face) visibly dissolve.
   *
   * @private
   * @param {HTMLElement} element - The `.irl-sprite` container.
   * @param {string} id - Character id.
   * @param {string} outfit - Outfit name.
   * @param {string} expression - Expression name.
   * @returns {void}
   */
  _renderFigure(element, id, outfit, expression, body, { instant = false, vars = {}, transition = null } = {}) {
    const current = element.querySelector(".sprite-figure:last-child");
    const varsSignature = JSON.stringify(vars ?? {});

    // Expression-only change on the same outfit: swap just the face layer in
    // place — no second figure to cross-fade. Cross-fading two full copies made
    // the soft silhouette edges (anti-aliased outline, hair wisps) double up and
    // bloom into a halo on every line. The face sits interior over the opaque
    // head, so swapping it in place can't halo the silhouette.
    if (
      current &&
      current.dataset.outfit === String(outfit ?? "") &&
      current.dataset.body === String(body ?? "") &&
      current.dataset.vars === varsSignature
    ) {
      const url = this.resolveExpression(id, expression);
      let faceImg = current.querySelector('[data-layer-id="expression"]');
      if (url) {
        if (!faceImg) {
          faceImg = document.createElement("img");
          faceImg.className = "sprite-layer sprite-expression";
          faceImg.dataset.layerId = "expression";
          current.insertBefore(faceImg, current.querySelector('[data-layer-id="foregroundHair"]') ?? null);
        }
        faceImg.src = url;
        faceImg.alt = `${id} ${expression}`;
      } else if (faceImg) {
        faceImg.remove();
      }
      current.dataset.expression = String(expression ?? "");
      return;
    }

    const resolved = this.resolveSprite(id, outfit, expression, body, vars);
    const figure = document.createElement("div");
    figure.className = "sprite-figure";
    figure.dataset.outfit = String(outfit ?? "");
    figure.dataset.expression = String(expression ?? "");
    // Bottom to top follows the resolved recipe order. The renderer does not
    // need to know which optional overlays a character recipe may include.
    figure.dataset.body = String(body ?? "");
    figure.dataset.vars = varsSignature;

    for (const layer of resolved.layers ?? []) {
      const image = document.createElement("img");
      image.className = `sprite-layer sprite-${classSuffix(layer.id)}`;
      image.dataset.layerId = layer.id;
      image.dataset.layerSource = layer.source;
      image.src = layer.url;
      image.alt = layer.id === "expression" ? `${id} ${expression}` : "";
      figure.append(image);
    }

    const previous = [...element.querySelectorAll(".sprite-figure")];
    element.append(figure);
    const isFullLayerChange = previous.some(
      (item) => item.dataset.outfit !== String(outfit ?? "") || item.dataset.body !== String(body ?? "")
    );

    // Wait for the new images to decode before fading, so a never-before-seen
    // outfit/expression doesn't flash blank mid-crossfade. Cached layers resolve
    // instantly.
    const imgs = [...figure.querySelectorAll("img")];
    const ready = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
      )
    );

    ready.then(() => {
      // Auto-frame by canvas aspect: tall art (e.g. 720×1600 full-body) is
      // staged larger with its lower quarter running off the bottom edge so the
      // legs crop naturally; shorter art (1024×1344, cropped at the thigh) sits
      // fully in frame. Set before the figure shows, so framing never flashes.
      this._updateCanvasFraming(element, id, imgs);
      if (instant) {
        previous.forEach((f) => f.remove());
        figure.classList.add("is-shown");
        return;
      }
      if (isFullLayerChange) {
        this._replaceFullLayerFigure(previous, figure, transition);
        return;
      }
      requestAnimationFrame(() => figure.classList.add("is-shown"));
      const cleanup = () => {
        previous.forEach((f) => f.remove());
        figure.removeEventListener("transitionend", cleanup);
      };
      figure.addEventListener("transitionend", cleanup);
      // Fallback in case transitionend doesn't fire (e.g. reduced motion).
      window.setTimeout(cleanup, Math.max(transition?.duration ?? 400, 400));
    });
  }

  /**
   * Replaces a full body/outfit figure without overlapping two silhouettes.
   *
   * @private
   * @param {HTMLElement[]} previous - Figures currently visible.
   * @param {HTMLElement} nextFigure - Newly decoded figure.
   * @param {object|null} transition - Resolved transition descriptor.
   * @returns {void}
   */
  _replaceFullLayerFigure(previous, nextFigure, transition = null) {
    const replacement = transition?.replacement ?? "cut";
    const duration = Math.max(transition?.duration ?? 0, 0);
    if (!previous.length || duration === 0 || replacement === "cut") {
      previous.forEach((figure) => figure.remove());
      nextFigure.classList.add("is-shown");
      return;
    }

    if (replacement === "dip") {
      this._replaceFigureWithDip(previous, nextFigure, duration);
      return;
    }

    if (replacement === "flip") {
      this._replaceFigureWithFlip(previous, nextFigure, duration);
      return;
    }

    previous.forEach((figure) => figure.remove());
    nextFigure.classList.add("is-shown");
  }

  /**
   * Fades the old full-layer figure out before fading the new one in.
   *
   * @private
   * @param {HTMLElement[]} previous - Figures currently visible.
   * @param {HTMLElement} nextFigure - Newly decoded figure.
   * @param {number} duration - Total transition duration in milliseconds.
   * @returns {void}
   */
  _replaceFigureWithDip(previous, nextFigure, duration) {
    const phaseDuration = Math.max(duration / 2, 1);
    nextFigure.style.setProperty("--sprite-duration", `${phaseDuration}ms`);
    previous.forEach((figure) => {
      figure.style.setProperty("--sprite-duration", `${phaseDuration}ms`);
      figure.classList.add("is-replacing-out");
    });
    window.setTimeout(() => {
      previous.forEach((figure) => figure.remove());
      requestAnimationFrame(() => nextFigure.classList.add("is-shown"));
    }, phaseDuration);
  }

  /**
   * Collapses the old full-layer figure horizontally, swaps it, then opens the
   * new figure from the same zero-width pose.
   *
   * @private
   * @param {HTMLElement[]} previous - Figures currently visible.
   * @param {HTMLElement} nextFigure - Newly decoded figure.
   * @param {number} duration - Total transition duration in milliseconds.
   * @returns {void}
   */
  _replaceFigureWithFlip(previous, nextFigure, duration) {
    const phaseDuration = Math.max(duration / 2, 1);
    nextFigure.style.setProperty("--sprite-duration", `${phaseDuration}ms`);
    nextFigure.classList.add("is-flipping-in");
    previous.forEach((figure) => {
      figure.style.setProperty("--sprite-duration", `${phaseDuration}ms`);
      figure.classList.add("is-flipping-out");
    });
    window.setTimeout(() => {
      previous.forEach((figure) => figure.remove());
      requestAnimationFrame(() => {
        nextFigure.classList.add("is-shown");
        nextFigure.classList.remove("is-flipping-in");
      });
    }, phaseDuration);
  }

  /**
   * Updates full-body vs cropped framing from decoded sprite image dimensions.
   *
   * @private
   * @param {HTMLElement} element - Sprite element.
   * @param {string} id - Character id.
   * @param {HTMLImageElement[]} images - Decoded image layers.
   * @returns {void}
   */
  _updateCanvasFraming(element, id, images) {
    const probe = images.find((img) => img.naturalWidth && img.naturalHeight);
    if (!probe) {
      return;
    }
    const aspect = probe.naturalWidth / probe.naturalHeight;
    const canvas = aspect < 0.6 ? "fullbody" : "cropped";
    this.spriteCanvas.set(id, canvas);
    element.dataset.canvas = canvas;
  }

  /**
   * Focuses a speaker: scales them up slightly and dims everyone else. Pass
   * null to clear focus (no one dimmed).
   *
   * @param {string|null} speakerId - The speaking character, or null.
   * @returns {void}
   */
  setFocus(speakerId) {
    if (!this.characterLayer) {
      return;
    }
    // If the speaker is on stage, they are lit. Everyone else (including during 
    // narration or off-stage dialogue) is dimmed to bring focus to the text box.
    for (const el of this.characterLayer.querySelectorAll(".irl-sprite")) {
      const isSpeaker = el.dataset.characterId === speakerId;
      el.classList.toggle("is-speaking", isSpeaker);
      el.classList.toggle("is-dimmed", speakerId != null && !isSpeaker);
    }
  }

  /**
   * Removes a sprite from the stage.
   *
   * @param {string} id - Character id.
   * @returns {void}
   */
  hideCharacter(id) {
    this._removeSpriteElement(id, false);
    this._updateSpritePositions(null);
  }

  /**
   * Stores the transition to use the next time a visible sprite exits.
   *
   * @param {string} id - Character id.
   * @param {string|null} transition - Transition preset id.
   * @returns {void}
   */
  setExitTransition(id, transition) {
    const sprite = this.sprites.get(id);
    if (sprite) {
      sprite.transition = transition ?? sprite.transition;
    }
  }

  /**
   * Stores the transition to use the next time an image displayable exits.
   *
   * @param {string} id - Image displayable id.
   * @param {string|null} transition - Transition preset id.
   * @returns {void}
   */
  setImageExitTransition(id, transition) {
    const image = this.images.get(id);
    if (image) {
      image.transition = transition ?? image.transition;
    }
  }

  /**
   * Removes a sprite element and cache entry.
   *
   * @private
   * @param {string} id - Character id.
   * @param {boolean} instant - Remove without exit transition.
   * @returns {void}
   */
  _removeSpriteElement(id, instant) {
    const sprite = this.sprites.get(id) ?? {};
    this.sprites.delete(id);
    const el = this.characterLayer?.querySelector(`[data-character-id="${id}"]`);
    if (!el) {
      return;
    }
    if (instant) {
      this.clearSpriteExitTimer(id);
      el.remove();
      return;
    }
    const transition = resolveIrlTransition(sprite.transition, sprite);
    el.style.setProperty("--sprite-duration", `${transition.duration}ms`);
    el.style.setProperty("--sprite-easing", transition.easing);
    if (transition.exitTo) {
      this._writePlacement(el, {
        ...resolveIrlPlacement(sprite),
        ...resolveIrlPlacement({ at: transition.exitTo }),
        alpha: 0
      });
    }
    // Fade out before removing so an exit reads as a soft dissolve.
    el.classList.add("is-leaving");
    this.setSpriteExitTimer(id, window.setTimeout(() => {
      this.spriteExitTimers.delete(id);
      el.remove();
    }, Math.max(transition.duration, 260)));
  }

  /**
   * Spreads however many sprites are on stage EVENLY across the width, scaling
   * to any count (1..N). Left-to-right order comes from each sprite's `side`
   * hint (far-left → far-right as an ordering spectrum), with show-order breaking
   * ties. Positions ride CSS vars (--x, --z) so they animate when the cast
   * changes, and the active speaker still floats to the front via .is-speaking.
   *
   * @private
   */
  _updateSpritePositions(focusId = null) {
    if (!this.characterLayer) {
      return;
    }

    const SIDE_RANK = { "far-left": -2, left: -1, center: 0, right: 1, "far-right": 2 };

    // Collect on-stage sprites in show order (Map preserves insertion order).
    const entries = [];
    let shown = 0;
    for (const [id, state] of this.sprites.entries()) {
      const el = this.characterLayer.querySelector(`[data-character-id="${id}"]`);
      if (!el) {
        continue;
      }
      const rankKey = state.at ?? state.side;
      const rank = rankKey != null ? SIDE_RANK[rankKey] ?? 0 : 0;
      entries.push({ el, rank, order: shown++ });
    }

    // Order left→right by the side hint, then by show order.
    entries.sort((a, b) => a.rank - b.rank || a.order - b.order);

    const n = entries.length;
    entries.forEach((entry, i) => {
      // Even spread with matching margins: 1→[50], 2→[33,67], 3→[25,50,75], …
      const x = ((i + 1) / (n + 1)) * 100;
      if (entry.el.dataset.manualX !== "true") {
        entry.el.style.setProperty("--x", `${x.toFixed(2)}%`);
      }
      // Centre of the group sits a hair in front of the edges so overlaps in a
      // big crowd read naturally. The speaker overrides this to the very front.
      const distFromCenter = Math.abs(i - (n - 1) / 2);
      if (entry.el.dataset.manualZ !== "true") {
        entry.el.style.setProperty("--z", String(30 - Math.round(distFromCenter)));
      }
      const isSpeaker = entry.el.dataset.characterId === focusId;
      entry.el.classList.toggle("is-speaking", isSpeaker);
      entry.el.classList.toggle("is-dimmed", focusId != null && !isSpeaker);
    });
  }

  // ---- Choices (IRL gradient-band menu) ----

  /**
   * Shows the IRL choice menu as a centered gradient band.
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

  // ---- Compatibility stubs (dialogue is the shared compositor box now) ----

  /**
   * Legacy lineBlock support — advances without rendering (old demo scenes).
   *
   * @param {object} command - Line block command.
   * @param {object} options - { onComplete }.
   * @returns {void}
   */
  showLineBlock(command, { onComplete }) {
    onComplete();
  }

  /** @returns {void} */
  renderLineBlockInstant() {}

  /** @returns {boolean} */
  completeActiveReveal() {
    return false;
  }

  /** @returns {void} */
  showEnd() {}

  /** @returns {void} */
  setSaveStatus() {}
}
