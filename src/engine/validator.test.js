import { describe, expect, it } from "vitest";
import { validateScenes as validateSceneRegistry } from "./validator.js";
import { BUILTIN_SURFACE_MODULES, defineSurfaceModule } from "./surface-modules.js";
import {
  background,
  ambience,
  audioScene,
  block,
  choice,
  cg,
  clearCg,
  clearStage,
  close,
  condition,
  expression,
  flash,
  goto,
  hideAll,
  image,
  clearImage,
  mark,
  music,
  move,
  moveImage,
  narrate,
  open,
  popSurface,
  pushSurface,
  say,
  scene,
  show,
  sound,
  stage,
  stopAmbience,
  stopSound,
  shake,
  streamImage,
  streamChat,
  streamChatBlock,
  streamTitle,
  streamWindow,
  textImage,
  photo,
  phoneApps,
  phoneNotify,
  openPhone,
  removeGalleryImage,
  set,
  saveGalleryImage,
  thread,
  transition,
  socialLike,
  socialPost,
  voice
} from "./commands.js";

/**
 * Builds the registry shape validateScenes expects.
 *
 * @param {object[]} scenes - Scene definitions.
 * @returns {Record<string, object>} Registry keyed by scene id.
 */
function registryOf(...scenes) {
  return Object.fromEntries(scenes.map((item) => [item.id, item]));
}

const TEST_IMAGE_IDS = [
  "portraits/demo_portrait",
  "backgrounds/demo_room_day",
  "backgrounds/demo_room_night"
];
const TEST_AUDIO_IDS = [
  "music/theme",
  "ambience/rain_room",
  "sfx/door_slam",
  "voice/line_001",
  "music/club_theme",
  "ambience/club_room"
];
const TEST_OUTFITS = {
  alex: ["casual"]
};
const TEST_EXPRESSIONS = {
  alex: ["neutral", "happy", "smile"]
};
const TEST_BODIES = {
  alex: ["default", "guarded"]
};
const TEST_GLOBAL_CHARACTERS = {
  alex: { name: "Alex" }
};

/**
 * Validates scenes with a tiny fake game package wired in.
 *
 * @param {Record<string, object>} registry - Scene registry.
 * @param {object} [options] - Validator overrides.
 * @returns {{errors: string[], warnings: string[], testWarnings: string[]}} Validation result.
 */
function validateScenes(registry, options = {}) {
  return validateSceneRegistry(registry, {
    globalCharacters: TEST_GLOBAL_CHARACTERS,
    resolveImage: (id) => (TEST_IMAGE_IDS.includes(id) ? `/images/${id}.png` : null),
    listImageIds: () => TEST_IMAGE_IDS,
    resolveAudio: (id) => (TEST_AUDIO_IDS.includes(id) ? `/audio/${id}.ogg` : null),
    listAudioIds: () => TEST_AUDIO_IDS,
    resolveExpression: (character, expressionName) => (
      TEST_EXPRESSIONS[character]?.includes(expressionName)
        ? `/sprites/${character}/${expressionName}.png`
        : null
    ),
    listExpressions: (character) => TEST_EXPRESSIONS[character] ?? [],
    listOutfits: (character) => TEST_OUTFITS[character] ?? [],
    listBodies: (character) => TEST_BODIES[character] ?? [],
    listMissingRequiredSpriteLayers: () => [],
    ...options
  });
}

/**
 * Checks whether a validation list includes a useful substring.
 *
 * @param {string[]} messages - Validation messages.
 * @param {string} text - Substring to find.
 * @returns {boolean} True when any message contains the substring.
 */
function includesMessage(messages, text) {
  return messages.some((message) => message.includes(text));
}

/**
 * Asserts that a validation list contains a useful substring.
 *
 * @param {string[]} messages - Validation messages.
 * @param {string} text - Substring to find.
 * @returns {void}
 */
function expectMessage(messages, text) {
  expect(includesMessage(messages, text), messages.join("\n")).toBe(true);
}

/**
 * Creates a gallery image command for custom module validation tests.
 *
 * @param {string} id - Image id.
 * @returns {object} Gallery image command.
 */
function albumImage(id) {
  return { type: "albumImage", id };
}

/**
 * Creates a custom gallery surface module for validation tests.
 *
 * @returns {object} Gallery surface module.
 */
function albumSurfaceModule() {
  return defineSurfaceModule({
    id: "album",
    renderer: {
      commands: ["albumImage", "choice", "transition"],
      projections: ["renderAlbumState"]
    },
    commands: {
      albumImage: { blocks: false }
    }
  });
}

describe("validateScenes", () => {
  it("accepts a valid production texting scene", () => {
    const result = validateScenes(registryOf(scene({
      id: "valid_texting_scene",
      cast: ["me", "alex"],
      script: [
        stage("texting"),
        flash({ duration: 80 }),
        shake({ intensity: 4 }),
        say("alex", "home?"),
        choice([
          { text: "Just got in.", goto: "answer" }
        ]),
        mark("answer"),
        say("Just got in."),
        transition("Continue", null)
      ]
    })));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.testWarnings).toEqual([]);
  });

  it("errors when a render command runs before any stage", () => {
    const result = validateScenes(registryOf(scene({
      id: "render_before_stage_scene",
      cast: ["me"],
      script: [say("hi")]
    })));

    expectMessage(result.errors, "runs before any stage()/open()");
  });

  it("accepts a streaming scene with a texting overlay", () => {
    const result = validateScenes(registryOf(scene({
      id: "valid_streaming_texting_scene",
      cast: ["me", "alex"],
      script: [
        stage("streaming"),
        streamWindow("offline"),
        streamChatBlock([streamChat("viewer", "first")], { concurrent: true }),
        open("texting"),
        thread("alex"),
        say("alex", "still there?"),
        close("texting"),
        streamTitle("back to stream")
      ]
    })));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("accepts legacy pushSurface and popSurface overlay commands", () => {
    const result = validateScenes(registryOf(scene({
      id: "valid_legacy_push_pop_scene",
      cast: ["me", "alex"],
      script: [
        stage("streaming"),
        streamWindow("offline"),
        pushSurface("texting"),
        thread("alex"),
        say("alex", "still there?"),
        popSurface(),
        streamTitle("back to stream")
      ]
    })));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("errors on commands used on the wrong active surface", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "thread_on_irl_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), thread("alex")]
      }),
      scene({
        id: "show_on_texting_scene",
        cast: ["me", "alex"],
        script: [stage("texting"), show("alex", { outfit: "casual" })]
      }),
      scene({
        id: "stream_title_on_texting_scene",
        cast: ["me"],
        script: [stage("texting"), streamTitle("wrong place")]
      }),
      scene({
        id: "move_on_texting_scene",
        cast: ["me", "alex"],
        script: [stage("texting"), move("alex", "left")]
      }),
      scene({
        id: "cg_on_texting_scene",
        cast: ["me"],
        script: [stage("texting"), cg("portraits/demo_portrait")]
      }),
      scene({
        id: "clear_stage_on_texting_scene",
        cast: ["me"],
        script: [stage("texting"), clearStage()]
      })
    ));

    expectMessage(result.errors, '"thread" needs the texting stage');
    expectMessage(result.errors, '"showCharacter" needs the irl stage');
    expectMessage(result.errors, '"streamTitle" needs the streaming stage');
    expectMessage(result.errors, '"moveCharacter" needs the irl stage');
    expectMessage(result.errors, '"showIrlImage" needs the irl stage');
    expectMessage(result.errors, '"clearIrlStage" needs the irl stage');
  });

  it("applies surface legality to custom module commands", () => {
    const result = validateScenes(registryOf(scene({
      id: "custom_gallery_wrong_surface_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        albumImage("demo_image")
      ]
    })), {
      surfaceModules: [...BUILTIN_SURFACE_MODULES, albumSurfaceModule()]
    });

    expectMessage(result.errors, '"albumImage" needs the album stage');
  });

  it("reports unknown command types before runtime", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "unknown_command_scene",
        cast: ["me"],
        script: [
          stage("irl"),
          { type: "shwoCharacter", id: "alex" },
          { id: "missing_type" }
        ]
      }),
      scene({
        id: "registered_custom_command_scene",
        cast: ["me"],
        script: [
          stage("album"),
          albumImage("demo_image")
        ]
      })
    ), {
      surfaceModules: [...BUILTIN_SURFACE_MODULES, albumSurfaceModule()]
    });

    expectMessage(result.errors, 'unknown command "shwoCharacter"');
    expectMessage(result.errors, 'Did you mean "showCharacter"');
    expectMessage(result.errors, 'unknown command "(missing type)"');
    expect(result.errors.some((message) => message.includes("albumImage"))).toBe(false);
  });

  it("validates registered and unknown surface ids", () => {
    const customSurface = albumSurfaceModule();
    const valid = validateScenes(registryOf(scene({
      id: "custom_album_valid_surface_scene",
      cast: ["me"],
      script: [
        stage("album"),
        albumImage("demo_image")
      ]
    })), {
      surfaceModules: [...BUILTIN_SURFACE_MODULES, customSurface]
    });

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "unknown_surface_scene",
      cast: ["me"],
      script: [
        stage("textng"),
        open("galery"),
        pushSurface("streamign")
      ]
    })));

    expectMessage(invalid.errors, 'stage("textng") uses an unknown surface');
    expectMessage(invalid.errors, 'Did you mean "texting"');
    expectMessage(invalid.errors, 'open("galery") uses an unknown surface');
    expectMessage(invalid.errors, 'pushSurface("streamign") uses an unknown surface');
  });

  it("reports missing surface-control ids without corrupting layer simulation", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "missing_stage_id_scene",
        cast: ["me"],
        script: [{ type: "surface" }, say("hi")]
      }),
      scene({
        id: "missing_overlay_id_scene",
        cast: ["me"],
        script: [
          stage("irl"),
          { type: "openLayer" },
          { type: "pushSurface", id: "" },
          { type: "closeLayer" }
        ]
      }),
      scene({
        id: "unknown_overlay_does_not_stick_scene",
        cast: ["me"],
        script: [
          stage("irl"),
          open("galery")
        ]
      })
    ));

    expectMessage(result.errors, "stage() needs a surface id");
    expectMessage(result.errors, "open() needs a surface id");
    expectMessage(result.errors, "pushSurface() needs a surface id");
    expectMessage(result.errors, "close() needs a surface id");
    expectMessage(result.errors, 'open("galery") uses an unknown surface');
    expect(result.warnings.some((message) => message.includes("galery"))).toBe(false);
  });

  it("reports layer stack mistakes", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "close_without_open_scene",
        cast: ["me"],
        script: [stage("irl"), close("texting")]
      }),
      scene({
        id: "left_open_layer_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), open("texting"), thread("alex")]
      }),
      scene({
        id: "close_non_top_layer_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), open("texting"), open("streaming"), close("texting")]
      }),
      scene({
        id: "left_pushed_layer_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), pushSurface("texting"), thread("alex")]
      }),
      scene({
        id: "pop_without_overlay_scene",
        cast: ["me"],
        script: [stage("irl"), popSurface()]
      })
    ));

    expectMessage(result.errors, 'close("texting") but "texting" isn\'t open');
    expectMessage(result.warnings, "ends with 1 layer(s) still open");
    expectMessage(result.warnings, "closes a layer that isn't the top one");
    expectMessage(result.warnings, "popSurface() has no overlay to pop");
  });

  it("reports flow errors", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "duplicate_mark_scene",
        cast: ["me"],
        script: [stage("texting"), mark("again"), mark("again")]
      }),
      scene({
        id: "missing_target_scene",
        cast: ["me"],
        script: [stage("texting"), goto("missing"), transition("Next", "also_missing")]
      }),
      scene({
        id: "mark_collision_scene",
        cast: ["me"],
        script: [stage("texting"), mark("target_scene")]
      }),
      scene({
        id: "target_scene",
        cast: ["me"],
        script: [stage("texting"), say("ok")]
      })
    ));

    expectMessage(result.errors, 'mark("again") is defined more than once');
    expectMessage(result.errors, 'goto("missing")');
    expectMessage(result.errors, 'points to "also_missing"');
    expectMessage(result.errors, 'mark "target_scene" has the same name as a scene');
  });

  it("validates condition branches and author-facing condition shape", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_condition_scene",
      cast: ["me"],
      script: [
        stage("texting"),
        set("trust", 3),
        set("metAlex", true),
        condition({ var: "trust", atLeast: 3, then: "close", else: "guarded" }),
        condition({
          if: {
            all: [
              { flag: "metAlex" },
              {
                any: [
                  { var: "trust", atLeast: 3 },
                  { var: "trust", is: "3" }
                ]
              }
            ]
          },
          then: [
            say("nested")
          ],
          elseIf: [
            {
              if: { not: { flag: "metAlex" } },
              then: [
                say("else if")
              ]
            }
          ],
          else: [
            say("else")
          ]
        }),
        mark("close"),
        say("close"),
        mark("guarded"),
        say("guarded")
      ]
    })));

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "invalid_condition_scene",
      cast: ["me"],
      script: [
        stage("texting"),
        condition({ then: "missing_then", else: "" }),
        condition({ flag: "never_set", then: "ok", else: "missing_else" }),
        condition({ var: "trust", op: "roughly", value: 2, then: "ok", else: "ok" }),
        condition({
          if: { any: [] },
          then: [
            say("bad compound")
          ],
          else: [
            say("fallback")
          ]
        }),
        mark("ok")
      ]
    })));

    expectMessage(invalid.errors, 'condition() then target "missing_then" is not a scene or mark');
    expectMessage(invalid.errors, "condition() needs a else target");
    expectMessage(invalid.errors, 'condition() else target "missing_else" is not a scene or mark');
    expectMessage(invalid.errors, 'condition op "roughly" is not supported');
    expectMessage(invalid.errors, "condition() needs a flag, var, or if predicate");
    expectMessage(invalid.errors, "condition if.any needs at least one predicate");
    expectMessage(invalid.warnings, 'condition checks flag "never_set"');
    expectMessage(invalid.warnings, 'condition checks variable "trust"');
  });

  it("reports malformed command payloads", () => {
    const result = validateScenes(registryOf(scene({
      id: "malformed_payload_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        { type: "say", lines: [] },
        { type: "dialogue", id: "", message: "" },
        { type: "showCharacter" },
        { type: "setCharacterExpression", id: "alex" },
        { type: "moveCharacter" },
        { type: "showIrlImage", kind: "cg" },
        { type: "textBlock", texts: [] },
        { type: "textBlock", texts: [{}] },
        { type: "streamImage" },
        { type: "streamWindow", state: "live" },
        { type: "background" },
        { type: "music" },
        { type: "goto" },
        { type: "choice", options: [] },
        { type: "choice", options: [{}] },
        { type: "label" },
        { type: "setVar" },
        { type: "roll" }
      ]
    })));

    expectMessage(result.errors, "say() needs at least one line");
    expectMessage(result.errors, "dialogue() needs a speaker id");
    expectMessage(result.errors, "dialogue(\"\") needs a line");
    expectMessage(result.errors, "show() needs a character id");
    expectMessage(result.errors, "expression(\"alex\") needs an expression id");
    expectMessage(result.errors, "move() needs a character id");
    expectMessage(result.errors, "cg() needs an asset id");
    expectMessage(result.errors, "block() needs at least one text/photo item");
    expectMessage(result.errors, "block() contains an item with no kind");
    expectMessage(result.errors, "streamImage() needs an image asset id");
    expectMessage(result.errors, "streamWindow(\"live\") needs an image asset id");
    expectMessage(result.errors, "background() needs an image asset id");
    expectMessage(result.errors, "music() needs an audio asset id");
    expectMessage(result.errors, "goto() needs a target");
    expectMessage(result.errors, "choice() needs at least one option");
    expectMessage(result.errors, "choice option needs text");
    expectMessage(result.errors, "mark()/label() needs a name");
    expectMessage(result.errors, "setVar needs a variable name");
    expectMessage(result.errors, "roll needs a variable name");
  });

  it("reports invalid numeric and option payloads", () => {
    const result = validateScenes(registryOf(scene({
      id: "invalid_numbers_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        { type: "pause", duration: -1 },
        { type: "flash", duration: "fast" },
        { type: "shake", duration: -50, intensity: -2 },
        { type: "background", id: "demo_hall_day", duration: Number.NaN },
        { type: "music", id: "missing_theme", volume: 1.2, fadeIn: -10 },
        { type: "sound", id: "missing_bang", volume: -0.1, rate: 0, start: 1, end: 0, as: "" },
        { type: "voice", id: "missing_voice", rate: "quick", duration: "brief", loop: "yes", start: -1 },
        { type: "stopMusic", fadeOut: -100 },
        { type: "stopAmbience", fadeOut: "slow" },
        stopSound("", { fadeOut: -1 }),
        { type: "roll", key: "die", min: 6, max: 1 },
        { type: "roll", key: "fractional", min: 1.5, max: 6 },
        { type: "choice", id: "", options: [{ text: "A", goto: "same" }, { text: "B", goto: "same" }] },
        mark("same")
      ]
    })));

    expectMessage(result.errors, "pause() duration must be at least 0");
    expectMessage(result.errors, "flash() duration must be a finite number");
    expectMessage(result.errors, "shake() duration must be at least 0");
    expectMessage(result.errors, "shake() intensity must be at least 0");
    expectMessage(result.errors, "background() duration must be a finite number");
    expectMessage(result.errors, "music() volume must be at most 1");
    expectMessage(result.errors, "music() fadeIn must be at least 0");
    expectMessage(result.errors, "sound() volume must be at least 0");
    expectMessage(result.errors, "sound() rate must be at least 0.01");
    expectMessage(result.errors, "sound() end must be greater than start");
    expectMessage(result.errors, "sound() as must be a non-empty sound handle");
    expectMessage(result.errors, "voice() rate must be a finite number");
    expectMessage(result.errors, "voice() duration must be a finite number");
    expectMessage(result.errors, "voice() start must be at least 0");
    expectMessage(result.errors, "voice() loop must be true or false");
    expectMessage(result.errors, "stopMusic() fadeOut must be at least 0");
    expectMessage(result.errors, "stopAmbience() fadeOut must be a finite number");
    expectMessage(result.errors, "stopSound() needs a sound handle");
    expectMessage(result.errors, "stopSound() fadeOut must be at least 0");
    expectMessage(result.errors, 'roll("die") min must be less than or equal to max');
    expectMessage(result.errors, "roll() min must be an integer");
    expectMessage(result.errors, "choice() id must be a non-empty string");
    expectMessage(result.warnings, 'choice() has more than one option pointing to "same"');
  });

  it("reports suspicious and empty say lines", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "speaker_as_line_scene",
        cast: ["me", "alex"],
        script: [stage("texting"), say("alex")]
      }),
      scene({
        id: "empty_line_scene",
        cast: ["me", "alex"],
        script: [stage("texting"), say("alex", ["ok", "   "])]
      })
    ));

    expectMessage(result.errors, 'say("alex") looks like a character with no line');
    expectMessage(result.warnings, "has an empty line");
  });

  it("checks sprite outfits and expressions with alias-aware expressions", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_sprite_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", { outfit: "casual", expression: "happy" }),
        say("alex", "hi", { expression: "happy" })
      ]
    })));

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(
      scene({
        id: "bad_outfit_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), show("alex", { outfit: "hoodie", expression: "neutral" })]
      }),
      scene({
        id: "bad_expression_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), show("alex", { outfit: "casual", expression: "not_a_face" })]
      }),
      scene({
        id: "bad_body_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), show("alex", { outfit: "casual", expression: "neutral", body: "twisted" })]
      }),
      scene({
        id: "bodyless_sprite_scene",
        cast: ["me", "alex"],
        script: [stage("irl"), show("alex", { expression: "neutral" })]
      }),
      scene({
        id: "bad_expression_command_scene",
        cast: ["me", "alex"],
        script: [
          stage("irl"),
          show("alex", { outfit: "casual", expression: "neutral" }),
          expression("alex", "not_a_face")
        ]
      })
    ));

    expectMessage(invalid.warnings, 'outfit: "hoodie"');
    expectMessage(invalid.warnings, "Available:");
    expectMessage(invalid.warnings, 'expression: "not_a_face"');
    expectMessage(invalid.warnings, 'body: "twisted"');
    expectMessage(invalid.warnings, 'expression("alex", "not_a_face")');
    expectMessage(invalid.warnings, "never sets an outfit");
  });

  it("warns when required sprite recipe layers are missing", () => {
    const result = validateScenes(registryOf(scene({
      id: "missing_required_sprite_layer_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", { outfit: "casual", expression: "neutral", body: "guarded" })
      ]
    })), {
      listMissingRequiredSpriteLayers: () => [
        { id: "body", source: "bodies", key: "guarded" }
      ]
    });

    expect(result.errors).toEqual([]);
    expectMessage(result.warnings, 'recipe layer "body" needs bodies/guarded.png');
  });

  it("validates IRL direction commands", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_direction_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", { outfit: "casual", expression: "neutral", at: "left", x: "28%", y: "8vh" }),
        move("alex", { at: "right", scale: 1.05, x: 64, y: 0 }),
        image("letter", "portraits/demo_portrait", { fit: "contain", x: "calc(50% + 2rem)", y: "40%" }),
        expression("alex", "happy"),
        hideAll()
      ]
    })));

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "bad_direction_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        move("missing", "left"),
        expression("missing", "happy")
      ]
    })));

    expectMessage(invalid.errors, 'move("missing"');
    expectMessage(invalid.errors, 'expression("missing"');
  });

  it("warns about unknown IRL position and transition presets", () => {
    const result = validateScenes(registryOf(scene({
      id: "bad_direction_preset_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", {
          outfit: "casual",
          expression: "neutral",
          at: "lef",
          side: "rgiht",
          transition: "dissovle"
        }),
        move("alex", "not_a_place"),
        image("letter", "portraits/demo_portrait", { transition: "move" }),
        moveImage("letter", { transition: "moveInLeft" }),
        hideAll({ transition: "not_a_transition" }),
        clearStage({ transition: "bad_clear" }),
        background("backgrounds/demo_room_day", { transition: "disolve" })
      ]
    })));

    expect(result.errors).toEqual([]);
    expectMessage(result.warnings, 'unknown IRL position "lef"');
    expectMessage(result.warnings, 'Did you mean "left"');
    expectMessage(result.warnings, 'unknown IRL side "rgiht"');
    expectMessage(result.warnings, 'Did you mean "right"');
    expectMessage(result.warnings, 'unknown IRL transition "dissovle"');
    expectMessage(result.warnings, 'Did you mean "dissolve"');
    expectMessage(result.warnings, 'unknown IRL position "not_a_place"');
    expectMessage(result.warnings, 'unknown IRL transition "not_a_transition"');
    expectMessage(result.warnings, 'unknown IRL transition "bad_clear"');
    expectMessage(result.warnings, 'background() uses unknown transition "disolve"');
    expectMessage(result.warnings, "Available: cut, dissolve, fade_to_black");
  });

  it("reports invalid IRL transform numbers", () => {
    const result = validateScenes(registryOf(scene({
      id: "bad_direction_numbers_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", {
          outfit: "casual",
          expression: "neutral",
          scale: 0,
          alpha: 1.5,
          z: "front",
          duration: -1
        }),
        move("alex", { scale: -1, alpha: -0.2, easing: "" }),
        image("letter", "portraits/demo_portrait", { scale: "big", alpha: 2, z: Number.NaN, duration: -2 }),
        moveImage("letter", { alpha: -1 })
      ]
    })));

    expectMessage(result.errors, "showCharacter() scale must be at least 0.01");
    expectMessage(result.errors, "showCharacter() alpha must be at most 1");
    expectMessage(result.errors, "showCharacter() z must be a finite number");
    expectMessage(result.errors, "showCharacter() duration must be at least 0");
    expectMessage(result.errors, "moveCharacter() scale must be at least 0.01");
    expectMessage(result.errors, "moveCharacter() alpha must be at least 0");
    expectMessage(result.errors, "moveCharacter() easing must be a non-empty CSS easing string");
    expectMessage(result.errors, "showIrlImage() scale must be a finite number");
    expectMessage(result.errors, "showIrlImage() alpha must be at most 1");
    expectMessage(result.errors, "showIrlImage() z must be a finite number");
    expectMessage(result.errors, "showIrlImage() duration must be at least 0");
    expectMessage(result.errors, "moveIrlImage() alpha must be at least 0");
  });

  it("reports invalid IRL position and image fit values", () => {
    const result = validateScenes(registryOf(scene({
      id: "bad_direction_shape_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        show("alex", {
          outfit: "casual",
          expression: "neutral",
          x: "",
          y: Number.POSITIVE_INFINITY
        }),
        move("alex", { x: false }),
        image("letter", "portraits/demo_portrait", { fit: "stretch", x: [], y: "" }),
        moveImage("letter", { x: [] }),
        cg("portraits/demo_portrait", { fit: "stretchy" })
      ]
    })));

    expectMessage(result.errors, "showCharacter() x must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "showCharacter() y must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "moveCharacter() x must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "image() fit must be one of:");
    expectMessage(result.errors, "showIrlImage() x must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "showIrlImage() y must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "moveIrlImage() x must be a finite number or non-empty CSS string");
    expectMessage(result.errors, "cg() fit must be one of:");
  });

  it("checks IRL CG and image assets", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_irl_image_scene",
      cast: ["me"],
      script: [
        background("backgrounds/demo_room_day"),
        background("backgrounds/demo_room_night", { transition: "fade_to_black" }),
        stage("irl"),
        cg("portraits/demo_portrait"),
        image("letter", "portraits/demo_portrait"),
        moveImage("letter", { at: "center", scale: 0.8 }),
        clearImage("letter"),
        clearCg()
      ]
    })));

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "missing_irl_image_scene",
      cast: ["me"],
      script: [
        background("backgrounds/demo_room_dya"),
        stage("irl"),
        cg("missing_cg"),
        image("letter", "missing_letter")
      ]
    })));

    expectMessage(invalid.warnings, 'background("backgrounds/demo_room_dya") has no art yet');
    expectMessage(invalid.warnings, 'Did you mean "backgrounds/demo_room_day"');
    expectMessage(invalid.warnings, 'cg("missing_cg") has no art yet');
    expectMessage(invalid.warnings, 'image("missing_letter") has no art yet');
  });

  it("checks texting and streaming image assets", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_surface_image_scene",
      cast: ["me", "alex"],
      script: [
        stage("texting"),
        thread("alex"),
        block([textImage("alex", "portraits/demo_portrait")]),
        photo("alex", "portraits/demo_portrait"),
        stage("streaming"),
        streamImage("portraits/demo_portrait"),
        streamWindow("live", "portraits/demo_portrait")
      ]
    })));

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "missing_surface_image_scene",
      cast: ["me", "alex"],
      script: [
        stage("texting"),
        thread("alex"),
        block([textImage("alex", "missing_text_image")]),
        photo("alex", "missing_photo"),
        stage("streaming"),
        streamImage("missing_stream_image"),
        streamWindow("live", "missing_stream_window")
      ]
    })));

    expect(invalid.errors).toEqual([]);
    expectMessage(invalid.warnings, 'textImage("missing_text_image") has no art yet');
    expectMessage(invalid.warnings, 'textImage("missing_photo") has no art yet');
    expectMessage(invalid.warnings, 'streamImage("missing_stream_image") has no art yet');
    expectMessage(invalid.warnings, 'streamWindow("missing_stream_window") has no art yet');
  });

  it("warns when an image id is ambiguous", () => {
    const result = validateScenes(registryOf(scene({
      id: "ambiguous_image_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        background("living room day")
      ]
    })), {
      resolveImage: () => null,
      resolveImageAmbiguity: (id) => (id === "living room day"
        ? ["backgrounds/demo home/living room day", "backgrounds/demo office/living room day"]
        : null),
      listImageIds: () => []
    });

    expect(result.errors).toEqual([]);
    expectMessage(result.warnings, 'background("living room day") is ambiguous');
    expectMessage(result.warnings, "backgrounds/demo home/living room day");
    expectMessage(result.warnings, "backgrounds/demo office/living room day");
  });

  it("warns about missing audio assets", () => {
    const result = validateScenes(registryOf(scene({
      id: "missing_audio_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        music("missing_theme"),
        ambience("missing_rain"),
        stopAmbience(),
        sound("missing_door"),
        voice("missing_voice")
      ]
    })));

    expect(result.errors).toEqual([]);
    expectMessage(result.warnings, 'music("missing_theme") has no audio asset yet');
    expectMessage(result.warnings, 'ambience("missing_rain") has no audio asset yet');
    expectMessage(result.warnings, 'sound("missing_door") has no audio asset yet');
    expectMessage(result.warnings, 'voice("missing_voice") has no audio asset yet');
  });

  it("warns when an audio id is ambiguous", () => {
    const result = validateScenes(registryOf(scene({
      id: "ambiguous_audio_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        sound("door slam")
      ]
    })), {
      resolveAudio: () => null,
      resolveAudioAmbiguity: (id) => (id === "door slam"
        ? ["sfx/door slam", "foley/door slam"]
        : null),
      listAudioIds: () => []
    });

    expect(result.errors).toEqual([]);
    expectMessage(result.warnings, 'sound("door slam") is ambiguous');
    expectMessage(result.warnings, "sfx/door slam");
    expectMessage(result.warnings, "foley/door slam");
  });

  it("validates audioScene presets and their referenced assets", () => {
    const valid = validateScenes(registryOf(scene({
      id: "valid_audio_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        audioScene("demo_room", { transition: 1200 })
      ]
    })), {
      audioScenes: {
        demo_room: {
          music: { id: "music/club_theme", volume: 0.5 },
          ambience: { id: "ambience/club_room", volume: 0.25 }
        }
      },
      resolveAudio: () => "/audio/found.ogg",
      listAudioIds: () => ["music/club_theme", "ambience/club_room"]
    });

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const invalid = validateScenes(registryOf(scene({
      id: "invalid_audio_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        audioScene("clubhose", { transition: -1 }),
        audioScene("bad_refs")
      ]
    })), {
      audioScenes: {
        demo_room: {
          music: { id: "music/club_theme" }
        },
        bad_refs: {
          music: { id: "missing_theme" },
          ambience: { id: "missing_room" }
        }
      },
      resolveAudio: (id) => (id.startsWith("missing") ? null : "/audio/found.ogg"),
      listAudioIds: () => ["music/club_theme", "ambience/club_room"]
    });

    expectMessage(invalid.errors, 'audioScene("clubhose") has no preset');
    expectMessage(invalid.errors, "audioScene() transition must be at least 0");
    expectMessage(invalid.warnings, 'audioScene("bad_refs") music("missing_theme") has no audio asset yet');
    expectMessage(invalid.warnings, 'audioScene("bad_refs") ambience("missing_room") has no audio asset yet');
  });

  it("suggests known phone apps, gallery entries, tags, and social posts", () => {
    const result = validateScenes(registryOf(scene({
      id: "phone_authoring_typo_scene",
      cast: ["me", "alex"],
      script: [
        stage("irl"),
        phoneApps(["galery"]),
        phoneNotify("socal", { text: "new post" }),
        openPhone("irl"),
        saveGalleryImage("alex_selfie", "portraits/demo_portrait", { tags: ["Friends"] }),
        saveGalleryImage("alex_group", "portraits/demo_portrait", { tags: ["friends"] }),
        removeGalleryImage("alex_slefie"),
        socialPost("alex_first_post", { poster: "alex", text: "hello" }),
        socialLike("alex_frist_post")
      ]
    })));

    expectMessage(result.errors, 'phoneApps() uses unknown phone app "galery"');
    expectMessage(result.errors, 'Did you mean "gallery"');
    expectMessage(result.errors, 'phoneNotify() uses unknown phone app "socal"');
    expectMessage(result.errors, 'Did you mean "social"');
    expectMessage(result.errors, 'openPhone() uses unknown phone app "irl"');
    expectMessage(result.warnings, 'gallery tag "Friends" only differs by case from "friends"');
    expectMessage(result.warnings, 'gallery tag "friends" only differs by case from "Friends"');
    expectMessage(result.warnings, 'removeGalleryImage("alex_slefie") does not match any saveGalleryImage() id');
    expectMessage(result.warnings, 'Did you mean "alex_selfie"');
    expectMessage(result.warnings, 'socialLike("alex_frist_post") does not match any socialPost() id');
    expectMessage(result.warnings, 'Did you mean "alex_first_post"');
  });

  it("routes demo, prototype, and test scene findings into testWarnings", () => {
    const result = validateScenes(registryOf(
      scene({
        id: "production_bad_scene",
        cast: ["me"],
        script: [say("hi")]
      }),
      scene({
        id: "scene_test_bad",
        cast: ["me"],
        script: [say("hi")]
      }),
      scene({
        id: "demo_bad_scene",
        cast: ["me"],
        script: [say("hi")]
      }),
      scene({
        id: "prototype_bad_scene",
        cast: ["me"],
        script: [say("hi")]
      }),
      scene({
        id: "explicit_mode_bad_scene",
        mode: "test",
        cast: ["me"],
        script: [say("hi")]
      })
    ));

    expect(result.errors).toHaveLength(1);
    expectMessage(result.errors, "production_bad_scene");
    expect(result.warnings).toEqual([]);
    expect(result.testWarnings).toHaveLength(4);
    expectMessage(result.testWarnings, "scene_test_bad");
    expectMessage(result.testWarnings, "demo_bad_scene");
    expectMessage(result.testWarnings, "prototype_bad_scene");
    expectMessage(result.testWarnings, "explicit_mode_bad_scene");
  });
});
