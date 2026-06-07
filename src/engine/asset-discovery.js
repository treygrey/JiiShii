/**
 * Converts freeform path text into a script-friendly asset id.
 *
 * @param {string} value - Path or filename text.
 * @returns {string} Normalized asset id.
 */
export function normalizeAssetId(value) {
  return value
    .replace(/\\/g, "/")
    .replace(/\.[^.]+$/, "")
    .split("/")
    .filter(Boolean)
    .join("_")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

/**
 * Creates unambiguous ids for an image path. Short ids make authoring pleasant;
 * longer ids stay available when filenames collide.
 *
 * @param {string} path - Vite glob path.
 * @returns {string[]} Candidate ids.
 */
export function imageIdsFromPath(path) {
  const relativePath = path.replace(/^.*\/assets\//, "");
  const pathParts = relativePath.split("/");
  const filename = pathParts.at(-1) ?? relativePath;
  const parent = pathParts.at(-2);
  const stem = filename.replace(/\.[^.]+$/, "");

  return [...new Set([
    normalizeAssetId(relativePath),
    normalizeAssetId(pathParts.slice(1).join("/")),
    parent ? normalizeAssetId(`${parent}/${stem}`) : null,
    normalizeAssetId(stem)
  ].filter(Boolean))];
}

/**
 * Creates unambiguous ids for an audio path. Short ids are pleasant to author;
 * longer ids stay available when filenames collide.
 *
 * @param {string} path - Vite glob path.
 * @returns {string[]} Candidate ids.
 */
export function audioIdsFromPath(path) {
  const relativePath = path.replace(/^.*\/audio\//, "");
  const pathParts = relativePath.split("/");
  const filename = pathParts.at(-1) ?? relativePath;
  const parent = pathParts.at(-2);
  const stem = filename.replace(/\.[^.]+$/, "");

  return [...new Set([
    normalizeAssetId(relativePath),
    normalizeAssetId(pathParts.slice(1).join("/")),
    parent ? normalizeAssetId(`${parent}/${stem}`) : null,
    normalizeAssetId(stem)
  ].filter(Boolean))];
}

/**
 * Builds the discovered asset registry and ambiguity report.
 *
 * @param {Record<string, string>} modules - Vite glob module map.
 * @param {object} options - Discovery options.
 * @param {Function} options.idsFromPath - Candidate-id builder.
 * @param {Record<string, string>} [options.aliases] - Stable author-facing aliases.
 * @returns {{ assets: Record<string, string>, ambiguities: Record<string, string[]> }} Discovery report.
 */
export function buildAssetDiscovery(modules, { idsFromPath, aliases = {} }) {
  const candidates = new Map();

  for (const [path, url] of Object.entries(modules)) {
    if (shouldSkipRetiredPath(path)) {
      continue;
    }
    for (const id of idsFromPath(path)) {
      const entries = candidates.get(id) ?? new Map();
      entries.set(path, url);
      candidates.set(id, entries);
    }
  }

  const registry = {};
  for (const [id, entries] of candidates.entries()) {
    if (entries.size === 1) {
      registry[id] = [...entries.values()][0];
    }
  }

  const ambiguities = {};
  for (const [id, entries] of candidates.entries()) {
    if (entries.size <= 1) {
      continue;
    }
    ambiguities[id] = [...new Set([...entries.keys()]
      .map((path) => idsFromPath(path).find((candidate) => candidate !== id && candidates.get(candidate)?.size === 1))
      .filter(Boolean))]
      .sort();
  }

  for (const [alias, target] of Object.entries(aliases)) {
    if (registry[target]) {
      registry[alias] = registry[target];
    }
  }

  return { assets: registry, ambiguities };
}

/**
 * Builds the discovered asset registry while omitting ambiguous short aliases.
 *
 * @param {Record<string, string>} modules - Vite glob module map.
 * @param {object} options - Discovery options.
 * @returns {Record<string, string>} Asset id to URL map.
 */
export function buildAssetRegistry(modules, options) {
  const { assets } = buildAssetDiscovery(modules, options);
  return assets;
}

/**
 * Reports whether an asset path should stay out of the author-facing registry.
 *
 * @param {string} path - Vite glob path.
 * @returns {boolean} True when the asset is an archived/retired file.
 */
function shouldSkipRetiredPath(path) {
  const filename = path.split(/[\\/]/).at(-1) ?? "";
  return /old\.[^.]+$/i.test(filename);
}
