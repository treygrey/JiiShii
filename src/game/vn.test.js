import { describe, expect, it } from "vitest";
import * as commands from "../engine/commands/index.js";
import { installAuthorApiGlobal } from "../player/author-api.js";

describe("writer vocabulary exports", () => {
  it("re-exports every command helper from the author-facing vn module", async () => {
    installAuthorApiGlobal();
    const vn = await import("./vn.js");
    const commandHelpers = Object.entries(commands)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();

    for (const name of commandHelpers) {
      expect(vn, `missing vn export: ${name}`).toHaveProperty(name);
      expect(vn[name]).toBe(commands[name]);
    }
  });

  it("exports markup registration for author-defined inline text macros", async () => {
    installAuthorApiGlobal();
    const vn = await import("./vn.js");
    expect(vn.registerMarkup).toEqual(expect.any(Function));
  });
});
