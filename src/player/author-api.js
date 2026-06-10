import * as commands from "../engine/commands.js";
import { registerMarkup } from "../engine/markup.js";
import { registerIrlSpriteTransition } from "../engine/irl-stage-direction.js";

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
