import { defineSurfaceModule } from "./define-surface-module.js";
import { BUILTIN_SURFACE_MODULES } from "./builtins/index.js";

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
  registry.commandOwners = createSurfaceCommandOwnerIndex(registry);
  return registry;
}

/**
 * Creates a strict command-owner index for registered surface modules.
 *
 * @param {Map<string, object>} registry - Surface registry.
 * @returns {Map<string, string>} Command type to owning surface id.
 */
export function createSurfaceCommandOwnerIndex(registry) {
  const owners = new Map();
  for (const surface of registry.values()) {
    for (const type of Object.keys(surface.commands ?? {})) {
      if (owners.has(type)) {
        throw new Error(
          `Surface module registry: command "${type}" is owned by both "${owners.get(type)}" and "${surface.id}".`
        );
      }
      owners.set(type, surface.id);
    }
  }
  return owners;
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
