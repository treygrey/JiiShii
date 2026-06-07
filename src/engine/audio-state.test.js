import { describe, expect, it } from "vitest";
import {
  applyAmbienceState,
  applyAudioSceneState,
  applyMusicState,
  clearAmbienceState,
  clearMusicState,
  cloneAudioState,
  createAudioState,
  normalizeAudioState
} from "./audio-state.js";

describe("audio state helpers", () => {
  it("creates empty durable audio state", () => {
    expect(createAudioState()).toEqual({ music: null, ambience: null });
  });

  it("sets, normalizes, and clears music state", () => {
    const audio = createAudioState();

    applyMusicState(audio, { id: "theme", volume: 0.65, loop: false, fadeIn: 500 });

    expect(audio.music).toEqual({
      id: "theme",
      volume: 0.65,
      loop: false,
      fadeIn: 500,
      fadeOut: 500
    });

    clearMusicState(audio);
    expect(audio.music).toBeNull();
  });

  it("normalizes older music shapes with safe defaults", () => {
    expect(normalizeAudioState({ music: { id: "theme" } })).toEqual({
      music: {
        id: "theme",
        volume: 1,
        loop: true,
        fadeIn: 0,
        fadeOut: 0
      },
      ambience: null
    });
  });

  it("sets, normalizes, and clears ambience state", () => {
    const audio = createAudioState();

    applyAmbienceState(audio, { id: "rain", volume: 0.4, loop: true, fadeIn: 900 });

    expect(audio.ambience).toEqual({
      id: "rain",
      volume: 0.4,
      loop: true,
      fadeIn: 900,
      fadeOut: 900
    });

    clearAmbienceState(audio);
    expect(audio.ambience).toBeNull();
  });

  it("clones without sharing references", () => {
    const audio = normalizeAudioState({ music: { id: "theme" } });
    const clone = cloneAudioState(audio);

    clone.music.id = "other";

    expect(audio.music.id).toBe("theme");
    expect(clone.music.id).toBe("other");
  });

  it("applies audio scene presets to durable music and ambience", () => {
    const audio = createAudioState();

    applyAudioSceneState(audio, {
      music: { id: "theme", volume: 0.5 },
      ambience: { id: "rain", volume: 0.3, loop: false }
    }, { transition: 1200 });

    expect(audio).toEqual({
      music: {
        id: "theme",
        volume: 0.5,
        loop: true,
        fadeIn: 1200,
        fadeOut: 1200
      },
      ambience: {
        id: "rain",
        volume: 0.3,
        loop: false,
        fadeIn: 1200,
        fadeOut: 1200
      }
    });
  });

  it("allows audio scene presets to clear durable channels", () => {
    const audio = normalizeAudioState({
      music: { id: "theme" },
      ambience: { id: "rain" }
    });

    applyAudioSceneState(audio, {
      music: null,
      ambience: null
    });

    expect(audio).toEqual({ music: null, ambience: null });
  });
});
