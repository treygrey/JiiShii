import { GALLERY_SURFACE } from "../../engine/surface-modules.js";
import { PhoneShell, stopPhoneStoryAdvance } from "./phone-shell.js";

/**
 * Renders the phone gallery app.
 */
export class GalleryRenderer {
  static contract = {
    ...GALLERY_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Stage root.
   * @param {object} [options] - Renderer services.
   */
  constructor(appRoot, options = {}) {
    this.resolveImage = options.resolveImage ?? (() => null);
    this.shell = new PhoneShell(appRoot, options);
    this.surface = null;
    this.runner = null;
    this.activeSection = "all";
    this.activeTag = null;
  }

  /**
   * Binds the scene runner.
   *
   * @param {object} runner - Scene runner.
   * @returns {void}
   */
  bindRunner(runner) {
    this.runner = runner;
    this.shell.bindRunner(runner);
    this.shell.setHomeHandler(() => this.runner?.openPhoneApp?.("home"));
  }

  /**
   * Mounts the gallery.
   *
   * @returns {void}
   */
  mount() {
    this.shell.mount({ className: "gallery-phone-shell", title: "Gallery", subtitle: "Saved images" });
    this.surface = this.shell.surface;
    this.bindHomeChrome();
  }

  /**
   * Unmounts the gallery.
   *
   * @returns {void}
   */
  unmount() {
    this.shell.unmount();
    this.surface = null;
  }

  reset() {}
  clearChoices() {}
  showTransition() {}
  showChoice() {}
  showEnd() {}

  /**
   * Routes shared phone Home chrome through the renderer-owned runner handle.
   *
   * @returns {void}
   */
  bindHomeChrome() {
    for (const button of this.surface?.querySelectorAll("[data-phone-nav='home']") ?? []) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (this.runner?.state?.visuals?.phone?.isButtonEnabled === false) {
          return;
        }
        this.runner?.openPhoneApp?.("home");
      });
      button.addEventListener("pointerup", (event) => {
        event.stopPropagation();
      });
    }
  }

  /**
   * Shows a shared in-phone notification toast.
   *
   * @param {object} notification - Notification state.
   * @param {object} options - Toast callbacks.
   * @returns {void}
   */
  showPhoneToast(notification, options) {
    this.shell.showToast(notification, options);
  }

  /**
   * Projects gallery state.
   *
   * @param {object} gallery - Gallery state.
   * @param {object} options - Projection options.
   * @returns {void}
   */
  renderGalleryState(gallery, { phone } = {}) {
    this.shell.setBackHandler(this.activeTag ? () => {
      this.activeTag = null;
      this.renderGalleryState(gallery, { phone: this.runner?.state?.visuals?.phone });
      return true;
    } : null);
    this.clearHeaderAction();
    this.shell.renderPhoneChrome(phone);
    if (!this.shell.content) {
      return;
    }
    const images = gallery.images ?? [];
    this.shell.content.innerHTML = `
      <div class="gallery-app-root">
        <div class="gallery-app-tabs" role="tablist" aria-label="Gallery sections">
          <button class="gallery-app-tab ${this.activeSection === "all" ? "is-active" : ""}" type="button" data-gallery-section="all" role="tab" aria-selected="${this.activeSection === "all"}">All Pics</button>
          <button class="gallery-app-tab ${this.activeSection === "galleries" ? "is-active" : ""}" type="button" data-gallery-section="galleries" role="tab" aria-selected="${this.activeSection === "galleries"}">Galleries</button>
        </div>
        <section class="gallery-app-panel">
          ${this.renderActiveSection(images)}
        </section>
      </div>
    `;
    this.bindSectionControls(gallery);
    this.bindImageControls(images);
  }

  /**
   * Renders the current Gallery section.
   *
   * @param {Array<object>} images - Saved gallery images.
   * @returns {string} Section HTML.
   */
  renderActiveSection(images) {
    if (!images.length) {
      return `<div class="phone-empty-state">No saved images</div>`;
    }
    if (this.activeSection === "galleries") {
      return this.renderGalleryCollections(images);
    }
    return this.renderImageGrid(images);
  }

  /**
   * Renders the author-tagged gallery collections.
   *
   * @param {Array<object>} images - Saved gallery images.
   * @returns {string} Collections HTML.
   */
  renderGalleryCollections(images) {
    const tags = this.groupImagesByTag(images);
    if (!tags.length) {
      return `<div class="phone-empty-state">No galleries yet</div>`;
    }
    if (this.activeTag) {
      const taggedImages = images.filter((image) => (image.tags ?? []).includes(this.activeTag));
      return `
        <div class="gallery-tag-view">
          <h2>${this.activeTag}</h2>
          ${this.renderImageGrid(taggedImages)}
        </div>
      `;
    }
    return `
      <div class="gallery-tag-list">
        ${tags.map((tag) => `
          <button class="gallery-tag-card" type="button" data-gallery-tag="${tag.name}">
            <span class="gallery-tag-stack" aria-hidden="true">
              ${tag.previews.map((image, index) => this.renderTagPreview(image, index)).join("")}
            </span>
            <span class="gallery-tag-copy">
              <strong>${tag.name}</strong>
              <span>${tag.count} ${tag.count === 1 ? "pic" : "pics"}</span>
            </span>
          </button>
        `).join("")}
      </div>
    `;
  }

  /**
   * Renders an image grid.
   *
   * @param {Array<object>} images - Images to render.
   * @returns {string} Grid HTML.
   */
  renderImageGrid(images) {
    return `
      <div class="gallery-app-grid">
        ${images.map((image) => this.renderImage(image)).join("")}
      </div>
    `;
  }

  /**
   * Groups gallery images by author-provided tag.
   *
   * @param {Array<object>} images - Saved gallery images.
   * @returns {Array<object>} Sorted tag summaries.
   */
  groupImagesByTag(images) {
    const tags = new Map();
    for (const image of images) {
      for (const tag of image.tags ?? []) {
        const taggedImages = tags.get(tag) ?? [];
        taggedImages.push(image);
        tags.set(tag, taggedImages);
      }
    }
    return [...tags.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, taggedImages]) => ({
        name,
        count: taggedImages.length,
        previews: taggedImages.slice(0, 3)
      }));
  }

  /**
   * Binds tabs and gallery-tag controls.
   *
   * @param {object} gallery - Gallery state.
   * @returns {void}
   */
  bindSectionControls(gallery) {
    for (const button of this.shell.content.querySelectorAll("[data-gallery-section]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activeSection = button.dataset.gallerySection;
        this.activeTag = null;
        this.renderGalleryState(gallery, { phone: this.runner?.state?.visuals?.phone });
      });
      button.addEventListener("pointerdown", stopPhoneStoryAdvance);
      button.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
    for (const button of this.shell.content.querySelectorAll("[data-gallery-tag]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activeTag = button.dataset.galleryTag;
        this.renderGalleryState(gallery, { phone: this.runner?.state?.visuals?.phone });
      });
      button.addEventListener("pointerdown", stopPhoneStoryAdvance);
      button.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }

  /**
   * Binds image thumbnail controls.
   *
   * @param {Array<object>} images - Current gallery images.
   * @returns {void}
   */
  bindImageControls(images) {
    for (const button of this.shell.content.querySelectorAll("[data-gallery-image]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.showImageDetail(images.find((image) => image.id === button.dataset.galleryImage));
      });
      button.addEventListener("pointerdown", stopPhoneStoryAdvance);
      button.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }

  /**
   * Renders a gallery thumbnail.
   *
   * @param {object} image - Gallery image.
   * @returns {string} Thumbnail HTML.
   */
  renderImage(image) {
    const src = this.resolveImage(image.image);
    return `
      <button class="gallery-thumb" type="button" data-gallery-image="${image.id}">
        ${src ? `<img src="${src}" alt="">` : `<span>${image.image}</span>`}
      </button>
    `;
  }

  /**
   * Renders one image inside a stacked gallery collection preview.
   *
   * @param {object} image - Gallery image.
   * @param {number} index - Preview stack index.
   * @returns {string} Preview HTML.
   */
  renderTagPreview(image, index) {
    const src = this.resolveImage(image.image);
    return src
      ? `<img class="gallery-tag-preview gallery-tag-preview--${index}" src="${src}" alt="">`
      : `<span class="gallery-tag-preview gallery-tag-preview--${index}"></span>`;
  }

  /**
   * Shows a selected image and wallpaper action.
   *
   * @param {object} image - Gallery image.
   * @returns {void}
   */
  showImageDetail(image) {
    if (!image || !this.shell.content) {
      return;
    }
    const src = this.resolveImage(image.image);
    this.shell.setBackHandler(() => {
      this.runner?.projectSurface?.("gallery", { instant: true });
      return true;
    });
    this.setHeaderAction(image);
    this.shell.content.innerHTML = `
      <div class="gallery-detail">
        ${src ? `<img src="${src}" alt="">` : `<div class="phone-empty-state">${image.image}</div>`}
      </div>
    `;
  }

  /**
   * Adds the selected image's wallpaper action to the Gallery header.
   *
   * @param {object} image - Gallery image.
   * @returns {void}
   */
  setHeaderAction(image) {
    const header = this.surface?.querySelector(".phone-header");
    if (!header) {
      return;
    }
    this.clearHeaderAction();
    const wallpaperButton = document.createElement("button");
    wallpaperButton.className = "gallery-wallpaper-button gallery-header-action";
    wallpaperButton.type = "button";
    wallpaperButton.textContent = "Set wallpaper";
    wallpaperButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.runner?.setPhoneWallpaper?.(image.id);
    });
    wallpaperButton.addEventListener("pointerdown", stopPhoneStoryAdvance);
    wallpaperButton.addEventListener("pointerup", stopPhoneStoryAdvance);
    header.append(wallpaperButton);
  }

  /**
   * Removes any detail-only Gallery header action.
   *
   * @returns {void}
   */
  clearHeaderAction() {
    this.surface?.querySelector(".gallery-header-action")?.remove();
  }
}
