import { resolveWallpaperAsset } from "../../engine/surfaces/index.js";
import { escapeHtml } from "../html.js";
import {
  PHONE_ADVANCE_DEAD_ZONE_EVENTS,
  bindPhoneAdvanceDeadZones,
  bindPhoneNavigation,
  createPhoneFrame,
  stopPhoneStoryAdvance
} from "./phone-frame.js";

export { stopPhoneStoryAdvance } from "./phone-frame.js";

/**
 * Builds shared Android-style phone chrome for display apps.
 */
export class PhoneShell {
  /**
   * @param {Element} appRoot - Stage root.
   * @param {object} options - Shell options.
   * @param {Function} options.resolveImage - Image resolver.
   */
  constructor(appRoot, { resolveImage } = {}) {
    this.appRoot = appRoot;
    this.resolveImage = resolveImage ?? (() => null);
    this.surface = null;
    this.content = null;
    this.toastHost = null;
    this.runner = null;
    this.onHome = null;
    this.onBack = null;
    this.documentNavigationHandler = null;
  }

  /**
   * Connects runner navigation callbacks.
   *
   * @param {object} runner - Scene runner.
   * @returns {void}
   */
  bindRunner(runner) {
    this.runner = runner;
  }

  /**
   * Sets the shell-level Home navigation handler.
   *
   * @param {Function} onHome - Opens the phone home app.
   * @returns {void}
   */
  setHomeHandler(onHome) {
    this.onHome = onHome;
  }

  /**
   * Sets the shell-level Back navigation handler.
   *
   * @param {Function|null} onBack - Runs before runner-level phone history.
   * @returns {void}
   */
  setBackHandler(onBack) {
    this.onBack = typeof onBack === "function" ? onBack : null;
  }

  /**
   * Mounts shell markup.
   *
   * @param {object} options - Mount options.
   * @param {string} options.className - App-specific shell class.
   * @param {string} options.title - Header title.
   * @param {string} [options.subtitle] - Header subtitle.
   * @param {boolean} [options.showHeader] - Whether to render app header chrome.
   * @param {boolean} [options.showBack] - Whether to show a root-level back affordance.
   * @param {boolean} [options.showAvatar] - Whether to show the app avatar in the header.
   * @param {boolean} [options.showHomeShortcut] - Whether to show a header Home shortcut.
   * @returns {void}
   */
  mount({
    className,
    title,
    subtitle = "",
    showHeader = true,
    showBack = false,
    showAvatar = false,
    showHomeShortcut = false
  }) {
    if (this.surface) {
      return;
    }
    const backButton = showBack
      ? `
        <button class="icon-button phone-back-button" type="button" title="Back" aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      `
      : "";
    const headerAvatar = showAvatar
      ? `<div class="header-avatar" aria-hidden="true">${escapeHtml(title.slice(0, 1))}</div>`
      : "";
    const homeShortcut = showHomeShortcut
      ? `
        <button class="icon-button phone-home-shortcut" type="button" title="Home" aria-label="Home screen" data-phone-nav="home">
          <span class="phone-home-pill phone-home-pill--header" aria-hidden="true"></span>
        </button>
      `
      : "";
    this.surface = document.createElement("div");
    this.surface.className = `phone-app-shell ${className}`;
    this.surface.innerHTML = createPhoneFrame({
      screenClassName: "phone-app-screen",
      bodyHtml: `
        <div class="phone-wallpaper" aria-hidden="true"></div>
        ${showHeader ? `
          <header class="phone-header">
            ${backButton}
            <div class="header-id ${showAvatar ? "" : "header-id--plain"}">
              ${headerAvatar}
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(subtitle)}</p>
            </div>
            ${homeShortcut}
          </header>
        ` : ""}
        <div class="phone-toast-host" aria-live="polite"></div>
        <div class="phone-app-content"></div>
      `
    });
    this.appRoot.append(this.surface);
    this.content = this.surface.querySelector(".phone-app-content");
    this.toastHost = this.surface.querySelector(".phone-toast-host");
    this.bindDeadZones();
    this.bindDocumentNavigation();
  }

  /**
   * Removes shell markup.
   *
   * @returns {void}
   */
  unmount() {
    this.unbindDocumentNavigation();
    this.surface?.remove();
    this.surface = null;
    this.content = null;
    this.toastHost = null;
    this.onBack = null;
  }

  /**
   * Applies phone state to shared chrome.
   *
   * @param {object} phone - Phone state.
   * @returns {void}
   */
  renderPhoneChrome(phone = {}) {
    if (!this.surface) {
      return;
    }
    const wallpaper = this.surface.querySelector(".phone-wallpaper");
    const wallpaperImage = resolveWallpaperAsset(
      phone,
      this.runner?.state?.visuals?.gallery,
      this.runner?.phoneConfig,
      { resolveImage: this.resolveImage }
    );
    const wallpaperUrl = wallpaperImage ? this.resolveImage(wallpaperImage) : null;
    wallpaper.style.backgroundImage = wallpaperUrl ? `url("${wallpaperUrl}")` : "";
    const isHomeEnabled = phone.isButtonEnabled !== false;
    for (const homeButton of this.surface.querySelectorAll("[data-phone-nav='home']")) {
      homeButton.disabled = !isHomeEnabled;
      homeButton.setAttribute("aria-disabled", String(!isHomeEnabled));
    }
  }

  /**
   * Shows a phone toast.
   *
   * @param {object} notification - Notification state.
   * @param {object} options - Toast options.
   * @param {Function} options.onSelect - Select callback.
   * @returns {void}
   */
  showToast(notification, { onSelect } = {}) {
    if (!this.toastHost || !notification) {
      return;
    }
    this.toastHost.innerHTML = "";
    const button = document.createElement("button");
    button.className = "phone-toast";
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(notification.app)}</strong><span>${escapeHtml(notification.text)}</span>`;
    for (const eventName of PHONE_ADVANCE_DEAD_ZONE_EVENTS) {
      button.addEventListener(eventName, stopPhoneStoryAdvance);
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toastHost.innerHTML = "";
      onSelect?.();
    });
    this.toastHost.append(button);
  }

  /**
   * Binds chrome dead-zone behavior.
   *
   * @returns {void}
   */
  bindDeadZones() {
    bindPhoneAdvanceDeadZones(this.surface);
  }

  /**
   * Captures phone navigation before child chrome can stop propagation.
   *
   * @returns {void}
   */
  bindDocumentNavigation() {
    this.unbindDocumentNavigation();
    this.documentNavigationHandler = bindPhoneNavigation(this.surface, {
      onBack: () => {
        if (this.onBack?.() === true) {
          return;
        }
        this.runner?.goBackPhoneApp?.();
      },
      onHome: () => {
        if (this.onHome) {
          this.onHome();
          return;
        }
        this.runner?.openPhoneApp?.("home");
      },
      isHomeEnabled: () => this.runner?.state?.visuals?.phone?.isButtonEnabled !== false
    });
  }

  /**
   * Removes document-level phone navigation capture.
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
}
