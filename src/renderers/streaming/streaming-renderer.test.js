import { describe, expect, it } from "vitest";
import { StreamingRenderer } from "./streaming-renderer.js";

describe("StreamingRenderer", () => {
  it("ignores chat rows when the stream chat log is unavailable", () => {
    const renderer = new StreamingRenderer(null);

    expect(() => renderer.renderChatMessage({ id: "viewer", text: "late message" })).not.toThrow();
  });
});
