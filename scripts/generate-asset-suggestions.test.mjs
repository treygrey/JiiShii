import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildAssetSuggestions, generateAssetSuggestions } from "./generate-asset-suggestions.mjs";

/**
 * Writes a tiny placeholder file for suggestion-discovery tests.
 *
 * @param {string} path - File path.
 * @returns {void}
 */
function touch(path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "x");
}

/**
 * Creates an isolated fake game assets folder.
 *
 * @returns {string} Assets root path.
 */
function createAssetsDir() {
  return join(tmpdir(), `jiishii-asset-suggestions-${Date.now()}-${Math.random().toString(36).slice(2)}`, "assets");
}

describe("asset suggestion generation", () => {
  it("indexes image, audio, and sprite suggestion ids", () => {
    const assetsDir = createAssetsDir();
    touch(join(assetsDir, "backgrounds", "Room Day.png"));
    touch(join(assetsDir, "gallery", "Room Day.png"));
    touch(join(assetsDir, "audio", "sfx", "Door Slam.ogg"));
    touch(join(assetsDir, "sprites", "alex", "outfits", "casual.png"));
    touch(join(assetsDir, "sprites", "alex", "emotions", "happy.png"));
    touch(join(assetsDir, "sprites", "alex", "bodies", "default.png"));

    const suggestions = buildAssetSuggestions({
      assetsDir,
      spritesDir: join(assetsDir, "sprites")
    });

    expect(suggestions.images.ids).toContain("backgrounds/Room Day");
    expect(suggestions.images.ids).toContain("gallery/Room Day");
    expect(suggestions.images.ids).not.toContain("backgrounds-room-day");
    expect(suggestions.images.ambiguities["Room Day"]).toEqual(["backgrounds/Room Day", "gallery/Room Day"]);
    expect(suggestions.audio.ids).toContain("sfx/Door Slam");
    expect(suggestions.audio.ids).toContain("Door Slam");
    expect(suggestions.audio.ids).not.toContain("door-slam");
    expect(suggestions.sprites.alex).toEqual({
      outfits: ["casual"],
      expressions: ["happy"],
      bodies: ["default"]
    });
  });

  it("writes suggestions for an external game package root", () => {
    const gameDir = join(tmpdir(), `jiishii-game-suggestions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    touch(join(gameDir, "assets", "backgrounds", "Room Day.png"));
    touch(join(gameDir, "assets", "sprites", "alex", "outfits", "casual.png"));

    const outFile = generateAssetSuggestions({ gameDir });
    const suggestions = JSON.parse(readFileSync(outFile, "utf8"));

    expect(outFile).toBe(join(gameDir, "asset-suggestions.json"));
    expect(existsSync(outFile)).toBe(true);
    expect(suggestions.images.ids).toContain("backgrounds/Room Day");
    expect(suggestions.sprites.alex.outfits).toEqual(["casual"]);
  });
});
