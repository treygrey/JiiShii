// =============================================================================
// command-meta.js — the ONE source of truth for what each command type is and
// where it's allowed to run. The validator, the runner, and (eventually) the
// docs all read from here, so adding a command means teaching the engine once.
//
// Fields:
//   kind         "stage" | "flow" | "state" | "render" | "audio"
//   surface      required active surface for a render command, or null = any
//   needsSurface true if it needs a mounted renderer to do anything
//   blocks       true if it parks on player input (a beat or a decision)
// =============================================================================

import { BUILTIN_SURFACE_MODULES, surfaceCommandMeta } from "./surfaces/index.js";

/** @type {Record<string, { kind: string, surface?: string|null, needsSurface?: boolean, blocks?: boolean }>} */
export const BASE_COMMAND_META = {
  // --- Stage / surface control ---
  surface: { kind: "stage" },
  openLayer: { kind: "stage" },
  closeLayer: { kind: "stage" },

  // --- Flow control ---
  label: { kind: "flow" },
  goto: { kind: "flow" },
  condition: { kind: "flow" },
  endScene: { kind: "flow" },
  pause: { kind: "flow", surface: null, needsSurface: false, blocks: true },

  // --- State mutation ---
  setVar: { kind: "state" },
  setSaveVar: { kind: "state" },
  setFlag: { kind: "state" },
  roll: { kind: "state" },
  persistFlag: { kind: "state" },
  openPhone: { kind: "stage" },

  // --- Rendering: surface-agnostic (compositor-owned) ---
  background: { kind: "render", surface: null, needsSurface: false },
  flash: { kind: "render", surface: null, needsSurface: false },
  shake: { kind: "render", surface: null, needsSurface: false },
  narration: { kind: "render", surface: null, needsSurface: false },
  dialogue: { kind: "render", surface: null, needsSurface: true, blocks: true },
  say: { kind: "render", surface: null, needsSurface: true, blocks: true },
  choice: { kind: "render", surface: null, needsSurface: true, blocks: true },
  transition: { kind: "render", surface: null, needsSurface: false, blocks: true },
  input: { kind: "render", surface: null, needsSurface: false, blocks: true },
  video: { kind: "render", surface: null, needsSurface: false, blocks: true },

  // --- Audio: runner-owned ---
  music: { kind: "audio", surface: null, needsSurface: false },
  stopMusic: { kind: "audio", surface: null, needsSurface: false },
  ambience: { kind: "audio", surface: null, needsSurface: false },
  audioScene: { kind: "audio", surface: null, needsSurface: false },
  stopAmbience: { kind: "audio", surface: null, needsSurface: false },
  sound: { kind: "audio", surface: null, needsSurface: false },
  stopSound: { kind: "audio", surface: null, needsSurface: false },
  voice: { kind: "audio", surface: null, needsSurface: false },
};

/** @type {Record<string, { kind: string, surface?: string|null, needsSurface?: boolean, blocks?: boolean }>} */
export const COMMAND_META = createCommandMeta();

/**
 * Creates command metadata for the supplied surface module set.
 *
 * @param {Array<object>} [surfaceModules] - Registered surface modules.
 * @returns {Record<string, { kind: string, surface?: string|null, needsSurface?: boolean, blocks?: boolean }>} Command metadata.
 */
export function createCommandMeta(surfaceModules = BUILTIN_SURFACE_MODULES) {
  return {
    ...BASE_COMMAND_META,
  // --- Rendering: surface modules ---
    ...surfaceCommandMeta(surfaceModules)
  };
}

/**
 * The surface a command must run on, or null if it works on any surface.
 *
 * @param {string} type - Command type.
 * @returns {string|null} Required surface id, or null.
 */
export function requiredSurface(type, commandMeta = COMMAND_META) {
  return commandMeta[type]?.surface ?? null;
}

/**
 * Whether a command needs a mounted renderer (an active surface) to do anything.
 *
 * @param {string} type - Command type.
 * @returns {boolean}
 */
export function needsSurface(type, commandMeta = COMMAND_META) {
  return commandMeta[type]?.needsSurface === true;
}

/**
 * Whether a command changes the surface stack (stage/open/close/push/pop).
 *
 * @param {string} type - Command type.
 * @returns {boolean}
 */
export function isStageCommand(type, commandMeta = COMMAND_META) {
  return commandMeta[type]?.kind === "stage";
}
