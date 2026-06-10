import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { IMAGE_ASSETS } from "../game/assets.js";
import { AUDIO_ASSETS } from "../game/audio.js";
import { installAuthorApiGlobal } from "../player/author-api.js";
import { OUT_FILE, SPRITES_DIR } from "../../scripts/generate-sprite-manifest.mjs";
import { OUT_FILE as ASSET_SUGGESTIONS_FILE } from "../../scripts/generate-asset-suggestions.mjs";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
let GAME_CONFIG = null;
let SCENES = null;

beforeAll(async () => {
  installAuthorApiGlobal();
  GAME_CONFIG = (await import("../game/game.config.js")).GAME_CONFIG;
  SCENES = (await import("../game/scenes/index.js")).SCENES;
});

/**
 * Recursively lists JavaScript source files under a directory.
 *
 * @param {string} directory - Directory to scan.
 * @returns {string[]} Absolute JavaScript file paths.
 */
function listJavaScriptFiles(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      entries.push(...listJavaScriptFiles(path));
    } else if (/\.[cm]?js$/i.test(name) && !/\.(test|spec)\.[cm]?js$/i.test(name)) {
      entries.push(path);
    }
  }
  return entries;
}

/**
 * Normalizes a path for cross-platform substring checks.
 *
 * @param {string} path - Path to normalize.
 * @returns {string} Slash-separated path.
 */
function slash(path) {
  return path.split(sep).join("/");
}

describe("game package structure", () => {
  it("discovers the active game package scenes from src/game", () => {
    expect(GAME_CONFIG.firstSceneId).toBe("scene-phone-tour");
    expect(SCENES[GAME_CONFIG.firstSceneId]).toBeTruthy();
    expect(SCENES.scene_phone_tour).toBeUndefined();
    expect(SCENES["scene-example-basic"]).toBeUndefined();
  });

  it("builds image and audio registries from src/game/assets", () => {
    expect(IMAGE_ASSETS).toEqual(expect.any(Object));
    expect(AUDIO_ASSETS).toEqual(expect.any(Object));
  });

  it("points sprite manifest generation at the active game package", () => {
    expect(slash(relative(PROJECT_ROOT, SPRITES_DIR))).toBe("src/game/assets/sprites");
    expect(slash(relative(PROJECT_ROOT, OUT_FILE))).toBe("src/game/sprite-manifest.json");
    expect(slash(relative(PROJECT_ROOT, ASSET_SUGGESTIONS_FILE))).toBe("src/game/asset-suggestions.json");
  });

  it("keeps engine modules from importing story package files directly", () => {
    const engineFiles = listJavaScriptFiles(join(PROJECT_ROOT, "src", "engine"));
    for (const file of engineFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, slash(relative(PROJECT_ROOT, file))).not.toMatch(/["'](?:\.\.\/)*game\//);
      expect(source, slash(relative(PROJECT_ROOT, file))).not.toMatch(/["'](?:\.\.\/)*content\//);
    }
  });

  it("keeps the starter package template copyable", () => {
    const templateRoot = join(PROJECT_ROOT, "templates", "game-package");
    expect(existsSync(join(templateRoot, "game.config.js"))).toBe(true);
    expect(existsSync(join(templateRoot, "vn.js"))).toBe(true);
    expect(existsSync(join(templateRoot, "sprite-animations.js"))).toBe(true);
    expect(existsSync(join(templateRoot, "sprite-manifest.json"))).toBe(true);
    expect(existsSync(join(templateRoot, "asset-suggestions.json"))).toBe(true);
    expect(readFileSync(join(templateRoot, "scenes", "starter-scene.js"), "utf8")).toContain(
      'from "../vn.js"'
    );
  });
});
