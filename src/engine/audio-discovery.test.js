import { describe, expect, it } from "vitest";
import {
  audioIdsFromPath,
  buildAssetDiscovery,
  buildAssetRegistry,
  normalizeAssetId
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
  it("normalizes audio ids from filenames and folders", () => {
    expect(normalizeAssetId("Music/Warm Morning.ogg")).toBe("music_warm_morning");
    expect(audioIdsFromPath("../assets/audio/music/Warm Morning.ogg")).toEqual([
      "music_warm_morning",
      "warm_morning"
    ]);
  });

  it("builds full ids while omitting ambiguous short aliases", () => {
    const discovery = buildAudioDiscovery({
      "../assets/audio/music/warm morning.ogg": "/assets/warm-theme.ogg",
      "../assets/audio/ambience/warm morning.wav": "/assets/warm-room.wav"
    });
    const registry = discovery.assets;

    expect(registry.music_warm_morning).toBe("/assets/warm-theme.ogg");
    expect(registry.ambience_warm_morning).toBe("/assets/warm-room.wav");
    expect(registry.warm_morning).toBeUndefined();
    expect(discovery.ambiguities.warm_morning).toEqual([
      "ambience_warm_morning",
      "music_warm_morning"
    ]);
  });

  it("keeps ambiguous audio alternatives deterministic", () => {
    const discovery = buildAudioDiscovery({
      "../assets/audio/zeta/shared.wav": "/assets/zeta.wav",
      "../assets/audio/alpha/shared.wav": "/assets/alpha.wav",
      "../assets/audio/middle/shared.wav": "/assets/middle.wav"
    });

    expect(discovery.ambiguities.shared).toEqual([
      "alpha_shared",
      "middle_shared",
      "zeta_shared"
    ]);
  });

  it("keeps stable aliases only when their targets resolve", () => {
    const registry = buildAudioRegistry({
      "../assets/audio/music/theme.ogg": "/assets/theme.ogg"
    }, {
      main_theme: "music_theme",
      missing_alias: "missing_target"
    });

    expect(registry.main_theme).toBe("/assets/theme.ogg");
    expect(registry.missing_alias).toBeUndefined();
  });

  it("does not register retired OLD audio files", () => {
    const registry = buildAudioRegistry({
      "../assets/audio/sfx/door slam OLD.wav": "/assets/door-old.wav",
      "../assets/audio/sfx/door slam.wav": "/assets/door.wav"
    });

    expect(registry.sfx_door_slam_old).toBeUndefined();
    expect(registry.sfx_door_slam).toBe("/assets/door.wav");
  });

  it("exposes the discovered runtime registry for validators and playback", () => {
    expect(AUDIO_ASSETS).toEqual(expect.any(Object));
    expect(listAudioIds()).toEqual(Object.keys(AUDIO_ASSETS));
    expect(resolveAudio("missing_audio_for_test")).toBeNull();
  });
});
