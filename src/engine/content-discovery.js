/**
 * Helpers for build-time content auto-discovery. Vite's import.meta.glob gives
 * us the file map; these helpers keep the registry rules testable without Vite.
 */

/**
 * Reports whether a value looks like an authored scene object.
 *
 * @param {unknown} value - Candidate export.
 * @returns {boolean} True when the export has the scene shape.
 */
export function isSceneExport(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    Array.isArray(value.script)
  );
}

/**
 * Reports whether a value is close enough to a scene that ignoring it would
 * hide a likely authoring mistake.
 *
 * @param {unknown} value - Candidate export.
 * @returns {boolean} True when the value looks scene-like.
 */
function isMalformedSceneExport(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("id" in value || "script" in value || "cast" in value || "characters" in value)
  );
}

/**
 * Flattens matching top-level exports so a content file can export either one
 * object or an array of objects as a small content pack. Top-level non-matches
 * are ignored so files can export helper functions, but every item inside an
 * authored pack array must match the expected content shape.
 *
 * @param {object} moduleExports - Raw module exports from Vite.
 * @param {(value: unknown) => boolean} matches - Content-shape predicate.
 * @param {string} path - Source module path.
 * @param {string} label - Author-facing content label.
 * @returns {unknown[]} Matching exported values, with arrays expanded.
 */
function collectContentExports(moduleExports, matches, path, label) {
  const values = [];

  const visit = (value, exportPath, insidePack = false) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${exportPath}[${index}]`, true);
      });
      return;
    }
    if (!matches(value)) {
      if (insidePack) {
        throw new Error(`${label} discovery: "${path}" has an invalid item in ${exportPath}. Pack arrays may only contain ${label.toLowerCase()} definitions.`);
      }
      return;
    }
    values.push(value);
  };

  for (const [name, value] of Object.entries(moduleExports ?? {})) {
    visit(value, name);
  }

  return values;
}

/**
 * Builds an author-facing scene shape error.
 *
 * @param {string} path - Source module path.
 * @param {string} exportPath - Export path inside the module.
 * @param {object} value - Malformed scene-like value.
 * @returns {Error} Shape error.
 */
function sceneShapeError(path, exportPath, value) {
  const missing = [];
  if (typeof value?.id !== "string" || value.id.trim().length === 0) {
    missing.push("id");
  }
  if (!Array.isArray(value?.script)) {
    missing.push("script array");
  }
  return new Error(
    `Scene discovery: "${path}" export ${exportPath} looks like a scene but is missing ${missing.join(" and ")}. Use scene({ id, script: [...] }).`
  );
}

/**
 * Throws for top-level scene-like exports that are malformed.
 *
 * @param {string} path - Source module path.
 * @param {object} moduleExports - Raw module exports.
 * @returns {void}
 */
function validateTopLevelSceneExports(path, moduleExports) {
  for (const [name, value] of Object.entries(moduleExports ?? {})) {
    if (Array.isArray(value) || isSceneExport(value) || !isMalformedSceneExport(value)) {
      continue;
    }
    throw sceneShapeError(path, name, value);
  }
}

/**
 * Builds a scene registry from eager glob modules.
 *
 * @param {Record<string, object>} moduleMap - Glob result keyed by file path.
 * @param {object} [options] - Registry options.
 * @param {boolean} [options.requireScenePerFile] - Throw when a file exports no scenes.
 * @returns {Record<string, object>} Scene registry keyed by scene id.
 */
export function buildSceneRegistry(moduleMap, { requireScenePerFile = true } = {}) {
  const registry = {};
  const pathsBySceneId = {};

  for (const [path, moduleExports] of Object.entries(moduleMap)) {
    validateTopLevelSceneExports(path, moduleExports);
    const scenes = collectContentExports(moduleExports, isSceneExport, path, "Scene");

    if (requireScenePerFile && scenes.length === 0) {
      throw new Error(`Scene discovery: "${path}" does not export a scene object.`);
    }

    for (const scene of scenes) {
      if (registry[scene.id]) {
        throw new Error(`Scene discovery: duplicate scene id "${scene.id}" in "${path}" (already defined in "${pathsBySceneId[scene.id]}").`);
      }
      registry[scene.id] = scene;
      pathsBySceneId[scene.id] = path;
    }
  }

  return registry;
}

/**
 * Resolves the first scene id from config and discovered scenes.
 *
 * @param {Record<string, object>} scenes - Scene registry.
 * @param {object} config - Game config.
 * @param {string} [config.firstSceneId] - Explicit first scene id.
 * @returns {string} First scene id.
 */
export function resolveFirstSceneId(scenes, config = {}) {
  if (config.firstSceneId) {
    if (!scenes[config.firstSceneId]) {
      throw new Error(`Scene discovery: configured firstSceneId "${config.firstSceneId}" was not found.`);
    }
    return config.firstSceneId;
  }

  const startScenes = Object.values(scenes).filter((scene) => scene.start === true);
  if (startScenes.length > 1) {
    throw new Error(`Scene discovery: multiple scenes declare start: true (${startScenes.map((scene) => scene.id).join(", ")}).`);
  }
  if (startScenes.length === 1) {
    return startScenes[0].id;
  }

  const first = Object.keys(scenes).sort()[0];
  if (!first) {
    throw new Error("Scene discovery: no scenes were discovered.");
  }
  return first;
}

/**
 * Reports whether a value looks like a surface module definition.
 *
 * @param {unknown} value - Candidate export.
 * @returns {boolean} True when the export has the surface module shape.
 */
export function isSurfaceModuleExport(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.renderer &&
    typeof value.renderer === "object"
  );
}

/**
 * Reports whether a value is close enough to a surface module that ignoring it
 * would hide a likely authoring mistake.
 *
 * @param {unknown} value - Candidate export.
 * @returns {boolean} True when the value looks surface-module-like.
 */
function isMalformedSurfaceModuleExport(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("id" in value || "renderer" in value || "commands" in value || "handlers" in value || "state" in value)
  );
}

/**
 * Builds an author-facing surface module shape error.
 *
 * @param {string} path - Source module path.
 * @param {string} exportPath - Export path inside the module.
 * @param {object} value - Malformed surface-like value.
 * @returns {Error} Shape error.
 */
function surfaceModuleShapeError(path, exportPath, value) {
  const missing = [];
  if (typeof value?.id !== "string" || value.id.trim().length === 0) {
    missing.push("id");
  }
  if (!value?.renderer || typeof value.renderer !== "object" || Array.isArray(value.renderer)) {
    missing.push("renderer contract");
  }
  return new Error(
    `Surface module discovery: "${path}" export ${exportPath} looks like a surface module but is missing ${missing.join(" and ")}. Use defineSurfaceModule({ id, renderer, ... }).`
  );
}

/**
 * Throws for top-level surface-like exports that are malformed.
 *
 * @param {string} path - Source module path.
 * @param {object} moduleExports - Raw module exports.
 * @returns {void}
 */
function validateTopLevelSurfaceModuleExports(path, moduleExports) {
  for (const [name, value] of Object.entries(moduleExports ?? {})) {
    if (Array.isArray(value) || isSurfaceModuleExport(value) || !isMalformedSurfaceModuleExport(value)) {
      continue;
    }
    throw surfaceModuleShapeError(path, name, value);
  }
}

/**
 * Builds surface module and renderer-constructor lists from eager glob modules.
 *
 * @param {Record<string, object>} moduleMap - Glob result keyed by file path.
 * @param {object} [options] - Discovery options.
 * @param {Array<object>} [options.builtinSurfaceModules] - Built-in modules.
 * @param {boolean} [options.requireSurfaceModulePerFile] - Throw when a file exports no surface module.
 * @returns {{ surfaceModules: object[], rendererConstructors: Record<string, Function> }} Surface discovery result.
 */
export function buildSurfaceModuleDiscovery(moduleMap, {
  builtinSurfaceModules = [],
  requireSurfaceModulePerFile = true
} = {}) {
  const surfaceModules = [...builtinSurfaceModules];
  const rendererConstructors = {};
  const seen = new Set(surfaceModules.map((surface) => surface.id));

  for (const [path, moduleExports] of Object.entries(moduleMap)) {
    validateTopLevelSurfaceModuleExports(path, moduleExports);
    const discoveredInFile = [];

    for (const value of collectContentExports(moduleExports, isSurfaceModuleExport, path, "Surface module")) {
      if (seen.has(value.id)) {
        throw new Error(`Surface module discovery: duplicate surface id "${value.id}" in "${path}".`);
      }
      seen.add(value.id);
      surfaceModules.push(value);
      discoveredInFile.push(value.id);
    }

    if (requireSurfaceModulePerFile && discoveredInFile.length === 0) {
      throw new Error(`Surface module discovery: "${path}" does not export a surface module definition.`);
    }

    const constructors = {
      ...(moduleExports?.rendererConstructors ?? {}),
      ...(moduleExports?.RENDERER_CONSTRUCTORS ?? {})
    };
    for (const [surfaceId, Renderer] of Object.entries(constructors)) {
      if (!seen.has(surfaceId)) {
        throw new Error(`Surface module discovery: renderer constructor "${surfaceId}" in "${path}" has no matching surface module.`);
      }
      if (rendererConstructors[surfaceId]) {
        throw new Error(`Surface module discovery: duplicate renderer constructor for surface "${surfaceId}" in "${path}".`);
      }
      if (typeof Renderer !== "function") {
        throw new Error(`Surface module discovery: renderer constructor "${surfaceId}" in "${path}" must be a class or function.`);
      }
      rendererConstructors[surfaceId] = Renderer;
    }
  }

  return { surfaceModules, rendererConstructors };
}
