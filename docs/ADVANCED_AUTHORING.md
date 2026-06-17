# Advanced Authoring Guide

This guide explains the deeper authoring layer under the simple scene commands:
accepted data types, condition logic, JavaScript escape hatches, variable
domains, media controls, surface layering, and commands that should not be part
of a beginner's first day.

Read `docs/START_HERE.md` first if you have not written a working scene yet.

## Public Shape

Scene files are JavaScript modules, but authors should import commands only from
the local game shim:

```js
import { scene, stage, say, choice } from "../vn.js";
```

Do not import directly from `src/engine`. The shim is what lets bundled web
packages and loose desktop packages use the same scene files.

## Command Families

Think of the API in layers, not as one flat list.

### Everyday Scene Commands

These are the commands most scenes are built from:

```js
scene
stage
background
show
hide
say
narrate
choice
mark
goto
transition
set
add
setFlag
clearFlag
condition
```

### Surface Layering Commands

These are author-facing. They are how JiiShii shows one story medium over
another:

```js
open
close
```

Use `stage(...)` for the main surface. Use `open(...)` for a temporary layer
over it. Use `close(...)` to return to what was beneath.

### Surface-Specific Commands

Texting:

```js
thread
block
text
textImage
photo
reply
narration
```

Phone calls:

```js
call
endCall
voicemail
```

Streaming:

```js
streamLayout
streamImage
streamVideo
streamChatBlock
streamChat
streamNarration
streamTitle
streamSystem
streamPost
```

Phone apps:

```js
phoneButton
phoneApps
openPhone
phoneNotify
clearPhoneNotify
setWallpaper
saveGalleryImage
removeGalleryImage
socialPost
socialFollow
socialLike
```

Media and effects:

```js
cg
clearCg
image
moveImage
clearImage
video
media
moveMedia
clearMedia
flash
shake
```

Audio:

```js
music
stopMusic
ambience
stopAmbience
audioScene
sound
stopSound
voice
```

### Lower-Level Commands

These are public, but they should not be the first path taught to new authors:

```js
dialogue
line
lineBlock
endScene
streamWindow
```

Prefer the simpler story-language commands until you need the lower-level form:

- `say(...)` / `narrate(...)` instead of `dialogue(...)` for ordinary writing
- `transition("Text", null)` instead of `endScene()`

## Accepted Data Types

JiiShii commands accept normal JavaScript values. The important author-facing
types are:

| Type | Used For | Example |
| --- | --- | --- |
| string | ids, text, asset names, targets | `"alex"`, `"scene-002"`, `"starter-room-day"` |
| number | points, positions, durations, scale, alpha | `3`, `500`, `0.75` |
| boolean | toggles and flags | `true`, `false` |
| array | scripts, command blocks, choices, text blocks | `[say("alex", "Hi.")]` |
| object | command options and structured logic | `{ at: "left", duration: 500 }` |
| function | advanced predicates in specific fields | `(vars) => vars.trust >= 3` |
| null | explicit none/end | `transition("End", null)` |

Scene ids, asset ids, character ids, and mark names are exact. If a file,
scene, or asset is named `scene-001-start`, use `scene-001-start`. JiiShii does
not silently rename it.

All duration and time fields are milliseconds.

```js
pause(1000)                 // one second
background("room", { duration: 500 })
sound("door", { startAt: 200, endAt: 900 })
streamVideo("clip", { endAt: 5000 })
```

## Strings

Strings are used for ids and display text.

```js
say("alex", "This text appears in the dialogue box.")
background("starter-room-day")
goto("after_choice")
transition("Next", "scene-002")
```

When a string is an id, treat it as a stable name. Do not change an id casually
after saves exist, because saves and persistent progress may refer to it.

## Numbers

Numbers are used for scores, random ranges, timing, media transforms, audio
volume, and placement.

```js
add("trust", 1)
roll("coin", 1, 2)
pause(750)
show("alex", { x: 50, y: 100, scale: 0.95 })
music("theme", { volume: 0.7, fadeIn: 1000 })
```

Prefer numeric values for numeric concepts. The engine accepts some forgiving
comparisons, but scene files are still JavaScript.

## Booleans And Flags

Use booleans for plain yes/no state.

```js
setFlag("met_alex")
clearFlag("met_alex")
set("door_open", true)
```

When read by JiiShii's author-facing logic, these values count as off:

```text
false
0
""
"0"
"false"
"no"
"off"
null
undefined
```

Everything else counts as on.

That means this protects authors from JavaScript's strict-equality traps:

```js
condition({
  if: { var: "score", is: "0" },
  then: [
    narrate("The score is zero.")
  ]
})
```

`0` and `"0"` compare as the same author-facing value.

## Arrays

Arrays are used whenever a command accepts a list.

Scripts are arrays:

```js
script: [
  stage("irl"),
  say("alex", "Start.")
]
```

Choices are arrays:

```js
choice([
  { text: "Stay.", goto: "stay" },
  { text: "Leave.", goto: "leave" }
])
```

Conditional command blocks are arrays:

```js
condition({
  if: { flag: "met_alex" },
  then: [
    say("alex", "Good to see you again."),
    add("trust", 1)
  ],
  else: [
    say("alex", "Do I know you?")
  ]
})
```

Text message blocks are arrays:

```js
block([
  text("alex", "First message."),
  reply("Player reply."),
  narration("A minute passes.")
])
```

## Objects

Objects carry options.

```js
show("alex", {
  outfit: "casual",
  expression: "happy",
  at: "left",
  transition: "dissolve",
  duration: 400
})
```

Use objects when a command has named settings. This keeps command calls readable
even when there are several options.

## Variables And Persistence

JiiShii has three practical state domains.

### Story Variables

Story variables are the default. They save and load, and they roll back.

```js
set("trust", 1)
add("trust", 1)
setFlag("met_alex")
clearFlag("met_alex")
```

Use story variables for normal route state, relationship points, clues, and
scene facts.

### Save-Persistent Variables

Save-persistent variables survive rollback, but still belong to the save file.
They do not carry into a brand-new game.

```js
saveFlag("cleared_arcade")
saveVar("arcade_high_score", 50)
saveAdd("arcade_total_score", 10)
clearSaveFlag("cleared_arcade")
```

Read them with the `save:` prefix:

```js
condition({
  if: { flag: "save:cleared_arcade" },
  then: [
    say("alex", "You already cleared the arcade challenge.")
  ]
})
```

Use save-persistent variables for things the player did outside rollback logic:
arcade scores, skill checks, optional minigame rewards, and similar earned state.

### Cross-Playthrough Persistent Flags

Persistent flags live outside saves and rollback. They are for meta-progress:
endings, route clears, seen-text skip, seen choices, extras unlocks, and New
Game+ gates.

```js
persistFlag("alex_route_complete")
```

Read them with the `persistent:` prefix:

```js
choice([
  {
    text: "Start with the unlocked opening.",
    goto: "new_game_plus",
    showIf: "persistent:alex_route_complete"
  },
  { text: "Start normally.", goto: "normal_start" }
])
```

Use persistent flags sparingly. If something belongs to the current story
timeline, it is probably a story variable. If it belongs to the current save but
should not roll back, it is probably a save-persistent variable.

## Relative Variable Changes

`add(...)` is the clearest way to change a number:

```js
add("trust", 1)
add("trust", -1)
```

Choice options can also use relative strings:

```js
choice([
  {
    text: "Be honest.",
    goto: "honest",
    set: { trust: "+1", honest: true }
  }
])
```

Use `add(...)` in scripts. Use `set: { score: "+1" }` inside choice options
when the mutation belongs directly to the selected answer.

## `showIf`

`showIf` hides or shows a choice option.

Simple flag:

```js
choice([
  { text: "Mention the key.", goto: "key", showIf: "found_key" },
  { text: "Say nothing.", goto: "quiet" }
])
```

Negated flag:

```js
{ text: "Look for the key.", goto: "search", showIf: "!found_key" }
```

Comparison:

```js
{ text: "Spend 5 coins.", goto: "buy", showIf: "money >= 5" }
```

Save and persistent domains:

```js
{ text: "Claim prize.", goto: "prize", showIf: "save:cleared_arcade" }
{ text: "New Game+ start.", goto: "ng_plus", showIf: "persistent:route_clear" }
```

Advanced JavaScript predicate:

```js
{
  text: "Use the spare key.",
  goto: "use_key",
  showIf: (vars) => vars.found_key && !vars.door_open
}
```

Prefer string `showIf` when it is enough. The validator can understand strings
better than arbitrary JavaScript functions.

## `condition(...)`

`condition(...)` is the catchall branching command. It runs commands or jumps to
targets based on current state.

### Structured Form

Use structured conditions for normal story logic:

```js
condition({
  if: { flag: "met_alex" },
  then: [
    say("alex", "You came back.")
  ],
  else: [
    say("alex", "Do I know you?")
  ]
})
```

Variable comparisons:

```js
condition({
  if: { var: "trust", atLeast: 3 },
  then: [
    say("alex", "I trust you.")
  ]
})
```

Available comparison keys:

```js
{ var: "trust", is: 3 }
{ var: "trust", isNot: 0 }
{ var: "trust", atLeast: 3 }
{ var: "trust", atMost: 3 }
{ var: "trust", moreThan: 3 }
{ var: "trust", lessThan: 3 }
{ var: "name", hasText: true }
{ var: "money", op: ">=", value: 5 }
```

### Compound Logic

Use `all`, `any`, and `not` instead of raw JavaScript when the condition is
still readable:

```js
condition({
  if: {
    all: [
      { flag: "met_alex" },
      { not: { flag: "alex_angry" } },
      { var: "trust", atLeast: 3 }
    ]
  },
  then: [
    say("alex", "Okay. Come in.")
  ]
})
```

Use `elseIf` when several outcomes share one location in the script:

```js
condition({
  if: { var: "trust", atLeast: 5 },
  then: [
    say("alex", "I trust you completely.")
  ],
  elseIf: [
    {
      if: { var: "trust", atLeast: 2 },
      then: [
        say("alex", "I can work with that.")
      ]
    }
  ],
  else: [
    say("alex", "Not yet.")
  ]
})
```

### Target Form

`then` and `else` may be string targets. This jumps to a mark or scene id:

```js
condition({
  if: { flag: "met_alex" },
  then: "alex_knows_you",
  else: "alex_stranger"
})
```

Use command arrays when the branch is small. Use target strings when the scene
structure should visibly split.

## JavaScript In Story Files

Scene files are JavaScript modules, so you can use normal JavaScript to reduce
repetition:

```js
const trustReward = 2;

choice([
  {
    text: "Tell the truth.",
    goto: "truth",
    set: { trust: `+${trustReward}` }
  }
])
```

You can also build command arrays:

```js
const alexReturns = [
  say("alex", "You again."),
  add("trust", 1)
];

condition({
  if: { flag: "met_alex" },
  then: alexReturns
})
```

That is just JavaScript running while the scene module loads. The engine will
only see the final command objects.

## JavaScript Predicates

JiiShii also accepts JavaScript predicate functions in these author-facing
places:

- `condition({ if: (vars, state) => ... })`
- choice option `showIf: (vars) => ...`

Example:

```js
condition({
  if: (vars) => vars.trust >= 3 && vars.met_alex && !vars.alex_angry,
  then: [
    say("alex", "Fine. I believe you.")
  ]
})
```

For `condition(...)`, the function receives:

```js
(vars, state) => boolean
```

For `showIf`, the function receives:

```js
(vars) => boolean
```

Use JavaScript predicates when the structured form becomes less readable than
the code.

Do this:

```js
if: (vars) => vars.trust >= 3 && !vars.alex_angry
```

Do not do this:

```js
if: (vars) => {
  vars.trust += 1;
  return true;
}
```

Predicate functions should be pure checks. They should not mutate variables,
call DOM APIs, start timers, fetch files, play audio, or choose random values.

The validator cannot fully understand arbitrary JavaScript predicates. That is
why the structured forms should be the default for normal authoring.

## Choice Option Shape

The common choice option fields are:

```js
choice([
  {
    id: "tell_truth",
    text: "Tell the truth.",
    goto: "truth",
    set: { trust: "+1", told_truth: true },
    showIf: "!truth_locked"
  }
])
```

- `id`: optional stable id for seen-choice tracking.
- `text`: what the player sees.
- `goto`: mark or scene id to jump to.
- `set`: story variable mutations applied when selected.
- `showIf`: condition that controls whether the option appears.

Add `id` when a choice's visible text may change later. Seen-choice tracking can
fall back to text, but a stable id is safer for route-heavy games.

## Text Commands

Use `say(...)` for most spoken lines.

```js
say("alex", "Spoken line.")
say("This uses the default voice or narration behavior.")
```

Use `narrate(...)` for standalone narration:

```js
narrate("The hallway goes quiet.")
```

Use `narration(...)` inside texting blocks:

```js
block([
  text("alex", "Still there?"),
  narration("Five minutes pass."),
  reply("Yeah.")
])
```

`dialogue(...)`, `line(...)`, and `lineBlock(...)` exist for lower-level control.
Most authors should start with `say(...)` and `narrate(...)`.

## Surface Layering

Use `stage(...)` for the main surface:

```js
stage("streaming")
```

Use `open(...)` when a temporary surface appears over the current one:

```js
open("texting")
thread("alex")
block([
  text("alex", "You watching this?")
])
close("texting")
```

The commands after `open(...)` route to the opened layer until it closes.

Use `close(...)` on the layer you opened. Do not close a surface that is not on
top unless you are deliberately managing a complex stack.

The engine still has an internal surface stack, but authored scripts should use
`stage(...)`, `open(...)`, and `close(...)`.

## Media Control

Use simple wrappers first:

```js
background("room-day")
image("photo", "photo-asset", { layer: "front", fit: "contain" })
cg("event-cg", { fit: "cover" })
video("intro-cutscene", { volume: 0.8 })
streamVideo("stream-clip", { mode: "replace", image: "stream-still" })
```

Use `media(...)` when the simple wrappers are not specific enough:

```js
media("rain_overlay", {
  kind: "video",
  asset: "rain-loop",
  layer: "front",
  fit: "cover",
  alpha: 0.45,
  loop: true,
  muted: true
})
```

Move it:

```js
moveMedia("rain_overlay", { alpha: 0, duration: 600 })
```

Clear it:

```js
clearMedia("rain_overlay")
```

Standard layers:

```text
background
behind
characters
front
cg
overlay
```

Important media options:

```js
fit: "cover" | "contain" | "fill"
position: "center"
x: 50
y: 50
width: 40
height: 40
scale: 1
alpha: 0.75
z: 10
transition: "dissolve"
duration: 500
```

Video options:

```js
startAt: 0
endAt: 5000
loop: true
muted: true
volume: 0.8
mode: "replace" | "hold" | "loop"
```

Use `mode: "replace"` with a fallback `image` when the stream should play a
clip, then show a still:

```js
streamVideo("stream-clip", {
  mode: "replace",
  image: "stream-still",
  muted: true
})
```

## Phone App State

Phone apps are display/navigation surfaces. Story texting and story phone calls
look like phone experiences, but they are story surfaces.

Useful distinction:

- Story texting: use `stage("texting")`, `thread(...)`, `block(...)`.
- Messages app: the player opens it from the phone to browse conversations.
- Story phone call: use `stage("phone_call")`, `call(...)`, `say(...)`,
  `endCall(...)`.
- Calls app: the player opens it from the phone to browse logs and voicemail.

Use phone app commands for authored phone state:

```js
phoneButton(true)
phoneApps(["texting", "calls", "gallery", "social"])
phoneNotify("social", { text: "New post" })
saveGalleryImage("cg_001", "event-cg", { tags: ["Alex"] })
socialPost("post_001", {
  poster: "alex",
  text: "First post.",
  image: "event-cg",
  notify: true
})
voicemail("voice_001", "alex", {
  text: "Call me back when you can."
})
```

Use `docs/PHONE_APPS_COOKBOOK.md` for the full phone-app authoring model.

## Random Rolls

Use `roll(...)` for deterministic random values:

```js
roll("die", 1, 6)
condition({
  if: { var: "die", atLeast: 4 },
  then: [
    narrate("Success.")
  ],
  else: [
    narrate("Failure.")
  ]
})
```

Do not use `Math.random()` for story outcomes. The engine's `roll(...)` command
is deterministic under rollback and replay.

## Input

Use `input(...)` to collect player text:

```js
input("player_name", {
  prompt: "What should people call you?",
  placeholder: "Name",
  maxLength: 32,
  allowEmpty: false
})
```

The submitted value is a normal story variable:

```js
say("alex", "Nice to meet you, {$player_name}.")
```

Keep `maxLength` tight. Player input is escaped when rendered, but short inputs
are better for UI and save data.

## When To Use JavaScript

Use JavaScript freely for organizing scene files:

```js
const introLines = [
  narrate("The rain stops."),
  say("alex", "Finally.")
];
```

Use JavaScript predicates only when structured conditions are awkward:

```js
condition({
  if: (vars) => vars.money >= 5 && vars.ticket_count < 2,
  then: [
    say("alex", "You can afford one more ticket.")
  ]
})
```

Avoid JavaScript for things the engine already owns:

- random story outcomes: use `roll(...)`
- story mutations: use `set(...)`, `add(...)`, `setFlag(...)`
- save durability: use `saveVar(...)`, `saveFlag(...)`, `persistFlag(...)`
- media playback: use media/audio/video commands
- DOM manipulation: use a custom surface module instead

The rule is simple: use JavaScript to describe logic, not to secretly fight the
runner.

## Route-Heavy Games

For large branching stories:

- Use stable scene ids and mark names.
- Add stable `id` fields to important choice options.
- Use story variables for route state.
- Use save-persistent variables only for no-rollback player achievements.
- Use persistent flags only for endings, route clears, extras, and New Game+.
- Prefer scene-to-scene routing for large branches.
- Prefer `condition(...)` command blocks for small inline variations.

Example:

```js
choice([
  {
    id: "route_alex",
    text: "Go with Alex.",
    goto: "scene-alex-route",
    set: { route: "alex" }
  },
  {
    id: "route_riley",
    text: "Go with Riley.",
    goto: "scene-riley-route",
    set: { route: "riley" }
  }
])
```

At the end of a route:

```js
persistFlag("alex_route_complete")
transition("Return To Title", null)
```

In a later scene:

```js
condition({
  if: { flag: "persistent:alex_route_complete" },
  then: [
    narrate("Something about this beginning feels different now.")
  ]
})
```

## Authoring Rule Of Thumb

If the scene is ordinary, keep it ordinary:

```js
stage("irl")
background("room")
show("alex", { outfit: "casual", expression: "neutral" })
say("alex", "Hey.")
choice([
  { text: "Hey.", goto: "hey" }
])
```

Reach for advanced tools only when they buy clarity. A complex command is good
when it makes the scene easier to understand. It is bad when it hides the story
inside cleverness.
