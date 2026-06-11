import { PHONE_HOME_SURFACE } from "../../engine/surfaces/index.js";
import { PhoneShell, stopPhoneStoryAdvance } from "./phone-shell.js";

const APP_LABELS = {
  texting: "Messages",
  gallery: "Gallery",
  social: "Social",
  browser: "Browser"
};

const APP_ICONS = {
  texting: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8.5z"></path>
    </svg>
  `,
  gallery: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 22H4a2 2 0 0 1-2-2V6"></path>
      <path d="M22 18V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"></path>
      <circle cx="12" cy="9" r="2"></circle>
      <path d="m22 15-3.5-3.5L11 19"></path>
    </svg>
  `,
  social: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A10 10 0 0 1 19.5 4"></path>
      <path d="M8 18a6 6 0 0 1 10-10"></path>
      <path d="M12 16a2 2 0 1 0 4-4 2 2 0 0 0-4 4z"></path>
      <path d="M16 14h5"></path>
    </svg>
  `,
  browser: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M3 12h18"></path>
      <path d="M12 3a14 14 0 0 1 0 18"></path>
      <path d="M12 3a14 14 0 0 0 0 18"></path>
    </svg>
  `
};

/**
 * Renders the phone home/app launcher.
 */
export class PhoneHomeRenderer {
  static contract = {
    ...PHONE_HOME_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Stage root.
   * @param {object} [options] - Renderer services.
   */
  constructor(appRoot, options = {}) {
    this.shell = new PhoneShell(appRoot, options);
    this.surface = null;
    this.runner = null;
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
   * Mounts the phone home.
   *
   * @returns {void}
   */
  mount() {
    this.shell.mount({ className: "phone-home-shell", title: "Phone", subtitle: "Home", showHeader: false });
    this.surface = this.shell.surface;
    this.bindHomeChrome();
  }

  /**
   * Unmounts the phone home.
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
   * Projects phone home state.
   *
   * @param {object} state - Phone home projection.
   * @returns {void}
   */
  renderPhoneHomeState(state) {
    this.shell.renderPhoneChrome(state.phone);
    if (!this.shell.content) {
      return;
    }
    const apps = (state.phone.homeAppOrder ?? []).filter((app) => state.phone.enabledApps?.includes(app));
    this.shell.content.innerHTML = `
      <div class="phone-home-screen">
        <section class="phone-home-clock" aria-label="Phone home status">
          <span class="phone-home-day">Today</span>
          <strong>14:30</strong>
        </section>
        <div class="phone-home-grid">
          ${apps.map((app) => this.renderAppIcon(app, state.phone, state.phoneApps ?? {})).join("")}
        </div>
      </div>
    `;
    for (const button of this.shell.content.querySelectorAll("[data-phone-app]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.runner?.openPhoneApp?.(button.dataset.phoneApp);
      });
      button.addEventListener("pointerdown", stopPhoneStoryAdvance);
      button.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }

  /**
   * Renders one app launcher button.
   *
   * @param {string} app - App id.
   * @param {object} phone - Phone state.
   * @param {Record<string, object>} phoneApps - App launcher metadata.
   * @returns {string} App icon HTML.
   */
  renderAppIcon(app, phone, phoneApps = {}) {
    const label = phoneApps[app]?.label ?? APP_LABELS[app] ?? app;
    const glyph = this.renderAppGlyph(app, label, phoneApps);
    const hasBadge = Boolean(phone.badges?.[app]);
    const tone = app.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    return `
      <button class="phone-app-icon phone-app-icon--${tone}" type="button" data-phone-app="${app}" aria-label="${label}">
        <span class="phone-app-icon-glyph" aria-hidden="true">${glyph}</span>
        ${hasBadge ? `<span class="phone-app-badge" aria-hidden="true"></span>` : ""}
        <span class="phone-app-label">${label}</span>
      </button>
    `;
  }

  /**
   * Renders a built-in SVG icon or a custom app's compact fallback glyph.
   *
   * @param {string} app - App id.
   * @param {string} label - Display label.
   * @param {Record<string, object>} phoneApps - App launcher metadata.
   * @returns {string} Icon HTML.
   */
  renderAppGlyph(app, label, phoneApps = {}) {
    if (APP_ICONS[app]) {
      return APP_ICONS[app];
    }
    return phoneApps[app]?.icon ?? label.slice(0, 1);
  }
}
