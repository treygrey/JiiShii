import {
  audioIdsFromPath,
  buildAssetDiscovery,
  buildAssetRegistry,
  assetIdFromPathText
} from "../engine/assets/asset-discovery.js";

const AUDIO_MODULES = import.meta.glob(
  [
    "./assets/audio/**/*.{mp3,ogg,wav,m4a,flac}",
    "!./assets/audio/**/*OLD.{mp3,ogg,wav,m4a,flac}"
  ],
  {
    eager: true,
    query: "?url",
    import: "default"
  }
);

const AUDIO_ID_ALIASES = {};

const AUDIO_DISCOVERY = buildAudioDiscovery(AUDIO_MODULES, AUDIO_ID_ALIASES);

/**
 * Builds audio discovery data from a Vite glob map.
 *
 * @param {Record<string, string>} modules - Vite asset module map.
 * @param {Record<string, string>} [aliases] - Stable author-facing aliases.
 * @returns {{assets: Record<string, string>, ambiguities: Record<string, string[]>}} Audio discovery data.
 */
export function buildAudioDiscovery(modules, aliases = {}) {
  return buildAssetDiscovery(modules, {
    idsFromPath: audioIdsFromPath,
    aliases
  });
}

/**
 * Builds a flat audio id -> URL registry from a Vite glob map.
 *
 * @param {Record<string, string>} modules - Vite asset module map.
 * @param {Record<string, string>} [aliases] - Stable author-facing aliases.
 * @returns {Record<string, string>} Audio asset registry.
 */
export function buildAudioRegistry(modules, aliases = {}) {
  return buildAssetRegistry(modules, {
    idsFromPath: audioIdsFromPath,
    aliases
  });
}

export { audioIdsFromPath, assetIdFromPathText as audioIdFromPathText };

export const AUDIO_ASSETS = AUDIO_DISCOVERY.assets;

/**
 * Resolves an audio id to a URL, or null when no asset is registered yet.
 *
 * @param {string} id - Audio asset id referenced by a scene command.
 * @returns {string|null} Resolvable URL or null.
 */
export function resolveAudio(id) {
  return AUDIO_ASSETS[id] ?? null;
}

/**
 * Reports explicit ids for an omitted ambiguous audio id.
 *
 * @param {string} id - Ambiguous audio id.
 * @returns {string[]|null} Explicit ids, or null when the id is not ambiguous.
 */
export function resolveAudioAmbiguity(id) {
  return AUDIO_DISCOVERY.ambiguities[id] ?? null;
}

/**
 * Lists known audio asset ids.
 *
 * @returns {string[]} Audio asset ids.
 */
export function listAudioIds() {
  return Object.keys(AUDIO_ASSETS);
}
