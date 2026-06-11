import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG, normalizeGameConfig } from "./config/game-config.js";

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
      firstSceneId: "scene-one",
      storageNamespace: "example-game",
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
        persistent: "example-persistent",
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
    expect(config.shell.missingTargetMessage("scene-two")).toBe("Missing scene-two");
    expect(config.storage.slotPrefix).toBe("example-slot-");
    expect(config.storage.persistent).toBe("example-persistent");
    expect(config.storage.legacySettings).toBe("old-settings");
  });

  it("derives storage keys from storageNamespace when explicit keys are omitted", () => {
    const first = normalizeGameConfig({ storageNamespace: "first-game" });
    const second = normalizeGameConfig({ storageNamespace: "second-game" });

    expect(first.storage).toMatchObject({
      save: "first-game-save",
      autosave: "first-game-autosave",
      settings: "first-game-settings",
      slotPrefix: "first-game-save-slot-",
      persistent: "first-game-persistent"
    });
    expect(second.storage.persistent).toBe("second-game-persistent");
  });

  it("lets explicit storage keys override storageNamespace defaults", () => {
    const config = normalizeGameConfig({
      storageNamespace: "example-game",
      storage: {
        save: "custom-save",
        persistent: "custom-persistent"
      }
    });

    expect(config.storage.save).toBe("custom-save");
    expect(config.storage.autosave).toBe("example-game-autosave");
    expect(config.storage.persistent).toBe("custom-persistent");
  });

  it("normalizes invalid manual slot counts", () => {
    expect(normalizeGameConfig({ shell: { manualSlotCount: 0 } }).shell.manualSlotCount).toBe(6);
    expect(normalizeGameConfig({ shell: { manualSlotCount: "3.9" } }).shell.manualSlotCount).toBe(3);
  });

  it("normalizes display aspect ratio and narration width controls", () => {
    expect(normalizeGameConfig({}).display).toEqual({
      aspectRatio: "16:9",
      aspectRatioValue: 16 / 9,
      narrationMaxChars: 80
    });
    expect(normalizeGameConfig({
      display: {
        aspectRatio: "4/3",
        narrationMaxChars: "96"
      }
    }).display).toEqual({
      aspectRatio: "4:3",
      aspectRatioValue: 4 / 3,
      narrationMaxChars: 96
    });
    expect(normalizeGameConfig({ display: { aspectRatio: "free" } }).display.aspectRatioValue).toBeNull();
    expect(normalizeGameConfig({ display: { aspectRatio: "nonsense" } }).display.aspectRatio).toBe("16:9");
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
