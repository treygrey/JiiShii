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

export const PHONE_HOME_SURFACE = defineSurfaceModule({
  id: "phone_home",
  renderer: {
    surface: "phone_home",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderPhoneHomeState"]
  },
  commands: {},
  state: {
    create: () => null,
    normalize: () => null,
    clone: () => null,
    project: ({ renderer, rootState, context }) => {
      renderer?.renderPhoneHomeState?.({
        phone: normalizePhoneState(rootState.visuals?.phone),
        gallery: normalizeGalleryState(rootState.visuals?.gallery),
        social: normalizeSocialState(rootState.visuals?.social),
        phoneApps: context.phoneApps ?? {}
      }, {
        characters: context.characters,
        instant: context.instant
      });
    }
  }
});
