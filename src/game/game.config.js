/**
 * Game-level starter configuration. Scenes and surface modules are discovered
 * automatically; this file only pins choices that discovery cannot infer.
 */
export const GAME_CONFIG = {
  title: "JiiShii Starter",
  subtitle: "a surface-driven visual novel",
  footer: "starter game package",
  about:
    "A starter package for JiiShii: IRL staging, texting, streaming, rollback, saves, audio, and modular scene discovery.",
  firstSceneId: "starter_scene",
  audioScenes: {
    quiet_room: {
      music: null,
      ambience: null
    }
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
    missingTargetMessage: (target) => `Next chapter "${target}" is not part of this build yet.`,
    returnToTitleLabel: "Return to title"
  },
  storage: {
    save: "jiishii-starter-save",
    autosave: "jiishii-starter-autosave",
    settings: "jiishii-starter-settings",
    slotPrefix: "jiishii-starter-save-slot-",
    legacySave: "jiishii-legacy-save",
    legacyAutosave: "jiishii-legacy-autosave",
    legacySettings: "jiishii-legacy-settings",
    legacySlotPrefix: "jiishii-legacy-save-"
  }
};
