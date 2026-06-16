/**
 * Escapes text for safe insertion into renderer-owned HTML templates.
 *
 * @param {unknown} value - Raw value.
 * @returns {string} Escaped HTML text.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes text for safe insertion into a double-quoted HTML attribute.
 *
 * @param {unknown} value - Raw value.
 * @returns {string} Escaped HTML attribute text.
 */
export function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/**
 * Returns a one-character display initial without letting markup through.
 *
 * @param {unknown} value - Raw label.
 * @param {string} [fallback] - Fallback initial.
 * @returns {string} Escaped single-character initial.
 */
export function escapeInitial(value, fallback = "?") {
  const initial = String(value ?? fallback).trim().slice(0, 1) || fallback;
  return escapeHtml(initial);
}

/**
 * Builds a conservative background-color inline style for avatar swatches.
 *
 * @param {unknown} value - Candidate CSS color.
 * @returns {string} Safe style attribute contents, or an empty string.
 */
export function safeBackgroundStyle(value) {
  const color = String(value ?? "").trim();
  return /^[#\w(),.%\s-]+$/.test(color) ? `background:${escapeAttr(color)}` : "";
}
