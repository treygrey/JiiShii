import { projectSurfaceState, readSurfaceStateSlice } from "../surfaces/index.js";

/**
 * Projects runner-owned background state into the page backdrop.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Projection options.
 * @param {boolean} [options.instant] - Replace visual state without animation.
 * @returns {void}
 */
export function syncBackgroundState(runner, { instant = false } = {}) {
  if (runner.state.visuals?.background) {
    const background = runner.state.visuals.background;
    runner.onBackground(background.asset ?? background.id, {
      transition: instant ? "cut" : runner.state.visuals.background.transition,
      duration: runner.state.visuals.background.duration,
      fit: runner.state.visuals.background.fit,
      position: runner.state.visuals.background.position
    });
  } else {
    runner.onBackground(null);
  }
}

/**
 * Projects all runner-owned visual state into mounted renderers.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Projection options.
 * @param {boolean} [options.instant] - Replace visual state without animation.
 * @returns {void}
 */
export function syncVisualState(runner, { instant = false } = {}) {
  syncBackgroundState(runner, { instant });
  projectSurfaceState({
    state: runner.state,
    renderers: runner.renderers,
    registry: runner.surfaceRegistry,
    surfaceIds: runner.surfaceStack.length ? runner.surfaceStack : null,
    context: {
      characters: runner.characters,
      vars: runner.state.vars ?? {},
      phoneApps: runner.phoneApps,
      phoneConfig: runner.phoneConfig,
      instant
    }
  });
}

/**
 * Projects runner-owned durable audio state into the audio service.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Sync options.
 * @param {boolean} [options.instant] - Skip fades when reconstructing.
 * @returns {void}
 */
export function syncAudioState(runner, { instant = false } = {}) {
  runner.audio.sync?.(runner.state.audio, { instant });
}

/**
 * Syncs runner-owned IRL sprite state into the IRL renderer, if mounted.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Render options.
 * @param {boolean} [options.instant] - Replace sprites without transitions.
 * @returns {void}
 */
export function syncIrlSprites(runner, { instant = false } = {}) {
  projectSurface(runner, "irl", { instant });
}

/**
 * Projects one surface-owned state slice into its renderer.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} surfaceId - Surface id.
 * @param {object} [options] - Projection options.
 * @param {boolean} [options.instant] - Replace visual state without animation.
 * @returns {void}
 */
export function projectSurface(runner, surfaceId, { instant = false } = {}) {
  const surface = runner.surfaceRegistry.get(surfaceId);
  surface?.state?.project?.({
    renderer: runner.renderers?.[surfaceId],
    state: readSurfaceStateSlice(runner.state, surfaceId),
    rootState: runner.state,
    context: {
      characters: runner.characters,
      vars: runner.state.vars ?? {},
      phoneApps: runner.phoneApps,
      phoneConfig: runner.phoneConfig,
      instant
    }
  });
}
