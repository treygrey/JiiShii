import manifest from "./sprite-manifest.json";

const SPRITE_MODULES = import.meta.glob(
  "./assets/sprites/**/*.png",
  {
    eager: true,
    query: "?url",
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
 * @returns {object|null} Manifest entry.
 */
function entryFor(character) {
  return manifest[character] ?? null;
}

/**
 * Builds a bundled sprite URL for a file in a character folder.
 *
 * @param {string} character - Character id.
 * @param {string|null} file - Sprite filename.
 * @param {string} [subdir] - Optional subdirectory.
 * @returns {string|null} Bundled sprite URL.
 */
function spriteUrl(character, file, subdir = "") {
  if (!file) {
    return null;
  }
  const path = subdir ? `${character}/${subdir}/${file}` : `${character}/${file}`;
  return SPRITE_MODULES[`./assets/sprites/${path}`] ?? null;
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
  const key = normalize(expression);
  if (entry.expressions[key]) {
    return entry.expressions[key];
  }
  for (const alt of EXPRESSION_ALIASES[key] ?? []) {
    const file = entry.expressions[normalize(alt)];
    if (file) {
      return file;
    }
  }
  return null;
}

/**
 * Resolves the composited layers for a character sprite.
 *
 * @param {string} character - Character id.
 * @param {string} outfit - Outfit name.
 * @param {string} expression - Expression name.
 * @returns {{ outfit: string|null, head: string|null, foreground: string|null, expression: string|null }}
 */
export function resolveSprite(character, outfit, expression) {
  const entry = entryFor(character);
  if (!entry) {
    return { outfit: null, head: null, foreground: null, expression: null };
  }
  return {
    head: spriteUrl(character, entry.head),
    outfit: spriteUrl(character, entry.outfits[normalize(outfit)], "outfits"),
    foreground: spriteUrl(character, entry.foreground),
    expression: spriteUrl(character, expressionFile(entry, expression), "emotions")
  };
}

/**
 * Resolves just the expression layer URL for live expression swaps.
 *
 * @param {string} character - Character id.
 * @param {string} expression - Expression name.
 * @returns {string|null} URL or null.
 */
export function resolveExpression(character, expression) {
  return spriteUrl(character, expressionFile(entryFor(character), expression), "emotions");
}

/**
 * Lists the expressions available for a character.
 *
 * @param {string} character - Character id.
 * @returns {string[]} Expression names.
 */
export function listExpressions(character) {
  return Object.keys(entryFor(character)?.expressions ?? {});
}

/**
 * Lists the outfits available for a character.
 *
 * @param {string} character - Character id.
 * @returns {string[]} Outfit names.
 */
export function listOutfits(character) {
  return Object.keys(entryFor(character)?.outfits ?? {});
}
