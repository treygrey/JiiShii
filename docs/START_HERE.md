# Start Here: Writing A JiiShii Scene

This guide is the shortest useful path from an empty file to a playable scene.
It teaches the surface-level commands first. You do not need to understand every
export in `vn.js` to write a visual novel.

For deeper command shapes, JavaScript predicates, persistence, media layers, and
custom surfaces, read `docs/ADVANCED_AUTHORING.md` after this guide.

## The Mental Model

A JiiShii scene is a JavaScript module that exports one `scene(...)`.

The scene has a `script` array. The engine reads that array from top to bottom.
Each item in the array is a command:

```js
script: [
  stage("irl"),
  say("alex", "Hello."),
  transition("Continue", null)
]
```

Start with this rule:

- `stage(...)` chooses where the story is happening.
- `say(...)` and `narrate(...)` show story text.
- `choice(...)` asks the player to decide.
- `mark(...)` names a spot.
- `goto(...)` jumps to a spot or another scene.
- `transition(...)` shows a continue button or ends the scene.

Everything else can wait.

## Important Rules

- Import from `../vn.js`, not from `src/engine`.
- Scene ids, character ids, asset ids, and mark names are exact. JiiShii does
  not rewrite kebab case into snake case.
- Put scene files in `src/game/scenes/`.
- Start rendering with `stage("irl")`, `stage("texting")`, `stage("streaming")`,
  or another registered story surface.
- Time values are milliseconds. `1000` means one second.
- Build the linear version first. Add branches after the scene plays.

## Your First Scene

Create a file in `src/game/scenes/`, for example:

```text
src/game/scenes/scene-001-start.js
```

Paste this:

```js
import {
  background,
  choice,
  goto,
  mark,
  narrate,
  say,
  scene,
  show,
  stage,
  transition
} from "../vn.js";

export default scene({
  id: "scene-001-start",
  title: "First Scene",
  cast: ["me", "alex"],
  script: [
    stage("irl"),

    background("starter-room-day"),
    show("alex", {
      outfit: "casual",
      expression: "neutral",
      at: "center",
      transition: "dissolve"
    }),

    narrate("The room is quiet enough that every decision sounds louder."),
    say("alex", "You made it."),

    choice([
      { text: "Answer honestly.", goto: "honest" },
      { text: "Deflect.", goto: "deflect" }
    ]),

    mark("honest"),
    say("alex", "That helps."),
    goto("done"),

    mark("deflect"),
    say("alex", "Nice try."),

    mark("done"),
    transition("Continue", null)
  ]
});
```

If you do not have the starter background or Alex sprite in your game package
yet, remove the `background(...)` and `show(...)` lines. A scene can run with
only text.

## Point The Game At The Scene

Open `src/game/game.config.js` and set:

```js
firstSceneId: "scene-001-start"
```

That id must match the `id` inside `scene({ ... })`.

## Run It

```powershell
npm.cmd run dev
```

Open the local URL shown by Vite. If the scene has a mistake, JiiShii should
show a validation message while booting.

## The Core Commands

These are enough for normal scenes.

### `scene(...)`

Defines one scene module.

```js
export default scene({
  id: "scene-002-hallway",
  title: "Hallway",
  cast: ["me", "alex"],
  script: [
    stage("irl"),
    say("alex", "This is another scene.")
  ]
});
```

### `stage(...)`

Sets the main story surface.

```js
stage("irl")
stage("texting")
stage("streaming")
stage("phone_call")
```

Use `stage(...)` when the story changes medium. It replaces the current surface
stack with the new main surface.

### `background(...)`

Sets the IRL background.

```js
background("starter-room-day")
background("starter-room-night", { transition: "fade_to_black", duration: 800 })
```

### `show(...)` and `hide(...)`

Show or hide a character sprite.

```js
show("alex", {
  outfit: "casual",
  expression: "happy",
  at: "left"
})

hide("alex")
```

Use sprite outfit and expression names exactly as they appear in your sprite
manifest.

### `say(...)`

Shows spoken dialogue. The current surface decides what it looks like.

```js
say("alex", "I have a bad idea.")
say("me", "That has never stopped you.")
```

On IRL, streaming, and phone calls, this uses the shared dialogue/narration
box. In texting, it becomes a message from that character.

### `narrate(...)`

Shows narration as its own story beat.

```js
narrate("The silence stretches.")
```

Do not confuse this with `narration(...)`, which is a texting item used inside
`block(...)`.

### `choice(...)`

Shows player options.

```js
choice([
  { text: "Stay.", goto: "stay" },
  { text: "Leave.", goto: "leave" }
])
```

Each option needs text. Most options also use `goto` to jump to a `mark(...)`.

### `mark(...)` and `goto(...)`

Use `mark(...)` to name a spot in the current scene. Use `goto(...)` to jump to
a mark or another scene id.

```js
mark("stay")
say("alex", "Good.")
goto("done")

mark("leave")
say("alex", "Okay.")

mark("done")
```

### `transition(...)`

Shows a continue button. If the target is another scene id, the next scene
loads. If the target is `null`, the current scene ends.

```js
transition("Next Scene", "scene-002-hallway")
transition("End Demo", null)
```

## Basic Branch State

Choices can set variables:

```js
choice([
  {
    text: "Trust Alex.",
    goto: "trust",
    set: { trusted_alex: true, alex_points: "+1" }
  },
  {
    text: "Keep your distance.",
    goto: "distance",
    set: { alex_points: "-1" }
  }
])
```

Then later:

```js
condition({
  if: { flag: "trusted_alex" },
  then: [
    say("alex", "Thanks for trusting me.")
  ],
  else: [
    say("alex", "Still not sure about me?")
  ]
})
```

Use `condition(...)` when the story should react without asking the player a new
question.

## Texting Basics

Texting is a story surface. Start it with `stage("texting")` when the scene is
currently a text conversation.

```js
import {
  block,
  narration,
  reply,
  scene,
  stage,
  text,
  thread,
  transition
} from "../vn.js";

export default scene({
  id: "scene-003-texting",
  cast: ["me", "alex"],
  script: [
    stage("texting"),
    thread("alex"),

    block([
      text("alex", "You awake?"),
      reply("Depends who is asking."),
      narration("A minute passes."),
      text("alex", "Then yes.")
    ]),

    transition("Continue", null)
  ]
});
```

Use `narration(...)` inside text blocks for centered non-message items like time
jumps or physical context.

## Surface Layering

Use `open(...)` and `close(...)` when one surface appears over another.

Example: the player is watching a stream, then a text conversation opens above
it:

```js
stage("streaming")
streamNarration("The stream is already live.")

open("texting")
thread("alex")
block([
  text("alex", "Are you watching this?")
])
close("texting")

streamNarration("The stream keeps going underneath.")
```

Use `stage(...)` for the main story surface. Use `open(...)` and `close(...)`
for temporary layers.

## What To Learn Next

After you can write a linear scene with one branch, read:

- `docs/ADVANCED_AUTHORING.md` for command shapes, conditions, JavaScript
  predicates, variable domains, and media control.
- `docs/PROGRAMMING_SCENES.md` for the full scene reference.
- `docs/SPRITE_COOKBOOK.md` when adding layered sprites.
- `docs/AUDIO_COOKBOOK.md` when adding music, ambience, sound, and voice.
- `docs/PHONE_APPS_COOKBOOK.md` when using gallery, social, calls, and custom
  phone apps.
