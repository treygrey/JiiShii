export const SHARED_RENDERER_COMMANDS = ["choice", "transition"];

const SURFACE_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
const SURFACE_KINDS = new Set(["story", "app"]);

/**
 * Ensures a surface module has the author-facing shape the engine expects.
 * This is the public helper future modules should use instead of hand-rolling
 * registry objects.
 *
 * @param {object} moduleDefinition - Surface module definition.
 * @param {string} moduleDefinition.id - Stable surface id used by stage/open.
 * @param {"story"|"app"} [moduleDefinition.kind] - Surface behavior category.
 * @param {boolean} [moduleDefinition.baseline] - True for the baseline VN surface.
 * @param {object} moduleDefinition.renderer - Renderer contract declaration.
 * @param {string} [moduleDefinition.renderer.surface] - Renderer surface id.
 * @param {string[]} moduleDefinition.renderer.commands - Renderer-owned commands.
 * @param {string[]} [moduleDefinition.renderer.projections] - State projection methods.
 * @param {boolean|object} [moduleDefinition.phoneApp] - Optional phone launcher metadata.
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
    kind: normalizeSurfaceKind(id, moduleDefinition.kind),
    baseline: moduleDefinition.baseline === true,
    phoneApp: normalizePhoneAppMetadata(id, moduleDefinition.phoneApp),
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
 * Normalizes a surface kind declaration.
 *
 * @param {string} surfaceId - Surface id.
 * @param {unknown} value - Candidate kind.
 * @returns {"story"|"app"} Normalized surface kind.
 */
function normalizeSurfaceKind(surfaceId, value) {
  const kind = value ?? "story";
  if (!SURFACE_KINDS.has(kind)) {
    throw new Error(`Surface module "${surfaceId}": kind must be "story" or "app".`);
  }
  return kind;
}

/**
 * Normalizes optional phone app metadata for launcher-ready surfaces.
 *
 * @param {string} surfaceId - Surface id.
 * @param {boolean|object|null} value - Phone app declaration.
 * @returns {object|null} Normalized metadata.
 */
function normalizePhoneAppMetadata(surfaceId, value) {
  if (!value) {
    return null;
  }
  if (value === true) {
    return {
      label: surfaceId,
      icon: null
    };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Surface module "${surfaceId}": phoneApp must be true or an object.`);
  }
  return {
    label: typeof value.label === "string" && value.label.trim() ? value.label : surfaceId,
    icon: typeof value.icon === "string" && value.icon.trim() ? value.icon : null
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
