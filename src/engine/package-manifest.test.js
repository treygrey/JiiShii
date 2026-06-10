import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGameManifest,
  classifyPackageFile,
  normalizeGameManifest,
  shouldIgnorePackagePath,
  validateGameManifest
} from "./package-manifest.js";
import { generateGameManifest } from "../../scripts/generate-game-manifest.mjs";

describe("game package manifest", () => {
  it("classifies loose package files by runtime role", () => {
    expect(classifyPackageFile("game.config.js")).toBe("config");
    expect(classifyPackageFile("characters.js")).toBe("characters");
    expect(classifyPackageFile("vn.js")).toBe("authorApi");
    expect(classifyPackageFile("scenes/start.js")).toBe("scene");
    expect(classifyPackageFile("surface-modules/browser.js")).toBe("surfaceModule");
    expect(classifyPackageFile("assets/audio/sfx/tap.wav")).toBe("audio");
    expect(classifyPackageFile("assets/backgrounds/room-day.webp")).toBe("image");
    expect(classifyPackageFile("assets/sprites/alex/default/head.png")).toBe("sprite");
  });

  it("ignores private, example, and generated manifest files", () => {
    expect(shouldIgnorePackagePath("game.manifest.json")).toBe(true);
    expect(shouldIgnorePackagePath("surface-modules/gallery.example.js")).toBe(true);
    expect(shouldIgnorePackagePath("scenes/start.test.js")).toBe(true);
    expect(shouldIgnorePackagePath("scenes/_draft.js")).toBe(true);
    expect(shouldIgnorePackagePath("assets/backgrounds/.gitkeep")).toBe(true);
    expect(shouldIgnorePackagePath("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnorePackagePath("scenes/index.js")).toBe(true);
    expect(shouldIgnorePackagePath("assets.js")).toBe(true);
    expect(shouldIgnorePackagePath("_reference/story-notes.md")).toBe(true);
    expect(shouldIgnorePackagePath("assets/sprites/_default.recipe.js")).toBe(true);
    expect(shouldIgnorePackagePath("scenes/start.js")).toBe(false);
  });

  it("builds and validates a minimal loose package manifest", () => {
    const manifest = buildGameManifest([
      { path: "game.config.js", size: 10, mtime: 100, sha256: "config-hash" },
      { path: "vn.js", size: 20, mtime: 200, sha256: "api-hash" },
      { path: "scenes/start.js", size: 30, mtime: 300, sha256: "scene-hash" },
      { path: "assets/backgrounds/room-day.png", size: 40, mtime: 400 }
    ]);
    const normalized = normalizeGameManifest(manifest);
    const report = validateGameManifest(normalized);

    expect(normalized.entry.config).toBe("game.config.js");
    expect(normalized.entry.scenes).toEqual(["scenes/start.js"]);
    expect(normalized.files["scenes/start.js"].sha256).toBe("scene-hash");
    expect(report.errors).toEqual([]);
  });

  it("warns when entry modules are missing from the file table", () => {
    const manifest = normalizeGameManifest({
      schema: 1,
      mode: "release",
      entry: {
        config: "game.config.js",
        scenes: ["scenes/start.js"],
        surfaceModules: ["surface-modules/browser.js"]
      },
      files: {
        "game.config.js": { kind: "config", size: 10, mtime: 100 },
        "scenes/start.js": { kind: "scene", size: 20, mtime: 200 }
      }
    });
    const report = validateGameManifest(manifest);

    expect(manifest.mode).toBe("release");
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      'game.manifest.json entry "surface-modules/browser.js" is not listed in files.'
    ]);
  });

  it("preserves authored package paths while normalizing separators", () => {
    const manifest = buildGameManifest([
      { path: ".\\scenes\\scene-phone-tour.js", size: 1, mtime: 10, sha256: "scene-hash" },
      { path: "/assets/backgrounds/room-day.png", size: 2, mtime: 20 }
    ]);

    expect(manifest.entry.scenes).toEqual(["scenes/scene-phone-tour.js"]);
    expect(manifest.files["assets/backgrounds/room-day.png"]).toEqual({
      kind: "image",
      size: 2,
      mtime: 20
    });
  });

  it("generates a dev manifest from a package tree", () => {
    const root = mkdtempSync(join(tmpdir(), "jiishii-package-"));
    try {
      mkdirSync(join(root, "scenes"), { recursive: true });
      mkdirSync(join(root, "assets", "audio", "sfx"), { recursive: true });
      writeFileSync(join(root, "game.config.js"), "export const GAME_CONFIG = {};\n");
      writeFileSync(join(root, "vn.js"), "export const scene = globalThis.__JIISHII_AUTHOR_API__.scene;\n");
      writeFileSync(join(root, "scenes", "start.js"), "export default { id: 'start', script: [] };\n");
      writeFileSync(join(root, "assets", "audio", "sfx", "tap.wav"), "");

      const manifest = generateGameManifest({ root, mode: "dev" });
      const written = JSON.parse(readFileSync(join(root, "game.manifest.json"), "utf8"));

      expect(manifest.entry.scenes).toEqual(["scenes/start.js"]);
      expect(manifest.files["game.config.js"].sha256).toEqual(expect.any(String));
      expect(manifest.files["assets/audio/sfx/tap.wav"].sha256).toBeUndefined();
      expect(written.files["vn.js"].kind).toBe("authorApi");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
