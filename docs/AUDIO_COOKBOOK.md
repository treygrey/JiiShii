# Audio Cookbook

This is the practical guide for making scenes sound intentional. It is about
choosing the right channel, shaping playback, and avoiding rollback surprises.

Scenes should ask for story sound:

```js
audioScene("studio_apartment_home", { transition: 1200 })
sound("phone_buzz", { as: "phone", loop: true, fadeIn: 200 })
stopSound("phone", { fadeOut: 300 })
```

The engine decides how that maps to browser audio.

## Folder Layout

Put audio under `src/game/assets/audio/`. The engine discovers files
automatically.

```text
src/game/assets/audio/
  music/
    coffee_beans.wav
    fireplace.wav
  ambience/
    rain_loop.wav
    room_tone.wav
  sfx/
    phone_buzz.wav
    blanket_shift.wav
  voice/
    line_001.wav
```

Asset ids are filename-based. For example, `phone_buzz.wav` is referenced as:

```js
sound("phone_buzz")
```

The validator warns when an id is missing or ambiguous.

## Channels

Use the smallest channel that matches the job:

- `music`: durable background music. One active track. Restored by rollback,
  save, and load.
- `ambience`: durable room or environment bed. One active loop. Restored by
  rollback, save, and load.
- `sound`: transient sound effect. Not replayed during rollback/load
  reconstruction.
- `voice`: transient voice line. Replaces the current voice line. Not durable.

If a loop describes the room, use `ambience()`. If it is a temporary authored
event that must stop later, use `sound(..., { as })` plus `stopSound()`.

## Audio Scenes

Use `audioScene()` for room or mood setup. Audio scenes live in
`src/game/game.config.js`.

```js
audioScenes: {
  studio_apartment_home: {
    music: { id: "coffee_beans", volume: 0.22, loop: true },
    ambience: { id: "room_tone", volume: 0.2, loop: true }
  },
  quiet_room: {
    music: null,
    ambience: null
  }
}
```

Then scenes stay clean:

```js
audioScene("studio_apartment_home", { transition: 1200 })
```

`transition` is a crossfade duration in milliseconds. It is a good default when
entering a new location, time of day, or emotional temperature.

## Music

Start music:

```js
music("main_theme", { volume: 0.35, fadeIn: 1200 })
```

Change music with a crossfade:

```js
music("uneasy_theme", {
  volume: 0.28,
  fadeIn: 1800,
  fadeOut: 1200
})
```

Stop music:

```js
stopMusic({ fadeOut: 600 })
```

Music is durable state. If the player rolls back to an earlier beat, the engine
reconstructs which music should be active there.

## Ambience

Start a room loop:

```js
ambience("rain_loop", {
  volume: 0.35,
  fadeIn: 1000,
  loop: true
})
```

Stop it:

```js
stopAmbience({ fadeOut: 500 })
```

Ambience is durable state. Prefer it for persistent room tone, rain, traffic,
fans, crowd beds, or anything the location should remember after rollback.

## One-Shot Sound

Play a simple effect:

```js
sound("door_slam", { volume: 0.8 })
```

Pair impact sounds with pacing:

```js
sound("door_slam", { volume: 0.8 })
shake({ intensity: 10, duration: 180 })
pause(250)
```

One-shots are transient. They play when the command is encountered live, but the
engine does not replay them while rebuilding a rolled-back moment.

## Named Sounds

Name a sound when it needs to be stopped later:

```js
sound("phone_buzz", {
  as: "phone",
  loop: true,
  volume: 0.35,
  fadeIn: 150
})

say("alex", "Is that yours?")

stopSound("phone", { fadeOut: 200 })
```

Starting another sound with the same handle replaces the previous one:

```js
sound("phone_buzz", { as: "phone", loop: true, volume: 0.2 })
sound("phone_buzz_loud", { as: "phone", loop: true, volume: 0.45, fadeOut: 150 })
```

Named sounds are still transient. They are for live authored moments, not
rollback-restored room state.

## Crops And Duration

Crop to part of an audio file:

```js
sound("blanket_shift", {
  start: 150,
  end: 900,
  volume: 0.18
})
```

`start` and `end` are milliseconds on the audio-file timeline.

Cut a sound after a fixed real duration:

```js
sound("breath_female2", {
  duration: 900,
  fadeOut: 120,
  volume: 0.08
})
```

`start`, `end`, `duration`, `fadeIn`, and `fadeOut` are milliseconds. Audio
timing in scene scripts always uses milliseconds.

Loop only a cropped segment:

```js
sound("machine_loop", {
  as: "machine",
  start: 250,
  end: 1100,
  loop: true,
  volume: 0.25
})
```

This is good enough for VN timing and SFX loops. It is not sample-accurate DAW
looping.

## Speed

Compress time by playing faster:

```js
voice("line_001", { rate: 1.08 })
sound("typing", { rate: 1.35, volume: 0.25 })
```

Extend time by playing slower:

```js
sound("cloth_rustle", { rate: 0.8, volume: 0.16 })
```

`rate` uses browser playback speed. That means pitch changes with speed.
Pitch-preserving time stretch is a future Web Audio feature, not current
HTML audio behavior.

## Voice

Play a voice line:

```js
voice("line_001", { volume: 0.9 })
```

Shape it like a sound:

```js
voice("line_001", {
  start: 50,
  duration: 1400,
  fadeIn: 40,
  fadeOut: 80
})
```

A new `voice()` stops the previous voice line. This keeps voiced dialogue from
piling up when the player advances quickly.

## Mixer Volumes

Command volume is multiplied by player settings:

```text
final volume = command volume * master volume * channel volume
```

That means this:

```js
sound("door_slam", { volume: 0.8 })
```

still respects the player's master and sound sliders.

## Common Patterns

Soft room entry:

```js
audioScene("quiet_room", { transition: 1200 })
pause(300)
```

Interrupted phone:

```js
sound("phone_buzz", { as: "phone", loop: true, volume: 0.25, fadeIn: 120 })
say("alex", "Ignore it.")
stopSound("phone", { fadeOut: 80 })
```

Shortened awkward breath:

```js
sound("breath_female2", {
  start: 200,
  duration: 700,
  fadeOut: 100,
  volume: 0.07
})
```

Hard emotional cut:

```js
stopMusic({ fadeOut: 0 })
stopAmbience({ fadeOut: 0 })
sound("hard_cut", { volume: 0.5 })
```

Slow unease:

```js
music("uneasy_theme", { volume: 0.18, fadeIn: 2400 })
ambience("room_tone", { volume: 0.12, fadeIn: 1800 })
```

## Troubleshooting

No sound plays:

- Check the asset id against the filename.
- Check the browser has received a user gesture. Browsers usually block audio
  before the player starts the game.
- Check player mixer sliders.
- Read validator warnings for missing or ambiguous audio ids.

A loop keeps playing:

- If it was started with `sound(..., { as: "name" })`, call
  `stopSound("name")`.
- If it was started with `ambience()`, call `stopAmbience()`.
- If it was started by an `audioScene()`, switch to another audio scene or set
  that channel to `null` in a preset.

Rollback did not replay a sound:

That is expected for `sound()` and `voice()`. They are transient. Use
`music()`, `ambience()`, or `audioScene()` for audio state that must be restored
after rollback/load.

Speed changed the pitch:

That is expected for `rate`. Use it for practical timing changes, not
pitch-preserving time stretch.

## Rule Of Thumb

Music and ambience describe where the story is. Sounds and voice describe what
just happened. If the audio should survive rollback, make it durable. If it is a
live beat, make it transient.
