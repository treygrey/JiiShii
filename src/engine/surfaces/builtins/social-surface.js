import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  createSocialState,
  normalizePhoneState,
  saveSocialPostState,
  normalizeSocialState
} from "../../state/phone-state.js";

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
  commands: {
    socialPost: { kind: "state", surface: "social", needsSurface: false },
    socialFollow: { kind: "state", surface: "social", needsSurface: false },
    socialLike: { kind: "state", surface: "social", needsSurface: false }
  },
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
  },
  handlers: {
    socialPost: handleSocialCommand,
    socialFollow: handleSocialCommand,
    socialLike: handleSocialCommand
  }
});

/**
 * Handles Social app state commands.
 *
 * @param {object} context - Surface handler context.
 * @returns {void}
 */
function handleSocialCommand(context) {
  const { runner, command } = context;
  const social = runner.state.visuals.social;
  if (command.type === "socialPost") {
    saveSocialPostState(social, command);
    if (command.notify) {
      context.notify("social", {
        id: command.notifyId ?? `social:${command.id}`,
        text: command.notifyText ?? "New social post"
      });
    }
    context.projectSurface();
    context.updatePhoneCheckpoint();
    context.advance();
    return;
  }
  if (command.type === "socialFollow") {
    social.follows[command.poster] = true;
    if (command.flag) {
      runner.state.vars[command.flag] = true;
    }
    context.projectSurface();
    context.updatePhoneCheckpoint();
    context.advance();
    return;
  }
  if (command.type === "socialLike") {
    social.likes[command.id] = true;
    if (command.flag) {
      runner.state.vars[command.flag] = true;
    }
    context.projectSurface();
    context.updatePhoneCheckpoint();
    context.advance();
  }
}
