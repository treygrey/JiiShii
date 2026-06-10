/**
 * Unmounts every currently stacked surface and unregisters it from the
 * compositor. Used by rollback, load, and scene transitions.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function teardownMountedSurfaces(runner) {
  runner.clearPauseTimer();
  runner.activeRenderer?.clearChoices?.();
  for (const stackedId of runner.surfaceStack) {
    runner.renderers[stackedId]?.reset?.();
    runner.renderers[stackedId]?.unmount?.();
    runner.compositor.unregisterLayer(stackedId);
  }
  runner.surfaceStack = [];
  runner.activeRenderer = null;
}

/**
 * Sets the active base surface on a runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} surfaceId - Surface id.
 * @returns {void}
 */
export function setSurface(runner, surfaceId) {
  if (!runner.surfaceRegistry.has(surfaceId)) {
    throw new Error(`Unknown surface "${surfaceId}". Register a surface module before staging it.`);
  }

  if (runner.surfaceRegistry.get(surfaceId)?.kind === "app") {
    const phoneTarget = surfaceId === "phone_home" ? "home" : surfaceId;
    throw new Error(`Surface "${surfaceId}" is a phone app. Use openPhone("${phoneTarget}") instead of staging it.`);
  }

  const next = runner.renderers[surfaceId];

  if (!next) {
    throw new Error(`No renderer registered for surface "${surfaceId}".`);
  }

  runner.compositor.hideNarration();

  for (const stackedId of runner.surfaceStack) {
    const renderer = runner.renderers[stackedId];
    if (renderer && renderer !== next) {
      renderer.unmount?.();
      runner.compositor.unregisterLayer(stackedId);
    }
  }

  runner.surfaceStack = [surfaceId];
  runner.setPhoneNavigationSurface(null);
  runner.state.currentSurface = surfaceId;
  runner.state.surfaceStack = [...runner.surfaceStack];
  runner.activeRenderer = next;

  next.mount({
    scene: runner.scene,
    state: runner.state,
    characters: runner.characters
  });

  if (next.surface && !runner.compositor.hasLayer(surfaceId)) {
    runner.compositor.registerLayer(surfaceId, next.surface);
  }

  applyCompositorPreset(runner);
  runner.syncVisualState({ instant: runner.reconstructing });
}

/**
 * Pushes a surface layer on a runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} surfaceId - Surface id.
 * @returns {void}
 */
export function pushSurface(runner, surfaceId) {
  if (!runner.surfaceRegistry.has(surfaceId)) {
    throw new Error(`Unknown surface "${surfaceId}". Register a surface module before opening it.`);
  }

  const next = runner.renderers[surfaceId];

  if (!next) {
    throw new Error(`No renderer registered for surface "${surfaceId}".`);
  }

  if (runner.surfaceStack.includes(surfaceId)) {
    return;
  }

  runner.surfaceStack.push(surfaceId);
  runner.state.currentSurface = surfaceId;
  runner.state.surfaceStack = [...runner.surfaceStack];
  runner.activeRenderer = next;

  next.mount({
    scene: runner.scene,
    state: runner.state,
    characters: runner.characters
  });

  if (next.surface && !runner.compositor.hasLayer(surfaceId)) {
    runner.compositor.registerLayer(surfaceId, next.surface);
  }

  applyCompositorPreset(runner);
  runner.syncBackgroundState({ instant: runner.reconstructing });
  runner.projectSurface(surfaceId, { instant: runner.reconstructing });
}

/**
 * Pops the active surface layer on a runner.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function popSurface(runner) {
  if (runner.surfaceStack.length <= 1) {
    return;
  }

  const poppedIndex = runner.surfaceStack.length - 1;
  const poppedId = runner.surfaceStack.pop();
  const poppedRenderer = runner.renderers[poppedId];
  const poppedPhoneNavigationLayer = runner.isPhoneNavigationLayer(poppedId, poppedIndex);

  if (poppedRenderer) {
    poppedRenderer.unmount?.();
    runner.compositor.unregisterLayer(poppedId);
  }

  if (poppedPhoneNavigationLayer) {
    runner.setPhoneNavigationSurface(null);
  }

  const newTopId = runner.surfaceStack[runner.surfaceStack.length - 1];
  runner.state.currentSurface = newTopId;
  runner.state.surfaceStack = [...runner.surfaceStack];
  runner.activeRenderer = runner.renderers[newTopId];

  applyCompositorPreset(runner);
}

/**
 * Applies the compositor preset for the runner's current surface stack.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
function applyCompositorPreset(runner) {
  const preset = runner.compositor.resolvePreset(runner.surfaceStack);
  runner.compositor.applyPreset(preset);
}
