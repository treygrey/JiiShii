import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_SETTINGS,
  autoDelayLabel,
  normalizeShellSettings,
  parseShellSettings,
  speedLabel,
  volumeLabel
} from "./shell-settings.js";

describe("shell settings", () => {
  it("uses defaults for empty or corrupt settings", () => {
    expect(normalizeShellSettings()).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(parseShellSettings("{nope")).toEqual(DEFAULT_SHELL_SETTINGS);
  });

  it("normalizes partial values and clamps ranges", () => {
    expect(normalizeShellSettings({
      textSpeed: 2,
      autoDelay: 50,
      skipMode: "all",
      fontScale: 2,
      reducedMotion: "on",
      masterVolume: -1,
      musicVolume: 0.25
    })).toEqual({
      ...DEFAULT_SHELL_SETTINGS,
      textSpeed: 1,
      autoDelay: 400,
      skipMode: "all",
      fontScale: 1.3,
      reducedMotion: "on",
      masterVolume: 0,
      musicVolume: 0.25
    });
    expect(normalizeShellSettings({ skipMode: "nope" }).skipMode).toBe("seen");
    expect(normalizeShellSettings({ reducedMotion: "nope" }).reducedMotion).toBe("system");
    expect(normalizeShellSettings({ fontScale: 0.1 }).fontScale).toBe(0.85);
  });

  it("formats labels for preference controls", () => {
    expect(speedLabel(0.9)).toBe("Fast");
    expect(speedLabel(0.6)).toBe("Normal");
    expect(speedLabel(0.4)).toBe("Relaxed");
    expect(speedLabel(0.1)).toBe("Slow");
    expect(autoDelayLabel(1600)).toBe("1.6s");
    expect(volumeLabel(0.85)).toBe("85%");
  });
});
