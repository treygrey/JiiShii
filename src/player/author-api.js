import * as commands from "../engine/commands/index.js";
import { registerMarkup } from "../engine/dom/markup.js";
import { registerIrlSpriteTransition } from "../engine/dom/irl-stage-direction.js";

export const AUTHOR_API = {
  ...commands,
  registerMarkup,
  registerIrlSpriteTransition
};

/**
 * Exposes JiiShii's author API for loose package `vn.js` shims.
 *
 * @returns {void}
 */
export function installAuthorApiGlobal() {
  globalThis.__JIISHII_AUTHOR_API__ = AUTHOR_API;
}
