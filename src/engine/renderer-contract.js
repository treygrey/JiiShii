import { COMMAND_META } from "./command-meta.js";
import { createSurfaceRegistry, surfaceRendererContract } from "./surface-modules.js";

/**
 * Returns the commands every renderer for a surface must implement.
 *
 * @param {string} surface - Surface id.
 * @returns {string[]} Required command types.
 */
export function requiredRendererCommands(surface, registry = createSurfaceRegistry()) {
  const contract = surfaceRendererContract(surface, registry);
  if (contract?.commands) {
    return contract.commands;
  }
  return Object.entries(COMMAND_META)
    .filter(([, meta]) => meta.kind === "render" && meta.surface === surface)
    .map(([type]) => type);
}

/**
 * Returns the projection methods a renderer must expose for rollback/load
 * reconstruction.
 *
 * @param {string} surface - Surface id.
 * @returns {string[]} Required projection method names.
 */
export function requiredRendererProjections(surface, registry = createSurfaceRegistry()) {
  return surfaceRendererContract(surface, registry)?.projections ?? [];
}

/**
 * Reads renderer contract metadata from either an instance or its class.
 *
 * @param {object} renderer - Renderer instance.
 * @returns {{ surface?: string, commands?: string[], projections?: string[] }}
 */
function readRendererContract(renderer) {
  return renderer?.contract ?? renderer?.constructor?.contract ?? {};
}

/**
 * Validates that the renderer map supplied to the runner can satisfy the
 * command metadata table.
 *
 * @param {Record<string, object>} renderers - Renderer instances by surface id.
 * @param {Map<string, object>} [surfaceRegistry] - Surface module registry.
 * @returns {void}
 */
export function validateRendererContracts(renderers, surfaceRegistry = createSurfaceRegistry()) {
  const surfaces = new Set(surfaceRegistry.keys());

  for (const surface of surfaces) {
    const renderer = renderers?.[surface];
    if (!renderer) {
      throw new Error(`Renderer contract: missing renderer for surface "${surface}".`);
    }

    const contract = readRendererContract(renderer);
    if (contract.surface !== surface) {
      throw new Error(
        `Renderer contract: renderer registered as "${surface}" declares surface "${contract.surface ?? "unknown"}".`
      );
    }

    const supported = new Set(contract.commands ?? []);
    const missing = requiredRendererCommands(surface, surfaceRegistry)
      .filter((command) => !supported.has(command));
    if (missing.length) {
      throw new Error(
        `Renderer contract: "${surface}" renderer is missing command support: ${missing.join(", ")}.`
      );
    }

    const declaredProjections = new Set(contract.projections ?? []);
    const missingProjections = requiredRendererProjections(surface, surfaceRegistry)
      .filter((projection) => !declaredProjections.has(projection) || typeof renderer[projection] !== "function");
    if (missingProjections.length) {
      throw new Error(
        `Renderer contract: "${surface}" renderer is missing projection support: ${missingProjections.join(", ")}.`
      );
    }
  }
}
