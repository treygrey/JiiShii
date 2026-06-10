import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSpriteManifest, generateSpriteManifest } from "./generate-sprite-manifest.mjs";

/**
 * Writes a tiny placeholder file for manifest-discovery tests.
 *
 * @param {string} path - File path.
 * @returns {void}
 */
function touch(path) {
  writeFileSync(path, "", "utf8");
}

describe("sprite manifest generation", () => {
  it("discovers recipe layers and character-local recipes", () => {
    const spritesDir = mkdtempSync(join(tmpdir(), "jiishii-sprites-"));
    const alexDir = join(spritesDir, "alex");
    mkdirSync(join(alexDir, "bodies"), { recursive: true });
    mkdirSync(join(alexDir, "heads"), { recursive: true });
    mkdirSync(join(alexDir, "outfits"), { recursive: true });
    mkdirSync(join(alexDir, "emotions"), { recursive: true });
    mkdirSync(join(alexDir, "overlays"), { recursive: true });
    mkdirSync(join(alexDir, "foreground"), { recursive: true });

    touch(join(alexDir, "bodies", "default.png"));
    touch(join(alexDir, "heads", "head.png"));
    touch(join(alexDir, "outfits", "Casual-Hoodie.png"));
    touch(join(alexDir, "emotions", "Neutral Smile.png"));
    touch(join(alexDir, "overlays", "tattoo.png"));
    touch(join(alexDir, "foreground", "hair.png"));
    writeFileSync(join(alexDir, "sprite.recipe.js"), "export default [];\n", "utf8");

    const manifest = buildSpriteManifest({ spritesDir });

    expect(manifest.alex.recipe).toBe("character");
    expect(manifest.alex.layers).toEqual({
      heads: { head: "head.png" },
      bodies: { default: "default.png" },
      outfits: { "Casual-Hoodie": "Casual-Hoodie.png" },
      emotions: { "Neutral Smile": "Neutral Smile.png" },
      overlays: { tattoo: "tattoo.png" },
      foreground: { hair: "hair.png" }
    });
  });

  it("maps legacy top-level head and foreground files into recipe layers", () => {
    const spritesDir = mkdtempSync(join(tmpdir(), "jiishii-sprites-"));
    const alexDir = join(spritesDir, "alex");
    mkdirSync(alexDir, { recursive: true });
    touch(join(alexDir, "alex_head.png"));
    touch(join(alexDir, "foreground_hair.png"));

    const manifest = buildSpriteManifest({ spritesDir });

    expect(manifest.alex.recipe).toBe("default");
    expect(manifest.alex.layers.heads).toEqual({ head: "alex_head.png" });
    expect(manifest.alex.layers.bodies).toEqual({ default: "alex_head.png" });
    expect(manifest.alex.layers.foreground).toEqual({ hair: "foreground_hair.png" });
  });

  it("writes a manifest for an external game package root", () => {
    const gameDir = mkdtempSync(join(tmpdir(), "jiishii-game-root-"));
    const alexDir = join(gameDir, "assets", "sprites", "alex", "outfits");
    mkdirSync(alexDir, { recursive: true });
    touch(join(alexDir, "Casual-Hoodie.png"));

    const outFile = generateSpriteManifest({ gameDir });
    const manifest = JSON.parse(readFileSync(outFile, "utf8"));

    expect(outFile).toBe(join(gameDir, "sprite-manifest.json"));
    expect(existsSync(outFile)).toBe(true);
    expect(manifest.alex.outfits).toEqual({ "Casual-Hoodie": "Casual-Hoodie.png" });
  });
});
