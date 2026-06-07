# JiiShii

JiiShii is a browser-native visual novel engine built around scriptable surfaces. It ships with a starter game package, automatic scene discovery, reusable surface modules, rollback, saves, audio, validation, and author-facing scene helpers.

## Current Status

This repository is the clean engine baseline. The bundled game package under `src/game` is intentionally small and neutral so authors can replace it with their own project files.

## Quick Start

```powershell
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Project Shape

```text
src/engine/              Engine runtime, validation, state, saves, audio, and command metadata
src/renderers/           Built-in renderers for IRL, texting, and streaming surfaces
src/ui/                  Player shell, menus, overlays, debug tools, and browser UI
src/game/                Active drop-in game package
templates/game-package/  Minimal starter package for a new game
docs/                    Author and engine documentation
scripts/                 Utility scripts, including sprite manifest generation
```

## Authoring A Game

The active game lives in `src/game`:

```text
src/game/game.config.js
src/game/scenes/
src/game/assets/
src/game/surface-modules/
src/game/vn.js
src/game/sprite-manifest.json
```

Scenes import from the local shim:

```js
import { scene, stage, say, show, choice } from "../vn.js";
```

A minimal scene looks like this:

```js
import { scene, stage, say, transition } from "../vn.js";

export default scene({
  id: "starter_scene",
  title: "Starter Scene",
  script: [
    stage("irl"),
    say("alex", "This is a clean starter scene."),
    transition("Restart", "starter_scene")
  ]
});
```

## Useful Commands

```powershell
npm run dev        # Start local dev server
npm run test       # Run Vitest suite
npm run build      # Build production bundle
npm run gen:sprites # Regenerate sprite manifest
```

## Documentation

Start with:

- `docs/PROGRAMMING_SCENES.md`
- `docs/ENGINE_STRUCTURE.md`
- `templates/game-package/README.md`

## License

License is not selected yet.
