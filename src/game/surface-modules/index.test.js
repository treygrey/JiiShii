import { describe, expect, it } from "vitest";
import { galleryImage, gallerySurface, rendererConstructors } from "./gallery.example.js";
import { SURFACE_MODULES, SURFACE_RENDERER_CONSTRUCTORS } from "./index.js";

describe("game surface module discovery", () => {
  it("ignores copyable example modules", () => {
    expect(SURFACE_MODULES.map((surface) => surface.id)).toEqual(expect.arrayContaining(["irl", "texting", "streaming"]));
    expect(SURFACE_MODULES.map((surface) => surface.id)).not.toContain("gallery");
    expect(SURFACE_RENDERER_CONSTRUCTORS.gallery).toBeUndefined();
  });

  it("keeps the gallery example copyable and contract-shaped", () => {
    expect(galleryImage("sample", "demo_image")).toEqual({
      type: "galleryImage",
      id: "sample",
      asset: "demo_image"
    });
    expect(gallerySurface).toMatchObject({
      id: "gallery",
      renderer: {
        commands: expect.arrayContaining(["galleryImage", "choice", "transition"]),
        projections: ["renderGalleryState"]
      }
    });
    expect(rendererConstructors.gallery.contract.surface).toBe("gallery");
  });
});
