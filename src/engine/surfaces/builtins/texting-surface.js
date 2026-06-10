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

export const TEXTING_SURFACE = defineSurfaceModule({
  id: "texting",
  phoneApp: {
    label: "Messages",
    icon: "M"
  },
  renderer: {
    surface: "texting",
    commands: ["textBlock", "thread", ...SHARED_RENDERER_COMMANDS],
    projections: ["renderTextingState"]
  },
  commands: {
    textBlock: { kind: "render", surface: "texting", needsSurface: true, blocks: true },
    thread: { kind: "render", surface: "texting", needsSurface: true }
  },
  state: {
    create: () => createVisualState().texting,
    normalize: (value) => normalizeVisualState({ texting: value }).texting,
    clone: (value) => cloneVisualState({ texting: value }).texting,
    project: ({ renderer, state, context }) => {
      renderer?.renderTextingState?.(state, {
        characters: context.characters
      });
    }
  },
  handlers: {
    textBlock: {
      run: ({ runner, renderer, command }) => {
        runner.beginReadableBeat();
        runner.compositor.hideNarration();
        runner.isWaitingForPlayer = true;
        const renderedTexts = appendTextMessages(runner.state.visuals, command.texts ?? []);
        runner.recordMessageHistory(command.texts ?? [], "texting");
        renderer.showTextBlock({ ...command, texts: renderedTexts }, {
          characters: runner.characters,
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
        const renderedTexts = appendTextMessages(runner.state.visuals, command.texts ?? []);
        renderer.renderTextBlockInstant({ ...command, texts: renderedTexts }, { characters: runner.characters });
        runner.advanceCommand();
      }
    },
    thread: {
      run: ({ runner, renderer, command }) => {
        const contact = runner.resolveThreadContact(command);
        const currentContact = runner.state.visuals.texting?.contact;
        const shouldNotify = Boolean(
          currentContact?.id &&
          currentContact.id !== contact.id &&
          (runner.state.visuals.texting?.messages?.length ?? 0) > 0 &&
          !runner.reconstructing
        );

        if (!shouldNotify) {
          setTextingThread(runner.state.visuals, contact);
          renderer.setThread?.(contact);
          runner.advanceCommand();
          return;
        }

        const openThread = () => {
          setTextingThread(runner.state.visuals, contact);
          runner.markTextThreadRead?.(contact.id ?? contact.name);
          renderer.setThread?.(contact);
          runner.blockingInput = false;
          runner.isWaitingForPlayer = false;
          runner.advanceCommand();
          runner.save();
          runner.runUntilBlocked();
        };

        if (typeof renderer.showThreadNotification !== "function") {
          setTextingThread(runner.state.visuals, contact);
          renderer.setThread?.(contact);
          runner.advanceCommand();
          return;
        }

        runner.isWaitingForPlayer = true;
        runner.blockingInput = true;
        runner.markTextThreadUnread?.(contact, {
          preview: runner.previewIncomingText?.(runner.scene, runner.state.currentCommandIndex + 1, contact.id),
          pendingCommandIndex: runner.state.currentCommandIndex
        });
        renderer.showThreadNotification(contact, { onSelect: openThread });
      },
      instant: ({ runner, renderer, command }) => {
        const contact = runner.resolveThreadContact(command);
        setTextingThread(runner.state.visuals, contact);
        renderer.setThread?.(contact);
        runner.advanceCommand();
      }
    }
  }
});
