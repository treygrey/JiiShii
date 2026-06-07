// =============================================================================
// generate-sprite-manifest.mjs — scans the active game package's sprite folder
// and writes a manifest the game sprite resolver reads at runtime.
//
// Layout it understands, per character folder under src/game/assets/sprites/<id>/:
//   <id>_head.png              (or head_<id>.png)       — head/back layer
//   <id>_foreground_hair.png   (or foreground_hair.png) — optional front hair
//   outfits/<name>.png
//   emotions/<name>.png
//
// Drop a character folder in, run (or just start the dev server) and it's known.
// Run: node scripts/generate-sprite-manifest.mjs   (npm run gen:sprites)
// =============================================================================

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SPRITES_DIR = join(ROOT, "src/game/assets/sprites");
export const OUT_FILE = join(ROOT, "src/game/sprite-manifest.json");

/** Normalizes a name for lookup: lowercase, hyphens → underscores. */
function normalize(name) {
  return String(name).toLowerCase().replace(/-/g, "_");
}

/** Maps each png in a folder by normalized stem → actual filename. */
function indexFolder(dir) {
  const map = {};
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return map;
  }
  for (const file of readdirSync(dir)) {
    if (/\.png$/i.test(file) && statSync(join(dir, file)).isFile()) {
      map[normalize(basename(file, extname(file)))] = file;
    }
  }
  return map;
}

/** Scans game-package sprites into a per-character manifest. */
export function buildSpriteManifest() {
  const manifest = {};
  if (!existsSync(SPRITES_DIR)) {
    return manifest;
  }

  for (const entry of readdirSync(SPRITES_DIR)) {
    const charDir = join(SPRITES_DIR, entry);
    if (!statSync(charDir).isDirectory()) {
      continue;
    }

    let head = null;
    let foreground = null;
    const flatOutfits = {};
    const flatExpressions = {};

    // Top-level files: head, foreground hair, and any flat-prefixed layers.
    for (const file of readdirSync(charDir)) {
      const full = join(charDir, file);
      if (!statSync(full).isFile() || !/\.png$/i.test(file)) {
        continue;
      }
      const stem = basename(file, extname(file));
      if (/foreground/i.test(stem)) {
        foreground = file;
      } else if (/head/i.test(stem)) {
        head = file;
      } else if (/^outfit_/i.test(stem)) {
        flatOutfits[normalize(stem.replace(/^outfit_/i, "").replace(new RegExp(`^${entry}_`, "i"), ""))] = file;
      } else if (/^expression_/i.test(stem)) {
        flatExpressions[normalize(stem.replace(/^expression_/i, "").replace(new RegExp(`^${entry}_`, "i"), ""))] = file;
      }
    }

    const outfits = { ...flatOutfits, ...indexFolder(join(charDir, "outfits")) };
    const expressions = { ...flatExpressions, ...indexFolder(join(charDir, "emotions")) };

    if (head || foreground || Object.keys(outfits).length || Object.keys(expressions).length) {
      manifest[entry] = { head, foreground, outfits, expressions };
    }
  }

  return manifest;
}

/** Writes the manifest to src/game/sprite-manifest.json. */
export function generateSpriteManifest() {
  const manifest = buildSpriteManifest();
  writeFileSync(OUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return OUT_FILE;
}

// CLI.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const path = generateSpriteManifest();
    const manifest = buildSpriteManifest();
    const summary = Object.entries(manifest)
      .map(([id, c]) => `${id}(${Object.keys(c.outfits).length}o/${Object.keys(c.expressions).length}e)`)
      .join(", ");
    console.log(`[sprite-manifest] wrote ${path}: ${summary}`);
  } catch (error) {
    console.error(`[sprite-manifest] failed: ${error.message}`);
    process.exitCode = 1;
  }
}
