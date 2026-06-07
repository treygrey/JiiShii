import {
  buildAssetDiscovery,
  buildAssetRegistry,
  imageIdsFromPath,
  normalizeAssetId
} from "../engine/asset-discovery.js";

const IMAGE_MODULES = import.meta.glob(
  [
    "./assets/**/*.{png,jpg,jpeg,webp,gif,avif}",
    "!./assets/sprites/**/*.{png,jpg,jpeg,webp,gif,avif}",
    "!./assets/**/*OLD.{png,jpg,jpeg,webp,gif,avif}"
  ],
  {
    eager: true,
    query: "?url",
    import: "default"
  }
);

const IMAGE_ID_ALIASES = {};

const IMAGE_DISCOVERY = buildImageDiscovery(IMAGE_MODULES, IMAGE_ID_ALIASES);

/**
 * Builds image discovery data from a Vite glob map.
 *
 * @param {Record<string, string>} modules - Vite asset module map.
 * @param {Record<string, string>} [aliases] - Stable author-facing aliases.
 * @returns {{assets: Record<string, string>, ambiguities: Record<string, string[]>}} Image discovery data.
 */
export function buildImageDiscovery(modules, aliases = {}) {
  return buildAssetDiscovery(modules, {
    idsFromPath: imageIdsFromPath,
    aliases
  });
}

/**
 * Builds a flat image id -> URL registry from a Vite glob map.
 *
 * @param {Record<string, string>} modules - Vite asset module map.
 * @param {Record<string, string>} [aliases] - Stable author-facing aliases.
 * @returns {Record<string, string>} Image asset registry.
 */
export function buildImageRegistry(modules, aliases = {}) {
  return buildAssetRegistry(modules, {
    idsFromPath: imageIdsFromPath,
    aliases
  });
}

export { imageIdsFromPath, normalizeAssetId as normalizeImageId };

export const IMAGE_ASSETS = IMAGE_DISCOVERY.assets;

/**
 * Resolves an image id to a URL, or null when no art is registered yet.
 *
 * @param {string} id - Asset id referenced by a scene command.
 * @returns {string | null} Resolvable URL or null for placeholder rendering.
 */
export function resolveImage(id) {
  return IMAGE_ASSETS[id] ?? null;
}

/**
 * Reports explicit ids for an omitted ambiguous image id.
 *
 * @param {string} id - Ambiguous image id.
 * @returns {string[]|null} Explicit ids, or null when the id is not ambiguous.
 */
export function resolveImageAmbiguity(id) {
  return IMAGE_DISCOVERY.ambiguities[id] ?? null;
}

/**
 * Lists known image asset ids.
 *
 * @returns {string[]} Image asset ids.
 */
export function listImageIds() {
  return Object.keys(IMAGE_ASSETS);
}

