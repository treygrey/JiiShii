import { cloneSpriteState, createSpriteState, normalizeSpriteState } from "../sprite-state.js";
import { cloneVisualState, createVisualState, normalizeVisualState } from "../visual-state.js";
import { createSurfaceRegistry } from "./registry.js";

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
 * @param {Set<string>|Array<string>|null} [options.surfaceIds] - Optional surface ids to project.
 * @param {object} [options.context] - Projection context.
 * @returns {void}
 */
export function projectSurfaceState({
  state,
  renderers,
  registry = createSurfaceRegistry(),
  surfaceIds = null,
  context = {}
}) {
  const allowedSurfaceIds = surfaceIds ? new Set(surfaceIds) : null;
  for (const surface of registry.values()) {
    if (allowedSurfaceIds && !allowedSurfaceIds.has(surface.id)) {
      continue;
    }
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
