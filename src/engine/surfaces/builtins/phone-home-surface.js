import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  setPhoneApps,
  normalizeGalleryState,
  normalizePhoneState,
  normalizeSocialState
} from "../../phone-state.js";

export const PHONE_HOME_SURFACE = defineSurfaceModule({
  id: "phone_home",
  kind: "app",
  renderer: {
    surface: "phone_home",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderPhoneHomeState"]
  },
  commands: {
    phoneButton: { kind: "state", surface: "phone_home", needsSurface: false },
    phoneApps: { kind: "state", surface: "phone_home", needsSurface: false },
    phoneNotify: { kind: "state", surface: "phone_home", needsSurface: false },
    clearPhoneNotify: { kind: "state", surface: "phone_home", needsSurface: false },
    setWallpaper: { kind: "state", surface: "phone_home", needsSurface: false }
  },
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
  },
  handlers: {
    phoneButton: handlePhoneCommand,
    phoneApps: handlePhoneCommand,
    phoneNotify: handlePhoneCommand,
    clearPhoneNotify: handlePhoneCommand,
    setWallpaper: handlePhoneCommand
  }
});

/**
 * Handles phone-wide state commands.
 *
 * @param {object} context - Surface handler context.
 * @returns {void}
 */
function handlePhoneCommand(context) {
  const { runner, command } = context;
  const phone = runner.state.visuals.phone;
  switch (command.type) {
    case "phoneButton":
      phone.isButtonEnabled = command.enabled !== false;
      context.updatePhoneCheckpoint();
      context.advance();
      return;
    case "phoneApps":
      setPhoneApps(phone, command.apps);
      context.updatePhoneCheckpoint();
      context.advance();
      return;
    case "phoneNotify":
      context.notify(command.app, command);
      context.updatePhoneCheckpoint();
      context.advance();
      return;
    case "clearPhoneNotify":
      context.clearNotification(command.app);
      context.updatePhoneCheckpoint();
      context.advance();
      return;
    case "setWallpaper":
      phone.wallpaperImage = command.image ?? null;
      runner.syncVisualState({ instant: runner.reconstructing || context.instant });
      context.updatePhoneCheckpoint();
      context.advance();
      return;
    default:
      return;
  }
}
