import { CALLS_SURFACE } from "../../engine/surfaces/index.js";
import { escapeAttr, escapeHtml, escapeInitial } from "../html.js";
import { PhoneShell, stopPhoneStoryAdvance } from "./phone-shell.js";

/**
 * Renders the non-story Calls app: recents and voicemail.
 */
export class CallsRenderer {
  static contract = {
    ...CALLS_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Stage root.
   * @param {object} [options] - Renderer services.
   */
  constructor(appRoot, options = {}) {
    this.shell = new PhoneShell(appRoot, options);
    this.surface = null;
    this.runner = null;
    this.activeTab = "recents";
    this.selectedVoicemailId = null;
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
   * Mounts the Calls app.
   *
   * @returns {void}
   */
  mount() {
    this.shell.mount({ className: "calls-phone-shell", title: "Calls", subtitle: "Recents and voicemail" });
    this.surface = this.shell.surface;
  }

  /**
   * Unmounts the Calls app.
   *
   * @returns {void}
   */
  unmount() {
    this.shell.unmount();
    this.surface = null;
    this.selectedVoicemailId = null;
  }

  reset() {}
  clearChoices() {}
  showTransition() {}
  showChoice() {}
  showEnd() {}

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
   * Projects calls app state.
   *
   * @param {object} calls - Calls app state.
   * @param {object} options - Projection options.
   * @returns {void}
   */
  renderCallsState(calls = {}, { phone } = {}) {
    this.shell.setBackHandler(this.createBackHandler(calls));
    this.shell.renderPhoneChrome(phone);
    if (!this.shell.content) {
      return;
    }
    const selectedVoicemail = (calls.voicemails ?? []).find((entry) => entry.id === this.selectedVoicemailId);
    this.shell.content.innerHTML = selectedVoicemail
      ? this.renderVoicemailDetail(selectedVoicemail)
      : this.renderCallsRoot(calls);
    this.bindControls(calls);
  }

  /**
   * Creates app-root back behavior.
   *
   * @param {object} calls - Calls state.
   * @returns {Function|null} Back handler.
   */
  createBackHandler(calls) {
    if (this.selectedVoicemailId) {
      return () => {
        this.selectedVoicemailId = null;
        this.renderCallsState(calls, { phone: this.runner?.state?.visuals?.phone });
        return true;
      };
    }
    if (this.activeTab !== "recents") {
      return () => {
        this.activeTab = "recents";
        this.renderCallsState(calls, { phone: this.runner?.state?.visuals?.phone });
        return true;
      };
    }
    return null;
  }

  /**
   * Renders the Calls root tabs.
   *
   * @param {object} calls - Calls state.
   * @returns {string} Root HTML.
   */
  renderCallsRoot(calls) {
    return `
      <div class="calls-app-root">
        <div class="calls-tabs" role="tablist" aria-label="Calls sections">
          <button class="calls-tab ${this.activeTab === "recents" ? "is-active" : ""}" type="button" data-calls-tab="recents">Recents</button>
          <button class="calls-tab ${this.activeTab === "voicemail" ? "is-active" : ""}" type="button" data-calls-tab="voicemail">Voicemail</button>
        </div>
        <section class="calls-panel">
          ${this.activeTab === "voicemail" ? this.renderVoicemailList(calls.voicemails ?? []) : this.renderRecentList(calls.recents ?? [])}
        </section>
      </div>
    `;
  }

  /**
   * Renders recent calls.
   *
   * @param {object[]} recents - Recent call entries.
   * @returns {string} Recents HTML.
   */
  renderRecentList(recents) {
    if (!recents.length) {
      return `<div class="phone-empty-state">No recent calls</div>`;
    }
    return `
      <div class="calls-list">
        ${recents.map((entry) => `
          <article class="calls-row">
            <span class="calls-avatar" aria-hidden="true">${entry.contact?.avatar ? escapeHtml(entry.contact.avatar) : escapeInitial(entry.contact?.name)}</span>
            <span class="calls-copy">
              <strong>${escapeHtml(entry.contact?.name ?? "Unknown")}</strong>
              <small>${escapeHtml(entry.status ?? "completed")} ${escapeHtml(entry.mode ?? "voice")}</small>
            </span>
          </article>
        `).join("")}
      </div>
    `;
  }

  /**
   * Renders voicemail rows.
   *
   * @param {object[]} voicemails - Voicemail entries.
   * @returns {string} Voicemail list HTML.
   */
  renderVoicemailList(voicemails) {
    if (!voicemails.length) {
      return `<div class="phone-empty-state">No voicemail</div>`;
    }
    return `
      <div class="calls-list">
        ${voicemails.map((entry) => `
          <button class="calls-row calls-row--button ${entry.read ? "" : "is-unread"}" type="button" data-voicemail-id="${escapeAttr(entry.id)}">
            <span class="calls-avatar" aria-hidden="true">${entry.contact?.avatar ? escapeHtml(entry.contact.avatar) : escapeInitial(entry.contact?.name)}</span>
            <span class="calls-copy">
              <strong>${escapeHtml(entry.contact?.name ?? "Unknown")}</strong>
              <small>${escapeHtml(entry.text || "Voicemail")}</small>
            </span>
          </button>
        `).join("")}
      </div>
    `;
  }

  /**
   * Renders voicemail detail.
   *
   * @param {object} voicemail - Voicemail entry.
   * @returns {string} Detail HTML.
   */
  renderVoicemailDetail(voicemail) {
    const lines = voicemail.transcript?.length
      ? voicemail.transcript
      : [{ name: voicemail.contact?.name ?? "Voicemail", message: voicemail.text }];
    return `
      <div class="voicemail-detail">
        <span class="calls-avatar calls-avatar--large" aria-hidden="true">${voicemail.contact?.avatar ? escapeHtml(voicemail.contact.avatar) : escapeInitial(voicemail.contact?.name)}</span>
        <h2>${escapeHtml(voicemail.contact?.name ?? "Unknown")}</h2>
        <p>Voicemail</p>
        ${voicemail.audio ? `<button class="voicemail-play" type="button" data-voicemail-audio="${escapeAttr(voicemail.audio)}">Play voicemail</button>` : ""}
        <div class="voicemail-transcript">
          ${lines.map((line) => `<article><strong>${escapeHtml(line.name ?? voicemail.contact?.name ?? "")}</strong><p>${escapeHtml(line.message ?? "")}</p></article>`).join("")}
        </div>
      </div>
    `;
  }

  /**
   * Binds app controls.
   *
   * @param {object} calls - Calls state.
   * @returns {void}
   */
  bindControls(calls) {
    for (const button of this.shell.content.querySelectorAll("[data-calls-tab]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activeTab = button.dataset.callsTab;
        this.selectedVoicemailId = null;
        this.renderCallsState(calls, { phone: this.runner?.state?.visuals?.phone });
      });
    }
    for (const button of this.shell.content.querySelectorAll("[data-voicemail-id]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectedVoicemailId = button.dataset.voicemailId;
        this.renderCallsState(calls, { phone: this.runner?.state?.visuals?.phone });
      });
    }
    for (const button of this.shell.content.querySelectorAll("[data-voicemail-audio]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.runner?.playVoice?.({ type: "voice", id: button.dataset.voicemailAudio });
      });
    }
    for (const control of this.shell.content.querySelectorAll("button")) {
      control.addEventListener("pointerdown", stopPhoneStoryAdvance);
      control.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }
}
