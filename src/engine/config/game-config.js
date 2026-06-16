const DEFAULT_MISSING_TARGET_MESSAGE = (target) => `Next chapter "${target}" is not part of this build yet.`;

export const DEFAULT_GAME_CONFIG = {
  title: "Untitled VN",
  subtitle: "a visual novel",
  footer: "",
  about: "A visual novel built with JiiShii.",
  firstSceneId: null,
  storageNamespace: null,
  audioScenes: {},
  display: {
    aspectRatio: "16:9",
    aspectRatioValue: 16 / 9,
    narrationMaxChars: 80
  },
  phone: {
    enabled: true,
    button: true,
    apps: ["texting", "calls", "gallery", "social"],
    homeAppOrder: ["texting", "calls", "gallery", "social"],
    defaultWallpaper: null
  },
  shell: {
    saveTitle: "Save Game",
    loadTitle: "Load Game",
    autosaveLabel: "Auto-Save",
    manualSlotCount: 6,
    manualSlotLabel: "Slot",
    preferencesTitle: "Preferences",
    preferencesDefaultsLabel: "Defaults",
    historyTitle: "History",
    historyEmptyLabel: "No dialogue yet.",
    confirmOverwrite: "Overwrite this save slot?",
    confirmLoad: "Load this save and leave the current moment?",
    endKicker: "End of scene",
    endTitle: "To be continued",
    endDefaultMessage: "The scene has ended.",
    missingTargetMessage: DEFAULT_MISSING_TARGET_MESSAGE,
    returnToTitleLabel: "Return to title"
  },
  storage: {
    save: "jiishii-save",
    autosave: "jiishii-autosave",
    settings: "jiishii-settings",
    slotPrefix: "jiishii-save-slot-",
    persistent: "jiishii-persistent",
    legacySave: null,
    legacyAutosave: null,
    legacySettings: null,
    legacySlotPrefix: null
  },
  extras: {
    title: "Extras",
    galleryTitle: "Gallery",
    musicTitle: "Music",
    lockedLabel: "???",
    gallery: [],
    music: []
  }
};

/**
 * Normalizes game-level content configuration into the full shell/runtime
 * contract used by the app entrypoint.
 *
 * @param {object} [config] - Partial config from the active game package.
 * @returns {object} Normalized game config.
 */
export function normalizeGameConfig(config = {}) {
  const shell = config.shell ?? {};
  const storage = config.storage ?? {};
  const storageNamespace = normalizeStorageNamespace(config.storageNamespace);
  const namespaceStorage = storageNamespace ? storageKeysFromNamespace(storageNamespace) : {};

  return {
    title: config.title ?? DEFAULT_GAME_CONFIG.title,
    subtitle: config.subtitle ?? DEFAULT_GAME_CONFIG.subtitle,
    footer: config.footer ?? DEFAULT_GAME_CONFIG.footer,
    about: config.about ?? DEFAULT_GAME_CONFIG.about,
    firstSceneId: config.firstSceneId ?? DEFAULT_GAME_CONFIG.firstSceneId,
    storageNamespace,
    audioScenes: normalizeAudioScenes(config.audioScenes),
    display: normalizeDisplayConfig(config.display),
    phone: normalizePhoneConfig(config.phone),
    shell: {
      saveTitle: shell.saveTitle ?? DEFAULT_GAME_CONFIG.shell.saveTitle,
      loadTitle: shell.loadTitle ?? DEFAULT_GAME_CONFIG.shell.loadTitle,
      autosaveLabel: shell.autosaveLabel ?? DEFAULT_GAME_CONFIG.shell.autosaveLabel,
      manualSlotCount: normalizePositiveInteger(
        shell.manualSlotCount,
        DEFAULT_GAME_CONFIG.shell.manualSlotCount
      ),
      manualSlotLabel: shell.manualSlotLabel ?? DEFAULT_GAME_CONFIG.shell.manualSlotLabel,
      preferencesTitle: shell.preferencesTitle ?? DEFAULT_GAME_CONFIG.shell.preferencesTitle,
      preferencesDefaultsLabel: shell.preferencesDefaultsLabel ?? DEFAULT_GAME_CONFIG.shell.preferencesDefaultsLabel,
      historyTitle: shell.historyTitle ?? DEFAULT_GAME_CONFIG.shell.historyTitle,
      historyEmptyLabel: shell.historyEmptyLabel ?? DEFAULT_GAME_CONFIG.shell.historyEmptyLabel,
      confirmOverwrite: shell.confirmOverwrite ?? DEFAULT_GAME_CONFIG.shell.confirmOverwrite,
      confirmLoad: shell.confirmLoad ?? DEFAULT_GAME_CONFIG.shell.confirmLoad,
      endKicker: shell.endKicker ?? DEFAULT_GAME_CONFIG.shell.endKicker,
      endTitle: shell.endTitle ?? DEFAULT_GAME_CONFIG.shell.endTitle,
      endDefaultMessage: shell.endDefaultMessage ?? DEFAULT_GAME_CONFIG.shell.endDefaultMessage,
      missingTargetMessage: typeof shell.missingTargetMessage === "function"
        ? shell.missingTargetMessage
        : DEFAULT_GAME_CONFIG.shell.missingTargetMessage,
      returnToTitleLabel: shell.returnToTitleLabel ?? DEFAULT_GAME_CONFIG.shell.returnToTitleLabel
    },
    storage: {
      save: storage.save ?? namespaceStorage.save ?? DEFAULT_GAME_CONFIG.storage.save,
      autosave: storage.autosave ?? namespaceStorage.autosave ?? DEFAULT_GAME_CONFIG.storage.autosave,
      settings: storage.settings ?? namespaceStorage.settings ?? DEFAULT_GAME_CONFIG.storage.settings,
      slotPrefix: storage.slotPrefix ?? namespaceStorage.slotPrefix ?? DEFAULT_GAME_CONFIG.storage.slotPrefix,
      persistent: storage.persistent ?? namespaceStorage.persistent ?? DEFAULT_GAME_CONFIG.storage.persistent,
      legacySave: storage.legacySave ?? DEFAULT_GAME_CONFIG.storage.legacySave,
      legacyAutosave: storage.legacyAutosave ?? DEFAULT_GAME_CONFIG.storage.legacyAutosave,
      legacySettings: storage.legacySettings ?? DEFAULT_GAME_CONFIG.storage.legacySettings,
      legacySlotPrefix: storage.legacySlotPrefix ?? DEFAULT_GAME_CONFIG.storage.legacySlotPrefix
    },
    extras: normalizeExtras(config.extras)
  };
}

/**
 * Normalizes author-controlled display constraints.
 *
 * @param {unknown} display - Candidate display config.
 * @returns {{ aspectRatio: string, aspectRatioValue: number|null, narrationMaxChars: number }} Display config.
 */
function normalizeDisplayConfig(display) {
  const source = display && typeof display === "object" && !Array.isArray(display) ? display : {};
  const aspect = normalizeAspectRatio(source.aspectRatio, DEFAULT_GAME_CONFIG.display.aspectRatio);
  return {
    aspectRatio: aspect.label,
    aspectRatioValue: aspect.value,
    narrationMaxChars: normalizePositiveInteger(
      source.narrationMaxChars,
      DEFAULT_GAME_CONFIG.display.narrationMaxChars
    )
  };
}

/**
 * Normalizes aspect ratio strings such as "16:9", "4/3", or "free".
 *
 * @param {unknown} value - Candidate aspect ratio.
 * @param {string} fallback - Fallback aspect ratio.
 * @returns {{ label: string, value: number|null }} Ratio label and numeric value.
 */
function normalizeAspectRatio(value, fallback) {
  const text = typeof value === "string" && value.trim() ? value.trim().toLowerCase() : fallback;
  if (text === "free" || text === "fluid" || text === "responsive") {
    return { label: "free", value: null };
  }
  const match = text.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { label: `${trimRatioNumber(width)}:${trimRatioNumber(height)}`, value: width / height };
    }
  }
  if (text !== fallback) {
    return normalizeAspectRatio(fallback, DEFAULT_GAME_CONFIG.display.aspectRatio);
  }
  return { label: "16:9", value: 16 / 9 };
}

/**
 * Formats an aspect ratio component without unnecessary trailing decimals.
 *
 * @param {number} value - Ratio component.
 * @returns {string} Compact component.
 */
function trimRatioNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * Normalizes the optional storage namespace shortcut.
 *
 * @param {unknown} value - Candidate namespace.
 * @returns {string|null} Trimmed namespace or null.
 */
function normalizeStorageNamespace(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Creates default storage keys from a game-specific namespace.
 *
 * @param {string} namespace - Game storage namespace.
 * @returns {object} Derived storage keys.
 */
function storageKeysFromNamespace(namespace) {
  return {
    save: `${namespace}-save`,
    autosave: `${namespace}-autosave`,
    settings: `${namespace}-settings`,
    slotPrefix: `${namespace}-save-slot-`,
    persistent: `${namespace}-persistent`
  };
}

/**
 * Normalizes the extras (gallery/music room) configuration. Entries name
 * discovered asset ids; the shell shows them locked until the persistent
 * unlock record contains the id.
 *
 * @param {unknown} extras - Candidate extras config.
 * @returns {object} Normalized extras config.
 */
function normalizeExtras(extras) {
  const source = extras && typeof extras === "object" ? extras : {};
  const defaults = DEFAULT_GAME_CONFIG.extras;
  return {
    title: typeof source.title === "string" && source.title.trim() ? source.title : defaults.title,
    galleryTitle: typeof source.galleryTitle === "string" && source.galleryTitle.trim()
      ? source.galleryTitle
      : defaults.galleryTitle,
    musicTitle: typeof source.musicTitle === "string" && source.musicTitle.trim()
      ? source.musicTitle
      : defaults.musicTitle,
    lockedLabel: typeof source.lockedLabel === "string" && source.lockedLabel.trim()
      ? source.lockedLabel
      : defaults.lockedLabel,
    gallery: normalizeExtrasEntries(source.gallery),
    music: normalizeExtrasEntries(source.music)
  };
}

/**
 * Normalizes one extras entry list to `{ id, title }` records.
 *
 * @param {unknown} entries - Candidate entry list.
 * @returns {Array<{ id: string, title: string }>} Normalized entries.
 */
function normalizeExtrasEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => {
      if (typeof entry === "string") {
        return { id: entry, title: entry };
      }
      if (entry && typeof entry === "object" && typeof entry.id === "string" && entry.id) {
        return { id: entry.id, title: typeof entry.title === "string" && entry.title ? entry.title : entry.id };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Normalizes optional phone system configuration.
 *
 * @param {unknown} phone - Candidate phone config.
 * @returns {object} Normalized phone config.
 */
function normalizePhoneConfig(phone) {
  const source = phone && typeof phone === "object" && !Array.isArray(phone) ? phone : {};
  const apps = normalizeStringList(source.apps, DEFAULT_GAME_CONFIG.phone.apps);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_GAME_CONFIG.phone.enabled,
    button: typeof source.button === "boolean" ? source.button : DEFAULT_GAME_CONFIG.phone.button,
    apps,
    homeAppOrder: normalizeStringList(source.homeAppOrder, apps),
    defaultWallpaper: typeof source.defaultWallpaper === "string" ? source.defaultWallpaper : null
  };
}

/**
 * Normalizes a string list with a fallback.
 *
 * @param {unknown} value - Candidate list.
 * @param {string[]} fallback - Fallback list.
 * @returns {string[]} Normalized list.
 */
function normalizeStringList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  return [...new Set(list.filter((entry) => typeof entry === "string" && entry.trim()))];
}

/**
 * Normalizes reusable audio-scene preset definitions.
 *
 * @param {unknown} audioScenes - Candidate registry.
 * @returns {Record<string, object>} Audio scene registry.
 */
function normalizeAudioScenes(audioScenes) {
  if (!audioScenes || typeof audioScenes !== "object" || Array.isArray(audioScenes)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(audioScenes).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
  );
}

/**
 * Normalizes a positive integer with a fallback.
 *
 * @param {unknown} value - Candidate value.
 * @param {number} fallback - Fallback value.
 * @returns {number} Positive integer.
 */
function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.floor(numeric);
}
