import { loadBundledPackage } from "./bundled-package.js";
import { loadLoosePackage } from "./loose-package.js";

/**
 * Loads the active game package. Loose package mode is only available inside
 * Tauri and falls back to the bundled starter package when no sibling game
 * folder is present.
 *
 * @returns {Promise<object>} Package descriptor.
 */
export async function loadGamePackage() {
  return (await loadLoosePackage()) ?? (await loadBundledPackage());
}
