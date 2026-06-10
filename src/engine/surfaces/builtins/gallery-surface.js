import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  createGalleryState,
  normalizeGalleryState,
  normalizePhoneState,
  removeGalleryImageState,
  saveGalleryImageState
} from "../../phone-state.js";

/**
 * Resolves the phone wallpaper field into an image asset id.
 *
 * Gallery-selected wallpapers store a gallery entry id. Authored
 * setWallpaper() calls and old saves may still store a raw asset id. A resolver
 * lets renderers distinguish valid raw assets from stale gallery ids.
 *
 * @param {object} phone - Phone visual state.
 * @param {object} gallery - Gallery visual state.
 * @param {object} [phoneConfig] - Normalized phone config.
 * @param {object} [options] - Resolution options.
 * @param {Function} [options.resolveImage] - Asset resolver for raw ids.
 * @returns {string|null} Resolved wallpaper asset id, or fallback.
 */
export function resolveWallpaperAsset(phone = {}, gallery = {}, phoneConfig = {}, { resolveImage = null } = {}) {
  const wallpaperImage = phone?.wallpaperImage ?? null;
  if (!wallpaperImage) {
    return phoneConfig.defaultWallpaper ?? null;
  }

  const galleryImage = (gallery?.images ?? []).find((image) => image.id === wallpaperImage);
  if (galleryImage?.image) {
    return galleryImage.image;
  }

  if (typeof resolveImage === "function") {
    return resolveImage(wallpaperImage) ? wallpaperImage : phoneConfig.defaultWallpaper ?? null;
  }

  return wallpaperImage;
}

export const GALLERY_SURFACE = defineSurfaceModule({
  id: "gallery",
  kind: "app",
  phoneApp: {
    label: "Gallery",
    icon: "G"
  },
  renderer: {
    surface: "gallery",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderGalleryState"]
  },
  commands: {
    saveGalleryImage: { kind: "state", surface: "gallery", needsSurface: false },
    removeGalleryImage: { kind: "state", surface: "gallery", needsSurface: false }
  },
  state: {
    create: createGalleryState,
    normalize: normalizeGalleryState,
    clone: (value) => structuredClone(normalizeGalleryState(value)),
    project: ({ renderer, state, rootState, context }) => {
      renderer?.renderGalleryState?.(normalizeGalleryState(state), {
        phone: normalizePhoneState(rootState.visuals?.phone),
        instant: context.instant
      });
    }
  },
  handlers: {
    saveGalleryImage: handleGalleryCommand,
    removeGalleryImage: handleGalleryCommand
  }
});

/**
 * Handles Gallery app state commands.
 *
 * @param {object} context - Surface handler context.
 * @returns {void}
 */
function handleGalleryCommand(context) {
  const { runner, command } = context;
  const gallery = runner.state.visuals.gallery;
  if (command.type === "saveGalleryImage") {
    saveGalleryImageState(gallery, command);
    context.projectSurface();
    context.updatePhoneCheckpoint();
    context.advance();
    return;
  }
  if (command.type === "removeGalleryImage") {
    removeGalleryImageState(gallery, command.id);
    context.projectSurface();
    context.updatePhoneCheckpoint();
    context.advance();
  }
}
