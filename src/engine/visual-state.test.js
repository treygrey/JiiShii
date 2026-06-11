import { describe, expect, it } from "vitest";
import {
  appendStreamChat,
  appendTextMessages,
  cloneVisualState,
  createVisualState,
  hasUnreadTextThreads,
  markTextThreadRead,
  markTextThreadUnread,
  normalizeVisualState,
  setBackgroundState,
  setStreamLayoutState,
  setStreamTitleState,
  setStreamWindowState,
  setTextingThread
} from "./state/visual-state.js";

describe("visual state helpers", () => {
  it("tracks background state", () => {
    const visuals = createVisualState();

    setBackgroundState(visuals, { id: "kitchen day", transition: "cut", duration: 200 });

    expect(visuals.background).toEqual({
      id: "kitchen day",
      transition: "cut",
      duration: 200
    });
  });

  it("tracks texting threads and preserves scrollback per contact", () => {
    const visuals = createVisualState();

    setTextingThread(visuals, { id: "alex", name: "Alex" });
    appendTextMessages(visuals, [{ id: "alex", message: "hi" }]);
    setTextingThread(visuals, { id: "riley", name: "Riley" });
    appendTextMessages(visuals, [{ id: "riley", message: "hey" }]);
    setTextingThread(visuals, { id: "alex", name: "Alex" });

    expect(visuals.texting).toMatchObject({
      contact: { id: "alex", name: "Alex" },
      messages: [{ id: "alex", message: "hi" }],
      currentThreadId: "alex",
      threads: {
        alex: {
          id: "alex",
          contact: { id: "alex", name: "Alex" },
          messages: [{ id: "alex", message: "hi" }]
        },
        riley: {
          id: "riley",
          contact: { id: "riley", name: "Riley" },
          messages: [{ id: "riley", message: "hey" }]
        }
      }
    });
  });

  it("tracks unread texting threads", () => {
    const visuals = createVisualState();

    markTextThreadUnread(visuals, { id: "alex", name: "Alex" }, {
      preview: "Are you there?",
      pendingSceneId: "alex_scene"
    });

    expect(hasUnreadTextThreads(visuals)).toBe(true);
    expect(visuals.texting.threads.alex).toMatchObject({
      contact: { id: "alex", name: "Alex" },
      preview: "Are you there?",
      pendingSceneId: "alex_scene",
      unread: true
    });

    markTextThreadRead(visuals, "alex");

    expect(hasUnreadTextThreads(visuals)).toBe(false);
    expect(visuals.texting.threads.alex.pendingSceneId).toBeNull();
  });

  it("normalizes legacy texting scrollback into a thread", () => {
    const visuals = normalizeVisualState({
      texting: {
        contact: { id: "riley", name: "Riley" },
        messages: [{ id: "riley", message: "old save" }]
      }
    });

    expect(visuals.texting).toMatchObject({
      currentThreadId: "riley",
      messages: [{ id: "riley", message: "old save" }],
      threads: {
        riley: {
          messages: [{ id: "riley", message: "old save" }]
        }
      }
    });
  });

  it("tracks streaming chrome and chat", () => {
    const visuals = createVisualState();

    setStreamLayoutState(visuals, { streamerName: "Alex", title: "live soon", viewers: 12 });
    setStreamTitleState(visuals, "actual title");
    setStreamWindowState(visuals, { state: "live", image: "stream_img" });
    appendStreamChat(visuals, [
      { id: "viewer", message: "first" },
      { kind: "system", text: "timeout" },
      { kind: "post", message: "mod note" }
    ]);

    expect(visuals.streaming).toMatchObject({
      layout: { streamerName: "Alex", title: "live soon", viewers: 12 },
      title: "actual title",
      window: { state: "live", image: "stream_img" },
      viewers: 12,
      chat: [
        { id: "viewer", message: "first" },
        { kind: "system", text: "timeout" },
        { kind: "post", message: "mod note" }
      ]
    });
  });

  it("normalizes and clones without shared references", () => {
    const visuals = normalizeVisualState({
      texting: { messages: [{ id: "alex", message: "hi" }] }
    });
    const clone = cloneVisualState(visuals);

    clone.texting.messages[0].message = "changed";

    expect(visuals.texting.messages[0].message).toBe("hi");
    expect(clone.streaming.window).toEqual({ state: "offline", image: null });
  });
});
