# Starter Game Package

This folder is the public starter package used by the local JiiShii demo and
bundled web build.

Drop scenes into `scenes/`, register reusable cast defaults in `characters.js`,
and place runtime assets under `assets/`. For a real project, this folder can be
replaced by a game package during local development while the engine files stay
clean.

Files ending in `.example.js`, `.test.js`, `.spec.js`, or starting with `_` are
ignored by runtime discovery.

`sprite-manifest.json` and `asset-suggestions.json` are generated convenience
files for the active package. The dev server and production build refresh them
automatically; run `npm.cmd run gen:sprites` or `npm.cmd run gen:suggestions`
manually when you want to update one directly.

`game.manifest.json` is the loose desktop package index. It is generated with
`npm.cmd run game:manifest` and is used when this package shape is shipped as a
sibling `game/` folder beside the desktop player.

See `docs/GAME_PACKAGE_GUIDE.md` for the recommended public-engine/private-game
workflow.
