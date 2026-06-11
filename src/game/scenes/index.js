// =============================================================================
// game/scenes/index.js - auto-discovered scene registry
// Drop a .js file in this folder, export a scene(...) object, and it is added
// to the registry at build time by Vite. Template files named *.example.js,
// test/spec files, and files starting with _ are ignored.
// =============================================================================

import { buildSceneRegistry, resolveFirstSceneId } from "../../engine/content/content-discovery.js";
import { GAME_CONFIG } from "../game.config.js";

const SCENE_MODULES = import.meta.glob(
  ["./**/*.js", "!./index.js", "!./**/*.example.js", "!./**/*.test.js", "!./**/*.spec.js", "!./**/_*.js"],
  { eager: true }
);

/** All playable scenes keyed by id. */
export const SCENES = buildSceneRegistry(SCENE_MODULES);

/** Id of the scene a new game starts from. */
export const FIRST_SCENE_ID = resolveFirstSceneId(SCENES, GAME_CONFIG);
