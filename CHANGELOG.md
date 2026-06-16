# Changelog

All notable changes to JiiShii will be documented here.

## Unreleased

### Added

- Persistent cross-playthrough state domain: a third storage domain beside story state and player settings that never rolls back and never lives inside save envelopes. It records seen text, seen choices, extras unlocks, and route flags under a configurable `storage.persistent` key, with an in-memory fallback when browser storage is unavailable.
- Seen-text tracking: readable beats are recorded as read at display time, and skip mode now stops at the first unseen beat instead of blasting past unread content.
- Seen-choice indicators: options the player picked on any previous playthrough render with a checkmark across IRL, streaming, and texting choice trays.
- Route completion flags and New Game+ support via the `persistFlag()` command, with `persistent:`-prefixed flag names readable in `condition()` and `showIf` (e.g. `showIf: "persistent:alex_route_done"`). Persistent flags re-apply during replay so saves loaded on a fresh browser still record passed flags.
- Extras gallery and music room on the title screen, driven by `extras` config in `game.config.js`. Entries unlock automatically the first time a CG/image is shown, a gallery photo is saved, or a music track plays.
- `input()` command: a blocking beat that collects typed player text into a story variable, with prompt/placeholder/default/maxLength options and a compositor-owned panel that works on any surface.
- `video()` command: full-screen video cutscenes with skippable/volume/loop options, automatic `.webm`/`.mp4` asset discovery under game assets, validator checks for unknown video ids, and graceful skip when an asset is missing or autoplay is rejected.
- Save-persistent variables via `saveVar()`, `saveAdd()`, `saveFlag()`, and `clearSaveFlag()`: a save-file-local state domain that survives rollback, is stored in saves, and is readable in `condition()`/`showIf` with the `save:` prefix.
- Block-style `condition()` branches with `if`, `then`, `elseIf`, and `else` command arrays.
- Structured condition predicates with `any`, `all`, and `not`, while keeping JavaScript predicate functions as an escape hatch.
- Browser-level smoke tests for the guided phone tour, including phone navigation, gallery wallpaper, social interactions, and texting choice preservation.
- Browser regression coverage for authored-frame layout, title menu containment, phone/stream 16:9 sizing, skip modes, seen choices, Extras interaction, save/load, keyboard shortcuts, and streaming rollback chat projection.
- Build-time asset suggestion generation for discovered game assets.
- Game package guide covering clean engine/game separation and package layout.
- Tauri desktop wrapper trial for packaging the guided tour as a native app shell without changing the web-first game package.
- Loose desktop game package mode with `game.manifest.json`, sibling `game/` discovery, scoped `jiishii-game://` asset/module loading, and dev-mode manifest rebuilding.
- Modal `phone_call` story surface with Android-style call UI, transcript/caption presentation for normal `say()`/`narrate()`/`choice()` beats, disabled hang-up by default, and phone navigation blocked while a call is active.
- Calls phone app with Recents and Voicemail tabs, automatic recent-call logging with per-call opt-out, voicemail authoring via `voicemail()`, and optional voicemail audio playback through the existing voice channel.
- Unified media displayable helpers for authored images and video, including advanced `media()`, `moveMedia()`, and `clearMedia()` commands for IRL-stage overlays.
- `streamVideo()` command for videos inside the streaming surface, with replace, hold, and loop modes plus millisecond start/end crop controls.

### Changed

- Refactored the engine into responsibility-based runtime, command, surface, validation, state, audio, asset, content, config, and DOM modules while preserving legacy public import paths.
- Changed discovered asset ids to preserve filename-style hyphens instead of normalizing hyphenated names into snake case, with legacy aliases still generated for compatibility.
- Changed the author-facing `vn.js` package shim to load from the injected author API so the same scene imports work in bundled and loose package modes.
- Expanded `condition()` documentation to explain block branches, structured predicates, legacy mark/scene routing, and author-facing comparison rules.
- Strengthened phone, gallery, social, and asset validation messages with suggestions where possible.
- Added author-controlled display constraints with a fixed authored-frame aspect ratio, configurable narration line width, font scaling, and reduced-motion presentation settings.
- Reworked the shell, title menu, phone surfaces, and streaming surface to size from the authored frame instead of the browser viewport.
- Expanded the guided phone tour to cover modal phone calls, recent calls, and voicemail alongside Gallery, Social, Streaming, and Messages.
- Moved backgrounds, IRL image/CG displayables, full-screen video, and streaming media toward a shared normalized media model while preserving the simple author-facing wrappers.
- Expanded background, image, CG, video, and stream media controls with fit, position, layer, width/height, alpha, timing, and video playback fields where appropriate.

### Fixed

- Made `condition()` string targets resolve through the same mark-or-scene path as `goto()`.
- Preserved phone wallpaper, gallery entries, social follows/posts, and phone display state through save/load paths.
- Kept phone app overlays above active IRL choices so phone navigation does not strand UI underneath decision prompts.
- Guarded phone/social scrolling and phone chrome controls so they do not trigger story rollback or advancement.
- Fixed title menu layout so it stays inside the configured authored frame and no longer exposes an old gray/purple document background sliver around the frame.
- Fixed phone Home sizing in 16:9 windows so the phone keeps its aspect ratio, stays on-screen, and its app labels do not collide when the frame is short.
- Fixed stream surface sizing so the browser-like stream panel stays inside the authored frame and clear of the quick menu.
- Fixed streaming rollback projection so in-flight chat reveal timers are cancelled before state projection, preventing duplicate chat rows after rolling back into a stream beat.

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
