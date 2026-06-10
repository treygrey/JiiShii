import { describe, expect, it } from "vitest";
import {
  assetIdFromPathText,
  audioIdsFromPath,
  buildAssetDiscovery,
  buildAssetRegistry
} from "./asset-discovery.js";
import {
  AUDIO_ASSETS,
  listAudioIds,
  resolveAudio
} from "../game/audio.js";

const buildAudioDiscovery = (modules, aliases = {}) => buildAssetDiscovery(modules, {
  idsFromPath: audioIdsFromPath,
  aliases
});
const buildAudioRegistry = (modules, aliases = {}) => buildAssetRegistry(modules, {
  idsFromPath: audioIdsFromPath,
  aliases
});

describe("audio asset discovery", () => {
  it("preserves exact audio ids from filenames and folders", () => {
    expect(assetIdFromPathText("Music/Warm Morning.ogg")).toBe("Music/Warm Morning");
    expect(audioIdsFromPath("../assets/audio/music/Warm Morning.ogg")).toEqual([
      "music/Warm Morning",
      "Warm Morning"
    ]);
  });

  it("builds exact path ids while omitting ambiguous short ids", () => {
    const discovery = buildAudioDiscovery({
      "../assets/audio/music/warm morning.ogg": "/assets/warm-theme.ogg",
      "../assets/audio/ambience/warm morning.wav": "/assets/warm-room.wav"
    });
    const registry = discovery.assets;

    expect(registry["music/warm morning"]).toBe("/assets/warm-theme.ogg");
    expect(registry["ambience/warm morning"]).toBe("/assets/warm-room.wav");
    expect(registry["warm morning"]).toBeUndefined();
    expect(discovery.ambiguities["warm morning"]).toEqual([
      "ambience/warm morning",
      "music/warm morning"
    ]);
  });

  it("keeps ambiguous audio alternatives deterministic", () => {
    const discovery = buildAudioDiscovery({
      "../assets/audio/zeta/shared.wav": "/assets/zeta.wav",
      "../assets/audio/alpha/shared.wav": "/assets/alpha.wav",
      "../assets/audio/middle/shared.wav": "/assets/middle.wav"
    });

    expect(discovery.ambiguities.shared).toEqual([
      "alpha/shared",
      "middle/shared",
      "zeta/shared"
    ]);
  });

  it("keeps stable aliases only when their targets resolve", () => {
    const registry = buildAudioRegistry({
      "../assets/audio/music/theme.ogg": "/assets/theme.ogg"
    }, {
      theme: "music/theme",
      missing_alias: "missing_target"
    });

    expect(registry.theme).toBe("/assets/theme.ogg");
    expect(registry.missing_alias).toBeUndefined();
  });

  it("does not register retired OLD audio files", () => {
    const registry = buildAudioRegistry({
      "../assets/audio/sfx/door slam OLD.wav": "/assets/door-old.wav",
      "../assets/audio/sfx/door slam.wav": "/assets/door.wav"
    });

    expect(registry["sfx/door slam OLD"]).toBeUndefined();
    expect(registry["sfx/door slam"]).toBe("/assets/door.wav");
    expect(registry["door slam"]).toBe("/assets/door.wav");
  });

  it("exposes the discovered runtime registry for validators and playback", () => {
    expect(AUDIO_ASSETS).toEqual(expect.any(Object));
    expect(listAudioIds()).toEqual(Object.keys(AUDIO_ASSETS));
    expect(resolveAudio("missing_audio_for_test")).toBeNull();
  });
});
