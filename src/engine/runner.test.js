import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  background,
  scene,
  stage,
  open,
  close,
  label,
  jump,
  transition,
  set,
  mark,
  show,
  hide,
  hideAll,
  clearStage,
  expression,
  move,
  cg,
  clearCg,
  image,
  moveImage,
  clearImage,
  ambience,
  music,
  stopAmbience,
  stopMusic,
  audioScene,
  sound,
  stopSound,
  voice,
  pause,
  flash,
  shake,
  say,
  choice,
  line,
  lineBlock,
  narrate,
  thread,
  streamChat,
  streamChatBlock,
  streamNarration,
  streamImage,
  streamVideo,
  streamLayout,
  streamPost,
  streamSystem,
  streamTitle,
  streamWindow,
  saveGalleryImage,
  setWallpaper,
  socialFollow,
  socialLike,
  socialPost,
  call,
  endCall,
  voicemail,
  condition,
  roll
} from "./commands/index.js";
import { createInitialState } from "./state/index.js";
import { SceneRunner } from "./runtime/scene-runner.js";
import { BUILTIN_SURFACE_MODULES } from "./surfaces/index.js";

/**
 * Creates a renderer test double that satisfies the renderer contract and
 * records lifecycle calls.
 *
 * @param {string} surface - Surface id.
 * @param {string[]} commands - Supported command types.
 * @param {string[]} [projections] - Supported projection method names.
 * @returns {object} Fake renderer.
 */
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
    playScreenEffect: vi.fn()
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

/**
 * Creates a fake gallery surface module for custom module dispatch tests.
 *
 * @param {object} [options] - Test hooks.
 * @param {Function} [options.onGalleryImage] - Handler spy.
 * @returns {object} Gallery surface module.
 */
function gallerySurfaceModule({ onGalleryImage = vi.fn() } = {}) {
  const handleGalleryImage = ({ runner, command, instant }) => {
    runner.state.visuals.gallery.images.push({ id: command.id });
    runner.state.visuals.gallery.selected = command.id;
    onGalleryImage(command, { instant });
    runner.projectSurface("gallery", { instant });
    runner.advanceCommand();
  };

  return {
    id: "gallery",
    renderer: {
      surface: "gallery",
      commands: ["galleryImage", "choice", "transition"],
      projections: ["renderGalleryState"]
    },
    commands: {
      galleryImage: { blocks: false }
    },
    state: {
      create: () => ({ images: [], selected: null }),
      normalize: (value = {}) => ({
        images: Array.isArray(value.images) ? structuredClone(value.images) : [],
        selected: value.selected ?? null
      }),
      clone: (value) => structuredClone(value),
      project: ({ renderer, state, context }) => {
        renderer.renderGalleryState(state, { instant: context.instant });
      }
    },
    handlers: {
      galleryImage: {
        run: handleGalleryImage,
        instant: handleGalleryImage
      }
    }
  };
}

/**
 * Creates a gallery image command for custom module tests.
 *
 * @param {string} id - Image id.
 * @returns {object} Gallery image command.
 */
function galleryImage(id) {
  return { type: "galleryImage", id };
}

function makeRunner(script, options = {}) {
  const testScene = scene({
    id: "runner_test_scene",
    cast: ["me"],
    script
  });
  const renderers = options.renderers ?? fakeRenderers();
  const compositor = options.compositor ?? fakeCompositor();
  const audio = options.audio ?? fakeAudio();
  const runner = new SceneRunner({
    initialScene: testScene,
    initialState: createInitialState(),
    renderers,
    compositor,
    registry: options.registry ?? { [testScene.id]: testScene },
    surfaceModules: options.surfaceModules,
    audioScenes: options.audioScenes,
    onBackground: options.onBackground ?? vi.fn(),
    onTransition: vi.fn(),
    audio,
    storageKeys: options.storageKeys
  });
  return { runner, renderers, compositor, audio, scene: testScene };
}

/**
 * Reads the deterministic state fields replay reconstruction must preserve.
 *
 * @param {SceneRunner} runner - Runner to inspect.
 * @returns {object} Comparable state slice.
 */
function comparableReplayState(runner) {
  return structuredClone({
    currentSurface: runner.state.currentSurface,
    surfaceStack: runner.state.surfaceStack,
    vars: runner.state.vars,
    rng: runner.state.rng,
    audio: runner.state.audio,
    sprites: runner.state.sprites,
    visuals: {
      background: runner.state.visuals.background,
      texting: runner.state.visuals.texting,
      streaming: runner.state.visuals.streaming,
      irl: runner.state.visuals.irl
    }
  });
}

beforeEach(() => {
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key) => store.get(key) ?? null),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear())
  });
});

describe("SceneRunner surface stack", () => {
  it("mounts a stage renderer and updates the surface stack", () => {
    const { runner, renderers, compositor } = makeRunner([stage("texting")]);

    runner.executeCommand(runner.scene.script[0]);

    expect(runner.surfaceStack).toEqual(["texting"]);
    expect(runner.state.currentSurface).toBe("texting");
    expect(renderers.texting.mount).toHaveBeenCalledOnce();
    expect(compositor.registerLayer).toHaveBeenCalledWith("texting", renderers.texting.surface);
  });

  it("opens and closes the top surface layer by id", () => {
    const { runner, renderers, compositor } = makeRunner([
      stage("streaming"),
      open("texting"),
      close("texting")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.state.currentSurface).toBe("texting");
    expect(renderers.texting.mount).toHaveBeenCalledOnce();

    runner.executeCommand(runner.scene.script[2]);

    expect(runner.surfaceStack).toEqual(["streaming"]);
    expect(runner.state.currentSurface).toBe("streaming");
    expect(renderers.texting.unmount).toHaveBeenCalledOnce();
    expect(compositor.unregisterLayer).toHaveBeenCalledWith("texting");
  });

  it("opens phone Home over the current story surface and returns with the phone button", () => {
    const { runner, renderers } = makeRunner([stage("irl")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("home");

    expect(runner.surfaceStack).toEqual(["irl", "phone_home"]);
    expect(runner.state.currentSurface).toBe("phone_home");
    expect(renderers.irl.unmount).not.toHaveBeenCalled();

    runner.togglePhone();

    expect(runner.surfaceStack).toEqual(["irl"]);
    expect(runner.state.currentSurface).toBe("irl");
    expect(renderers.phone_home.unmount).toHaveBeenCalledOnce();
  });

  it("treats texting as a paused story surface when Home opens from a texting scene", () => {
    const { runner } = makeRunner([stage("texting")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("home");

    expect(runner.surfaceStack).toEqual(["texting", "phone_home"]);

    runner.openPhoneApp("texting");

    expect(runner.surfaceStack).toEqual(["texting"]);
    expect(runner.state.currentSurface).toBe("texting");
  });

  it("shows the inbox only when Messages opens from phone navigation", () => {
    const { runner } = makeRunner([stage("streaming"), open("texting")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.isTextingInboxMode()).toBe(false);

    runner.popSurface();
    runner.openPhoneApp("home");
    runner.openPhoneApp("texting");

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.isTextingInboxMode()).toBe(true);
  });

  it("marks Messages as a phone app before its first render projection", () => {
    const renderers = fakeRenderers();
    const { runner } = makeRunner([stage("streaming")], { renderers });

    runner.executeCommand(runner.scene.script[0]);
    renderers.texting.renderTextingState.mockClear();
    renderers.texting.renderTextingState.mockImplementation(() => {
      expect(runner.isTextingInboxMode()).toBe(true);
    });

    runner.openPhoneApp("texting");

    expect(renderers.texting.renderTextingState).toHaveBeenCalled();
    expect(runner.isTextingInboxMode()).toBe(true);
  });

  it("allows story advancement while authored texting is layered over another story surface", () => {
    const { runner, compositor } = makeRunner([stage("streaming"), open("texting")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.isWaitingForPlayer = true;
    runner.advance();

    expect(runner.isPhoneOpen()).toBe(false);
    expect(compositor.completeNarrationReveal).toHaveBeenCalledOnce();
  });

  it("opens Home over story texting without clearing the blocked text choice", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      open("texting"),
      choice([
        { text: "I'm here.", goto: "here" },
        { text: "Perceiving gently.", goto: "gentle" }
      ])
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);

    expect(runner.isStoryTextingActive()).toBe(true);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.texting.showChoice).toHaveBeenCalledOnce();
    const textProjectionCount = renderers.texting.renderTextingState.mock.calls.length;

    runner.togglePhone();

    expect(runner.surfaceStack).toEqual(["streaming", "texting", "phone_home"]);
    expect(runner.state.currentSurface).toBe("phone_home");
    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.texting.clearChoices).not.toHaveBeenCalled();
    expect(renderers.texting.renderTextingState).toHaveBeenCalledTimes(textProjectionCount);
    expect(renderers.phone_home.mount).toHaveBeenCalledOnce();

    runner.togglePhone();

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.state.currentSurface).toBe("texting");
    expect(runner.isStoryTextingActive()).toBe(true);
    expect(runner.blockingInput).toBe(true);
  });

  it("opens Home over story texting and returns to the same blocked text choice", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      open("texting"),
      choice([
        { text: "I'm here.", goto: "here" },
        { text: "Perceiving gently.", goto: "gentle" }
      ])
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);
    const textProjectionCount = renderers.texting.renderTextingState.mock.calls.length;

    runner.openPhoneApp("home");

    expect(runner.surfaceStack).toEqual(["streaming", "texting", "phone_home"]);
    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.texting.renderTextingState).toHaveBeenCalledTimes(textProjectionCount);

    runner.openPhoneApp("texting");

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.isStoryTextingActive()).toBe(true);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.texting.clearChoices).not.toHaveBeenCalled();
  });

  it("returns from phone Home to the authored text thread instead of the underlying story surface", () => {
    const { runner } = makeRunner([stage("streaming"), open("texting")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.openPhoneApp("home");

    expect(runner.surfaceStack).toEqual(["streaming", "texting", "phone_home"]);

    runner.togglePhone();

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.state.currentSurface).toBe("texting");
    expect(runner.isPhoneOpen()).toBe(false);
  });

  it("creates a conversation when a text arrives without an explicit thread command", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      open("texting"),
      say("alex", "first message arrived during the stream")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);

    expect(runner.state.visuals.texting.currentThreadId).toBe("alex");
    expect(runner.state.visuals.texting.threads.alex).toMatchObject({
      contact: expect.objectContaining({ id: "alex", name: "alex" }),
      messages: [expect.objectContaining({ id: "alex", message: "first message arrived during the stream" })]
    });
    expect(renderers.texting.setThread).toHaveBeenCalledWith(expect.objectContaining({ id: "alex" }));
  });

  it("switches between phone apps without discarding the paused story surface", () => {
    const { runner, renderers } = makeRunner([stage("streaming")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("home");
    runner.openPhoneApp("social");

    expect(runner.surfaceStack).toEqual(["streaming", "social"]);
    expect(renderers.streaming.unmount).not.toHaveBeenCalled();
    expect(renderers.phone_home.unmount).toHaveBeenCalledOnce();
    expect(renderers.social.mount).toHaveBeenCalledOnce();

    runner.togglePhone();

    expect(runner.surfaceStack).toEqual(["streaming"]);
    expect(runner.state.currentSurface).toBe("streaming");
  });

  it("backs from an app root to phone Home before returning to the story surface", () => {
    const { runner } = makeRunner([stage("streaming")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("texting");

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.isTextingInboxMode()).toBe(true);

    runner.goBackPhoneApp();

    expect(runner.surfaceStack).toEqual(["streaming", "phone_home"]);
    expect(runner.state.currentSurface).toBe("phone_home");
    expect(runner.state.visuals.phone.currentApp).toBe("home");

    runner.goBackPhoneApp();

    expect(runner.surfaceStack).toEqual(["streaming"]);
    expect(runner.state.currentSurface).toBe("streaming");
    expect(runner.isPhoneOpen()).toBe(false);
  });

  it("backs to Home instead of walking through previously opened apps", () => {
    const { runner } = makeRunner([stage("irl")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("social");
    runner.openPhoneApp("gallery");

    expect(runner.surfaceStack).toEqual(["irl", "gallery"]);

    runner.goBackPhoneApp();

    expect(runner.surfaceStack).toEqual(["irl", "phone_home"]);
    expect(runner.state.visuals.phone.currentApp).toBe("home");
  });

  it("blocks phone app navigation while an authored phone call is active", () => {
    const { runner, compositor } = makeRunner([
      stage("phone_call"),
      call("alex"),
      say("alex", "Pick up."),
      endCall(),
      stage("irl"),
      say("done")
    ]);

    runner.start();

    expect(runner.state.currentSurface).toBe("phone_call");
    expect(runner.state.visuals.phoneCall.active).toBe(true);
    runner.openPhoneApp("home");
    expect(runner.isPhoneOpen()).toBe(false);
    expect(runner.state.surfaceStack).toEqual(["phone_call"]);
    runner.togglePhone();
    expect(runner.isPhoneOpen()).toBe(false);

    compositor.showDialogue.mock.calls[0][2].onComplete();
    runner.advance();
    expect(runner.state.visuals.phoneCall.active).toBe(false);
    expect(runner.state.visuals.calls.recents[0]).toMatchObject({
      contact: { id: "alex" },
      status: "completed"
    });
  });

  it("lets authors opt out of automatic call log entries", () => {
    const { runner, compositor } = makeRunner([
      stage("phone_call"),
      call("alex", { log: false }),
      say("alex", "This should stay off the call log."),
      endCall(),
      stage("irl"),
      say("done")
    ]);

    runner.start();
    compositor.showDialogue.mock.calls[0][2].onComplete();
    runner.advance();

    expect(runner.state.visuals.calls.recents).toEqual([]);
  });

  it("adds voicemail entries to the Calls app without opening phone navigation", () => {
    const { runner } = makeRunner([
      stage("irl"),
      voicemail("vm_001", "alex", {
        text: "Call me back.",
        audio: "alex_voicemail",
        notify: true
      }),
      say("done")
    ]);

    runner.start();

    expect(runner.state.visuals.calls.voicemails).toEqual([
      expect.objectContaining({
        id: "vm_001",
        contact: expect.objectContaining({ id: "alex" }),
        text: "Call me back.",
        audio: "alex_voicemail"
      })
    ]);
    expect(runner.state.visuals.phone.badges.calls).toBe(true);
    expect(runner.isPhoneOpen()).toBe(false);
  });

  it("adds received text notifications to the conversation list as actionable rows", () => {
    const alexScene = scene({
      id: "alex_scene",
      contact: { id: "alex", name: "Alex", avatar: "A" },
      script: [
        stage("texting"),
        thread("alex"),
        say("alex", "Are you there?")
      ]
    });
    const testScene = scene({
      id: "runner_test_scene",
      cast: ["riley", "alex"],
      script: [
        stage("texting"),
        thread("riley"),
        say("riley", "Hi."),
        transition("Alex", "alex_scene")
      ]
    });
    const renderers = fakeRenderers();
    const runner = new SceneRunner({
      initialScene: testScene,
      initialState: createInitialState(),
      renderers,
      compositor: fakeCompositor(),
      registry: {
        runner_test_scene: testScene,
        alex_scene: alexScene
      },
      audio: fakeAudio()
    });

    runner.start();
    renderers.texting.showTextBlock.mock.calls[0][1].onComplete();
    runner.advance();

    expect(runner.state.visuals.texting.threads.alex).toMatchObject({
      contact: expect.objectContaining({ id: "alex", name: "Alex" }),
      preview: "Are you there?",
      pendingSceneId: "alex_scene",
      unread: true
    });
    expect(renderers.texting.showThreadNotification).toHaveBeenCalledOnce();

    expect(runner.openTextThread("alex")).toBe(true);

    expect(runner.scene.id).toBe("alex_scene");
    expect(runner.state.visuals.texting.threads.riley).toMatchObject({
      messages: [expect.objectContaining({ message: "Hi." })]
    });
    expect(runner.state.visuals.texting.threads.alex).toBeDefined();
    expect(runner.state.visuals.texting.threads.alex.unread).toBe(false);
  });

  it("does not treat a transition from texting to streaming as a text notification", () => {
    const streamingScene = scene({
      id: "stream_scene",
      contact: { id: "alex", name: "Alex", avatar: "A" },
      script: [
        stage("streaming"),
        streamTitle("Live soon")
      ]
    });
    const testScene = scene({
      id: "runner_test_scene",
      cast: ["riley", "alex"],
      script: [
        stage("texting"),
        thread("riley"),
        say("riley", "Hi."),
        transition("Open stream", "stream_scene")
      ]
    });
    const renderers = fakeRenderers();
    const runner = new SceneRunner({
      initialScene: testScene,
      initialState: createInitialState(),
      renderers,
      compositor: fakeCompositor(),
      registry: {
        runner_test_scene: testScene,
        stream_scene: streamingScene
      },
      audio: fakeAudio()
    });

    runner.start();
    renderers.texting.showTextBlock.mock.calls[0][1].onComplete();
    runner.advance();

    expect(renderers.texting.showThreadNotification).not.toHaveBeenCalled();
    expect(renderers.texting.showTransition).toHaveBeenCalledOnce();
    expect(runner.state.visuals.texting.threads.alex).toBeUndefined();
  });

  it("does not show a text notification when Messages is open as a phone app", () => {
    const alexScene = scene({
      id: "alex_scene",
      contact: { id: "alex", name: "Alex", avatar: "A" },
      script: [
        stage("texting"),
        thread("alex"),
        say("alex", "Directly open this thread.")
      ]
    });
    const testScene = scene({
      id: "runner_test_scene",
      cast: ["alex"],
      script: [
        stage("streaming"),
        transition("Open message", "alex_scene")
      ]
    });
    const renderers = fakeRenderers();
    const runner = new SceneRunner({
      initialScene: testScene,
      initialState: createInitialState(),
      renderers,
      compositor: fakeCompositor(),
      registry: {
        runner_test_scene: testScene,
        alex_scene: alexScene
      },
      audio: fakeAudio()
    });

    runner.start();
    runner.openPhoneApp("texting");
    runner.executeCommand(testScene.script[1]);

    expect(runner.isTextingInboxMode()).toBe(true);
    expect(renderers.texting.showThreadNotification).not.toHaveBeenCalled();
    expect(renderers.texting.showTransition).toHaveBeenCalledOnce();
  });

  it("does not advance the story while a phone app is open", () => {
    const { runner, compositor } = makeRunner([stage("irl")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.isWaitingForPlayer = true;
    runner.openPhoneApp("home");
    runner.advance();

    expect(compositor.completeNarrationReveal).not.toHaveBeenCalled();
    expect(runner.isWaitingForPlayer).toBe(true);
    expect(runner.surfaceStack).toEqual(["irl", "phone_home"]);
  });

  it("does not capture rollback snapshots while a phone app is topmost", () => {
    const { runner } = makeRunner([stage("irl"), say("alex", "line")]);

    runner.start();
    const snapshotCount = runner.rollbackBuffer.length;
    runner.openPhoneApp("home");
    runner.captureBeatSnapshot();

    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.rollbackBuffer).toHaveLength(snapshotCount);
  });

  it("keeps story paused when Messages is opened as a phone app over a non-texting stage", () => {
    const { runner, compositor } = makeRunner([stage("streaming")]);

    runner.executeCommand(runner.scene.script[0]);
    runner.openPhoneApp("texting");
    runner.isWaitingForPlayer = true;
    runner.advance();

    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.isTextingInboxMode()).toBe(true);
    expect(compositor.completeNarrationReveal).not.toHaveBeenCalled();

    runner.togglePhone();
    runner.advance();

    expect(runner.surfaceStack).toEqual(["streaming"]);
    expect(runner.isPhoneOpen()).toBe(false);
    expect(compositor.completeNarrationReveal).toHaveBeenCalledOnce();
  });

  it("can reopen Messages as a phone app after authored texting closes", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      open("texting"),
      say("alex", "first message arrived during the stream"),
      close("texting")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);
    renderers.texting.showTextBlock.mock.calls[0][1].onComplete();
    runner.executeCommand(runner.scene.script[3]);

    expect(runner.surfaceStack).toEqual(["streaming"]);
    expect(runner.state.currentSurface).toBe("streaming");
    expect(runner.state.phoneNavigationSurface).toBeNull();

    runner.openPhoneApp("home");
    runner.openPhoneApp("texting");

    expect(runner.surfaceStack).toEqual(["streaming", "texting"]);
    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.isTextingInboxMode()).toBe(true);
    expect(renderers.texting.renderTextingState).toHaveBeenCalled();
  });

  it("throws when close targets a layer that is not on top", () => {
    const { runner } = makeRunner([
      stage("irl"),
      open("texting"),
      open("streaming"),
      close("texting")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);

    expect(() => runner.executeCommand(runner.scene.script[3])).toThrow(/top layer is "streaming"/);
  });

  it("mounts a custom registered surface module", () => {
    const customSurface = {
      id: "gallery",
      renderer: {
        surface: "gallery",
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      commands: {}
    };
    const renderers = {
      ...fakeRenderers(),
      gallery: {
        ...fakeRenderer("gallery", ["choice", "transition"], ["renderGalleryState"]),
        renderGalleryState: vi.fn()
      }
    };
    const { runner, compositor } = makeRunner([stage("gallery")], {
      renderers,
      surfaceModules: [customSurface]
    });

    runner.executeCommand(runner.scene.script[0]);

    expect(runner.surfaceStack).toEqual(["gallery"]);
    expect(compositor.registerLayer).toHaveBeenCalledWith("gallery", renderers.gallery.surface);
  });

  it("initializes and projects custom surface module state", () => {
    const projectGallery = vi.fn();
    const customSurface = {
      id: "gallery",
      renderer: {
        surface: "gallery",
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      commands: {},
      state: {
        create: () => ({ images: [], selected: null }),
        normalize: (value = {}) => ({
          images: Array.isArray(value.images) ? structuredClone(value.images) : [],
          selected: value.selected ?? null
        }),
        clone: (value) => structuredClone(value),
        project: ({ renderer, state, context }) => {
          projectGallery(state, { instant: context.instant });
          renderer.renderGalleryState(state, { instant: context.instant });
        }
      }
    };
    const renderers = {
      gallery: {
        ...fakeRenderer("gallery", ["choice", "transition"], ["renderGalleryState"]),
        renderGalleryState: vi.fn()
      }
    };
    const { runner } = makeRunner([stage("gallery")], {
      renderers,
      surfaceModules: [customSurface]
    });

    expect(runner.state.visuals.gallery).toEqual({ images: [], selected: null });

    runner.state.visuals.gallery.images.push({ id: "demo_image" });
    runner.syncVisualState({ instant: true });

    expect(projectGallery).toHaveBeenCalledWith(
      { images: [{ id: "demo_image" }], selected: null },
      { instant: true }
    );
    expect(renderers.gallery.renderGalleryState).toHaveBeenCalledWith(
      { images: [{ id: "demo_image" }], selected: null },
      { instant: true }
    );
  });

  it("runs a custom surface command through module-owned handlers", () => {
    const onGalleryImage = vi.fn();
    const customSurface = gallerySurfaceModule({ onGalleryImage });
    const renderers = {
      gallery: {
        ...fakeRenderer("gallery", ["galleryImage", "choice", "transition"], ["renderGalleryState"]),
        renderGalleryState: vi.fn()
      }
    };
    const { runner } = makeRunner([
      stage("gallery"),
      galleryImage("demo_image")
    ], {
      renderers,
      surfaceModules: [customSurface]
    });

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.state.visuals.gallery).toEqual({
      images: [{ id: "demo_image" }],
      selected: "demo_image"
    });
    expect(onGalleryImage).toHaveBeenCalledWith(
      { type: "galleryImage", id: "demo_image" },
      { instant: false }
    );
    expect(renderers.gallery.renderGalleryState).toHaveBeenLastCalledWith(
      { images: [{ id: "demo_image" }], selected: "demo_image" },
      { instant: false }
    );
  });

  it("runs module-owned state commands from any mounted story surface", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      saveGalleryImage("phone_photo", "phone_photo_asset")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.state.currentSurface).toBe("irl");
    expect(runner.state.visuals.gallery.images).toEqual([
      expect.objectContaining({ id: "phone_photo", image: "phone_photo_asset" })
    ]);
    expect(renderers.gallery.renderGalleryState).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [expect.objectContaining({ id: "phone_photo" })]
      }),
      expect.objectContaining({ instant: false })
    );
  });

  it("does not run module-owned render commands while their surface is unmounted", () => {
    const onGalleryImage = vi.fn();
    const customSurface = gallerySurfaceModule({ onGalleryImage });
    const renderers = {
      ...fakeRenderers(),
      gallery: {
        ...fakeRenderer("gallery", ["galleryImage", "choice", "transition"], ["renderGalleryState"]),
        renderGalleryState: vi.fn()
      }
    };
    const { runner } = makeRunner([stage("irl")], {
      renderers,
      surfaceModules: [BUILTIN_SURFACE_MODULES[0], customSurface]
    });

    runner.executeCommand(runner.scene.script[0]);

    expect(runner.executeSurfaceCommand(galleryImage("hidden_image"))).toBe(false);
    expect(onGalleryImage).not.toHaveBeenCalled();
  });

  it("replays a custom surface command through the instant module handler", () => {
    const onGalleryImage = vi.fn();
    const customSurface = gallerySurfaceModule({ onGalleryImage });
    const renderers = {
      gallery: {
        ...fakeRenderer("gallery", ["galleryImage", "choice", "transition"], ["renderGalleryState"]),
        renderGalleryState: vi.fn()
      }
    };
    const { runner } = makeRunner([
      stage("gallery"),
      galleryImage("demo_image")
    ], {
      renderers,
      surfaceModules: [customSurface]
    });

    runner.state.currentCommandIndex = 2;
    runner.replaySceneContextToCurrentCommand();

    expect(runner.state.visuals.gallery).toEqual({
      images: [{ id: "demo_image" }],
      selected: "demo_image"
    });
    expect(onGalleryImage).toHaveBeenCalledWith(
      { type: "galleryImage", id: "demo_image" },
      { instant: true }
    );
    expect(renderers.gallery.renderGalleryState).toHaveBeenLastCalledWith(
      { images: [{ id: "demo_image" }], selected: "demo_image" },
      { instant: true }
    );
  });

  it("replays module-owned phone notifications without showing toasts", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      socialPost("notified_post", {
        poster: "alex",
        text: "hello",
        notify: true
      }),
      say("alex", "after notification")
    ]);

    runner.state.currentCommandIndex = 2;
    runner.replaySceneContextToCurrentCommand();

    expect(runner.state.visuals.social.posts).toEqual([
      expect.objectContaining({ id: "notified_post", poster: "alex" })
    ]);
    expect(runner.state.visuals.phone.notifications).toEqual([
      expect.objectContaining({ id: "social:notified_post", app: "social", read: false })
    ]);
    expect(renderers.irl.showPhoneToast).not.toHaveBeenCalled();
  });

  it("throws clearly when replay reconstruction cannot advance", () => {
    const { runner } = makeRunner([
      stage("irl"),
      label("loop"),
      jump("loop"),
      say("alex", "unreachable")
    ]);

    runner.state.currentCommandIndex = 4;

    expect(() => runner.replaySceneContextToCurrentCommand()).toThrow(
      /Replay guard tripped in scene "runner_test_scene" while reconstructing command 4\. Stuck at 2\./
    );
  });

  it("throws clearly when staging an unregistered surface", () => {
    const { runner } = makeRunner([stage("unknown_gallery")]);

    expect(() => runner.executeCommand(runner.scene.script[0])).toThrow(/Unknown surface "unknown_gallery"/);
  });

  it("throws clearly when staging a phone app surface", () => {
    const { runner } = makeRunner([stage("gallery")]);

    expect(() => runner.executeCommand(runner.scene.script[0])).toThrow(
      /Surface "gallery" is a phone app\. Use openPhone\("gallery"\) instead of staging it\./
    );
  });

  it("clears mounted surfaces when a transition selects another scene", () => {
    const nextScene = scene({
      id: "next_scene",
      cast: ["me"],
      script: [stage("texting")]
    });
    const { runner, renderers, compositor } = makeRunner([
      stage("streaming"),
      open("texting"),
      transition("Next", "next_scene")
    ], {
      registry: {
        runner_test_scene: null,
        next_scene: nextScene
      }
    });
    runner.registry.runner_test_scene = runner.scene;

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);
    runner.executeCommand(runner.scene.script[2]);

    const onSelect = renderers.texting.showTransition.mock.calls[0][1].onSelect;
    onSelect();

    expect(renderers.streaming.unmount).toHaveBeenCalledOnce();
    expect(renderers.texting.unmount).toHaveBeenCalledOnce();
    expect(compositor.unregisterLayer).toHaveBeenCalledWith("streaming");
    expect(compositor.unregisterLayer).toHaveBeenCalledWith("texting");
    expect(runner.state.currentSceneId).toBe("next_scene");
    expect(runner.surfaceStack).toEqual(["texting"]);
  });

  it("returns a stable debug snapshot shape", () => {
    const { runner } = makeRunner([
      stage("irl"),
      set("trust", 2)
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.state.sprites.irl.visible = [
      {
        id: "alex",
        outfit: "casual",
        expression: "happy",
        body: "default",
        side: "left",
        flip: true,
        at: "left",
        x: null,
        y: null,
        scale: 1,
        alpha: 1,
        z: null,
        layer: "characters",
        transition: null
      }
    ];
    runner.state.vars.trust = 2;
    runner.lastSpeaker = "alex";
    runner.rollbackBuffer = [{ commandIndex: 0 }];
    runner.rollbackPos = 0;

    const snapshot = runner.getDebugSnapshot();

    expect(snapshot).toMatchObject({
      sceneId: "runner_test_scene",
      commandIndex: 1,
      commandCount: 2,
      activeSurface: "irl",
      surfaceStack: ["irl"],
      speaker: "alex",
      vars: { trust: 2 },
      rollback: { pos: 0, size: 1, rewound: false }
    });
    expect(snapshot.sprites).toEqual([
      {
        id: "alex",
        outfit: "casual",
        expression: "happy",
        body: "default",
        side: "left",
        flip: true,
        at: "left",
        x: null,
        y: null,
        scale: 1,
        alpha: 1,
        z: null,
        layer: "characters"
      }
    ]);
  });
});

describe("SceneRunner author conditions", () => {
  function completeDialogue(compositor, callIndex = 0) {
    compositor.showDialogue.mock.calls[callIndex][2].onComplete();
  }

  it("uses human truthiness for flag checks", () => {
    const { runner } = makeRunner([]);
    runner.state.vars.metAlex = "0";

    expect(runner.evaluateCondition(condition({ flag: "metAlex", then: "yes", else: "no" }))).toBe(false);

    runner.state.vars.metAlex = "yes";
    expect(runner.evaluateCondition(condition({ flag: "metAlex", then: "yes", else: "no" }))).toBe(true);
  });

  it("compares author values without requiring strict JavaScript equality", () => {
    const { runner } = makeRunner([]);
    runner.state.vars.emptyScore = "";
    runner.state.vars.numericScore = "50";

    expect(runner.evaluateCondition(condition({ var: "emptyScore", is: "0", then: "yes", else: "no" }))).toBe(true);
    expect(runner.evaluateCondition(condition({ var: "numericScore", atLeast: 50, then: "yes", else: "no" }))).toBe(true);
    expect(runner.evaluateCondition(condition({ var: "numericScore", moreThan: 50, then: "yes", else: "no" }))).toBe(false);
  });

  it("supports text-presence checks for author-facing conditions", () => {
    const { runner } = makeRunner([]);
    runner.state.vars.name = "  ";

    expect(runner.evaluateCondition(condition({ var: "name", hasText: true, then: "yes", else: "no" }))).toBe(false);

    runner.state.vars.name = "Alex";
    expect(runner.evaluateCondition(condition({ var: "name", hasText: true, then: "yes", else: "no" }))).toBe(true);
  });

  it("runs command blocks from condition then/else branches", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      set("found_keycard", true),
      condition({
        if: { flag: "found_keycard" },
        then: [
          say("alex", "You have clearance.")
        ],
        else: [
          say("alex", "I can't let you in.")
        ]
      }),
      say("alex", "After.")
    ]);

    runner.start();

    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("You have clearance.");

    completeDialogue(compositor);
    runner.advance();

    expect(compositor.showDialogue).toHaveBeenCalledTimes(2);
    expect(compositor.showDialogue.mock.calls[1][0].message).toBe("After.");
  });

  it("evaluates elseIf branches in order", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      set("knows_password", true),
      condition({
        if: { flag: "found_keycard" },
        then: [
          say("alex", "You have clearance.")
        ],
        elseIf: [
          {
            if: { flag: "knows_password" },
            then: [
              say("alex", "Password accepted.")
            ]
          }
        ],
        else: [
          say("alex", "I can't let you in.")
        ]
      })
    ]);

    runner.start();

    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("Password accepted.");
  });

  it("supports compound structured predicates", () => {
    const { runner } = makeRunner([]);
    runner.state.vars.tour_start = "0";
    runner.state.vars.money = "6";
    runner.state.vars.blocked = false;

    expect(runner.evaluateCondition(condition({
      if: {
        all: [
          {
            any: [
              { flag: "tour_start" },
              { var: "money", moreThan: 5 }
            ]
          },
          { not: { flag: "blocked" } }
        ]
      },
      then: "yes",
      else: "no"
    }))).toBe(true);
  });

  it("routes string condition targets through marks or scene ids", () => {
    const nextScene = scene({
      id: "condition_next_scene",
      cast: ["me"],
      script: [
        stage("irl"),
        say("alex", "Next scene.")
      ]
    });
    const { runner, compositor } = makeRunner([
      stage("irl"),
      set("route", true),
      condition({ flag: "route", then: "condition_next_scene", else: "fallback" }),
      mark("fallback"),
      say("alex", "Fallback.")
    ]);
    runner.registry[nextScene.id] = nextScene;

    runner.start();

    expect(runner.scene.id).toBe("condition_next_scene");
    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("Next scene.");
  });
});

describe("SceneRunner audio commands", () => {
  function completeDialogue(compositor, callIndex = 0) {
    compositor.showDialogue.mock.calls[callIndex][2].onComplete();
  }

  it("stores durable music state and calls the audio service", () => {
    const { runner, audio } = makeRunner([
      music("theme", { volume: 0.5, loop: true, fadeIn: 400 }),
      stopMusic({ fadeOut: 250 })
    ]);

    runner.executeCommand(runner.scene.script[0]);
    expect(runner.state.audio.music).toEqual({
      id: "theme",
      volume: 0.5,
      loop: true,
      fadeIn: 400,
      fadeOut: 400
    });
    expect(audio.playMusic).toHaveBeenCalledWith(
      runner.state.audio.music,
      expect.objectContaining({ fadeIn: 400 })
    );

    runner.executeCommand(runner.scene.script[1]);
    expect(runner.state.audio.music).toBeNull();
    expect(audio.stopMusic).toHaveBeenCalledWith(expect.objectContaining({ fadeOut: 250 }));
  });

  it("plays sound and voice as one-shot audio without durable state", () => {
    const { runner, audio } = makeRunner([
      sound("door_slam", { volume: 0.7 }),
      voice("voice_line_001")
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.state.audio.music).toBeNull();
    expect(audio.playSound).toHaveBeenCalledWith({ type: "sound", id: "door_slam", volume: 0.7 });
    expect(audio.playVoice).toHaveBeenCalledWith({ type: "voice", id: "voice_line_001" });
  });

  it("stops named transient sounds without durable state", () => {
    const { runner, audio } = makeRunner([
      sound("phone_buzz", { as: "phone", loop: true, fadeIn: 100 }),
      stopSound("phone", { fadeOut: 250 })
    ]);

    runner.executeCommand(runner.scene.script[0]);
    runner.executeCommand(runner.scene.script[1]);

    expect(runner.state.audio.music).toBeNull();
    expect(audio.playSound).toHaveBeenCalledWith({
      type: "sound",
      id: "phone_buzz",
      as: "phone",
      loop: true,
      fadeIn: 100
    });
    expect(audio.stopSound).toHaveBeenCalledWith("phone", { fadeOut: 250 });
  });

  it("stores durable ambience state and calls the audio service", () => {
    const { runner, audio } = makeRunner([
      ambience("rain_room", { volume: 0.45, loop: true, fadeIn: 800 }),
      stopAmbience({ fadeOut: 300 })
    ]);

    runner.executeCommand(runner.scene.script[0]);
    expect(runner.state.audio.ambience).toEqual({
      id: "rain_room",
      volume: 0.45,
      loop: true,
      fadeIn: 800,
      fadeOut: 800
    });
    expect(audio.playAmbience).toHaveBeenCalledWith(
      runner.state.audio.ambience,
      expect.objectContaining({ fadeIn: 800 })
    );

    runner.executeCommand(runner.scene.script[1]);
    expect(runner.state.audio.ambience).toBeNull();
    expect(audio.stopAmbience).toHaveBeenCalledWith(expect.objectContaining({ fadeOut: 300 }));
  });

  it("applies audioScene presets as durable music and ambience state", () => {
    const { runner, audio } = makeRunner([
      audioScene("demo_room", { transition: 1200 })
    ], {
      audioScenes: {
        demo_room: {
          music: { id: "club_theme", volume: 0.55 },
          ambience: { id: "club_room", volume: 0.25 }
        }
      }
    });

    runner.start();

    expect(runner.state.audio).toEqual({
      music: {
        id: "club_theme",
        volume: 0.55,
        loop: true,
        fadeIn: 1200,
        fadeOut: 1200
      },
      ambience: {
        id: "club_room",
        volume: 0.25,
        loop: true,
        fadeIn: 1200,
        fadeOut: 1200
      }
    });
    expect(audio.playMusic).toHaveBeenCalledWith(
      expect.objectContaining({ id: "club_theme", fadeIn: 1200 }),
      expect.objectContaining({ instant: false })
    );
    expect(audio.playAmbience).toHaveBeenCalledWith(
      expect.objectContaining({ id: "club_room", fadeIn: 1200 }),
      expect.objectContaining({ instant: false })
    );
  });

  it("lets direct music commands override an audioScene preset predictably", () => {
    const { runner } = makeRunner([
      audioScene("demo_room", { transition: 900 }),
      music("manual_theme", { volume: 0.7, fadeIn: 300 })
    ], {
      audioScenes: {
        demo_room: {
          music: { id: "club_theme", volume: 0.55 },
          ambience: { id: "club_room", volume: 0.25 }
        }
      }
    });

    runner.start();

    expect(runner.state.audio.music).toMatchObject({
      id: "manual_theme",
      volume: 0.7,
      fadeIn: 300,
      fadeOut: 300
    });
    expect(runner.state.audio.ambience).toMatchObject({ id: "club_room" });
  });

  it("restores music state across rollback without replaying one-shots", () => {
    const { runner, compositor, audio } = makeRunner([
      stage("irl"),
      music("theme"),
      sound("door_slam"),
      say("alex", "music"),
      stopMusic(),
      say("alex", "quiet")
    ]);

    runner.start();
    expect(runner.state.audio.music).toMatchObject({ id: "theme" });
    expect(audio.playSound).toHaveBeenCalledOnce();

    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.audio.music).toBeNull();

    audio.playSound.mockClear();
    audio.stopAll.mockClear();
    runner.rollBack();

    expect(runner.state.audio.music).toMatchObject({ id: "theme" });
    expect(audio.sync).toHaveBeenLastCalledWith(
      expect.objectContaining({ music: expect.objectContaining({ id: "theme" }) }),
      { instant: true }
    );
    expect(audio.playSound).not.toHaveBeenCalled();
    expect(audio.stopAll).not.toHaveBeenCalled();
  });

  it("restores ambience state across rollback", () => {
    const { runner, compositor, audio } = makeRunner([
      stage("irl"),
      ambience("rain_room"),
      say("alex", "rain"),
      stopAmbience(),
      say("alex", "quiet")
    ]);

    runner.start();
    expect(runner.state.audio.ambience).toMatchObject({ id: "rain_room" });

    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.audio.ambience).toBeNull();

    runner.rollBack();

    expect(runner.state.audio.ambience).toMatchObject({ id: "rain_room" });
    expect(audio.sync).toHaveBeenLastCalledWith(
      expect.objectContaining({ ambience: expect.objectContaining({ id: "rain_room" }) }),
      { instant: true }
    );
  });
});

describe("SceneRunner pause command", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function completeDialogue(compositor, callIndex = 0) {
    compositor.showDialogue.mock.calls[callIndex][2].onComplete();
  }

  it("waits for the requested duration before continuing", () => {
    vi.useFakeTimers();
    const { runner, compositor } = makeRunner([
      stage("irl"),
      pause(1000),
      say("alex", "after")
    ]);

    runner.start();

    expect(runner.state.currentCommandIndex).toBe(1);
    expect(runner.rollbackBuffer).toHaveLength(1);
    expect(compositor.showDialogue).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(compositor.showDialogue).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(runner.state.currentCommandIndex).toBe(2);
  });

  it("lets a player tap skip the remaining pause time", () => {
    vi.useFakeTimers();
    const { runner, compositor } = makeRunner([
      stage("irl"),
      pause(5000),
      say("alex", "skipped")
    ]);

    runner.start();
    runner.advance();

    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(runner.state.currentCommandIndex).toBe(2);

    vi.advanceTimersByTime(5000);
    expect(compositor.showDialogue).toHaveBeenCalledOnce();
  });

  it("clears pending pause timers during rollback reconstruction", () => {
    vi.useFakeTimers();
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("alex", "before"),
      pause(1000),
      say("alex", "after")
    ]);

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.currentCommandIndex).toBe(2);

    runner.rollBack();
    vi.advanceTimersByTime(1000);

    expect(compositor.showDialogue).toHaveBeenCalledTimes(2);
    expect(runner.state.currentCommandIndex).toBe(1);
  });

  it("defers a completed pause while phone navigation is open", () => {
    vi.useFakeTimers();
    const { runner, compositor } = makeRunner([
      stage("irl"),
      pause(1000),
      say("alex", "after")
    ]);

    runner.start();
    runner.openPhoneApp("home");
    vi.advanceTimersByTime(1000);

    expect(runner.pauseReady).toBe(true);
    expect(compositor.showDialogue).not.toHaveBeenCalled();
    expect(runner.state.currentCommandIndex).toBe(1);

    runner.returnToStorySurface();

    expect(runner.pauseReady).toBe(false);
    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(runner.state.currentCommandIndex).toBe(2);
  });
});

describe("SceneRunner advance policy", () => {
  it("treats visible IRL dialogue as advance-ready on the next click", () => {
    const compositor = fakeCompositor();
    compositor.showDialogue.mockImplementation((command, speaker, { onComplete }) => {
      onComplete();
    });
    const { runner } = makeRunner([
      stage("irl"),
      say("alex", "first"),
      say("alex", "second")
    ], { compositor });

    runner.start();

    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(compositor.showDialogue.mock.calls[0][0].message).toBe("first");
    expect(runner.state.currentCommandIndex).toBe(2);

    runner.advance();

    expect(compositor.showDialogue).toHaveBeenCalledTimes(2);
    expect(compositor.showDialogue.mock.calls[1][0].message).toBe("second");
    expect(runner.state.currentCommandIndex).toBe(3);
  });

  it("auto-surfaces a following decision after applying simple state commands", () => {
    const compositor = fakeCompositor();
    compositor.showDialogue.mockImplementation((command, speaker, { onComplete }) => {
      onComplete();
    });
    const { runner, renderers } = makeRunner([
      stage("irl"),
      say("alex", "first"),
      label("decision"),
      set("saw_line", true),
      choice([{ text: "Continue", goto: "done" }]),
      label("done"),
      say("alex", "after")
    ], { compositor });

    runner.start();

    expect(runner.state.vars.saw_line).toBe(true);
    expect(runner.state.currentCommandIndex).toBe(4);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.irl.showChoice).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [expect.objectContaining({ text: "Continue" })]
      }),
      expect.anything()
    );
  });
});

describe("SceneRunner screen effects", () => {
  function completeDialogue(compositor, callIndex = 0) {
    compositor.showDialogue.mock.calls[callIndex][2].onComplete();
  }

  it("plays flash and shake as transient compositor effects", () => {
    const { runner, compositor } = makeRunner([
      flash({ color: "rgba(255,0,0,0.8)", duration: 120 }),
      shake({ intensity: 18, duration: 240 }),
      stage("irl"),
      say("alex", "after")
    ]);

    runner.start();

    expect(compositor.playScreenEffect).toHaveBeenNthCalledWith(1, {
      type: "flash",
      color: "rgba(255,0,0,0.8)",
      duration: 120
    });
    expect(compositor.playScreenEffect).toHaveBeenNthCalledWith(2, {
      type: "shake",
      intensity: 18,
      duration: 240
    });
    expect(runner.state.currentCommandIndex).toBe(3);
    expect(compositor.showDialogue).toHaveBeenCalledOnce();
  });

  it("does not replay screen effects during rollback reconstruction", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("alex", "before"),
      flash(),
      shake(),
      say("alex", "after")
    ]);

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    expect(compositor.playScreenEffect).toHaveBeenCalledTimes(2);

    compositor.playScreenEffect.mockClear();
    runner.rollBack();
    runner.rollForward();

    expect(compositor.playScreenEffect).not.toHaveBeenCalled();
  });
});

describe("SceneRunner rollback sprite state", () => {
  function completeTextBlock(renderers, callIndex = 0) {
    renderers.texting.showTextBlock.mock.calls[callIndex][1].onComplete();
  }

  function completeStreamChat(renderers, callIndex = 0) {
    renderers.streaming.showStreamChatBlock.mock.calls[callIndex][1].onComplete();
  }

  function completeDialogue(compositor, callIndex = 0) {
    compositor.showDialogue.mock.calls[callIndex][2].onComplete();
  }

  function completeNarration(compositor, callIndex = 0) {
    compositor.showNarration.mock.calls[callIndex][1].onComplete();
  }

  it("rolls IRL say expressions backward and forward from state-owned sprites", () => {
    const { runner, renderers, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", side: "left", flip: true }),
      say("alex", "first", { expression: "happy" }),
      say("alex", "second", { expression: "smirk" })
    ]);

    runner.start();

    expect(runner.rollbackBuffer).toHaveLength(1);
    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      expression: "happy",
      side: "left",
      flip: true
    });

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.rollbackBuffer).toHaveLength(2);
    expect(runner.state.sprites.irl.visible[0].expression).toBe("smirk");

    runner.rollBack();

    expect(runner.state.sprites.irl.visible[0].expression).toBe("happy");
    expect(renderers.irl.renderSpriteState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: [expect.objectContaining({ id: "alex", expression: "happy" })]
      }),
      expect.objectContaining({ instant: true })
    );

    runner.rollForward();

    expect(runner.state.sprites.irl.visible[0].expression).toBe("smirk");
  });

  it("deduplicates rollback snapshots for the same readable command", () => {
    const { runner } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral" }),
      say("alex", "same beat")
    ]);

    runner.start();
    expect(runner.rollbackBuffer).toHaveLength(1);

    runner.captureBeatSnapshot();

    expect(runner.rollbackBuffer).toHaveLength(1);
    expect(runner.rollbackBuffer[0].commandIndex).toBe(runner.state.currentCommandIndex);
  });

  it("does not double-apply relative variable mutations during rollback replay", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      set("gold", "+5"),
      say("alex", "first"),
      say("alex", "second")
    ]);

    runner.start();
    expect(runner.state.vars.gold).toBe(5);

    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.vars.gold).toBe(5);

    runner.rollBack();

    expect(runner.state.vars.gold).toBe(5);
  });

  it("does not reroll random variables during rollback replay", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      roll("dice", 1, 1000000),
      say("alex", "first"),
      say("alex", "second")
    ]);

    runner.start();
    const originalRoll = runner.state.vars.dice;

    completeDialogue(compositor, 0);
    runner.advance();
    runner.rollBack();

    expect(runner.state.vars.dice).toBe(originalRoll);
  });

  it("steps backward through distinct readable lines instead of repeating the current line", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral" }),
      say("alex", "first"),
      say("alex", "second"),
      say("alex", "third")
    ]);

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    completeDialogue(compositor, 1);
    runner.advance();

    expect(runner.rollbackBuffer.map((snapshot) => snapshot.commandIndex)).toEqual([2, 3, 4]);

    runner.rollBack();
    expect(runner.state.currentCommandIndex).toBe(3);
    expect(compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("second");

    runner.rollBack();
    expect(runner.state.currentCommandIndex).toBe(2);
    expect(compositor.showDialogue.mock.calls.at(-1)[0].message).toBe("first");
  });

  it("restores and removes sprites when rolling across hide commands", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", side: "center" }),
      say("alex", "still here", { expression: "happy" }),
      hide("alex"),
      say("me", "gone")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex"]);

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.visible).toEqual([]);

    runner.rollBack();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex"]);

    runner.rollForward();
    expect(runner.state.sprites.irl.visible).toEqual([]);
  });

  it("rolls IRL move and expression commands backward and forward", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", at: "left" }),
      say("alex", "left"),
      expression("alex", "smirk"),
      move("alex", { at: "right", scale: 1.08, z: 36 }),
      say("alex", "right")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      expression: "neutral",
      at: "left",
      scale: 1
    });

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      expression: "smirk",
      at: "right",
      scale: 1.08,
      z: 36
    });

    runner.rollBack();
    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      expression: "neutral",
      at: "left",
      scale: 1
    });

    runner.rollForward();
    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      expression: "smirk",
      at: "right",
      scale: 1.08,
      z: 36
    });
  });

  it("rolls hideAll backward and forward", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", at: "left" }),
      show("riley", { outfit: "stage_outfit", expression: "smug", at: "right" }),
      say("alex", "crowded"),
      hideAll(),
      say("me", "empty")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex", "riley"]);

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.visible).toEqual([]);

    runner.rollBack();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex", "riley"]);

    runner.rollForward();
    expect(runner.state.sprites.irl.visible).toEqual([]);
  });

  it("rolls clearStage backward and forward across characters and images", () => {
    const { runner, renderers, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", at: "left" }),
      show("riley", { outfit: "stage_outfit", expression: "smug", at: "right" }),
      cg("demo_portrait"),
      image("letter", "demo_portrait", { at: "center" }),
      say("alex", "full stage"),
      clearStage({ transition: "fade" }),
      narrate("empty stage")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex", "riley"]);
    expect(runner.state.sprites.irl.images.map((entry) => entry.id)).toEqual(["__cg", "letter"]);
    expect(runner.state.sprites.irl.focus).toBe("alex");

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl).toEqual({
      visible: [],
      images: [],
      focus: null
    });
    expect(renderers.irl.setExitTransition).toHaveBeenCalledWith("alex", "fade");
    expect(renderers.irl.setExitTransition).toHaveBeenCalledWith("riley", "fade");
    expect(renderers.irl.setImageExitTransition).toHaveBeenCalledWith("__cg", "fade");
    expect(renderers.irl.setImageExitTransition).toHaveBeenCalledWith("letter", "fade");

    runner.rollBack();
    expect(runner.state.sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["alex", "riley"]);
    expect(runner.state.sprites.irl.images.map((entry) => entry.id)).toEqual(["__cg", "letter"]);

    runner.rollForward();
    expect(runner.state.sprites.irl).toEqual({
      visible: [],
      images: [],
      focus: null
    });
  });

  it("rolls IRL CGs and image displayables backward and forward", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      cg("demo_portrait", { transition: "dissolve" }),
      image("letter", "demo_portrait", { at: "center", scale: 0.72 }),
      say("alex", "look"),
      clearImage("letter"),
      clearCg(),
      say("alex", "gone")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.images.map((entry) => entry.id)).toEqual(["__cg", "letter"]);

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.images).toEqual([]);

    runner.rollBack();
    expect(runner.state.sprites.irl.images).toEqual([
      expect.objectContaining({ id: "__cg", asset: "demo_portrait", kind: "cg" }),
      expect.objectContaining({ id: "letter", asset: "demo_portrait", kind: "image" })
    ]);

    runner.rollForward();
    expect(runner.state.sprites.irl.images).toEqual([]);
  });

  it("moves image displayables without changing their asset", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      image("letter", "demo_portrait", { at: "center", scale: 0.72 }),
      say("alex", "look"),
      moveImage("letter", { at: "right", scale: 0.9, alpha: 0.7 }),
      say("alex", "moved")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.images[0]).toMatchObject({
      id: "letter",
      asset: "demo_portrait",
      at: "center",
      scale: 0.72
    });

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.images[0]).toMatchObject({
      id: "letter",
      asset: "demo_portrait",
      at: "right",
      scale: 0.9,
      alpha: 0.7
    });
  });

  it("clears focus for narration and restores dialogue focus on rollback", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral" }),
      say("alex", "look", { expression: "happy" }),
      narrate("The room goes quiet.")
    ]);

    runner.start();
    expect(runner.state.sprites.irl.focus).toBe("alex");

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.state.sprites.irl.focus).toBeNull();

    completeNarration(compositor, 0);
    runner.rollBack();

    expect(runner.state.sprites.irl.focus).toBe("alex");
  });

  it("clears stale renderer state when loading from a checkpoint", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral" }),
      say("alex", "line")
    ], {
      storageKeys: {
        save: "test-save",
        autosave: "test-autosave",
        slotPrefix: "test-slot-"
      }
    });
    localStorage.setItem(
      "test-save",
      JSON.stringify({
        currentSceneId: "runner_test_scene",
        vars: { trust: 1 },
        rng: 123
      })
    );

    runner.start();
    expect(runner.state.sprites.irl.visible).toHaveLength(1);

    runner.load();

    expect(renderers.irl.reset).toHaveBeenCalled();
    expect(renderers.irl.unmount).toHaveBeenCalled();
    expect(runner.state.vars).toEqual({ trust: 1 });
    expect(runner.state.sprites.irl.visible).toHaveLength(1);
  });

  it("uses configured storage keys for autosave and manual slots", () => {
    const { runner } = makeRunner([stage("irl"), say("alex", "line")], {
      storageKeys: {
        save: "configured-save",
        autosave: "configured-autosave",
        slotPrefix: "configured-slot-"
      }
    });

    runner.start();
    runner.save({ announce: true, slot: 2 });

    expect(localStorage.getItem("configured-autosave")).toBeTruthy();
    expect(localStorage.getItem("configured-slot-2")).toBeTruthy();
    expect(localStorage.getItem("jiishii-autosave")).toBeNull();
    expect(localStorage.getItem("jiishii-save-slot-2")).toBeNull();
  });

  it("writes versioned scene-entry autosave envelopes with display metadata", () => {
    const { runner } = makeRunner([stage("irl"), say("alex", "line")], {
      storageKeys: {
        save: "metadata-save",
        autosave: "metadata-autosave",
        slotPrefix: "metadata-slot-"
      }
    });

    runner.start();

    const saved = JSON.parse(localStorage.getItem("metadata-autosave"));
    expect(saved).toMatchObject({
      schemaVersion: 1,
      kind: "scene-entry",
      metadata: expect.objectContaining({
        label: "Auto-Save",
        kind: "scene-entry",
        sceneId: "runner_test_scene",
        currentSceneId: "runner_test_scene",
        sceneTitle: "runner_test_scene",
        commandIndex: 0,
        activeSurface: "texting"
      }),
      state: expect.objectContaining({
        currentSceneId: "runner_test_scene",
        currentCommandIndex: 0,
        vars: {}
      })
    });
  });

  it("writes manual saves as save-anywhere snapshot envelopes", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", side: "left" }),
      say("alex", "first", { expression: "happy" }),
      say("alex", "second", { expression: "smirk" })
    ], {
      storageKeys: {
        save: "manual-snapshot-save",
        autosave: "manual-snapshot-autosave",
        slotPrefix: "manual-snapshot-slot-"
      }
    });

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    const result = runner.save({ announce: true, slot: 3 });

    const saved = JSON.parse(localStorage.getItem("manual-snapshot-slot-3"));
    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(saved).toMatchObject({
      schemaVersion: 1,
      kind: "snapshot",
      metadata: expect.objectContaining({
        label: "Slot 3",
        kind: "snapshot",
        sceneId: "runner_test_scene",
        commandIndex: 3,
        activeSurface: "irl"
      }),
      state: expect.objectContaining({
        currentSceneId: "runner_test_scene",
        currentCommandIndex: 3,
        currentSurface: "irl"
      })
    });
    expect(saved.state.sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      expression: "smirk"
    });
  });

  it("keeps play and session saves working when localStorage rejects writes", () => {
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { runner, compositor, renderers } = makeRunner([
      stage("irl"),
      say("alex", "first"),
      say("alex", "second")
    ], {
      storageKeys: {
        save: "blocked-save",
        autosave: "blocked-autosave",
        slotPrefix: "blocked-slot-"
      }
    });
    localStorage.setItem.mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => runner.start()).not.toThrow();
    expect(runner.storageFallbackWarned).toBe(true);
    expect(consoleWarning).toHaveBeenCalledOnce();

    completeDialogue(compositor, 0);
    expect(() => runner.advance()).not.toThrow();
    const result = runner.save({ announce: true, slot: 1 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      kind: "snapshot",
      durable: false,
      message: "Saved for this session"
    }));
    expect(renderers.irl.setSaveStatus).toHaveBeenCalledWith("Saved for this session");

    runner.state.currentCommandIndex = 99;
    const loadResult = runner.load({ slot: 1 });

    expect(loadResult).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(runner.state.currentCommandIndex).toBe(2);
    consoleWarning.mockRestore();
  });

  it("loads a manual save-anywhere slot back to the exact saved beat", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      show("alex", { outfit: "casual", expression: "neutral", side: "left" }),
      say("alex", "first", { expression: "happy" }),
      say("alex", "second", { expression: "smirk" })
    ], {
      storageKeys: {
        save: "manual-load-save",
        autosave: "manual-load-autosave",
        slotPrefix: "manual-load-slot-"
      }
    });

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    runner.save({ announce: true, slot: 1 });

    runner.rollBack();
    expect(runner.state.sprites.irl.visible[0].expression).toBe("happy");
    compositor.showDialogue.mockClear();

    const result = runner.load({ slot: 1 });

    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(runner.state.sprites.irl.visible[0].expression).toBe("smirk");
    expect(runner.rollbackBuffer.at(-1)).toEqual(
      expect.objectContaining({
        commandIndex: 3,
        currentSurface: "irl"
      })
    );
    expect(compositor.showDialogue).toHaveBeenCalledWith(
      expect.objectContaining({ message: "second" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("loads phone wallpaper, gallery images, and social follows from snapshot saves", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      setWallpaper("tour_wallpaper"),
      saveGalleryImage("tour_photo", "tour_gallery_selfie", { tags: ["Guide"] }),
      socialPost("tour_post", { poster: "alex", text: "hello" }),
      socialLike("tour_post"),
      say("alex", "saved phone state")
    ], {
      storageKeys: {
        save: "phone-snapshot-save",
        autosave: "phone-snapshot-autosave",
        slotPrefix: "phone-snapshot-slot-"
      }
    });

    runner.start();
    completeDialogue(compositor, 0);
    runner.followSocialPoster("alex");
    runner.likeSocialPost("tour_post");
    runner.save({ announce: true, slot: 1 });

    runner.state.visuals.phone.wallpaperImage = null;
    runner.state.visuals.gallery.images = [];
    runner.state.visuals.social.posts = [];
    runner.state.visuals.social.follows = {};
    runner.state.visuals.social.likes = {};

    const result = runner.load({ slot: 1 });

    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(runner.state.visuals.phone.wallpaperImage).toBe("tour_wallpaper");
    expect(runner.state.visuals.gallery.images).toEqual([
      expect.objectContaining({ id: "tour_photo", image: "tour_gallery_selfie", tags: ["Guide"] })
    ]);
    expect(runner.state.visuals.social.posts).toEqual([
      expect.objectContaining({ id: "tour_post", poster: "alex" })
    ]);
    expect(runner.state.visuals.social.follows).toEqual({ alex: true });
    expect(runner.state.visuals.social.likes).toEqual({ tour_post: true });
  });

  it("loads updated phone app state from scene-entry autosaves, including player follows and likes", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      setWallpaper("tour_wallpaper"),
      saveGalleryImage("tour_photo", "tour_gallery_selfie"),
      socialPost("tour_post", { poster: "alex", text: "hello" }),
      say("alex", "saved phone state")
    ], {
      storageKeys: {
        save: "phone-entry-save",
        autosave: "phone-entry-autosave",
        slotPrefix: "phone-entry-slot-"
      }
    });

    runner.start();
    completeDialogue(compositor, 0);
    runner.followSocialPoster("alex");
    runner.likeSocialPost("tour_post");
    localStorage.setItem("phone-entry-save", localStorage.getItem("phone-entry-autosave"));

    runner.state.visuals.phone.wallpaperImage = null;
    runner.state.visuals.gallery.images = [];
    runner.state.visuals.social.posts = [];
    runner.state.visuals.social.follows = {};
    runner.state.visuals.social.likes = {};

    const result = runner.load();

    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "scene-entry" }));
    expect(runner.state.visuals.phone.wallpaperImage).toBe("tour_wallpaper");
    expect(runner.state.visuals.gallery.images).toEqual([
      expect.objectContaining({ id: "tour_photo", image: "tour_gallery_selfie" })
    ]);
    expect(runner.state.visuals.social.posts).toEqual([
      expect.objectContaining({ id: "tour_post", poster: "alex" })
    ]);
    expect(runner.state.visuals.social.follows).toEqual({ alex: true });
    expect(runner.state.visuals.social.likes).toEqual({ tour_post: true });
  });

  it("keeps current rollback semantics for phone wallpaper and persistent gallery/social entries", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      setWallpaper("wallpaper_before"),
      saveGalleryImage("before_temp", "before_temp_asset"),
      saveGalleryImage("before_persistent", "before_persistent_asset", { persistent: true }),
      socialPost("before_post", { poster: "alex", text: "before", persistent: true }),
      say("alex", "first phone beat"),
      setWallpaper("wallpaper_after"),
      saveGalleryImage("after_temp", "after_temp_asset"),
      saveGalleryImage("after_persistent", "after_persistent_asset", { persistent: true }),
      socialPost("after_temp_post", { poster: "alex", text: "after temp" }),
      socialPost("after_persistent_post", { poster: "alex", text: "after", persistent: true }),
      say("alex", "second phone beat")
    ]);

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();
    runner.openPhoneApp("gallery");

    expect(runner.isPhoneOpen()).toBe(true);
    expect(runner.state.visuals.gallery.images.map((image) => image.id)).toEqual([
      "before_temp",
      "before_persistent",
      "after_temp",
      "after_persistent"
    ]);

    runner.rollBack();

    expect(runner.isPhoneOpen()).toBe(false);
    expect(runner.state.currentSurface).toBe("irl");
    expect(runner.state.visuals.phone.wallpaperImage).toBe("wallpaper_after");
    expect(runner.state.visuals.gallery.images.map((image) => image.id)).toEqual([
      "before_temp",
      "before_persistent",
      "after_persistent"
    ]);
    expect(runner.state.visuals.social.posts.map((post) => post.id)).toEqual([
      "before_post",
      "after_persistent_post"
    ]);
  });

  it("loads a snapshot saved while the phone is open back to the underlying blocked story choice", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      choice([
        { text: "Stay", goto: "stay" },
        { text: "Leave", goto: "leave" }
      ])
    ], {
      storageKeys: {
        save: "phone-open-save",
        autosave: "phone-open-autosave",
        slotPrefix: "phone-open-slot-"
      }
    });

    runner.start();
    runner.openPhoneApp("home");
    runner.openPhoneApp("gallery");
    runner.save({ announce: true, slot: 1 });

    runner.returnToStorySurface();
    runner.blockingInput = false;
    runner.state.currentCommandIndex = 99;

    const result = runner.load({ slot: 1 });

    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(runner.surfaceStack).toEqual(["irl"]);
    expect(runner.state.currentSurface).toBe("irl");
    expect(runner.isPhoneOpen()).toBe(false);
    expect(runner.blockingInput).toBe(true);
    expect(renderers.irl.showChoice).toHaveBeenCalled();
  });

  it("handles corrupt saves without mutating the current runner state", () => {
    const { runner, renderers } = makeRunner([stage("irl"), set("trust", 1), say("alex", "line")], {
      storageKeys: {
        save: "corrupt-save",
        autosave: "corrupt-autosave",
        slotPrefix: "corrupt-slot-"
      }
    });
    localStorage.setItem("corrupt-save", "{bad json");

    runner.start();
    const before = structuredClone(runner.state);
    const result = runner.load();

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "corrupt",
        message: "Save could not be loaded"
      })
    );
    expect(runner.state).toEqual(before);
    expect(renderers.irl.setSaveStatus).toHaveBeenCalledWith("Save could not be loaded");
  });

  it("rejects saves for scenes that are not in the registry without mutating state", () => {
    const { runner, renderers } = makeRunner([stage("irl"), set("trust", 1), say("alex", "line")], {
      storageKeys: {
        save: "missing-scene-save",
        autosave: "missing-scene-autosave",
        slotPrefix: "missing-scene-slot-"
      }
    });
    localStorage.setItem(
      "missing-scene-save",
      JSON.stringify({
        currentSceneId: "not_registered",
        vars: { trust: 99 },
        rng: 321
      })
    );

    runner.start();
    const before = structuredClone(runner.state);
    const result = runner.load();

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "missing-scene",
        message: "Saved scene is not available"
      })
    );
    expect(runner.state).toEqual(before);
    expect(renderers.irl.setSaveStatus).toHaveBeenCalledWith("Saved scene is not available");
  });

  it("loads from configured legacy save keys when current keys are empty", () => {
    const { runner } = makeRunner([stage("irl"), say("alex", "line")], {
      storageKeys: {
        save: "current-save",
        autosave: "current-autosave",
        slotPrefix: "current-slot-",
        legacySave: "legacy-save"
      }
    });
    localStorage.setItem(
      "legacy-save",
      JSON.stringify({
        currentSceneId: "runner_test_scene",
        vars: { legacy: true },
        rng: 321
      })
    );

    runner.load();

    expect(runner.state.vars).toEqual({ legacy: true });
    expect(runner.state.rng).toBe(321);
  });

  it("rolls background state backward and forward", () => {
    const onBackground = vi.fn();
    const { runner, compositor } = makeRunner([
      stage("irl"),
      background("kitchen day", { transition: "cut" }),
      say("alex", "first"),
      background("bedroom night", { transition: "fade_to_black", duration: 900 }),
      say("alex", "second")
    ], { onBackground });

    runner.start();
    expect(runner.state.visuals.background).toMatchObject({ id: "__background", asset: "kitchen day" });

    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.state.visuals.background).toMatchObject({ id: "__background", asset: "bedroom night" });

    runner.rollBack();
    expect(runner.state.visuals.background).toMatchObject({ id: "__background", asset: "kitchen day" });
    expect(onBackground).toHaveBeenLastCalledWith("kitchen day", expect.objectContaining({ transition: "cut" }));

    runner.rollForward();
    expect(runner.state.visuals.background).toMatchObject({ id: "__background", asset: "bedroom night" });
  });

  it("restores a snapshot save through rollback reconstruction state", () => {
    const onBackground = vi.fn();
    const { runner, renderers, compositor, audio } = makeRunner([
      stage("irl"),
      background("kitchen day", { transition: "cut" }),
      show("alex", { outfit: "casual", expression: "neutral", side: "left", flip: true }),
      image("letter", "demo_portrait", { at: "right", scale: 0.8 }),
      music("quiet_theme"),
      say("alex", "first", { expression: "happy" }),
      background("bedroom night", { transition: "fade_to_black", duration: 900 }),
      move("alex", { at: "center", scale: 1.1 }),
      moveImage("letter", { alpha: 0.5 }),
      say("alex", "second", { expression: "smirk" })
    ], {
      onBackground,
      storageKeys: {
        save: "snapshot-save",
        autosave: "snapshot-autosave",
        slotPrefix: "snapshot-slot-"
      }
    });

    runner.start();
    completeDialogue(compositor, 0);
    runner.advance();

    const snapshot = runner.createSnapshotSave({ label: "Internal Snapshot" });
    localStorage.setItem("snapshot-save", JSON.stringify(snapshot));

    runner.applyHideSprite("alex", { instant: true });
    runner.state.visuals.background = { id: "wrong room", transition: "cut" };
    renderers.irl.renderSpriteState.mockClear();
    compositor.showDialogue.mockClear();
    onBackground.mockClear();

    const result = runner.load();

    expect(result).toEqual(expect.objectContaining({ ok: true, kind: "snapshot" }));
    expect(runner.state.currentSceneId).toBe("runner_test_scene");
    expect(runner.rollbackBuffer.at(-1)).toEqual(
      expect.objectContaining({
        commandIndex: 9,
        currentSurface: "irl"
      })
    );
    expect(runner.state.sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      expression: "smirk",
      at: "center",
      scale: 1.1,
      side: "left",
      flip: true
    });
    expect(runner.state.sprites.irl.images[0]).toMatchObject({
      id: "letter",
      asset: "demo_portrait",
      alpha: 0.5
    });
    expect(runner.state.visuals.background).toMatchObject({ id: "__background", asset: "bedroom night" });
    expect(compositor.showDialogue).toHaveBeenCalledWith(
      expect.objectContaining({ message: "second" }),
      expect.anything(),
      expect.anything()
    );
    expect(renderers.irl.renderSpriteState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: [expect.objectContaining({ id: "alex", expression: "smirk" })]
      }),
      expect.objectContaining({ instant: true })
    );
    expect(onBackground).toHaveBeenLastCalledWith(
      "bedroom night",
      expect.objectContaining({ transition: "cut" })
    );
    expect(audio.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        music: expect.objectContaining({ id: "quiet_theme" })
      }),
      expect.objectContaining({ instant: true })
    );
  });

  it("matches live state when replaying a mixed command prefix", () => {
    const script = [
      stage("irl"),
      background("tour room day", { transition: "cut" }),
      show("alex", { outfit: "casual", expression: "neutral", side: "left" }),
      image("photo", "tour_gallery_selfie", { at: "right", scale: 0.75 }),
      music("quiet_theme"),
      ambience("room_tone"),
      set("gold", "+5"),
      roll("dice", 1, 1000000),
      move("alex", { at: "center", scale: 1.1 }),
      moveImage("photo", { alpha: 0.6 }),
      hide("alex"),
      stopMusic(),
      stopAmbience()
    ];
    const live = makeRunner(script);

    live.runner.start();

    const replay = makeRunner(script);
    replay.runner.state.currentCommandIndex = live.runner.state.currentCommandIndex;
    replay.runner.state.vars = structuredClone(live.runner.state.vars);
    replay.runner.state.rng = live.runner.state.rng;
    replay.runner.replaySceneContextToCurrentCommand();

    expect(comparableReplayState(replay.runner)).toEqual(comparableReplayState(live.runner));
  });

  it("snapshots the visible beat index even when presentation completes immediately", () => {
    const compositor = fakeCompositor();
    compositor.showDialogue.mockImplementation((command, speaker, { onComplete }) => {
      onComplete();
    });
    const { runner } = makeRunner([
      stage("irl"),
      say("alex", "visible now"),
      say("alex", "next")
    ], { compositor });

    runner.start();

    expect(runner.state.currentCommandIndex).toBe(2);
    expect(runner.rollbackBuffer.at(-1).commandIndex).toBe(1);
    expect(runner.createSnapshotSave().state.currentCommandIndex).toBe(1);
  });

  it("treats visual transitions as nonblocking state projections", () => {
    const { runner, compositor, renderers } = makeRunner([
      stage("irl"),
      background("kitchen day", { transition: "fade_to_black", duration: 900 }),
      show("alex", { outfit: "casual", expression: "neutral", transition: "dissolve" }),
      move("alex", { at: "right", transition: "dissolve" }),
      image("letter", "demo_portrait", { transition: "dissolve" }),
      moveImage("letter", { alpha: 0.6, transition: "dissolve" }),
      say("alex", "line")
    ]);

    runner.start();

    expect(compositor.showDialogue).toHaveBeenCalledOnce();
    expect(renderers.irl.renderSpriteState).toHaveBeenCalled();
    expect(runner.state.currentCommandIndex).toBe(6);
    expect(runner.isWaitingForPlayer).toBe(true);
  });

  it("rolls texting thread messages from state-owned scrollback", () => {
    const { runner, renderers } = makeRunner([
      stage("texting"),
      thread("alex"),
      say("alex", "first"),
      say("alex", "second")
    ]);

    runner.start();
    completeTextBlock(renderers, 0);
    expect(runner.state.visuals.texting.messages.map((message) => message.message)).toEqual(["first"]);

    runner.advance();
    completeTextBlock(renderers, 1);
    expect(runner.state.visuals.texting.messages.map((message) => message.message)).toEqual(["first", "second"]);

    runner.rollBack();
    expect(runner.state.visuals.texting.messages.map((message) => message.message)).toEqual(["first"]);
    expect(renderers.texting.renderTextingState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messages: [expect.objectContaining({ message: "first" })]
      }),
      expect.objectContaining({ characters: runner.characters })
    );
  });

  it("rolls streaming chrome and chat from state-owned stream state", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      streamLayout({ streamerName: "Alex", title: "starting", viewers: 10 }),
      streamWindow("live", "cam_one"),
      streamChatBlock([streamChat("viewer1", "first")]),
      streamTitle("later"),
      streamChatBlock([streamChat("viewer2", "second")])
    ]);

    runner.start();
    completeStreamChat(renderers, 0);
    expect(runner.state.visuals.streaming).toMatchObject({
      title: "starting",
      window: { state: "live", image: "cam_one" },
      chat: [{ id: "viewer1", message: "first" }]
    });

    runner.advance();
    completeStreamChat(renderers, 1);
    expect(runner.state.visuals.streaming.chat.map((message) => message.message)).toEqual(["first", "second"]);
    expect(runner.state.visuals.streaming.title).toBe("later");

    runner.rollBack();
    expect(runner.state.visuals.streaming.chat.map((message) => message.message)).toEqual(["first"]);
    expect(runner.state.visuals.streaming.title).toBe("starting");
    expect(renderers.streaming.renderStreamingState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "starting",
        chat: [expect.objectContaining({ message: "first" })]
      })
    );
  });

  it("records IRL dialogue and narration in runner-owned history", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("alex", "hello"),
      narrate("The room goes quiet.")
    ]);

    runner.start();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({
        kind: "dialogue",
        speaker: "alex",
        name: "alex",
        message: "hello",
        surface: "irl"
      })
    ]);

    completeDialogue(compositor, 0);
    runner.advance();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({ message: "hello" }),
      expect.objectContaining({
        kind: "narration",
        speaker: null,
        message: "The room goes quiet.",
        surface: "irl"
      })
    ]);
  });

  it("records IRL line blocks in runner-owned history", () => {
    const { runner, renderers } = makeRunner([
      stage("irl"),
      lineBlock([
        line("alex", "first"),
        line("riley", "second")
      ])
    ]);

    runner.start();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({
        kind: "dialogue",
        speaker: "alex",
        message: "first",
        surface: "irl"
      }),
      expect.objectContaining({
        kind: "dialogue",
        speaker: "riley",
        message: "second",
        surface: "irl"
      })
    ]);
    expect(renderers.irl.showLineBlock).toHaveBeenCalledOnce();
  });

  it("records texting say blocks in runner-owned history", () => {
    const { runner } = makeRunner([
      stage("texting"),
      thread("alex"),
      say("alex", "phone line")
    ]);

    runner.start();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({
        kind: "text",
        speaker: "alex",
        name: "alex",
        message: "phone line",
        surface: "texting"
      })
    ]);
  });

  it("records streaming chat, narration, system, and post lines", () => {
    const { runner, renderers, compositor } = makeRunner([
      stage("streaming"),
      streamSystem("Stream starting."),
      streamPost("first"),
      streamChatBlock([streamChat("viewer1", "hello")]),
      streamNarration("Alex leans toward the camera.")
    ]);

    runner.start();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({ kind: "system", message: "Stream starting.", surface: "streaming" }),
      expect.objectContaining({ kind: "post", speaker: "me", message: "first", surface: "streaming" }),
      expect.objectContaining({ kind: "streamChat", speaker: "viewer1", message: "hello", surface: "streaming" })
    ]);

    completeStreamChat(renderers, 0);
    runner.advance();

    expect(runner.getHistory()).toEqual([
      expect.objectContaining({ message: "Stream starting." }),
      expect.objectContaining({ message: "first" }),
      expect.objectContaining({ message: "hello" }),
      expect.objectContaining({ kind: "narration", message: "Alex leans toward the camera.", surface: "streaming" })
    ]);
    expect(compositor.showNarration).toHaveBeenCalledOnce();
  });

  it("rolls reader history backward and forward from snapshots", () => {
    const { runner, compositor } = makeRunner([
      stage("irl"),
      say("alex", "first"),
      say("alex", "second")
    ]);

    runner.start();
    expect(runner.getHistory().map((entry) => entry.message)).toEqual(["first"]);

    completeDialogue(compositor, 0);
    runner.advance();
    expect(runner.getHistory().map((entry) => entry.message)).toEqual(["first", "second"]);

    runner.rollBack();
    expect(runner.getHistory().map((entry) => entry.message)).toEqual(["first"]);

    runner.rollForward();
    expect(runner.getHistory().map((entry) => entry.message)).toEqual(["first", "second"]);
  });

  it("reports runner-owned history in the debug snapshot", () => {
    const { runner } = makeRunner([
      stage("texting"),
      say("alex", "debug line")
    ]);

    runner.start();

    expect(runner.getDebugSnapshot()).toEqual(
      expect.objectContaining({
        historySize: 1
      })
    );
  });

  it("records stream image state before the readable image beat completes", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      streamImage("cam_one")
    ]);

    runner.start();

    expect(runner.state.visuals.streaming.window).toMatchObject({
      state: "live",
      image: "cam_one",
      media: {
        kind: "image",
        asset: "cam_one"
      }
    });
    expect(runner.rollbackBuffer[0].visuals.streaming.window).toMatchObject({
      state: "live",
      image: "cam_one",
      media: {
        kind: "image",
        asset: "cam_one"
      }
    });
    expect(renderers.streaming.showStreamImage).toHaveBeenCalledOnce();
  });

  it("lets non-looping stream video advance while it plays", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      streamVideo("clip_one", { mode: "replace", image: "cam_one", startAt: 100, endAt: 900 }),
      streamChatBlock([streamChat("viewer1", "video is running")])
    ]);

    runner.start();

    expect(runner.state.visuals.streaming.window).toMatchObject({
      state: "live",
      image: null,
      media: {
        kind: "video",
        asset: "clip_one",
        mode: "replace",
        startAt: 100,
        endAt: 900,
        endImage: "cam_one"
      }
    });
    expect(renderers.streaming.showStreamVideo).toHaveBeenCalledOnce();
    expect(renderers.streaming.showStreamChatBlock).toHaveBeenCalledOnce();

    renderers.streaming.showStreamVideo.mock.calls[0][1].onComplete();

    expect(runner.state.visuals.streaming.window).toMatchObject({
      state: "live",
      image: "cam_one",
      media: {
        kind: "image",
        asset: "cam_one"
      }
    });
  });

  it("can wait for a stream video when the author opts in", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      streamVideo("clip_one", { mode: "replace", image: "cam_one", wait: true }),
      streamChatBlock([streamChat("viewer1", "after video")])
    ]);

    runner.start();

    expect(renderers.streaming.showStreamVideo).toHaveBeenCalledOnce();
    expect(renderers.streaming.showStreamChatBlock).not.toHaveBeenCalled();

    renderers.streaming.showStreamVideo.mock.calls[0][1].onComplete();
    expect(renderers.streaming.showStreamChatBlock).not.toHaveBeenCalled();

    runner.advance();

    expect(renderers.streaming.showStreamChatBlock).toHaveBeenCalledOnce();
  });

  it("lets looping stream video advance immediately", () => {
    const { runner, renderers } = makeRunner([
      stage("streaming"),
      streamVideo("loop_one", { mode: "loop" }),
      streamChatBlock([streamChat("viewer1", "loop is running")])
    ]);

    runner.start();

    expect(renderers.streaming.renderStreamVideoInstant).toHaveBeenCalledOnce();
    expect(runner.state.visuals.streaming.window).toMatchObject({
      state: "live",
      media: {
        kind: "video",
        asset: "loop_one",
        mode: "loop",
        loop: true
      }
    });
    expect(renderers.streaming.showStreamChatBlock).toHaveBeenCalledOnce();
  });
});
