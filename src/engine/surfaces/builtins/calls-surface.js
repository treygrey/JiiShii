import { addPhoneNotification } from "../../state/phone-state.js";
import {
  cloneVisualState,
  createVisualState,
  normalizeVisualState,
  saveVoicemailState
} from "../../state/visual-state.js";
import { resolveCallContact } from "./call-contact.js";
import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";

/**
 * Non-story Calls phone app: recents and voicemail.
 */
export const CALLS_SURFACE = defineSurfaceModule({
  id: "calls",
  phoneApp: {
    label: "Calls",
    icon: "C"
  },
  renderer: {
    surface: "calls",
    commands: [...SHARED_RENDERER_COMMANDS],
    projections: ["renderCallsState"]
  },
  commands: {
    voicemail: { kind: "state", surface: "calls", needsSurface: false }
  },
  state: {
    create: () => createVisualState().calls,
    normalize: (value) => normalizeVisualState({ calls: value }).calls,
    clone: (value) => cloneVisualState({ calls: value }).calls,
    project: ({ renderer, state, rootState }) => {
      renderer?.renderCallsState?.(state, {
        phone: rootState.visuals.phone
      });
    }
  },
  handlers: {
    voicemail: {
      run: ({ runner, command }) => {
        const contact = resolveCallContact(runner, command.contact, command);
        saveVoicemailState(runner.state.visuals.calls, command, contact);
        if (command.notify !== false) {
          addPhoneNotification(runner.state.visuals.phone, "calls", {
            id: command.notifyId ?? `voicemail:${command.id}`,
            text: command.notifyText ?? `${contact.name} left a voicemail`
          });
        }
        runner.projectSurface("calls", { instant: true });
        runner.projectSurface("phone_home", { instant: true });
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        const contact = resolveCallContact(runner, command.contact, command);
        saveVoicemailState(runner.state.visuals.calls, command, contact);
        if (command.notify !== false) {
          addPhoneNotification(runner.state.visuals.phone, "calls", {
            id: command.notifyId ?? `voicemail:${command.id}`,
            text: command.notifyText ?? `${contact.name} left a voicemail`
          });
        }
        runner.advanceCommand();
      }
    }
  }
});
