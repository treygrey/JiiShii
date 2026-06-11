import { addPhoneNotification, clearPhoneNotification } from "../state/phone-state.js";
import { readSurfaceStateSlice } from "../surfaces/index.js";

/**
 * Builds the command handler context passed to surface modules.
 *
 * This is intentionally capability-shaped even though `runner` remains
 * available during the migration. Later phases can remove the escape hatch
 * after story modules use the capabilities directly.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} surface - Owning surface module.
 * @param {object} command - Command being handled.
 * @param {object} [options] - Handler options.
 * @param {boolean} [options.instant] - True during replay/reconstruction.
 * @returns {object} Handler context.
 */
export function buildHandlerContext(runner, surface, command, { instant = false } = {}) {
  return {
    runner,
    command,
    instant,
    renderer: runner.renderers?.[surface.id],
    compositor: runner.compositor,
    state: runner.state,
    surfaceState: readSurfaceStateSlice(runner.state, surface.id),
    characters: runner.characters,
    vars: runner.state.vars ?? {},
    audio: {
      playSound: (...args) => runner.audio?.playSound?.(...args)
    },
    advance: () => runner.advanceCommand(),
    projectSurface: () => runner.projectSurface(surface.id, { instant }),
    projectPhoneChrome: () => runner.projectSurface("phone_home", { instant }),
    notify: (app, options = {}) => {
      const notification = addPhoneNotification(runner.state.visuals.phone, app, options);
      if (!runner.reconstructing && !instant) {
        runner.activeRenderer?.showPhoneToast?.(notification, {
          onSelect: () => runner.openPhoneApp(app)
        });
      }
      return notification;
    },
    clearNotification: (app) => clearPhoneNotification(runner.state.visuals.phone, app),
    updatePhoneCheckpoint: () => runner.updatePhoneCheckpointState()
  };
}
