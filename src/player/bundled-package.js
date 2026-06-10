import { installAuthorApiGlobal } from "./author-api.js";

/**
 * Returns the build-time bundled starter package descriptor.
 *
 * Bundled mode intentionally installs the same author API global as loose mode
 * before importing package modules. That keeps `src/game/vn.js` shaped like the
 * loose package shim authors will ship beside the desktop executable.
 *
 * @returns {Promise<object>} Package descriptor.
 */
export async function loadBundledPackage() {
  installAuthorApiGlobal();

  const [
    scenesModule,
    surfaceModulesModule,
    configModule,
    assetModule,
    audioModule,
    charactersModule,
    spriteModule
  ] = await Promise.all([
    import("../game/scenes/index.js"),
    import("../game/surface-modules/index.js"),
    import("../game/game.config.js"),
    import("../game/assets.js"),
    import("../game/audio.js"),
    import("../game/characters.js"),
    import("../game/sprites.js"),
    import("../game/sprite-animations.js")
  ]);

  return {
    mode: "bundled",
    gameConfig: configModule.GAME_CONFIG,
    scenes: scenesModule.SCENES,
    firstSceneId: scenesModule.FIRST_SCENE_ID,
    surfaceModules: surfaceModulesModule.SURFACE_MODULES,
    rendererConstructors: surfaceModulesModule.SURFACE_RENDERER_CONSTRUCTORS,
    globalCharacters: charactersModule.GLOBAL_CHARACTERS,
    resolveImage: assetModule.resolveImage,
    resolveImageAmbiguity: assetModule.resolveImageAmbiguity,
    listImageIds: assetModule.listImageIds,
    resolveAudio: audioModule.resolveAudio,
    resolveAudioAmbiguity: audioModule.resolveAudioAmbiguity,
    listAudioIds: audioModule.listAudioIds,
    resolveExpression: spriteModule.resolveExpression,
    listExpressions: spriteModule.listExpressions,
    listBodies: spriteModule.listBodies,
    listOutfits: spriteModule.listOutfits,
    listMissingRequiredSpriteLayers: spriteModule.listMissingRequiredSpriteLayers,
    resolveSprite: spriteModule.resolveSprite,
    packageWarnings: []
  };
}
