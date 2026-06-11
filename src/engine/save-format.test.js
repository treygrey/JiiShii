import { describe, expect, it } from "vitest";
import {
  migrateSaveEnvelope,
  parseSaveEnvelope,
  SAVE_KIND_SCENE_ENTRY,
  SAVE_KIND_SNAPSHOT,
  SAVE_SCHEMA_VERSION
} from "./save-format.js";
import { createSurfaceRegistry } from "./surfaces/index.js";

/**
 * Creates the standard test surface registry for save migration coverage.
 *
 * @returns {object} Surface registry.
 */
function makeRegistry() {
  return createSurfaceRegistry();
}

describe("save format migration", () => {
  it("migrates legacy scene-entry saves into the current envelope shape", () => {
    const migrated = migrateSaveEnvelope({
      sceneId: "legacy_scene",
      currentCommandIndex: 7,
      currentSurface: "irl",
      vars: { trust: 3 },
      rng: 123,
      timestamp: 456
    }, makeRegistry());

    expect(migrated).toMatchObject({
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: SAVE_KIND_SCENE_ENTRY,
      state: expect.objectContaining({
        currentSceneId: "legacy_scene",
        currentCommandIndex: 7,
        currentSurface: "irl",
        vars: { trust: 3 },
        rng: 123
      }),
      metadata: expect.objectContaining({
        timestamp: 456,
        kind: SAVE_KIND_SCENE_ENTRY,
        sceneId: "legacy_scene",
        commandIndex: 7,
        activeSurface: "irl"
      })
    });
  });

  it("normalizes current snapshot envelopes while preserving metadata", () => {
    const migrated = migrateSaveEnvelope({
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: SAVE_KIND_SNAPSHOT,
      state: {
        currentSceneId: "tour_scene",
        currentCommandIndex: 12,
        currentSurface: "phone_home",
        vars: { followed: true },
        visuals: {
          phone: {
            wallpaperImage: "tour_wallpaper"
          }
        }
      },
      metadata: {
        label: "Slot 1",
        timestamp: 789
      }
    }, makeRegistry());

    expect(migrated.kind).toBe(SAVE_KIND_SNAPSHOT);
    expect(migrated.metadata).toEqual(expect.objectContaining({
      label: "Slot 1",
      timestamp: 789,
      kind: SAVE_KIND_SNAPSHOT,
      sceneId: "tour_scene",
      commandIndex: 12,
      activeSurface: "phone_home"
    }));
    expect(migrated.state.visuals.phone.wallpaperImage).toBe("tour_wallpaper");
  });

  it("rejects unreadable serialized saves", () => {
    expect(() => parseSaveEnvelope("{bad json", makeRegistry())).toThrow();
  });
});
