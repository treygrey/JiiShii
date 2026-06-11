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
} from "../../state/sprite-state.js";
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
} from "../../state/visual-state.js";
import {
  createGalleryState,
  createSocialState,
  normalizeGalleryState,
  normalizePhoneState,
  normalizeSocialState
} from "../../state/phone-state.js";

export const STREAMING_SURFACE = defineSurfaceModule({
  id: "streaming",
  kind: "story",
  renderer: {
    surface: "streaming",
    commands: [
      "streamLayout",
      "streamImage",
      "streamChatBlock",
      "streamNarration",
      "streamTitle",
      "streamWindow",
      "streamSystem",
      "streamPost",
      ...SHARED_RENDERER_COMMANDS
    ],
    projections: ["renderStreamingState"]
  },
  commands: {
    streamLayout: { kind: "render", surface: "streaming", needsSurface: true },
    streamImage: { kind: "render", surface: "streaming", needsSurface: true, blocks: true },
    streamChatBlock: { kind: "render", surface: "streaming", needsSurface: true },
    streamNarration: { kind: "render", surface: "streaming", needsSurface: true, blocks: true },
    streamTitle: { kind: "render", surface: "streaming", needsSurface: true },
    streamWindow: { kind: "render", surface: "streaming", needsSurface: true },
    streamSystem: { kind: "render", surface: "streaming", needsSurface: true },
    streamPost: { kind: "render", surface: "streaming", needsSurface: true }
  },
  state: {
    create: () => createVisualState().streaming,
    normalize: (value) => normalizeVisualState({ streaming: value }).streaming,
    clone: (value) => cloneVisualState({ streaming: value }).streaming,
    project: ({ renderer, state }) => {
      renderer?.renderStreamingState?.(state);
    }
  },
  handlers: {
    streamLayout: {
      run: ({ runner, renderer, command }) => {
        setStreamLayoutState(runner.state.visuals, command);
        renderer.setStreamLayout(command);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamLayoutState(runner.state.visuals, command);
        renderer.setStreamLayout(command);
        runner.advanceCommand();
      }
    },
    streamImage: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
        renderer.showStreamImage(command, {
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
            if (!runner.maybeAutoAdvanceToDecision()) {
              runner.onIdle();
            }
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, { state: "live", image: command.image });
        renderer.renderStreamImageInstant(command);
        runner.advanceCommand();
      }
    },
    streamChatBlock: {
      run: ({ runner, renderer, command }) => {
        if (!command.concurrent) {
          runner.beginReadableBeat();
          runner.compositor.hideNarration();
          runner.isWaitingForPlayer = true;
        }
        appendStreamChat(runner.state.visuals, command.messages ?? []);
        runner.recordMessageHistory(command.messages ?? [], "streaming");
        renderer.showStreamChatBlock(command, {
          onComplete: () => {
            if (!command.concurrent) {
              runner.advanceCommand();
              runner.save();
              if (!runner.maybeAutoAdvanceToDecision()) {
                runner.onIdle();
              }
            }
          }
        });
        if (command.concurrent) {
          runner.advanceCommand();
          runner.save();
        }
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, command.messages ?? []);
        renderer.renderStreamChatBlockInstant(command);
        runner.advanceCommand();
      }
    },
    streamNarration: {
      run: ({ runner, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        runner.recordHistory({
          kind: "narration",
          message: command.message,
          surface: "streaming"
        });
        runner.compositor.showNarration(command, {
          onComplete: () => {
            runner.advanceCommand();
            runner.save();
            if (!runner.maybeAutoAdvanceToDecision()) {
              runner.onIdle();
            }
          }
        });
      },
      instant: ({ runner, renderer, command }) => {
        renderer.renderStreamNarrationInstant(command);
        runner.advanceCommand();
      }
    },
    streamTitle: {
      run: ({ runner, renderer, command }) => {
        setStreamTitleState(runner.state.visuals, command.text);
        renderer.setStreamTitle?.(command.text);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamTitleState(runner.state.visuals, command.text);
        renderer.setStreamTitle?.(command.text);
        runner.advanceCommand();
      }
    },
    streamWindow: {
      run: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, command);
        renderer.setStreamWindow?.(command);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        setStreamWindowState(runner.state.visuals, command);
        renderer.setStreamWindow?.(command);
        runner.advanceCommand();
      }
    },
    streamSystem: {
      run: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "system", text: command.text }]);
        runner.recordHistory({
          kind: "system",
          message: command.text,
          surface: "streaming"
        });
        renderer.addStreamSystem?.(command.text);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "system", text: command.text }]);
        renderer.addStreamSystem?.(command.text);
        runner.advanceCommand();
      }
    },
    streamPost: {
      run: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "post", message: command.message }]);
        runner.recordHistory({
          kind: "post",
          speaker: "me",
          name: "Player",
          side: "right",
          message: command.message,
          surface: "streaming"
        });
        renderer.addStreamPost?.(command.message);
        runner.advanceCommand();
      },
      instant: ({ runner, renderer, command }) => {
        appendStreamChat(runner.state.visuals, [{ kind: "post", message: command.message }]);
        renderer.addStreamPost?.(command.message);
        runner.advanceCommand();
      }
    }
  }
});
