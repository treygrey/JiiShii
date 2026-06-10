import { resolveWallpaperAsset } from "../../engine/surface-modules.js";

const PHONE_ADVANCE_DEAD_ZONE_EVENTS = ["click", "pointerdown", "pointerup", "wheel"];

/**
 * Stops phone chrome interactions from advancing the story behind the app.
 *
 * @param {Event} event - Pointer, click, or wheel event.
 * @returns {void}
 */
export function stopPhoneStoryAdvance(event) {
  event.stopPropagation();
}

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
      ? `<div class="header-avatar" aria-hidden="true">${title.slice(0, 1)}</div>`
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
    this.surface.innerHTML = `
      <section class="phone-frame" aria-label="Phone">
        <div class="phone-notch" aria-hidden="true"></div>
        <div class="status-bar">
          <span class="status-time">14:30</span>
          <span class="status-icons" aria-label="Phone status">
            <span class="wifi-dot" aria-hidden="true"></span>
            <span class="signal-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="battery-icon" aria-hidden="true"></span>
          </span>
        </div>
        <section class="phone-screen phone-app-screen">
          <div class="phone-wallpaper" aria-hidden="true"></div>
          ${showHeader ? `
            <header class="phone-header">
              ${backButton}
              <div class="header-id ${showAvatar ? "" : "header-id--plain"}">
                ${headerAvatar}
                <h1>${title}</h1>
                <p>${subtitle}</p>
              </div>
              ${homeShortcut}
            </header>
          ` : ""}
          <div class="phone-toast-host" aria-live="polite"></div>
          <div class="phone-app-content"></div>
        </section>
        <nav class="phone-nav-bar" aria-label="Phone navigation">
          <button class="phone-nav-button" type="button" aria-label="System back" data-phone-nav="back">
            <span class="phone-nav-glyph" aria-hidden="true">‹</span>
          </button>
          <button class="phone-nav-button phone-home-button" type="button" aria-label="Home" data-phone-nav="home">
            <span class="phone-home-pill" aria-hidden="true"></span>
          </button>
          <button class="phone-nav-button" type="button" aria-label="Settings">
            <span class="phone-nav-glyph" aria-hidden="true">Settings</span>
          </button>
        </nav>
      </section>
    `;
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
    button.innerHTML = `<strong>${notification.app}</strong><span>${notification.text}</span>`;
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
   * Binds chrome navigation and dead-zone behavior.
   *
   * @returns {void}
   */
  bindDeadZones() {
    const deadZones = this.surface.querySelectorAll(".status-bar, .phone-header, .phone-nav-bar, .phone-app-content");
    for (const deadZone of deadZones) {
      for (const eventName of PHONE_ADVANCE_DEAD_ZONE_EVENTS) {
        deadZone.addEventListener(eventName, stopPhoneStoryAdvance);
      }
    }
    const goHome = (event) => {
      event.stopPropagation();
      if (this.runner?.state?.visuals?.phone?.isButtonEnabled === false) {
        return;
      }
      if (this.onHome) {
        this.onHome();
        return;
      }
      this.runner?.openPhoneApp?.("home");
    };
    const goBack = (event) => {
      event.stopPropagation();
      if (this.onBack?.() === true) {
        return;
      }
      this.runner?.goBackPhoneApp?.();
    };
    this.surface.addEventListener("click", (event) => {
      const navTarget = event.target.closest?.("[data-phone-nav]");
      if (navTarget?.dataset.phoneNav === "home") {
        goHome(event);
      } else if (navTarget?.dataset.phoneNav === "back") {
        goBack(event);
      }
    }, true);
    for (const backButton of this.surface.querySelectorAll("[data-phone-nav='back']")) {
      backButton.addEventListener("click", goBack);
      backButton.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
    for (const homeButton of this.surface.querySelectorAll(".phone-home-button, .phone-home-shortcut")) {
      homeButton.addEventListener("click", goHome);
      homeButton.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }

  /**
   * Captures phone navigation before child chrome can stop propagation.
   *
   * @returns {void}
   */
  bindDocumentNavigation() {
    this.unbindDocumentNavigation();
    this.documentNavigationHandler = (event) => {
      if (!this.surface?.contains(event.target)) {
        return;
      }
      const navTarget = event.target.closest?.("[data-phone-nav]");
      if (!["home", "back"].includes(navTarget?.dataset.phoneNav)) {
        return;
      }
      event.stopPropagation();
      if (navTarget.dataset.phoneNav === "back") {
        if (this.onBack?.() === true) {
          return;
        }
        this.runner?.goBackPhoneApp?.();
        return;
      }
      if (this.runner?.state?.visuals?.phone?.isButtonEnabled === false) {
        return;
      }
      if (this.onHome) {
        this.onHome();
        return;
      }
      this.runner?.openPhoneApp?.("home");
    };
    document.addEventListener("click", this.documentNavigationHandler, true);
    for (const navTarget of this.surface.querySelectorAll("[data-phone-nav='home'], [data-phone-nav='back']")) {
      navTarget.onclick = (event) => {
        event.stopPropagation();
        if (navTarget.dataset.phoneNav === "back") {
          if (this.onBack?.() === true) {
            return;
          }
          this.runner?.goBackPhoneApp?.();
          return;
        }
        if (this.runner?.state?.visuals?.phone?.isButtonEnabled === false) {
          return;
        }
        if (this.onHome) {
          this.onHome();
          return;
        }
        this.runner?.openPhoneApp?.("home");
      };
    }
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
    document.removeEventListener("click", this.documentNavigationHandler, true);
    this.documentNavigationHandler = null;
  }
}
