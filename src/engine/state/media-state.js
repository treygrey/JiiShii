export const MEDIA_KINDS = ["image", "video"];
export const MEDIA_FITS = ["cover", "contain", "fill", "none", "scale-down"];
export const MEDIA_LAYERS = ["background", "behind", "characters", "front", "cg", "overlay"];
export const VIDEO_MODES = ["replace", "hold", "loop"];

const DEFAULT_ALPHA = 1;
const DEFAULT_SCALE = 1;

/**
 * Returns true when a value is a finite number.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True for finite numbers.
 */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Clamps a numeric value into a range.
 *
 * @param {number} value - Value to clamp.
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @returns {number} Clamped value.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Preserves finite millisecond values and drops invalid timings.
 *
 * @param {unknown} value - Candidate time value.
 * @returns {number|null} Normalized milliseconds.
 */
function normalizeOptionalTime(value) {
  return isFiniteNumber(value) && value >= 0 ? value : null;
}

/**
 * Normalizes a media kind.
 *
 * @param {unknown} kind - Candidate kind.
 * @returns {"image"|"video"} Media kind.
 */
export function normalizeMediaKind(kind) {
  return kind === "video" ? "video" : "image";
}

/**
 * Normalizes a media layer into the semantic layer set.
 *
 * @param {unknown} layer - Candidate layer.
 * @param {string} [fallback] - Fallback layer.
 * @returns {string} Normalized layer.
 */
export function normalizeMediaLayer(layer, fallback = "front") {
  if (layer === "foreground") {
    return "front";
  }
  return MEDIA_LAYERS.includes(layer) ? layer : fallback;
}

/**
 * Normalizes object-fit values used by image and video media.
 *
 * @param {unknown} fit - Candidate fit.
 * @param {string} [fallback] - Fallback fit.
 * @returns {string} Normalized fit.
 */
export function normalizeMediaFit(fit, fallback = "contain") {
  return MEDIA_FITS.includes(fit) ? fit : fallback;
}

/**
 * Normalizes stream/fullscreen video end behavior.
 *
 * @param {unknown} mode - Candidate mode.
 * @param {string} [fallback] - Fallback mode.
 * @returns {string} Normalized mode.
 */
export function normalizeVideoMode(mode, fallback = "hold") {
  return VIDEO_MODES.includes(mode) ? mode : fallback;
}

/**
 * Normalizes one serializable image/video displayable.
 *
 * @param {object} media - Raw media command or saved state.
 * @param {object} [defaults] - Defaults applied before field normalization.
 * @returns {object} Normalized media entry.
 */
export function normalizeMediaEntry(media = {}, defaults = {}) {
  const kind = normalizeMediaKind(media.kind ?? defaults.kind);
  const role = media.role ?? defaults.role ?? null;
  const defaultLayer = role === "background"
    ? "background"
    : kind === "image" && (media.kind ?? defaults.kind) === "cg"
      ? "cg"
      : defaults.layer ?? "front";
  const layer = normalizeMediaLayer(media.layer ?? defaultLayer, defaultLayer);
  const defaultFit = layer === "background" || layer === "cg" ? "cover" : defaults.fit ?? "contain";
  const alpha = isFiniteNumber(media.alpha) ? clamp(media.alpha, 0, 1) : defaults.alpha ?? DEFAULT_ALPHA;
  const scale = isFiniteNumber(media.scale) ? media.scale : defaults.scale ?? DEFAULT_SCALE;
  const mode = normalizeVideoMode(media.mode ?? defaults.mode, kind === "video" && media.loop ? "loop" : "hold");
  const asset = media.asset ?? media.image ?? media.id ?? defaults.asset ?? null;
  const id = media.id ?? defaults.id ?? (role === "background" ? "__background" : asset);

  return {
    id,
    kind,
    asset,
    role,
    layer,
    fit: normalizeMediaFit(media.fit ?? defaults.fit, defaultFit),
    position: media.position ?? defaults.position ?? "center",
    at: media.at ?? defaults.at ?? null,
    x: media.x ?? defaults.x ?? null,
    y: media.y ?? defaults.y ?? null,
    width: media.width ?? defaults.width ?? null,
    height: media.height ?? defaults.height ?? null,
    scale,
    alpha,
    z: media.z ?? defaults.z ?? null,
    crop: media.crop ?? defaults.crop ?? null,
    transition: media.transition ?? defaults.transition ?? null,
    duration: media.duration ?? defaults.duration ?? null,
    easing: media.easing ?? defaults.easing ?? null,
    startAt: normalizeOptionalTime(media.startAt ?? defaults.startAt),
    endAt: normalizeOptionalTime(media.endAt ?? defaults.endAt),
    loop: mode === "loop" || media.loop === true || defaults.loop === true,
    volume: isFiniteNumber(media.volume) ? clamp(media.volume, 0, 1) : defaults.volume ?? 1,
    muted: media.muted ?? defaults.muted ?? false,
    mode,
    endImage: media.endImage ?? media.image ?? defaults.endImage ?? null
  };
}

/**
 * Builds a reserved background media entry.
 *
 * @param {object} command - Background command or saved state.
 * @returns {object|null} Background media entry.
 */
export function normalizeBackgroundMedia(command) {
  if (!command) {
    return null;
  }
  return normalizeMediaEntry({
    ...command,
    id: "__background",
    asset: command.asset ?? command.id,
    kind: "image",
    role: "background",
    layer: "background",
    fit: command.fit ?? "cover",
    position: command.position ?? "center"
  });
}

/**
 * Builds a stream-window media entry from a stream image/video command.
 *
 * @param {object} command - Stream media command.
 * @param {object} [defaults] - Defaults for the stream window.
 * @returns {object} Stream media entry.
 */
export function normalizeStreamMedia(command, defaults = {}) {
  return normalizeMediaEntry(command, {
    id: "__stream_window",
    role: "streamWindow",
    layer: "overlay",
    fit: "cover",
    muted: true,
    ...defaults
  });
}

/**
 * Applies transform fields from a partial update to an existing media entry.
 *
 * @param {object} media - Existing media entry.
 * @param {object} transform - Partial transform fields.
 * @returns {object} Updated media entry.
 */
export function applyMediaTransform(media, transform = {}) {
  return normalizeMediaEntry({
    ...media,
    ...Object.fromEntries(
      Object.entries(transform).filter(([, value]) => value !== undefined)
    )
  }, media);
}
