import { describe, expect, it } from "vitest";
import { createHistoryRows, historySurfaceLabel } from "./shell-history.js";

describe("shell history", () => {
  it("creates dialogue and narration rows from runner history", () => {
    expect(createHistoryRows([
      { kind: "dialogue", name: "Alex", side: "left", surface: "irl", message: "hi" },
      { kind: "narration", surface: "texting", message: "The room goes quiet." }
    ])).toEqual([
      {
        kind: "dialogue",
        speaker: "Alex",
        side: "left",
        surface: "irl",
        message: "hi"
      },
      {
        kind: "narration",
        speaker: null,
        side: "left",
        surface: "texting",
        message: "The room goes quiet."
      }
    ]);
  });

  it("drops empty rows and fills missing speaker names", () => {
    expect(createHistoryRows([
      { message: "" },
      { message: "kept" }
    ])).toEqual([
      {
        kind: "dialogue",
        speaker: "???",
        side: "left",
        surface: null,
        message: "kept"
      }
    ]);
  });

  it("labels surfaces compactly", () => {
    expect(historySurfaceLabel("streaming")).toBe("STREAMING");
    expect(historySurfaceLabel(null)).toBe("");
  });
});
