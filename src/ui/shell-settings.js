export const DEFAULT_SHELL_SETTINGS = {
  textSpeed: 0.6,
  autoDelay: 1600,
  masterVolume: 1,
  musicVolume: 0.85,
  ambienceVolume: 0.85,
  soundVolume: 1,
  voiceVolume: 1
};

const VOLUME_KEYS = [
  "masterVolume",
  "musicVolume",
  "ambienceVolume",
  "soundVolume",
  "voiceVolume"
];

/**
 * Normalizes partial or corrupt player settings into the shell settings shape.
 *
 * @param {object} [settings] - Candidate settings.
 * @returns {object} Normalized settings.
 */
export function normalizeShellSettings(settings = {}) {
  const normalized = { ...DEFAULT_SHELL_SETTINGS };
  if (!settings || typeof settings !== "object") {
    return normalized;
  }

  normalized.textSpeed = clampNumber(settings.textSpeed, 0, 1, normalized.textSpeed);
  normalized.autoDelay = clampNumber(settings.autoDelay, 400, 4000, normalized.autoDelay);
  for (const key of VOLUME_KEYS) {
    normalized[key] = clampNumber(settings[key], 0, 1, normalized[key]);
  }
  return normalized;
}

/**
 * Parses stored player settings without throwing.
 *
 * @param {string|null} rawSettings - Stored JSON payload.
 * @returns {object} Normalized settings.
 */
export function parseShellSettings(rawSettings) {
  if (!rawSettings) {
    return normalizeShellSettings();
  }
  try {
    return normalizeShellSettings(JSON.parse(rawSettings));
  } catch {
    return normalizeShellSettings();
  }
}

/**
 * Maps a 0..1 text speed to a friendly label.
 *
 * @param {number} value - Text speed.
 * @returns {string} Label.
 */
export function speedLabel(value) {
  if (value >= 0.85) return "Fast";
  if (value >= 0.55) return "Normal";
  if (value >= 0.3) return "Relaxed";
  return "Slow";
}

/**
 * Maps a millisecond auto-forward delay to a compact seconds label.
 *
 * @param {number} value - Auto-forward delay in milliseconds.
 * @returns {string} Seconds label.
 */
export function autoDelayLabel(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

/**
 * Maps a 0..1 volume scalar to a compact percentage label.
 *
 * @param {number} value - Volume scalar.
 * @returns {string} Percentage label.
 */
export function volumeLabel(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Clamps numeric settings to a supported range.
 *
 * @param {unknown} value - Candidate number.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {number} fallback - Fallback when the candidate is invalid.
 * @returns {number} Clamped number.
 */
function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}
