import { PHONE_CALL_SURFACE } from "../../engine/surfaces/index.js";
import { createChoiceBand } from "../choice-band.js";
import { createPhoneFrame } from "../phone/phone-frame.js";

/**
 * Renders the modal story phone call surface as a static phone prop. Dialogue,
 * narration, and choices use the same shared UI language as IRL/streaming.
 */
export class PhoneCallRenderer {
  static contract = {
    ...PHONE_CALL_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Stage root.
   */
  constructor(appRoot) {
    this.appRoot = appRoot;
    this.surface = null;
    this.choiceOverlay = null;
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
  }

  /**
   * Mounts the static phone prop.
   *
   * @returns {void}
   */
  mount() {
    if (this.surface) {
      return;
    }
    this.surface = document.createElement("div");
    this.surface.className = "phone-call-shell";
    this.surface.innerHTML = createPhoneFrame({
      ariaLabel: "Active phone call",
      frameClassName: "phone-call-frame",
      screenClassName: "phone-call-screen",
      navClassName: "phone-call-nav",
      disableBack: true,
      disableHome: true,
      disableSettings: true,
      bodyHtml: `
        <div class="phone-call-content">
          <div class="phone-call-avatar" aria-hidden="true">?</div>
          <p class="phone-call-kicker">Voice call</p>
          <h1>Call</h1>
          <p class="phone-call-status">Connecting...</p>
          <div class="phone-call-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      `
    });
    this.appRoot.append(this.surface);
  }

  /**
   * Unmounts call prop and any active choice overlay.
   *
   * @returns {void}
   */
  unmount() {
    this.surface?.remove();
    this.choiceOverlay?.remove();
    this.surface = null;
    this.choiceOverlay = null;
  }

  /**
   * Clears transient choice UI.
   *
   * @returns {void}
   */
  reset() {
    this.clearChoices();
  }

  /**
   * Clears call choices.
   *
   * @returns {void}
   */
  clearChoices() {
    this.choiceOverlay?.remove();
    this.choiceOverlay = null;
  }

  showTransition() {}
  showEnd() {}

  /**
   * Projects active phone call metadata into the static phone prop.
   *
   * @param {object} callState - Phone call state.
   * @returns {void}
   */
  renderPhoneCallState(callState = {}) {
    if (!this.surface) {
      return;
    }
    const contact = callState.contact ?? {};
    this.surface.querySelector(".phone-call-avatar").textContent = contact.avatar ?? contact.name?.slice(0, 1) ?? "?";
    this.surface.querySelector(".phone-call-kicker").textContent = callState.mode === "video" ? "Video call" : "Voice call";
    this.surface.querySelector(".phone-call-content h1").textContent = contact.name ?? "Unknown caller";
    this.surface.querySelector(".phone-call-status").textContent = callState.active
      ? callState.title || "On call"
      : callState.status === "idle" ? "No active call" : "Call ended";
  }

  /**
   * Renders choice options through the shared IRL/streaming choice band.
   *
   * @param {object} choiceCommand - Choice command.
   * @param {object} callbacks - Choice callbacks.
   * @param {Function} callbacks.onSelect - Selection callback.
   * @returns {void}
   */
  showChoice(choiceCommand, { onSelect } = {}) {
    this.clearChoices();
    const overlay = createChoiceBand(choiceCommand, onSelect);
    this.appRoot.append(overlay);
    this.choiceOverlay = overlay;
  }
}
