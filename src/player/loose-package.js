import { buildSceneRegistry, buildSurfaceModuleDiscovery, resolveFirstSceneId } from "../engine/content/content-discovery.js";
import { buildAssetDiscovery, imageIdsFromPath, audioIdsFromPath } from "../engine/assets/asset-discovery.js";
import {
  normalizeGameManifest,
  validateGameManifest
} from "../engine/package-manifest.js";
import { normalizeGameConfig } from "../engine/config/game-config.js";
import { BUILTIN_SURFACE_MODULES } from "../engine/surfaces/index.js";
import { installAuthorApiGlobal } from "./author-api.js";

/**
 * Imports Tauri's invoke helper when running inside the native wrapper.
 *
 * @returns {Promise<Function|null>} invoke() or null outside Tauri.
 */
async function tauriInvoke() {
  if (!("__TAURI_INTERNALS__" in globalThis)) {
    return null;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
  } catch {
    return null;
  }
}

/**
 * Converts a package-relative path to a Tauri custom-protocol URL.
 *
 * @param {string} path - Package-relative path.
 * @param {object} [file] - Optional manifest file entry.
 * @returns {string} jiishii-game URL.
 */
function packageUrl(path, file = {}) {
  const encodedPath = String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const version = encodeURIComponent(file.sha256 ?? file.mtime ?? Date.now());
  const isWindowsProtocolHost = /\bWindows\b|\bAndroid\b/i.test(navigator.userAgent);
  const origin = isWindowsProtocolHost
    ? "http://jiishii-game.localhost"
    : "jiishii-game://localhost";
  return `${origin}/${encodedPath}?v=${version}`;
}

/**
 * Imports one loose package module.
 *
 * @param {object} manifest - Game manifest.
 * @param {string} path - Package-relative module path.
 * @returns {Promise<object>} Module exports.
 */
async function importPackageModule(manifest, path) {
  const file = manifest.files[path] ?? {};
  return import(/* @vite-ignore */ packageUrl(path, file));
}

/**
 * Builds an asset discovery registry from manifest files.
 *
 * @param {object} manifest - Game manifest.
 * @param {string} kind - File kind.
 * @param {Function} idsFromPath - Candidate id builder.
 * @returns {{ assets: Record<string, string>, ambiguities: Record<string, string[]> }} Discovery data.
 */
function buildLooseAssetDiscovery(manifest, kind, idsFromPath) {
  const modules = {};
  for (const [path, file] of Object.entries(manifest.files)) {
    if (file.kind === kind) {
      modules[`./${path}`] = packageUrl(path, file);
    }
  }
  return buildAssetDiscovery(modules, { idsFromPath });
}

/**
 * Builds sprite resolvers from loose package manifest data.
 *
 * @param {object} manifest - Game manifest.
 * @param {object} spriteManifest - Sprite manifest JSON.
 * @param {Record<string, object>} recipes - Sprite recipe module map.
 * @param {Function} resolveSpriteLayers - Shared layered sprite resolver.
 * @returns {object} Sprite resolver functions.
 */
function buildLooseSpriteApi(manifest, spriteManifest, recipes, resolveSpriteLayers) {
  const modules = {};
  for (const [path, file] of Object.entries(manifest.files)) {
    if (file.kind === "sprite" || file.kind === "spriteRecipe") {
      modules[`./${path}`] = packageUrl(path, file);
    }
  }
  const entryFor = (character) => spriteManifest?.[character] ?? null;
  const resolveLayers = ({ character, outfit, expression, body = "default", vars = {} }) => resolveSpriteLayers({
    character,
    outfit,
    expression,
    body,
    vars,
    spriteManifest,
    modules,
    recipes
  });
  return {
    resolveSprite(character, outfit, expression, body = "default", vars = {}) {
      const result = resolveLayers({ character, outfit, expression, body, vars });
      const byId = Object.fromEntries(result.layers.map((layer) => [layer.id, layer.url]));
      return {
        ...result,
        head: byId.head ?? null,
        outfit: byId.outfit ?? null,
        foreground: byId.foregroundHair ?? byId.foreground ?? null,
        expression: byId.expression ?? null
      };
    },
    resolveExpression(character, expression) {
      const result = resolveLayers({
        character,
        outfit: "default",
        expression,
        body: "default",
        vars: {}
      });
      return result.layers.find((layer) => layer.id === "expression")?.url ?? null;
    },
    listExpressions(character) {
      return Object.keys(entryFor(character)?.layers?.emotions ?? entryFor(character)?.expressions ?? {});
    },
    listOutfits(character) {
      return Object.keys(entryFor(character)?.layers?.outfits ?? entryFor(character)?.outfits ?? {});
    },
    listBodies(character) {
      return Object.keys(entryFor(character)?.layers?.bodies ?? {});
    },
    listMissingRequiredSpriteLayers(character, options = {}) {
      return resolveLayers({
        character,
        outfit: options.outfit ?? "hoodie",
        expression: options.expression ?? "neutral",
        body: options.body ?? "default",
        vars: options.vars ?? {}
      }).missingRequired;
    }
  };
}

/**
 * Attempts to load a loose game package from Tauri's sibling game folder.
 *
 * @returns {Promise<object|null>} Package descriptor or null when unavailable.
 */
export async function loadLoosePackage() {
  const invoke = await tauriInvoke();
  if (!invoke) {
    return null;
  }

  let packageInfo = null;
  try {
    packageInfo = await invoke("jiishii_package_manifest");
  } catch (error) {
    console.info(`[package] no loose game package loaded: ${error}`);
    return null;
  }

  installAuthorApiGlobal();
  const manifest = normalizeGameManifest(packageInfo.manifest);
  const manifestCheck = validateGameManifest(manifest);
  for (const warning of [...(packageInfo.warnings ?? []), ...manifestCheck.warnings]) {
    console.warn(`[package] ${warning}`);
  }
  if (manifestCheck.errors.length) {
    throw new Error(manifestCheck.errors.join("\n"));
  }

  if (manifest.mode === "dev" && packageInfo.changed) {
    try {
      const updated = await invoke("jiishii_rebuild_manifest");
      return loadLoosePackageFromManifest(normalizeGameManifest(updated.manifest), updated.warnings ?? []);
    } catch (error) {
      console.warn(`[package] manifest auto-update failed: ${error}`);
    }
  }

  return loadLoosePackageFromManifest(manifest, [
    ...(packageInfo.warnings ?? []),
    ...manifestCheck.warnings
  ]);
}

/**
 * Builds a package descriptor from a normalized loose manifest.
 *
 * @param {object} manifest - Normalized manifest.
 * @param {string[]} packageWarnings - Package warnings.
 * @returns {Promise<object>} Package descriptor.
 */
async function loadLoosePackageFromManifest(manifest, packageWarnings = []) {
  const [configModule, charactersModule, ...rest] = await Promise.all([
    importPackageModule(manifest, manifest.entry.config),
    manifest.entry.characters ? importPackageModule(manifest, manifest.entry.characters) : Promise.resolve({}),
    ...manifest.entry.scenes.map((path) => importPackageModule(manifest, path)),
    ...manifest.entry.surfaceModules.map((path) => importPackageModule(manifest, path)),
    ...manifest.entry.spriteRecipes.map((path) => importPackageModule(manifest, path))
  ]);
  const sceneModules = Object.fromEntries(manifest.entry.scenes.map((path, index) => [path, rest[index]]));
  const surfaceStart = manifest.entry.scenes.length;
  const surfaceModules = Object.fromEntries(manifest.entry.surfaceModules.map((path, index) => [path, rest[surfaceStart + index]]));
  const recipeStart = surfaceStart + manifest.entry.surfaceModules.length;
  const recipeModules = Object.fromEntries(manifest.entry.spriteRecipes.map((path, index) => [
    `./${path}`,
    rest[recipeStart + index].default ?? rest[recipeStart + index].recipe
  ]));

  const imageDiscovery = buildLooseAssetDiscovery(manifest, "image", imageIdsFromPath);
  const audioDiscovery = buildLooseAssetDiscovery(manifest, "audio", audioIdsFromPath);
  const videoDiscovery = buildLooseAssetDiscovery(manifest, "video", imageIdsFromPath);
  const surfaceDiscovery = buildSurfaceModuleDiscovery(surfaceModules, {
    builtinSurfaceModules: BUILTIN_SURFACE_MODULES
  });
  const spriteManifest = manifest.entry.spriteManifest
    ? await fetch(packageUrl(manifest.entry.spriteManifest, manifest.files[manifest.entry.spriteManifest])).then((response) => response.json())
    : {};
  const { resolveSpriteLayers } = await import("../game/sprites.js");
  const spriteApi = buildLooseSpriteApi(manifest, spriteManifest, recipeModules, resolveSpriteLayers);
  const scenes = buildSceneRegistry(sceneModules);
  const gameConfig = configModule.GAME_CONFIG ?? configModule.default ?? {};

  return {
    mode: "loose",
    manifest,
    gameConfig,
    scenes,
    firstSceneId: resolveFirstSceneId(scenes, gameConfig),
    surfaceModules: surfaceDiscovery.surfaceModules,
    rendererConstructors: surfaceDiscovery.rendererConstructors,
    globalCharacters: charactersModule.GLOBAL_CHARACTERS ?? charactersModule.default ?? {},
    resolveImage: (id) => imageDiscovery.assets[id] ?? null,
    resolveImageAmbiguity: (id) => imageDiscovery.ambiguities[id] ?? null,
    listImageIds: () => Object.keys(imageDiscovery.assets),
    resolveAudio: (id) => audioDiscovery.assets[id] ?? null,
    resolveAudioAmbiguity: (id) => audioDiscovery.ambiguities[id] ?? null,
    listAudioIds: () => Object.keys(audioDiscovery.assets),
    resolveVideo: (id) => videoDiscovery.assets[id] ?? null,
    listVideoIds: () => Object.keys(videoDiscovery.assets),
    ...spriteApi,
    packageWarnings
  };
}
