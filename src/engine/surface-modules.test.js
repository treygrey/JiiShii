import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_SURFACE_MODULES,
  cloneSurfaceState,
  createSurfaceRegistry,
  createSurfaceState,
  defineSurfaceModule,
  normalizeSurfaceState,
  projectSurfaceState,
  surfaceCommandMeta,
  surfaceRendererContract
} from "./surface-modules.js";

describe("surface module harness", () => {
  it("registers the built-in surfaces", () => {
    const registry = createSurfaceRegistry();

    expect([...registry.keys()]).toEqual(["irl", "texting", "streaming", "phone_home", "gallery", "social"]);
  });

  it("exposes command metadata from surface modules", () => {
    const meta = surfaceCommandMeta(BUILTIN_SURFACE_MODULES);

    expect(meta.showCharacter).toMatchObject({ surface: "irl", needsSurface: true });
    expect(meta.thread).toMatchObject({ surface: "texting", needsSurface: true });
    expect(meta.streamWindow).toMatchObject({ surface: "streaming", needsSurface: true });
  });

  it("exposes renderer requirements from surface modules", () => {
    const registry = createSurfaceRegistry();

    expect(surfaceRendererContract("texting", registry)).toMatchObject({
      surface: "texting",
      commands: expect.arrayContaining(["textBlock", "thread", "choice", "transition"]),
      projections: ["renderTextingState"]
    });
  });

  it("defines a custom surface module with friendly defaults", () => {
    const gallerySurface = defineSurfaceModule({
      id: "gallery",
      renderer: {
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      commands: {
        galleryImage: { blocks: true }
      }
    });

    expect(gallerySurface).toMatchObject({
      id: "gallery",
      renderer: {
        surface: "gallery",
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      commands: {
        galleryImage: {
          kind: "render",
          surface: "gallery",
          needsSurface: true,
          blocks: true
        }
      }
    });
  });

  it("rejects duplicate surface ids", () => {
    expect(() => createSurfaceRegistry([BUILTIN_SURFACE_MODULES[0], BUILTIN_SURFACE_MODULES[0]])).toThrow(
      /duplicate surface id "irl"/
    );
  });

  it("rejects a renderer contract that declares the wrong surface", () => {
    expect(() => defineSurfaceModule({
      id: "gallery",
      renderer: {
        surface: "texting",
        commands: ["choice"],
        projections: []
      }
    })).toThrow(/renderer declares surface "texting"/);
  });

  it("rejects a surface command that declares another surface", () => {
    expect(() => defineSurfaceModule({
      id: "gallery",
      renderer: {
        commands: ["galleryImage"],
        projections: []
      },
      commands: {
        galleryImage: { surface: "texting" }
      }
    })).toThrow(/command "galleryImage" declares surface "texting"/);
  });

  it("rejects duplicate command types across surface modules", () => {
    const phoneSurface = defineSurfaceModule({
      id: "phone",
      renderer: {
        commands: ["thread"],
        projections: []
      },
      commands: {
        thread: {}
      }
    });

    expect(() => surfaceCommandMeta([BUILTIN_SURFACE_MODULES[1], phoneSurface])).toThrow(
      /duplicate command type "thread"/
    );
  });

  it("creates, normalizes, and clones module-owned state slices", () => {
    const gallerySurface = defineSurfaceModule({
      id: "gallery",
      renderer: {
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      state: {
        create: () => ({ images: [], selected: null }),
        normalize: (value = {}) => ({
          images: Array.isArray(value.images) ? structuredClone(value.images) : [],
          selected: value.selected ?? null
        }),
        clone: (value) => structuredClone(value)
      }
    });
    const registry = createSurfaceRegistry([gallerySurface]);

    const created = createSurfaceState(registry);
    expect(created.visuals.gallery).toEqual({ images: [], selected: null });

    const normalized = normalizeSurfaceState({
      visuals: {
        gallery: { images: [{ id: "demo_image" }], selected: "demo_image" }
      }
    }, registry);
    const cloned = cloneSurfaceState(normalized, registry);
    cloned.visuals.gallery.images[0].id = "changed";

    expect(normalized.visuals.gallery.images[0].id).toBe("demo_image");
    expect(cloned.visuals.gallery.selected).toBe("demo_image");
  });

  it("projects module-owned state into its renderer", () => {
    const renderGalleryState = vi.fn();
    const gallerySurface = defineSurfaceModule({
      id: "gallery",
      renderer: {
        commands: ["choice", "transition"],
        projections: ["renderGalleryState"]
      },
      state: {
        create: () => ({ images: [] }),
        project: ({ renderer, state, context }) => {
          renderer.renderGalleryState(state, { instant: context.instant });
        }
      }
    });
    const registry = createSurfaceRegistry([gallerySurface]);

    projectSurfaceState({
      state: { visuals: { gallery: { images: [{ id: "demo_image" }] } } },
      renderers: { gallery: { renderGalleryState } },
      registry,
      context: { instant: true }
    });

    expect(renderGalleryState).toHaveBeenCalledWith(
      { images: [{ id: "demo_image" }] },
      { instant: true }
    );
  });
});
