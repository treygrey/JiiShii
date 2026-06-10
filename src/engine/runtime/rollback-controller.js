/**
 * Reports whether the runner has an earlier readable beat.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True if rollback can move.
 */
export function canRollBack(runner) {
  return runner.rollbackPos > 0;
}

/**
 * Reports whether the runner is parked on a rolled-back beat.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True if currently rewound.
 */
export function rewound(runner) {
  return runner.isRewound;
}

/**
 * Rolls the runner one readable beat backward.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function rollBack(runner) {
  if (runner.rollbackPos <= 0) {
    return;
  }
  runner.rollbackPos -= 1;
  runner.reconstructTo(runner.rollbackBuffer[runner.rollbackPos]);
  runner.isRewound = runner.rollbackPos < runner.rollbackBuffer.length - 1;
}

/**
 * Rolls the runner one readable beat forward.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function rollForward(runner) {
  if (runner.rollbackPos >= runner.rollbackBuffer.length - 1) {
    runner.isRewound = false;
    return;
  }
  runner.rollbackPos += 1;
  runner.reconstructTo(runner.rollbackBuffer[runner.rollbackPos]);
  runner.isRewound = runner.rollbackPos < runner.rollbackBuffer.length - 1;
}

/**
 * Captures the minimal deterministic seed for the current beat.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function captureBeatSnapshot(runner) {
  const snapshot = {
    sceneId: runner.state.currentSceneId,
    commandIndex: runner.activeBeatCommandIndex ?? runner.state.currentCommandIndex,
    vars: structuredClone(runner.state.vars),
    rng: runner.state.rng,
    choicesMade: structuredClone(runner.state.choicesMade ?? []),
    surfaceStack: [...(runner.state.surfaceStack ?? [])],
    currentSurface: runner.state.currentSurface ?? null,
    phoneNavigationSurface: runner.state.phoneNavigationSurface ?? null,
    lastSpeaker: runner.lastSpeaker,
    audio: cloneAudioState(runner.state.audio),
    history: cloneHistoryState(runner.state.history),
    ...cloneSurfaceState(runner.state, runner.surfaceRegistry)
  };
  const previous = runner.rollbackBuffer[runner.rollbackBuffer.length - 1];
  if (
    previous &&
    previous.sceneId === snapshot.sceneId &&
    previous.commandIndex === snapshot.commandIndex
  ) {
    runner.rollbackBuffer[runner.rollbackBuffer.length - 1] = snapshot;
  } else {
    runner.rollbackBuffer.push(snapshot);
  }
  const MAX = 250;
  if (runner.rollbackBuffer.length > MAX) {
    runner.rollbackBuffer.shift();
  }
  runner.rollbackPos = runner.rollbackBuffer.length - 1;
  runner.isRewound = false;
}

/**
 * Rebuilds the exact moment a snapshot describes.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} snap - Rollback snapshot.
 * @param {object} [options] - Reconstruction options.
 * @param {boolean} [options.preservePersistentPhoneState] - Preserve durable phone UI state.
 * @returns {void}
 */
export function reconstructTo(runner, snap, { preservePersistentPhoneState = true } = {}) {
  runner.reconstructing = true;
  runner.activeBeatCommandIndex = null;
  const preservedPhoneState = cloneSurfaceState(runner.state, runner.surfaceRegistry);

  runner.teardownMountedSurfaces();
  runner.audio.stopTransient?.();
  runner.compositor.hideNarration();
  runner.onBackground(null);

  const scene = runner.registry[snap.sceneId];
  if (scene) {
    runner.scene = scene;
    runner.labels = runner.createLabelIndex(scene.script);
    runner.characters = runner.buildCharacters(scene);
  }
  runner.state.currentSceneId = snap.sceneId;
  runner.state.surfaceStack = [];
  runner.state.vars = structuredClone(snap.vars);
  runner.state.rng = snap.rng;
  runner.state.choicesMade = structuredClone(snap.choicesMade ?? []);
  runner.state.audio = cloneAudioState(snap.audio);
  runner.state.history = cloneHistoryState(snap.history);
  runner.state.currentCommandIndex = snap.commandIndex;
  runner.state.currentSurface = snap.currentSurface ?? "texting";
  runner.setPhoneNavigationSurface(snap.phoneNavigationSurface ?? null);
  const finalSurfaceState = cloneSurfaceState(snap, runner.surfaceRegistry);
  const emptySurfaceState = createSurfaceState(runner.surfaceRegistry);
  runner.state.sprites = emptySurfaceState.sprites;
  runner.state.visuals = emptySurfaceState.visuals;
  runner.lastSpeaker = snap.lastSpeaker ?? null;
  runner.isWaitingForPlayer = false;
  runner.isFinished = false;
  runner.blockingInput = false;

  runner.replaySceneContextToCurrentCommand();
  runner.runUntilBlocked();
  runner.state.sprites = finalSurfaceState.sprites;
  runner.state.visuals = finalSurfaceState.visuals;
  if (preservePersistentPhoneState) {
    mergePersistentPhoneState(runner.state, preservedPhoneState);
  }
  runner.lastSpeaker = snap.lastSpeaker ?? runner.lastSpeaker;
  runner.syncVisualState({ instant: true });
  runner.syncAudioState({ instant: true });

  runner.reconstructing = false;
}

/**
 * Replays deterministic scene context for rollback reconstruction.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function replaySceneContextToCurrentCommand(runner) {
  const targetCommandIndex = runner.state.currentCommandIndex;
  runner.state.currentCommandIndex = 0;
  runner.isWaitingForPlayer = false;
  runner.isFinished = false;
  runner.blockingInput = false;

  const pendingChoices = [...(runner.state.choicesMade ?? [])].filter(
    (entry) => entry.sceneId === runner.scene.id
  );

  let guard = 0;
  while (runner.state.currentCommandIndex < targetCommandIndex && guard < 100000) {
    guard += 1;
    const command = runner.scene.script[runner.state.currentCommandIndex];

    if (!command) {
      break;
    }

    if (runner.executeSurfaceCommand(command, { instant: true })) {
      continue;
    }

    if (
      runner.applyPhoneCommand(command) ||
      runner.applyGalleryCommand(command) ||
      runner.applySocialCommand(command)
    ) {
      continue;
    }

    switch (command.type) {
      case "surface":
        runner.setSurface(command.id);
        runner.state.currentCommandIndex += 1;
        break;
      case "openLayer":
        runner.pushSurface(command.id);
        runner.state.currentCommandIndex += 1;
        break;
      case "closeLayer":
        runner.popSurface();
        runner.state.currentCommandIndex += 1;
        break;
      case "pushSurface":
        runner.pushSurface(command.id);
        runner.state.currentCommandIndex += 1;
        break;
      case "popSurface":
        runner.popSurface();
        runner.state.currentCommandIndex += 1;
        break;
      case "label":
      case "setFlag":
      case "setVar":
      case "roll":
        runner.state.currentCommandIndex += 1;
        break;
      case "narration":
        setSpriteFocus(runner.state.sprites, null);
        runner.state.currentCommandIndex += 1;
        break;
      case "textBlock": {
        const renderedTexts = appendTextMessages(runner.state.visuals, command.texts ?? []);
        runner.activeRenderer.renderTextBlockInstant({ ...command, texts: renderedTexts }, { characters: runner.characters });
        runner.state.currentCommandIndex += 1;
        break;
      }
      case "say":
        runner.renderSayInstant(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "background":
        setBackgroundState(runner.state.visuals, {
          id: command.id,
          transition: command.transition,
          duration: command.duration
        });
        runner.onBackground(command.id, { transition: "cut" });
        runner.state.currentCommandIndex += 1;
        break;
      case "music":
        applyMusicState(runner.state.audio, command);
        runner.state.currentCommandIndex += 1;
        break;
      case "stopMusic":
        clearMusicState(runner.state.audio);
        runner.state.currentCommandIndex += 1;
        break;
      case "ambience":
        applyAmbienceState(runner.state.audio, command);
        runner.state.currentCommandIndex += 1;
        break;
      case "stopAmbience":
        clearAmbienceState(runner.state.audio);
        runner.state.currentCommandIndex += 1;
        break;
      case "audioScene":
        applyAudioSceneState(runner.state.audio, runner.audioScenes?.[command.id] ?? {}, command);
        runner.state.currentCommandIndex += 1;
        break;
      case "sound":
      case "stopSound":
      case "voice":
        runner.state.currentCommandIndex += 1;
        break;
      case "showCharacter":
        runner.applyShowSprite(command, { instant: true });
        runner.state.currentCommandIndex += 1;
        break;
      case "hideCharacter":
        runner.applyHideSprite(command.id, { instant: true });
        runner.state.currentCommandIndex += 1;
        break;
      case "lineBlock":
        runner.activeRenderer.renderLineBlockInstant(command, { characters: runner.characters });
        runner.state.currentCommandIndex += 1;
        break;
      case "streamLayout":
        setStreamLayoutState(runner.state.visuals, command);
        runner.activeRenderer.setStreamLayout(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamImage":
        setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
        runner.activeRenderer.renderStreamImageInstant(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamChatBlock":
        appendStreamChat(runner.state.visuals, command.messages ?? []);
        runner.activeRenderer.renderStreamChatBlockInstant(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamNarration":
        runner.activeRenderer.renderStreamNarrationInstant(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "dialogue": {
        const speaker = runner.characters.get(command.id) ?? { id: command.id, name: command.id };
        if (runner.state.currentSurface === "irl") {
          setSpriteFocus(runner.state.sprites, command.id);
          runner.syncIrlSprites({ instant: true });
        }
        runner.compositor.renderDialogueInstant(command.message, speaker);
        runner.state.currentCommandIndex += 1;
        break;
      }
      case "streamTitle":
        setStreamTitleState(runner.state.visuals, command.text);
        runner.activeRenderer.setStreamTitle?.(command.text);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamWindow":
        setStreamWindowState(runner.state.visuals, command);
        runner.activeRenderer.setStreamWindow?.(command);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamSystem":
        appendStreamChat(runner.state.visuals, [{ kind: "system", text: command.text }]);
        runner.activeRenderer.addStreamSystem?.(command.text);
        runner.state.currentCommandIndex += 1;
        break;
      case "streamPost":
        appendStreamChat(runner.state.visuals, [{ kind: "post", message: command.message }]);
        runner.activeRenderer.addStreamPost?.(command.message);
        runner.state.currentCommandIndex += 1;
        break;
      case "thread": {
        const contact = runner.resolveThreadContact(command);
        setTextingThread(runner.state.visuals, contact);
        runner.activeRenderer.setThread?.(contact);
        runner.state.currentCommandIndex += 1;
        break;
      }
      case "jump":
        runner.jumpTo(command.target);
        break;
      case "goto":
        if (runner.labels.has(command.target)) {
          runner.jumpTo(command.target);
        } else {
          runner.state.currentCommandIndex += 1;
        }
        break;
      case "condition":
        {
          const target = runner.evaluateCondition(command) ? command.then : command.else;
          if (runner.labels.has(target)) {
            runner.jumpTo(target);
          } else {
            runner.state.currentCommandIndex += 1;
          }
        }
        break;
      case "pause":
        runner.state.currentCommandIndex += 1;
        break;
      case "choice": {
        const answer = pendingChoices.shift();
        const option = answer
          ? command.options.find(
              (candidate) => (candidate.id ?? candidate.goto ?? candidate.jump ?? candidate.text) === answer.selectedOptionId
            )
          : null;
        const optionTarget = option?.goto ?? option?.jump;
        if (optionTarget && runner.labels.has(optionTarget)) {
          runner.jumpTo(optionTarget);
        } else {
          runner.state.currentCommandIndex += 1;
        }
        break;
      }
      default:
        runner.state.currentCommandIndex += 1;
        break;
    }
  }
}
import {
  applyAmbienceState,
  applyAudioSceneState,
  applyMusicState,
  clearAmbienceState,
  clearMusicState,
  cloneAudioState
} from "../audio-state.js";
import { cloneHistoryState } from "../history-state.js";
import { setSpriteFocus } from "../sprite-state.js";
import { cloneSurfaceState, createSurfaceState } from "../surface-modules.js";
import {
  appendStreamChat,
  appendTextMessages,
  setBackgroundState,
  setStreamLayoutState,
  setStreamTitleState,
  setStreamWindowState,
  setTextingThread
} from "../visual-state.js";
import { mergePersistentPhoneState } from "../phone-state.js";
