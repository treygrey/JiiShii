// =============================================================================
// generate-sprite-manifest.mjs - scans the active game package's sprite folder
// and writes a manifest the game sprite resolver reads at runtime.
//
// Layout it understands, per character folder under src/game/assets/sprites/<id>/:
//   heads/<name>.png
//   bodies/<name>.png
//   outfits/<name>.png
//   emotions/<name>.png
//   overlays/<name>.png
//   foreground/<name>.png
//   sprite.recipe.js          - optional character-local recipe override
//
// Compatibility:
//   <id>_head.png              (or head_<id>.png)       - indexed as heads/head and bodies/default
//   <id>_foreground_hair.png   (or foreground_hair.png) - indexed as foreground/hair
//
// Drop a character folder in, run (or just start the dev server) and it's known.
// Run: node scripts/generate-sprite-manifest.mjs   (npm run gen:sprites)
// =============================================================================

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GAME_DIR = join(ROOT, "src/game");
export const SPRITES_DIR = join(GAME_DIR, "assets/sprites");
export const OUT_FILE = join(GAME_DIR, "sprite-manifest.json");

/**
 * Reads a string CLI option from process arguments.
 *
 * @param {string[]} args - Raw CLI arguments.
 * @param {string} name - Option name without leading dashes.
 * @returns {string|null} Option value, or null when absent.
 */
function readCliOption(args, name) {
  const inlinePrefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length);
  }
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

/**
 * Resolves generator paths from a game package root.
 *
 * @param {string} gameDir - Game package root.
 * @returns {{ spritesDir: string, outFile: string }} Resolved paths.
 */
export function resolveSpriteManifestPaths(gameDir = GAME_DIR) {
  return {
    spritesDir: join(gameDir, "assets/sprites"),
    outFile: join(gameDir, "sprite-manifest.json")
  };
}

/**
 * Reads file stats without letting stale filesystem entries abort discovery.
 *
 * @param {string} path - Filesystem path.
 * @returns {import("node:fs").Stats|null} File stats, or null when unavailable.
 */
function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/**
 * Maps each png in a folder by exact extensionless stem to actual filename.
 *
 * @param {string} dir - Folder to scan.
 * @returns {Record<string, string>} Exact stem to filename.
 */
function indexFolder(dir) {
  const map = {};
  if (!existsSync(dir) || !safeStat(dir)?.isDirectory()) {
    return map;
  }
  for (const file of readdirSync(dir)) {
    if (/\.png$/i.test(file) && safeStat(join(dir, file))?.isFile()) {
      map[basename(file, extname(file))] = file;
    }
  }
  return map;
}

/**
 * Detects a character-local sprite recipe file.
 *
 * @param {string} dir - Character sprite folder.
 * @returns {boolean} True when a character recipe exists.
 */
function hasCharacterRecipe(dir) {
  return existsSync(join(dir, "sprite.recipe.js"));
}

/**
 * Scans game-package sprites into a per-character manifest.
 *
 * @param {object} [options] - Manifest options.
 * @param {string} [options.spritesDir] - Sprite root override for tests/tools.
 * @returns {Record<string, object>} Sprite manifest.
 */
export function buildSpriteManifest({ spritesDir = SPRITES_DIR } = {}) {
  const manifest = {};
  if (!existsSync(spritesDir)) {
    return manifest;
  }

  for (const entry of readdirSync(spritesDir)) {
    const charDir = join(spritesDir, entry);
    if (!safeStat(charDir)?.isDirectory()) {
      continue;
    }

    const flatHeads = {};
    const flatBodies = {};
    const flatForeground = {};
    const flatOutfits = {};
    const flatExpressions = {};

    // Top-level compatibility files: legacy head, foreground hair, and any
    // flat-prefixed outfit/expression layers.
    for (const file of readdirSync(charDir)) {
      const full = join(charDir, file);
      if (!safeStat(full)?.isFile() || !/\.png$/i.test(file)) {
        continue;
      }
      const stem = basename(file, extname(file));
      if (/foreground/i.test(stem)) {
        flatForeground.hair = file;
      } else if (/head/i.test(stem)) {
        flatHeads.head = file;
        flatBodies.default = file;
      } else if (/^outfit_/i.test(stem)) {
        flatOutfits[stem.replace(/^outfit_/i, "").replace(new RegExp(`^${entry}_`, "i"), "")] = file;
      } else if (/^expression_/i.test(stem)) {
        flatExpressions[stem.replace(/^expression_/i, "").replace(new RegExp(`^${entry}_`, "i"), "")] = file;
      }
    }

    const heads = { ...flatHeads, ...indexFolder(join(charDir, "heads")) };
    const bodies = { ...flatBodies, ...indexFolder(join(charDir, "bodies")) };
    const outfits = { ...flatOutfits, ...indexFolder(join(charDir, "outfits")) };
    const expressions = { ...flatExpressions, ...indexFolder(join(charDir, "emotions")) };
    const overlays = indexFolder(join(charDir, "overlays"));
    const foreground = { ...flatForeground, ...indexFolder(join(charDir, "foreground")) };
    const layers = { heads, bodies, outfits, emotions: expressions, overlays, foreground };
    const hasRecipe = hasCharacterRecipe(charDir);

    if (
      hasRecipe ||
      Object.values(layers).some((layerMap) => Object.keys(layerMap).length > 0)
    ) {
      manifest[entry] = {
        recipe: hasRecipe ? "character" : "default",
        layers,
        outfits,
        expressions
      };
    }
  }

  return manifest;
}

/**
 * Writes the manifest to a game package's sprite-manifest.json.
 *
 * @param {object} [options] - Generator options.
 * @param {string} [options.gameDir] - Game package root override.
 * @param {string} [options.spritesDir] - Sprite root override.
 * @param {string} [options.outFile] - Output file override.
 * @returns {string} Output path.
 */
export function generateSpriteManifest({ gameDir = GAME_DIR, spritesDir, outFile } = {}) {
  const paths = resolveSpriteManifestPaths(gameDir);
  const resolvedSpritesDir = spritesDir ?? paths.spritesDir;
  const resolvedOutFile = outFile ?? paths.outFile;
  const spriteManifest = buildSpriteManifest({ spritesDir: resolvedSpritesDir });
  writeFileSync(resolvedOutFile, `${JSON.stringify(spriteManifest, null, 2)}\n`, "utf8");
  return resolvedOutFile;
}

// CLI.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const gameDir = readCliOption(process.argv.slice(2), "root") ?? GAME_DIR;
    const { spritesDir } = resolveSpriteManifestPaths(gameDir);
    const path = generateSpriteManifest({ gameDir });
    const spriteManifest = buildSpriteManifest({ spritesDir });
    const summary = Object.entries(spriteManifest)
      .map(([id, character]) => `${id}(${Object.keys(character.outfits).length}o/${Object.keys(character.expressions).length}e)`)
      .join(", ");
    console.log(`[sprite-manifest] wrote ${path}: ${summary}`);
  } catch (error) {
    console.error(`[sprite-manifest] failed: ${error.message}`);
    process.exitCode = 1;
  }
}
