import { describe, expect, it, vi } from "vitest";
import { TextingRenderer } from "./texting-renderer.js";

describe("TextingRenderer", () => {
  it("renders canonical player messages on the player side without character metadata", () => {
    const renderer = new TextingRenderer(null);

    const resolved = renderer.resolveMessage(
      { id: "player", message: "I am here." },
      new Map()
    );

    expect(resolved).toMatchObject({
      id: "player",
      color: "#4a90e2",
      side: "right"
    });
  });

  it("keeps unknown sender fallbacks on the incoming side", () => {
    const renderer = new TextingRenderer(null);

    const resolved = renderer.resolveMessage(
      { id: "alex_typo", message: "Hello?" },
      new Map()
    );

    expect(resolved).toMatchObject({
      id: "alex_typo",
      color: "#d1d5db",
      side: "left"
    });
  });

  it("uses system back to leave the active inbox thread first", () => {
    const renderer = new TextingRenderer(null);
    renderer.selectedThreadId = "alex";
    renderer.lastTextingState = { threads: {} };
    renderer.lastCharacters = new Map();
    renderer.runner = {
      isTextingInboxMode: vi.fn(() => true),
      isPhoneOpen: vi.fn(() => true),
      goBackPhoneApp: vi.fn(),
      rollBack: vi.fn()
    };
    renderer.renderThreadList = vi.fn();

    renderer.handleSystemBack();

    expect(renderer.selectedThreadId).toBe(null);
    expect(renderer.renderThreadList).toHaveBeenCalledWith(
      renderer.lastTextingState,
      { characters: renderer.lastCharacters }
    );
    expect(renderer.runner.goBackPhoneApp).not.toHaveBeenCalled();
    expect(renderer.runner.rollBack).not.toHaveBeenCalled();
  });

  it("uses system back for phone app history while the phone is open", () => {
    const renderer = new TextingRenderer(null);
    renderer.runner = {
      isTextingInboxMode: vi.fn(() => false),
      isPhoneOpen: vi.fn(() => true),
      goBackPhoneApp: vi.fn(),
      rollBack: vi.fn()
    };

    renderer.handleSystemBack();

    expect(renderer.runner.goBackPhoneApp).toHaveBeenCalledOnce();
    expect(renderer.runner.rollBack).not.toHaveBeenCalled();
  });

  it("uses system back for rollback when texting is the story surface", () => {
    const renderer = new TextingRenderer(null);
    renderer.runner = {
      isTextingInboxMode: vi.fn(() => false),
      isPhoneOpen: vi.fn(() => false),
      canRollBack: vi.fn(() => true),
      goBackPhoneApp: vi.fn(),
      rollBack: vi.fn()
    };

    renderer.handleSystemBack();

    expect(renderer.runner.goBackPhoneApp).not.toHaveBeenCalled();
    expect(renderer.runner.canRollBack).toHaveBeenCalledOnce();
    expect(renderer.runner.rollBack).toHaveBeenCalledOnce();
  });
});
