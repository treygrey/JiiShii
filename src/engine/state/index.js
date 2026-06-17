// =============================================================================
// STATE — the single serializable source of truth.
// Everything game-meaningful lives here: the variable store, the seeded PRNG,
// the script position, and the surface stack. Renderers are pure projections of
// this object; nothing authoritative may live in a renderer, closure, or the
// DOM. This is the discipline that makes save/load AND rollback possible —
// rollback is just "restore an earlier `state` and re-render."
// =============================================================================

import { createSpriteState, normalizeSpriteState } from "./sprite-state.js";
import { createVisualState, normalizeVisualState } from "./visual-state.js";
import { createAudioState, normalizeAudioState } from "../audio/audio-state.js";
import { createHistoryState, normalizeHistoryState } from "./history-state.js";

/** Default PRNG seed. Fixed so a fresh game is reproducible for testing. */
const DEFAULT_SEED = 0x9e3779b9;

/**
 * Creates the initial serializable game state.
 *
 * @returns {object} Empty deterministic state.
 */
export function createInitialState() {
  return {
    currentSceneId: null,
    currentCommandIndex: 0,
    currentSurface: "texting",
    /** @type {string[]} */
    surfaceStack: [],
    phoneNavigationSurface: null,
    choicesMade: [],
    // Unified variable store. Flags are just boolean vars; stats are just
    // numeric vars. One namespace = one source of truth.
    vars: {},
    // Save-persistent variables survive rollback and are stored in save files,
    // but they are not cross-playthrough persistent data.
    saveVars: {},
    // Save-var commands are non-rollbackable, so each script command applies
    // at most once per save file to prevent relative mutations from doubling.
    saveVarEvents: {},
    // Seeded PRNG state. All AUTHORED randomness (roll, random branches) draws
    // from here so replay/rollback reproduce identical results. Cosmetic-only
    // randomness (chat-pop jitter) may use Math.random since it never touches
    // saved state.
    rng: DEFAULT_SEED >>> 0,
    audio: createAudioState(),
    history: createHistoryState(),
    sprites: createSpriteState(),
    visuals: createVisualState()
  };
}

/**
 * Ensures an older/partial save has the fields this version expects. Migrates
 * legacy `flags`/`stats` into the unified `vars` store and backfills the PRNG.
 *
 * @param {object} saved - Parsed save object.
 * @returns {object} The same object, normalized in place.
 */
export function migrateState(saved) {
  if (!saved.vars) {
    saved.vars = { ...(saved.stats ?? {}), ...(saved.flags ?? {}) };
  }
  if (!saved.saveVars || typeof saved.saveVars !== "object" || Array.isArray(saved.saveVars)) {
    saved.saveVars = {};
  }
  if (!saved.saveVarEvents || typeof saved.saveVarEvents !== "object" || Array.isArray(saved.saveVarEvents)) {
    saved.saveVarEvents = {};
  }
  if (typeof saved.rng !== "number") {
    saved.rng = DEFAULT_SEED >>> 0;
  }
  if (!Array.isArray(saved.surfaceStack)) {
    saved.surfaceStack = [];
  }
  if (typeof saved.phoneNavigationSurface !== "string") {
    saved.phoneNavigationSurface = null;
  }
  saved.audio = normalizeAudioState(saved.audio);
  saved.history = normalizeHistoryState(saved.history);
  saved.sprites = normalizeSpriteState(saved.sprites);
  saved.visuals = normalizeVisualState(saved.visuals);
  return saved;
}

/**
 * Advances the seeded PRNG (mulberry32) and returns a float in [0, 1).
 * Mutates `state.rng` so the sequence is part of saved state.
 *
 * @param {object} state - Game state holding `rng`.
 * @returns {number} Pseudo-random float in [0, 1).
 */
export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Returns a seeded integer in [min, max] inclusive, advancing the PRNG.
 *
 * @param {object} state - Game state holding `rng`.
 * @param {number} min - Inclusive lower bound.
 * @param {number} max - Inclusive upper bound.
 * @returns {number} Seeded integer.
 */
export function rollInt(state, min, max) {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

/**
 * Applies value mutations to the variable store.
 *
 * - number / boolean   → absolute set
 * - "+N" / "-N" string  → add/subtract
 * - anything else       → set as-is
 *
 * @param {object} vars - Mutable variable store (`state.vars`).
 * @param {object} mutations - Mutations keyed by variable name.
 * @returns {void}
 */
export function applyVarMutations(vars, mutations = {}) {
  for (const [key, mutation] of Object.entries(mutations)) {
    if (typeof mutation === "number" || typeof mutation === "boolean") {
      vars[key] = mutation;
    } else if (typeof mutation === "string" && /^[+-]\d+$/.test(mutation)) {
      vars[key] = (vars[key] ?? 0) + Number(mutation);
    } else {
      vars[key] = mutation;
    }
  }
}
