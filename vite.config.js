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
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const assetName = assetInfo.name ?? "";
          if (/\.(css)$/i.test(assetName)) {
            return "assets/css/[name]-[hash][extname]";
          }
          if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(assetName)) {
            return "assets/img/[name]-[hash][extname]";
          }
          if (/\.(mp3|wav|ogg|flac|m4a)$/i.test(assetName)) {
            return "assets/audio/[name]-[hash][extname]";
          }
          if (/\.(woff2?|ttf|otf)$/i.test(assetName)) {
            return "assets/fonts/[name]-[hash][extname]";
          }
          return "assets/misc/[name]-[hash][extname]";
        }
      }
    }
  },
  resolve: {
    preserveSymlinks: true
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/src/game.before-*/**"]
  },
  plugins: [spriteManifestPlugin()]
});
