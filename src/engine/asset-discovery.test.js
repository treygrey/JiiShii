import { describe, expect, it } from "vitest";
import {
  imageIdsFromPath,
  buildAssetDiscovery,
  buildAssetRegistry,
  normalizeAssetId
} from "./asset-discovery.js";
import {
  IMAGE_ASSETS,
  listImageIds,
  resolveImage
} from "../game/assets.js";

const buildImageDiscovery = (modules, aliases = {}) => buildAssetDiscovery(modules, {
  idsFromPath: imageIdsFromPath,
  aliases
});
const buildImageRegistry = (modules, aliases = {}) => buildAssetRegistry(modules, {
  idsFromPath: imageIdsFromPath,
  aliases
});

describe("image asset discovery", () => {
  it("normalizes image ids from filenames and folders", () => {
    expect(normalizeAssetId("Backgrounds/Demo Home/Living Room Day.png")).toBe("backgrounds_demo_home_living_room_day");
    expect(imageIdsFromPath("../assets/backgrounds/demo home/living room day.png")).toEqual([
      "backgrounds_demo_home_living_room_day",
      "demo_home_living_room_day",
      "living_room_day"
    ]);
  });

  it("builds full ids while omitting ambiguous short aliases", () => {
    const discovery = buildImageDiscovery({
      "../assets/backgrounds/demo home/living room day.png": "/assets/home-living.png",
      "../assets/backgrounds/demo office/living room day.png": "/assets/office-living.png"
    });
    const registry = discovery.assets;

    expect(registry.backgrounds_demo_home_living_room_day).toBe("/assets/home-living.png");
    expect(registry.backgrounds_demo_office_living_room_day).toBe("/assets/office-living.png");
    expect(registry.living_room_day).toBeUndefined();
    expect(discovery.ambiguities.living_room_day).toEqual([
      "backgrounds_demo_home_living_room_day",
      "backgrounds_demo_office_living_room_day"
    ]);
  });

  it("keeps ambiguous image alternatives deterministic", () => {
    const discovery = buildImageDiscovery({
      "../assets/backgrounds/zeta room/shared.png": "/assets/zeta.png",
      "../assets/backgrounds/alpha room/shared.png": "/assets/alpha.png",
      "../assets/backgrounds/middle room/shared.png": "/assets/middle.png"
    });

    expect(discovery.ambiguities.shared).toEqual([
      "backgrounds_alpha_room_shared",
      "backgrounds_middle_room_shared",
      "backgrounds_zeta_room_shared"
    ]);
  });

  it("keeps stable aliases only when their targets resolve", () => {
    const registry = buildImageRegistry({
      "../assets/scenes/001/demo image.png": "/assets/demo-image.png"
    }, {
      demo_image: "scenes_001_demo_image",
      missing_alias: "missing_target"
    });

    expect(registry.demo_image).toBe("/assets/demo-image.png");
    expect(registry.missing_alias).toBeUndefined();
  });

  it("exposes the active game image registry without a hand-written index", () => {
    expect(IMAGE_ASSETS).toEqual(expect.any(Object));
    expect(listImageIds()).toEqual(Object.keys(IMAGE_ASSETS));
    expect(resolveImage("missing_image_for_test")).toBeNull();
  });

  it("does not register retired OLD image files", () => {
    expect(resolveImage("placeholder_room_nightold")).toBeNull();
  });

  it("does not register retired OLD image files in fake maps", () => {
    const registry = buildImageRegistry({
      "../assets/backgrounds/room OLD.png": "/assets/room-old.png",
      "../assets/backgrounds/room.png": "/assets/room.png"
    });

    expect(registry.backgrounds_room_old).toBeUndefined();
    expect(registry.backgrounds_room).toBe("/assets/room.png");
  });
});
