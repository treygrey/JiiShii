import manifest from "./sprite-manifest.json";
import defaultSpriteRecipe from "./assets/sprites/_default.recipe.js";

const SPRITE_MODULES = import.meta.glob(
  "./assets/sprites/**/*.png",
  {
    eager: true,
    query: "?url",
    import: "default"
  }
);

const SPRITE_RECIPES = import.meta.glob(
  "./assets/sprites/**/sprite.recipe.js",
  {
    eager: true,
    import: "default"
  }
);

const EXPRESSION_ALIASES = {
  happy: ["smile", "content_smile", "radiant_smile", "laughing"],
  embarrassed: ["shy_smile", "submissive_blush", "awkward"],
  sad: ["depressed", "crying"],
  angry: ["anger", "rage", "glaring", "scowl"],
  smug: ["knowing_grin", "mischievous_grin"],
  surprised: ["shocked"],
  disgust: ["grossed_out", "disdain"],
  disgusted: ["grossed_out", "disdain"]
};

/**
 * Normalizes a name for lookup: lowercase, hyphens become underscores.
 *
 * @param {string} name - Candidate id.
 * @returns {string} Normalized id.
 */
function normalize(name) {
  return String(name ?? "").toLowerCase().replace(/-/g, "_");
}

/**
 * Returns the manifest entry for a character, or null.
 *
 * @param {string} character - Character id.
 * @param {Record<string, object>} spriteManifest - Sprite manifest.
 * @returns {object|null} Manifest entry.
 */
function entryFor(character, spriteManifest = manifest) {
  return spriteManifest[character] ?? null;
}

/**
 * Builds a bundled sprite URL for a file in a character folder. Legacy
 * top-level compatibility files are tried after the recipe folder path.
 *
 * @param {Record<string, string>} modules - Vite sprite module map.
 * @param {string} character - Character id.
 * @param {string|null} file - Sprite filename.
 * @param {string} [subdir] - Optional subdirectory.
 * @returns {string|null} Bundled sprite URL.
 */
function spriteUrl(modules, character, file, subdir = "") {
  if (!file) {
    return null;
  }
  const folderPath = subdir ? `${character}/${subdir}/${file}` : `${character}/${file}`;
  const topLevelPath = `${character}/${file}`;
  return modules[`./assets/sprites/${folderPath}`] ?? modules[`./assets/sprites/${topLevelPath}`] ?? null;
}

/**
 * Returns the normalized list form for outfit-gated recipe fields.
 *
 * @param {string|string[]} value - Recipe condition value.
 * @returns {string[]} Normalized values.
 */
function normalizeConditionList(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  return value == null ? [] : [normalize(value)];
}

/**
 * Reports whether an authored variable value should count as on.
 *
 * @param {unknown} value - Variable value.
 * @returns {boolean} True when the value is truthy/on.
 */
function isOn(value) {
  if (typeof value === "string") {
    return !["", "0", "false", "off", "no", "null", "undefined"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

/**
 * Substitutes sprite-context tokens inside a recipe string.
 *
 * @param {string} value - Raw recipe value.
 * @param {object} context - Sprite context.
 * @returns {string} Substituted value.
 */
function substituteTokens(value, context) {
  return String(value ?? "")
    .replaceAll("$characterId", context.character)
    .replaceAll("$outfit", context.outfit)
    .replaceAll("$expression", context.expression)
    .replaceAll("$body", context.body);
}

/**
 * Returns the declarative recipe for a character.
 *
 * @param {string} character - Character id.
 * @param {Record<string, object>} recipes - Character recipe map.
 * @returns {Array<object>} Sprite recipe.
 */
function recipeFor(character, recipes = SPRITE_RECIPES) {
  return recipes[`./assets/sprites/${character}/sprite.recipe.js`] ?? defaultSpriteRecipe;
}

/**
 * Resolves the expression art filename for a character, trying aliases.
 *
 * @param {object|null} entry - Character manifest entry.
 * @param {string} expression - Expression name.
 * @returns {string|null} Expression filename.
 */
function expressionFile(entry, expression) {
  if (!entry) {
    return null;
  }
  const expressions = entry.layers?.emotions ?? entry.expressions ?? {};
  const key = normalize(expression);
  if (expressions[key]) {
    return expressions[key];
  }
  for (const alt of EXPRESSION_ALIASES[key] ?? []) {
    const file = expressions[normalize(alt)];
    if (file) {
      return file;
    }
  }
  return null;
}

/**
 * Returns the filename for a recipe layer, including expression aliases.
 *
 * @param {object} entry - Character manifest entry.
 * @param {object} descriptor - Recipe layer descriptor.
 * @param {string} key - Resolved layer key.
 * @returns {string|null} Sprite filename.
 */
function fileForLayer(entry, descriptor, key) {
  if (descriptor.source === "emotions") {
    return expressionFile(entry, key);
  }
  return entry.layers?.[descriptor.source]?.[normalize(key)] ?? null;
}

/**
 * Reports whether a recipe descriptor should render for the current sprite.
 *
 * @param {object} descriptor - Recipe layer descriptor.
 * @param {object} context - Sprite context.
 * @returns {boolean} True when the descriptor is active.
 */
function shouldIncludeLayer(descriptor, context) {
  if (descriptor.whenFlag) {
    const flagName = substituteTokens(descriptor.whenFlag, context);
    if (!isOn(context.vars[flagName])) {
      return false;
    }
  }
  const outfit = normalize(context.outfit);
  const onlyOutfits = normalizeConditionList(descriptor.onlyOutfit);
  if (onlyOutfits.length && !onlyOutfits.includes(outfit)) {
    return false;
  }
  const excludedOutfits = normalizeConditionList(descriptor.unlessOutfit);
  return !excludedOutfits.includes(outfit);
}

/**
 * Resolves recipe descriptors into renderable sprite layers.
 *
 * @param {object} options - Resolution options.
 * @param {string} options.character - Character id.
 * @param {string} options.outfit - Outfit id.
 * @param {string} options.expression - Expression id.
 * @param {string} options.body - Body id.
 * @param {Record<string, unknown>} [options.vars] - Story variables.
 * @param {Record<string, object>} [options.spriteManifest] - Sprite manifest.
 * @param {Record<string, string>} [options.modules] - Sprite module map.
 * @param {Record<string, object>} [options.recipes] - Character recipe map.
 * @returns {{ layers: Array<object>, missingRequired: Array<object> }} Resolution result.
 */
export function resolveSpriteLayers({
  character,
  outfit,
  expression,
  body,
  vars = {},
  spriteManifest = manifest,
  modules = SPRITE_MODULES,
  recipes = SPRITE_RECIPES
}) {
  const entry = entryFor(character, spriteManifest);
  if (!entry) {
    return { layers: [], missingRequired: [] };
  }

  const context = {
    character,
    outfit: normalize(outfit),
    expression: normalize(expression),
    body: normalize(body),
    vars
  };
  const layers = [];
  const missingRequired = [];

  for (const descriptor of recipeFor(character, recipes)) {
    if (!descriptor || !shouldIncludeLayer(descriptor, context)) {
      continue;
    }
    const key = substituteTokens(descriptor.key, context);
    const file = fileForLayer(entry, descriptor, key);
    const url = spriteUrl(modules, character, file, descriptor.source);
    const layer = {
      id: descriptor.id,
      source: descriptor.source,
      key: normalize(key),
      required: descriptor.required === true,
      url
    };
    if (url) {
      layers.push(layer);
    } else if (descriptor.required) {
      missingRequired.push(layer);
    }
  }

  return { layers, missingRequired };
}

/**
 * Resolves the composited layers for a character sprite.
 *
 * @param {string} character - Character id.
 * @param {string} outfit - Outfit name.
 * @param {string} expression - Expression name.
 * @param {string} [body="default"] - Body variant name.
 * @param {Record<string, unknown>} [vars={}] - Story variables.
 * @returns {{ layers: Array<object>, missingRequired: Array<object>, outfit: string|null, head: string|null, foreground: string|null, expression: string|null }}
 */
export function resolveSprite(character, outfit, expression, body = "default", vars = {}) {
  const result = resolveSpriteLayers({ character, outfit, expression, body, vars });
  const byId = Object.fromEntries(result.layers.map((layer) => [layer.id, layer.url]));
  return {
    ...result,
    head: byId.head ?? null,
    outfit: byId.outfit ?? null,
    foreground: byId.foregroundHair ?? byId.foreground ?? null,
    expression: byId.expression ?? null
  };
}

/**
 * Lists required recipe layers that do not resolve for a sprite request.
 *
 * @param {string} character - Character id.
 * @param {object} options - Sprite request.
 * @returns {Array<object>} Missing required layers.
 */
export function listMissingRequiredSpriteLayers(character, options = {}) {
  return resolveSpriteLayers({
    character,
    outfit: options.outfit ?? "hoodie",
    expression: options.expression ?? "neutral",
    body: options.body ?? "default",
    vars: options.vars ?? {}
  }).missingRequired;
}

/**
 * Resolves just the expression layer URL for live expression swaps.
 *
 * @param {string} character - Character id.
 * @param {string} expression - Expression name.
 * @returns {string|null} URL or null.
 */
export function resolveExpression(character, expression) {
  return spriteUrl(SPRITE_MODULES, character, expressionFile(entryFor(character), expression), "emotions");
}

/**
 * Lists the expressions available for a character.
 *
 * @param {string} character - Character id.
 * @returns {string[]} Expression names.
 */
export function listExpressions(character) {
  return Object.keys(entryFor(character)?.layers?.emotions ?? entryFor(character)?.expressions ?? {});
}

/**
 * Lists the outfits available for a character.
 *
 * @param {string} character - Character id.
 * @returns {string[]} Outfit names.
 */
export function listOutfits(character) {
  return Object.keys(entryFor(character)?.layers?.outfits ?? entryFor(character)?.outfits ?? {});
}

/**
 * Lists the bodies available for a character.
 *
 * @param {string} character - Character id.
 * @returns {string[]} Body names.
 */
export function listBodies(character) {
  return Object.keys(entryFor(character)?.layers?.bodies ?? {});
}
