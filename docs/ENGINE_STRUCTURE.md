# Engine Structure

This project is a small surface-driven VN engine plus one game
active game package.

## Main Boundaries

- `src/engine/` is engine code: runner, validation, state helpers, command
  metadata, rollback, renderer contracts, content discovery, audio, and
  compositor logic.
- `src/renderers/` contains built-in surface renderers.
- `src/game/` is the selected active game package.
- `src/game/scenes/` is auto-discovered scene content.
- `src/game/surface-modules/` is auto-discovered optional surface module
  content.
- `src/game/assets/` holds game images, audio, and sprites. Image and audio
  assets under this folder are discovered automatically.
- `templates/game-package/` is the starter package shape for a new game.
- `docs/` explains how authors and module builders use the engine.

## Author Vocabulary

Scenes should import from `src/game/vn.js`, not directly from
`src/engine/commands.js`. `vn.js` is the stable author-facing surface.

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
  scene({ id: "scene_010_intro", script: [stage("irl"), say("...")] }),
  scene({ id: "scene_011_followup", script: [stage("irl"), say("...")] })
];
```

Pack arrays are strict: every item in the array must be a valid scene. Helper
exports outside the array are fine. Use
`src/game/scenes/chapter-pack.example.js` as a copyable starter for chapter
or route packs.

Set the starting scene in `src/game/game.config.js` with `firstSceneId`.

## Adding A Surface Module

A surface module declares:

- a stable surface id
- renderer command support
- command metadata
- state lifecycle hooks
- command handlers
- an optional renderer constructor export

Use `defineSurfaceModule(...)` from `src/engine/surface-modules.js`. The
registry validates module shape, renderer contracts, and command metadata.

New modules should follow the same pattern as the built-ins: runner-owned state
first, renderer projection second. That keeps rollback/load deterministic.

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

IRL sprite transitions use a small declarative registry. Built-ins live in
`src/engine/irl-stage-direction.js`; game-specific names are registered from
`src/game/sprite-animations.js` before scene validation. See
`docs/SPRITE_COOKBOOK.md` for the author-facing defaults and extension recipe.

## Single Source Of Truth

`src/engine/command-meta.js` combines base command metadata and surface module
metadata. Validator, runner, and renderer contracts all read from the same
semantic table.

When adding a command, make sure it is known to one of these:

- base command metadata for runner/compositor/audio/flow commands
- a surface module's command metadata for surface-owned render commands

## Validation

The validator checks:

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
