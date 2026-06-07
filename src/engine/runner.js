import { applyVarMutations, createInitialState, migrateState, rollInt } from "./state.js";
import {
  applyAmbienceState,
  applyAudioSceneState,
  applyMusicState,
  clearAmbienceState,
  clearMusicState,
  cloneAudioState
} from "./audio-state.js";
import { appendHistoryEntry, cloneHistoryState } from "./history-state.js";
import { evalShowIf } from "./showif.js";
import { validateRendererContracts } from "./renderer-contract.js";
import {
  createSceneEntrySave,
  createSnapshotSave,
  parseSaveEnvelope,
  SAVE_KIND_SNAPSHOT
} from "./save-format.js";
import {
  applyHideCharacter,
  applyShowCharacter,
  applySpriteExpression,
  setSpriteFocus
} from "./sprite-state.js";
import {
  appendStreamChat,
  appendTextMessages,
  setBackgroundState,
  setStreamLayoutState,
  setStreamTitleState,
  setStreamWindowState,
  setTextingThread
} from "./visual-state.js";
import {
  BUILTIN_SURFACE_MODULES,
  cloneSurfaceState,
  createSurfaceRegistry,
  createSurfaceState,
  normalizeSurfaceState,
  projectSurfaceState,
  readSurfaceStateSlice
} from "./surface-modules.js";

const SAVE_KEY = "jiishii-save";
const AUTOSAVE_KEY = "jiishii-autosave";
const SLOT_PREFIX = "jiishii-save-slot-";

/**
 * Normalizes localStorage key settings for saves.
 *
 * @param {object} [storageKeys] - Configured storage keys.
 * @returns {object} Normalized storage key config.
 */
function normalizeStorageKeys(storageKeys = {}) {
  return {
    save: storageKeys.save ?? SAVE_KEY,
    autosave: storageKeys.autosave ?? AUTOSAVE_KEY,
    slotPrefix: storageKeys.slotPrefix ?? SLOT_PREFIX,
    legacySave: storageKeys.legacySave ?? null,
    legacyAutosave: storageKeys.legacyAutosave ?? null,
    legacySlotPrefix: storageKeys.legacySlotPrefix ?? null
  };
}

/**
 * Reads the first populated localStorage value from a key list.
 *
 * @param {Array<string|null>} keys - Candidate keys.
 * @returns {string|null} Stored value or null.
 */
function readFirstStorage(keys) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }
  return null;
}

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
    playVoice: () => {},
    stopTransient: () => {},
    stopAll: () => {}
  };
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
    storageKeys
  }) {
    this.surfaceRegistry = createSurfaceRegistry(surfaceModules);
    validateRendererContracts(renderers, this.surfaceRegistry);

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
    this.storageKeys = normalizeStorageKeys(storageKeys);
    this.labels = this.createLabelIndex(initialScene.script);
    this.characters = this.buildCharacters(initialScene);

    // The surface stack replaces the old single-activeRenderer model. The
    // bottom entry is the "base" surface; pushSurface adds on top without
    // tearing down the base. The topmost entry is the activeRenderer.
    /** @type {string[]} */
    this.surfaceStack = [];
    this.activeRenderer = null;

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
  }

  /**
   * A plain-data view of the live runner state for the debug overlay and any
   * future tooling. Keeps inspectors decoupled from runner/renderer internals.
   *
   * @returns {object} Snapshot.
   */
  getDebugSnapshot() {
    const script = this.scene?.script ?? [];
    const index = this.state.currentCommandIndex ?? 0;
    const command = script[index];
    const sprites = (this.state.sprites?.irl?.visible ?? []).map((sprite) => ({
      id: sprite.id,
      outfit: sprite.outfit ?? null,
      expression: sprite.expression ?? null,
      side: sprite.side ?? "auto",
      flip: Boolean(sprite.flip),
      at: sprite.at ?? null,
      x: sprite.x ?? null,
      y: sprite.y ?? null,
      scale: sprite.scale ?? 1,
      alpha: sprite.alpha ?? 1,
      z: sprite.z ?? null,
      layer: sprite.layer ?? "characters"
    }));
    const images = (this.state.sprites?.irl?.images ?? []).map((image) => ({
      id: image.id,
      asset: image.asset,
      kind: image.kind ?? "image",
      at: image.at ?? null,
      layer: image.layer ?? null,
      transition: image.transition ?? null
    }));
    return {
      sceneId: this.state.currentSceneId,
      commandIndex: index,
      commandCount: script.length,
      nextCommand: command ? command.type + (command.id ? ` "${command.id}"` : "") : null,
      activeSurface: this.state.currentSurface ?? null,
      surfaceStack: [...(this.surfaceStack ?? [])],
      speaker: this.lastSpeaker,
      audio: cloneAudioState(this.state.audio),
      historySize: this.state.history?.length ?? 0,
      sprites,
      images,
      vars: { ...(this.state.vars ?? {}) },
      rollback: {
        pos: this.rollbackPos,
        size: this.rollbackBuffer.length,
        rewound: this.isRewound
      }
    };
  }

  /** Clears the rollback history (called when a scene begins fresh). */
  resetRollback() {
    this.rollbackBuffer = [];
    this.rollbackPos = -1;
    this.isRewound = false;
    this.activeBeatCommandIndex = null;
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
    if (this.reconstructing) {
      return;
    }
    this.state.history ??= [];
    appendHistoryEntry(this.state.history, {
      ...entry,
      surface: entry.surface ?? this.state.currentSurface ?? null,
      sceneId: this.state.currentSceneId,
      commandIndex: this.state.currentCommandIndex
    });
  }

  /**
   * Records a batch of reader-visible text/chat messages.
   *
   * @param {Array<object>} messages - Message objects from a text/chat block.
   * @param {string} surface - Surface id that produced the messages.
   * @returns {void}
   */
  recordMessageHistory(messages = [], surface) {
    for (const message of messages) {
      const text = message.message ?? message.text ?? "";
      this.recordHistory({
        kind: message.kind ?? "text",
        speaker: message.id ?? null,
        name: message.name ?? message.id ?? null,
        side: message.side ?? null,
        message: text,
        surface
      });
    }
  }

  /**
   * Records reader-visible IRL dialogue lines from a grouped line block.
   *
   * @param {Array<object>} lines - Line block entries.
   * @param {string} surface - Surface id that produced the lines.
   * @returns {void}
   */
  recordLineHistory(lines = [], surface = "irl") {
    for (const line of lines) {
      const speakerId = line.id ? this.aliasSpeaker(line.id) : null;
      const speaker = this.characters.get(speakerId) ?? { id: speakerId, name: speakerId };
      this.recordHistory({
        kind: "dialogue",
        speaker: speakerId,
        name: speaker.name ?? speakerId,
        side: speaker.side ?? "left",
        message: line.message ?? "",
        surface
      });
    }
  }

  /**
   * Returns a detached copy of the reader history.
   *
   * @returns {object[]} History entries.
   */
  getHistory() {
    return cloneHistoryState(this.state.history);
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
   * Projects all runner-owned visual state into currently mounted renderers.
   *
   * @param {object} [options] - Projection options.
   * @param {boolean} [options.instant] - Replace visual state without animation.
   * @returns {void}
   */
  syncVisualState({ instant = false } = {}) {
    if (this.state.visuals?.background) {
      this.onBackground(this.state.visuals.background.id, {
        transition: instant ? "cut" : this.state.visuals.background.transition,
        duration: this.state.visuals.background.duration
      });
    } else {
      this.onBackground(null);
    }
    projectSurfaceState({
      state: this.state,
      renderers: this.renderers,
      registry: this.surfaceRegistry,
      context: {
        characters: this.characters,
        instant
      }
    });
  }

  /**
   * Projects runner-owned durable audio state into the audio service.
   *
   * @param {object} [options] - Sync options.
   * @param {boolean} [options.instant] - Skip fades when reconstructing.
   * @returns {void}
   */
  syncAudioState({ instant = false } = {}) {
    this.audio.sync?.(this.state.audio, { instant });
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
      return;
    }
    this.clearPauseTimer();
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
    this.clearPauseTimer();
    this.activeRenderer?.clearChoices?.();
    for (const stackedId of this.surfaceStack) {
      this.renderers[stackedId]?.reset?.();
      this.renderers[stackedId]?.unmount?.();
      this.compositor.unregisterLayer(stackedId);
    }
    this.surfaceStack = [];
    this.activeRenderer = null;
  }

  /**
   * Syncs runner-owned IRL sprite state into the IRL renderer, if mounted.
   *
   * @param {object} [options] - Render options.
   * @param {boolean} [options.instant] - Replace sprites without transitions.
   * @returns {void}
   */
  syncIrlSprites({ instant = false } = {}) {
    this.projectSurface("irl", { instant });
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
    const surface = this.surfaceRegistry.get(surfaceId);
    surface?.state?.project?.({
      renderer: this.renderers?.[surfaceId],
      state: readSurfaceStateSlice(this.state, surfaceId),
      rootState: this.state,
      context: {
        characters: this.characters,
        instant
      }
    });
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

  /**
   * Handles a player advance click.
   *
   * @returns {void}
   */
  /** @returns {boolean} True if there's an earlier beat to roll back to. */
  canRollBack() {
    return this.rollbackPos > 0;
  }

  /** @returns {boolean} True if currently parked on a rolled-back (past) beat. */
  rewound() {
    return this.isRewound;
  }

  /**
   * Steps one readable beat backward, rebuilding that moment from its snapshot.
   *
   * @returns {void}
   */
  rollBack() {
    if (this.rollbackPos <= 0) {
      return;
    }
    this.rollbackPos -= 1;
    this.reconstructTo(this.rollbackBuffer[this.rollbackPos]);
    this.isRewound = this.rollbackPos < this.rollbackBuffer.length - 1;
  }

  /**
   * Steps one beat forward toward the live edge. At the edge, hands control back
   * to normal play.
   *
   * @returns {void}
   */
  rollForward() {
    if (this.rollbackPos >= this.rollbackBuffer.length - 1) {
      this.isRewound = false;
      return;
    }
    this.rollbackPos += 1;
    this.reconstructTo(this.rollbackBuffer[this.rollbackPos]);
    this.isRewound = this.rollbackPos < this.rollbackBuffer.length - 1;
  }

  /**
   * Captures the minimal deterministic seed for the current beat onto the
   * rollback ring. Called once whenever the runner parks on a readable beat.
   *
   * @returns {void}
   */
  captureBeatSnapshot() {
    const snapshot = {
      sceneId: this.state.currentSceneId,
      commandIndex: this.activeBeatCommandIndex ?? this.state.currentCommandIndex,
      vars: structuredClone(this.state.vars),
      rng: this.state.rng,
      choicesMade: structuredClone(this.state.choicesMade ?? []),
      surfaceStack: [...(this.state.surfaceStack ?? [])],
      currentSurface: this.state.currentSurface ?? null,
      lastSpeaker: this.lastSpeaker,
      audio: cloneAudioState(this.state.audio),
      history: cloneHistoryState(this.state.history),
      ...cloneSurfaceState(this.state, this.surfaceRegistry)
    };
    const previous = this.rollbackBuffer[this.rollbackBuffer.length - 1];
    if (
      previous &&
      previous.sceneId === snapshot.sceneId &&
      previous.commandIndex === snapshot.commandIndex
    ) {
      this.rollbackBuffer[this.rollbackBuffer.length - 1] = snapshot;
    } else {
      this.rollbackBuffer.push(snapshot);
    }
    const MAX = 250;
    if (this.rollbackBuffer.length > MAX) {
      this.rollbackBuffer.shift();
    }
    this.rollbackPos = this.rollbackBuffer.length - 1;
    this.isRewound = false;
  }

  /**
   * Rebuilds the exact moment a snapshot describes: restores its logical state,
   * tears the visuals down, replays the scene from the top to that beat
   * (instant, side-effect-free), then renders the beat itself.
   *
   * @param {object} snap - A rollback snapshot.
   * @returns {void}
   */
  reconstructTo(snap) {
    this.reconstructing = true;
    this.activeBeatCommandIndex = null;

    // Tear down whatever is currently mounted (mirror of a scene transition).
    this.teardownMountedSurfaces();
    this.audio.stopTransient?.();
    this.compositor.hideNarration();
    this.onBackground(null);

    // Restore the logical state the beat was seen with.
    const scene = this.registry[snap.sceneId];
    if (scene) {
      this.scene = scene;
      this.labels = this.createLabelIndex(scene.script);
      this.characters = this.buildCharacters(scene);
    }
    this.state.currentSceneId = snap.sceneId;
    this.state.surfaceStack = [];
    this.state.vars = structuredClone(snap.vars);
    this.state.rng = snap.rng;
    this.state.choicesMade = structuredClone(snap.choicesMade ?? []);
    this.state.audio = cloneAudioState(snap.audio);
    this.state.history = cloneHistoryState(snap.history);
    this.state.currentCommandIndex = snap.commandIndex;
    this.state.currentSurface = snap.currentSurface ?? "texting";
    const finalSurfaceState = cloneSurfaceState(snap, this.surfaceRegistry);
    const emptySurfaceState = createSurfaceState(this.surfaceRegistry);
    this.state.sprites = emptySurfaceState.sprites;
    this.state.visuals = emptySurfaceState.visuals;
    this.lastSpeaker = snap.lastSpeaker ?? null;
    this.isWaitingForPlayer = false;
    this.isFinished = false;
    this.blockingInput = false;

    // Rebuild command-derived context up to the beat, then render the beat
    // itself. The final snapshot projection below is authoritative for visuals.
    this.replaySceneContextToCurrentCommand();
    this.runUntilBlocked();
    this.state.sprites = finalSurfaceState.sprites;
    this.state.visuals = finalSurfaceState.visuals;
    this.lastSpeaker = snap.lastSpeaker ?? this.lastSpeaker;
    this.syncVisualState({ instant: true });
    this.syncAudioState({ instant: true });

    this.reconstructing = false;
  }

  advance() {
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
    const timestamp = Date.now();
    this.checkpoint = {
      currentSceneId: this.scene.id,
      currentCommandIndex: 0,
      currentSurface: "texting",
      surfaceStack: [],
      vars: structuredClone(this.state.vars),
      rng: this.state.rng,
      choicesMade: structuredClone(this.state.choicesMade ?? []),
      audio: cloneAudioState(this.state.audio),
      history: [],
      ...cloneSurfaceState(createInitialState(), this.surfaceRegistry),
      timestamp
    };
    localStorage.setItem(
      this.storageKeys.autosave,
      JSON.stringify(createSceneEntrySave({
        state: this.state,
        checkpoint: this.checkpoint,
        surfaceRegistry: this.surfaceRegistry,
        label: "Auto-Save",
        sceneTitle: this.scene?.title ?? this.scene?.id ?? this.state.currentSceneId,
        timestamp
      }))
    );
  }

  /**
   * Creates a player-facing scene-entry save envelope.
   *
   * @param {object} [options] - Envelope options.
   * @param {string|null} [options.label] - Optional slot label.
   * @returns {object} Save envelope.
   */
  createSceneEntrySave({ label = null } = {}) {
    return createSceneEntrySave({
      state: this.state,
      checkpoint: this.checkpoint,
      surfaceRegistry: this.surfaceRegistry,
      label,
      sceneTitle: this.scene?.title ?? this.scene?.id ?? this.state.currentSceneId
    });
  }

  /**
   * Creates a full runner snapshot envelope for future save-anywhere work.
   *
   * @param {object} [options] - Envelope options.
   * @param {string|null} [options.label] - Optional slot label.
   * @returns {object} Save envelope.
   */
  createSnapshotSave({ label = null } = {}) {
    return createSnapshotSave({
      state: this.state,
      commandIndex: this.activeBeatCommandIndex ?? this.state.currentCommandIndex,
      lastSpeaker: this.lastSpeaker,
      surfaceRegistry: this.surfaceRegistry,
      label,
      sceneTitle: this.scene?.title ?? this.scene?.id ?? this.state.currentSceneId
    });
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
    if (!announce && slot === null) {
      return;
    }
    const key = slot ? this.saveSlotKey(slot) : this.storageKeys.save;
    localStorage.setItem(key, JSON.stringify(this.createSnapshotSave({
      label: slot ? `Slot ${slot}` : "Manual Save"
    })));
    if (announce) {
      this.activeRenderer?.setSaveStatus?.("Saved");
    }
    return { ok: true, kind: SAVE_KIND_SNAPSHOT, message: "Saved" };
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
    const rawSave = slot
      ? readFirstStorage([this.saveSlotKey(slot), this.legacySaveSlotKey(slot)])
      : auto
        ? readFirstStorage([this.storageKeys.autosave, this.storageKeys.save, this.storageKeys.legacyAutosave, this.storageKeys.legacySave])
        : readFirstStorage([this.storageKeys.save, this.storageKeys.legacySave]);
    if (!rawSave) {
      this.activeRenderer?.setSaveStatus?.("No save found");
      return { ok: false, reason: "missing", message: "No save found" };
    }

    let envelope;
    try {
      envelope = parseSaveEnvelope(rawSave, this.surfaceRegistry);
    } catch {
      this.activeRenderer?.setSaveStatus?.("Save could not be loaded");
      return { ok: false, reason: "corrupt", message: "Save could not be loaded" };
    }
    const saved = envelope.state;
    const savedScene = saved.currentSceneId ? this.registry[saved.currentSceneId] : null;
    if (!savedScene) {
      this.activeRenderer?.setSaveStatus?.("Saved scene is not available");
      return { ok: false, reason: "missing-scene", message: "Saved scene is not available" };
    }

    if (envelope.kind === SAVE_KIND_SNAPSHOT) {
      this.reconstructTo({
        ...saved,
        sceneId: saved.currentSceneId,
        commandIndex: saved.currentCommandIndex
      });
      this.rollbackBuffer = [];
      this.rollbackPos = -1;
      this.isRewound = false;
      if (this.isWaitingForPlayer && !this.blockingInput && !this.isFinished) {
        this.captureBeatSnapshot();
      }
      this.activeRenderer?.setSaveStatus?.("Loaded");
      return { ok: true, kind: envelope.kind, message: "Loaded" };
    }

    // Tear down any mounted surfaces for a clean start.
    const statusRenderer = this.activeRenderer;
    this.teardownMountedSurfaces();
    this.compositor.hideNarration();
    this.onBackground(null);
    this.audio.stopAll?.();

    this.scene = savedScene;
    this.labels = this.createLabelIndex(this.scene.script);
    this.characters = this.buildCharacters(this.scene);

    // Fresh state with the restored entry-vars and PRNG seed; play from line 1.
    this.state = migrateState({
      ...createInitialState(),
      currentSceneId: this.scene.id,
      vars: saved.vars ?? {},
      rng: saved.rng,
      choicesMade: structuredClone(saved.choicesMade ?? []),
      history: []
    });
    Object.assign(this.state, normalizeSurfaceState(this.state, this.surfaceRegistry));
    this.isFinished = false;
    this.isWaitingForPlayer = false;
    this.blockingInput = false;
    statusRenderer?.setSaveStatus?.("Loaded");
    this.resetRollback();
    this.checkpointScene();
    this.runUntilBlocked();
    return { ok: true, kind: envelope.kind, message: "Loaded" };
  }

  /**
   * Creates a label lookup table for jump targets.
   *
   * @param {Array<object>} script - Scene command list.
   * @returns {Map<string, number>} Label id to command index map.
   */
  createLabelIndex(script) {
    const labels = new Map();

    script.forEach((command, index) => {
      if (command.type === "label") {
        labels.set(command.id, index);
      }
    });

    return labels;
  }

  /**
   * Resolves global and scene-local character declarations into one map.
   *
   * @param {Array<object>} declarations - Scene character declarations.
   * @returns {Map<string, object>} Character defaults by id.
   */
  resolveSceneCharacters(declarations = []) {
    const characters = new Map();

    for (const declaration of declarations) {
      if (declaration.useGlobal) {
        const globalCharacter = this.globalCharacters[declaration.id] ?? {};
        characters.set(declaration.id, {
          id: declaration.id,
          ...globalCharacter,
          ...declaration.overrides
        });
        continue;
      }

      characters.set(declaration.id, declaration);
    }

    return characters;
  }

  /**
   * Builds the scene's character map from both the legacy `characters`
   * declarations and the new `cast` array (auto-resolved from globals).
   *
   * @param {object} scene - Scene definition.
   * @returns {Map<string, object>} Character defaults by id.
   */
  buildCharacters(scene) {
    const characters = this.resolveSceneCharacters(scene.characters ?? []);
    for (const rawId of scene.cast ?? []) {
      const id = this.aliasSpeaker(rawId);
      if (!characters.has(id)) {
        const globalCharacter = this.globalCharacters[id];
        if (globalCharacter) {
          characters.set(id, { id, ...globalCharacter });
        }
      }
    }
    return characters;
  }

  /**
   * The id bare `say("text")` speaks as — the first name in the scene's cast,
   * or the player if none is declared.
   *
   * @returns {string} Default speaker id.
   */
  defaultVoice() {
    return this.aliasSpeaker(this.scene.cast?.[0] ?? "me");
  }

  /**
   * Normalizes player-role aliases (`me`, `you`) to the cplayerical player id.
   *
   * @param {string} id - Raw speaker id.
   * @returns {string} Cplayerical id.
   */
  aliasSpeaker(id) {
    return id === "me" || id === "you" ? "player" : id;
  }

  /**
   * Runs commands until a visual command needs player input.
   *
   * @returns {void}
   */
  runUntilBlocked() {
    while (!this.isWaitingForPlayer && !this.isFinished) {
      const command = this.scene.script[this.state.currentCommandIndex];

      if (!command) {
        this.finishScene();
        return;
      }

      this.executeCommand(command);
    }

    // Record a rollback point for each readable beat (not choices, and not while
    // we're in the middle of reconstructing one).
    if (
      this.isWaitingForPlayer &&
      !this.blockingInput &&
      !this.isFinished &&
      !this.reconstructing
    ) {
      this.captureBeatSnapshot();
    }
  }

  /**
   * Executes one scene command.
   *
   * @param {object} command - Scene command.
   * @returns {void}
   */
  executeCommand(command) {
    if (command.type === "surface") {
      this.setSurface(command.id);
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "openLayer") {
      this.pushSurface(command.id);
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "closeLayer") {
      // Runtime obeys the same rule the validator checks: close("x") only closes
      // x when it's the top layer. Closing out of order is a real bug, so fail
      // loudly rather than silently popping the wrong surface.
      const top = this.surfaceStack[this.surfaceStack.length - 1];
      if (command.id && top !== command.id) {
        throw new Error(
          `close("${command.id}") but the top layer is "${top ?? "none"}". Layers must close in reverse order of open().`
        );
      }
      this.popSurface();
      this.state.currentCommandIndex += 1;
      return;
    }

    // Push a surface on top of the current one without tearing it down.
    // The blur shifts forward and the new surface mounts on top.
    if (command.type === "pushSurface") {
      this.pushSurface(command.id);
      this.state.currentCommandIndex += 1;
      return;
    }

    // Pop the topmost pushed surface and return focus to the one below.
    if (command.type === "popSurface") {
      this.popSurface();
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "label") {
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "background") {
      setBackgroundState(this.state.visuals, {
        id: command.id,
        transition: command.transition,
        duration: command.duration
      });
      this.onBackground(command.id, {
        transition: command.transition,
        duration: command.duration
      });
      this.state.currentCommandIndex += 1;
      return;
    }

    if (this.executeSurfaceCommand(command)) {
      return;
    }

    if (command.type === "music") {
      this.playMusic(command);
      return;
    }

    if (command.type === "audioScene") {
      this.applyAudioScene(command);
      return;
    }

    if (command.type === "stopMusic") {
      this.stopMusic(command);
      return;
    }

    if (command.type === "ambience") {
      this.playAmbience(command);
      return;
    }

    if (command.type === "stopAmbience") {
      this.stopAmbience(command);
      return;
    }

    if (command.type === "sound") {
      this.playSound(command);
      return;
    }

    if (command.type === "voice") {
      this.playVoice(command);
      return;
    }

    if (command.type === "flash" || command.type === "shake") {
      this.playScreenEffect(command);
      return;
    }

    if (command.type === "choice") {
      this.showChoice(command);
      return;
    }

    if (command.type === "jump") {
      this.jumpTo(command.target);
      return;
    }

    if (command.type === "goto") {
      this.resolveGoto(command.target);
      return;
    }

    if (command.type === "narration") {
      this.showNarration(command);
      return;
    }

    if (command.type === "dialogue") {
      this.showDialogue(command);
      return;
    }

    if (command.type === "say") {
      this.showSay(command);
      return;
    }

    // Instant stream/thread mutations — apply and advance without a tap.
    if (command.type === "transition") {
      this.showTransition(command);
      return;
    }

    if (command.type === "setFlag") {
      this.state.vars[command.key] = command.value;
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "setVar") {
      applyVarMutations(this.state.vars, { [command.key]: command.value });
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "roll") {
      this.state.vars[command.key] = rollInt(this.state, command.min, command.max);
      this.state.currentCommandIndex += 1;
      return;
    }

    if (command.type === "condition") {
      this.jumpTo(this.evaluateCondition(command) ? command.then : command.else);
      return;
    }

    if (command.type === "pause") {
      this.showPause(command);
      return;
    }

    if (command.type === "endScene") {
      this.finishScene();
      return;
    }

    // Safety: an unrecognized command must never stall the loop. Skip it.
    this.state.currentCommandIndex += 1;
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
    const surface = this.surfaceRegistry.get(this.state.currentSurface);
    const handler = surface?.handlers?.[command.type];
    const run = instant ? handler?.instant : handler?.run;
    if (!run) {
      return false;
    }

    run({
      runner: this,
      command,
      renderer: this.renderers?.[surface.id],
      compositor: this.compositor,
      state: this.state,
      surfaceState: readSurfaceStateSlice(this.state, surface.id),
      characters: this.characters,
      instant
    });
    return true;
  }

  /**
   * Advances the command pointer by one.
   *
   * @returns {void}
   */
  advanceCommand() {
    this.state.currentCommandIndex += 1;
  }

  /**
   * Hard-switches the active surface renderer, tearing down any previous stack.
   * This replaces the entire surface stack with a single entry.
   *
   * @param {string} surfaceId - Surface id.
   * @returns {void}
   */
  setSurface(surfaceId) {
    if (!this.surfaceRegistry.has(surfaceId)) {
      throw new Error(`Unknown surface "${surfaceId}". Register a surface module before staging it.`);
    }

    const next = this.renderers[surfaceId];

    if (!next) {
      throw new Error(`No renderer registered for surface "${surfaceId}".`);
    }

    // Tear down ALL stacked surfaces (not just the active one)
    for (const stackedId of this.surfaceStack) {
      const renderer = this.renderers[stackedId];
      if (renderer && renderer !== next) {
        renderer.unmount?.();
        this.compositor.unregisterLayer(stackedId);
      }
    }

    // Reset the stack to just this surface
    this.surfaceStack = [surfaceId];
    this.state.currentSurface = surfaceId;
    this.state.surfaceStack = [...this.surfaceStack];
    this.activeRenderer = next;

    next.mount({
      scene: this.scene,
      state: this.state,
      characters: this.characters
    });

    // Register the renderer's surface element with the compositor
    if (next.surface && !this.compositor.hasLayer(surfaceId)) {
      this.compositor.registerLayer(surfaceId, next.surface);
    }

    // Apply the correct compositor preset for the current stack
    const preset = this.compositor.resolvePreset(this.surfaceStack);
    this.compositor.applyPreset(preset);

    this.syncVisualState({ instant: this.reconstructing });
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
    if (!this.surfaceRegistry.has(surfaceId)) {
      throw new Error(`Unknown surface "${surfaceId}". Register a surface module before opening it.`);
    }

    const next = this.renderers[surfaceId];

    if (!next) {
      throw new Error(`No renderer registered for surface "${surfaceId}".`);
    }

    // Don't push the same surface twice
    if (this.surfaceStack.includes(surfaceId)) {
      return;
    }

    this.surfaceStack.push(surfaceId);
    this.state.currentSurface = surfaceId;
    this.state.surfaceStack = [...this.surfaceStack];
    this.activeRenderer = next;

    next.mount({
      scene: this.scene,
      state: this.state,
      characters: this.characters
    });

    // Register and reorder
    if (next.surface && !this.compositor.hasLayer(surfaceId)) {
      this.compositor.registerLayer(surfaceId, next.surface);
    }

    const preset = this.compositor.resolvePreset(this.surfaceStack);
    this.compositor.applyPreset(preset);

    this.syncVisualState({ instant: this.reconstructing });
  }

  /**
   * Pops the topmost surface off the stack, returning focus to the surface
   * below. The popped surface is unmounted and unregistered. The blur scrim
   * shifts back behind the now-active surface.
   *
   * @returns {void}
   */
  popSurface() {
    if (this.surfaceStack.length <= 1) {
      return; // Can't pop the base surface
    }

    const poppedId = this.surfaceStack.pop();
    const poppedRenderer = this.renderers[poppedId];

    if (poppedRenderer) {
      poppedRenderer.unmount?.();
      this.compositor.unregisterLayer(poppedId);
    }

    // Restore the new top of stack as active
    const newTopId = this.surfaceStack[this.surfaceStack.length - 1];
    this.state.currentSurface = newTopId;
    this.state.surfaceStack = [...this.surfaceStack];
    this.activeRenderer = this.renderers[newTopId];

    const preset = this.compositor.resolvePreset(this.surfaceStack);
    this.compositor.applyPreset(preset);
  }

  /**
   * Shows a narration overlay via the compositor's shared narration box and
   * waits for the player to tap to continue.
   *
   * @param {object} command - Narration command.
   * @returns {void}
   */
  showNarration(command) {
    this.beginReadableBeat();
    this.lastSpeaker = null;
    this.applySpriteFocus(null);
    this.recordHistory({
      kind: "narration",
      message: command.message
    });
    this.isWaitingForPlayer = true;
    this.compositor.showNarration(command, {
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
        if (!this.maybeAutoAdvanceToDecision()) {
          this.onIdle();
        }
      }
    });
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
      const texts = lines.map((line) => ({ kind: "text", id: speakerId, message: line }));
      this.activeRenderer.renderTextBlockInstant({ texts }, { characters: this.characters });
      appendTextMessages(this.state.visuals, texts);
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
    this.beginReadableBeat();
    this.isWaitingForPlayer = true;
    this.lastSpeaker = command.id ?? null;
    const speaker = this.characters.get(command.id) ?? { id: command.id, name: command.id };
    this.recordHistory({
      kind: "dialogue",
      speaker: command.id ?? null,
      name: speaker.name ?? command.id ?? null,
      side: speaker.side ?? "left",
      message: command.message
    });
    this.compositor.showDialogue(command, speaker, {
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
        if (!this.maybeAutoAdvanceToDecision()) {
          this.onIdle();
        }
      }
    });
  }

  /**
   * Resolves a thread command into a texting contact header.
   *
   * @param {object} command - Thread command.
   * @returns {object} Contact header { id, name, color, avatar, subtitle }.
   */
  resolveThreadContact(command) {
    const character = this.characters.get(command.id) ?? { id: command.id, name: command.id };
    return {
      id: command.id,
      name: character.name ?? command.id,
      color: character.color,
      avatar: command.avatar ?? (character.name ?? command.id).slice(0, 1),
      subtitle: command.subtitle ?? ""
    };
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

    for (let cursor = this.state.currentCommandIndex; cursor < index; cursor += 1) {
      const command = this.scene.script[cursor];
      if (command.type === "setFlag") {
        this.state.vars[command.key] = command.value;
      } else if (command.type === "setVar") {
        applyVarMutations(this.state.vars, { [command.key]: command.value });
      } else if (command.type === "roll") {
        this.state.vars[command.key] = rollInt(this.state, command.min, command.max);
      }
    }

    this.state.currentCommandIndex = index;
    this.isWaitingForPlayer = false;
    this.executeCommand(decision);
    return true;
  }

  /**
   * Evaluates a condition command against the variable store. Supports a
   * predicate function, a truthy flag check, or a {var, op, value} comparison.
   *
   * @param {object} command - Condition command.
   * @returns {boolean} Branch result.
   */
  evaluateCondition(command) {
    const vars = this.state.vars;
    if (typeof command.if === "function") {
      return Boolean(command.if(vars, this.state));
    }
    if (command.var !== undefined) {
      const left = vars[command.var];
      const right = command.value;
      switch (command.op) {
        case ">": return left > right;
        case ">=": return left >= right;
        case "<": return left < right;
        case "<=": return left <= right;
        case "!=": return left !== right;
        case "==":
        case "===":
        default: return left === right;
      }
    }
    if (command.flag !== undefined) {
      return Boolean(vars[command.flag]);
    }
    return false;
  }

  /**
   * Shows a transition/continue button and waits for the player to click it.
   *
   * @param {object} command - Transition command.
   * @returns {void}
   */
  showTransition(command) {
    this.compositor.hideNarration();
    this.isWaitingForPlayer = true;
    this.blockingInput = true;
    this.activeRenderer.showTransition(command, {
      onSelect: () => {
        this.blockingInput = false;
        if (command.target && this.registry[command.target]) {
          this.loadScene(command.target);
        } else {
          this.finishScene();
          this.onTransition(command.target);
        }
      }
    });
  }

  /**
   * Loads another scene, carrying flags/stats/choice history forward.
   *
   * @param {string} sceneId - Target scene id.
   * @returns {void}
   */
  loadScene(sceneId) {
    const next = this.registry[sceneId];

    if (!next) {
      this.finishScene();
      this.onTransition(sceneId);
      return;
    }

    // Tear down all stacked surfaces for a clean scene transition
    this.teardownMountedSurfaces();
    this.audio.stopTransient?.();

    this.scene = next;
    this.labels = this.createLabelIndex(next.script);
    this.characters = this.buildCharacters(next);
    this.state.currentSceneId = next.id;
    this.state.currentCommandIndex = 0;
    this.state.surfaceStack = [];
    this.state.currentSurface = "texting";
    this.resetVisualState();
    this.isWaitingForPlayer = false;
    this.isFinished = false;
    this.blockingInput = false;
    this.resetRollback();
    this.checkpointScene();
    this.runUntilBlocked();
  }

  /**
   * Displays a text block and waits for player advancement.
   *
   * @param {object} command - Text block command.
   * @returns {void}
   */
  showTextBlock(command) {
    this.beginReadableBeat();
    this.compositor.hideNarration();
    this.isWaitingForPlayer = true;
    appendTextMessages(this.state.visuals, command.texts ?? []);
    this.recordMessageHistory(command.texts ?? [], "texting");
    this.activeRenderer.showTextBlock(command, {
      characters: this.characters,
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
        if (!this.maybeAutoAdvanceToDecision()) {
          this.onIdle();
        }
      }
    });
  }

  /**
   * Displays an IRL dialogue block and waits for player advancement.
   *
   * @param {object} command - IRL line block command.
   * @returns {void}
   */
  showLineBlock(command) {
    this.beginReadableBeat();
    this.compositor.hideNarration();
    this.isWaitingForPlayer = true;
    this.activeRenderer.showLineBlock(command, {
      characters: this.characters,
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
      }
    });
  }

  /**
   * Displays a stream image as a player-advance unit.
   *
   * @param {object} command - Stream image command.
   * @returns {void}
   */
  showStreamImage(command) {
    this.beginReadableBeat();
    this.compositor.hideNarration();
    this.isWaitingForPlayer = true;
    setStreamWindowState(this.state.visuals, { state: "live", image: command.image });
    this.activeRenderer.showStreamImage(command, {
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
      }
    });
  }

  /**
   * Displays a block of stream chat messages.
   *
   * @param {object} command - Stream chat block command.
   * @returns {void}
   */
  showStreamChatBlock(command) {
    if (!command.concurrent) {
      this.beginReadableBeat();
      this.compositor.hideNarration();
      this.isWaitingForPlayer = true;
    }
    appendStreamChat(this.state.visuals, command.messages ?? []);

    this.activeRenderer.showStreamChatBlock(command, {
      onComplete: () => {
        if (!command.concurrent) {
          this.state.currentCommandIndex += 1;
          this.save();
        }
      }
    });

    if (command.concurrent) {
      this.state.currentCommandIndex += 1;
      this.save();
    }
  }

  /**
   * Displays streaming narration in the lower VN-style narration box.
   *
   * @param {object} command - Stream narration command.
   * @returns {void}
   */
  showStreamNarration(command) {
    this.beginReadableBeat();
    this.compositor.hideNarration();
    this.isWaitingForPlayer = true;
    this.compositor.showNarration(command, {
      onComplete: () => {
        this.state.currentCommandIndex += 1;
        this.save();
      }
    });
  }

  /**
   * Displays a surface-specific choice UI.
   *
   * @param {object} command - Choice command.
   * @returns {void}
   */
  showChoice(command) {
    this.compositor.hideNarration();

    // Hide options whose showIf condition isn't met right now.
    const visible = (command.options ?? []).filter(
      (option) => option.showIf == null || evalShowIf(option.showIf, this.state.vars)
    );

    // If everything is hidden, there's nothing to decide — just continue.
    if (visible.length === 0) {
      this.state.currentCommandIndex += 1;
      this.isWaitingForPlayer = false;
      this.runUntilBlocked();
      return;
    }

    const filtered = { ...command, options: visible };
    this.isWaitingForPlayer = true;
    this.blockingInput = true;
    this.activeRenderer.showChoice(filtered, {
      onSelect: (option) => this.selectChoice(filtered, option)
    });
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
    this.isFinished = true;
    this.activeRenderer?.showEnd();
    this.save();
  }

  /**
   * Replays deterministic scene context for rollback reconstruction. Snapshots
   * carry vars/rng/choices; this rebuilds control flow and renderer projections.
   *
   * @returns {void}
   */
  replaySceneContextToCurrentCommand() {
    const targetCommandIndex = this.state.currentCommandIndex;
    this.state.currentCommandIndex = 0;
    this.isWaitingForPlayer = false;
    this.isFinished = false;
    this.blockingInput = false;

    // Choices are replayed from saved history in order. Flags and stats are NOT
    // re-applied here: they were restored verbatim from the save, so we only
    // need to reproduce control flow (jumps/conditions/choice branches) to land
    // the command pointer exactly where it was saved.
    const pendingChoices = [...(this.state.choicesMade ?? [])].filter(
      (entry) => entry.sceneId === this.scene.id
    );

    let guard = 0;
    while (this.state.currentCommandIndex < targetCommandIndex && guard < 100000) {
      guard += 1;
      const command = this.scene.script[this.state.currentCommandIndex];

      if (!command) {
        break;
      }

      if (this.executeSurfaceCommand(command, { instant: true })) {
        continue;
      }

      switch (command.type) {
        case "surface":
          this.setSurface(command.id);
          this.state.currentCommandIndex += 1;
          break;
        case "openLayer":
          this.pushSurface(command.id);
          this.state.currentCommandIndex += 1;
          break;
        case "closeLayer":
          this.popSurface();
          this.state.currentCommandIndex += 1;
          break;
        case "pushSurface":
          this.pushSurface(command.id);
          this.state.currentCommandIndex += 1;
          break;
        case "popSurface":
          this.popSurface();
          this.state.currentCommandIndex += 1;
          break;
        case "label":
        case "setFlag":
        case "setVar":
        case "roll":
          // State (vars + rng) is restored verbatim from the save, so these
          // mutations are NOT re-applied during reconstruction — only their
          // control flow position matters.
          this.state.currentCommandIndex += 1;
          break;
        case "narration":
          setSpriteFocus(this.state.sprites, null);
          this.state.currentCommandIndex += 1;
          break;
        case "textBlock":
          this.activeRenderer.renderTextBlockInstant(command, { characters: this.characters });
          appendTextMessages(this.state.visuals, command.texts ?? []);
          this.state.currentCommandIndex += 1;
          break;
        case "say":
          this.renderSayInstant(command);
          this.state.currentCommandIndex += 1;
          break;
        case "background":
          setBackgroundState(this.state.visuals, {
            id: command.id,
            transition: command.transition,
            duration: command.duration
          });
          this.onBackground(command.id, { transition: "cut" });
          this.state.currentCommandIndex += 1;
          break;
        case "music":
          applyMusicState(this.state.audio, command);
          this.state.currentCommandIndex += 1;
          break;
        case "stopMusic":
          clearMusicState(this.state.audio);
          this.state.currentCommandIndex += 1;
          break;
        case "ambience":
          applyAmbienceState(this.state.audio, command);
          this.state.currentCommandIndex += 1;
          break;
        case "stopAmbience":
          clearAmbienceState(this.state.audio);
          this.state.currentCommandIndex += 1;
          break;
        case "audioScene":
          applyAudioSceneState(this.state.audio, this.audioScenes?.[command.id] ?? {}, command);
          this.state.currentCommandIndex += 1;
          break;
        case "sound":
        case "voice":
          this.state.currentCommandIndex += 1;
          break;
        case "showCharacter":
          this.applyShowSprite(command, { instant: true });
          this.state.currentCommandIndex += 1;
          break;
        case "hideCharacter":
          this.applyHideSprite(command.id, { instant: true });
          this.state.currentCommandIndex += 1;
          break;
        case "lineBlock":
          this.activeRenderer.renderLineBlockInstant(command, { characters: this.characters });
          this.state.currentCommandIndex += 1;
          break;
        case "streamLayout":
          setStreamLayoutState(this.state.visuals, command);
          this.activeRenderer.setStreamLayout(command);
          this.state.currentCommandIndex += 1;
          break;
        case "streamImage":
          setStreamWindowState(this.state.visuals, { state: "live", image: command.image });
          this.activeRenderer.renderStreamImageInstant(command);
          this.state.currentCommandIndex += 1;
          break;
        case "streamChatBlock":
          appendStreamChat(this.state.visuals, command.messages ?? []);
          this.activeRenderer.renderStreamChatBlockInstant(command);
          this.state.currentCommandIndex += 1;
          break;
        case "streamNarration":
          this.activeRenderer.renderStreamNarrationInstant(command);
          this.state.currentCommandIndex += 1;
          break;
        case "dialogue": {
          const speaker = this.characters.get(command.id) ?? { id: command.id, name: command.id };
          if (this.state.currentSurface === "irl") {
            setSpriteFocus(this.state.sprites, command.id);
            this.syncIrlSprites({ instant: true });
          }
          this.compositor.renderDialogueInstant(command.message, speaker);
          this.state.currentCommandIndex += 1;
          break;
        }
        case "streamTitle":
          setStreamTitleState(this.state.visuals, command.text);
          this.activeRenderer.setStreamTitle?.(command.text);
          this.state.currentCommandIndex += 1;
          break;
        case "streamWindow":
          setStreamWindowState(this.state.visuals, command);
          this.activeRenderer.setStreamWindow?.(command);
          this.state.currentCommandIndex += 1;
          break;
        case "streamSystem":
          appendStreamChat(this.state.visuals, [{ kind: "system", text: command.text }]);
          this.activeRenderer.addStreamSystem?.(command.text);
          this.state.currentCommandIndex += 1;
          break;
        case "streamPost":
          appendStreamChat(this.state.visuals, [{ kind: "post", message: command.message }]);
          this.activeRenderer.addStreamPost?.(command.message);
          this.state.currentCommandIndex += 1;
          break;
        case "thread":
          {
            const contact = this.resolveThreadContact(command);
            setTextingThread(this.state.visuals, contact);
            this.activeRenderer.setThread?.(contact);
          }
          this.state.currentCommandIndex += 1;
          break;
        case "jump":
          this.jumpTo(command.target);
          break;
        case "goto":
          // Within a single scene's replay, a goto target is a mark; a
          // scene-goto would have ended this scene. Fall through if unknown.
          if (this.labels.has(command.target)) {
            this.jumpTo(command.target);
          } else {
            this.state.currentCommandIndex += 1;
          }
          break;
        case "condition":
          this.jumpTo(this.evaluateCondition(command) ? command.then : command.else);
          break;
        case "pause":
          this.state.currentCommandIndex += 1;
          break;
        case "choice": {
          const answer = pendingChoices.shift();
          const option = answer
            ? command.options.find(
                (candidate) => (candidate.id ?? candidate.goto ?? candidate.jump ?? candidate.text) === answer.selectedOptionId
              )
            : null;
          const optionTarget = option?.goto ?? option?.jump;
          if (optionTarget && this.labels.has(optionTarget)) {
            this.jumpTo(optionTarget);
          } else {
            this.state.currentCommandIndex += 1;
          }
          break;
        }
        default:
          this.state.currentCommandIndex += 1;
          break;
      }
    }
  }
}
