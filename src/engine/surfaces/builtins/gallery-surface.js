import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  applyHideAllCharacters,
  applyHideCharacter,
  applyClearIrlImage,
  applyClearIrlStage,
  applyShowCharacter,
  applyShowIrlImage,
  applyIrlImageTransform,
  cloneSpriteState,
  createSpriteState,
  applySpriteExpression,
  applySpriteTransform,
  normalizeSpriteState
} from "../../sprite-state.js";
import {
  appendStreamChat,
  appendTextMessages,
  cloneVisualState,
  createVisualState,
  normalizeVisualState,
  setStreamLayoutState,
  setStreamTitleState,
  setStreamWindowState,
  setTextingThread
} from "../../visual-state.js";
import {
  createGalleryState,
  createSocialState,
  normalizeGalleryState,
  normalizePhoneState,
  normalizeSocialState
} from "../../phone-state.js";

export const GALLERY_SURFACE = defineSurfaceModule({
  id: "gallery",
  phoneApp: {
    label: "Gallery",
    icon: "G"
  },
  renderer: {
    surface: "gallery",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderGalleryState"]
  },
  commands: {},
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
  }
});
