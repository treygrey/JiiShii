import { describe, expect, it } from "vitest";
import {
  hasIrlPositionPreset,
  hasIrlTransitionPreset,
  listIrlPositionPresets,
  listIrlTransitionPresets,
  registerIrlSpriteTransition,
  resolveIrlPlacement,
  resolveIrlTransition
} from "./irl-stage-direction.js";

describe("IRL stage direction registry", () => {
  it("resolves named positions into concrete placement values", () => {
    expect(resolveIrlPlacement({ at: "left" })).toMatchObject({
      x: "28%",
      scale: 1,
      alpha: 1,
      z: 24,
      layer: "characters"
    });
    expect(resolveIrlPlacement({ at: "nearRight" })).toMatchObject({
      x: "64%",
      scale: 1.08,
      z: 34
    });
  });

  it("lets explicit placement fields override presets", () => {
    expect(resolveIrlPlacement({
      at: "left",
      x: "40%",
      scale: 0.92,
      alpha: 0.7,
      z: 50,
      layer: "foreground"
    })).toEqual({
      x: "40%",
      y: null,
      scale: 0.92,
      alpha: 0.7,
      z: 50,
      layer: "foreground"
    });
  });

  it("reports known position and transition presets", () => {
    expect(hasIrlPositionPreset("left")).toBe(true);
    expect(hasIrlPositionPreset("not-a-place")).toBe(false);
    expect(listIrlPositionPresets()).toContain("offscreenLeft");

    expect(hasIrlTransitionPreset("moveInLeft")).toBe(true);
    expect(hasIrlTransitionPreset("not-a-transition")).toBe(false);
    expect(listIrlTransitionPresets()).toContain("moveOutRight");
    expect(listIrlTransitionPresets()).toContain("replaceDip");
    expect(listIrlTransitionPresets()).toContain("replaceFlip");
  });

  it("resolves transition timing and enter/exit behavior", () => {
    expect(resolveIrlTransition("cut")).toMatchObject({ duration: 0, easing: "linear" });
    expect(resolveIrlTransition("moveInLeft")).toMatchObject({
      duration: 420,
      enterFrom: "offscreenLeft"
    });
    expect(resolveIrlTransition("moveOutRight")).toMatchObject({
      duration: 320,
      exitTo: "offscreenRight"
    });
    expect(resolveIrlTransition("replaceDip")).toMatchObject({
      duration: 180,
      replacement: "dip"
    });
    expect(resolveIrlTransition("replaceFlip")).toMatchObject({
      duration: 320,
      replacement: "flip"
    });
    expect(resolveIrlTransition("unknown")).toMatchObject({ duration: 260 });
  });

  it("registers custom declarative sprite transitions", () => {
    registerIrlSpriteTransition("testSoftSwap", {
      duration: 140,
      easing: "ease-out",
      replacement: "dip"
    });

    expect(hasIrlTransitionPreset("testSoftSwap")).toBe(true);
    expect(resolveIrlTransition("testSoftSwap")).toMatchObject({
      duration: 140,
      easing: "ease-out",
      replacement: "dip"
    });
  });

  it("applies command-level duration and easing overrides to known presets", () => {
    expect(resolveIrlTransition("move", {
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    })).toMatchObject({
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    });
  });

  it("ignores invalid transition overrides and falls back to the preset", () => {
    expect(resolveIrlTransition("move", {
      duration: -1,
      easing: " "
    })).toMatchObject({
      duration: 400,
      easing: "ease"
    });
  });
});
