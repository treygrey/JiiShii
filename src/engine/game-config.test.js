import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG, normalizeGameConfig } from "./game-config.js";

describe("game config normalization", () => {
  it("fills shell and storage defaults for a minimal game config", () => {
    const config = normalizeGameConfig({});

    expect(config).toEqual(DEFAULT_GAME_CONFIG);
    expect(config.shell.missingTargetMessage("scene_2")).toBe(
      'Next chapter "scene_2" is not part of this build yet.'
    );
  });

  it("preserves configured shell copy and storage namespaces", () => {
    const missingTargetMessage = (target) => `Missing ${target}`;
    const config = normalizeGameConfig({
      title: "Example",
      subtitle: "a mystery",
      footer: "dev build",
      about: "About text.",
      firstSceneId: "scene_one",
      shell: {
        saveTitle: "Bookmark",
        loadTitle: "Resume",
        autosaveLabel: "Recent",
        manualSlotCount: 4,
        manualSlotLabel: "File",
        preferencesTitle: "Options",
        preferencesDefaultsLabel: "Reset",
        historyTitle: "Backlog",
        historyEmptyLabel: "Nothing read.",
        confirmOverwrite: "Replace file?",
        confirmLoad: "Resume file?",
        endKicker: "Chapter complete",
        endTitle: "Night",
        endDefaultMessage: "Done.",
        missingTargetMessage,
        returnToTitleLabel: "Title"
      },
      storage: {
        save: "example-save",
        autosave: "example-auto",
        settings: "example-settings",
        slotPrefix: "example-slot-",
        legacySave: "old-save",
        legacyAutosave: "old-auto",
        legacySettings: "old-settings",
        legacySlotPrefix: "old-slot-"
      }
    });

    expect(config.title).toBe("Example");
    expect(config.shell.saveTitle).toBe("Bookmark");
    expect(config.shell.manualSlotCount).toBe(4);
    expect(config.shell.preferencesTitle).toBe("Options");
    expect(config.shell.confirmLoad).toBe("Resume file?");
    expect(config.shell.missingTargetMessage("scene_two")).toBe("Missing scene_two");
    expect(config.storage.slotPrefix).toBe("example-slot-");
    expect(config.storage.legacySettings).toBe("old-settings");
  });

  it("normalizes invalid manual slot counts", () => {
    expect(normalizeGameConfig({ shell: { manualSlotCount: 0 } }).shell.manualSlotCount).toBe(6);
    expect(normalizeGameConfig({ shell: { manualSlotCount: "3.9" } }).shell.manualSlotCount).toBe(3);
  });

  it("falls back when missing-target copy is not a function", () => {
    const config = normalizeGameConfig({
      shell: {
        missingTargetMessage: "not callable"
      }
    });

    expect(config.shell.missingTargetMessage("scene_x")).toBe(
      'Next chapter "scene_x" is not part of this build yet.'
    );
  });
});
