# Compiling The Desktop Player

This guide takes an author from a clean machine to a desktop JiiShii player
that can run their own game package.

Most authors should not need to edit Rust. Rust is only part of the desktop
wrapper build. Scenes, config, assets, and custom surface modules stay in the
plain JavaScript game package.

## The Two Build Modes

JiiShii has two practical desktop packaging modes:

```text
Bundled mode:
  Compile the engine and the active src/game package into one app.

Loose mode:
  Compile the engine/player once, then put a plain game/ folder beside it.
```

Loose mode is the preferred author workflow right now. It keeps the compiled
engine separate from the authored game files:

```text
My Game/
  jiishii.exe
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

The player starts in loose mode when it finds a sibling `game/` folder beside
the executable. If there is no sibling package, it falls back to the bundled
starter package.

## Install Requirements

Install Node.js first:

```powershell
winget install OpenJS.NodeJS.LTS
```

Install Rust through rustup:

```powershell
winget install Rustlang.Rustup
```

Install Microsoft C++ build tools. The easiest route is Visual Studio Build
Tools with the Desktop development with C++ workload:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

After installing Rust, open a new terminal and verify:

```powershell
node --version
npm --version
cargo --version
```

If `cargo` is not found, Rust installed correctly but the terminal did not pick
up the PATH change. Close and reopen the terminal. If it still fails, this
temporary command works for the current terminal:

```powershell
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo --version
```

## Get The Engine

Clone or download JiiShii:

```powershell
git clone https://github.com/treygrey/JiiShii.git
cd JiiShii
npm install
```

Run the normal checks:

```powershell
npm.cmd run test
npm.cmd run build
```

## Build The Desktop Player

Compile the Tauri desktop player:

```powershell
npm.cmd run build:app
```

The raw executable is written here:

```text
src-tauri/target/release/jiishii.exe
```

Installers are written here:

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

For loose-package testing, the raw `jiishii.exe` is enough.

## Prepare A Loose Game Folder

Create a release folder anywhere:

```powershell
New-Item -ItemType Directory C:\path\to\MyGame
Copy-Item src-tauri\target\release\jiishii.exe C:\path\to\MyGame\jiishii.exe
```

Copy a starter package into `game/`:

```powershell
Copy-Item -Recurse templates\game-package C:\path\to\MyGame\game
```

Or copy your own package, as long as it has the same shape:

```text
game/
  game.config.js
  vn.js
  characters.js
  scenes/
  assets/
  surface-modules/
  sprite-animations.js
  sprite-manifest.json
  game.manifest.json
```

Generate or refresh the loose package manifest:

```powershell
npm.cmd run game:manifest -- --root C:\path\to\MyGame\game
```

For a release package:

```powershell
npm.cmd run game:manifest -- --root C:\path\to\MyGame\game --mode release
```

Then launch:

```powershell
C:\path\to\MyGame\jiishii.exe
```

## Authoring Loop For Loose Games

While developing a game:

1. Edit files inside `MyGame/game`.
2. Regenerate generated indexes when needed.
3. Relaunch `jiishii.exe`.

Useful commands from the JiiShii repo:

```powershell
npm.cmd run gen:sprites -- --root C:\path\to\MyGame\game
npm.cmd run gen:suggestions -- --root C:\path\to\MyGame\game
npm.cmd run game:manifest -- --root C:\path\to\MyGame\game
```

`sprite-manifest.json` indexes layered sprites. `asset-suggestions.json` helps
authoring tools and validators suggest ids. `game.manifest.json` tells the
desktop player which loose files to load.

## Bundled Game Builds

Bundled mode is useful when you want the starter package or a specific game
compiled directly into the app:

1. Replace `src/game` with the game package you want to bundle.
2. Run generated-file commands for that package.
3. Run `npm.cmd run build:app`.

Example:

```powershell
npm.cmd run gen:sprites
npm.cmd run gen:suggestions
npm.cmd run game:manifest
npm.cmd run build:app
```

The bundled app still tries loose mode first if a sibling `game/` folder exists
beside the executable. Delete or rename the sibling `game/` folder when you want
to test only the bundled package.

## Release Checklist

Before sharing a loose desktop folder:

- Launch `jiishii.exe` from the release folder, not from the engine repo.
- Confirm the app is loading the sibling `game/` package.
- Confirm `game.manifest.json` exists.
- Confirm private source-only notes, archives, saves, and local scratch files
  are not inside `game/`.
- Confirm generated files are current:
  - `sprite-manifest.json`
  - `asset-suggestions.json`
  - `game.manifest.json`
- Zip the folder that contains both `jiishii.exe` and `game/`.

## Troubleshooting

`cargo` is not recognized:

- Open a fresh terminal after installing Rust.
- Run `$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"` for the current
  terminal if needed.

The app opens the starter tour instead of your game:

- Make sure the folder beside `jiishii.exe` is named exactly `game`.
- Make sure `game/game.manifest.json` exists.
- Regenerate the manifest with `npm.cmd run game:manifest -- --root ...`.

The app says a dynamic import failed:

- Check that the missing file exists under `game/`.
- Regenerate `game.manifest.json`.
- If the file was renamed, update imports in your scene or module files.

An asset id does not resolve:

- Check that the file is under `game/assets`.
- Regenerate `asset-suggestions.json`.
- For layered sprites, regenerate `sprite-manifest.json`.

The build succeeds but Git is full of build output:

- `dist/` and `src-tauri/target/` are build output.
- They should remain ignored and should not be committed.
