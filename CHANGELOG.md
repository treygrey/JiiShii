# Changelog

All notable changes to JiiShii will be documented here.

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
