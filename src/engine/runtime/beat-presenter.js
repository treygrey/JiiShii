import { evalShowIf } from "../state/showif.js";
import { annotateSeenChoiceOptions } from "./persistent-controller.js";
import {
  appendStreamChat,
  appendTextMessages,
  setStreamWindowState
} from "../state/visual-state.js";

/**
 * Presents a narration beat through the runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Narration command.
 * @returns {void}
 */
export function showNarration(runner, command) {
  runner.beginReadableBeat();
  runner.lastSpeaker = null;
  runner.applySpriteFocus(null);
  runner.recordHistory({
    kind: "narration",
    message: command.message
  });
  runner.isWaitingForPlayer = true;
  runner.compositor.showNarration(command, {
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents a dialogue beat through the runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Dialogue command.
 * @returns {void}
 */
export function showDialogue(runner, command) {
  runner.beginReadableBeat();
  runner.isWaitingForPlayer = true;
  runner.lastSpeaker = command.id ?? null;
  const speaker = runner.characters.get(command.id) ?? { id: command.id, name: command.id };
  runner.recordHistory({
    kind: "dialogue",
    speaker: command.id ?? null,
    name: speaker.name ?? command.id ?? null,
    side: speaker.side ?? "left",
    message: command.message
  });
  runner.compositor.showDialogue(command, speaker, {
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents a choice beat through the runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Choice command.
 * @returns {void}
 */
export function showChoice(runner, command) {
  const lookupVars = runner.conditionVars();
  const visible = (command.options ?? []).filter(
    (option) => option.showIf == null || evalShowIf(option.showIf, lookupVars)
  );

  if (visible.length === 0) {
    runner.state.currentCommandIndex += 1;
    runner.isWaitingForPlayer = false;
    runner.runUntilBlocked();
    return;
  }

  const filtered = { ...command, options: annotateSeenChoiceOptions(runner, visible) };
  runner.isWaitingForPlayer = true;
  runner.blockingInput = true;
  runner.activeRenderer.showChoice(filtered, {
    onSelect: (option) => runner.selectChoice(filtered, option)
  });
}

/**
 * Presents a transition beat through the runner.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Transition command.
 * @returns {void}
 */
export function showTransition(runner, command) {
  runner.compositor.hideNarration();
  const notificationContact = runner.getTextingTransitionNotificationContact(command);
  runner.isWaitingForPlayer = true;
  runner.blockingInput = true;
  if (notificationContact) {
    runner.markTextThreadUnread(notificationContact, {
      preview: runner.previewIncomingText(runner.registry[command.target], 0, notificationContact.id),
      pendingSceneId: command.target
    });
    runner.activeRenderer.showThreadNotification(notificationContact, {
      onSelect: () => {
        runner.markTextThreadRead(notificationContact.id ?? notificationContact.name);
        runner.blockingInput = false;
        runner.loadScene(command.target);
      }
    });
    return;
  }

  runner.activeRenderer.showTransition(command, {
    onSelect: () => {
      runner.blockingInput = false;
      if (command.target && runner.registry[command.target]) {
        runner.loadScene(command.target);
      } else {
        runner.finishScene();
        runner.onTransition(command.target);
      }
    }
  });
}

/**
 * Presents a texting block beat.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Text block command.
 * @returns {void}
 */
export function showTextBlock(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  const renderedTexts = appendTextMessages(runner.state.visuals, command.texts ?? []);
  runner.recordMessageHistory(command.texts ?? [], "texting");
  runner.activeRenderer.showTextBlock({ ...command, texts: renderedTexts }, {
    characters: runner.characters,
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents an IRL line-block beat.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Line block command.
 * @returns {void}
 */
export function showLineBlock(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  runner.activeRenderer.showLineBlock(command, {
    characters: runner.characters,
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents a stream image beat.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Stream image command.
 * @returns {void}
 */
export function showStreamImage(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
  runner.activeRenderer.showStreamImage(command, {
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents a stream chat block.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Stream chat block command.
 * @returns {void}
 */
export function showStreamChatBlock(runner, command) {
  if (!command.concurrent) {
    runner.beginReadableBeat();
    runner.compositor.hideNarration();
    runner.isWaitingForPlayer = true;
  }
  appendStreamChat(runner.state.visuals, command.messages ?? []);

  runner.activeRenderer.showStreamChatBlock(command, {
    onComplete: () => {
      if (!command.concurrent) {
        runner.state.currentCommandIndex += 1;
        runner.save();
        if (!runner.maybeAutoAdvanceToDecision()) {
          runner.onIdle();
        }
      }
    }
  });

  if (command.concurrent) {
    runner.state.currentCommandIndex += 1;
    runner.save();
  }
}

/**
 * Presents streaming narration in the shared narration box.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Stream narration command.
 * @returns {void}
 */
export function showStreamNarration(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  runner.compositor.showNarration(command, {
    onComplete: () => {
      runner.state.currentCommandIndex += 1;
      runner.save();
      if (!runner.maybeAutoAdvanceToDecision()) {
        runner.onIdle();
      }
    }
  });
}

/**
 * Presents a blocking text-input beat and stores the submission in a var.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Input command.
 * @returns {void}
 */
export function showInput(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  // Block tap-to-advance so a stage click cannot dismiss the input beat.
  runner.blockingInput = true;
  runner.compositor.showInput(
    {
      ...command,
      // Re-presentations (rollback, load) prefill the previous answer.
      default: runner.state.vars[command.key] ?? command.default ?? ""
    },
    {
      onSubmit: (value) => {
        const text = String(value ?? "").trim();
        if (!text && !command.allowEmpty) {
          return false;
        }
        runner.state.vars[command.key] = text;
        updateActiveInputSnapshot(runner);
        runner.recordHistory({ kind: "narration", message: text });
        runner.blockingInput = false;
        runner.isWaitingForPlayer = false;
        runner.state.currentCommandIndex += 1;
        runner.save();
        runner.runUntilBlocked();
        return true;
      }
    }
  );
}

/**
 * Plays a blocking full-screen video cutscene beat.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Video command.
 * @returns {void}
 */
export function showVideo(runner, command) {
  runner.beginReadableBeat();
  runner.compositor.hideNarration();
  runner.isWaitingForPlayer = true;
  // Block tap-to-advance; the video layer owns clicks (skip when allowed).
  runner.blockingInput = true;
  let finished = false;
  runner.compositor.playVideo(command, {
    onComplete: () => {
      if (finished) {
        return;
      }
      finished = true;
      runner.blockingInput = false;
      runner.isWaitingForPlayer = false;
      runner.state.currentCommandIndex += 1;
      runner.save();
      runner.runUntilBlocked();
    }
  });
}

/**
 * Mirrors a submitted input value into the active rollback snapshot so rolling
 * back to the prompt can prefill the last answer without making input permanent.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
function updateActiveInputSnapshot(runner) {
  const snapshot = runner.rollbackBuffer?.[runner.rollbackPos];
  if (
    snapshot &&
    snapshot.sceneId === runner.state.currentSceneId &&
    snapshot.commandIndex === runner.activeBeatCommandIndex
  ) {
    snapshot.vars = structuredClone(runner.state.vars);
  }
}

/**
 * Marks the current scene as complete.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function finishScene(runner) {
  runner.isFinished = true;
  runner.activeRenderer?.showEnd();
  runner.save();
}
