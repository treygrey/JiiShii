import { cloneAudioState } from "../audio/audio-state.js";
import { cloneHistoryState } from "../state/history-state.js";
import {
  createSceneEntrySave as createSceneEntrySaveEnvelope,
  createSnapshotSave as createSnapshotSaveEnvelope,
  parseSaveEnvelope,
  SAVE_KIND_SNAPSHOT
} from "../save-format.js";
import { createInitialState, migrateState } from "../state/index.js";
import { cloneSurfaceState, normalizeSurfaceState } from "../surfaces/index.js";
import { shouldCaptureBeatSnapshot } from "./command-executor.js";

const FALLBACK_STORAGE = new Map();

/**
 * Warns once when durable browser storage is unavailable.
 *
 * @param {object} runner - Scene runner instance.
 * @param {unknown} error - Storage failure.
 * @returns {void}
 */
function warnStorageFallback(runner, error) {
  if (runner.storageFallbackWarned) {
    return;
  }
  runner.storageFallbackWarned = true;
  console.warn("JiiShii: Browser storage is unavailable; saves are temporary this session.", error);
  runner.activeRenderer?.setSaveStatus?.("Saves are temporary this session");
  runner.onLog?.({
    kind: "storage-warning",
    message: "Browser storage is unavailable; saves are temporary this session.",
    error
  });
}

/**
 * Writes save data, falling back to memory if localStorage is unavailable.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} key - Storage key.
 * @param {string} value - Serialized save payload.
 * @returns {boolean} True when the write reached localStorage.
 */
function writeStorage(runner, key, value) {
  try {
    localStorage.setItem(key, value);
    FALLBACK_STORAGE.delete(key);
    return true;
  } catch (error) {
    FALLBACK_STORAGE.set(key, value);
    warnStorageFallback(runner, error);
    return false;
  }
}

/**
 * Reads the first populated save value from localStorage or fallback memory.
 *
 * @param {Array<string|null>} keys - Candidate keys.
 * @returns {string|null} Stored value or null.
 */
function readStorage(keys) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    try {
      const value = localStorage.getItem(key);
      if (value) {
        return value;
      }
    } catch {
      // Fall through to in-memory fallback below.
    }
    const fallbackValue = FALLBACK_STORAGE.get(key);
    if (fallbackValue) {
      return fallbackValue;
    }
  }
  return null;
}

/**
 * Snapshots the state the player entered the current scene with and writes the
 * scene-entry autosave.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function checkpointScene(runner) {
  const timestamp = Date.now();
  runner.checkpoint = {
    currentSceneId: runner.scene.id,
    currentCommandIndex: 0,
    currentSurface: "texting",
    surfaceStack: [],
    phoneNavigationSurface: null,
    vars: structuredClone(runner.state.vars),
    saveVars: structuredClone(runner.state.saveVars ?? {}),
    saveVarEvents: structuredClone(runner.state.saveVarEvents ?? {}),
    rng: runner.state.rng,
    choicesMade: structuredClone(runner.state.choicesMade ?? []),
    audio: cloneAudioState(runner.state.audio),
    history: [],
    ...cloneSurfaceState(runner.state, runner.surfaceRegistry),
    timestamp
  };
  writeStorage(
    runner,
    runner.storageKeys.autosave,
    JSON.stringify(createSceneEntrySave(runner, {
      label: "Auto-Save",
      timestamp
    }))
  );
}

/**
 * Mirrors durable phone-app state into the scene-entry checkpoint.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function updatePhoneCheckpointState(runner) {
  if (runner.reconstructing || !runner.checkpoint?.visuals) {
    return;
  }
  const timestamp = Date.now();
  runner.checkpoint.visuals.phone = structuredClone(runner.state.visuals.phone);
  runner.checkpoint.visuals.gallery = structuredClone(runner.state.visuals.gallery);
  runner.checkpoint.visuals.social = structuredClone(runner.state.visuals.social);
  runner.checkpoint.visuals.texting = structuredClone(runner.state.visuals.texting);
  runner.checkpoint.timestamp = timestamp;
  writeStorage(
    runner,
    runner.storageKeys.autosave,
    JSON.stringify(createSceneEntrySave(runner, {
      label: "Auto-Save",
      timestamp
    }))
  );
}

/**
 * Creates a player-facing scene-entry save envelope.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Envelope options.
 * @param {string|null} [options.label] - Optional slot label.
 * @param {number} [options.timestamp] - Optional timestamp.
 * @returns {object} Save envelope.
 */
export function createSceneEntrySave(runner, { label = null, timestamp = undefined } = {}) {
  return createSceneEntrySaveEnvelope({
    state: runner.state,
    checkpoint: runner.checkpoint,
    surfaceRegistry: runner.surfaceRegistry,
    label,
    sceneTitle: runner.scene?.title ?? runner.scene?.id ?? runner.state.currentSceneId,
    timestamp
  });
}

/**
 * Creates a full runner snapshot envelope.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Envelope options.
 * @param {string|null} [options.label] - Optional slot label.
 * @returns {object} Save envelope.
 */
export function createSnapshotSave(runner, { label = null } = {}) {
  return createSnapshotSaveEnvelope({
    state: runner.state,
    commandIndex: runner.activeBeatCommandIndex ?? runner.state.currentCommandIndex,
    lastSpeaker: runner.lastSpeaker,
    surfaceRegistry: runner.surfaceRegistry,
    label,
    sceneTitle: runner.scene?.title ?? runner.scene?.id ?? runner.state.currentSceneId
  });
}

/**
 * Writes a player-facing save-anywhere snapshot to a manual slot.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Save options.
 * @param {boolean} [options.announce] - Show a "Saved" confirmation.
 * @param {number|null} [options.slot] - Manual slot number.
 * @returns {{ ok: boolean, kind?: string, message: string }|void} Save result.
 */
export function save(runner, { announce = false, slot = null } = {}) {
  if (!announce && slot === null) {
    return;
  }
  const key = slot ? runner.saveSlotKey(slot) : runner.storageKeys.save;
  const isDurable = writeStorage(runner, key, JSON.stringify(createSnapshotSave(runner, {
    label: slot ? `Slot ${slot}` : "Manual Save"
  })));
  if (announce) {
    runner.activeRenderer?.setSaveStatus?.(isDurable ? "Saved" : "Saved for this session");
  }
  return {
    ok: true,
    kind: SAVE_KIND_SNAPSHOT,
    durable: isDurable,
    message: isDurable ? "Saved" : "Saved for this session"
  };
}

/**
 * Loads a checkpoint or snapshot save.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} [options] - Load options.
 * @param {boolean} [options.auto] - Read the autosave.
 * @param {number|null} [options.slot] - Manual slot number.
 * @returns {{ ok: boolean, message: string }} Load result.
 */
export function load(runner, { auto = false, slot = null } = {}) {
  const rawSave = slot
    ? readStorage([runner.saveSlotKey(slot), runner.legacySaveSlotKey(slot)])
    : auto
      ? readStorage([runner.storageKeys.autosave, runner.storageKeys.save, runner.storageKeys.legacyAutosave, runner.storageKeys.legacySave])
      : readStorage([runner.storageKeys.save, runner.storageKeys.legacySave]);
  if (!rawSave) {
    runner.activeRenderer?.setSaveStatus?.("No save found");
    return { ok: false, reason: "missing", message: "No save found" };
  }

  let envelope;
  try {
    envelope = parseSaveEnvelope(rawSave, runner.surfaceRegistry);
  } catch {
    runner.activeRenderer?.setSaveStatus?.("Save could not be loaded");
    return { ok: false, reason: "corrupt", message: "Save could not be loaded" };
  }
  const saved = envelope.state;
  const savedScene = saved.currentSceneId ? runner.registry[saved.currentSceneId] : null;
  if (!savedScene) {
    runner.activeRenderer?.setSaveStatus?.("Saved scene is not available");
    return { ok: false, reason: "missing-scene", message: "Saved scene is not available" };
  }

  if (envelope.kind === SAVE_KIND_SNAPSHOT) {
    return loadSnapshot(runner, envelope, saved);
  }

  return loadSceneEntry(runner, envelope, saved, savedScene);
}

/**
 * Loads a save-anywhere snapshot envelope.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} envelope - Parsed save envelope.
 * @param {object} saved - Saved state.
 * @returns {{ ok: boolean, kind: string, message: string }} Load result.
 */
function loadSnapshot(runner, envelope, saved) {
  runner.reconstructTo({
    ...saved,
    sceneId: saved.currentSceneId,
    commandIndex: saved.currentCommandIndex
  }, {
    preservePersistentPhoneState: false,
    preserveSaveVars: false
  });
  runner.rollbackBuffer = [];
  runner.rollbackPos = -1;
  runner.isRewound = false;
  if (shouldCaptureBeatSnapshot(runner)) {
    runner.captureBeatSnapshot();
  }
  runner.activeRenderer?.setSaveStatus?.("Loaded");
  return { ok: true, kind: envelope.kind, message: "Loaded" };
}

/**
 * Loads a scene-entry save envelope.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} envelope - Parsed save envelope.
 * @param {object} saved - Saved state.
 * @param {object} savedScene - Scene definition.
 * @returns {{ ok: boolean, kind: string, message: string }} Load result.
 */
function loadSceneEntry(runner, envelope, saved, savedScene) {
  const statusRenderer = runner.activeRenderer;
  runner.teardownMountedSurfaces();
  runner.compositor.hideNarration();
  runner.onBackground(null);
  runner.audio.stopAll?.();

  runner.scene = savedScene;
  runner.labels = runner.createLabelIndex(runner.scene.script);
  runner.characters = runner.buildCharacters(runner.scene);

  runner.state = migrateState({
    ...createInitialState(),
    currentSceneId: runner.scene.id,
    currentCommandIndex: saved.currentCommandIndex ?? 0,
    currentSurface: saved.currentSurface ?? "texting",
    surfaceStack: structuredClone(saved.surfaceStack ?? []),
    phoneNavigationSurface: saved.phoneNavigationSurface ?? null,
    vars: saved.vars ?? {},
    saveVars: structuredClone(saved.saveVars ?? {}),
    saveVarEvents: structuredClone(saved.saveVarEvents ?? {}),
    rng: saved.rng,
    choicesMade: structuredClone(saved.choicesMade ?? []),
    audio: cloneAudioState(saved.audio),
    history: cloneHistoryState(saved.history),
    sprites: structuredClone(saved.sprites),
    visuals: structuredClone(saved.visuals)
  });
  Object.assign(runner.state, normalizeSurfaceState(runner.state, runner.surfaceRegistry));
  runner.setPhoneNavigationSurface(null);
  runner.isFinished = false;
  runner.isWaitingForPlayer = false;
  runner.blockingInput = false;
  statusRenderer?.setSaveStatus?.("Loaded");
  runner.resetRollback();
  runner.checkpointScene();
  runner.runUntilBlocked();
  return { ok: true, kind: envelope.kind, message: "Loaded" };
}
