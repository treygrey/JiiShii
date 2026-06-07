const DEFAULT_MISSING_TARGET_MESSAGE = (target) => `Next chapter "${target}" is not part of this build yet.`;

export const DEFAULT_GAME_CONFIG = {
  title: "Untitled VN",
  subtitle: "a visual novel",
  footer: "",
  about: "A visual novel built with JiiShii.",
  firstSceneId: null,
  audioScenes: {},
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
    legacySave: null,
    legacyAutosave: null,
    legacySettings: null,
    legacySlotPrefix: null
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

  return {
    title: config.title ?? DEFAULT_GAME_CONFIG.title,
    subtitle: config.subtitle ?? DEFAULT_GAME_CONFIG.subtitle,
    footer: config.footer ?? DEFAULT_GAME_CONFIG.footer,
    about: config.about ?? DEFAULT_GAME_CONFIG.about,
    firstSceneId: config.firstSceneId ?? DEFAULT_GAME_CONFIG.firstSceneId,
    audioScenes: normalizeAudioScenes(config.audioScenes),
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
      save: storage.save ?? DEFAULT_GAME_CONFIG.storage.save,
      autosave: storage.autosave ?? DEFAULT_GAME_CONFIG.storage.autosave,
      settings: storage.settings ?? DEFAULT_GAME_CONFIG.storage.settings,
      slotPrefix: storage.slotPrefix ?? DEFAULT_GAME_CONFIG.storage.slotPrefix,
      legacySave: storage.legacySave ?? DEFAULT_GAME_CONFIG.storage.legacySave,
      legacyAutosave: storage.legacyAutosave ?? DEFAULT_GAME_CONFIG.storage.legacyAutosave,
      legacySettings: storage.legacySettings ?? DEFAULT_GAME_CONFIG.storage.legacySettings,
      legacySlotPrefix: storage.legacySlotPrefix ?? DEFAULT_GAME_CONFIG.storage.legacySlotPrefix
    }
  };
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
