// =============================================================================
// vn.js — the writer's import. One line at the top of a scene brings in the
// whole "Programming for English Majors" vocabulary. See
// docs/PROGRAMMING_FOR_ENGLISH_MAJORS.md.
// =============================================================================

export {
  // Structure
  scene,
  useCharacter,
  character,
  // Stages & layers
  surface,
  stage,
  open,
  close,
  pushSurface,
  popSurface,
  background,
  flash,
  shake,
  // Speaking
  say,
  narrate,
  narration,
  dialogue,
  lineBlock,
  line,
  // Sprites (irl)
  show,
  hide,
  hideAll,
  clearStage,
  expression,
  move,
  cg,
  clearCg,
  image,
  moveImage,
  clearImage,
  music,
  stopMusic,
  ambience,
  audioScene,
  stopAmbience,
  sound,
  voice,
  // Choices & flow
  choice,
  goto,
  jump,
  mark,
  label,
  pause,
  endScene,
  // State
  set,
  inc,
  add,
  setFlag,
  clearFlag,
  roll,
  condition,
  // Texting extras
  thread,
  block,
  text,
  textImage,
  photo,
  reply,
  // Streaming extras
  streamLayout,
  streamImage,
  streamTitle,
  streamWindow,
  streamChat,
  streamChatBlock,
  streamNarration,
  streamSystem,
  streamPost,
  // End-of-scene / chapter button
  transition
} from "../engine/commands.js";

// Text markup: register your own {macro} → CSS class. Built-ins (b/i/u/s/color)
// always work; define the class for any custom macro in styles.css.
export { registerMarkup } from "../engine/markup.js";
