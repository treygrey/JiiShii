import { describe, expect, it } from "vitest";
import {
  appendHistoryEntry,
  cloneHistoryState,
  createHistoryState,
  normalizeHistoryState
} from "./history-state.js";

describe("history state", () => {
  it("creates an empty reader backlog", () => {
    expect(createHistoryState()).toEqual([]);
  });

  it("normalizes partial history entries", () => {
    expect(normalizeHistoryState([{ message: "hello", speaker: "alex" }])).toEqual([
      {
        kind: "dialogue",
        speaker: "alex",
        name: null,
        side: null,
        message: "hello",
        surface: null,
        sceneId: null,
        commandIndex: null
      }
    ]);
  });

  it("drops empty entries when appending", () => {
    const history = createHistoryState();

    appendHistoryEntry(history, { message: "" });
    appendHistoryEntry(history, { message: "kept", kind: "narration" });

    expect(history.map((entry) => entry.message)).toEqual(["kept"]);
  });

  it("clones without sharing references", () => {
    const history = [{ message: "original", speaker: "alex" }];
    const clone = cloneHistoryState(history);

    history[0].message = "changed";

    expect(clone[0].message).toBe("original");
  });
});
