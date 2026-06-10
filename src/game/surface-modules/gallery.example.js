// =============================================================================
// Example surface module: scripted phone gallery
//
// Copy this file to gallery.js, then edit the ids/commands/rendering for your
// own module. Files ending in .example.js are ignored by auto-discovery.
// =============================================================================

import { resolveImage } from "../assets.js";
import { defineSurfaceModule } from "../../engine/surface-modules.js";

/**
 * Creates a gallery image command for authored scenes.
 *
 * @param {string} id - Stable gallery entry id.
 * @param {string} asset - Image asset id from src/game/assets.
 * @param {object} [options] - Gallery image options.
 * @returns {object} Gallery image command.
 */
export function galleryImage(id, asset, options = {}) {
  return {
    type: "galleryImage",
    id,
    asset,
    ...options
  };
}

/**
 * Adds or selects an image in gallery state.
 *
 * @param {object} state - Mutable gallery state.
 * @param {object} command - Gallery image command.
 * @returns {void}
 */
function applyGalleryImage(state, command) {
  const existing = state.images.find((image) => image.id === command.id);
  const imageState = {
    id: command.id,
    asset: command.asset,
    caption: command.caption ?? null
  };

  if (existing) {
    Object.assign(existing, imageState);
  } else {
    state.images.push(imageState);
  }
  state.selected = command.id;
}

/**
 * Minimal surface module declaration.
 */
export const gallerySurface = defineSurfaceModule({
  id: "gallery",
  kind: "app",
  phoneApp: {
    label: "Gallery",
    icon: "G"
  },
  renderer: {
    commands: ["galleryImage", "choice", "transition"],
    projections: ["renderGalleryState"]
  },
  commands: {
    galleryImage: { blocks: false }
  },
  state: {
    create: () => ({ images: [], selected: null }),
    normalize: (value = {}) => ({
      images: Array.isArray(value.images) ? structuredClone(value.images) : [],
      selected: value.selected ?? null
    }),
    clone: (value) => structuredClone(value),
    project: ({ renderer, state, context }) => {
      renderer.renderGalleryState(state, { instant: context.instant });
    }
  },
  handlers: {
    galleryImage: {
      run: handleGalleryImage,
      instant: handleGalleryImage
    }
  }
});

/**
 * Handles gallery image commands during live play and reconstruction.
 *
 * @param {object} context - Handler context supplied by the runner.
 * @param {object} context.runner - Scene runner.
 * @param {object} context.command - Gallery image command.
 * @param {boolean} context.instant - True during replay/reconstruction.
 * @returns {void}
 */
function handleGalleryImage({ runner, command, instant }) {
  applyGalleryImage(runner.state.visuals.gallery, command);
  runner.projectSurface("gallery", { instant });
  runner.advanceCommand();
}

/**
 * Minimal renderer for the gallery surface.
 */
export class GalleryRenderer {
  static contract = {
    ...gallerySurface.renderer
  };

  /**
   * @param {Element} appRoot - Root app element.
   */
  constructor(appRoot) {
    this.appRoot = appRoot;
    this.surface = null;
    this.grid = null;
    this.choiceTray = null;
  }

  /**
   * Mounts the surface layer.
   *
   * @returns {void}
   */
  mount() {
    if (this.surface) {
      return;
    }
    this.surface = document.createElement("section");
    this.surface.className = "gallery-shell";
    this.surface.innerHTML = `
      <div class="gallery-grid"></div>
      <div class="choice-tray"></div>
    `;
    this.appRoot.append(this.surface);
    this.grid = this.surface.querySelector(".gallery-grid");
    this.choiceTray = this.surface.querySelector(".choice-tray");
  }

  /**
   * Unmounts the surface layer.
   *
   * @returns {void}
   */
  unmount() {
    this.surface?.remove();
    this.surface = null;
    this.grid = null;
    this.choiceTray = null;
  }

  /**
   * Clears transient renderer state.
   *
   * @returns {void}
   */
  reset() {
    if (this.grid) {
      this.grid.innerHTML = "";
    }
    this.clearChoices();
  }

  /**
   * Projects runner-owned gallery state into the DOM.
   *
   * @param {object} state - Gallery state.
   * @returns {void}
   */
  renderGalleryState(state) {
    if (!this.grid) {
      return;
    }
    this.grid.innerHTML = "";
    for (const item of state.images) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `gallery-thumb ${item.id === state.selected ? "is-selected" : ""}`;
      const url = resolveImage(item.asset);
      button.textContent = item.caption ?? item.id;
      if (url) {
        button.style.backgroundImage = `url("${url}")`;
      }
      this.grid.append(button);
    }
  }

  /**
   * Shows shared choice buttons on this surface.
   *
   * @param {object} command - Choice command.
   * @param {object} options - Choice callbacks.
   * @param {Function} options.onSelect - Selection callback.
   * @returns {void}
   */
  showChoice(command, { onSelect }) {
    this.clearChoices();
    for (const option of command.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.text;
      button.addEventListener("click", () => onSelect(option));
      this.choiceTray.append(button);
    }
  }

  /**
   * Shows a transition button on this surface.
   *
   * @param {object} command - Transition command.
   * @param {object} options - Transition callbacks.
   * @param {Function} options.onSelect - Selection callback.
   * @returns {void}
   */
  showTransition(command, { onSelect }) {
    this.clearChoices();
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = command.text;
    button.addEventListener("click", () => onSelect());
    this.choiceTray.append(button);
  }

  /**
   * Clears choice and transition controls.
   *
   * @returns {void}
   */
  clearChoices() {
    if (this.choiceTray) {
      this.choiceTray.innerHTML = "";
    }
  }
}

export const rendererConstructors = {
  gallery: GalleryRenderer
};
