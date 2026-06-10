/**
 * Creates a label lookup table for jump targets.
 *
 * @param {Array<object>} script - Scene command list.
 * @returns {Map<string, number>} Label id to command index map.
 */
export function createLabelIndex(script) {
  const labels = new Map();

  script.forEach((command, index) => {
    if (command.type === "label") {
      labels.set(command.id, index);
    }
  });

  return labels;
}

/**
 * Resolves global and scene-local character declarations into one map.
 *
 * @param {object} runner - Scene runner instance.
 * @param {Array<object>} declarations - Scene character declarations.
 * @returns {Map<string, object>} Character defaults by id.
 */
export function resolveSceneCharacters(runner, declarations = []) {
  const characters = new Map();

  for (const declaration of declarations) {
    if (declaration.useGlobal) {
      const globalCharacter = runner.globalCharacters[declaration.id] ?? {};
      characters.set(declaration.id, {
        id: declaration.id,
        ...globalCharacter,
        ...declaration.overrides
      });
      continue;
    }

    characters.set(declaration.id, declaration);
  }

  return characters;
}

/**
 * Builds the scene's character map from explicit declarations and cast ids.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} scene - Scene definition.
 * @returns {Map<string, object>} Character defaults by id.
 */
export function buildCharacters(runner, scene) {
  const characters = runner.resolveSceneCharacters(scene.characters ?? []);
  for (const rawId of scene.cast ?? []) {
    const id = runner.aliasSpeaker(rawId);
    if (!characters.has(id)) {
      const globalCharacter = runner.globalCharacters[id];
      if (globalCharacter) {
        characters.set(id, { id, ...globalCharacter });
      }
    }
  }
  return characters;
}

/**
 * Resolves the id bare `say("text")` speaks as.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {string} Default speaker id.
 */
export function defaultVoice(runner) {
  return runner.aliasSpeaker(runner.scene.cast?.[0] ?? "me");
}

/**
 * Normalizes player-role aliases to the canonical player id.
 *
 * @param {string} id - Raw speaker id.
 * @returns {string} Canonical id.
 */
export function aliasSpeaker(id) {
  return id === "me" || id === "you" ? "player" : id;
}

/**
 * Loads a scene through the runner's existing scene loading policy.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} sceneId - Scene id.
 * @returns {void}
 */
export function loadScene(runner, sceneId) {
  const next = runner.registry[sceneId];

  if (!next) {
    runner.finishScene();
    runner.onTransition(sceneId);
    return;
  }

  const phoneCarry = structuredClone({
    phone: runner.state.visuals.phone,
    texting: runner.state.visuals.texting,
    gallery: runner.state.visuals.gallery,
    social: runner.state.visuals.social
  });
  runner.teardownMountedSurfaces();
  runner.setPhoneNavigationSurface(null);
  runner.audio.stopTransient?.();

  runner.scene = next;
  runner.labels = runner.createLabelIndex(next.script);
  runner.characters = runner.buildCharacters(next);
  runner.state.currentSceneId = next.id;
  runner.state.currentCommandIndex = 0;
  runner.state.surfaceStack = [];
  runner.state.currentSurface = "texting";
  runner.resetVisualState();
  runner.state.visuals.phone = phoneCarry.phone ?? runner.state.visuals.phone;
  runner.state.visuals.texting = phoneCarry.texting ?? runner.state.visuals.texting;
  runner.state.visuals.texting.contact = null;
  runner.state.visuals.texting.messages = [];
  runner.state.visuals.texting.currentThreadId = null;
  runner.state.visuals.gallery = phoneCarry.gallery ?? runner.state.visuals.gallery;
  runner.state.visuals.social = phoneCarry.social ?? runner.state.visuals.social;
  runner.isWaitingForPlayer = false;
  runner.isFinished = false;
  runner.blockingInput = false;
  runner.resetRollback();
  runner.checkpointScene();
  runner.runUntilBlocked();
}
