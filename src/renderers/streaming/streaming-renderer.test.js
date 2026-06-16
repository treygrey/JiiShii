import { describe, expect, it, vi } from "vitest";
import { StreamingRenderer } from "./streaming-renderer.js";

describe("StreamingRenderer", () => {
  it("ignores chat rows when the stream chat log is unavailable", () => {
    const renderer = new StreamingRenderer(null);

    expect(() => renderer.renderChatMessage({ id: "viewer", text: "late message" })).not.toThrow();
  });

  it("cancels in-flight reveal timers when resetting projected state", () => {
    const renderer = new StreamingRenderer(null);
    const timeoutId = 12345;
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
    renderer.activeReveal = {
      isRunning: true,
      timeoutId,
      finishNow: vi.fn()
    };

    renderer.reset();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    expect(renderer.activeReveal).toBeNull();
    expect(clearTimeoutSpy.mock.calls).toHaveLength(1);
    clearTimeoutSpy.mockRestore();
  });
});
