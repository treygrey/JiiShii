import { applyVarMutations, rollInt } from "../state.js";
import { setBackgroundState } from "../visual-state.js";
import { buildHandlerContext } from "./handler-context.js";

/**
 * Runs commands until the runner reaches a blocked/readable beat.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function runUntilBlocked(runner) {
  while (!runner.isWaitingForPlayer && !runner.isFinished) {
    const command = runner.scene.script[runner.state.currentCommandIndex];

    if (!command) {
      runner.finishScene();
      return;
    }

    runner.executeCommand(command);
  }

  if (
    runner.isWaitingForPlayer &&
    !runner.blockingInput &&
    !runner.isFinished &&
    !runner.reconstructing
  ) {
    runner.captureBeatSnapshot();
  }
}

/**
 * Executes one command through the runner's dispatch table.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Scene command.
 * @returns {void}
 */
export function executeCommand(runner, command) {
  if (command.type === "surface") {
    runner.setSurface(command.id);
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "openLayer") {
    runner.pushSurface(command.id);
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "closeLayer") {
    const top = runner.surfaceStack[runner.surfaceStack.length - 1];
    if (command.id && top !== command.id) {
      throw new Error(
        `close("${command.id}") but the top layer is "${top ?? "none"}". Layers must close in reverse order of open().`
      );
    }
    runner.popSurface();
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "pushSurface") {
    runner.pushSurface(command.id);
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "popSurface") {
    runner.popSurface();
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "openPhone") {
    runner.openPhoneApp(command.app ?? "home");
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "label") {
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "background") {
    setBackgroundState(runner.state.visuals, {
      id: command.id,
      transition: command.transition,
      duration: command.duration
    });
    runner.onBackground(command.id, {
      transition: command.transition,
      duration: command.duration
    });
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (runner.executeSurfaceCommand(command)) {
    return;
  }

  if (command.type === "music") {
    runner.playMusic(command);
    return;
  }

  if (command.type === "audioScene") {
    runner.applyAudioScene(command);
    return;
  }

  if (command.type === "stopMusic") {
    runner.stopMusic(command);
    return;
  }

  if (command.type === "ambience") {
    runner.playAmbience(command);
    return;
  }

  if (command.type === "stopAmbience") {
    runner.stopAmbience(command);
    return;
  }

  if (command.type === "sound") {
    runner.playSound(command);
    return;
  }

  if (command.type === "stopSound") {
    runner.stopSound(command);
    return;
  }

  if (command.type === "voice") {
    runner.playVoice(command);
    return;
  }

  if (command.type === "flash" || command.type === "shake") {
    runner.playScreenEffect(command);
    return;
  }

  if (command.type === "choice") {
    runner.showChoice(command);
    return;
  }

  if (command.type === "jump") {
    runner.jumpTo(command.target);
    return;
  }

  if (command.type === "goto") {
    runner.resolveGoto(command.target);
    return;
  }

  if (command.type === "narration") {
    runner.showNarration(command);
    return;
  }

  if (command.type === "dialogue") {
    runner.showDialogue(command);
    return;
  }

  if (command.type === "say") {
    runner.showSay(command);
    return;
  }

  if (command.type === "transition") {
    runner.showTransition(command);
    return;
  }

  if (command.type === "setFlag") {
    runner.state.vars[command.key] = command.value;
    runner.syncIrlSprites({ instant: runner.reconstructing });
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "setVar") {
    applyVarMutations(runner.state.vars, { [command.key]: command.value });
    runner.syncIrlSprites({ instant: runner.reconstructing });
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "roll") {
    runner.state.vars[command.key] = rollInt(runner.state, command.min, command.max);
    runner.syncIrlSprites({ instant: runner.reconstructing });
    runner.state.currentCommandIndex += 1;
    return;
  }

  if (command.type === "condition") {
    runner.resolveGoto(runner.evaluateCondition(command) ? command.then : command.else);
    return;
  }

  if (command.type === "pause") {
    runner.showPause(command);
    return;
  }

  if (command.type === "endScene") {
    runner.finishScene();
    return;
  }

  runner.state.currentCommandIndex += 1;
}

/**
 * Executes a command owned by the currently active surface module.
 *
 * @param {object} runner - Scene runner instance.
 * @param {object} command - Scene command.
 * @param {object} [options] - Dispatch options.
 * @param {boolean} [options.instant] - Use the instant/replay handler.
 * @returns {boolean} True when a surface handler ran.
 */
export function executeSurfaceCommand(runner, command, { instant = false } = {}) {
  const ownerId = runner.surfaceRegistry.commandOwners?.get(command.type);
  const surface = ownerId ? runner.surfaceRegistry.get(ownerId) : null;
  const metadata = surface?.commands?.[command.type];
  if (metadata?.needsSurface === true && runner.state.currentSurface !== surface?.id) {
    return false;
  }
  const handler = surface?.handlers?.[command.type];
  const run = instant ? handler?.instant ?? handler?.run : handler?.run;
  if (!run) {
    return false;
  }

  run(buildHandlerContext(runner, surface, command, { instant }));
  return true;
}

/**
 * Advances the command pointer by one.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function advanceCommand(runner) {
  runner.state.currentCommandIndex += 1;
}
