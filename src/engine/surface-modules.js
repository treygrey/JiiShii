/**
 * Built-in surface module definitions. A surface is a presentation layer the
 * scene runner can stage, stack, validate, and reconstruct. `stage("irl")`
 * activates a surface; "IRL" itself is the baseline surface module.
 */

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
  normalizeSpriteState,
  applySpriteExpression,
  applySpriteTransform
} from "./sprite-state.js";
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
} from "./visual-state.js";

export const SHARED_RENDERER_COMMANDS = ["choice", "transition"];

const SURFACE_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * Ensures a surface module has the author-facing shape the engine expects.
 * This is the public helper future modules should use instead of hand-rolling
 * registry objects.
 *
 * @param {object} moduleDefinition - Surface module definition.
 * @param {string} moduleDefinition.id - Stable surface id used by stage/open.
 * @param {boolean} [moduleDefinition.baseline] - True for the baseline VN surface.
 * @param {object} moduleDefinition.renderer - Renderer contract declaration.
 * @param {string} [moduleDefinition.renderer.surface] - Renderer surface id.
 * @param {string[]} moduleDefinition.renderer.commands - Renderer-owned commands.
 * @param {string[]} [moduleDefinition.renderer.projections] - State projection methods.
 * @param {Record<string, object>} [moduleDefinition.commands] - Surface command metadata.
 * @param {object} [moduleDefinition.state] - Surface state lifecycle hooks.
 * @param {Record<string, Function|object>} [moduleDefinition.handlers] - Command handlers.
 * @returns {object} Normalized surface module.
 */
export function defineSurfaceModule(moduleDefinition) {
  if (!moduleDefinition || typeof moduleDefinition !== "object") {
    throw new Error("Surface module: expected a module definition object.");
  }

  const id = moduleDefinition.id;
  if (typeof id !== "string" || !SURFACE_ID_PATTERN.test(id)) {
    throw new Error(
      `Surface module: invalid id "${id ?? "unknown"}". Use lowercase letters, numbers, underscores, or hyphens.`
    );
  }

  const renderer = moduleDefinition.renderer;
  if (!renderer || typeof renderer !== "object") {
    throw new Error(`Surface module "${id}": missing renderer contract.`);
  }

  const rendererSurface = renderer.surface ?? id;
  if (rendererSurface !== id) {
    throw new Error(
      `Surface module "${id}": renderer declares surface "${rendererSurface}".`
    );
  }

  const rendererCommands = normalizeStringList(renderer.commands, `Surface module "${id}": renderer.commands`);
  const rendererProjections = normalizeStringList(
    renderer.projections ?? [],
    `Surface module "${id}": renderer.projections`
  );

  return {
    id,
    baseline: moduleDefinition.baseline === true,
    renderer: {
      surface: id,
      commands: rendererCommands,
      projections: rendererProjections
    },
    commands: normalizeSurfaceCommands(id, moduleDefinition.commands ?? {}),
    state: normalizeStateLifecycle(id, moduleDefinition.state),
    handlers: normalizeCommandHandlers(id, moduleDefinition.handlers ?? {})
  };
}

/**
 * Normalizes a list of string identifiers.
 *
 * @param {unknown} value - Candidate list.
 * @param {string} label - Error label.
 * @returns {string[]} Normalized string list.
 */
function normalizeStringList(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`${label} must be an array of command or method names.`);
  }
  return [...value];
}

/**
 * Normalizes command metadata contributed by one surface module.
 *
 * @param {string} surfaceId - Owning surface id.
 * @param {Record<string, object>} commands - Command metadata by type.
 * @returns {Record<string, object>} Normalized command metadata.
 */
function normalizeSurfaceCommands(surfaceId, commands) {
  if (!commands || typeof commands !== "object" || Array.isArray(commands)) {
    throw new Error(`Surface module "${surfaceId}": commands must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(commands).map(([type, metadata]) => {
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error(`Surface module "${surfaceId}": command "${type}" metadata must be an object.`);
      }

      const normalized = {
        kind: "render",
        surface: surfaceId,
        needsSurface: true,
        ...metadata
      };

      if (normalized.kind === "render" && normalized.surface !== surfaceId) {
        throw new Error(
          `Surface module "${surfaceId}": command "${type}" declares surface "${normalized.surface}".`
        );
      }

      return [type, normalized];
    })
  );
}

/**
 * Normalizes optional state lifecycle hooks for a surface module.
 *
 * @param {string} surfaceId - Owning surface id.
 * @param {object} [state] - State lifecycle hooks.
 * @returns {object|null} Normalized lifecycle hooks, or null.
 */
function normalizeStateLifecycle(surfaceId, state = null) {
  if (state == null) {
    return null;
  }
  if (typeof state !== "object" || Array.isArray(state)) {
    throw new Error(`Surface module "${surfaceId}": state must be an object.`);
  }

  for (const hookName of ["create", "normalize", "clone", "project"]) {
    if (state[hookName] !== undefined && typeof state[hookName] !== "function") {
      throw new Error(`Surface module "${surfaceId}": state.${hookName} must be a function.`);
    }
  }

  return {
    create: state.create ?? (() => null),
    normalize: state.normalize ?? ((value) => structuredClone(value ?? null)),
    clone: state.clone ?? ((value) => structuredClone(value ?? null)),
    project: state.project ?? (() => {})
  };
}

/**
 * Normalizes surface-owned command handlers.
 *
 * @param {string} surfaceId - Owning surface id.
 * @param {Record<string, Function|object>} handlers - Handler declarations.
 * @returns {Record<string, { run?: Function, instant?: Function }>} Normalized handlers.
 */
function normalizeCommandHandlers(surfaceId, handlers) {
  if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) {
    throw new Error(`Surface module "${surfaceId}": handlers must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(handlers).map(([type, handler]) => {
      if (typeof handler === "function") {
        return [type, { run: handler }];
      }
      if (!handler || typeof handler !== "object" || Array.isArray(handler)) {
        throw new Error(`Surface module "${surfaceId}": handler "${type}" must be a function or object.`);
      }
      if (handler.run !== undefined && typeof handler.run !== "function") {
        throw new Error(`Surface module "${surfaceId}": handler "${type}".run must be a function.`);
      }
      if (handler.instant !== undefined && typeof handler.instant !== "function") {
        throw new Error(`Surface module "${surfaceId}": handler "${type}".instant must be a function.`);
      }
      return [type, { ...handler }];
    })
  );
}

export const IRL_SURFACE = defineSurfaceModule({
  id: "irl",
  baseline: true,
  renderer: {
    surface: "irl",
    commands: [
      "showCharacter",
      "hideCharacter",
      "hideAllCharacters",
      "clearIrlStage",
      "setCharacterExpression",
      "moveCharacter",
      "showIrlImage",
      "moveIrlImage",
      "clearIrlImage",
      "lineBlock",
      ...SHARED_RENDERER_COMMANDS
    ],
    projections: ["renderSpriteState"]
  },
  commands: {
    showCharacter: { kind: "render", surface: "irl", needsSurface: true },
    hideCharacter: { kind: "render", surface: "irl", needsSurface: true },
    hideAllCharacters: { kind: "render", surface: "irl", needsSurface: true },
    clearIrlStage: { kind: "render", surface: "irl", needsSurface: true },
    setCharacterExpression: { kind: "render", surface: "irl", needsSurface: true },
    moveCharacter: { kind: "render", surface: "irl", needsSurface: true },
    showIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    moveIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    clearIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    lineBlock: { kind: "render", surface: "irl", needsSurface: true, blocks: true }
  },
  state: {
    create: () => createSpriteState().irl,
    normalize: (value) => normalizeSpriteState({ irl: value }).irl,
    clone: (value) => cloneSpriteState({ irl: value }).irl,
    project: ({ renderer, state, context }) => {
      renderer?.renderSpriteState?.(state, {
        characters: context.characters,
        instant: context.instant
      });
    }
  },
  handlers: {
    showCharacter: {
      run: ({ runner, command }) => {
        applyShowCharacter(runner.state.sprites, command, runner.characters);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyShowCharacter(runner.state.sprites, command, runner.characters);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    hideCharacter: {
      run: ({ runner, renderer, command }) => {
        renderer?.setExitTransition?.(command.id, command.transition);
        applyHideCharacter(runner.state.sprites, command.id);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyHideCharacter(runner.state.sprites, command.id);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    hideAllCharacters: {
      run: ({ runner, renderer, command }) => {
        for (const sprite of runner.state.sprites?.irl?.visible ?? []) {
          renderer?.setExitTransition?.(sprite.id, command.transition);
        }
        applyHideAllCharacters(runner.state.sprites);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner }) => {
        applyHideAllCharacters(runner.state.sprites);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    clearIrlStage: {
      run: ({ runner, renderer, command }) => {
        for (const sprite of runner.state.sprites?.irl?.visible ?? []) {
          renderer?.setExitTransition?.(sprite.id, command.transition);
        }
        for (const image of runner.state.sprites?.irl?.images ?? []) {
          renderer?.setImageExitTransition?.(image.id, command.transition);
        }
        applyClearIrlStage(runner.state.sprites);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner }) => {
        applyClearIrlStage(runner.state.sprites);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    setCharacterExpression: {
      run: ({ runner, command }) => {
        applySpriteExpression(runner.state.sprites, command.id, command.expression);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applySpriteExpression(runner.state.sprites, command.id, command.expression);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    moveCharacter: {
      run: ({ runner, command }) => {
        applySpriteTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applySpriteTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    showIrlImage: {
      run: ({ runner, command }) => {
        applyShowIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyShowIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    moveIrlImage: {
      run: ({ runner, command }) => {
        applyIrlImageTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyIrlImageTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    clearIrlImage: {
      run: ({ runner, command }) => {
        applyClearIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyClearIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    lineBlock: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        runner.recordLineHistory(command.lines ?? [], "irl");
        renderer.showLineBlock(command, {
          characters: runner.characters,
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        renderer.renderLineBlockInstant(command, { characters: runner.characters });
        runner.advanceCommand();
      }
    }
  }
});

export const TEXTING_SURFACE = defineSurfaceModule({
  id: "texting",
  renderer: {
    surface: "texting",
    commands: ["textBlock", "thread", ...SHARED_RENDERER_COMMANDS],
    projections: ["renderTextingState"]
  },
  commands: {
    textBlock: { kind: "render", surface: "texting", needsSurface: true, blocks: true },
    thread: { kind: "render", surface: "texting", needsSurface: true }
  },
  state: {
    create: () => createVisualState().texting,
    normalize: (value) => normalizeVisualState({ texting: value }).texting,
    clone: (value) => cloneVisualState({ texting: value }).texting,
    project: ({ renderer, state, context }) => {
      renderer?.renderTextingState?.(state, {
        characters: context.characters
      });
    }
  },
  handlers: {
    textBlock: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        appendTextMessages(runner.state.visuals, command.texts ?? []);
        runner.recordMessageHistory(command.texts ?? [], "texting");
        renderer.showTextBlock(command, {
          characters: runner.characters,
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
            if (!runner.maybeAutoAdvanceToDecision()) {
              runner.onIdle();
            }
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        renderer.renderTextBlockInstant(command, { characters: runner.characters });
        appendTextMessages(runner.state.visuals, command.texts ?? []);
        runner.advanceCommand();
      }
    },
    thread: {
      run: ({ runner, renderer, command }) => {
        const contact = runner.resolveThreadContact(command);
        setTextingThread(runner.state.visuals, contact);
        renderer.setThread?.(contact);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        const contact = runner.resolveThreadContact(command);
        setTextingThread(runner.state.visuals, contact);
        renderer.setThread?.(contact);
        runner.advanceCommand();
      }
    }
  }
});

export const STREAMING_SURFACE = defineSurfaceModule({
  id: "streaming",
  renderer: {
    surface: "streaming",
    commands: [
      "streamLayout",
      "streamImage",
      "streamChatBlock",
      "streamNarration",
      "streamTitle",
      "streamWindow",
      "streamSystem",
      "streamPost",
      ...SHARED_RENDERER_COMMANDS
    ],
    projections: ["renderStreamingState"]
  },
  commands: {
    streamLayout: { kind: "render", surface: "streaming", needsSurface: true },
    streamImage: { kind: "render", surface: "streaming", needsSurface: true, blocks: true },
    streamChatBlock: { kind: "render", surface: "streaming", needsSurface: true },
    streamNarration: { kind: "render", surface: "streaming", needsSurface: true, blocks: true },
    streamTitle: { kind: "render", surface: "streaming", needsSurface: true },
    streamWindow: { kind: "render", surface: "streaming", needsSurface: true },
    streamSystem: { kind: "render", surface: "streaming", needsSurface: true },
    streamPost: { kind: "render", surface: "streaming", needsSurface: true }
  },
  state: {
    create: () => createVisualState().streaming,
    normalize: (value) => normalizeVisualState({ streaming: value }).streaming,
    clone: (value) => cloneVisualState({ streaming: value }).streaming,
    project: ({ renderer, state }) => {
      renderer?.renderStreamingState?.(state);
    }
  },
  handlers: {
    streamLayout: {
      run: ({ runner, renderer, command }) => {
        setStreamLayoutState(runner.state.visuals, command);
        renderer.setStreamLayout(command);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamLayoutState(runner.state.visuals, command);
        renderer.setStreamLayout(command);
        runner.advanceCommand();
      }
    },
    streamImage: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
        renderer.showStreamImage(command, {
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
        renderer.renderStreamImageInstant(command);
        runner.advanceCommand();
      }
    },
    streamChatBlock: {
      run: ({ runner, renderer, command }) => {
        if (!command.concurrent) {
          runner.beginReadableBeat();
          runner.compositor.hideNarration();
          runner.isWaitingForPlayer = true;
        }
        appendStreamChat(runner.state.visuals, command.messages ?? []);
        runner.recordMessageHistory(command.messages ?? [], "streaming");
        renderer.showStreamChatBlock(command, {
          onComplete: () => {
            if (!command.concurrent) {
              runner.advanceCommand();
              runner.save();
            }
          }
        });
        if (command.concurrent) {
          runner.advanceCommand();
          runner.save();
        }
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, command.messages ?? []);
        renderer.renderStreamChatBlockInstant(command);
        runner.advanceCommand();
      }
    },
    streamNarration: {
      run: ({ runner, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        runner.recordHistory({
          kind: "narration",
          message: command.message,
          surface: "streaming"
        });
        runner.compositor.showNarration(command, {
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        renderer.renderStreamNarrationInstant(command);
        runner.advanceCommand();
      }
    },
    streamTitle: {
      run: ({ runner, renderer, command }) => {
        setStreamTitleState(runner.state.visuals, command.text);
        renderer.setStreamTitle?.(command.text);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamTitleState(runner.state.visuals, command.text);
        renderer.setStreamTitle?.(command.text);
        runner.advanceCommand();
      }
    },
    streamWindow: {
      run: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, command);
        renderer.setStreamWindow?.(command);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, command);
        renderer.setStreamWindow?.(command);
        runner.advanceCommand();
      }
    },
    streamSystem: {
      run: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "system", text: command.text }]);
        runner.recordHistory({
          kind: "system",
          message: command.text,
          surface: "streaming"
        });
        renderer.addStreamSystem?.(command.text);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "system", text: command.text }]);
        renderer.addStreamSystem?.(command.text);
        runner.advanceCommand();
      }
    },
    streamPost: {
      run: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "post", message: command.message }]);
        runner.recordHistory({
          kind: "post",
          speaker: "me",
          name: "Player",
          side: "right",
          message: command.message,
          surface: "streaming"
        });
        renderer.addStreamPost?.(command.message);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "post", message: command.message }]);
        renderer.addStreamPost?.(command.message);
        runner.advanceCommand();
      }
    }
  }
});

export const BUILTIN_SURFACE_MODULES = [IRL_SURFACE, TEXTING_SURFACE, STREAMING_SURFACE];

/**
 * Creates a lookup map from surface modules.
 *
 * @param {Array<object>} modules - Surface module definitions.
 * @returns {Map<string, object>} Surface id to module.
 */
export function createSurfaceRegistry(modules = BUILTIN_SURFACE_MODULES) {
  const registry = new Map();
  for (const moduleDefinition of modules) {
    const surface = defineSurfaceModule(moduleDefinition);
    if (registry.has(surface.id)) {
      throw new Error(`Surface module registry: duplicate surface id "${surface.id}".`);
    }
    registry.set(surface.id, surface);
  }
  return registry;
}

/**
 * Returns all command metadata contributed by surface modules.
 *
 * @param {Array<object>} modules - Surface module definitions.
 * @returns {Record<string, object>} Command metadata keyed by command type.
 */
export function surfaceCommandMeta(modules = BUILTIN_SURFACE_MODULES) {
  const metadata = {};
  for (const surface of createSurfaceRegistry(modules).values()) {
    for (const [type, commandMetadata] of Object.entries(surface.commands ?? {})) {
      if (metadata[type]) {
        throw new Error(`Surface command metadata: duplicate command type "${type}".`);
      }
      metadata[type] = commandMetadata;
    }
  }
  return metadata;
}

/**
 * Returns renderer contract metadata for a surface module.
 *
 * @param {string} surfaceId - Surface id.
 * @param {Map<string, object>} registry - Surface registry.
 * @returns {object|null} Renderer contract metadata, or null.
 */
export function surfaceRendererContract(surfaceId, registry = createSurfaceRegistry()) {
  return registry.get(surfaceId)?.renderer ?? null;
}

/**
 * Creates root visual state for all registered surface modules.
 *
 * @param {Map<string, object>} registry - Surface module registry.
 * @returns {{ sprites: object, visuals: object }} Root state slices.
 */
export function createSurfaceState(registry = createSurfaceRegistry()) {
  const sprites = createSpriteState();
  const visuals = createVisualState();
  for (const surface of registry.values()) {
    const created = surface.state?.create?.();
    assignSurfaceStateSlice({ sprites, visuals }, surface.id, created);
  }
  return { sprites, visuals };
}

/**
 * Normalizes root visual state and backfills every registered surface slice.
 *
 * @param {{ sprites?: object, visuals?: object }} state - Root state slices.
 * @param {Map<string, object>} registry - Surface module registry.
 * @returns {{ sprites: object, visuals: object }} Normalized state slices.
 */
export function normalizeSurfaceState(state = {}, registry = createSurfaceRegistry()) {
  const sprites = normalizeSpriteState(state.sprites);
  const visuals = normalizeVisualState(state.visuals);
  preserveCustomVisualSlices(visuals, state.visuals);
  for (const surface of registry.values()) {
    const current = readSurfaceStateSlice({ sprites, visuals }, surface.id);
    const value = current == null ? surface.state?.create?.() : surface.state?.normalize?.(current);
    assignSurfaceStateSlice({ sprites, visuals }, surface.id, value);
  }
  return { sprites, visuals };
}

/**
 * Clones root visual state using registered surface module lifecycle hooks.
 *
 * @param {{ sprites?: object, visuals?: object }} state - Root state slices.
 * @param {Map<string, object>} registry - Surface module registry.
 * @returns {{ sprites: object, visuals: object }} Detached state slices.
 */
export function cloneSurfaceState(state = {}, registry = createSurfaceRegistry()) {
  const sprites = cloneSpriteState(state.sprites);
  const visuals = cloneVisualState(state.visuals);
  preserveCustomVisualSlices(visuals, state.visuals);
  for (const surface of registry.values()) {
    const current = readSurfaceStateSlice({ sprites, visuals }, surface.id);
    const value = current == null ? surface.state?.create?.() : current;
    const cloned = surface.state?.clone ? surface.state.clone(value) : structuredClone(value ?? null);
    assignSurfaceStateSlice({ sprites, visuals }, surface.id, cloned);
  }
  return { sprites, visuals };
}

/**
 * Projects all registered surface state into its renderer.
 *
 * @param {object} options - Projection options.
 * @param {{ sprites?: object, visuals?: object }} options.state - Root state slices.
 * @param {Record<string, object>} options.renderers - Renderers by surface id.
 * @param {Map<string, object>} options.registry - Surface module registry.
 * @param {object} [options.context] - Projection context.
 * @returns {void}
 */
export function projectSurfaceState({ state, renderers, registry = createSurfaceRegistry(), context = {} }) {
  for (const surface of registry.values()) {
    const slice = readSurfaceStateSlice(state, surface.id);
    surface.state?.project?.({
      renderer: renderers?.[surface.id],
      state: slice,
      rootState: state,
      context
    });
  }
}

/**
 * Reads a surface-owned state slice from the current root state shape.
 *
 * @param {{ sprites?: object, visuals?: object }} rootState - Root state slices.
 * @param {string} surfaceId - Surface id.
 * @returns {object|null} Surface state slice.
 */
export function readSurfaceStateSlice(rootState, surfaceId) {
  if (surfaceId === "irl") {
    return rootState.sprites?.irl ?? null;
  }
  return rootState.visuals?.[surfaceId] ?? null;
}

/**
 * Writes a surface-owned state slice into the current root state shape.
 *
 * @param {{ sprites?: object, visuals?: object }} rootState - Root state slices.
 * @param {string} surfaceId - Surface id.
 * @param {object|null} value - Surface state slice.
 * @returns {void}
 */
export function assignSurfaceStateSlice(rootState, surfaceId, value) {
  if (surfaceId === "irl") {
    rootState.sprites.irl = value ?? createSpriteState().irl;
    return;
  }
  rootState.visuals[surfaceId] = value;
}

/**
 * Carries non-built-in visual slices through built-in normalization.
 *
 * @param {object} targetVisuals - Normalized visual state.
 * @param {object} [sourceVisuals] - Source visual state.
 * @returns {void}
 */
function preserveCustomVisualSlices(targetVisuals, sourceVisuals = {}) {
  for (const [key, value] of Object.entries(sourceVisuals ?? {})) {
    if (!(key in targetVisuals)) {
      targetVisuals[key] = structuredClone(value);
    }
  }
}
