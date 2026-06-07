import { describe, expect, it } from "vitest";
import { resolveShellShortcut } from "./shell-shortcuts.js";

describe("shell shortcuts", () => {
  it("maps VN shell keys when play is active", () => {
    expect(resolveShellShortcut({ key: "h" })).toBe("history");
    expect(resolveShellShortcut({ key: "S" })).toBe("save");
    expect(resolveShellShortcut({ key: "l" })).toBe("load");
    expect(resolveShellShortcut({ key: "p" })).toBe("prefs");
    expect(resolveShellShortcut({ key: "a" })).toBe("auto");
    expect(resolveShellShortcut({ key: "k" })).toBe("skip");
  });

  it("lets Escape close overlays but otherwise does nothing", () => {
    expect(resolveShellShortcut({ key: "Escape", hasOverlay: true })).toBe("closeOverlay");
    expect(resolveShellShortcut({ key: "Escape", hasOverlay: false })).toBeNull();
  });

  it("ignores shortcuts under overlays, menus, editable fields, and modifiers", () => {
    expect(resolveShellShortcut({ key: "h", hasOverlay: true })).toBeNull();
    expect(resolveShellShortcut({ key: "h", inMenu: true })).toBeNull();
    expect(resolveShellShortcut({ key: "h", isEditable: true })).toBeNull();
    expect(resolveShellShortcut({ key: "h", ctrlKey: true })).toBeNull();
  });
});
