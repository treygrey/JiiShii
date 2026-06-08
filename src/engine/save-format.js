import { cloneAudioState } from "./audio-state.js";
import { cloneHistoryState } from "./history-state.js";
import { cloneSurfaceState, createSurfaceRegistry, createSurfaceState } from "./surface-modules.js";
import { createInitialState, migrateState } from "./state.js";

/** Current save-envelope schema version. */
export const SAVE_SCHEMA_VERSION = 1;

/** Scene-entry save kind. */
export const SAVE_KIND_SCENE_ENTRY = "scene-entry";

/** Full runner snapshot save kind reserved for save-anywhere. */
export const SAVE_KIND_SNAPSHOT = "snapshot";

/**
 * Creates stable metadata shown in save/load slot UI.
 *
 * @param {object} options - Metadata inputs.
 * @param {string} options.sceneId - Saved scene id.
 * @param {number} [options.commandIndex] - Saved command index.
 * @param {string|null} [options.activeSurface] - Active surface id.
 * @param {string|null} [options.label] - Optional user-facing label.
 * @param {string|null} [options.sceneTitle] - Optional scene title.
 * @param {string|null} [options.kind] - Save kind.
 * @param {number} [options.timestamp] - Epoch timestamp.
 * @returns {object} Save metadata.
 */
function createSaveMetadata({
  sceneId,
  commandIndex = 0,
  activeSurface = null,
  label = null,
  sceneTitle = null,
  kind = SAVE_KIND_SCENE_ENTRY,
  timestamp = Date.now()
}) {
  return {
    timestamp,
    label,
    kind,
    sceneId,
    currentSceneId: sceneId,
    sceneTitle: sceneTitle ?? sceneId,
    commandIndex,
    activeSurface
  };
}

/**
 * Creates a versioned scene-entry save envelope.
 *
 * @param {object} options - Save inputs.
 * @param {object} options.state - Live runner state.
 * @param {object} options.checkpoint - Scene-entry checkpoint.
 * @param {object} options.surfaceRegistry - Surface registry.
 * @param {string|null} [options.label] - Optional save label.
 * @param {string|null} [options.sceneTitle] - Optional scene title.
 * @param {number} [options.timestamp] - Epoch timestamp.
 * @returns {object} Save envelope.
 */
export function createSceneEntrySave({ state, checkpoint, surfaceRegistry, label = null, sceneTitle = null, timestamp = Date.now() }) {
  const saved = migrateState({
    ...createInitialState(),
    currentSceneId: checkpoint?.currentSceneId ?? state.currentSceneId,
    currentCommandIndex: checkpoint?.currentCommandIndex ?? 0,
    currentSurface: checkpoint?.currentSurface ?? "texting",
    surfaceStack: structuredClone(checkpoint?.surfaceStack ?? []),
    phoneNavigationSurface: checkpoint?.phoneNavigationSurface ?? null,
    vars: structuredClone(checkpoint?.vars ?? state.vars ?? {}),
    rng: checkpoint?.rng ?? state.rng,
    choicesMade: structuredClone(checkpoint?.choicesMade ?? []),
    audio: structuredClone(checkpoint?.audio ?? undefined),
    history: structuredClone(checkpoint?.history ?? []),
    sprites: structuredClone(checkpoint?.sprites ?? undefined),
    visuals: structuredClone(checkpoint?.visuals ?? undefined)
  });
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    kind: SAVE_KIND_SCENE_ENTRY,
    state: {
      ...saved,
      ...cloneSurfaceState(saved, surfaceRegistry)
    },
    metadata: createSaveMetadata({
      timestamp,
      label,
      sceneId: saved.currentSceneId,
      sceneTitle,
      kind: SAVE_KIND_SCENE_ENTRY,
      commandIndex: saved.currentCommandIndex,
      activeSurface: saved.currentSurface
    })
  };
}

/**
 * Creates a versioned full-state snapshot envelope for future save-anywhere.
 *
 * @param {object} options - Save inputs.
 * @param {object} options.state - Live runner state.
 * @param {number|null} [options.commandIndex] - Readable beat index to save.
 * @param {string|null} [options.lastSpeaker] - Last speaker id.
 * @param {object} options.surfaceRegistry - Surface registry.
 * @param {string|null} [options.label] - Optional save label.
 * @param {string|null} [options.sceneTitle] - Optional scene title.
 * @param {number} [options.timestamp] - Epoch timestamp.
 * @returns {object} Save envelope.
 */
export function createSnapshotSave({ state, commandIndex = null, lastSpeaker = null, surfaceRegistry, label = null, sceneTitle = null, timestamp = Date.now() }) {
  const saved = migrateState({
    ...createInitialState(),
    currentSceneId: state.currentSceneId,
    currentCommandIndex: commandIndex ?? state.currentCommandIndex ?? 0,
    currentSurface: state.currentSurface ?? null,
    surfaceStack: structuredClone(state.surfaceStack ?? []),
    phoneNavigationSurface: state.phoneNavigationSurface ?? null,
    vars: structuredClone(state.vars ?? {}),
    rng: state.rng,
    choicesMade: structuredClone(state.choicesMade ?? []),
    audio: cloneAudioState(state.audio),
    history: cloneHistoryState(state.history),
    sprites: structuredClone(state.sprites),
    visuals: structuredClone(state.visuals),
    lastSpeaker
  });
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    kind: SAVE_KIND_SNAPSHOT,
    state: {
      ...saved,
      ...cloneSurfaceState(saved, surfaceRegistry)
    },
    metadata: createSaveMetadata({
      timestamp,
      label,
      sceneId: saved.currentSceneId,
      sceneTitle,
      kind: SAVE_KIND_SNAPSHOT,
      commandIndex: saved.currentCommandIndex,
      activeSurface: saved.currentSurface
    })
  };
}

/**
 * Reports whether a parsed object already looks like a save envelope.
 *
 * @param {object} value - Parsed save value.
 * @returns {boolean} True for current/future save envelopes.
 */
function isSaveEnvelope(value) {
  return Boolean(value?.schemaVersion && value?.kind && value?.state);
}

/**
 * Migrates legacy scene-entry saves and current envelopes into one shape.
 *
 * @param {object} parsedSave - Parsed localStorage payload.
 * @param {object} surfaceRegistry - Surface registry.
 * @returns {object} Versioned save envelope.
 */
export function migrateSaveEnvelope(parsedSave, surfaceRegistry) {
  if (!parsedSave || typeof parsedSave !== "object") {
    throw new Error("Save payload is not an object.");
  }

  if (isSaveEnvelope(parsedSave)) {
    const state = migrateState({
      ...createInitialState(),
      ...parsedSave.state
    });
    Object.assign(state, {
      ...createSurfaceState(surfaceRegistry),
      ...cloneSurfaceState(state, surfaceRegistry)
    });
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: parsedSave.kind === SAVE_KIND_SNAPSHOT ? SAVE_KIND_SNAPSHOT : SAVE_KIND_SCENE_ENTRY,
      state,
      metadata: {
        ...createSaveMetadata({
          sceneId: state.currentSceneId,
          commandIndex: state.currentCommandIndex,
          activeSurface: state.currentSurface,
          kind: parsedSave.kind === SAVE_KIND_SNAPSHOT ? SAVE_KIND_SNAPSHOT : SAVE_KIND_SCENE_ENTRY,
          timestamp: parsedSave.metadata?.timestamp ?? parsedSave.timestamp ?? Date.now()
        }),
        ...(parsedSave.metadata ?? {})
      }
    };
  }

  const state = migrateState({
    ...createInitialState(),
    currentSceneId: parsedSave.currentSceneId ?? parsedSave.sceneId ?? null,
    currentCommandIndex: parsedSave.currentCommandIndex ?? 0,
    currentSurface: parsedSave.currentSurface ?? "texting",
    surfaceStack: structuredClone(parsedSave.surfaceStack ?? []),
    phoneNavigationSurface: parsedSave.phoneNavigationSurface ?? null,
    vars: structuredClone(parsedSave.vars ?? parsedSave.stats ?? parsedSave.flags ?? {}),
    rng: parsedSave.rng,
    choicesMade: structuredClone(parsedSave.choicesMade ?? []),
    audio: structuredClone(parsedSave.audio ?? undefined),
    history: structuredClone(parsedSave.history ?? []),
    sprites: structuredClone(parsedSave.sprites ?? undefined),
    visuals: structuredClone(parsedSave.visuals ?? undefined)
  });
  Object.assign(state, {
    ...createSurfaceState(surfaceRegistry),
    ...cloneSurfaceState(state, surfaceRegistry)
  });
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    kind: SAVE_KIND_SCENE_ENTRY,
    state,
    metadata: createSaveMetadata({
      sceneId: state.currentSceneId,
      commandIndex: state.currentCommandIndex,
      activeSurface: state.currentSurface,
      kind: SAVE_KIND_SCENE_ENTRY,
      timestamp: parsedSave.timestamp ?? Date.now()
    })
  };
}

/**
 * Parses and migrates a raw localStorage save payload.
 *
 * @param {string} rawSave - Raw storage value.
 * @param {object} surfaceRegistry - Surface registry.
 * @returns {object} Versioned save envelope.
 */
export function parseSaveEnvelope(rawSave, surfaceRegistry) {
  return migrateSaveEnvelope(JSON.parse(rawSave), surfaceRegistry);
}

/**
 * Extracts display metadata from a raw save payload without throwing.
 *
 * @param {string|null} rawSave - Raw storage value.
 * @param {object} surfaceRegistry - Surface registry.
 * @returns {object|null} Metadata or null when unreadable.
 */
export function readSaveMetadata(rawSave, surfaceRegistry = createSurfaceRegistry()) {
  if (!rawSave) {
    return null;
  }
  try {
    return parseSaveEnvelope(rawSave, surfaceRegistry).metadata;
  } catch {
    return null;
  }
}
