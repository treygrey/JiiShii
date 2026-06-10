# Separate Game Packages

JiiShii is easiest to maintain when the engine and the game are separate
projects.

Use the engine repo for engine code, docs, tests, and the public starter game.
Use a separate game package for your private story, scenes, assets, characters,
and custom surface modules.

## Recommended Layout

Keep two folders:

```text
JiiShii/
  src/
    engine/
    renderers/
    game/              # public starter package or active local package

MyGame/
  game-package/
    game.manifest.json
    assets/
    scenes/
    surface-modules/
    characters.js
    game.config.js
    vn.js
    sprite-manifest.json
    asset-suggestions.json
```

`src/game` is the active package the engine runs. For public engine work, keep
it as the starter package. For private game work, copy or replace that folder
from your game package in your own private checkout.

Do not commit private VN content into the public engine repo.

## What Belongs In A Game Package

A game package owns:

- `game.config.js`
- `characters.js`
- `vn.js`
- `game.manifest.json`
- `scenes/`
- `surface-modules/`
- `assets/`
- `sprite-manifest.json`
- `asset-suggestions.json`

The engine owns:

- `src/engine/`
- `src/renderers/`
- `src/ui/`
- `scripts/`
- `docs/`
- `templates/`

## Starting A New Game Package

Copy the template:

```powershell
Copy-Item -Recurse templates\game-package C:\path\to\MyGame\game-package
```

Then edit:

- `game.config.js` for title, first scene, save labels, and phone defaults
- `characters.js` for global cast defaults
- `scenes/` for story scenes
- `assets/` for images, audio, and sprites

The starter `vn.js` should normally stay as the local author API shim. Scenes
import author commands from `../vn.js`, not from engine internals.

## Working Locally

The simple workflow is:

1. Keep `JiiShii` as the engine checkout.
2. Keep your real game package in its own private folder or repo.
3. Copy your game package into `JiiShii/src/game` only when you want to run it
   against the engine.
4. Pull engine updates into the game project through Git, not by mixing private
   story files into the public engine repo.

If you use a temporary local junction/symlink during development, treat it as
local-only. Remove it before publishing engine changes.

## Bundled Mode Vs Loose Mode

JiiShii now has two package-loading modes:

- Bundled mode is the normal browser/Vite workflow. The active package lives in
  `src/game`, Vite discovers files at build time, and the starter tour ships in
  the web bundle.
- Loose mode is for the desktop player. A compiled player looks for a sibling
  `game/` folder beside the executable and loads manifest-listed plain files
  through the scoped `jiishii-game://` protocol.

Loose desktop layout:

```text
JiiShii Player.exe
game/
  game.manifest.json
  game.config.js
  vn.js
  characters.js
  scenes/
  assets/
  surface-modules/
  sprite-animations.js
  sprite-manifest.json
```

The compiled player owns the engine. The loose `game/` folder owns authored
JavaScript, scenes, assets, config, and optional modules. This lets an author
patch story files or add assets without recompiling the player, and lets a
player replace the executable with an official or self-built one if they want
the engine binary separated from the authored game code.

Loose `.js` files are trusted executable game code. Hash checks are for
integrity, cache busting, and change detection; they are not DRM and they do
not make an unknown author safe.

## Loose Package Manifest

`game.manifest.json` is the desktop package entrypoint. It records:

- package mode: `dev` or `release`
- minimum engine version metadata
- config, character, scene, surface module, sprite recipe, and sprite manifest
  entry files
- every listed file's kind, size, modified time, and optional `sha256`

Dev mode behavior:

- On startup, the player scans the sibling `game/` folder.
- Missing, changed, or new files cause the manifest to be rebuilt.
- JavaScript files are hashed by default.
- Large images/audio are checked by size and modified time so startup stays
  fast.

Release mode behavior:

- The player reads `game.manifest.json` first.
- Missing files and changed executable files such as scenes, config, and
  surface modules are reported as warnings.
- Binary assets may change without hashing every image/audio file at launch;
  changed metadata still invalidates runtime asset URLs.

Manual manifest generation:

```powershell
npm.cmd run game:manifest
node scripts/generate-game-manifest.mjs --root C:\path\to\MyGame\game
node scripts/generate-game-manifest.mjs --root C:\path\to\MyGame\game --mode release
```

Use `templates/game-package/game.manifest.json` as the minimal example shape.

## Asset Discovery

The engine discovers image and audio assets from `src/game/assets`.

Image examples:

```text
src/game/assets/backgrounds/room-day.png
src/game/assets/gallery/photo-001.webp
```

Audio examples:

```text
src/game/assets/audio/music/night-theme.ogg
src/game/assets/audio/sfx/phone-vibrate.wav
```

Author-facing ids preserve the path and filename text you chose. JiiShii drops
the file extension and the leading package asset root; it does not lowercase,
swap separators, or convert hyphens and underscores.

```text
assets/backgrounds/room-day.png -> backgrounds/room-day, room-day
assets/audio/sfx/phone_vibrate.wav -> sfx/phone_vibrate, phone_vibrate
```

Short ids are available when they are unambiguous. If two files want the same
short id, the validator asks you to use a longer explicit id.

Generated snake_case or kebab-case aliases are not created. Scene ids, image
ids, audio ids, and transition targets must match the authored id exactly.

## Generated Convenience Files

Two generated files live in the active game package:

```text
src/game/sprite-manifest.json
src/game/asset-suggestions.json
```

`sprite-manifest.json` is runtime data for layered sprites.

`asset-suggestions.json` is authoring convenience data. It lists discovered
image ids, audio ids, ambiguous ids, and sprite character/outfit/expression/body
ids. It is meant for validators, docs, and future editor extensions.

Both files update automatically when the Vite dev server or build runs.

Manual commands:

```powershell
npm.cmd run gen:sprites
npm.cmd run gen:suggestions
npm.cmd run game:manifest
```

## Desktop App Trial

JiiShii includes a Tauri desktop wrapper trial under `src-tauri/`. The wrapper
loads the same Vite web build, so authors keep writing scenes, assets, and
surface modules in JavaScript. The Rust side is intentionally tiny and should be
treated as packaging infrastructure, not game-authoring code.

For a clean zero-to-compiled-player walkthrough, see
`docs/COMPILING_DESKTOP_PLAYER.md`.

Useful commands:

```powershell
npm.cmd run dev:app
npm.cmd run build:app
```

Tauri requires Rust and platform build tools on the machine that creates the
desktop package. Authors should not need to write Rust for ordinary games; they
only need the toolchain installed if they are packaging the app themselves.

Current trial behavior:

- `npm.cmd run dev:app` starts the Vite dev server and opens the game in a
  native desktop window.
- `npm.cmd run build:app` runs `npm run build`, then packages `dist/`.
- The bundled starter package opens the guided phone tour because
  `src/game/game.config.js` sets `firstSceneId`.
- If a sibling `game/` folder exists beside the desktop executable, the player
  attempts loose mode first and falls back to the bundled starter when no loose
  package is present.

## Phone Package Defaults

Phone defaults live in `game.config.js`:

```js
phone: {
  enabled: true,
  button: true,
  apps: ["texting", "gallery", "social"],
  homeAppOrder: ["texting", "gallery", "social"],
  defaultWallpaper: null
}
```

Scenes can still change phone availability mid-game:

```js
phoneButton(true)
phoneApps(["texting", "gallery"])
openPhone("gallery")
```

If the phone button is disabled, the phone Home button is disabled too. That
prevents a player from navigating away from a phone surface with no way back.

## Publishing Checklist

Before pushing engine changes:

- Run `git status --short`.
- Confirm no private scenes, assets, archives, saves, or local package copies
  are staged.
- Run `npm.cmd run test`.
- Run `npm.cmd run test:browser` when UI surfaces changed.
- Run `npm.cmd run build`.

Before pushing a private game package:

- Keep engine source changes out of the game repo unless they are intentional.
- Include generated `sprite-manifest.json` and `asset-suggestions.json` when the
  game package expects them.
- Do not depend on ignored local-only symlinks or absolute desktop paths.
