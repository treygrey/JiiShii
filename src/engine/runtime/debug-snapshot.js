import { cloneAudioState } from "../audio-state.js";

/**
 * Creates a plain-data view of the live runner state for debug tooling.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {object} Snapshot.
 */
export function getDebugSnapshot(runner) {
  const script = runner.scene?.script ?? [];
  const index = runner.state.currentCommandIndex ?? 0;
  const command = script[index];
  const sprites = (runner.state.sprites?.irl?.visible ?? []).map((sprite) => ({
    id: sprite.id,
    outfit: sprite.outfit ?? null,
    expression: sprite.expression ?? null,
    body: sprite.body ?? null,
    side: sprite.side ?? "auto",
    flip: Boolean(sprite.flip),
    at: sprite.at ?? null,
    x: sprite.x ?? null,
    y: sprite.y ?? null,
    scale: sprite.scale ?? 1,
    alpha: sprite.alpha ?? 1,
    z: sprite.z ?? null,
    layer: sprite.layer ?? "characters"
  }));
  const images = (runner.state.sprites?.irl?.images ?? []).map((image) => ({
    id: image.id,
    asset: image.asset,
    kind: image.kind ?? "image",
    at: image.at ?? null,
    layer: image.layer ?? null,
    transition: image.transition ?? null
  }));
  return {
    sceneId: runner.state.currentSceneId,
    commandIndex: index,
    commandCount: script.length,
    nextCommand: command ? command.type + (command.id ? ` "${command.id}"` : "") : null,
    activeSurface: runner.state.currentSurface ?? null,
    surfaceStack: [...(runner.surfaceStack ?? [])],
    speaker: runner.lastSpeaker,
    audio: cloneAudioState(runner.state.audio),
    historySize: runner.state.history?.length ?? 0,
    sprites,
    images,
    vars: { ...(runner.state.vars ?? {}) },
    rollback: {
      pos: runner.rollbackPos,
      size: runner.rollbackBuffer.length,
      rewound: runner.isRewound
    }
  };
}
