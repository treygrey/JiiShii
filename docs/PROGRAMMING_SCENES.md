# Programming JiiShii Scenes

This is the author-facing vocabulary for JiiShii scenes. Scene files live in
`src/game/scenes/` and import from the local game shim:

```js
import {
  scene,
  stage,
  open,
  close,
  background,
  show,
  hide,
  move,
  say,
  narrate,
  choice,
  transition
} from "../vn.js";
```

Authors should import from `../vn.js`, not directly from `src/engine`. The shim
is the stable public surface for game packages.

## From Zero To A Game

The engine is split into reusable engine code and a game package. In bundled
web development, that package is `src/game/`. In desktop loose-package builds,
the same package shape lives in a sibling `game/` folder beside the player.

```text
src/
  engine/              JiiShii runtime, validation, state, saves, audio
  renderers/           built-in IRL, texting, and streaming renderers
  ui/                  player shell: title, menus, saves, history, preferences
  game/                your active game package
    game.config.js     title screen, first scene, shell labels, storage keys
    characters.js      global character names/colors/default sides
    vn.js              author command shim
    scenes/            scene files, auto-discovered
    assets/            images, audio, sprites
    surface-modules/   optional custom surfaces
    game.manifest.json loose desktop package index
    sprite-manifest.json
```

Basic workflow:

1. Edit `src/game/game.config.js` to name the game and choose the first scene.
2. Add global characters in `src/game/characters.js`.
3. Put images/audio/sprites under `src/game/assets/`.
4. Write scene files in `src/game/scenes/`.
5. Run the dev server and fix validator warnings/errors.
6. Build when ready.

Useful commands:

```powershell
npm.cmd run dev
npm.cmd run gen:sprites
npm.cmd run game:manifest
npm.cmd run test
npm.cmd run build
```

`npm.cmd run dev` starts the local Vite build. `npm.cmd run gen:sprites`
regenerates `src/game/sprite-manifest.json` after sprite files change.
`npm.cmd run game:manifest` regenerates the loose desktop package manifest.
Tests and build are the basic health gates.

## Changing The Title Screen

The title screen and player shell read from `src/game/game.config.js`.

```js
export const GAME_CONFIG = {
  title: "My Visual Novel",
  subtitle: "a story about impossible Tuesdays",
  footer: "demo build",
  about: "A short description shown in the About overlay.",
  firstSceneId: "scene-001-start",
  storageNamespace: "my-vn",
  display: {
    aspectRatio: "16:9",
    narrationMaxChars: 80
  },
  shell: {
    saveTitle: "Save Game",
    loadTitle: "Load Game",
    autosaveLabel: "Auto-Save",
    manualSlotCount: 6,
    manualSlotLabel: "Slot",
    preferencesTitle: "Preferences",
    preferencesDefaultsLabel: "Defaults",
    historyTitle: "History",
    historyEmptyLabel: "No dialogue yet.",
    confirmOverwrite: "Overwrite this save slot?",
    confirmLoad: "Load this save and leave the current moment?",
    endKicker: "End of scene",
    endTitle: "To be continued",
    endDefaultMessage: "The scene has ended.",
    returnToTitleLabel: "Return to title"
  },
  extras: {
    gallery: [
      { id: "chapter_one_cg", title: "Chapter One" }
    ],
    music: [
      { id: "main_theme", title: "Main Theme" }
    ]
  },
  storage: {
    save: "my-vn-save",
    autosave: "my-vn-autosave",
    settings: "my-vn-settings",
    slotPrefix: "my-vn-save-slot-",
    persistent: "my-vn-persistent"
  }
};
```

The important fields:

- `title`: main title screen heading.
- `subtitle`: title screen subtitle.
- `footer`: small build/status line on the title screen.
- `about`: text for the About overlay.
- `firstSceneId`: exact scene id used when the player presses Start. JiiShii
  does not rewrite `scene-001-start` into `scene_001_start`; use the same id
  you put in `scene({ id })`.
- `shell`: player-facing menu/save/history/preference labels.
- `display.aspectRatio`: authored game frame. Use `"16:9"`, `"4:3"`,
  `"21:9"`, or `"free"` for a fully responsive web layout.
- `display.narrationMaxChars`: approximate maximum narration/dialogue line
  length in characters. Defaults to `80`, which keeps ultrawide screens from
  stretching text into one long line.
- `storageNamespace`: shortcut that derives save, autosave, settings, slot, and
  persistent-progress keys for one game.
- `storage`: explicit localStorage keys. Use these only when you need full
  control; explicit keys override `storageNamespace`.
- `extras`: title-screen gallery/music entries. Entries stay locked until the
  story shows or plays the matching asset.

If the title screen still shows old text, reload the browser after changing
`game.config.js`.

## Replacing The Starter Game

The active package is `src/game/`. A fresh package shape is also available at:

```text
templates/game-package/
```

To start a new game:

1. Keep `src/engine`, `src/renderers`, and `src/ui` alone.
2. Replace the contents of `src/game` with your game package.
3. Keep the package-local `vn.js` unless you know you need to expose extra
   author helpers.
4. Set `GAME_CONFIG.firstSceneId`.
5. Add at least one scene with that id.

Files ending in `.example.js`, `.test.js`, `.spec.js`, or starting with `_` are
ignored by scene/module discovery. That lets you keep examples and private
scratch files beside real content without registering them.

For desktop sharing without recompiling the engine, keep the same package files
in a sibling `game/` folder beside the compiled player. See
`docs/GAME_PACKAGE_GUIDE.md` for loose package manifests and Tauri player
details.

## Characters

Global character defaults live in `src/game/characters.js`.

```js
export const GLOBAL_CHARACTERS = {
  player: {
    name: "Player",
    color: "#4a90e2",
    side: "right"
  },
  alex: {
    name: "Alex",
    color: "#FB6F92",
    side: "left",
    defaultOutfit: "casual",
    defaultExpression: "neutral"
  }
};
```

Useful fields:

- `name`: display name in dialogue/history.
- `color`: texting bubble or identity color.
- `side`: default message side, usually `"left"` for NPCs and `"right"` for
  the player.
- `defaultOutfit`: optional sprite outfit fallback.
- `defaultExpression`: optional sprite expression fallback.

Scene-local character declarations can override or add to globals:

```js
scene({
  id: "scene-010",
  cast: ["me", "alex"],
  characters: [
    { id: "alex", name: "Alex", defaultOutfit: "jacket" }
  ],
  script: [...]
});
```

Use `cast` for ordinary scenes. Use `characters` when a scene needs a local
override.

## Asset Folders And IDs

Put game assets under `src/game/assets/`.

```text
src/game/assets/
  backgrounds/
  scenes/
  audio/
    music/
    ambience/
    sfx/
    voice/
  sprites/
```

Image and audio ids are derived from filenames and folders without rewriting
the text you chose. JiiShii drops the extension and leading asset root, but it
does not lowercase, hyphenate, or convert underscores.

```text
src/game/assets/backgrounds/demo room/day.png
```

Can be referenced as:

```js
background("backgrounds/demo room/day")
```

The engine may also create shorter ids when they are unambiguous:

```js
background("day")
```

If two files would claim the same short id, the short id is omitted and the
validator reports explicit alternatives. Files with `OLD` in the path are
ignored by discovery.

Common asset commands:

```js
background("backgrounds/demo-room-day")
cg("cg/demo-cg")
image("note", "props/demo-note")
photo("alex", "photos/demo-photo")
streamImage("stream/demo-camera")
music("music/main-theme")
sound("sfx/door-slam")
```

## Images And Video Displayables

Use the simple wrappers first:

```js
background("backgrounds/demo-room-day", {
  fit: "cover",
  position: "center",
  transition: "dissolve",
  duration: 520
})

image("note", "props/demo-note", {
  layer: "front",
  fit: "contain",
  x: 50,
  y: 48,
  width: 38
})

cg("cg/demo-cg", { fit: "cover" })
video("intro_cutscene", { startAt: 0, endAt: 9000, volume: 0.9 })
```

For advanced placement, `media()` can show an image or video on the IRL stage:

```js
media("rain_overlay", {
  kind: "video",
  asset: "effects/rain-loop",
  layer: "front",
  fit: "cover",
  alpha: 0.45,
  loop: true,
  muted: true
})

moveMedia("rain_overlay", { alpha: 0, duration: 600 })
clearMedia("rain_overlay")
```

Layer names are semantic: `behind` renders behind character sprites, `front`
renders over sprites, `cg` fills the authored frame, and `overlay` sits above CG
but below engine UI. `background()` uses the same media pipeline internally, but
only exposes conservative background options in v1.

## Sprites

Sprites live under `src/game/assets/sprites/<character-id>/`.

Expected layout:

```text
src/game/assets/sprites/alex/
  alex_head.png
  alex_foreground_hair.png
  outfits/
    casual.png
    jacket.png
  emotions/
    neutral.png
    happy.png
    embarrassed.png
```

After adding or renaming sprite files, run:

```powershell
npm.cmd run gen:sprites
```

That updates `src/game/sprite-manifest.json`, which the runtime uses to resolve
outfits and expressions.

Sprite authoring example:

```js
show("alex", { outfit: "casual", expression: "neutral", at: "center" })
say("alex", "hello", { expression: "happy" })
move("alex", { at: "right", scale: 1.08 })
hide("alex", { transition: "fade" })
```

The validator warns when a character has sprite art but a shown sprite never
gets an outfit. That usually means the renderer would show a floating head or
bodyless expression.

## Save, Load, History, And Preferences

The shell is already wired:

- Start
- Continue
- Save
- Load
- History
- Preferences
- Auto
- Skip
- rollback/roll-forward

Authors mostly configure labels and storage keys in `GAME_CONFIG`. Scene-entry
autosaves and save-anywhere manual slots use the engine save envelope. Rollback
snapshots, save/load, debug overlay, and renderers all project from runner-owned
state.

Skip has two player preference modes. The default, **Seen text only**, stops at
the first unread dialogue/narration/text beat using cross-playthrough seen-text
tracking. **All text** is the opt-in fast-forward mode for players who want to
skip unread content too. Choice options selected on earlier playthroughs are
marked as seen when they appear again.

Keyboard defaults:

- `Esc`: close top overlay
- `H`: History
- `S`: Save
- `L`: Load
- `P`: Preferences
- `A`: Auto
- `Tab`: Skip
- `PageUp` / `PageDown`: rollback / roll-forward

## Mental Model

Authors write `stage("irl")`, `stage("texting")`, `stage("streaming")`, and `stage("phone_call")`
because that reads naturally in scripts. Internally, these are **surfaces**:
presentation modules with renderer capabilities, state, commands, validator
rules, save/load behavior, and rollback projection.

- `stage(id)` replaces the current surface stack.
- `open(id)` puts another surface over the current one.
- `close(id)` closes the top overlay and returns to the surface beneath it.

Layers must close in reverse order. If you open texting over a stream, close
texting before using stream-only commands again:

```js
stage("streaming")
streamTitle("First Stream")

open("texting")
thread("alex")
say("alex", "are you watching?")
close("texting")

streamSystem("Chat is live.")
```

The validator and runtime both enforce this stack. A script that only works by
accident should fail loudly before a player sees it.

## Scene Shape

```js
export default scene({
  id: "scene-010-example",
  title: "Example Scene",
  cast: ["me", "alex"],
  script: [
    stage("irl"),
    background("backgrounds/demo-room-day"),
    show("alex", { outfit: "casual", expression: "neutral", at: "center" }),
    say("alex", "This is a scene."),
    transition("Continue", "scene-011-next")
  ]
});
```

Required scene fields:

- `id`: stable scene id used by transitions and saves.
- `script`: ordered command array.

Common optional fields:

- `title`: save/load metadata and debug readability.
- `cast`: character ids available in this scene.
- `characters`: scene-local character declarations or overrides.
- `mode`: `"production"` or `"test"`. Demo/test/prototype ids are quarantined
  automatically.
- `contact`: texting header metadata for phone-style scenes.

The first `cast` entry is the default speaker for `say("line")`. `me` and
`you` are aliases for the player.

## IRL Surface

IRL is the baseline VN surface: backgrounds, sprites, CGs, foreground images,
dialogue, narration, choices, audio, and pacing effects.

### Backgrounds

```js
background("backgrounds/demo-room-day")
background("backgrounds/demo-room-night", { transition: "cut" })
background("backgrounds/demo-hall-day", { transition: "fade_to_black", duration: 900 })
```

Background state is runner-owned, so rollback and save/load restore it from
state instead of asking the renderer what it happened to show.

Built-in background transitions:

- `cut`
- `dissolve`
- `fade_to_black`

Unknown transition names are reported by the validator with suggestions and an
available-list hint.

### Sprites

```js
show("alex", {
  outfit: "casual",
  expression: "happy",
  at: "left",
  flip: true,
  transition: "dissolve"
})

expression("alex", "embarrassed")
move("alex", { at: "right", scale: 1.08 })
hide("alex", { transition: "moveOutRight" })
hideAll({ transition: "fade" })
clearStage({ transition: "fade" })
```

`show()` is sticky. If Alex is already visible, later
`show("alex", { expression: "smirk" })` preserves outfit, position, scale,
flip, alpha, z, and layer unless you change them.

Use `move()` when the character stays visible and only the transform changes.

Sprite state tracked by the runner:

```js
{
  id: "alex",
  outfit: "casual",
  body: "default",
  expression: "neutral",
  side: "left",
  flip: false,
  at: "left",
  x: null,
  y: null,
  scale: 1,
  alpha: 1,
  z: null,
  layer: "characters",
  transition: null,
  duration: null,
  easing: null
}
```

Known position presets include:

- `left`
- `center`
- `right`
- `far-left`
- `far-right`
- `nearLeft`
- `nearRight`
- `offscreenLeft`
- `offscreenRight`

Sprite transitions are named presets. Use them in `transition`, optionally with
`duration` or `easing`; see `docs/SPRITE_COOKBOOK.md` for built-in replacement
behavior and custom transition registration.

The validator checks transform numbers. `scale` must be greater than zero,
`alpha` must be between `0` and `1`, `z` must be a finite number, and `x`/`y`
must be finite numbers or non-empty CSS strings such as `"42%"` or `"8vh"`.

### CGs And Images

Use `cg()` for full event illustrations. Use `image()` for foreground props,
documents, inserts, UI screenshots, clue photos, and other displayables.

```js
cg("demo_cg", { transition: "dissolve" })
clearCg()

image("note", "demo_note", {
  at: "center",
  scale: 0.72,
  fit: "contain",
  transition: "dissolve"
})
moveImage("note", { at: "right", scale: 0.9 })
clearImage("note")
```

`image()` is sticky like `show()`. Use `moveImage()` when the asset stays the
same and only placement or transform changes.

Image `fit` values follow CSS object-fit names:

- `contain`
- `cover`
- `fill`
- `none`
- `scale-down`

CG/image state is rollback-safe and appears in the debug overlay.

## Dialogue And Narration

```js
say("alex", "hi")
say("alex", ["first line", "second line"])
say("I should not say that out loud.")
narrate("The room goes quiet.")
```

On IRL and streaming, `say()` uses the shared VN dialogue box. On texting,
`say()` becomes chat bubbles. The active surface decides the presentation.

Dialogue and narration are recorded into runner-owned history, so rollback,
save/load, and the History overlay describe the same read state.

Lower-level helpers are still available for grouped or legacy commands:

```js
block([text("alex", "first"), text("alex", "second")])
lineBlock([line("alex", "Spoken line."), line("riley", "Reply.")])
dialogue("alex", "Direct dialogue command.")
narration("Centered texting narration item.")
```

Prefer `say()` and `narrate()` for ordinary prose unless you specifically need
a grouped block.

## Pacing, Audio, And Effects

```js
audioScene("quiet_room", { transition: 1200 })

music("main_theme", { fadeIn: 1200 })
stopMusic({ fadeOut: 600 })

ambience("rain_loop", { fadeIn: 800, volume: 0.45 })
stopAmbience({ fadeOut: 500 })

sound("door_slam", { volume: 0.8 })
voice("line_001")

video("intro_cutscene", { skippable: true, volume: 0.9 })

pause(500)
flash({ color: "rgba(255,255,255,0.75)", duration: 120 })
shake({ intensity: 16, duration: 320 })
```

Prefer `audioScene()` for room or mood setup. Audio scenes are named presets in
`GAME_CONFIG.audioScenes` that set durable music and ambience together:

```js
audioScenes: {
  quiet_room: {
    music: { id: "main_theme", volume: 0.35, loop: true },
    ambience: { id: "room_tone", volume: 0.25, loop: true }
  }
}
```

Channel semantics:

- `music`: durable, one active track, restored by save/load/rollback.
- `ambience`: durable, one active loop in v1, restored by save/load/rollback.
- `sound`: transient one-shot, not replayed during rollback/load reconstruction.
- `voice`: transient one-shot, replaces current voice, not durable in v1.

For fades, named sounds, crops, duration cuts, loop windows, speed changes, and
rollback rules, see `docs/AUDIO_COOKBOOK.md`.

`video()` plays a full-screen cutscene from discovered `.webm`, `.mp4`, `.m4v`,
or `.ogv` files under `assets/`. It is a rollbackable beat: rolling back can
land on it again, and replay/load reconstruction skips past it deterministically.
Use `startAt` and `endAt` for millisecond crop points. `fit` and `position`
control how the clip fills the authored frame.

`pause()` is a skippable timed beat. A click advances past it. `flash()` and
`shake()` are transient compositor effects; pair them with `sound()` and
`pause()` for impact beats.

## Texting Surface

```js
stage("texting")
thread("alex")
say("alex", "home?")
photo("alex", "demo_photo", { caption: "proof" })
```

Texting commands only belong on the texting surface. The validator errors if
you call `thread()` while IRL or streaming is active.

Texting can be opened over another surface:

```js
stage("irl")
background("backgrounds/demo-room-day")

open("texting")
thread("alex")
say("alex", "look at your phone")
close("texting")

say("The phone goes dark.")
```

Texting scrollback is runner-owned so rollback can reconstruct the phone state.

## Phone Call Surface

```js
stage("phone_call")
call("alex", { title: "Connected" })
say("alex", "Are you alone?")
say("me", "Yeah.")
endCall()
```

Phone calls are story surfaces, not phone apps. They look like the Android-style
phone, but active calls are modal: the floating phone button and in-phone
navigation do not open Home or other apps until `endCall()` runs.

Use ordinary `say()`, `narrate()`, `choice()`, `voice()`, and `sound()` inside a
call. The active surface renders those beats as call transcript/caption text.

Calls auto-record to the Calls app by default. Add `{ log: false }` to
`call(...)` when the call should not appear in Recents.

Voicemail is a Calls app entry:

```js
voicemail("alex_vm_01", "alex", {
  text: "Call me back.",
  audio: "alex_voicemail_01",
  notify: true
})
```

## Streaming Surface

```js
stage("streaming")
streamLayout({ streamerName: "Alex", title: "First stream", viewers: 42 })
streamWindow("live", "demo_camera")
streamVideo("demo_clip", { mode: "replace", image: "demo_camera" })
streamChatBlock([
  streamChat("viewer1", "first"),
  streamChat("viewer2", "hello")
])
streamSystem("Stream started.")
streamPost("Keep it friendly.")
streamTitle("The room settles.")
```

Streaming chrome, chat, title, image, and window state are runner-owned and
rollback-safe.

`streamVideo()` plays inside the stream window. `mode: "replace"` swaps to the
provided still image when playback ends, `mode: "hold"` leaves the final frame
visible, and `mode: "loop"` keeps looping until another stream media command
replaces it. Stream videos default to muted playback so browser autoplay rules
do not stall the story.

Stream videos advance immediately by default, so chat and narration can arrive
while the clip is playing. Use `wait: true` only when the script should pause
until the stream video finishes.

## Choices And Flow

```js
choice([
  { text: "Answer honestly.", goto: "honest", set: { trust: "+1" } },
  { text: "Deflect.", goto: "deflect", showIf: "metAlex" }
])

mark("honest")
say("alex", "that helps")
goto("done")

mark("deflect")
say("alex", "nice try")

mark("done")
transition("Continue", "scene-011-next")
```

Use `mark()` for local labels and `goto()` for local labels or scene ids.
`transition(text, target)` shows a button. A `null` target ends the current
scene.

Legacy aliases remain available for old scripts:

- `jump(target)` for `goto(target)`
- `label(id)` for `mark(id)`
- `endScene()` for an explicit hard scene end

## State

```js
set("trust", 1)
add("trust", 1)
setFlag("metAlex")
clearFlag("metAlex")
roll("die", 1, 6)
saveVar("arcade_high_score", 50)
saveAdd("arcade_total_score", 50)
saveFlag("cleared_arcade")
input("player_name", {
  prompt: "What should people call you?",
  placeholder: "Name",
  maxLength: 32
})
condition({
  if: { flag: "metAlex" },
  then: [
    say("alex", "You came back.")
  ],
  else: [
    say("alex", "Do I know you?")
  ]
})
```

Variables, choices, PRNG state, surfaces, visuals, audio, and reader history are
serialized or snapshotted by the runner. That is why rollback can rebuild the
same moment instead of guessing from renderer DOM.

`input()` is a blocking, rollbackable beat. It writes the submitted text into a
normal story variable, so it saves and rolls back like other story state.

Use save-persistent variables when the player earns something that should not
roll back, but should still belong to the current save file:

```js
saveFlag("cleared_arcade")
saveVar("arcade_high_score", 50)
saveAdd("arcade_total_score", 50)

condition({
  if: { flag: "save:cleared_arcade" },
  then: [
    say("guide", "The arcade prize is still yours.")
  ]
})

choice([
  { text: "Claim the arcade prize.", goto: "prize", showIf: "save:cleared_arcade" },
  { text: "Keep walking.", goto: "walk" }
])
```

Save-persistent variables are written into save files and survive rollback. They
do not survive a brand-new game unless the author sets them again. Use the
`save:` prefix only when reading them in `condition()` or `showIf`.

`condition()` is the catchall branching command. It checks the current variable
store, runs the `then` commands when the check passes, tries `elseIf` branches in
order when it does not, and runs `else` commands when nothing matched.

Use it for inline dialogue or narration variation:

```js
condition({
  if: { flag: "found_keycard" },
  then: [
    say("guard", "You have clearance.")
  ],
  elseIf: [
    {
      if: { flag: "knows_password" },
      then: [
        say("guard", "Password accepted.")
      ]
    }
  ],
  else: [
    say("guard", "I can't let you in.")
  ]
})
```

Use compound predicates when one check depends on several facts:

```js
condition({
  if: {
    any: [
      { flag: "tour_start" },
      { var: "money", moreThan: 5 }
    ]
  },
  then: [
    say("me", "Hey!")
  ]
})
```

Condition checks use author-facing comparison rules instead of raw JavaScript
strict equality. Empty values, `0`, `"0"`, `false`, `"false"`, `"no"`, and
`"off"` all read as off; number-looking strings compare as numbers.

Supported condition shapes:

```js
condition({ flag: "metAlex", then: "yes", else: "no" })
condition({ var: "trust", is: 3, then: "yes", else: "no" })
condition({ var: "trust", isNot: 0, then: "yes", else: "no" })
condition({ var: "trust", atLeast: 3, then: "yes", else: "no" })
condition({ var: "trust", atMost: 3, then: "yes", else: "no" })
condition({ var: "trust", moreThan: 3, then: "yes", else: "no" })
condition({ var: "trust", lessThan: 3, then: "yes", else: "no" })
condition({ var: "name", hasText: true, then: "named", else: "anonymous" })
condition({ if: (vars) => vars.trust >= 3 && vars.metAlex, then: "yes", else: "no" })
```

Prefer the structured `if: { ... }` forms for new scenes:

```js
condition({ if: { flag: "metAlex" }, then: [say("alex", "hey")] })
condition({ if: { var: "trust", atLeast: 3 }, then: [say("alex", "okay")] })
condition({ if: { var: "name", hasText: true }, then: [say("alex", "nice name")] })
condition({
  if: {
    all: [
      { flag: "metAlex" },
      { not: { flag: "alexAngry" } }
    ]
  },
  then: [
    say("alex", "We're good.")
  ]
})
```

The function form is the JavaScript escape hatch for complex logic:

```js
condition({
  if: (vars) => vars.trust >= 3 && vars.metAlex,
  then: [
    say("alex", "I trust you.")
  ]
})
```

Use the named forms when they can express the branch, because the validator can
explain mistakes in plain language.

Persistent cross-playthrough flags are for route completion, endings, and New
Game+ gates. They live outside saves and rollback:

```js
persistFlag("route_a_complete")

condition({
  if: { flag: "persistent:route_a_complete" },
  then: [
    say("guide", "A new opening is available.")
  ]
})

choice([
  { text: "Use the new opening.", goto: "new_opening", showIf: "persistent:route_a_complete" },
  { text: "Start normally.", goto: "normal_opening" }
])
```

Use `persistent:` only for cross-playthrough flags. Use `save:` for save-file
durable variables. Ordinary story variables should stay unprefixed.

`then` and `else` can also be string targets for mark/scene routing. This is the
legacy form and remains useful when scene structure should split:

```js
condition({ flag: "metAlex", then: "alex_knows_you", else: "alex_stranger" })

mark("alex_knows_you")
say("alex", "You came back.")
goto("after_alex_intro")

mark("alex_stranger")
say("alex", "Do I know you?")

mark("after_alex_intro")
say("me", "Anyway...")
```

## Validation Rules To Remember

- Start rendering with `stage(...)`.
- Use commands on the surface they belong to.
- Close overlays in reverse order.
- Do not duplicate `mark()` names.
- Do not point `goto()` or `transition()` at missing targets.
- Give visible sprite characters an outfit.
- Missing art/audio assets warn, but do not block boot.
- Scenes whose ids include `demo`, `prototype`, or `test` are quarantined as
  test scenes unless `mode` says otherwise.

The validator is intentionally author-facing. Its job is to catch mistakes
while the project boots, before a player finds them mid-scene.

## Adding Scenes

Put scene modules under `src/game/scenes/`. The scene registry is discovered
automatically by Vite; you should not maintain a hand-written scene index.

Ignored files:

- files ending in `.example.js`
- files ending in `.test.js` or `.spec.js`
- files starting with `_`

One file may export one scene or a scene pack array:

```js
export const chapterOne = [
  scene({ id: "scene-010-intro", script: [stage("irl"), say("...")] }),
  scene({ id: "scene-011-followup", script: [stage("irl"), say("...")] })
];
```

Pack arrays are strict: every item in the array must be a valid scene. Helper
exports outside the array are fine. Use
`src/game/scenes/chapter-pack.example.js` as a copyable starter.

Set the starting scene in `src/game/game.config.js` with `firstSceneId`. It must
match the scene id exactly.

## Adding Assets

Put backgrounds, CGs, phone photos, stream images, music, sounds, voice lines,
and sprites under `src/game/assets/`.

Image and audio ids are derived from filenames and folders:

```text
src/game/assets/backgrounds/demo room/day.png
```

Can be referenced as:

```js
background("backgrounds/demo room/day")
```

Short ids exist only when they are unambiguous. If two files would claim the
same short id, the engine keeps folder-qualified ids and omits the ambiguous
short one. Missing or ambiguous ids produce validator warnings with available
alternatives.

Files with `OLD` in the path are ignored by discovery.

## Adding Surface Modules

Put optional surface modules under `src/game/surface-modules/`. Real modules
are discovered automatically. Template files ending in `.example.js` are
ignored; copy `gallery.example.js` when you want a starting point for a phone
gallery, browser, laptop, or other scripted surface.

A surface module declares:

- stable surface id
- renderer command support
- command metadata
- state lifecycle hooks
- command handlers
- optional renderer constructor export

Several related surfaces can live in one module pack:

```js
export const deviceSurfaces = [phoneSurface, browserSurface, laptopSurface];

export const rendererConstructors = {
  phone: PhoneRenderer,
  browser: BrowserRenderer,
  laptop: LaptopRenderer
};
```

Use `stage("phone")`, `open("browser")`, and so on in scripts. In engine
terminology those are surfaces; in the authoring language, `stage(...)` is the
verb that activates one.

If a command mutates module state, give it both live and instant reconstruction
behavior. Live play and rollback/load reconstruction must apply the same state
mutation.

## Changing The Look

Most player-facing layout and styling lives in `src/styles.css`.

Use `game.config.js` for text/content changes:

- game title
- subtitle
- footer
- About text
- save/load/history/preferences labels
- storage namespace

Use `src/styles.css` for visual treatment:

- title screen typography and spacing
- dialogue box sizing
- phone/texting presentation
- stream layout
- menu and overlay styling
- color palette

Use renderer files only when the structure of a surface changes:

```text
src/renderers/irl/irl-renderer.js
src/renderers/texting/texting-renderer.js
src/renderers/streaming/streaming-renderer.js
```

For game-specific scripted interfaces, prefer a surface module in
`src/game/surface-modules/` instead of editing built-in renderers.

## Debugging While Authoring

Press the backtick key to toggle the debug overlay. It shows:

- current scene id
- current command index
- active surface and surface stack
- next command
- rollback position
- visible sprites
- variables

Common authoring failures:

- `say()` before `stage()`: add a stage command first.
- `thread()` on IRL: open or stage texting first.
- `show()` on texting: close texting or stage IRL first.
- `close("texting")` when streaming is top: close the actual top layer first.
- missing image/audio id: check the generated asset id or file location.
- missing sprite outfit/expression: run `npm.cmd run gen:sprites` and check
  folder names.

## 0-To-100 Checklist

1. Rename the game in `src/game/game.config.js`.
2. Change `storage` keys so saves are unique to your game.
3. Set `firstSceneId`.
4. Define global characters in `src/game/characters.js`.
5. Add backgrounds, CGs, audio, and sprites under `src/game/assets/`.
6. Run `npm.cmd run gen:sprites` if you added sprite art.
7. Write your first scene in `src/game/scenes/`.
8. Start with `stage("irl")`, `stage("texting")`, or `stage("streaming")`.
9. Connect scenes with `transition()` or `goto()`.
10. Add choices/state only after the linear version plays correctly.
11. Run `npm.cmd run test`.
12. Run `npm.cmd run build`.
13. Open the dev server and play from Start through your latest scene.
14. Fix validator errors first, then warnings.
15. Package or deploy the `dist/` output when the build is clean.

The engine goal is boring authoring: drop files into the game package, write
scripts with `../vn.js`, let discovery find the content, and let validation
complain before players do.
