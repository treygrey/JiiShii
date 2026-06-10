const DEFAULT_OUTFIT = "casual";
const DEFAULT_EXPRESSION = "neutral";
const DEFAULT_BODY = "default";
const DEFAULT_LAYER = "characters";

const SPRITE_TRANSFORM_FIELDS = ["at", "x", "y", "scale", "alpha", "z", "layer", "transition", "duration", "easing"];
const IMAGE_TRANSFORM_FIELDS = ["at", "x", "y", "scale", "alpha", "z", "layer", "transition", "duration", "easing", "fit"];

/**
 * Creates the serializable visual state owned by the runner.
 *
 * @returns {object} Empty sprite state.
 */
export function createSpriteState() {
  return {
    irl: {
      visible: [],
      images: [],
      focus: null
    }
  };
}

/**
 * Normalizes a partial or older sprite state into the current shape.
 *
 * @param {object} [sprites] - Saved sprite state.
 * @returns {object} Normalized sprite state.
 */
export function normalizeSpriteState(sprites = {}) {
  const irl = sprites.irl ?? {};
  return {
    irl: {
      visible: Array.isArray(irl.visible)
        ? irl.visible.map(normalizeVisibleSprite).filter((sprite) => sprite.id)
        : [],
      images: Array.isArray(irl.images)
        ? irl.images.map(normalizeVisibleImage).filter((image) => image.id && image.asset)
        : [],
      focus: irl.focus ?? null
    }
  };
}

/**
 * Normalizes one visible sprite entry into the current IRL visual contract.
 *
 * @param {object} sprite - Saved or live sprite entry.
 * @returns {object} Normalized sprite entry.
 */
function normalizeVisibleSprite(sprite = {}) {
  return {
    id: sprite.id,
    outfit: sprite.outfit ?? DEFAULT_OUTFIT,
    expression: sprite.expression ?? DEFAULT_EXPRESSION,
    body: sprite.body ?? DEFAULT_BODY,
    side: sprite.side ?? null,
    flip: Boolean(sprite.flip),
    at: sprite.at ?? null,
    x: sprite.x ?? null,
    y: sprite.y ?? null,
    scale: sprite.scale ?? 1,
    alpha: sprite.alpha ?? 1,
    z: sprite.z ?? null,
    layer: sprite.layer ?? DEFAULT_LAYER,
    transition: sprite.transition ?? null,
    duration: sprite.duration ?? null,
    easing: sprite.easing ?? null
  };
}

/**
 * Normalizes one IRL image/CG displayable into the current visual contract.
 *
 * @param {object} image - Saved or live image entry.
 * @returns {object} Normalized image entry.
 */
function normalizeVisibleImage(image = {}) {
  return {
    id: image.id,
    asset: image.asset,
    kind: image.kind ?? "image",
    at: image.at ?? null,
    x: image.x ?? null,
    y: image.y ?? null,
    scale: image.scale ?? 1,
    alpha: image.alpha ?? 1,
    z: image.z ?? (image.kind === "cg" ? 5 : 45),
    layer: image.layer ?? (image.kind === "cg" ? "cg" : "foreground"),
    transition: image.transition ?? null,
    duration: image.duration ?? null,
    easing: image.easing ?? null,
    fit: image.fit ?? (image.kind === "cg" ? "cover" : "contain")
  };
}

/**
 * Deep-clones sprite state for rollback snapshots and save migration.
 *
 * @param {object} sprites - Sprite state.
 * @returns {object} Detached sprite state.
 */
export function cloneSpriteState(sprites) {
  return normalizeSpriteState(structuredClone(sprites ?? createSpriteState()));
}

/**
 * Applies a show-character command to the runner-owned IRL sprite state.
 *
 * @param {object} sprites - Root sprite state.
 * @param {object} command - Show-character command.
 * @param {Map<string, object>} characters - Character defaults by id.
 * @returns {void}
 */
export function applyShowCharacter(sprites, command, characters) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;

  const id = command.id;
  const visible = sprites.irl.visible;
  const current = visible.find((sprite) => sprite.id === id);
  const character = characters.get(id) ?? {};
  const next = {
    id,
    outfit: command.outfit ?? current?.outfit ?? character.defaultOutfit ?? DEFAULT_OUTFIT,
    expression: command.expression ?? current?.expression ?? character.defaultExpression ?? DEFAULT_EXPRESSION,
    body: command.body ?? current?.body ?? character.defaultBody ?? DEFAULT_BODY,
    side: command.side ?? current?.side ?? null,
    flip: command.flip ?? current?.flip ?? false,
    at: command.at ?? current?.at ?? command.side ?? current?.side ?? null,
    x: command.x ?? current?.x ?? null,
    y: command.y ?? current?.y ?? null,
    scale: command.scale ?? current?.scale ?? 1,
    alpha: command.alpha ?? current?.alpha ?? 1,
    z: command.z ?? current?.z ?? null,
    layer: command.layer ?? current?.layer ?? DEFAULT_LAYER,
    transition: command.transition ?? current?.transition ?? null,
    duration: command.duration ?? current?.duration ?? null,
    easing: command.easing ?? current?.easing ?? null
  };

  if (current) {
    Object.assign(current, next);
    return;
  }

  visible.push(next);
}

/**
 * Removes a character from the runner-owned IRL sprite state.
 *
 * @param {object} sprites - Root sprite state.
 * @param {string} id - Character id.
 * @returns {void}
 */
export function applyHideCharacter(sprites, id) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  sprites.irl.visible = sprites.irl.visible.filter((sprite) => sprite.id !== id);
  if (sprites.irl.focus === id) {
    sprites.irl.focus = null;
  }
}

/**
 * Removes all currently visible IRL sprites.
 *
 * @param {object} sprites - Root sprite state.
 * @returns {void}
 */
export function applyHideAllCharacters(sprites) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  sprites.irl.visible = [];
  sprites.irl.focus = null;
}

/**
 * Clears all IRL scene-local displayables: character sprites, CGs, images, and
 * focus. Backgrounds are compositor-owned and intentionally left alone.
 *
 * @param {object} sprites - Root sprite state.
 * @returns {void}
 */
export function applyClearIrlStage(sprites) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  sprites.irl.visible = [];
  sprites.irl.images = [];
  sprites.irl.focus = null;
}

/**
 * Shows or updates an IRL image displayable.
 *
 * @param {object} sprites - Root sprite state.
 * @param {object} command - Image command.
 * @returns {void}
 */
export function applyShowIrlImage(sprites, command) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;

  const kind = command.kind ?? "image";
  const id = command.id ?? (kind === "cg" ? "__cg" : command.asset);
  const current = sprites.irl.images.find((image) => image.id === id);
  const next = normalizeVisibleImage({
    id,
    asset: command.asset,
    kind,
    at: command.at ?? current?.at ?? (kind === "cg" ? "center" : null),
    x: command.x ?? current?.x ?? null,
    y: command.y ?? current?.y ?? null,
    scale: command.scale ?? current?.scale ?? 1,
    alpha: command.alpha ?? current?.alpha ?? 1,
    z: command.z ?? current?.z ?? (kind === "cg" ? 5 : 45),
    layer: command.layer ?? current?.layer ?? (kind === "cg" ? "cg" : "foreground"),
    transition: command.transition ?? current?.transition ?? null,
    duration: command.duration ?? current?.duration ?? null,
    easing: command.easing ?? current?.easing ?? null,
    fit: command.fit ?? current?.fit ?? (kind === "cg" ? "cover" : "contain")
  });

  if (kind === "cg") {
    sprites.irl.images = sprites.irl.images.filter((image) => image.kind !== "cg");
  }
  const existing = sprites.irl.images.find((image) => image.id === id);
  if (existing) {
    Object.assign(existing, next);
    return;
  }
  sprites.irl.images.push(next);
}

/**
 * Clears one or more IRL image displayables.
 *
 * @param {object} sprites - Root sprite state.
 * @param {object} command - Clear command.
 * @returns {void}
 */
export function applyClearIrlImage(sprites, command = {}) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  if (command.kind === "cg") {
    sprites.irl.images = sprites.irl.images.filter((image) => image.kind !== "cg");
    return;
  }
  if (command.id) {
    sprites.irl.images = sprites.irl.images.filter((image) => image.id !== command.id);
  }
}

/**
 * Applies an expression change to a currently visible IRL sprite.
 *
 * @param {object} sprites - Root sprite state.
 * @param {string} id - Character id.
 * @param {string} expression - Expression id.
 * @returns {void}
 */
export function applySpriteExpression(sprites, id, expression) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  const sprite = sprites.irl.visible.find((entry) => entry.id === id);
  if (sprite) {
    sprite.expression = expression;
  }
}

/**
 * Applies transform/staging fields to a currently visible IRL sprite.
 *
 * @param {object} sprites - Root sprite state.
 * @param {string} id - Character id.
 * @param {object} transform - Partial transform fields.
 * @returns {void}
 */
export function applySpriteTransform(sprites, id, transform = {}) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  const sprite = sprites.irl.visible.find((entry) => entry.id === id);
  if (!sprite) {
    return;
  }
  for (const field of SPRITE_TRANSFORM_FIELDS) {
    if (transform[field] !== undefined) {
      sprite[field] = transform[field];
    }
  }
  if (transform.side !== undefined) {
    sprite.side = transform.side;
  }
  if (transform.flip !== undefined) {
    sprite.flip = Boolean(transform.flip);
  }
}

/**
 * Applies transform/staging fields to a currently visible IRL image.
 *
 * @param {object} sprites - Root sprite state.
 * @param {string} id - Image displayable id.
 * @param {object} transform - Partial transform fields.
 * @returns {void}
 */
export function applyIrlImageTransform(sprites, id, transform = {}) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  const image = sprites.irl.images.find((entry) => entry.id === id);
  if (!image) {
    return;
  }
  for (const field of IMAGE_TRANSFORM_FIELDS) {
    if (transform[field] !== undefined) {
      image[field] = transform[field];
    }
  }
}

/**
 * Sets the focused IRL speaker. Null clears focus.
 *
 * @param {object} sprites - Root sprite state.
 * @param {string|null} id - Focused speaker id.
 * @returns {void}
 */
export function setSpriteFocus(sprites, id) {
  const state = normalizeSpriteState(sprites);
  sprites.irl = state.irl;
  sprites.irl.focus = id ?? null;
}
