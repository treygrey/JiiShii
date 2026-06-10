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

export const SOCIAL_SURFACE = defineSurfaceModule({
  id: "social",
  kind: "app",
  phoneApp: {
    label: "Social",
    icon: "S"
  },
  renderer: {
    surface: "social",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderSocialState"]
  },
  commands: {},
  state: {
    create: createSocialState,
    normalize: normalizeSocialState,
    clone: (value) => structuredClone(normalizeSocialState(value)),
    project: ({ renderer, state, rootState, context }) => {
      renderer?.renderSocialState?.(normalizeSocialState(state), {
        phone: normalizePhoneState(rootState.visuals?.phone),
        characters: context.characters,
        instant: context.instant
      });
    }
  }
});
