# Engine Structure

This project is a small surface-driven VN engine plus one bundled starter game
package.

## Main Boundaries

- `src/engine/` is engine code. Implementation lives in responsibility folders:
  `assets/`, `audio/`, `commands/`, `config/`, `content/`, `dom/`, `runtime/`,
  `state/`, `surfaces/`, and `validation/`.
- `src/renderers/` contains built-in surface renderers.
- `src/game/` is the bundled starter package used by web/Vite builds.
- `src/game/scenes/` is auto-discovered scene content.
- `src/game/surface-modules/` is auto-discovered optional surface module
  content.
- `src/game/assets/` holds game images, audio, and sprites. Image and audio
  assets under this folder are discovered automatically.
- `templates/game-package/` is the starter package shape for a new game.
- `docs/` explains how authors and module builders use the engine.

For the public-engine/private-game workflow, see
`docs/GAME_PACKAGE_GUIDE.md`.

## Runtime Runner Split

`src/engine/runtime/scene-runner.js` owns live state and dependencies, while the
main behavior groups live in focused runtime modules:

- `command-executor.js`: command loop and command dispatch
- `save-controller.js`: save envelopes and load behavior
- `rollback-controller.js`: rollback snapshots, reconstruction, and replay
- `texting-controller.js`: text thread contacts, unread/read policy, and inbox
  actions
- `scene-loader.js`: label indexes, character resolution, and scene switching
- `beat-presenter.js`: narration, dialogue, choices, text blocks, stream beats,
  and scene endings
- `projection.js`: renderer/audio/background synchronization
- `surface-stack.js`: active surface stack lifecycle
- `phone-controller.js`: phone app navigation and phone-owned player actions

## Author Vocabulary

Scenes should import from their package-local `vn.js`, not directly from engine
internals. `vn.js` is the author-facing surface in both bundled and loose
package modes.

Internally, `stage("irl")`, `stage("texting")`, and `stage("streaming")`
activate surfaces. "Stage" is script terminology. "Surface" is engine
terminology.

## Current Built-In Surfaces

### IRL

The Ren'Py-like baseline surface:

- backgrounds
- sprites
- CGs and foreground image displayables
- dialogue and narration box
- choices
- audio commands
- `pause()`, `flash()`, and `shake()`

IRL visual state is runner-owned, not renderer-owned. Rollback snapshots include
visible sprites, CG/images, focus, background, audio, and history.
Audio playback is projected through `BrowserAudioService`, with durable music
and ambience channels plus one-shot sound/voice playback. Player-facing
master/music/ambience/sound/voice mixer settings layer over command volumes.

### Texting

Phone/thread presentation:

- `thread()`
- `say()` as text bubbles
- `photo()`/`textImage()`
- texting scrollback state

Texting can be opened over another surface with `open("texting")`.

### Streaming

Scripted stream presentation:

- stream title/layout/window
- stream image
- chat/system/post messages
- shared dialogue/narration

Streaming state is also runner-owned so rollback can reconstruct the stream
chrome and chat.

## Adding A Scene

1. Create a file in `src/game/scenes/`.
2. Export a `scene(...)` object.
3. Give it a unique `id`.
4. Add commands to `script`.

The scene registry uses `import.meta.glob`, so no hand-maintained scene index is
needed.
Files ending in `.example.js`, test/spec files, and files starting with `_` are
ignored by discovery. Use `src/game/scenes/basic-scene.example.js` as a
copyable starter.

One file may export one scene or a scene pack array:

```js
export const chapterOne = [
  scene({ id: "scene-010-intro", script: [stage("irl"), say("...")] }),
  scene({ id: "scene-011-followup", script: [stage("irl"), say("...")] })
];
```

Pack arrays are strict: every item in the array must be a valid scene. Helper
exports outside the array are fine. Use
`src/game/scenes/chapter-pack.example.js` as a copyable starter for chapter
or route packs.

Set the starting scene in `src/game/game.config.js` with `firstSceneId`. The
value must match a scene id exactly; the engine does not convert hyphens to
underscores for scene ids.

## Adding A Surface Module

A surface module declares:

- a stable surface id
- renderer command support
- command metadata
- state lifecycle hooks
- command handlers
- an optional renderer constructor export

Use `defineSurfaceModule(...)` from `src/engine/surfaces/index.js` or
`src/engine/surfaces/define-surface-module.js`. The registry validates module
shape, renderer contracts, and command metadata.

New modules should follow the same pattern as the built-ins in
`src/engine/surfaces/builtins/`: runner-owned state first, renderer projection
second. That keeps rollback/load deterministic. Built-ins and custom modules
both register through the same surface registry path.

For a copyable starting point, see:

```text
src/game/surface-modules/gallery.example.js
```

Files ending in `.example.js` or starting with `_` are ignored by discovery, so
templates can live beside real modules without registering themselves. Copy the
example to `gallery.js`, rename the ids/commands, and export:

- a `defineSurfaceModule(...)` result
- optional command helpers such as `galleryImage(...)`
- `rendererConstructors = { [surfaceId]: RendererClass }` when the module needs
  its own renderer

One file may also export a surface module pack array:

```js
export const deviceSurfaces = [
  phoneSurface,
  browserSurface,
  laptopSurface
];
```

Renderer constructors still use the surface id as the key:

```js
export const rendererConstructors = {
  phone: PhoneRenderer,
  browser: BrowserRenderer,
  laptop: LaptopRenderer
};
```

As with scene packs, every item inside a surface module pack array must be a
valid surface module definition.

If a command mutates module state, give it both `run` and `instant` handlers.
Live play and rollback/load reconstruction must apply the same state mutation.

## Adding Sprite Transitions

IRL sprite transitions use a small declarative registry in
`src/engine/dom/irl-stage-direction.js`. Game-specific names are registered from
`src/game/sprite-animations.js` before scene validation. See
`docs/SPRITE_COOKBOOK.md` for the author-facing defaults and extension recipe.

## Single Source Of Truth

`src/engine/command-meta.js` combines base command metadata and surface module
metadata. Validator, runner, and renderer contracts all read from the same
semantic table. Author command helpers are split by family under
`src/engine/commands/`, with `src/engine/commands/index.js` as the internal
barrel imported by `src/game/vn.js` and loose package author APIs.

When adding a command, make sure it is known to one of these:

- base command metadata for runner/compositor/audio/flow commands
- a surface module's command metadata for surface-owned render commands

## Validation

Validation lives under `src/engine/validation/`. It checks:

- render before any `stage()`
- wrong-surface commands
- unbalanced `open()`/`close()`
- duplicate marks
- missing flow targets
- sprite outfit/expression mistakes
- missing art/audio assets
- test/demo/prototype scene quarantine

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

## Game Configuration

`src/game/game.config.js` owns game-level configuration:

- title/subtitle/footer/about copy
- first scene id
- save/load shell labels
- save slot count
- end-card labels/messages
- storage key namespace and legacy fallback keys

This is the first place to edit when adapting the engine to another VN.

## Current Philosophy

The renderer displays projections of runner-owned state. It should not be the
source of truth for scene state. This is why rollback, debug overlay, save/load,
and validation can describe the same world.
