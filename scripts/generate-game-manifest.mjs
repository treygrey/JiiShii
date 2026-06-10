import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildGameManifest,
  classifyPackageFile,
  normalizePackagePath,
  shouldIgnorePackagePath
} from "../src/engine/package-manifest.js";

const SCRIPT_EXTENSIONS = new Set([".js", ".mjs"]);

/**
 * Recursively lists package files.
 *
 * @param {string} root - Package root.
 * @param {string} [dir] - Current directory.
 * @returns {string[]} Absolute file paths.
 */
function listFiles(root, dir = root) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Hashes a file with sha256.
 *
 * @param {string} path - Absolute file path.
 * @returns {string} Hex digest.
 */
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Builds file entries for a package root.
 *
 * @param {string} root - Package root.
 * @returns {Array<object>} Manifest file entries.
 */
export function collectGameManifestEntries(root) {
  if (!existsSync(root)) {
    throw new Error(`Game package root does not exist: ${root}`);
  }
  return listFiles(root)
    .map((path) => {
      const relativePath = normalizePackagePath(relative(root, path));
      return { path, relativePath };
    })
    .filter(({ relativePath }) => !shouldIgnorePackagePath(relativePath))
    .map(({ path, relativePath }) => {
      const stat = statSync(path);
      const extension = extname(path).toLowerCase();
      const kind = classifyPackageFile(relativePath);
      return {
        path: relativePath,
        kind,
        size: stat.size,
        mtime: Math.trunc(stat.mtimeMs),
        ...(SCRIPT_EXTENSIONS.has(extension) ? { sha256: sha256(path) } : {})
      };
    });
}

/**
 * Generates and writes a game manifest.
 *
 * @param {object} [options] - Generation options.
 * @param {string} [options.root] - Package root path.
 * @param {"dev"|"release"} [options.mode] - Manifest mode.
 * @returns {object} Generated manifest.
 */
export function generateGameManifest({ root = "src/game", mode = "dev" } = {}) {
  const manifest = buildGameManifest(collectGameManifestEntries(root), { mode });
  writeFileSync(join(root, "game.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootArgIndex = process.argv.findIndex((arg) => arg === "--root");
  const modeArgIndex = process.argv.findIndex((arg) => arg === "--mode");
  const root = rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : "src/game";
  const mode = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : "dev";
  const manifest = generateGameManifest({ root, mode });
  console.log(`Wrote ${root}/game.manifest.json with ${Object.keys(manifest.files).length} file(s).`);
}
