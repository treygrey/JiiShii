/**
 * Removes only packaging details from a path while preserving the author's
 * filename text exactly: case, spaces, underscores, hyphens, and folders.
 *
 * @param {string} value - Path or filename text.
 * @returns {string} Extensionless slash-separated id text.
 */
export function assetIdFromPathText(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/\.[^.]+$/, "");
}

/**
 * Creates literal id candidates from an extensionless asset path. The first id
 * is the full package-relative path, then progressively shorter exact paths.
 *
 * @param {string} relativePath - Asset path relative to its discovery root.
 * @returns {string[]} Exact extensionless candidate ids.
 */
function literalIdsFromRelativePath(relativePath) {
  const extensionlessPath = assetIdFromPathText(relativePath);
  const pathParts = extensionlessPath.split("/").filter(Boolean);
  const stem = pathParts.at(-1);
  return [...new Set([
    extensionlessPath,
    pathParts.length > 1 ? pathParts.slice(1).join("/") : null,
    stem
  ].filter(Boolean))];
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
  return literalIdsFromRelativePath(relativePath);
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
  return literalIdsFromRelativePath(relativePath);
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
