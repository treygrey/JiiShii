import { describe, expect, it } from "vitest";
import { createSaveSlotView, saveSlotClassName } from "./shell-save-slots.js";

describe("shell save slots", () => {
  it("renders empty slot view models", () => {
    expect(createSaveSlotView("Slot 1", null)).toEqual({
      label: "Slot 1",
      scene: "Empty",
      detail: "-",
      date: "-",
      className: "is-empty",
      canOverwrite: false,
      canLoad: false
    });
  });

  it("keeps corrupt saves visible and loadable", () => {
    const view = createSaveSlotView("Slot 2", { corrupted: true });

    expect(view.className).toBe("is-corrupt");
    expect(view.scene).toBe("Unreadable save");
    expect(view.canLoad).toBe(true);
    expect(view.canOverwrite).toBe(true);
  });

  it("formats snapshot and scene-entry metadata", () => {
    const snapshot = createSaveSlotView("Slot 3", {
      kind: "snapshot",
      sceneTitle: "Clubhouse Sunday",
      activeSurface: "irl",
      commandIndex: 42,
      timestamp: new Date("2026-06-06T12:00:00Z").getTime()
    });
    const sceneEntry = createSaveSlotView("Slot 4", {
      kind: "scene-entry",
      sceneId: "scene_001",
      commandIndex: 0
    });

    expect(snapshot.scene).toBe("Clubhouse Sunday");
    expect(snapshot.detail).toBe("Snapshot / irl / #42");
    expect(sceneEntry.scene).toBe("scene_001");
    expect(sceneEntry.detail).toBe("Scene start");
  });

  it("returns slot classes directly", () => {
    expect(saveSlotClassName(null)).toBe("is-empty");
    expect(saveSlotClassName({ corrupted: true })).toBe("is-corrupt");
    expect(saveSlotClassName({ sceneId: "scene" })).toBe("has-data");
  });
});
