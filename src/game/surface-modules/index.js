// =============================================================================
// game/surface-modules/index.js - auto-discovered surface module registry
// Drop a .js file in this folder and export a surface module definition. If the
// module needs a renderer, also export rendererConstructors = { [id]: Renderer }.
// Template files named *.example.js, test/spec files, or files starting with _
// are ignored.
// =============================================================================

import { buildSurfaceModuleDiscovery } from "../../engine/content-discovery.js";
import { BUILTIN_SURFACE_MODULES } from "../../engine/surface-modules.js";

const SURFACE_MODULE_FILES = import.meta.glob(
  ["./**/*.js", "!./index.js", "!./**/*.example.js", "!./**/*.test.js", "!./**/*.spec.js", "!./**/_*.js"],
  { eager: true }
);

export const {
  surfaceModules: SURFACE_MODULES,
  rendererConstructors: SURFACE_RENDERER_CONSTRUCTORS
} = buildSurfaceModuleDiscovery(SURFACE_MODULE_FILES, {
  builtinSurfaceModules: BUILTIN_SURFACE_MODULES
});
