import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  cloneVisualState,
  createVisualState,
  endPhoneCallState,
  normalizeVisualState,
  startPhoneCallState
} from "../../state/visual-state.js";
import { resolveCallContact } from "./call-contact.js";

/**
 * Story-driving phone call surface. The call screen resembles the phone, but
 * it is not a navigable phone app while a call is active.
 */
export const PHONE_CALL_SURFACE = defineSurfaceModule({
  id: "phone_call",
  kind: "story",
  renderer: {
    surface: "phone_call",
    commands: ["call", "endCall", ...SHARED_RENDERER_COMMANDS],
    projections: ["renderPhoneCallState"]
  },
  commands: {
    call: { kind: "render", surface: "phone_call", needsSurface: true },
    endCall: { kind: "render", surface: "phone_call", needsSurface: true }
  },
  state: {
    create: () => createVisualState().phoneCall,
    normalize: (value) => normalizeVisualState({ phoneCall: value }).phoneCall,
    clone: (value) => cloneVisualState({ phoneCall: value }).phoneCall,
    project: ({ renderer, state, rootState, context }) => {
      renderer?.renderPhoneCallState?.(state, {
        characters: context.characters,
        phone: rootState.visuals.phone
      });
    }
  },
  handlers: {
    call: {
      run: ({ runner, renderer, command }) => {
        const contact = resolveCallContact(runner, command.contact, command);
        const callState = startPhoneCallState(
          runner.state.visuals,
          contact,
          command,
          runner.state.currentCommandIndex
        );
        renderer.renderPhoneCallState?.(callState, {
          characters: runner.characters,
          phone: runner.state.visuals.phone
        });
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        const contact = resolveCallContact(runner, command.contact, command);
        const callState = startPhoneCallState(
          runner.state.visuals,
          contact,
          command,
          runner.state.currentCommandIndex
        );
        renderer.renderPhoneCallState?.(callState, {
          characters: runner.characters,
          phone: runner.state.visuals.phone
        });
        runner.advanceCommand();
      }
    },
    endCall: {
      run: ({ runner, renderer, command }) => {
        endPhoneCallState(runner.state.visuals, command);
        renderer.renderPhoneCallState?.(runner.state.visuals.phoneCall, {
          characters: runner.characters,
          phone: runner.state.visuals.phone
        });
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        endPhoneCallState(runner.state.visuals, command);
        renderer.renderPhoneCallState?.(runner.state.visuals.phoneCall, {
          characters: runner.characters,
          phone: runner.state.visuals.phone
        });
        runner.advanceCommand();
      }
    }
  }
});
