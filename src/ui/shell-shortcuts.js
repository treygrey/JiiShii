const KEY_ACTIONS = {
  h: "history",
  s: "save",
  l: "load",
  p: "prefs",
  a: "auto",
  k: "skip"
};

/**
 * Resolves a keyboard event into a player-shell action.
 *
 * @param {object} options - Shortcut inputs.
 * @param {string} options.key - KeyboardEvent key.
 * @param {boolean} [options.hasOverlay] - Whether an overlay is open.
 * @param {boolean} [options.inMenu] - Whether the title menu is visible.
 * @param {boolean} [options.isEditable] - Whether focus is in an editable field.
 * @param {boolean} [options.ctrlKey] - Whether Ctrl is held.
 * @param {boolean} [options.metaKey] - Whether Meta is held.
 * @param {boolean} [options.altKey] - Whether Alt is held.
 * @returns {string|null} Shell action id, or null.
 */
export function resolveShellShortcut({
  key,
  hasOverlay = false,
  inMenu = false,
  isEditable = false,
  ctrlKey = false,
  metaKey = false,
  altKey = false
}) {
  if (key === "Escape") {
    return hasOverlay ? "closeOverlay" : null;
  }
  if (hasOverlay || inMenu || isEditable || ctrlKey || metaKey || altKey) {
    return null;
  }
  return KEY_ACTIONS[String(key).toLowerCase()] ?? null;
}

/**
 * Reports whether an event target should keep normal typing shortcuts.
 *
 * @param {EventTarget|null} target - Keyboard event target.
 * @returns {boolean} True when shortcuts should be ignored.
 */
export function isEditableTarget(target) {
  const element = target;
  if (!element || typeof element.closest !== "function") {
    return false;
  }
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}
