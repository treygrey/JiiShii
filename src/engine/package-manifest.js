export const GAME_MANIFEST_SCHEMA = 1;

const SCRIPT_EXTENSIONS = new Set([".js", ".mjs"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac"]);
const SPRITE_EXTENSIONS = new Set([".png"]);

/**
 * Normalizes a package-relative path to URL-style separators.
 *
 * @param {string} value - Candidate path.
 * @returns {string} Normalized relative path.
 */
export function normalizePackagePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
}

/**
 * Returns true when a package path should be ignored by discovery.
 *
 * @param {string} relativePath - Package-relative path.
 * @returns {boolean} True when the path is private/template/test material.
 */
export function shouldIgnorePackagePath(relativePath) {
  const normalized = normalizePackagePath(relativePath);
  const filename = normalized.split("/").at(-1) ?? "";
  const segments = normalized.split("/");
  const hasPrivateSegment = segments.some((segment) => segment.startsWith("_"));
  return (
    filename === "game.manifest.json" ||
    filename === ".gitkeep" ||
    normalized === "assets.js" ||
    normalized === "audio.js" ||
    normalized === "sprites.js" ||
    normalized === "scenes/index.js" ||
    normalized === "surface-modules/index.js" ||
    filename.endsWith(".example.js") ||
    filename.endsWith(".test.js") ||
    filename.endsWith(".spec.js") ||
    filename.startsWith("_") ||
    segments.includes(".git") ||
    segments.includes("node_modules") ||
    hasPrivateSegment ||
    /old\.[^.]+$/i.test(filename)
  );
}

/**
 * Classifies one package file for manifest and runtime loading.
 *
 * @param {string} relativePath - Package-relative path.
 * @returns {string} File kind.
 */
export function classifyPackageFile(relativePath) {
  const normalized = normalizePackagePath(relativePath);
  const lower = normalized.toLowerCase();
  const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (normalized === "game.config.js") return "config";
  if (normalized === "characters.js") return "characters";
  if (normalized === "sprite-animations.js") return "spriteAnimations";
  if (normalized === "sprite-manifest.json") return "spriteManifest";
  if (normalized === "vn.js") return "authorApi";
  if (lower.includes("/sprite.recipe.js")) return "spriteRecipe";
  if (lower.startsWith("scenes/") && SCRIPT_EXTENSIONS.has(extension)) return "scene";
  if (lower.startsWith("surface-modules/") && SCRIPT_EXTENSIONS.has(extension)) return "surfaceModule";
  if (lower.startsWith("assets/audio/") && AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (lower.startsWith("assets/sprites/") && SPRITE_EXTENSIONS.has(extension)) return "sprite";
  if (lower.startsWith("assets/") && IMAGE_EXTENSIONS.has(extension)) return "image";
  if (SCRIPT_EXTENSIONS.has(extension)) return "script";
  return "file";
}

/**
 * Builds a normalized loose game manifest from file metadata.
 *
 * @param {Array<object>} entries - File entries { path, size, mtime, sha256 }.
 * @param {object} [options] - Manifest options.
 * @param {"dev"|"release"} [options.mode] - Manifest mode.
 * @param {string} [options.gameId] - Stable game id.
 * @param {string} [options.minEngineVersion] - Minimum engine version.
 * @returns {object} Manifest object.
 */
export function buildGameManifest(entries, {
  mode = "dev",
  gameId = "jiishii-game",
  minEngineVersion = "0.1.0-alpha.0"
} = {}) {
  const files = {};
  for (const entry of entries) {
    const path = normalizePackagePath(entry.path);
    if (!path || shouldIgnorePackagePath(path)) {
      continue;
    }
    const kind = entry.kind ?? classifyPackageFile(path);
    files[path] = {
      kind,
      size: Number(entry.size ?? 0),
      mtime: Number(entry.mtime ?? 0)
    };
    if (entry.sha256) {
      files[path].sha256 = entry.sha256;
    }
  }

  const pathsByKind = (kind) => Object.entries(files)
    .filter(([, file]) => file.kind === kind)
    .map(([path]) => path)
    .sort();

  return {
    schema: GAME_MANIFEST_SCHEMA,
    mode,
    gameId,
    engine: {
      minVersion: minEngineVersion
    },
    entry: {
      config: files["game.config.js"] ? "game.config.js" : null,
      characters: files["characters.js"] ? "characters.js" : null,
      spriteAnimations: files["sprite-animations.js"] ? "sprite-animations.js" : null,
      spriteManifest: files["sprite-manifest.json"] ? "sprite-manifest.json" : null,
      scenes: pathsByKind("scene"),
      surfaceModules: pathsByKind("surfaceModule"),
      spriteRecipes: pathsByKind("spriteRecipe")
    },
    files
  };
}

/**
 * Normalizes and fills optional manifest fields.
 *
 * @param {object} manifest - Raw manifest.
 * @returns {object} Normalized manifest.
 */
export function normalizeGameManifest(manifest = {}) {
  const files = {};
  for (const [rawPath, rawFile] of Object.entries(manifest.files ?? {})) {
    const path = normalizePackagePath(rawPath);
    if (!path) {
      continue;
    }
    files[path] = {
      kind: rawFile.kind ?? classifyPackageFile(path),
      size: Number(rawFile.size ?? 0),
      mtime: Number(rawFile.mtime ?? 0),
      ...(rawFile.sha256 ? { sha256: rawFile.sha256 } : {})
    };
  }
  const entry = manifest.entry ?? {};
  return {
    schema: Number(manifest.schema ?? GAME_MANIFEST_SCHEMA),
    mode: manifest.mode === "release" ? "release" : "dev",
    gameId: manifest.gameId ?? "jiishii-game",
    engine: {
      minVersion: manifest.engine?.minVersion ?? "0.1.0-alpha.0"
    },
    entry: {
      config: entry.config ?? (files["game.config.js"] ? "game.config.js" : null),
      characters: entry.characters ?? (files["characters.js"] ? "characters.js" : null),
      spriteAnimations: entry.spriteAnimations ?? (files["sprite-animations.js"] ? "sprite-animations.js" : null),
      spriteManifest: entry.spriteManifest ?? (files["sprite-manifest.json"] ? "sprite-manifest.json" : null),
      scenes: Array.isArray(entry.scenes) ? entry.scenes.map(normalizePackagePath) : [],
      surfaceModules: Array.isArray(entry.surfaceModules) ? entry.surfaceModules.map(normalizePackagePath) : [],
      spriteRecipes: Array.isArray(entry.spriteRecipes) ? entry.spriteRecipes.map(normalizePackagePath) : []
    },
    files
  };
}

/**
 * Validates the minimum manifest shape needed to boot a loose package.
 *
 * @param {object} manifest - Normalized manifest.
 * @returns {{ errors: string[], warnings: string[] }} Validation report.
 */
export function validateGameManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (manifest.schema !== GAME_MANIFEST_SCHEMA) {
    errors.push(`game.manifest.json schema ${manifest.schema} is not supported.`);
  }
  if (!manifest.entry.config) {
    errors.push("game.manifest.json needs entry.config.");
  }
  if (!manifest.entry.scenes.length) {
    errors.push("game.manifest.json needs at least one scene in entry.scenes.");
  }
  for (const path of [
    manifest.entry.config,
    manifest.entry.characters,
    manifest.entry.spriteAnimations,
    manifest.entry.spriteManifest,
    ...manifest.entry.scenes,
    ...manifest.entry.surfaceModules,
    ...manifest.entry.spriteRecipes
  ].filter(Boolean)) {
    if (!manifest.files[path]) {
      warnings.push(`game.manifest.json entry "${path}" is not listed in files.`);
    }
  }
  return { errors, warnings };
}
