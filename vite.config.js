import { defineConfig } from "vite";
import { resolve } from "node:path";
import { generateSpriteManifest } from "./scripts/generate-sprite-manifest.mjs";

/**
 * Keeps src/game/sprite-manifest.json in sync with the active game sprites:
 * regenerates on build and dev start, and whenever sprite files are added or
 * removed while the dev server runs. Sprite art is served verbatim from public/
 * (not bundled), so this manifest is how the engine knows what exists.
 *
 * @returns {import('vite').Plugin} The plugin.
 */
function spriteManifestPlugin() {
  const spritesDir = resolve("src/game/assets/sprites").replaceAll("\\", "/");
  return {
    name: "vn-sprite-manifest",
    buildStart() {
      generateSpriteManifest();
    },
    configureServer(server) {
      generateSpriteManifest();
      server.watcher.add(spritesDir);
      let timer = null;
      const regen = (file) => {
        if (!String(file).replaceAll("\\", "/").includes("/src/game/assets/sprites/")) {
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            generateSpriteManifest();
          } catch (error) {
            server.config.logger.warn(`[sprite-manifest] ${error.message}`);
          }
        }, 120);
      };
      for (const event of ["add", "unlink", "addDir", "unlinkDir"]) {
        server.watcher.on(event, regen);
      }
    }
  };
}

/**
 * Keeps the built prototype usable from a file path while the dev server is optional.
 */
export default defineConfig({
  base: "./",
  plugins: [spriteManifestPlugin()]
});
