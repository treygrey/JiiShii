# Changelog

All notable changes to JiiShii will be documented here.

## Unreleased

### Added

- Block-style `condition()` branches with `if`, `then`, `elseIf`, and `else` command arrays.
- Structured condition predicates with `any`, `all`, and `not`, while keeping JavaScript predicate functions as an escape hatch.
- Browser-level smoke tests for the guided phone tour, including phone navigation, gallery wallpaper, social interactions, and texting choice preservation.
- Build-time asset suggestion generation for discovered game assets.
- Game package guide covering clean engine/game separation and package layout.
- Tauri desktop wrapper trial for packaging the guided tour as a native app shell without changing the web-first game package.
- Loose desktop game package mode with `game.manifest.json`, sibling `game/` discovery, scoped `jiishii-game://` asset/module loading, and dev-mode manifest rebuilding.

### Changed

- Refactored the engine into responsibility-based runtime, command, surface, validation, state, audio, asset, content, config, and DOM modules while preserving legacy public import paths.
- Changed discovered asset ids to preserve filename-style hyphens instead of normalizing hyphenated names into snake case, with legacy aliases still generated for compatibility.
- Changed the author-facing `vn.js` package shim to load from the injected author API so the same scene imports work in bundled and loose package modes.
- Expanded `condition()` documentation to explain block branches, structured predicates, legacy mark/scene routing, and author-facing comparison rules.
- Strengthened phone, gallery, social, and asset validation messages with suggestions where possible.

### Fixed

- Made `condition()` string targets resolve through the same mark-or-scene path as `goto()`.
- Preserved phone wallpaper, gallery entries, social follows/posts, and phone display state through save/load paths.
- Kept phone app overlays above active IRL choices so phone navigation does not strand UI underneath decision prompts.
- Guarded phone/social scrolling and phone chrome controls so they do not trigger story rollback or advancement.

## 0.1.0-alpha.0 - 2026-06-07

Initial public alpha of the JiiShii engine.

### Added

- Surface-driven scene runner with IRL, texting, streaming, and phone-family surfaces.
- Shared Android-style phone system with Home, Gallery, Social, app badges, notifications, wallpaper, and modular app registration.
- Story-aware phone navigation so phone apps can pause and return to the active story surface.
- Rollback and roll-forward state reconstruction for readable scene beats, with visual state replay.
- Audio command support for music, ambience, sound effects, fade/crop/loop-style timing controls, and reusable audio scene presets.
- Sprite layering, manifest generation, replacement transitions, and author-facing sprite animation hooks.
- Author cookbooks for audio, sprites, phone apps, and scene programming.
- Starter game package and template package structure for separating engine code from game content.

### Changed

- Refined choice rendering for IRL and streaming surfaces.
- Reworked texting into both a story-driving surface and a navigable Messages app.
- Simplified public starter content and quarantined local/private game material from runtime discovery.

### Fixed

- Prevented phone chrome, app controls, and social scrolling from advancing or rolling back the story.
- Preserved active texting choices when navigating through phone Home.
- Avoided duplicate texting messages during state projection and active thread re-entry.
- Hardened streaming and texting renderers against missing message fields and unmounted projections.
