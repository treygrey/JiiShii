import { defineSurfaceModule, SHARED_RENDERER_COMMANDS } from "../define-surface-module.js";
import {
  applyHideAllCharacters,
  applyHideCharacter,
  applyClearIrlImage,
  applyClearIrlStage,
  applyShowCharacter,
  applyShowIrlImage,
  applyIrlImageTransform,
  cloneSpriteState,
  createSpriteState,
  applySpriteExpression,
  applySpriteTransform,
  normalizeSpriteState
} from "../../sprite-state.js";
import {
  appendStreamChat,
  appendTextMessages,
  cloneVisualState,
  createVisualState,
  normalizeVisualState,
  setStreamLayoutState,
  setStreamTitleState,
  setStreamWindowState,
  setTextingThread
} from "../../visual-state.js";
import {
  createGalleryState,
  createSocialState,
  normalizeGalleryState,
  normalizePhoneState,
  normalizeSocialState
} from "../../phone-state.js";

export const IRL_SURFACE = defineSurfaceModule({
  id: "irl",
  kind: "story",
  baseline: true,
  renderer: {
    surface: "irl",
    commands: [
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
      ...SHARED_RENDERER_COMMANDS
    ],
    projections: ["renderSpriteState"]
  },
  commands: {
    showCharacter: { kind: "render", surface: "irl", needsSurface: true },
    hideCharacter: { kind: "render", surface: "irl", needsSurface: true },
    hideAllCharacters: { kind: "render", surface: "irl", needsSurface: true },
    clearIrlStage: { kind: "render", surface: "irl", needsSurface: true },
    setCharacterExpression: { kind: "render", surface: "irl", needsSurface: true },
    moveCharacter: { kind: "render", surface: "irl", needsSurface: true },
    showIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    moveIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    clearIrlImage: { kind: "render", surface: "irl", needsSurface: true },
    lineBlock: { kind: "render", surface: "irl", needsSurface: true, blocks: true }
  },
  state: {
    create: () => createSpriteState().irl,
    normalize: (value) => normalizeSpriteState({ irl: value }).irl,
    clone: (value) => cloneSpriteState({ irl: value }).irl,
    project: ({ renderer, state, context }) => {
      renderer?.renderSpriteState?.(state, {
        characters: context.characters,
        vars: context.vars ?? {},
        instant: context.instant
      });
    }
  },
  handlers: {
    showCharacter: {
      run: ({ runner, command }) => {
        applyShowCharacter(runner.state.sprites, command, runner.characters);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyShowCharacter(runner.state.sprites, command, runner.characters);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    hideCharacter: {
      run: ({ runner, renderer, command }) => {
        renderer?.setExitTransition?.(command.id, command.transition);
        applyHideCharacter(runner.state.sprites, command.id);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyHideCharacter(runner.state.sprites, command.id);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    hideAllCharacters: {
      run: ({ runner, renderer, command }) => {
        for (const sprite of runner.state.sprites?.irl?.visible ?? []) {
          renderer?.setExitTransition?.(sprite.id, command.transition);
        }
        applyHideAllCharacters(runner.state.sprites);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner }) => {
        applyHideAllCharacters(runner.state.sprites);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    clearIrlStage: {
      run: ({ runner, renderer, command }) => {
        for (const sprite of runner.state.sprites?.irl?.visible ?? []) {
          renderer?.setExitTransition?.(sprite.id, command.transition);
        }
        for (const image of runner.state.sprites?.irl?.images ?? []) {
          renderer?.setImageExitTransition?.(image.id, command.transition);
        }
        applyClearIrlStage(runner.state.sprites);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner }) => {
        applyClearIrlStage(runner.state.sprites);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    setCharacterExpression: {
      run: ({ runner, command }) => {
        applySpriteExpression(runner.state.sprites, command.id, command.expression);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applySpriteExpression(runner.state.sprites, command.id, command.expression);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    moveCharacter: {
      run: ({ runner, command }) => {
        applySpriteTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applySpriteTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    showIrlImage: {
      run: ({ runner, command }) => {
        applyShowIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyShowIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    moveIrlImage: {
      run: ({ runner, command }) => {
        applyIrlImageTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyIrlImageTransform(runner.state.sprites, command.id, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    clearIrlImage: {
      run: ({ runner, command }) => {
        applyClearIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl");
        runner.advanceCommand();
      },
      instant: ({ runner, command }) => {
        applyClearIrlImage(runner.state.sprites, command);
        runner.projectSurface("irl", { instant: true });
        runner.advanceCommand();
      }
    },
    lineBlock: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        runner.recordLineHistory(command.lines ?? [], "irl");
        renderer.showLineBlock(command, {
          characters: runner.characters,
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        renderer.renderLineBlockInstant(command, { characters: runner.characters });
        runner.advanceCommand();
      }
    }
  }
});
