// =============================================================================
// background-transitioner.js — manages how one background becomes the next.
//
// The stage background is a container with TWO stacked frame layers. To change
// the background we paint the new image onto the hidden ("incoming") frame and
// run a named transition that brings it forward over the current ("outgoing")
// frame, then swap which frame is front. This gives true crossfades instead of
// a hard image swap.
//
// Transitions are looked up by name from a registry, so presets ship built-in
// and writers/engine code can add custom ones via register(name, fn). Each
// transition is `(ctx) => Promise<void>` where ctx carries the two frames, the
// resolved url, the duration, and whether it should resolve instantly.
// =============================================================================

import {
  DEFAULT_BACKGROUND_TRANSITION,
  DEFAULT_BACKGROUND_TRANSITION_DURATION
} from "./background-transitions.js";

/**
 * Paints (or clears) a frame's image without disturbing its opacity.
 *
 * @param {HTMLElement} frame - Frame element.
 * @param {string|null} url - Image url, or null to clear.
 * @returns {void}
 */
function paint(frame, url) {
  frame.style.backgroundImage = url ? `url("${url}")` : "";
}

/**
 * Animates a frame's opacity and resolves when finished. Honors instant mode
 * (duration 0) by jumping straight to the end value. Cancels any animation the
 * frame already had in flight so rapid changes don't stack.
 *
 * @param {HTMLElement} frame - Frame to animate.
 * @param {number} from - Start opacity.
 * @param {number} to - End opacity.
 * @param {number} duration - Duration in ms (0 = instant).
 * @returns {Promise<void>} Resolves when the fade completes.
 */
function fade(frame, from, to, duration) {
  frame._anim?.cancel();
  frame.style.opacity = String(to);
  if (duration <= 0) {
    return Promise.resolve();
  }
  const anim = frame.animate(
    [{ opacity: from }, { opacity: to }],
    { duration, easing: "ease", fill: "backwards" }
  );
  frame._anim = anim;
  return anim.finished.then(
    () => {},
    () => {} // a cancel() rejects; swallow it
  );
}

/**
 * Built-in transition presets. Each receives a context and returns a Promise
 * that resolves when the visual change is complete.
 *
 * ctx = { incoming, outgoing, url, duration, root }
 */
export const BUILTIN_TRANSITIONS = {
  /** Instant swap — no animation. */
  cut({ incoming, outgoing, url }) {
    paint(incoming, url);
    fade(incoming, 1, 1, 0);
    fade(outgoing, 0, 0, 0);
    return Promise.resolve();
  },

  /**
   * Crossfade: the new image fades in on top of the old one. The old frame
   * stays fully opaque underneath until the new frame covers it, so there is
   * no brightness dip through black.
   */
  async dissolve({ incoming, outgoing, url, duration }) {
    paint(incoming, url);
    incoming.style.zIndex = "2";
    outgoing.style.zIndex = "1";
    fade(incoming, 0, 0, 0); // ensure start state
    await fade(incoming, 0, 1, duration);
    fade(outgoing, 0, 0, 0); // retire the old frame
  },

  /**
   * Dip to black: the current image fades out to the dark stage, then the new
   * image fades in. Good for time skips and hard scene breaks. Each half uses
   * roughly half the total duration.
   */
  async fade_to_black({ incoming, outgoing, url, duration }) {
    const half = Math.round(duration / 2);
    incoming.style.zIndex = "2";
    outgoing.style.zIndex = "1";
    await fade(outgoing, 1, 0, half);
    paint(incoming, url);
    await fade(incoming, 0, 1, half);
  }
};

/**
 * Owns the background frames and orchestrates transitions between images.
 */
export class BackgroundTransitioner {
  /**
   * @param {HTMLElement} container - The registered `.stage-bg` element.
   * @param {object} options - Services.
   * @param {(id: string) => (string|null)} options.resolveImage - Id → url.
   * @param {() => boolean} [options.shouldInstant] - When true, transitions cut
   *   instantly (e.g. during skip/fast-forward).
   */
  constructor(container, { resolveImage, shouldInstant } = {}) {
    this.container = container;
    this.resolveImage = resolveImage ?? (() => null);
    this.shouldInstant = shouldInstant ?? (() => false);
    this.transitions = { ...BUILTIN_TRANSITIONS };

    // Two stacked frames inside the container.
    this.frames = [this.#makeFrame(), this.#makeFrame()];
    this.front = 0;
    this.frames[0].style.zIndex = "2";
    this.frames[1].style.zIndex = "1";
    this.currentId = null;
    this.pending = Promise.resolve();
  }

  /**
   * Registers (or overrides) a named transition.
   *
   * @param {string} name - Transition name used by `background(id, {transition})`.
   * @param {(ctx: object) => Promise<void>} fn - Transition implementation.
   * @returns {void}
   */
  register(name, fn) {
    this.transitions[name] = fn;
  }

  /**
   * Transitions the background to a new image.
   *
   * @param {string|null} id - Asset id (null clears to nothing).
   * @param {object} [options] - { transition, duration }.
   * @returns {Promise<void>} Resolves when the transition completes.
   */
  show(id, { transition, duration } = {}) {
    // Same image already showing — nothing to do.
    if (id === this.currentId) {
      return this.pending;
    }
    this.currentId = id;
    const url = id ? this.resolveImage(id) : null;
    const kind = transition ?? DEFAULT_BACKGROUND_TRANSITION;
    const fn = this.transitions[kind] ?? this.transitions[DEFAULT_BACKGROUND_TRANSITION];
    const dur = this.shouldInstant() ? 0 : duration ?? DEFAULT_BACKGROUND_TRANSITION_DURATION;

    // Serialize transitions so overlapping changes can't fight over frames.
    this.pending = this.pending.then(() => {
      const incoming = this.frames[1 - this.front];
      const outgoing = this.frames[this.front];
      return Promise.resolve(
        fn({ incoming, outgoing, url, duration: dur, root: this.container })
      ).then(() => {
        this.front = 1 - this.front;
      });
    });
    return this.pending;
  }

  /**
   * Clears both frames immediately (title screen / scene teardown).
   *
   * @returns {void}
   */
  clear() {
    this.currentId = null;
    for (const frame of this.frames) {
      paint(frame, null);
      fade(frame, 0, 0, 0);
    }
  }

  /**
   * Creates one background frame element parented to the container.
   *
   * @returns {HTMLElement} Frame element.
   */
  #makeFrame() {
    const frame = document.createElement("div");
    frame.className = "stage-bg-frame";
    this.container.append(frame);
    return frame;
  }
}
