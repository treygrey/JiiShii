import { describe, expect, it } from "vitest";
import {
  buildSceneRegistry,
  buildSurfaceModuleDiscovery,
  resolveFirstSceneId
} from "./content-discovery.js";

function testScene(id, overrides = {}) {
  return {
    id,
    script: [],
    ...overrides
  };
}

describe("content discovery", () => {
  it("collects named and default scene exports", () => {
    const registry = buildSceneRegistry({
      "./scene-one.js": { sceneOne: testScene("scene_one") },
      "./scene-two.js": { default: testScene("scene_two"), helper: "ignored" }
    });

    expect(Object.keys(registry)).toEqual(["scene_one", "scene_two"]);
  });

  it("collects scene pack array exports", () => {
    const registry = buildSceneRegistry({
      "./chapter-one.js": {
        default: [
          testScene("scene_one"),
          testScene("scene_two")
        ],
        extras: [[testScene("scene_three")]]
      }
    });

    expect(Object.keys(registry)).toEqual(["scene_one", "scene_two", "scene_three"]);
  });

  it("rejects invalid entries inside scene pack arrays", () => {
    expect(() => buildSceneRegistry({
      "./chapter-one.js": {
        default: [
          testScene("scene_one"),
          { id: "broken_scene" }
        ],
        helper: () => null
      }
    })).toThrow(/invalid item in default\[1\].*scene definitions/);
  });

  it("rejects duplicate scene ids", () => {
    expect(() => buildSceneRegistry({
      "./one.js": { one: testScene("same") },
      "./two.js": { two: testScene("same") }
    })).toThrow(/duplicate scene id "same".*already defined in "\.\/one\.js"/);
  });

  it("rejects scene files with no scene export by default", () => {
    expect(() => buildSceneRegistry({
      "./helpers.js": { helper: () => null }
    })).toThrow(/does not export a scene object/);
  });

  it("reports malformed top-level scene exports precisely", () => {
    expect(() => buildSceneRegistry({
      "./broken-scene.js": { brokenScene: { id: "broken_scene" } }
    })).toThrow(/export brokenScene looks like a scene but is missing script array/);

    expect(() => buildSceneRegistry({
      "./broken-scene.js": { brokenScene: { script: [] } }
    })).toThrow(/export brokenScene looks like a scene but is missing id/);
  });

  it("can ignore helper-only scene files when discovery filters them out", () => {
    const registry = buildSceneRegistry({
      "./helpers.js": { helper: () => null },
      "./real-scene.js": { realScene: testScene("real_scene") }
    }, {
      requireScenePerFile: false
    });

    expect(Object.keys(registry)).toEqual(["real_scene"]);
  });

  it("honors configured first scene ids", () => {
    const registry = buildSceneRegistry({
      "./one.js": { one: testScene("one") },
      "./two.js": { two: testScene("two") }
    });

    expect(resolveFirstSceneId(registry, { firstSceneId: "two" })).toBe("two");
    expect(() => resolveFirstSceneId(registry, { firstSceneId: "missing" })).toThrow(/was not found/);
  });

  it("falls back to a single start scene or sorted first id", () => {
    expect(resolveFirstSceneId({
      zed: testScene("zed"),
      alpha: testScene("alpha", { start: true })
    })).toBe("alpha");

    expect(resolveFirstSceneId({
      zed: testScene("zed"),
      alpha: testScene("alpha")
    })).toBe("alpha");
  });

  it("collects discovered surface modules and renderer constructors", () => {
    class GalleryRenderer {}
    const gallerySurface = {
      id: "gallery",
      renderer: { commands: ["galleryImage"], projections: ["renderGalleryState"] },
      commands: { galleryImage: {} }
    };

    const result = buildSurfaceModuleDiscovery({
      "./gallery.js": {
        gallerySurface,
        rendererConstructors: { gallery: GalleryRenderer }
      }
    }, {
      builtinSurfaceModules: [{ id: "irl", renderer: { commands: [], projections: [] }, commands: {} }]
    });

    expect(result.surfaceModules.map((surface) => surface.id)).toEqual(["irl", "gallery"]);
    expect(result.rendererConstructors.gallery).toBe(GalleryRenderer);
  });

  it("collects surface module pack array exports", () => {
    class PhoneRenderer {}
    class BrowserRenderer {}
    const phoneSurface = { id: "phone", renderer: { commands: [], projections: [] }, commands: {} };
    const browserSurface = { id: "browser", renderer: { commands: [], projections: [] }, commands: {} };

    const result = buildSurfaceModuleDiscovery({
      "./device-surfaces.js": {
        default: [phoneSurface, browserSurface],
        rendererConstructors: {
          phone: PhoneRenderer,
          browser: BrowserRenderer
        }
      }
    });

    expect(result.surfaceModules.map((surface) => surface.id)).toEqual(["phone", "browser"]);
    expect(result.rendererConstructors.phone).toBe(PhoneRenderer);
    expect(result.rendererConstructors.browser).toBe(BrowserRenderer);
  });

  it("rejects invalid entries inside surface module pack arrays", () => {
    const phoneSurface = { id: "phone", renderer: { commands: [], projections: [] }, commands: {} };

    expect(() => buildSurfaceModuleDiscovery({
      "./device-surfaces.js": {
        default: [phoneSurface, { id: "broken" }],
        helper: () => null
      }
    })).toThrow(/invalid item in default\[1\].*surface module definitions/);
  });

  it("rejects surface module files with no surface export by default", () => {
    expect(() => buildSurfaceModuleDiscovery({
      "./helpers.js": { helper: () => null }
    })).toThrow(/does not export a surface module definition/);
  });

  it("reports malformed top-level surface module exports precisely", () => {
    expect(() => buildSurfaceModuleDiscovery({
      "./broken-surface.js": { phoneSurface: { id: "phone", commands: {} } }
    })).toThrow(/export phoneSurface looks like a surface module but is missing renderer contract/);

    expect(() => buildSurfaceModuleDiscovery({
      "./broken-surface.js": { phoneSurface: { renderer: { commands: [], projections: [] } } }
    })).toThrow(/export phoneSurface looks like a surface module but is missing id/);
  });

  it("can ignore helper-only surface module files when discovery filters them out", () => {
    const gallerySurface = { id: "gallery", renderer: { commands: [], projections: [] }, commands: {} };
    const result = buildSurfaceModuleDiscovery({
      "./helpers.js": { helper: () => null },
      "./gallery.js": { gallerySurface }
    }, {
      requireSurfaceModulePerFile: false
    });

    expect(result.surfaceModules.map((surface) => surface.id)).toEqual(["gallery"]);
  });

  it("rejects duplicate discovered surface ids", () => {
    const surface = { id: "gallery", renderer: { commands: [], projections: [] }, commands: {} };

    expect(() => buildSurfaceModuleDiscovery({
      "./gallery.js": { surface }
    }, {
      builtinSurfaceModules: [surface]
    })).toThrow(/duplicate surface id "gallery"/);
  });

  it("rejects renderer constructors without matching surface modules", () => {
    class GalleryRenderer {}

    expect(() => buildSurfaceModuleDiscovery({
      "./gallery.js": {
        gallerySurface: { id: "gallery", renderer: { commands: [], projections: [] }, commands: {} },
        rendererConstructors: { typo: GalleryRenderer }
      }
    })).toThrow(/renderer constructor "typo".*no matching surface module/);
  });

  it("rejects duplicate renderer constructors and non-functions", () => {
    class GalleryRenderer {}
    class OtherGalleryRenderer {}

    expect(() => buildSurfaceModuleDiscovery({
      "./gallery-a.js": {
        gallerySurface: { id: "gallery", renderer: { commands: [], projections: [] }, commands: {} },
        rendererConstructors: { gallery: GalleryRenderer }
      },
      "./gallery-b.js": {
        otherSurface: { id: "other", renderer: { commands: [], projections: [] }, commands: {} },
        rendererConstructors: { gallery: OtherGalleryRenderer }
      }
    })).toThrow(/duplicate renderer constructor for surface "gallery"/);

    expect(() => buildSurfaceModuleDiscovery({
      "./gallery.js": {
        gallerySurface: { id: "gallery", renderer: { commands: [], projections: [] }, commands: {} },
        rendererConstructors: { gallery: {} }
      }
    })).toThrow(/renderer constructor "gallery".*must be a class or function/);
  });
});
