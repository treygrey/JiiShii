// =============================================================================
// generate-asset-suggestions.mjs - scans the active game package and writes a
// compact authoring index for validator messages, docs, and future editor tools.
//
// Run: node scripts/generate-asset-suggestions.mjs
// =============================================================================

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  audioIdsFromPath,
  buildAssetDiscovery,
  imageIdsFromPath
} from "../src/engine/assets/asset-discovery.js";
import { buildSpriteManifest } from "./generate-sprite-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GAME_DIR = join(ROOT, "src/game");
export const ASSETS_DIR = join(GAME_DIR, "assets");
export const OUT_FILE = join(GAME_DIR, "asset-suggestions.json");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac"]);

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
 * @returns {{ assetsDir: string, spritesDir: string, outFile: string }} Resolved paths.
 */
export function resolveAssetSuggestionPaths(gameDir = GAME_DIR) {
  const assetsDir = join(gameDir, "assets");
  return {
    assetsDir,
    spritesDir: join(assetsDir, "sprites"),
    outFile: join(gameDir, "asset-suggestions.json")
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
 * Reports whether an asset path should be omitted from author suggestions.
 *
 * @param {string} path - Filesystem path.
 * @returns {boolean} True when the file should not be suggested.
 */
function shouldSkip(path) {
  const normalized = path.replaceAll("\\", "/");
  const filename = basename(path);
  return normalized.includes("/assets/sprites/") || /old\.[^.]+$/i.test(filename);
}

/**
 * Recursively lists files under a directory.
 *
 * @param {string} dir - Directory to scan.
 * @returns {string[]} Absolute file paths.
 */
function listFiles(dir) {
  if (!existsSync(dir) || !safeStat(dir)?.isDirectory()) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = safeStat(path);
    if (!stats) {
      continue;
    }
    if (stats.isDirectory()) {
      files.push(...listFiles(path));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Converts a filesystem path to the Vite-style path asset discovery expects.
 *
 * @param {string} file - Absolute file path.
 * @returns {string} Slash-separated path beginning with ./assets/.
 */
function toAssetModulePath(file, gameDir = GAME_DIR) {
  return `./${relative(gameDir, file).replaceAll("\\", "/")}`;
}

/**
 * Builds a fake Vite module map from files matching the requested extensions.
 *
 * @param {Set<string>} extensions - File extensions to include.
 * @param {object} [options] - Scan options.
 * @param {string} [options.assetsDir] - Asset root override.
 * @returns {Record<string, string>} Module path to URL-ish path.
 */
function buildModuleMap(extensions, { assetsDir = ASSETS_DIR } = {}) {
  const modules = {};
  const gameDir = dirname(assetsDir);
  for (const file of listFiles(assetsDir)) {
    if (shouldSkip(file) || !extensions.has(extname(file).toLowerCase())) {
      continue;
    }
    const modulePath = toAssetModulePath(file, gameDir);
    modules[modulePath] = modulePath;
  }
  return modules;
}

/**
 * Sorts object keys recursively enough for stable JSON output.
 *
 * @param {Record<string, unknown>} value - Object to sort.
 * @returns {Record<string, unknown>} Sorted object.
 */
function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, Array.isArray(entry) ? [...entry].sort() : entry])
  );
}

/**
 * Builds the complete author suggestion index.
 *
 * @param {object} [options] - Generator options.
 * @param {string} [options.assetsDir] - Asset root override.
 * @param {string} [options.spritesDir] - Sprite root override.
 * @returns {object} Suggestion index.
 */
export function buildAssetSuggestions({ assetsDir = ASSETS_DIR, spritesDir = join(ASSETS_DIR, "sprites") } = {}) {
  const imageDiscovery = buildAssetDiscovery(buildModuleMap(IMAGE_EXTENSIONS, { assetsDir }), {
    idsFromPath: imageIdsFromPath
  });
  const audioDiscovery = buildAssetDiscovery(buildModuleMap(AUDIO_EXTENSIONS, { assetsDir }), {
    idsFromPath: audioIdsFromPath
  });
  const spriteManifest = buildSpriteManifest({ spritesDir });

  return {
    schemaVersion: 1,
    images: {
      ids: Object.keys(imageDiscovery.assets).sort(),
      ambiguities: sortObject(imageDiscovery.ambiguities)
    },
    audio: {
      ids: Object.keys(audioDiscovery.assets).sort(),
      ambiguities: sortObject(audioDiscovery.ambiguities)
    },
    sprites: Object.fromEntries(
      Object.entries(spriteManifest)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, sprite]) => [id, {
          outfits: Object.keys(sprite.outfits ?? {}).sort(),
          expressions: Object.keys(sprite.expressions ?? {}).sort(),
          bodies: Object.keys(sprite.layers?.bodies ?? {}).sort()
        }])
    )
  };
}

/**
 * Writes a game package's suggestion index.
 *
 * @param {object} [options] - Generator options.
 * @param {string} [options.gameDir] - Game package root override.
 * @param {string} [options.assetsDir] - Asset root override.
 * @param {string} [options.spritesDir] - Sprite root override.
 * @param {string} [options.outFile] - Output file override.
 * @returns {string} Output path.
 */
export function generateAssetSuggestions({ gameDir = GAME_DIR, assetsDir, spritesDir, outFile } = {}) {
  const paths = resolveAssetSuggestionPaths(gameDir);
  const resolvedAssetsDir = assetsDir ?? paths.assetsDir;
  const resolvedSpritesDir = spritesDir ?? paths.spritesDir;
  const resolvedOutFile = outFile ?? paths.outFile;
  const suggestions = buildAssetSuggestions({
    assetsDir: resolvedAssetsDir,
    spritesDir: resolvedSpritesDir
  });
  writeFileSync(resolvedOutFile, `${JSON.stringify(suggestions, null, 2)}\n`, "utf8");
  return resolvedOutFile;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const gameDir = readCliOption(process.argv.slice(2), "root") ?? GAME_DIR;
    const { assetsDir, spritesDir } = resolveAssetSuggestionPaths(gameDir);
    const path = generateAssetSuggestions({ gameDir });
    const suggestions = buildAssetSuggestions({ assetsDir, spritesDir });
    console.log(`[asset-suggestions] wrote ${path}: ${suggestions.images.ids.length} image ids, ${suggestions.audio.ids.length} audio ids, ${Object.keys(suggestions.sprites).length} sprite characters`);
  } catch (error) {
    console.error(`[asset-suggestions] failed: ${error.message}`);
    process.exitCode = 1;
  }
}
