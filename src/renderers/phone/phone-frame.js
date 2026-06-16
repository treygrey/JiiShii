import { escapeAttr, escapeHtml } from "../html.js";

export const PHONE_ADVANCE_DEAD_ZONE_EVENTS = ["click", "pointerdown", "pointerup", "wheel"];

/**
 * Stops phone chrome interactions from advancing the story behind it.
 *
 * @param {Event} event - Pointer, click, or wheel event.
 * @returns {void}
 */
export function stopPhoneStoryAdvance(event) {
  event.stopPropagation();
}

/**
 * Picks a legible text color for a colored avatar or bubble.
 *
 * @param {string} hex - Hex color, e.g. "#FB6F92".
 * @returns {string} Dark or light text color.
 */
export function readableTextColor(hex) {
  const value = String(hex ?? "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return "#ffffff";
  }
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
  return luminance > 0.6 ? "#16161a" : "#ffffff";
}

/**
 * Builds the Android-style status bar shared by phone-shaped surfaces.
 *
 * @param {object} [options] - Status bar options.
 * @param {string} [options.time] - Displayed time text.
 * @returns {string} Status bar HTML.
 */
export function createPhoneStatusBar({ time = "14:30" } = {}) {
  return `
    <div class="status-bar">
      <span class="status-time">${escapeHtml(time)}</span>
      <span class="status-icons" aria-label="Phone status">
        <span class="wifi-dot" aria-hidden="true"></span>
        <span class="signal-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="battery-icon" aria-hidden="true"></span>
      </span>
    </div>
  `;
}

/**
 * Builds the Android-style bottom navigation shared by phone-shaped surfaces.
 *
 * @param {object} [options] - Navigation options.
 * @param {string} [options.className] - Extra nav class.
 * @param {boolean} [options.disableBack] - Disable system back.
 * @param {boolean} [options.disableHome] - Disable Home.
 * @param {boolean} [options.disableSettings] - Disable Settings.
 * @returns {string} Navigation HTML.
 */
export function createPhoneNavBar({
  className = "",
  disableBack = false,
  disableHome = false,
  disableSettings = false
} = {}) {
  return `
    <nav class="phone-nav-bar ${escapeAttr(className)}" aria-label="Phone navigation">
      <button class="phone-nav-button" type="button" aria-label="System back" data-phone-nav="back" ${disableBack ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="phone-nav-glyph" aria-hidden="true">&#8249;</span>
      </button>
      <button class="phone-nav-button phone-home-button" type="button" aria-label="Home" data-phone-nav="home" ${disableHome ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="phone-home-pill" aria-hidden="true"></span>
      </button>
      <button class="phone-nav-button" type="button" aria-label="Settings" ${disableSettings ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="phone-nav-glyph" aria-hidden="true">Settings</span>
      </button>
    </nav>
  `;
}

/**
 * Builds the physical phone frame shared by story and app surfaces.
 *
 * @param {object} options - Frame options.
 * @param {string} options.bodyHtml - HTML inserted into the phone screen.
 * @param {string} [options.ariaLabel] - Frame aria label.
 * @param {string} [options.frameClassName] - Extra frame class.
 * @param {string} [options.screenClassName] - Extra screen class.
 * @param {string} [options.navClassName] - Extra nav class.
 * @param {string} [options.statusTime] - Status bar time text.
 * @param {boolean} [options.disableBack] - Disable system back.
 * @param {boolean} [options.disableHome] - Disable Home.
 * @param {boolean} [options.disableSettings] - Disable Settings.
 * @returns {string} Phone frame HTML.
 */
export function createPhoneFrame({
  bodyHtml,
  ariaLabel = "Phone",
  frameClassName = "",
  screenClassName = "",
  navClassName = "",
  statusTime = "14:30",
  disableBack = false,
  disableHome = false,
  disableSettings = false
}) {
  return `
    <section class="phone-frame ${escapeAttr(frameClassName)}" aria-label="${escapeAttr(ariaLabel)}">
      <div class="phone-notch" aria-hidden="true"></div>
      ${createPhoneStatusBar({ time: statusTime })}
      <section class="phone-screen ${escapeAttr(screenClassName)}">
        ${bodyHtml}
      </section>
      ${createPhoneNavBar({ className: navClassName, disableBack, disableHome, disableSettings })}
    </section>
  `;
}

/**
 * Marks selected phone elements as story-advance dead zones.
 *
 * @param {Element} root - Phone root.
 * @param {object} [options] - Binding options.
 * @param {string} [options.selector] - Dead-zone selector list.
 * @param {string[]} [options.events] - Events to stop.
 * @returns {void}
 */
export function bindPhoneAdvanceDeadZones(
  root,
  {
    selector = ".status-bar, .phone-header, .phone-nav-bar, .phone-app-content",
    events = PHONE_ADVANCE_DEAD_ZONE_EVENTS
  } = {}
) {
  for (const deadZone of root.querySelectorAll(selector)) {
    for (const eventName of events) {
      deadZone.addEventListener(eventName, stopPhoneStoryAdvance);
    }
  }
}

/**
 * Captures shared phone navigation clicks for a mounted phone frame.
 *
 * @param {Element} root - Phone surface root.
 * @param {object} handlers - Navigation handlers.
 * @param {Function} [handlers.onBack] - Back handler.
 * @param {Function} [handlers.onHome] - Home handler.
 * @param {Function} [handlers.isHomeEnabled] - Returns whether Home is enabled.
 * @returns {Function} Cleanup function.
 */
export function bindPhoneNavigation(root, { onBack, onHome, isHomeEnabled = () => true } = {}) {
  const handleNavigation = (event) => {
    if (!root?.contains(event.target)) {
      return;
    }
    const navTarget = event.target.closest?.("[data-phone-nav]");
    if (!["home", "back"].includes(navTarget?.dataset.phoneNav)) {
      return;
    }
    event.stopPropagation();
    if (navTarget.disabled || navTarget.getAttribute("aria-disabled") === "true") {
      return;
    }
    if (navTarget.dataset.phoneNav === "back") {
      onBack?.(event);
      return;
    }
    if (isHomeEnabled() === false) {
      return;
    }
    onHome?.(event);
  };

  document.addEventListener("click", handleNavigation, true);
  return () => document.removeEventListener("click", handleNavigation, true);
}
