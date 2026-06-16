// =============================================================================
// Scene validator — the loud half of "unfuckupable". Walks every scene at
// startup and refuses to run if something's wrong, in plain-English (the TA
// voice from docs/PROGRAMMING_FOR_ENGLISH_MAJORS.md).
//
// Two passes:
//   1. Per-command checks — unknown character ids, dead goto/transition targets,
//      mark/scene collisions, duplicate marks, the "name but no line" slip,
//      showIf vars never set, unknown outfits/expressions, empty lines.
//   2. Surface pass — a linear (array-order) simulation of stage()/open()/close()
//      that flags rendering before a stage is set, commands on the wrong surface,
//      and unbalanced layers. Unambiguous structural breaks are errors; anything
//      a branch could legitimately explain is a warning (a false error that
//      blocks boot is worse than no check). Missing art is always a warning.
// =============================================================================

import { parseShowIf } from "../state/showif.js";
import { createCommandMeta, requiredSurface, needsSurface } from "../command-meta.js";
import { createSurfaceRegistry } from "../surfaces/index.js";
import {
  hasIrlPositionPreset,
  hasIrlTransitionPreset,
  listIrlPositionPresets,
  listIrlTransitionPresets
} from "../dom/irl-stage-direction.js";
import {
  hasBackgroundTransitionPreset,
  listBackgroundTransitionPresets
} from "../dom/background-transitions.js";
import { didYouMean } from "./suggestions.js";
import { MEDIA_FITS, MEDIA_LAYERS, VIDEO_MODES } from "../state/media-state.js";

const PLAYER_ALIASES = new Set(["me", "you", "player"]);
const IRL_IMAGE_FITS = new Set(MEDIA_FITS);
const IRL_MEDIA_LAYERS = new Set(MEDIA_LAYERS.filter((layer) => layer !== "background" && layer !== "characters"));
const NOOP_LIST = () => [];
const NOOP_RESOLVE = () => null;

/**
 * A scene's validation mode. Explicit `mode` wins; otherwise scenes whose id
 * mentions demo/prototype/test are quarantined as "test" so their intentional
 * weirdness doesn't drown out real warnings in production scenes.
 *
 * @param {object} scene - Scene definition.
 * @returns {"production"|"prototype"|"test"}
 */
function sceneMode(scene) {
  if (scene.mode) {
    return scene.mode;
  }
  return /(demo|prototype|test)/i.test(scene.id) ? "test" : "production";
}

/**
 * Collects every variable name that is set anywhere in the project.
 *
 * @param {object} registry - Scene registry.
 * @returns {Set<string>} Names that get set somewhere.
 */
function collectSetVars(registry) {
  const names = new Set();
  for (const scene of Object.values(registry)) {
    for (const command of scene.script ?? []) {
      if (
        command.type === "setFlag" ||
        command.type === "setVar" ||
        command.type === "roll" ||
        command.type === "input"
      ) {
        names.add(command.key);
      }
      if (command.type === "setSaveVar") {
        names.add(`save:${command.key}`);
      }
      if (command.type === "persistFlag") {
        names.add(`persistent:${command.key}`);
      }
      if (command.type === "choice") {
        for (const option of command.options ?? []) {
          for (const key of Object.keys(option.set ?? {})) names.add(key);
          for (const key of Object.keys(option.flags ?? {})) names.add(key);
        }
      }
    }
  }
  return names;
}

/**
 * Collects author-created ids that later commands may reference.
 *
 * @param {object} registry - Scene registry.
 * @returns {{ galleryIds: Set<string>, galleryTags: Set<string>, socialPostIds: Set<string> }} Known authored ids.
 */
function collectAuthoredPhoneIds(registry) {
  const galleryIds = new Set();
  const galleryTags = new Set();
  const socialPostIds = new Set();
  for (const scene of Object.values(registry)) {
    for (const command of scene.script ?? []) {
      if (command.type === "saveGalleryImage") {
        if (typeof command.id === "string" && command.id.trim()) {
          galleryIds.add(command.id);
        }
        for (const tag of command.tags ?? []) {
          if (typeof tag === "string" && tag.trim()) {
            galleryTags.add(tag);
          }
        }
      }
      if (command.type === "socialPost" && typeof command.id === "string" && command.id.trim()) {
        socialPostIds.add(command.id);
      }
    }
  }
  return { galleryIds, galleryTags, socialPostIds };
}

/**
 * Validates every scene in the registry.
 *
 * @param {object} registry - Scene registry.
 * @param {object} [options] - Validation options.
 * @param {Array<object>} [options.surfaceModules] - Registered surface modules.
 * @param {Function} [options.resolveImage] - Image resolver override for tests/tools.
 * @param {Function} [options.resolveImageAmbiguity] - Image ambiguity resolver override for tests/tools.
 * @param {Function} [options.listImageIds] - Image id lister override for tests/tools.
 * @param {Function} [options.resolveAudio] - Audio resolver override for tests/tools.
 * @param {Function} [options.resolveAudioAmbiguity] - Audio ambiguity resolver override for tests/tools.
 * @param {Function} [options.listAudioIds] - Audio id lister override for tests/tools.
 * @param {Function} [options.resolveExpression] - Sprite expression resolver.
 * @param {Function} [options.listExpressions] - Sprite expression lister.
 * @param {Function} [options.listOutfits] - Sprite outfit lister.
 * @param {Function} [options.listBodies] - Sprite body lister.
 * @param {Function} [options.listMissingRequiredSpriteLayers] - Required sprite-layer checker.
 * @param {Record<string, object>} [options.globalCharacters] - Game character defaults.
 * @param {Record<string, object>} [options.audioScenes] - Audio scene presets.
 * @returns {{ errors: string[], warnings: string[], testWarnings: string[] }}
 */
export function validateScenes(registry, options = {}) {
  const errors = [];
  const warnings = [];
  const testWarnings = []; // quarantined findings from demo/prototype/test scenes
  const sceneIds = new Set(Object.keys(registry));
  const setVars = collectSetVars(registry);
  const authoredPhoneIds = collectAuthoredPhoneIds(registry);
  const globalCharacters = options.globalCharacters ?? {};
  const globalIds = new Set([...Object.keys(globalCharacters), ...PLAYER_ALIASES]);
  const commandMeta = createCommandMeta(options.surfaceModules);
  const surfaceRegistry = createSurfaceRegistry(options.surfaceModules);
  const surfaceIds = new Set(surfaceRegistry.keys());
  const phoneAppIds = new Set([...surfaceRegistry.values()]
    .filter((surface) => surface.phoneApp)
    .map((surface) => surface.id));

  for (const scene of Object.values(registry)) {
    // Test scenes are a sandbox: nothing they report blocks the boot, and their
    // findings are grouped away from real ones. Production/prototype errors block.
    const isTest = sceneMode(scene) === "test";
    const ctx = {
      sceneIds,
      setVars,
      globalIds,
      commandMeta,
      surfaceRegistry,
      surfaceIds,
      phoneAppIds,
      resolveImage: options.resolveImage ?? NOOP_RESOLVE,
      resolveImageAmbiguity: options.resolveImageAmbiguity ?? NOOP_RESOLVE,
      listImageIds: options.listImageIds ?? NOOP_LIST,
      resolveAudio: options.resolveAudio ?? NOOP_RESOLVE,
      resolveAudioAmbiguity: options.resolveAudioAmbiguity ?? NOOP_RESOLVE,
      listAudioIds: options.listAudioIds ?? NOOP_LIST,
      resolveExpression: options.resolveExpression ?? NOOP_RESOLVE,
      listExpressions: options.listExpressions ?? NOOP_LIST,
      listOutfits: options.listOutfits ?? NOOP_LIST,
      listBodies: options.listBodies ?? NOOP_LIST,
      listMissingRequiredSpriteLayers: options.listMissingRequiredSpriteLayers ?? NOOP_LIST,
      globalCharacters,
      authoredPhoneIds,
      audioScenes: options.audioScenes ?? {},
      videoAssets: options.videoAssets ?? null,
      errors: isTest ? testWarnings : errors,
      warnings: isTest ? testWarnings : warnings
    };
    validateScene(scene, ctx);
    validateSurfaces(scene, ctx);
  }
  return { errors, warnings, testWarnings };
}

/**
 * Per-command checks.
 *
 * @param {object} scene - Scene definition.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateScene(scene, ctx) {
  const where = `Scene "${scene.id}"`;
  const script = scene.script ?? [];

  // Marks (with duplicate detection) and speakable ids.
  const marks = new Set();
  const seenMarks = new Set();
  for (const command of script) {
    if (command.type === "label" && command.id) {
      if (seenMarks.has(command.id)) {
        ctx.errors.push(`${where}: mark("${command.id}") is defined more than once. goto("${command.id}") would be ambiguous — rename one.`);
      }
      seenMarks.add(command.id);
      marks.add(command.id);
    }
  }
  const castIds = new Set((scene.cast ?? []).map((id) => (PLAYER_ALIASES.has(id) ? "player" : id)));
  for (const declaration of scene.characters ?? []) castIds.add(declaration.id);
  const knownSpeakers = new Set([...castIds, ...ctx.globalIds]);
  const speakerList = [...new Set([...castIds, ...Object.keys(ctx.globalCharacters)])];

  for (const mark of marks) {
    if (ctx.sceneIds.has(mark)) {
      ctx.errors.push(`${where}: mark "${mark}" has the same name as a scene. Rename one so goto("${mark}") is unambiguous.`);
    }
  }

  const resolveTarget = (target) => marks.has(target) || ctx.sceneIds.has(target);
  const alias = (id) => (PLAYER_ALIASES.has(id) ? "player" : id);
  const hasArt = (id) => ctx.listExpressions(id).length > 0 || ctx.listOutfits(id).length > 0 || ctx.listBodies(id).length > 0;

  // Track which shown characters ever get an outfit, to flag bodyless sprites.
  const shownChars = new Set();
  const outfittedChars = new Set();

  for (const command of script) {
    if (!command?.type || !ctx.commandMeta[command.type]) {
      const type = command?.type ?? "(missing type)";
      ctx.errors.push(`${where}: unknown command "${type}".${didYouMean(type, Object.keys(ctx.commandMeta))} Check for a typo or add command metadata before using it.`);
      continue;
    }

    switch (command.type) {
      case "say": {
        validateNonEmptyArray(command.lines, `${where}: say() needs at least one line.`, ctx);
        if (command.speaker != null && !knownSpeakers.has(command.speaker)) {
          ctx.errors.push(`${where}: say("${command.speaker}", …) — no character "${command.speaker}".${didYouMean(command.speaker, speakerList)} Cast: ${[...castIds].join(", ") || "(none)"}.`);
        }
        if (command.speaker == null && command.lines?.length === 1 && knownSpeakers.has(command.lines[0])) {
          ctx.errors.push(`${where}: say("${command.lines[0]}") looks like a character with no line. Did you mean say("${command.lines[0]}", "…")?`);
        }
        // Empty / whitespace-only lines.
        if ((command.lines ?? []).some((line) => typeof line === "string" && line.trim() === "")) {
          ctx.warnings.push(`${where}: a say(${command.speaker ? `"${command.speaker}"` : ""}) has an empty line.`);
        }
        // Expression on a speaker that has sprite art.
        if (command.expression && command.speaker) {
          const id = alias(command.speaker);
          if (hasArt(id) && !ctx.resolveExpression(id, command.expression)) {
            ctx.warnings.push(`${where}: say("${command.speaker}", …, { expression: "${command.expression}" }) — "${id}" has no such expression.${didYouMean(command.expression, ctx.listExpressions(id))}`);
          }
        }
        break;
      }
      case "dialogue":
        validateRequiredString(command.id, `${where}: dialogue() needs a speaker id.`, ctx);
        validateRequiredString(command.message, `${where}: dialogue("${command.id ?? ""}") needs a line.`, ctx);
        if (command.id != null && !knownSpeakers.has(command.id)) {
          ctx.errors.push(`${where}: dialogue("${command.id}", …) — no character "${command.id}".${didYouMean(command.id, speakerList)}`);
        }
        break;
      case "showCharacter": {
        validateRequiredString(command.id, `${where}: show() needs a character id.`, ctx);
        const id = alias(command.id);
        if (command.id != null && !knownSpeakers.has(command.id)) {
          ctx.errors.push(`${where}: show("${command.id}", …) — no character "${command.id}".${didYouMean(command.id, speakerList)}`);
          break;
        }
        shownChars.add(id);
        if (command.outfit) {
          outfittedChars.add(id);
          if (hasArt(id) && !ctx.listOutfits(id).includes(command.outfit)) {
            ctx.warnings.push(`${where}: show("${command.id}", { outfit: "${command.outfit}" }) — "${id}" has no such outfit.${didYouMean(command.outfit, ctx.listOutfits(id))} Available: ${ctx.listOutfits(id).join(", ") || "(none)"}.`);
          }
        }
        if (command.expression && hasArt(id) && !ctx.resolveExpression(id, command.expression)) {
          ctx.warnings.push(`${where}: show("${command.id}", { expression: "${command.expression}" }) — "${id}" has no such expression.${didYouMean(command.expression, ctx.listExpressions(id))}`);
        }
        if (command.body && hasArt(id) && !ctx.listBodies(id).includes(command.body)) {
          ctx.warnings.push(`${where}: show("${command.id}", { body: "${command.body}" }) - "${id}" has no such body.${didYouMean(command.body, ctx.listBodies(id))} Available: ${ctx.listBodies(id).join(", ") || "(none)"}.`);
        }
        validateRequiredSpriteLayers(command, id, where, ctx);
        validateIrlDirectionOptions(command, where, ctx);
        break;
      }
      case "hideCharacter":
      case "hideAllCharacters":
      case "clearIrlStage":
        validateIrlDirectionOptions(command, where, ctx);
        break;
      case "setCharacterExpression": {
        validateRequiredString(command.id, `${where}: expression() needs a character id.`, ctx);
        validateRequiredString(command.expression, `${where}: expression("${command.id ?? ""}") needs an expression id.`, ctx);
        const id = alias(command.id);
        if (command.id != null && !knownSpeakers.has(command.id)) {
          ctx.errors.push(`${where}: expression("${command.id}", ...) - no character "${command.id}".${didYouMean(command.id, speakerList)}`);
          break;
        }
        if (command.expression && hasArt(id) && !ctx.resolveExpression(id, command.expression)) {
          ctx.warnings.push(`${where}: expression("${command.id}", "${command.expression}") - "${id}" has no such expression.${didYouMean(command.expression, ctx.listExpressions(id))}`);
        }
        validateIrlDirectionOptions(command, where, ctx);
        break;
      }
      case "moveCharacter":
        validateRequiredString(command.id, `${where}: move() needs a character id.`, ctx);
        if (command.id != null && !knownSpeakers.has(command.id)) {
          ctx.errors.push(`${where}: move("${command.id}", ...) - no character "${command.id}".${didYouMean(command.id, speakerList)}`);
        }
        validateIrlDirectionOptions(command, where, ctx);
        break;
      case "showIrlImage":
        validateRequiredString(command.asset, `${where}: ${command.kind === "cg" ? "cg" : "image"}() needs an asset id.`, ctx);
        if (command.kind === "video") {
          validateVideoAsset(ctx, where, "media", command.asset);
        } else {
          validateImageAsset(ctx, where, command.kind === "cg" ? "cg" : "image", command.asset);
        }
        validateIrlDirectionOptions(command, where, ctx);
        validateIrlImageFit(command, where, ctx);
        validateVideoOptions(command, where, ctx);
        break;
      case "moveIrlImage":
        validateRequiredString(command.id, `${where}: moveImage() needs an image displayable id.`, ctx);
        validateIrlDirectionOptions(command, where, ctx);
        validateIrlImageFit(command, where, ctx);
        break;
      case "clearIrlImage":
        validateIrlDirectionOptions(command, where, ctx);
        break;
      case "textBlock":
        validateNonEmptyArray(command.texts, `${where}: block() needs at least one text/photo item.`, ctx);
        for (const item of command.texts ?? []) {
          if (!item?.kind) {
            ctx.errors.push(`${where}: block() contains an item with no kind.`);
            continue;
          }
          if (item.kind === "image") {
            validateRequiredString(item.image, `${where}: textImage() needs an image asset id.`, ctx);
            validateImageAsset(ctx, where, "textImage", item.image);
          }
        }
        break;
      case "streamImage":
        validateRequiredString(command.image, `${where}: streamImage() needs an image asset id.`, ctx);
        validateImageAsset(ctx, where, "streamImage", command.image);
        validateIrlImageFit(command, where, ctx);
        break;
      case "streamVideo":
        validateRequiredString(command.video, `${where}: streamVideo() needs a video asset id.`, ctx);
        validateVideoAsset(ctx, where, "streamVideo", command.video);
        validateStreamVideoMode(command, where, ctx);
        validateIrlImageFit(command, where, ctx);
        validateVideoOptions(command, where, ctx);
        if (command.mode === "replace") {
          validateRequiredString(command.image, `${where}: streamVideo({ mode: "replace" }) needs an image asset id.`, ctx);
          validateImageAsset(ctx, where, "streamVideo replacement", command.image);
        }
        break;
      case "streamWindow":
        if (command.state === "live") {
          validateRequiredString(command.image, `${where}: streamWindow("live") needs an image asset id.`, ctx);
          validateImageAsset(ctx, where, "streamWindow", command.image);
        }
        break;
      case "goto":
        if (!validateRequiredString(command.target, `${where}: goto() needs a target.`, ctx)) {
          break;
        }
        if (!resolveTarget(command.target)) {
          ctx.errors.push(`${where}: goto("${command.target}") — no mark here and no scene with that id.${didYouMean(command.target, [...marks, ...ctx.sceneIds])} Marks: ${[...marks].join(", ") || "(none)"}.`);
        }
        break;
      case "choice":
        validateNonEmptyArray(command.options, `${where}: choice() needs at least one option.`, ctx);
        validateChoiceId(command, where, ctx);
        validateChoiceTargets(command, where, ctx);
        for (const option of command.options ?? []) {
          validateRequiredString(option?.text, `${where}: choice option needs text.`, ctx);
          const target = option.goto ?? option.jump;
          if (target && !resolveTarget(target)) {
            ctx.errors.push(`${where}: a choice's goto("${target}") — no mark here and no scene with that id.${didYouMean(target, [...marks, ...ctx.sceneIds])}`);
          }
          if (option.showIf != null && typeof option.showIf === "string") {
            const parsed = parseShowIf(option.showIf);
            // `persistent:` names read cross-playthrough flags, which can be
            // set by other games sessions or other scripts — not statically
            // checkable, so they are exempt from the never-set check.
            if (parsed && !parsed.name.startsWith("persistent:") && !ctx.setVars.has(parsed.name)) {
              ctx.errors.push(`${where}: showIf "${option.showIf}" mentions "${parsed.name}", which is never set anywhere.${didYouMean(parsed.name, [...ctx.setVars])}`);
            }
          }
        }
        break;
      case "transition":
        if (command.target && !ctx.sceneIds.has(command.target) && !marks.has(command.target)) {
          ctx.errors.push(`${where}: a Continue button points to "${command.target}", which is not a scene or a mark.${didYouMean(command.target, [...ctx.sceneIds, ...marks])}`);
        }
        break;
      case "background":
        validateRequiredString(command.id, `${where}: background() needs an image asset id.`, ctx);
        validateImageAsset(ctx, where, "background", command.id);
        validateBackgroundTransition(command, where, ctx);
        validateOptionalDuration(command.duration, `${where}: background() duration`, ctx);
        validateIrlImageFit(command, where, ctx);
        break;
      case "music":
      case "ambience":
      case "sound":
      case "voice":
        validateRequiredString(command.id, `${where}: ${command.type}() needs an audio asset id.`, ctx);
        if (command.id) {
          validateAudioAsset(ctx, where, command.type, command.id);
        }
        validateAudioOptions(command, where, ctx);
        break;
      case "audioScene":
        validateRequiredString(command.id, `${where}: audioScene() needs a preset id.`, ctx);
        if (command.id) {
          validateAudioScene(command, where, ctx);
        }
        validateOptionalDuration(command.transition, `${where}: audioScene() transition`, ctx);
        validateAudioOptions(command, where, ctx);
        break;
      case "stopMusic":
      case "stopAmbience":
        validateOptionalDuration(command.fadeOut, `${where}: ${command.type}() fadeOut`, ctx);
        break;
      case "stopSound":
        validateRequiredString(command.id, `${where}: stopSound() needs a sound handle.`, ctx);
        validateOptionalDuration(command.fadeOut, `${where}: stopSound() fadeOut`, ctx);
        break;
      case "pause":
        validateOptionalDuration(command.duration, `${where}: pause() duration`, ctx);
        break;
      case "flash":
        validateOptionalDuration(command.duration, `${where}: flash() duration`, ctx);
        break;
      case "shake":
        validateOptionalDuration(command.duration, `${where}: shake() duration`, ctx);
        validateOptionalNumber(command.intensity, `${where}: shake() intensity`, ctx, { min: 0 });
        break;
      case "condition":
        validateConditionCommand(command, where, marks, resolveTarget, ctx);
        break;
      case "label":
        validateRequiredString(command.id, `${where}: mark()/label() needs a name.`, ctx);
        break;
      case "setFlag":
      case "setVar":
      case "setSaveVar":
      case "roll":
      case "persistFlag":
        validateRequiredString(command.key, `${where}: ${command.type} needs a variable name.`, ctx);
        if (command.type === "roll") {
          validateRollRange(command, where, ctx);
        }
        break;
      case "input":
        validateRequiredString(command.key, `${where}: input() needs a variable name to store the answer in.`, ctx);
        validateOptionalNumber(command.maxLength, `${where}: input() maxLength`, ctx, { min: 1 });
        break;
      case "video":
        validateRequiredString(command.id, `${where}: video() needs a video asset id.`, ctx);
        validateVideoAsset(ctx, where, "video", command.id);
        validateStreamVideoMode(command, where, ctx);
        validateVideoOptions(command, where, ctx);
        break;
      case "phoneApps":
        if (!Array.isArray(command.apps)) {
          ctx.errors.push(`${where}: phoneApps() needs an array of app ids.`);
          break;
        }
        for (const app of command.apps) {
          validatePhoneAppId(app, `${where}: phoneApps()`, ctx, { allowHome: false });
        }
        break;
      case "phoneNotify":
        validatePhoneAppId(command.app, `${where}: phoneNotify()`, ctx, { allowHome: false });
        break;
      case "clearPhoneNotify":
        validatePhoneAppId(command.app, `${where}: clearPhoneNotify()`, ctx, { allowHome: false });
        break;
      case "openPhone":
        validatePhoneAppId(command.app ?? "home", `${where}: openPhone()`, ctx);
        break;
      case "setWallpaper":
        if (command.image != null) {
          validateRequiredString(command.image, `${where}: setWallpaper() needs an image asset id or null.`, ctx);
          validateImageAsset(ctx, where, "setWallpaper", command.image);
        }
        break;
      case "saveGalleryImage":
        validateRequiredString(command.id, `${where}: saveGalleryImage() needs a gallery entry id.`, ctx);
        validateRequiredString(command.image, `${where}: saveGalleryImage("${command.id ?? ""}") needs an image asset id.`, ctx);
        validateImageAsset(ctx, where, "saveGalleryImage", command.image);
        validateGalleryTags(command, where, ctx);
        break;
      case "removeGalleryImage":
        validateRequiredString(command.id, `${where}: removeGalleryImage() needs a gallery entry id.`, ctx);
        if (command.id && !ctx.authoredPhoneIds.galleryIds.has(command.id)) {
          ctx.warnings.push(`${where}: removeGalleryImage("${command.id}") does not match any saveGalleryImage() id.${didYouMean(command.id, [...ctx.authoredPhoneIds.galleryIds])}`);
        }
        break;
      case "socialPost":
        validateRequiredString(command.id, `${where}: socialPost() needs a post id.`, ctx);
        if (command.poster != null && !knownSpeakers.has(command.poster)) {
          ctx.warnings.push(`${where}: socialPost("${command.id ?? ""}") poster "${command.poster}" is not a known character.${didYouMean(command.poster, speakerList)}`);
        }
        if (command.image != null) {
          validateRequiredString(command.image, `${where}: socialPost("${command.id ?? ""}") image must be an image asset id.`, ctx);
          validateImageAsset(ctx, where, "socialPost", command.image);
        }
        break;
      case "socialFollow":
        validateRequiredString(command.poster, `${where}: socialFollow() needs a poster id.`, ctx);
        if (command.poster != null && !knownSpeakers.has(command.poster)) {
          ctx.warnings.push(`${where}: socialFollow("${command.poster}") is not a known character.${didYouMean(command.poster, speakerList)}`);
        }
        break;
      case "socialLike":
        validateRequiredString(command.id, `${where}: socialLike() needs a post id.`, ctx);
        if (command.id && !ctx.authoredPhoneIds.socialPostIds.has(command.id)) {
          ctx.warnings.push(`${where}: socialLike("${command.id}") does not match any socialPost() id.${didYouMean(command.id, [...ctx.authoredPhoneIds.socialPostIds])}`);
        }
        break;
      case "call":
        validateRequiredString(command.contact, `${where}: call() needs a contact id.`, ctx);
        if (command.contact != null && !knownSpeakers.has(command.contact)) {
          ctx.warnings.push(`${where}: call("${command.contact}") is not a known character.${didYouMean(command.contact, speakerList)}`);
        }
        break;
      case "endCall":
        break;
      case "voicemail":
        validateRequiredString(command.id, `${where}: voicemail() needs a voicemail id.`, ctx);
        validateRequiredString(command.contact, `${where}: voicemail("${command.id ?? ""}") needs a contact id.`, ctx);
        if (command.contact != null && !knownSpeakers.has(command.contact)) {
          ctx.warnings.push(`${where}: voicemail("${command.id ?? ""}") contact "${command.contact}" is not a known character.${didYouMean(command.contact, speakerList)}`);
        }
        if (command.audio != null) {
          validateRequiredString(command.audio, `${where}: voicemail("${command.id ?? ""}") audio must be an audio asset id.`, ctx);
          validateAudioAsset(ctx, where, "voicemail", command.audio);
        }
        break;
      default:
        break;
    }
  }

  // A character shown but never given an outfit will render bodyless (the head
  // floats) once art exists, since there's no reliable default outfit.
  for (const id of shownChars) {
    const availableOutfits = ctx.listOutfits(id);
    if (!outfittedChars.has(id) && hasArt(id) && availableOutfits.length > 0) {
      ctx.warnings.push(`${where}: show("${id}") never sets an outfit, so it will render without a body. Add { outfit: "…" } on first show. Outfits: ${availableOutfits.join(", ")}.`);
    }
  }
}

/**
 * Validates a phone app id against registered surface modules.
 *
 * @param {unknown} app - Candidate app id.
 * @param {string} where - Author-facing command label.
 * @param {object} ctx - Validation context.
 * @param {object} [options] - Validation options.
 * @param {boolean} [options.allowHome] - Whether "home" is accepted.
 * @returns {void}
 */
function validatePhoneAppId(app, where, ctx, { allowHome = true } = {}) {
  if (typeof app !== "string" || app.trim().length === 0) {
    ctx.errors.push(`${where} needs a phone app id.`);
    return;
  }
  if (allowHome && app === "home") {
    return;
  }
  if (ctx.phoneAppIds.has(app)) {
    return;
  }
  const known = [...ctx.phoneAppIds];
  if (allowHome) {
    known.unshift("home");
  }
  ctx.errors.push(`${where} uses unknown phone app "${app}".${didYouMean(app, known)} Registered phone apps: ${known.join(", ") || "(none)"}.`);
}

/**
 * Warns when a sprite recipe requires an art layer that the current request
 * cannot resolve.
 *
 * @param {object} command - show() command.
 * @param {string} id - Normalized character id.
 * @param {string} where - Scene label.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateRequiredSpriteLayers(command, id, where, ctx) {
  const character = ctx.globalCharacters[id] ?? {};
  const missing = ctx.listMissingRequiredSpriteLayers(id, {
    outfit: command.outfit ?? character.defaultOutfit ?? "hoodie",
    expression: command.expression ?? character.defaultExpression ?? "neutral",
    body: command.body ?? character.defaultBody ?? "default",
    vars: {}
  });
  for (const layer of missing) {
    ctx.warnings.push(
      `${where}: show("${command.id}") recipe layer "${layer.id}" needs ${layer.source}/${layer.key}.png, but no such sprite art exists yet.`
    );
  }
}

/**
 * Validates a structured branch condition and its flow targets.
 *
 * @param {object} command - Condition command.
 * @param {string} where - Scene label.
 * @param {Set<string>} marks - Local mark ids.
 * @param {Function} resolveTarget - Target existence checker.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateConditionCommand(command, where, marks, resolveTarget, ctx) {
  validateConditionTarget(command.then, "then", where, marks, resolveTarget, ctx);
  validateConditionTarget(command.else, "else", where, marks, resolveTarget, ctx);
  validateConditionPredicate(conditionPredicate(command), where, ctx);
}

/**
 * Converts a condition command into the predicate shape the validator checks.
 *
 * @param {object} command - Condition command.
 * @returns {Function|object|null} Predicate definition.
 */
function conditionPredicate(command) {
  if (command.if !== undefined) {
    return command.if;
  }
  if (command.flag !== undefined) {
    return { flag: command.flag };
  }
  if (command.var !== undefined) {
    const predicate = { var: command.var };
    for (const key of ["is", "isNot", "atLeast", "atMost", "moreThan", "lessThan", "hasText", "op", "value"]) {
      if (key in command) {
        predicate[key] = command[key];
      }
    }
    return predicate;
  }
  return null;
}

/**
 * Validates one structured condition predicate.
 *
 * @param {Function|object|null} predicate - Predicate definition.
 * @param {string} where - Scene label.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateConditionPredicate(predicate, where, ctx) {
  if (typeof predicate === "function") {
    return;
  }
  if (!predicate || typeof predicate !== "object") {
    ctx.errors.push(`${where}: condition() needs a flag, var, or if predicate.`);
    return;
  }
  if (Array.isArray(predicate.any)) {
    validateConditionPredicateList(predicate.any, "any", where, ctx);
    return;
  }
  if (Array.isArray(predicate.all)) {
    validateConditionPredicateList(predicate.all, "all", where, ctx);
    return;
  }
  if ("not" in predicate) {
    validateConditionPredicate(predicate.not, where, ctx);
    return;
  }
  if (predicate.flag !== undefined) {
    validateRequiredString(predicate.flag, `${where}: condition flag must be a non-empty string.`, ctx);
    if (predicate.flag && !ctx.setVars.has(predicate.flag)) {
      ctx.warnings.push(`${where}: condition checks flag "${predicate.flag}", which is never set anywhere.`);
    }
    return;
  }
  if (predicate.var !== undefined) {
    validateRequiredString(predicate.var, `${where}: condition variable must be a non-empty string.`, ctx);
    if (predicate.var && !ctx.setVars.has(predicate.var)) {
      ctx.warnings.push(`${where}: condition checks variable "${predicate.var}", which is never set anywhere.`);
    }
    if (predicate.op && !["=", "==", "===", "!=", "!==", ">", ">=", "<", "<="].includes(predicate.op)) {
      ctx.errors.push(`${where}: condition op "${predicate.op}" is not supported. Use one of =, ==, !=, >, >=, <, <=.`);
    }
    return;
  }
  ctx.errors.push(`${where}: condition() needs a flag, var, or if predicate.`);
}

/**
 * Validates a compound predicate list.
 *
 * @param {Array<object>} entries - Predicate entries.
 * @param {string} key - Compound predicate key.
 * @param {string} where - Scene label.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateConditionPredicateList(entries, key, where, ctx) {
  if (entries.length === 0) {
    ctx.errors.push(`${where}: condition if.${key} needs at least one predicate.`);
    return;
  }
  for (const entry of entries) {
    validateConditionPredicate(entry, where, ctx);
  }
}

/**
 * Validates one condition branch target.
 *
 * @param {string} target - Target label or scene id.
 * @param {string} branchName - Branch field name.
 * @param {string} where - Scene label.
 * @param {Set<string>} marks - Local mark ids.
 * @param {Function} resolveTarget - Target existence checker.
 * @param {object} ctx - Shared validation context.
 * @returns {void}
 */
function validateConditionTarget(target, branchName, where, marks, resolveTarget, ctx) {
  if (!validateRequiredString(target, `${where}: condition() needs a ${branchName} target.`, ctx)) {
    return;
  }
  if (!resolveTarget(target)) {
    ctx.errors.push(`${where}: condition() ${branchName} target "${target}" is not a scene or mark.${didYouMean(target, [...marks, ...ctx.sceneIds])}`);
  }
}

/**
 * Warns about unknown background transition presets.
 *
 * @param {object} command - Background command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateBackgroundTransition(command, where, ctx) {
  if (!command.transition || hasBackgroundTransitionPreset(command.transition)) {
    return;
  }
  const known = listBackgroundTransitionPresets();
  ctx.warnings.push(
    `${where}: background() uses unknown transition "${command.transition}".${didYouMean(command.transition, known)} Available: ${known.join(", ")}.`
  );
}

/**
 * Warns about unknown IRL placement or transition preset names.
 *
 * @param {object} command - IRL sprite command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateIrlDirectionOptions(command, where, ctx) {
  if (command.at && !hasIrlPositionPreset(command.at)) {
    const known = listIrlPositionPresets();
    ctx.warnings.push(
      `${where}: "${command.type}" uses unknown IRL position "${command.at}".${didYouMean(command.at, known)} Available: ${known.join(", ")}.`
    );
  }
  if (command.side && !hasIrlPositionPreset(command.side)) {
    const known = listIrlPositionPresets();
    ctx.warnings.push(
      `${where}: "${command.type}" uses unknown IRL side "${command.side}".${didYouMean(command.side, known)} Available: ${known.join(", ")}.`
    );
  }
  if (command.transition && !hasIrlTransitionPreset(command.transition)) {
    const known = listIrlTransitionPresets();
    ctx.warnings.push(
      `${where}: "${command.type}" uses unknown IRL transition "${command.transition}".${didYouMean(command.transition, known)} Available: ${known.join(", ")}.`
    );
  }
  validateOptionalNumber(command.scale, `${where}: ${command.type}() scale`, ctx, { min: 0.01 });
  validateOptionalNumber(command.alpha, `${where}: ${command.type}() alpha`, ctx, { min: 0, max: 1 });
  validateOptionalNumber(command.z, `${where}: ${command.type}() z`, ctx);
  validateOptionalCssPosition(command.width, `${where}: ${command.type}() width`, ctx);
  validateOptionalCssPosition(command.height, `${where}: ${command.type}() height`, ctx);
  validateOptionalCssPosition(command.x, `${where}: ${command.type}() x`, ctx);
  validateOptionalCssPosition(command.y, `${where}: ${command.type}() y`, ctx);
  validateOptionalDuration(command.duration, `${where}: ${command.type}() duration`, ctx);
  validateOptionalCssEasing(command.easing, `${where}: ${command.type}() easing`, ctx);
  if (command.layer != null && !IRL_MEDIA_LAYERS.has(command.layer)) {
    ctx.errors.push(`${where}: ${command.type}() layer must be one of: ${[...IRL_MEDIA_LAYERS].join(", ")}.`);
  }
}

/**
 * Validates object-fit values for IRL image displayables.
 *
 * @param {object} command - IRL image command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateIrlImageFit(command, where, ctx) {
  if (command.fit == null || IRL_IMAGE_FITS.has(command.fit)) {
    return;
  }
  ctx.errors.push(`${where}: ${command.kind === "cg" ? "cg" : "image"}() fit must be one of: ${[...IRL_IMAGE_FITS].join(", ")}.`);
}

/**
 * Validates authored video mode values.
 *
 * @param {object} command - Video-bearing command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateStreamVideoMode(command, where, ctx) {
  if (command.mode == null || VIDEO_MODES.includes(command.mode)) {
    return;
  }
  ctx.errors.push(`${where}: ${command.type}() mode must be one of: ${VIDEO_MODES.join(", ")}.`);
}

/**
 * Validates shared video timing and volume fields.
 *
 * @param {object} command - Video-bearing command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateVideoOptions(command, where, ctx) {
  validateOptionalDuration(command.startAt, `${where}: ${command.type}() startAt`, ctx);
  validateOptionalDuration(command.endAt, `${where}: ${command.type}() endAt`, ctx);
  validateOptionalNumber(command.volume, `${where}: ${command.type}() volume`, ctx, { min: 0, max: 1 });
  if (Number.isFinite(command.startAt) && Number.isFinite(command.endAt) && command.endAt <= command.startAt) {
    ctx.errors.push(`${where}: ${command.type}() endAt must be greater than startAt.`);
  }
}

/**
 * Validates gallery tags attached to a saved image entry.
 *
 * @param {object} command - saveGalleryImage command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateGalleryTags(command, where, ctx) {
  if (command.tags == null) {
    return;
  }
  if (!Array.isArray(command.tags)) {
    ctx.errors.push(`${where}: saveGalleryImage("${command.id ?? ""}") tags must be an array of strings.`);
    return;
  }
  for (const tag of command.tags) {
    if (typeof tag !== "string" || tag.trim().length === 0) {
      ctx.errors.push(`${where}: saveGalleryImage("${command.id ?? ""}") tags must be non-empty strings.`);
      continue;
    }
    const differentlyCasedTag = [...ctx.authoredPhoneIds.galleryTags]
      .find((known) => known.toLowerCase() === tag.toLowerCase() && known !== tag);
    if (differentlyCasedTag) {
      ctx.warnings.push(`${where}: gallery tag "${tag}" only differs by case from "${differentlyCasedTag}". Use one spelling so the Gallery does not split the same collection.`);
    }
  }
}

/**
 * Reports duplicate authored choice ids, which would make save/debug records
 * ambiguous for authors.
 *
 * @param {object} command - Choice command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateChoiceId(command, where, ctx) {
  if (command.id != null) {
    validateRequiredString(command.id, `${where}: choice() id must be a non-empty string when provided.`, ctx);
  }
}

/**
 * Warns when one choice command has indistinguishable branch destinations.
 *
 * @param {object} command - Choice command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateChoiceTargets(command, where, ctx) {
  const seenTargets = new Set();
  for (const option of command.options ?? []) {
    const target = option?.goto ?? option?.jump;
    if (!target) continue;
    if (seenTargets.has(target)) {
      ctx.warnings.push(`${where}: choice() has more than one option pointing to "${target}". If that is intentional, consider merging the options.`);
    }
    seenTargets.add(target);
  }
}

/**
 * Validates numeric options shared by audio commands.
 *
 * @param {object} command - Audio command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateAudioOptions(command, where, ctx) {
  validateOptionalNumber(command.volume, `${where}: ${command.type}() volume`, ctx, { min: 0, max: 1 });
  validateOptionalDuration(command.fadeIn, `${where}: ${command.type}() fadeIn`, ctx);
  validateOptionalDuration(command.fadeOut, `${where}: ${command.type}() fadeOut`, ctx);
  validateOptionalNumber(command.rate, `${where}: ${command.type}() rate`, ctx, { min: 0.01 });
  validateOptionalDuration(command.duration, `${where}: ${command.type}() duration`, ctx);
  validateOptionalNumber(command.start, `${where}: ${command.type}() start`, ctx, { min: 0 });
  validateOptionalNumber(command.end, `${where}: ${command.type}() end`, ctx, { min: 0 });
  if (command.start != null && command.end != null && command.end <= command.start) {
    ctx.errors.push(`${where}: ${command.type}() end must be greater than start.`);
  }
  if (command.as != null) {
    validateRequiredString(command.as, `${where}: ${command.type}() as must be a non-empty sound handle.`, ctx);
  }
  if (command.handle != null) {
    validateRequiredString(command.handle, `${where}: ${command.type}() handle must be a non-empty sound handle.`, ctx);
  }
  if (command.loop != null && typeof command.loop !== "boolean") {
    ctx.errors.push(`${where}: ${command.type}() loop must be true or false.`);
  }
}

/**
 * Validates an audio scene preset and its referenced durable assets.
 *
 * @param {object} command - audioScene command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateAudioScene(command, where, ctx) {
  const preset = ctx.audioScenes?.[command.id];
  const known = Object.keys(ctx.audioScenes ?? {});
  if (!preset) {
    ctx.errors.push(`${where}: audioScene("${command.id}") has no preset.${didYouMean(command.id, known)} Available: ${known.join(", ") || "(none)"}.`);
    return;
  }
  for (const channel of ["music", "ambience"]) {
    const entry = preset[channel];
    if (entry == null) {
      continue;
    }
    if (!entry || typeof entry !== "object") {
      ctx.errors.push(`${where}: audioScene("${command.id}") ${channel} must be null or an object with an audio id.`);
      continue;
    }
    validateRequiredString(entry.id, `${where}: audioScene("${command.id}") ${channel} needs an audio asset id.`, ctx);
    if (entry.id) {
      validateAudioAsset(ctx, where, `audioScene("${command.id}") ${channel}`, entry.id);
    }
    validateAudioOptions({ ...entry, type: `audioScene("${command.id}") ${channel}` }, where, ctx);
  }
}

/**
 * Validates seeded dice-roll bounds.
 *
 * @param {object} command - Roll command.
 * @param {string} where - Scene label.
 * @param {object} ctx - Validation context.
 * @returns {void}
 */
function validateRollRange(command, where, ctx) {
  const minIsInteger = validateOptionalNumber(command.min, `${where}: roll() min`, ctx, { integer: true, required: true });
  const maxIsInteger = validateOptionalNumber(command.max, `${where}: roll() max`, ctx, { integer: true, required: true });
  if (minIsInteger && maxIsInteger && command.min > command.max) {
    ctx.errors.push(`${where}: roll("${command.key}") min must be less than or equal to max.`);
  }
}

/**
 * Validates a millisecond duration field.
 *
 * @param {unknown} value - Candidate duration.
 * @param {string} label - Author-facing field label.
 * @param {object} ctx - Validation context.
 * @returns {boolean} True when valid or omitted.
 */
function validateOptionalDuration(value, label, ctx) {
  return validateOptionalNumber(value, label, ctx, { min: 0 });
}

/**
 * Validates an optional CSS easing string.
 *
 * @param {unknown} value - Candidate easing value.
 * @param {string} label - Author-facing field label.
 * @param {object} ctx - Validation context.
 * @returns {boolean} True when valid or omitted.
 */
function validateOptionalCssEasing(value, label, ctx) {
  if (value == null) {
    return true;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    ctx.errors.push(`${label} must be a non-empty CSS easing string.`);
    return false;
  }
  return true;
}

/**
 * Validates an optional finite number field.
 *
 * @param {unknown} value - Candidate number.
 * @param {string} label - Author-facing field label.
 * @param {object} ctx - Validation context.
 * @param {object} [rules] - Numeric constraints.
 * @param {number} [rules.min] - Inclusive minimum.
 * @param {number} [rules.max] - Inclusive maximum.
 * @param {boolean} [rules.integer=false] - Whether the value must be an integer.
 * @param {boolean} [rules.required=false] - Whether omission is an error.
 * @returns {boolean} True when valid.
 */
function validateOptionalNumber(value, label, ctx, rules = {}) {
  if (value == null) {
    if (rules.required) {
      ctx.errors.push(`${label} is required.`);
      return false;
    }
    return true;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    ctx.errors.push(`${label} must be a finite number.`);
    return false;
  }
  if (rules.integer && !Number.isInteger(value)) {
    ctx.errors.push(`${label} must be an integer.`);
    return false;
  }
  if (rules.min != null && value < rules.min) {
    ctx.errors.push(`${label} must be at least ${rules.min}.`);
    return false;
  }
  if (rules.max != null && value > rules.max) {
    ctx.errors.push(`${label} must be at most ${rules.max}.`);
    return false;
  }
  return true;
}

/**
 * Validates an optional CSS-position-like value. The renderer supports finite
 * numbers as percentages and non-empty strings as authored CSS values.
 *
 * @param {unknown} value - Candidate position.
 * @param {string} label - Author-facing field label.
 * @param {object} ctx - Validation context.
 * @returns {boolean} True when valid.
 */
function validateOptionalCssPosition(value, label, ctx) {
  if (value == null) {
    return true;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return true;
    }
    ctx.errors.push(`${label} must be a finite number or non-empty CSS string.`);
    return false;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return true;
  }
  ctx.errors.push(`${label} must be a finite number or non-empty CSS string.`);
  return false;
}

/**
 * Warns when an authored image id does not resolve to a registered asset.
 *
 * @param {object} ctx - Validation context.
 * @param {string} where - Scene label.
 * @param {string} label - Author-facing command/item label.
 * @param {string|null} id - Image asset id.
 * @returns {void}
 */
function validateImageAsset(ctx, where, label, id) {
  if (id && !ctx.resolveImage(id)) {
    const explicitIds = ctx.resolveImageAmbiguity(id);
    if (explicitIds) {
      ctx.warnings.push(`${where}: ${label}("${id}") is ambiguous. Use one of: ${explicitIds.join(", ")}.`);
      return;
    }
    ctx.warnings.push(`${where}: ${label}("${id}") has no art yet (placeholder will show).${didYouMean(id, ctx.listImageIds())}`);
  }
}

/**
 * Warns when an authored video id does not resolve to a registered asset.
 *
 * @param {object} ctx - Validation context.
 * @param {string} where - Scene label.
 * @param {string} label - Author-facing command/item label.
 * @param {string|null} id - Video asset id.
 * @returns {void}
 */
function validateVideoAsset(ctx, where, label, id) {
  if (ctx.videoAssets && id && !ctx.videoAssets.has(id)) {
    ctx.errors.push(`${where}: ${label}("${id}") is not a discovered video asset.${didYouMean(id, [...ctx.videoAssets])}`);
  }
}

/**
 * Warns when an authored audio id is missing or ambiguous.
 *
 * @param {object} ctx - Validation context.
 * @param {string} where - Scene label.
 * @param {string} label - Author-facing command label.
 * @param {string} id - Audio asset id.
 * @returns {void}
 */
function validateAudioAsset(ctx, where, label, id) {
  if (ctx.resolveAudio(id)) {
    return;
  }
  const explicitIds = ctx.resolveAudioAmbiguity(id);
  if (explicitIds) {
    ctx.warnings.push(`${where}: ${label}("${id}") is ambiguous. Use one of: ${explicitIds.join(", ")}.`);
    return;
  }
  ctx.warnings.push(`${where}: ${label}("${id}") has no audio asset yet.${didYouMean(id, ctx.listAudioIds())}`);
}

/**
 * Requires a non-empty string field.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} message - Error message.
 * @param {object} ctx - Validation context.
 * @returns {boolean} True when valid.
 */
function validateRequiredString(value, message, ctx) {
  if (typeof value === "string" && value.trim().length > 0) {
    return true;
  }
  ctx.errors.push(message);
  return false;
}

/**
 * Requires a non-empty array field.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} message - Error message.
 * @param {object} ctx - Validation context.
 * @returns {boolean} True when valid.
 */
function validateNonEmptyArray(value, message, ctx) {
  if (Array.isArray(value) && value.length > 0) {
    return true;
  }
  ctx.errors.push(message);
  return false;
}

/**
 * Surface pass: linear simulation of stage()/open()/close() in array order.
 * Accurate for the linear authoring pattern; branch-only surface changes can't
 * be modeled statically, so ambiguous findings stay warnings.
 *
 * @param {object} scene - Scene definition.
 * @param {object} ctx - { errors, warnings }.
 * @returns {void}
 */
function validateSurfaces(scene, ctx) {
  const where = `Scene "${scene.id}"`;
  const script = scene.script ?? [];

  let base = null; // active base surface from the last stage()
  const layers = []; // open() overlay stack on top of the base
  let flaggedNoStage = false;

  const active = () => (layers.length ? layers[layers.length - 1] : base);
  const validateSurfaceId = (id, commandName, { allowApp = false } = {}) => {
    if (typeof id !== "string" || id.trim().length === 0) {
      ctx.errors.push(`${where}: ${commandName}() needs a surface id.`);
      return false;
    }
    if (!ctx.surfaceIds.has(id)) {
      ctx.errors.push(`${where}: ${commandName}("${id}") uses an unknown surface.${didYouMean(id, [...ctx.surfaceIds])} Registered surfaces: ${[...ctx.surfaceIds].join(", ") || "(none)"}.`);
      return false;
    }
    if (!allowApp && ctx.surfaceRegistry.get(id)?.kind === "app") {
      const phoneTarget = id === "phone_home" ? "home" : id;
      ctx.errors.push(`${where}: ${commandName}("${id}") targets phone app surface "${id}". Use openPhone("${phoneTarget}") instead.`);
      return false;
    }
    return true;
  };

  for (const command of script) {
    switch (command.type) {
      case "surface":
        if (!validateSurfaceId(command.id, "stage")) break;
        base = command.id;
        layers.length = 0;
        break;
      case "openLayer":
        if (!validateSurfaceId(command.id, "open")) break;
        layers.push(command.id);
        break;
      case "pushSurface":
        if (!validateSurfaceId(command.id, "pushSurface")) break;
        if (base == null) {
          base = command.id;
        } else if (!layers.includes(command.id) && base !== command.id) {
          layers.push(command.id);
        }
        break;
      case "popSurface":
        if (layers.length > 0) {
          layers.pop();
        } else {
          ctx.warnings.push(`${where}: popSurface() has no overlay to pop.`);
        }
        break;
      case "closeLayer": {
        if (!validateSurfaceId(command.id, "close", { allowApp: true })) break;
        const top = layers[layers.length - 1];
        if (top === command.id) {
          layers.pop();
        } else if (layers.includes(command.id)) {
          ctx.warnings.push(`${where}: close("${command.id}") closes a layer that isn't the top one (top is "${top}").`);
          layers.splice(layers.lastIndexOf(command.id), 1);
        } else {
          ctx.errors.push(`${where}: close("${command.id}") but "${command.id}" isn't open. Did you open it, or close the wrong layer?`);
        }
        break;
      }
      default: {
        if (needsSurface(command.type, ctx.commandMeta)) {
          if (base == null && layers.length === 0) {
            if (!flaggedNoStage) {
              ctx.errors.push(`${where}: "${command.type}" runs before any stage()/open() — set a stage first so there's a surface to render on.`);
              flaggedNoStage = true;
            }
          } else {
            const need = requiredSurface(command.type, ctx.commandMeta);
            if (need && active() !== need) {
              ctx.errors.push(`${where}: "${command.type}" needs the ${need} stage, but the active surface here is "${active()}". Did you forget stage("${need}") or open("${need}")?`);
            }
          }
        }
        break;
      }
    }
  }

  if (layers.length > 0) {
    ctx.warnings.push(`${where}: ends with ${layers.length} layer(s) still open (${layers.join(", ")}). Close overlays before the scene ends.`);
  }
}
