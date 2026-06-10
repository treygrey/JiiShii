import { applyVarMutations, createInitialState, migrateState, rollInt } from "../state.js";
import {
  applyAmbienceState,
  applyAudioSceneState,
  applyMusicState,
  clearAmbienceState,
  clearMusicState,
  cloneAudioState
} from "../audio-state.js";
import { authorCompare, isOn } from "../showif.js";
import { validateRendererContracts } from "../renderer-contract.js";
import {
  applyHideCharacter,
  applyShowCharacter,
  applySpriteExpression,
  setSpriteFocus
} from "../sprite-state.js";
import {
  appendTextMessages
} from "../visual-state.js";
import {
  BUILTIN_SURFACE_MODULES,
  cloneSurfaceState,
  createSurfaceRegistry,
  createSurfaceState,
  normalizeSurfaceState
} from "../surface-modules.js";
import {
  createPhoneState,
  normalizePhoneState
} from "../phone-state.js";
import { normalizeStorageKeys } from "./storage-keys.js";
import {
  getHistory,
  recordHistory,
  recordLineHistory,
  recordMessageHistory
} from "./history-log.js";
import { getDebugSnapshot } from "./debug-snapshot.js";
import {
  projectSurface,
  syncAudioState,
  syncBackgroundState,
  syncIrlSprites,
  syncVisualState
} from "./projection.js";
import {
  createPhoneAppMetadata,
  followSocialPoster,
  getPhoneReturnSurface,
  goBackPhoneApp,
  hasUnreadPhoneNotifications,
  isPhoneNavigationLayer,
  isPhoneOpen,
  isPhoneSurface,
  isStoryTextingActive,
  isTextingInboxMode,
  likeSocialPost,
  returnToStorySurface,
  setPhoneWallpaper,
  setPhoneNavigationSurface,
  togglePhone,
  openPhoneApp as openPhoneAppController
} from "./phone-controller.js";
import {
  canRollBack,
  captureBeatSnapshot,
  reconstructTo,
  replaySceneContextToCurrentCommand,
  rewound,
  rollBack,
  rollForward
} from "./rollback-controller.js";
import {
  checkpointScene,
  createSceneEntrySave as createSceneEntrySaveController,
  createSnapshotSave as createSnapshotSaveController,
  load as loadController,
  save as saveController,
  updatePhoneCheckpointState
} from "./save-controller.js";
import {
  aliasSpeaker,
  buildCharacters,
  createLabelIndex,
  defaultVoice,
  loadScene as loadSceneController,
  resolveSceneCharacters
} from "./scene-loader.js";
import {
  finishScene,
  showChoice,
  showDialogue,
  showLineBlock,
  showNarration,
  showStreamChatBlock,
  showStreamImage,
  showStreamNarration,
  showTextBlock,
  showTransition
} from "./beat-presenter.js";
import {
  advanceCommand as advanceCommandController,
  executeCommand as executeCommandController,
  executeSurfaceCommand as executeSurfaceCommandController,
  runUntilBlocked as runUntilBlockedController
} from "./command-executor.js";
import {
  popSurface,
  pushSurface,
  setSurface,
  teardownMountedSurfaces
} from "./surface-stack.js";
import {
  ensureTextingThreadForSpeaker as ensureTextingThreadForSpeakerController,
  getTextingTransitionNotificationContact as getTextingTransitionNotificationContactController,
  markTextThreadRead as markTextThreadReadController,
  markTextThreadUnread as markTextThreadUnreadController,
  openTextThread as openTextThreadController,
  previewIncomingText as previewIncomingTextController,
  resolveSceneContact as resolveSceneContactController,
  resolveThreadContact as resolveThreadContactController
} from "./texting-controller.js";

/**
 * Creates a silent audio service for tests/headless use.
 *
 * @returns {object} No-op audio service.
 */
function createNoopAudioService() {
  return {
    sync: () => {},
    playMusic: () => {},
    stopMusic: () => {},
    playAmbience: () => {},
    stopAmbience: () => {},
    playSound: () => {},
    stopSound: () => {},
    playVoice: () => {},
    stopTransient: () => {},
    stopAll: () => {}
  };
}

/**
 * Evaluates one author-facing predicate against runner state.
 *
 * @param {Function|object} predicate - Function or structured predicate.
 * @param {object} vars - Variable store.
 * @param {object} state - Full runner state.
 * @returns {boolean} Predicate result.
 */
function evaluatePredicate(predicate, vars, state) {
  if (typeof predicate === "function") {
    return Boolean(predicate(vars, state));
  }
  if (!predicate || typeof predicate !== "object") {
    return false;
  }
  if (Array.isArray(predicate.any)) {
    return predicate.any.some((entry) => evaluatePredicate(entry, vars, state));
  }
  if (Array.isArray(predicate.all)) {
    return predicate.all.every((entry) => evaluatePredicate(entry, vars, state));
  }
  if ("not" in predicate) {
    return !evaluatePredicate(predicate.not, vars, state);
  }
  if (predicate.var !== undefined) {
    const left = vars[predicate.var];
    if ("is" in predicate) {
      return authorCompare(left, "==", predicate.is);
    }
    if ("isNot" in predicate) {
      return authorCompare(left, "!=", predicate.isNot);
    }
    if ("atLeast" in predicate) {
      return authorCompare(left, ">=", predicate.atLeast);
    }
    if ("atMost" in predicate) {
      return authorCompare(left, "<=", predicate.atMost);
    }
    if ("moreThan" in predicate) {
      return authorCompare(left, ">", predicate.moreThan);
    }
    if ("lessThan" in predicate) {
      return authorCompare(left, "<", predicate.lessThan);
    }
    if ("hasText" in predicate) {
      const hasText = typeof left === "string" && left.trim().length > 0;
      return authorCompare(hasText, "==", predicate.hasText);
    }
    if (predicate.op) {
      return authorCompare(left, predicate.op, predicate.value);
    }
    return isOn(left);
  }
  if (predicate.flag !== undefined) {
    return isOn(vars[predicate.flag]);
  }
  return false;
}

/**
 * Converts legacy top-level condition fields into the shared predicate shape.
 *
 * @param {object} command - Condition command.
 * @returns {Function|object|null} Predicate or null.
 */
function conditionPredicate(command) {
  if (command.if !== undefined) {
    return command.if;
  }
  if (command.var !== undefined) {
    const predicate = { var: command.var };
    for (const key of ["is", "isNot", "atLeast", "atMost", "moreThan", "lessThan", "hasText", "op", "value"]) {
      if (key in command) {
        predicate[key] = command[key];
      }
    }
    return predicate;
  }
  if (command.flag !== undefined) {
    return { flag: command.flag };
  }
  return null;
}

/**
 * Runs authored scene commands and delegates visual work to active renderers.
 */
export class SceneRunner {
  /**
   * @param {object} options - Runner dependencies.
   * @param {object} options.initialScene - First scene to run.
   * @param {object} options.initialState - Serializable game state.
   * @param {Record<string, object>} options.renderers - Surface renderers by id.
   * @param {import('./layer-compositor.js').LayerCompositor} options.compositor - Layer compositor.
   */
  constructor({
    initialScene,
    initialState,
    renderers,
    compositor,
    registry = {},
    surfaceModules = BUILTIN_SURFACE_MODULES,
    onIdle,
    onTransition,
    onBackground,
    audio,
    audioScenes = {},
    globalCharacters = {},
    phoneConfig = {},
    storageKeys
  }) {
    this.surfaceRegistry = createSurfaceRegistry(surfaceModules);
    validateRendererContracts(renderers, this.surfaceRegistry);
    this.phoneApps = this.createPhoneAppMetadata();

    this.scene = initialScene;
    this.state = migrateState({
      ...initialState,
      currentSceneId: initialScene.id
    });
    Object.assign(this.state, normalizeSurfaceState(this.state, this.surfaceRegistry));
    this.renderers = renderers;
    this.compositor = compositor;
    this.registry = registry;
    this.onIdle = onIdle ?? (() => {});
    this.onTransition = onTransition ?? (() => {});
    // The background is a shared base layer (the IRL room) that every surface
    // composites on top of, so it is owned by the compositor, not a renderer.
    this.onBackground = onBackground ?? (() => {});
    this.audio = audio ?? createNoopAudioService();
    this.audioScenes = audioScenes;
    this.globalCharacters = globalCharacters;
    this.phoneConfig = phoneConfig;
    this.storageKeys = normalizeStorageKeys(storageKeys);
    this.labels = this.createLabelIndex(initialScene.script);
    this.characters = this.buildCharacters(initialScene);
    this.state.visuals.phone = normalizePhoneState({
      ...createPhoneState(phoneConfig),
      ...(this.state.visuals.phone ?? {})
    }, phoneConfig);

    // The surface stack replaces the old single-activeRenderer model. The
    // bottom entry is the "base" surface; pushSurface adds on top without
    // tearing down the base. The topmost entry is the activeRenderer.
    /** @type {string[]} */
    this.surfaceStack = [];
    this.activeRenderer = null;
    // Tracks the top surface that was opened through phone navigation instead
    // of by story script. Texting uses this to decide whether to show the
    // Messages inbox or the active story conversation.
    this.phoneNavigationSurface = this.state.phoneNavigationSurface ?? null;

    this.isWaitingForPlayer = false;
    this.isFinished = false;
    // Blocks the click-anywhere advance while a choice or transition button is
    // showing, so a background tap cannot skip a decision the player must make.
    this.blockingInput = false;
    // Scene-entry checkpoint: { currentSceneId, vars, rng, timestamp }.
    this.checkpoint = null;

    // Rollback ring: one snapshot per readable beat (not choices), letting the
    // player scroll back through the scene and forward again. A snapshot is the
    // minimal deterministic seed — { sceneId, commandIndex, vars, rng,
    // choicesMade } — and visuals are rebuilt from it via replay. Reset per scene.
    /** @type {Array<object>} */
    this.rollbackBuffer = [];
    this.rollbackPos = -1;
    this.isRewound = false;
    this.reconstructing = false;

    // Last character to speak (for the debug snapshot); null during narration.
    this.lastSpeaker = null;
    // The script pointer may advance as soon as a readable beat is fully
    // presented. Keep the visible beat index separate so rollback/snapshot
    // saves restore the line on screen instead of the next unread command.
    this.activeBeatCommandIndex = null;
    this.pauseTimer = null;
    this.pauseReady = false;
  }

  /**
   * A plain-data view of the live runner state for the debug overlay and any
   * future tooling. Keeps inspectors decoupled from runner/renderer internals.
   *
   * @returns {object} Snapshot.
   */
  getDebugSnapshot() {
    return getDebugSnapshot(this);
  }

  /** Clears the rollback history (called when a scene begins fresh). */
  resetRollback() {
    this.clearPauseTimer();
    this.rollbackBuffer = [];
    this.rollbackPos = -1;
    this.isRewound = false;
    this.activeBeatCommandIndex = null;
    this.pauseReady = false;
  }

  /**
   * Marks the command currently being shown as a reader-visible beat.
   *
   * @returns {void}
   */
  beginReadableBeat() {
    this.activeBeatCommandIndex = this.state.currentCommandIndex;
  }

  /**
   * Clears scene-local visual state that must not leak across loads/scenes.
   *
   * @returns {void}
   */
  resetVisualState() {
    const surfaceState = createSurfaceState(this.surfaceRegistry);
    this.state.sprites = surfaceState.sprites;
    this.state.visuals = surfaceState.visuals;
    this.lastSpeaker = null;
  }

  /**
   * Clears any pending timed pause.
   *
   * @returns {void}
   */
  clearPauseTimer() {
    if (this.pauseTimer != null) {
      globalThis.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /**
   * Records one reader-visible line in the runner-owned backlog.
   *
   * @param {object} entry - History entry.
   * @returns {void}
   */
  recordHistory(entry) {
    recordHistory(this, entry);
  }

  /**
   * Records a batch of reader-visible text/chat messages.
   *
   * @param {Array<object>} messages - Message objects from a text/chat block.
   * @param {string} surface - Surface id that produced the messages.
   * @returns {void}
   */
  recordMessageHistory(messages = [], surface) {
    recordMessageHistory(this, messages, surface);
  }

  /**
   * Records reader-visible IRL dialogue lines from a grouped line block.
   *
   * @param {Array<object>} lines - Line block entries.
   * @param {string} surface - Surface id that produced the lines.
   * @returns {void}
   */
  recordLineHistory(lines = [], surface = "irl") {
    recordLineHistory(this, lines, surface);
  }

  /**
   * Returns a detached copy of the reader history.
   *
   * @returns {object[]} History entries.
   */
  getHistory() {
    return getHistory(this);
  }

  /**
   * Returns the configured manual slot key.
   *
   * @param {number} slot - Slot number.
   * @returns {string} Storage key.
   */
  saveSlotKey(slot) {
    return `${this.storageKeys.slotPrefix}${slot}`;
  }

  /**
   * Returns the legacy manual slot key, if one is configured.
   *
   * @param {number} slot - Slot number.
   * @returns {string|null} Legacy storage key.
   */
  legacySaveSlotKey(slot) {
    return this.storageKeys.legacySlotPrefix ? `${this.storageKeys.legacySlotPrefix}${slot}` : null;
  }

  /**
   * Projects runner-owned background state into the page backdrop.
   *
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Replace visual state without animation.
   * @returns {void}
   */
  syncBackgroundState({ instant = false } = {}) {
    syncBackgroundState(this, { instant });
  }

  /**
   * Projects all runner-owned visual state into currently mounted renderers.
   *
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Replace visual state without animation.
   * @returns {void}
   */
  syncVisualState({ instant = false } = {}) {
    syncVisualState(this, { instant });
  }

  /**
   * Projects runner-owned durable audio state into the audio service.
   *
   * @param {object} [options] - Sync options.
   * @param {boolean} [options.instant] - Skip fades when reconstructing.
   * @returns {void}
   */
  syncAudioState({ instant = false } = {}) {
    syncAudioState(this, { instant });
  }

  /**
   * Applies a reusable durable music/ambience preset.
   *
   * @param {object} command - Audio-scene command.
   * @returns {void}
   */
  applyAudioScene(command) {
    const preset = this.audioScenes?.[command.id];
    if (!preset) {
      this.advanceCommand();
      return;
    }
    const previousMusic = cloneAudioState(this.state.audio).music;
    const previousAmbience = cloneAudioState(this.state.audio).ambience;
    applyAudioSceneState(this.state.audio, preset, command);

    if (this.reconstructing) {
      this.syncAudioState({ instant: true });
      this.advanceCommand();
      return;
    }

    if (previousMusic && !this.state.audio.music) {
      this.audio.stopMusic?.({ fadeOut: command.transition ?? previousMusic.fadeOut });
    } else if (this.state.audio.music) {
      this.audio.playMusic?.(this.state.audio.music, { instant: false });
    }

    if (previousAmbience && !this.state.audio.ambience) {
      this.audio.stopAmbience?.({ fadeOut: command.transition ?? previousAmbience.fadeOut });
    } else if (this.state.audio.ambience) {
      this.audio.playAmbience?.(this.state.audio.ambience, { instant: false });
    }

    this.advanceCommand();
  }

  /**
   * Starts or changes background music.
   *
   * @param {object} command - Music command.
   * @returns {void}
   */
  playMusic(command) {
    applyMusicState(this.state.audio, command);
    this.audio.playMusic?.(this.state.audio.music, {
      instant: this.reconstructing,
      fadeIn: command.fadeIn
    });
    this.advanceCommand();
  }

  /**
   * Stops background music.
   *
   * @param {object} command - Stop-music command.
   * @returns {void}
   */
  stopMusic(command) {
    clearMusicState(this.state.audio);
    this.audio.stopMusic?.({
      instant: this.reconstructing,
      fadeOut: command.fadeOut
    });
    this.advanceCommand();
  }

  /**
   * Starts or changes looping ambience.
   *
   * @param {object} command - Ambience command.
   * @returns {void}
   */
  playAmbience(command) {
    applyAmbienceState(this.state.audio, command);
    this.audio.playAmbience?.(this.state.audio.ambience, {
      instant: this.reconstructing,
      fadeIn: command.fadeIn
    });
    this.advanceCommand();
  }

  /**
   * Stops looping ambience.
   *
   * @param {object} command - Stop-ambience command.
   * @returns {void}
   */
  stopAmbience(command) {
    clearAmbienceState(this.state.audio);
    this.audio.stopAmbience?.({
      instant: this.reconstructing,
      fadeOut: command.fadeOut
    });
    this.advanceCommand();
  }

  /**
   * Plays a one-shot sound effect.
   *
   * @param {object} command - Sound command.
   * @returns {void}
   */
  playSound(command) {
    if (!this.reconstructing) {
      this.audio.playSound?.(command);
    }
    this.advanceCommand();
  }

  /**
   * Stops a named transient sound effect.
   *
   * @param {object} command - Stop-sound command.
   * @returns {void}
   */
  stopSound(command) {
    if (!this.reconstructing) {
      this.audio.stopSound?.(command.id, { fadeOut: command.fadeOut });
    }
    this.advanceCommand();
  }

  /**
   * Plays a one-shot voice line.
   *
   * @param {object} command - Voice command.
   * @returns {void}
   */
  playVoice(command) {
    if (!this.reconstructing) {
      this.audio.playVoice?.(command);
    }
    this.advanceCommand();
  }

  /**
   * Plays a transient full-screen visual effect.
   *
   * @param {object} command - Effect command.
   * @returns {void}
   */
  playScreenEffect(command) {
    if (!this.reconstructing) {
      this.compositor.playScreenEffect?.(command);
    }
    this.advanceCommand();
  }

  /**
   * Starts a timed, skippable pause beat.
   *
   * @param {object} command - Pause command.
   * @returns {void}
   */
  showPause(command) {
    this.clearPauseTimer();
    const duration = Math.max(0, Number(command.duration ?? 1000));
    this.isWaitingForPlayer = true;
    this.pauseReady = false;
    this.pauseTimer = globalThis.setTimeout(() => {
      this.completePause();
    }, duration);
  }

  /**
   * Completes the active pause and continues the scene.
   *
   * @returns {void}
   */
  completePause() {
    if (!this.isWaitingForPlayer) {
      this.clearPauseTimer();
      this.pauseReady = false;
      return;
    }
    if (this.isPhoneOpen()) {
      this.clearPauseTimer();
      this.pauseReady = true;
      return;
    }
    this.clearPauseTimer();
    this.pauseReady = false;
    this.isWaitingForPlayer = false;
    this.state.currentCommandIndex += 1;
    this.save();
    this.runUntilBlocked();
  }

  /**
   * Unmounts every currently stacked surface and unregisters it from the
   * compositor. Used by rollback, load, and scene transitions.
   *
   * @returns {void}
   */
  teardownMountedSurfaces() {
    teardownMountedSurfaces(this);
  }

  /**
   * Syncs runner-owned IRL sprite state into the IRL renderer, if mounted.
   *
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace sprites without transitions.
   * @returns {void}
   */
  syncIrlSprites({ instant = false } = {}) {
    syncIrlSprites(this, { instant });
  }

  /**
   * Projects one surface-owned state slice into its renderer.
   *
   * @param {string} surfaceId - Surface id.
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Replace visual state without animation.
   * @returns {void}
   */
  projectSurface(surfaceId, { instant = false } = {}) {
    projectSurface(this, surfaceId, { instant });
  }

  /**
   * Builds launcher metadata from registered surface modules. Custom authors can
   * expose a phone app by registering a normal surface with `phoneApp` metadata.
   *
   * @returns {Record<string, object>} Phone app metadata keyed by surface id.
   */
  createPhoneAppMetadata() {
    return createPhoneAppMetadata(this);
  }

  /**
   * Returns true when a surface id belongs to the shared phone/app system.
   *
   * Texting can be either a story surface or a phone app. The caller decides
   * which role it is playing from the stack shape.
   *
   * @param {string|null} surfaceId - Surface id to inspect.
   * @returns {boolean} True for phone home or registered phone apps.
   */
  isPhoneSurface(surfaceId) {
    return isPhoneSurface(this, surfaceId);
  }

  /**
   * Records which top surface is currently acting as phone navigation overlay.
   * Keeping this in state makes save/load and rollback preserve app-vs-story
   * meaning instead of guessing from a surface id.
   *
   * @param {string|null} surfaceId - Phone navigation surface, or null.
   * @returns {void}
   */
  setPhoneNavigationSurface(surfaceId) {
    setPhoneNavigationSurface(this, surfaceId);
  }

  /**
   * Returns true when a stack entry is acting as navigable phone chrome/app UI,
   * not an authored story surface. Texting is special because authors can use
   * it as the story itself while it also exists as the Messages app.
   *
   * @param {string|null} surfaceId - Surface id to inspect.
   * @param {number} [index] - Surface stack index.
   * @returns {boolean} True when the entry should pause story advancement.
   */
  isPhoneNavigationLayer(surfaceId, index = this.surfaceStack.length - 1) {
    return isPhoneNavigationLayer(this, surfaceId, index);
  }

  /**
   * Returns true when focus is currently inside phone chrome instead of the
   * authored story surface.
   *
   * @returns {boolean} True when a phone app is open.
   */
  isPhoneOpen() {
    return isPhoneOpen(this);
  }

  /**
   * Returns true when Messages was opened from phone navigation and should
   * start at the conversation list.
   *
   * @returns {boolean} True when the Messages inbox should be shown.
   */
  isTextingInboxMode() {
    return isTextingInboxMode(this);
  }

  /**
   * Returns true when the currently visible texting surface is the authored
   * story thread, not the Messages app opened through phone navigation.
   *
   * @returns {boolean} True when story progress should remain available.
   */
  isStoryTextingActive() {
    return isStoryTextingActive(this);
  }

  /**
   * Finds the story surface underneath an open phone app.
   *
   * @returns {string|null} Surface id to return to.
   */
  getPhoneReturnSurface() {
    return getPhoneReturnSurface(this);
  }

  /**
   * Toggles the floating phone launcher: open Home from a story surface, or
   * return to the paused story surface from any phone app.
   *
   * @returns {void}
   */
  togglePhone() {
    togglePhone(this);
  }

  /**
   * Closes phone app layers and restores the story surface underneath.
   *
   * @returns {void}
   */
  returnToStorySurface() {
    returnToStorySurface(this);
  }

  /**
   * Mutates runner-owned sprite state for a show command and projects it.
   *
   * @param {object} command - Show-character command.
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace sprites without transitions.
   * @returns {void}
   */
  applyShowSprite(command, { instant = false } = {}) {
    applyShowCharacter(this.state.sprites, command, this.characters);
    this.syncIrlSprites({ instant });
  }

  /**
   * Mutates runner-owned sprite state for a hide command and projects it.
   *
   * @param {string} id - Character id.
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Remove without transition.
   * @returns {void}
   */
  applyHideSprite(id, { instant = false } = {}) {
    applyHideCharacter(this.state.sprites, id);
    this.syncIrlSprites({ instant });
  }

  /**
   * Updates runner-owned IRL focus and projects it.
   *
   * @param {string|null} id - Focused speaker id.
   * @returns {void}
   */
  applySpriteFocus(id) {
    setSpriteFocus(this.state.sprites, id);
    this.syncIrlSprites();
  }

  /**
   * Reports whether the runner is parked on an explicit player decision
   * (choice or transition button) rather than a plain advance.
   *
   * @returns {boolean} True when input is gated on a decision.
   */
  isBlockingInput() {
    return this.blockingInput;
  }

  /**
   * Starts scene playback.
   *
   * @returns {void}
   */
  start() {
    this.clearPauseTimer();
    this.resetRollback();
    this.checkpointScene();
    this.runUntilBlocked();
  }

  /** @returns {boolean} True if there's an earlier beat to roll back to. */
  canRollBack() {
    return canRollBack(this);
  }

  /** @returns {boolean} True if currently parked on a rolled-back (past) beat. */
  rewound() {
    return rewound(this);
  }

  /**
   * Steps one readable beat backward, rebuilding that moment from its snapshot.
   *
   * @returns {void}
   */
  rollBack() {
    rollBack(this);
  }

  /**
   * Steps one beat forward toward the live edge. At the edge, hands control back
   * to normal play.
   *
   * @returns {void}
   */
  rollForward() {
    rollForward(this);
  }

  /**
   * Captures the minimal deterministic seed for the current beat onto the
   * rollback ring. Called once whenever the runner parks on a readable beat.
   *
   * @returns {void}
   */
  captureBeatSnapshot() {
    captureBeatSnapshot(this);
  }

  /**
   * Rebuilds the exact moment a snapshot describes: restores its logical state,
   * tears the visuals down, replays the scene from the top to that beat
   * (instant, side-effect-free), then renders the beat itself.
   *
   * @param {object} snap - A rollback snapshot.
   * @returns {void}
   */
  reconstructTo(snap, { preservePersistentPhoneState = true } = {}) {
    reconstructTo(this, snap, { preservePersistentPhoneState });
  }

  /**
   * Handles a player advance click.
   *
   * @returns {void}
   */
  advance() {
    if (this.isPhoneOpen()) {
      return;
    }

    // While parked on a rolled-back beat, a tap walks forward toward the live
    // edge rather than advancing the story.
    if (this.isRewound) {
      this.rollForward();
      return;
    }

    // Responsiveness first: a tap never just "finishes an animation" and stops.
    // Snap any in-flight reveal/reading-beat to done instantly, then advance on
    // the SAME tap. Reveals here are timed pauses, not typewriters, and texting
    // bubbles persist in the scrollback — so cutting them short loses nothing.
    // (finishNow() runs onComplete synchronously, stepping the command index and
    // surfacing any immediately-following choice; the checks below then either
    // advance to the next line or correctly stop on a now-blocking choice.)
    this.compositor.completeNarrationReveal();
    this.activeRenderer?.completeActiveReveal?.();

    // A choice or transition button is waiting; a background tap must not skip it.
    if (this.blockingInput) {
      return;
    }

    if (this.pauseTimer != null) {
      this.completePause();
      return;
    }

    if (this.isWaitingForPlayer && !this.isFinished) {
      this.activeBeatCommandIndex = null;
      this.isWaitingForPlayer = false;
      this.runUntilBlocked();
      return;
    }

    // A healthy runner should not be idle on an executable command, but load,
    // rollback, and surface jumps all touch the same state machine. If a future
    // edge case parks here, the next player tap should recover instead of
    // leaving the current surface looking like it silently ended.
    if (!this.isFinished && this.scene.script[this.state.currentCommandIndex]) {
      this.runUntilBlocked();
    }
  }

  /**
   * Handles a selected choice option.
   *
   * @param {object} choiceCommand - Choice command being answered.
   * @param {object} option - Selected option.
   * @returns {void}
   */
  selectChoice(choiceCommand, option) {
    this.blockingInput = false;
    this.state.choicesMade.push({
      choiceId: choiceCommand.id,
      selectedOptionId: option.id ?? option.goto ?? option.jump ?? option.text,
      sceneId: this.scene.id
    });

    applyVarMutations(this.state.vars, option.set);

    if (option.flags) {
      Object.assign(this.state.vars, option.flags);
    }

    this.activeRenderer?.clearChoices();
    this.save();
    this.isWaitingForPlayer = false;

    const target = option.goto ?? option.jump;
    if (target && this.registry[target] && !this.labels.has(target)) {
      // Target is another scene — loadScene runs its own loop; don't double-run.
      this.loadScene(target);
      return;
    }
    if (target) {
      this.jumpTo(target);
    }
    this.runUntilBlocked();
  }

  /**
   * Resolves a goto target to either a mark in this scene or a scene id.
   *
   * @param {string} target - Mark name or scene id.
   * @returns {void}
   */
  resolveGoto(target) {
    if (this.labels.has(target)) {
      this.jumpTo(target);
      return;
    }
    if (this.registry[target]) {
      this.loadScene(target);
      return;
    }
    throw new Error(`goto("${target}") — no mark in this scene and no scene with that id.`);
  }

  /**
   * Snapshots the state the player entered the current scene with (scene id,
   * vars, and PRNG seed) and writes it to the autosave. This is the ONLY save
   * granularity: a save point is the start of the scene you're in, with the
   * variables you walked in with. Re-entering plays the scene fresh — no
   * mid-scene replay, no per-command "instant" reconstruction.
   *
   * @returns {void}
   */
  checkpointScene() {
    checkpointScene(this);
  }

  /**
   * Mirrors durable phone-app state into the scene-entry checkpoint.
   *
   * Phone apps can be changed by player UI after the last readable scene beat:
   * set wallpaper, follow someone, like a post, or browse newly saved gallery
   * images. The checkpoint remains the source for scene-entry autosaves, so it
   * needs an affirmative copy of these durable display slices.
   *
   * @returns {void}
   */
  updatePhoneCheckpointState() {
    updatePhoneCheckpointState(this);
  }

  /**
   * Creates a player-facing scene-entry save envelope.
   *
   * @param {object} [options] - Envelope options.
   * @param {string|null} [options.label] - Optional slot label.
   * @returns {object} Save envelope.
   */
  createSceneEntrySave({ label = null } = {}) {
    return createSceneEntrySaveController(this, { label });
  }

  /**
   * Creates a full runner snapshot envelope for future save-anywhere work.
   *
   * @param {object} [options] - Envelope options.
   * @param {string|null} [options.label] - Optional slot label.
   * @returns {object} Save envelope.
   */
  createSnapshotSave({ label = null } = {}) {
    return createSnapshotSaveController(this, { label });
  }

  /**
   * Writes a player-facing save-anywhere snapshot to a manual slot (or the
   * default manual save). Mid-tap internal calls (no args) are intentionally
   * no-ops; autosave remains scene-entry and is written by checkpointScene().
   *
   * @param {object} [options] - Save options.
   * @param {boolean} [options.announce] - Show a "Saved" confirmation.
   * @param {number|null} [options.slot] - Manual slot number.
   * @returns {{ ok: boolean, kind?: string, message: string }|void} Save result.
   */
  save({ announce = false, slot = null } = {}) {
    return saveController(this, { announce, slot });
  }

  /**
   * Loads a checkpoint and plays its scene from the start with the saved
   * entry-vars. No replay: load is "set the variables, run the scene."
   *
   * @param {object} [options] - Load options.
   * @param {boolean} [options.auto] - Read the autosave.
   * @param {number|null} [options.slot] - Manual slot number.
   * @returns {{ ok: boolean, message: string }} Load result.
   */
  load({ auto = false, slot = null } = {}) {
    return loadController(this, { auto, slot });
  }

  /**
   * Creates a label lookup table for jump targets.
   *
   * @param {Array<object>} script - Scene command list.
   * @returns {Map<string, number>} Label id to command index map.
   */
  createLabelIndex(script) {
    return createLabelIndex(script);
  }

  /**
   * Resolves global and scene-local character declarations into one map.
   *
   * @param {Array<object>} declarations - Scene character declarations.
   * @returns {Map<string, object>} Character defaults by id.
   */
  resolveSceneCharacters(declarations = []) {
    return resolveSceneCharacters(this, declarations);
  }

  /**
   * Builds the scene's character map from both the legacy `characters`
   * declarations and the new `cast` array (auto-resolved from globals).
   *
   * @param {object} scene - Scene definition.
   * @returns {Map<string, object>} Character defaults by id.
   */
  buildCharacters(scene) {
    return buildCharacters(this, scene);
  }

  /**
   * The id bare `say("text")` speaks as — the first name in the scene's cast,
   * or the player if none is declared.
   *
   * @returns {string} Default speaker id.
   */
  defaultVoice() {
    return defaultVoice(this);
  }

  /**
   * Normalizes player-role aliases (`me`, `you`) to the canonical player id.
   *
   * @param {string} id - Raw speaker id.
   * @returns {string} Canonical id.
   */
  aliasSpeaker(id) {
    return aliasSpeaker(id);
  }

  /**
   * Runs commands until a visual command needs player input.
   *
   * @returns {void}
   */
  runUntilBlocked() {
    runUntilBlockedController(this);
  }

  /**
   * Executes one scene command.
   *
   * @param {object} command - Scene command.
   * @returns {void}
   */
  executeCommand(command) {
    executeCommandController(this, command);
  }

  /**
   * Executes a command owned by the currently active surface module.
   *
   * @param {object} command - Scene command.
   * @param {object} [options] - Dispatch options.
   * @param {boolean} [options.instant] - Use the instant/replay handler.
   * @returns {boolean} True when a surface handler ran.
   */
  executeSurfaceCommand(command, { instant = false } = {}) {
    return executeSurfaceCommandController(this, command, { instant });
  }

  /**
   * Advances the command pointer by one.
   *
   * @returns {void}
   */
  advanceCommand() {
    advanceCommandController(this);
  }

  /**
   * Hard-switches the active surface renderer, tearing down any previous stack.
   * This replaces the entire surface stack with a single entry.
   *
   * @param {string} surfaceId - Surface id.
   * @returns {void}
   */
  setSurface(surfaceId) {
    setSurface(this, surfaceId);
  }

  /**
   * Pushes a surface on top of the current one without tearing it down. The
   * blur scrim shifts in front of the existing surface and the new surface
   * mounts above it. Used for "text during stream" — the stream stays alive.
   *
   * @param {string} surfaceId - Surface id to push.
   * @returns {void}
   */
  pushSurface(surfaceId) {
    pushSurface(this, surfaceId);
  }

  /**
   * Pops the topmost surface off the stack, returning focus to the surface
   * below. The popped surface is unmounted and unregistered. The blur scrim
   * shifts back behind the now-active surface.
   *
   * @returns {void}
   */
  popSurface() {
    popSurface(this);
  }

  /**
   * Shows a narration overlay via the compositor's shared narration box and
   * waits for the player to tap to continue.
   *
   * @param {object} command - Narration command.
   * @returns {void}
   */
  showNarration(command) {
    showNarration(this, command);
  }

  /**
   * The `say` dispatcher. Resolves the speaker (explicit id, the cast default,
   * or `me`) and renders per the active stage: chat bubbles on texting, a
   * dialogue-box line on irl/streaming. A list of lines is a grouped burst on
   * texting and a single joined beat on the dialogue box.
   *
   * @param {object} command - Say command.
   * @returns {void}
   */
  showSay(command) {
    const speakerId = this.aliasSpeaker(command.speaker ?? this.defaultVoice());
    const lines = command.lines ?? [command.message ?? ""];
    this.lastSpeaker = speakerId;

    if (this.state.currentSurface === "texting") {
      this.ensureTextingThreadForSpeaker(speakerId);
      const texts = lines.map((line, index) => ({
        kind: "text",
        id: speakerId,
        message: line,
        timestamp: index === 0 ? command.timestamp : undefined,
        waitTime: command.waitTime
      }));
      this.showTextBlock({ texts });
      return;
    }

    // On a sprite stage (irl): spotlight the speaker and apply any expression.
    if (this.state.currentSurface === "irl" && command.expression) {
      applySpriteExpression(this.state.sprites, speakerId, command.expression);
    }
    if (this.state.currentSurface === "irl") {
      setSpriteFocus(this.state.sprites, speakerId);
      this.syncIrlSprites();
    }

    this.showDialogue({ id: speakerId, message: lines.join(" ") });
  }

  /**
   * Renders a `say` instantly during load replay, per the stage at that point.
   *
   * @param {object} command - Say command.
   * @returns {void}
   */
  renderSayInstant(command) {
    const speakerId = this.aliasSpeaker(command.speaker ?? this.defaultVoice());
    const lines = command.lines ?? [command.message ?? ""];
    if (this.state.currentSurface === "texting") {
      this.ensureTextingThreadForSpeaker(speakerId);
      const texts = lines.map((line) => ({ kind: "text", id: speakerId, message: line }));
      const renderedTexts = appendTextMessages(this.state.visuals, texts);
      this.activeRenderer.renderTextBlockInstant({ texts: renderedTexts }, { characters: this.characters });
      return;
    }
    if (this.state.currentSurface === "irl") {
      if (command.expression) {
        applySpriteExpression(this.state.sprites, speakerId, command.expression);
      }
      setSpriteFocus(this.state.sprites, speakerId);
      this.syncIrlSprites({ instant: true });
    }
    const speaker = this.characters.get(speakerId) ?? { id: speakerId, name: speakerId };
    this.compositor.renderDialogueInstant?.(lines.join(" "), speaker);
  }

  /**
   * Shows a character dialogue line in the shared bottom box and waits for a tap.
   *
   * @param {object} command - Dialogue command.
   * @returns {void}
   */
  showDialogue(command) {
    showDialogue(this, command);
  }

  /**
   * Resolves a thread command into a texting contact header.
   *
   * @param {object} command - Thread command.
   * @returns {object} Contact header { id, name, color, avatar, subtitle }.
   */
  resolveThreadContact(command) {
    return resolveThreadContactController(this, command);
  }

  /**
   * Starts a texting thread from an incoming/outgoing speaker when authored
   * script uses say() without an explicit thread() command first.
   *
   * @param {string} speakerId - Resolved speaker id for the current say beat.
   * @returns {void}
   */
  ensureTextingThreadForSpeaker(speakerId) {
    ensureTextingThreadForSpeakerController(this, speakerId);
  }

  /**
   * Converts scene-level phone contact metadata into the same shape used by
   * thread() commands, so cross-scene text conversations can share phone UI.
   *
   * @param {object} scene - Scene definition with optional contact metadata.
   * @returns {object|null} Normalized contact or null when the scene has none.
   */
  resolveSceneContact(scene) {
    return resolveSceneContactController(scene);
  }

  /**
   * Checks whether a transition should feel like opening a new phone message
   * instead of pressing a VN continue button. This only applies while already
   * inside a populated texting thread and only when the target scene also has a
   * phone contact.
   *
   * @param {object} command - Transition command.
   * @returns {object|null} Target contact when a notification should be shown.
   */
  getTextingTransitionNotificationContact(command) {
    return getTextingTransitionNotificationContactController(this, command);
  }

  /**
   * Marks an inbox thread unread and mirrors that state onto the Messages app
   * badge.
   *
   * @param {object} contact - Thread contact.
   * @param {object} [options] - Pending inbox metadata.
   * @returns {void}
   */
  markTextThreadUnread(contact, options = {}) {
    markTextThreadUnreadController(this, contact, options);
  }

  /**
   * Marks an inbox thread read and clears the Messages badge once no unread
   * threads remain.
   *
   * @param {string} threadId - Thread id.
   * @returns {void}
   */
  markTextThreadRead(threadId) {
    markTextThreadReadController(this, threadId);
  }

  /**
   * Opens a conversation from the Messages inbox. Pending story texts resume
   * their authored scene/command; ordinary read threads stay in the phone app
   * as scrollback.
   *
   * @param {string} threadId - Thread id to open.
   * @returns {boolean} True when opening consumed a pending story action.
   */
  openTextThread(threadId) {
    return openTextThreadController(this, threadId);
  }

  /**
   * Finds a short inbox preview from authored text commands.
   *
   * @param {object} scene - Scene to scan.
   * @param {number} [startIndex] - Script index to begin scanning.
   * @param {string} [contactId] - Expected incoming contact id.
   * @returns {string} Preview text.
   */
  previewIncomingText(scene, startIndex = 0, contactId = null) {
    return previewIncomingTextController(scene, startIndex, contactId);
  }

  /**
   * Opens the phone to the requested app surface.
   *
   * @param {string} app - App id, or "home".
   * @returns {void}
   */
  openPhoneApp(app = "home") {
    openPhoneAppController(this, app);
  }

  /**
   * Moves phone navigation toward Home, then back to the story surface.
   *
   * @returns {void}
   */
  goBackPhoneApp() {
    goBackPhoneApp(this);
  }

  /**
   * Reports whether the floating phone button should show an unread badge.
   *
   * @returns {boolean} True when unread notifications exist.
   */
  hasUnreadPhoneNotifications() {
    return hasUnreadPhoneNotifications(this);
  }

  /**
   * Sets wallpaper from player UI without advancing the script.
   *
   * @param {string|null} image - Image asset id.
   * @returns {void}
   */
  setPhoneWallpaper(image) {
    setPhoneWallpaper(this, image);
  }

  /**
   * Records a player social like without advancing the script.
   *
   * @param {string} id - Post id.
   * @param {string|null} [flag] - Optional story flag.
   * @returns {void}
   */
  likeSocialPost(id, flag = null) {
    likeSocialPost(this, id, flag);
  }

  /**
   * Records a player social follow without advancing the script.
   *
   * @param {string} poster - Poster id.
   * @param {string|null} [flag] - Optional story flag.
   * @returns {void}
   */
  followSocialPoster(poster, flag = null) {
    followSocialPoster(this, poster, flag);
  }

  /**
   * After a beat finishes, automatically surfaces an immediately-following
   * choice or transition so the player never has to tap to reveal their own
   * reply options. Steps over labels/setFlags (applying flags) to find it.
   *
   * @returns {boolean} True when a decision was surfaced automatically.
   */
  maybeAutoAdvanceToDecision() {
    let index = this.state.currentCommandIndex;
    while (index < this.scene.script.length) {
      const command = this.scene.script[index];
      if (
        command.type === "label" ||
        command.type === "setFlag" ||
        command.type === "setVar" ||
        command.type === "roll"
      ) {
        index += 1;
        continue;
      }
      break;
    }

    const decision = this.scene.script[index];
    if (!decision || (decision.type !== "choice" && decision.type !== "transition")) {
      return false;
    }

    let changedVars = false;
    for (let cursor = this.state.currentCommandIndex; cursor < index; cursor += 1) {
      const command = this.scene.script[cursor];
      if (command.type === "setFlag") {
        this.state.vars[command.key] = command.value;
        changedVars = true;
      } else if (command.type === "setVar") {
        applyVarMutations(this.state.vars, { [command.key]: command.value });
        changedVars = true;
      } else if (command.type === "roll") {
        this.state.vars[command.key] = rollInt(this.state, command.min, command.max);
        changedVars = true;
      }
    }
    if (changedVars) {
      this.syncIrlSprites({ instant: this.reconstructing });
    }

    this.state.currentCommandIndex = index;
    this.isWaitingForPlayer = false;
    this.executeCommand(decision);
    return true;
  }

  /**
   * Evaluates a condition command against the variable store. Supports a
   * predicate function, structured predicates, legacy truthy flag checks, and
   * legacy {var, op, value} comparisons.
   *
   * @param {object} command - Condition command.
   * @returns {boolean} Branch result.
   */
  evaluateCondition(command) {
    return evaluatePredicate(conditionPredicate(command), this.state.vars, this.state);
  }

  /**
   * Shows a transition/continue button and waits for the player to click it.
   *
   * @param {object} command - Transition command.
   * @returns {void}
   */
  showTransition(command) {
    showTransition(this, command);
  }

  /**
   * Loads another scene, carrying flags/stats/choice history forward.
   *
   * @param {string} sceneId - Target scene id.
   * @returns {void}
   */
  loadScene(sceneId) {
    loadSceneController(this, sceneId);
  }

  /**
   * Displays a text block and waits for player advancement.
   *
   * @param {object} command - Text block command.
   * @returns {void}
   */
  showTextBlock(command) {
    showTextBlock(this, command);
  }

  /**
   * Displays an IRL dialogue block and waits for player advancement.
   *
   * @param {object} command - IRL line block command.
   * @returns {void}
   */
  showLineBlock(command) {
    showLineBlock(this, command);
  }

  /**
   * Displays a stream image as a player-advance unit.
   *
   * @param {object} command - Stream image command.
   * @returns {void}
   */
  showStreamImage(command) {
    showStreamImage(this, command);
  }

  /**
   * Displays a block of stream chat messages.
   *
   * @param {object} command - Stream chat block command.
   * @returns {void}
   */
  showStreamChatBlock(command) {
    showStreamChatBlock(this, command);
  }

  /**
   * Displays streaming narration in the lower VN-style narration box.
   *
   * @param {object} command - Stream narration command.
   * @returns {void}
   */
  showStreamNarration(command) {
    showStreamNarration(this, command);
  }

  /**
   * Displays a surface-specific choice UI.
   *
   * @param {object} command - Choice command.
   * @returns {void}
   */
  showChoice(command) {
    showChoice(this, command);
  }

  /**
   * Moves the command pointer to a label target.
   *
   * @param {string} target - Label id.
   * @returns {void}
   */
  jumpTo(target) {
    if (!this.labels.has(target)) {
      throw new Error(`Unknown jump target "${target}".`);
    }

    this.state.currentCommandIndex = this.labels.get(target) + 1;
  }

  /**
   * Marks the current scene as complete.
   *
   * @returns {void}
   */
  finishScene() {
    finishScene(this);
  }

  /**
   * Replays deterministic scene context for rollback reconstruction. Snapshots
   * carry vars/rng/choices; this rebuilds control flow and renderer projections.
   *
   * @returns {void}
   */
  replaySceneContextToCurrentCommand() {
    replaySceneContextToCurrentCommand(this);
  }
}
