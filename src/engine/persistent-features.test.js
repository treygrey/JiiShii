import { beforeEach, describe, expect, it, vi } from "vitest";
import { choice, condition, image, input, mark, music, persistFlag, roll, saveAdd, saveFlag, saveVar, say, scene, set, stage, video } from "./commands/index.js";
import { createInitialState } from "./state/index.js";
import { SceneRunner } from "./runtime/scene-runner.js";
import {
  createPersistentState,
  isBeatSeen,
  isChoiceOptionSeen,
  isExtraUnlocked,
  markBeatSeen,
  markChoiceOptionSeen,
  normalizePersistentState,
  prefixedPersistentFlags,
  readPersistentFlag,
  setPersistentFlag,
  unlockExtra
} from "./state/persistent-state.js";
import { evalShowIf, parseShowIf } from "./state/showif.js";

function fakeRenderer(surface, commands, projections = []) {
  return {
    contract: { surface, commands, projections },
    surface: { id: `${surface}-element` },
    mount: vi.fn(),
    unmount: vi.fn(),
    reset: vi.fn(),
    renderSpriteState: vi.fn(),
    renderTextingState: vi.fn(),
    renderStreamingState: vi.fn(),
    renderPhoneHomeState: vi.fn(),
    renderGalleryState: vi.fn(),
    renderSocialState: vi.fn(),
    renderPhoneCallState: vi.fn(),
    renderCallsState: vi.fn(),
    clearChoices: vi.fn(),
    setExitTransition: vi.fn(),
    setImageExitTransition: vi.fn(),
    setThread: vi.fn(),
    showTextBlock: vi.fn(),
    renderTextBlockInstant: vi.fn(),
    showThreadNotification: vi.fn(),
    showPhoneToast: vi.fn(),
    showLineBlock: vi.fn(),
    renderLineBlockInstant: vi.fn(),
    showChoice: vi.fn(),
    showCallLine: vi.fn(),
    setStreamLayout: vi.fn(),
    setStreamTitle: vi.fn(),
    setStreamWindow: vi.fn(),
    showStreamImage: vi.fn(),
    showStreamVideo: vi.fn(),
    renderStreamVideoInstant: vi.fn(),
    showStreamChatBlock: vi.fn(),
    renderStreamChatBlockInstant: vi.fn(),
    showTransition: vi.fn(),
    setSaveStatus: vi.fn(),
    showEnd: vi.fn()
  };
}

function fakeRenderers() {
  return {
    texting: fakeRenderer("texting", ["textBlock", "thread", "choice", "transition"], ["renderTextingState"]),
    irl: fakeRenderer(
      "irl",
      [
        "showCharacter",
        "hideCharacter",
        "hideAllCharacters",
        "clearIrlStage",
        "setCharacterExpression",
        "moveCharacter",
        "showIrlImage",
        "moveIrlImage",
        "clearIrlImage",
        "lineBlock",
        "choice",
        "transition"
      ],
      ["renderSpriteState"]
    ),
    streaming: fakeRenderer("streaming", [
      "streamLayout",
      "streamImage",
      "streamVideo",
      "streamChatBlock",
      "streamNarration",
      "streamTitle",
      "streamWindow",
      "streamSystem",
      "streamPost",
      "choice",
      "transition"
    ], ["renderStreamingState"]),
    phone_home: fakeRenderer("phone_home", ["choice", "transition"], ["renderPhoneHomeState"]),
    gallery: fakeRenderer("gallery", ["choice", "transition"], ["renderGalleryState"]),
    social: fakeRenderer("social", ["choice", "transition"], ["renderSocialState"]),
    phone_call: fakeRenderer("phone_call", ["call", "endCall", "choice", "transition"], ["renderPhoneCallState"]),
    calls: fakeRenderer("calls", ["choice", "transition"], ["renderCallsState"])
  };
}

function fakeCompositor() {
  const layers = new Set();
  return {
    hasLayer: vi.fn((id) => layers.has(id)),
    registerLayer: vi.fn((id) => layers.add(id)),
    unregisterLayer: vi.fn((id) => layers.delete(id)),
    resolvePreset: vi.fn((surfaceStack) => ({ surfaceStack: [...surfaceStack] })),
    applyPreset: vi.fn(),
    hideNarration: vi.fn(),
    completeNarrationReveal: vi.fn(),
    showDialogue: vi.fn(),
    showNarration: vi.fn(),
    renderDialogueInstant: vi.fn(),
    playScreenEffect: vi.fn(),
    showInput: vi.fn(),
    hideInput: vi.fn(),
    playVideo: vi.fn(),
    stopVideo: vi.fn()
  };
}

function fakeAudio() {
  return {
    sync: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    playAmbience: vi.fn(),
    stopAmbience: vi.fn(),
    playSound: vi.fn(),
    stopSound: vi.fn(),
    playVoice: vi.fn(),
    stopTransient: vi.fn(),
    stopAll: vi.fn()
  };
}

let storageKeyCounter = 0;

function makeRunner(script, options = {}) {
  const testScene = scene({ id: options.sceneId ?? "persistent_test_scene", cast: ["me"], script });
  const compositor = fakeCompositor();
  const renderers = fakeRenderers();
  const runner = new SceneRunner({
    initialScene: testScene,
    initialState: createInitialState(),
    renderers,
    compositor,
    registry: { [testScene.id]: testScene },
    onBackground: vi.fn(),
    onTransition: vi.fn(),
    audio: fakeAudio(),
    storageKeys: options.storageKeys
  });
  return { runner, renderers, compositor };
}

function uniqueStorageKeys() {
  storageKeyCounter += 1;
  return {
    save: `t${storageKeyCounter}-save`,
    autosave: `t${storageKeyCounter}-autosave`,
    slotPrefix: `t${storageKeyCounter}-slot-`,
    persistent: `t${storageKeyCounter}-persistent`
  };
}

function completeDialogue(compositor, callIndex = 0) {
  compositor.showDialogue.mock.calls[callIndex][2].onComplete();
}

describe("persistent state shape", () => {
  it("creates and normalizes the persistent record", () => {
    const created = createPersistentState();
    expect(created).toMatchObject({ version: 1, seen: {}, choices: {}, flags: {} });
    expect(normalizePersistentState(null)).toEqual(created);
    expect(normalizePersistentState({ seen: "garbage", unlocks: [], flags: { ok: true, bad: {} } }))
      .toEqual({ ...created, flags: { ok: true } });
  });

  it("tracks seen beats, choices, unlocks, and flags", () => {
    const persistent = createPersistentState();
    expect(markBeatSeen(persistent, "s1", 3)).toBe(true);
    expect(markBeatSeen(persistent, "s1", 3)).toBe(false);
    expect(isBeatSeen(persistent, "s1", 3)).toBe(true);
    expect(isBeatSeen(persistent, "s1", 4)).toBe(false);

    expect(markChoiceOptionSeen(persistent, "s1", 5, "left")).toBe(true);
    expect(isChoiceOptionSeen(persistent, "s1", 5, "left")).toBe(true);
    expect(isChoiceOptionSeen(persistent, "s1", 5, "right")).toBe(false);

    expect(unlockExtra(persistent, "gallery", "cg_beach")).toBe(true);
    expect(unlockExtra(persistent, "gallery", "cg_beach")).toBe(false);
    expect(isExtraUnlocked(persistent, "gallery", "cg_beach")).toBe(true);

    expect(setPersistentFlag(persistent, "alex_done", true)).toBe(true);
    expect(readPersistentFlag(persistent, "persistent:alex_done")).toBe(true);
    expect(prefixedPersistentFlags(persistent)).toEqual({ "persistent:alex_done": true });
  });
});

describe("persistent: prefix in conditions", () => {
  it("parses and evaluates persistent/save-prefixed showIf strings", () => {
    expect(parseShowIf("persistent:alex_done")).toMatchObject({ name: "persistent:alex_done", neg: false });
    expect(parseShowIf("!persistent:alex_done")).toMatchObject({ name: "persistent:alex_done", neg: true });
    expect(parseShowIf("save:arcade_score >= 50")).toMatchObject({ name: "save:arcade_score", op: ">=", value: 50 });
    expect(evalShowIf("persistent:alex_done", { "persistent:alex_done": true })).toBe(true);
    expect(evalShowIf("save:arcade_score >= 50", { "save:arcade_score": 50 })).toBe(true);
    expect(evalShowIf("persistent:alex_done", {})).toBe(false);
  });
});

describe("seen text and choices through the runner", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("marks beats seen on first view and reports them seen to a later runner", () => {
    const storageKeys = uniqueStorageKeys();
    const script = [stage("irl"), say("me", "first line"), say("me", "second line")];
    const first = makeRunner(script, { storageKeys });

    first.runner.start();
    expect(first.runner.isCurrentBeatSeen()).toBe(false);
    expect(isBeatSeen(first.runner.persistent, "persistent_test_scene", 1)).toBe(true);

    const second = makeRunner(script, { storageKeys });
    second.runner.start();
    expect(second.runner.isCurrentBeatSeen()).toBe(true);
  });

  it("annotates previously selected choice options for renderers", () => {
    const storageKeys = uniqueStorageKeys();
    const script = [
      stage("irl"),
      choice([
        { text: "Go left", goto: "after" },
        { text: "Go right", goto: "after" }
      ]),
      mark("after"),
      say("me", "done")
    ];
    const first = makeRunner(script, { storageKeys });
    first.runner.start();
    const shown = first.renderers.irl.showChoice.mock.calls[0][0];
    expect(shown.options.map((option) => Boolean(option.seen))).toEqual([false, false]);
    first.renderers.irl.showChoice.mock.calls[0][1].onSelect(shown.options[0]);

    const second = makeRunner(script, { storageKeys });
    second.runner.start();
    const reshown = second.renderers.irl.showChoice.mock.calls[0][0];
    expect(reshown.options.map((option) => Boolean(option.seen))).toEqual([true, false]);
  });

  it("treats rollback re-presentations as already seen", () => {
    const storageKeys = uniqueStorageKeys();
    const { runner, compositor } = makeRunner(
      [stage("irl"), say("me", "one"), say("me", "two"), say("me", "three")],
      { storageKeys }
    );
    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    completeDialogue(compositor, 1);
    runner.advance();

    runner.rollBack();
    expect(runner.isCurrentBeatSeen()).toBe(true);
  });
});

describe("route flags / New Game+", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("persistFlag survives into a fresh playthrough and drives conditions", () => {
    const storageKeys = uniqueStorageKeys();
    const routeScript = [
      stage("irl"),
      persistFlag("alex_route_done"),
      say("me", "route finished")
    ];
    makeRunner(routeScript, { storageKeys }).runner.start();

    const ngScript = [
      stage("irl"),
      condition({ if: { flag: "persistent:alex_route_done" }, then: "unlocked", else: "normal" }),
      mark("normal"),
      say("me", "normal start"),
      mark("unlocked"),
      say("me", "new game plus start")
    ];
    const fresh = makeRunner(ngScript, { storageKeys });
    fresh.runner.start();
    expect(fresh.compositor.showDialogue.mock.calls[0][0].message).toBe("new game plus start");
  });

  it("gates choice options with persistent-prefixed showIf", () => {
    const storageKeys = uniqueStorageKeys();
    makeRunner([stage("irl"), persistFlag("ending_b")], { storageKeys }).runner.start();

    const { runner, renderers } = makeRunner(
      [
        stage("irl"),
        choice([
          { text: "Replay ending B", showIf: "persistent:ending_b", goto: "after" },
          { text: "Continue", goto: "after" }
        ]),
        mark("after"),
        say("me", "done")
      ],
      { storageKeys }
    );
    runner.start();
    const shown = renderers.irl.showChoice.mock.calls[0][0];
    expect(shown.options.map((option) => option.text)).toEqual(["Replay ending B", "Continue"]);
  });
});

describe("save-persistent variables", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("survives rollback and does not double-apply relative mutations", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("me", "before unlock"),
      saveAdd("arcade_score", 50),
      say("me", "after unlock"),
      say("me", "later")
    ]);
    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.saveVars.arcade_score).toBe(50);
    completeDialogue(compositor, 1);
    runner.advance();

    runner.rollBack();
    runner.rollBack();
    expect(runner.state.saveVars.arcade_score).toBe(50);

    completeDialogue(compositor, 2);
    runner.advance();
    expect(runner.state.saveVars.arcade_score).toBe(50);
  });

  it("is stored in saves and can drive save-prefixed conditions", () => {
    const storageKeys = uniqueStorageKeys();
    const script = [
      stage("irl"),
      saveVar("arcade_score", 50),
      saveFlag("arcade_clear"),
      condition({
        if: { var: "save:arcade_score", atLeast: 50 },
        then: "unlocked",
        else: "locked"
      }),
      mark("locked"),
      say("me", "locked"),
      mark("unlocked"),
      say("me", "unlocked")
    ];
    const first = makeRunner(script, { storageKeys });
    first.runner.start();
    expect(first.compositor.showDialogue.mock.calls[0][0].message).toBe("unlocked");
    first.runner.save({ slot: 1 });

    const second = makeRunner(script, { storageKeys });
    second.runner.load({ slot: 1 });

    expect(second.runner.state.saveVars.arcade_score).toBe(50);
    expect(second.runner.state.saveVars.arcade_clear).toBe(true);
    expect(second.compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("unlocked");
  });

  it("annotates save-prefixed choice showIf conditions", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      saveFlag("bonus_choice"),
      choice([
        { text: "Bonus", showIf: "save:bonus_choice", goto: "done" },
        { text: "Normal", goto: "done" }
      ]),
      mark("done"),
      say("me", "done")
    ]);
    runner.start();

    const shown = renderers.irl.showChoice.mock.calls[0][0];
    expect(shown.options.map((option) => option.text)).toEqual(["Bonus", "Normal"]);
  });
});

describe("extras unlocks", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("unlocks music tracks and shown images into the persistent record", () => {
    const storageKeys = uniqueStorageKeys();
    const { runner } = makeRunner(
      [
        stage("irl"),
        music("main_theme"),
        image("photo", "cg_beach"),
        say("me", "pretty")
      ],
      { storageKeys }
    );
    runner.start();

    expect(isExtraUnlocked(runner.persistent, "music", "main_theme")).toBe(true);
    expect(isExtraUnlocked(runner.persistent, "gallery", "cg_beach")).toBe(true);
  });
});

describe("input() command", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("blocks on input, rejects empty submissions, and stores the answer", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      input("player_name", { prompt: "Name?" }),
      say("me", "hi")
    ]);
    runner.start();

    expect(runner.isWaitingForPlayer).toBe(true);
    expect(runner.isBlockingInput()).toBe(true);
    const [shownCommand, handlers] = compositor.showInput.mock.calls[0];
    expect(shownCommand.prompt).toBe("Name?");

    expect(handlers.onSubmit("   ")).toBe(false);
    expect(runner.isWaitingForPlayer).toBe(true);

    expect(handlers.onSubmit("Riley")).toBe(true);
    expect(runner.state.vars.player_name).toBe("Riley");
    expect(runner.isBlockingInput()).toBe(false);
    expect(compositor.showDialogue).toHaveBeenCalled();
  });

  it("prefills the stored answer when the var already holds one", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      input("player_name", { default: "Anon" })
    ]);
    runner.state.vars.player_name = "Riley";
    runner.start();

    const represented = compositor.showInput.mock.calls.at(-1)[0];
    expect(represented.default).toBe("Riley");
  });

  it("rolls back to input, prefills the submitted answer, and accepts a replacement", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      input("player_name", { prompt: "Name?" }),
      say("me", "after input"),
      say("me", "next beat")
    ]);
    runner.start();
    const firstInputHandlers = compositor.showInput.mock.calls[0][1];

    expect(firstInputHandlers.onSubmit("Riley")).toBe(true);
    expect(runner.state.vars.player_name).toBe("Riley");
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("after input");

    runner.rollBack();
    const [rolledBackInput, rolledBackHandlers] = compositor.showInput.mock.calls.at(-1);
    expect(rolledBackInput.default).toBe("Riley");

    expect(rolledBackHandlers.onSubmit("Morgan")).toBe(true);
    expect(runner.state.vars.player_name).toBe("Morgan");
    expect(compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("after input");
  });

  it("replays past input during reconstruction without showing the input panel again", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      input("player_name", { prompt: "Name?" }),
      say("me", "after input"),
      say("me", "later")
    ]);
    runner.start();
    compositor.showInput.mock.calls[0][1].onSubmit("Riley");
    completeDialogue(compositor, 0);
    runner.advance();

    const inputCallCount = compositor.showInput.mock.calls.length;
    runner.rollBack();

    expect(compositor.showInput.mock.calls.length).toBe(inputCallCount);
    expect(compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("after input");
  });
});

describe("video() command", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("blocks on the cutscene and advances when playback completes", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      video("intro_cutscene"),
      say("me", "after the video")
    ]);
    runner.start();

    expect(runner.isWaitingForPlayer).toBe(true);
    expect(runner.isBlockingInput()).toBe(true);
    const [shownCommand, handlers] = compositor.playVideo.mock.calls[0];
    expect(shownCommand).toMatchObject({ id: "intro_cutscene", skippable: true });

    handlers.onComplete();
    expect(runner.isBlockingInput()).toBe(false);
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("after the video");

    // A second completion (ended after skip) must not double-advance.
    const indexAfter = runner.state.currentCommandIndex;
    handlers.onComplete();
    expect(runner.state.currentCommandIndex).toBe(indexAfter);
  });

  it("rolls back to a video cutscene beat", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      video("intro_cutscene"),
      say("me", "after the video")
    ]);
    runner.start();
    compositor.playVideo.mock.calls[0][1].onComplete();
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("after the video");

    runner.rollBack();
    expect(compositor.playVideo.mock.calls.length).toBe(2);
    expect(runner.isBlockingInput()).toBe(true);
  });

  it("replays past video during reconstruction without playing it again", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      video("intro_cutscene"),
      say("me", "after the video"),
      say("me", "later")
    ]);
    runner.start();
    compositor.playVideo.mock.calls[0][1].onComplete();
    completeDialogue(compositor, 0);
    runner.advance();

    const videoCallCount = compositor.playVideo.mock.calls.length;
    runner.rollBack();

    expect(compositor.playVideo.mock.calls.length).toBe(videoCallCount);
    expect(compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("after the video");
  });
});

describe("roll determinism with persistent features active", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key))
    });
  });

  it("keeps rolled and relative values stable across rollback", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("me", "beat one"),
      set("gold", "+5"),
      roll("dice", 1, 1000000),
      say("me", "beat two"),
      say("me", "beat three")
    ]);
    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    const rolled = runner.state.vars.dice;
    expect(runner.state.vars.gold).toBe(5);
    completeDialogue(compositor, 1);
    runner.advance();

    runner.rollBack();
    expect(runner.state.vars.dice).toBe(rolled);
    expect(runner.state.vars.gold).toBe(5);
  });
});
