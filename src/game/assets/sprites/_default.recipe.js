// --- SPRITE RECIPE CONSTANTS ---

/**
 * Default sprite construction recipe. Character-local `sprite.recipe.js` files
 * can replace this recipe or import it and append their own conditional layers.
 */
const DEFAULT_SPRITE_RECIPE = [
  { id: "head", source: "heads", key: "head", required: true },
  { id: "outfit", source: "outfits", key: "$outfit", required: true },
  { id: "expression", source: "emotions", key: "$expression", required: false },
  { id: "foregroundHair", source: "foreground", key: "hair", required: false }
];

export default DEFAULT_SPRITE_RECIPE;
