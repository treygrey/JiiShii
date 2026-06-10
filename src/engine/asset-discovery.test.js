import { describe, expect, it } from "vitest";
import {
  assetIdFromPathText,
  imageIdsFromPath,
  buildAssetDiscovery,
  buildAssetRegistry
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
  it("preserves exact image ids from filenames and folders", () => {
    expect(assetIdFromPathText("Backgrounds/Demo Home/Living Room Day.png")).toBe("Backgrounds/Demo Home/Living Room Day");
    expect(imageIdsFromPath("../assets/backgrounds/demo home/living room day.png")).toEqual([
      "backgrounds/demo home/living room day",
      "demo home/living room day",
      "living room day"
    ]);
  });

  it("builds exact path ids while omitting ambiguous short ids", () => {
    const discovery = buildImageDiscovery({
      "../assets/backgrounds/demo home/living room day.png": "/assets/home-living.png",
      "../assets/backgrounds/demo office/living room day.png": "/assets/office-living.png"
    });
    const registry = discovery.assets;

    expect(registry["backgrounds/demo home/living room day"]).toBe("/assets/home-living.png");
    expect(registry["demo home/living room day"]).toBe("/assets/home-living.png");
    expect(registry["backgrounds/demo office/living room day"]).toBe("/assets/office-living.png");
    expect(registry["living room day"]).toBeUndefined();
    expect(discovery.ambiguities["living room day"]).toEqual([
      "backgrounds/demo home/living room day",
      "backgrounds/demo office/living room day"
    ]);
  });

  it("keeps ambiguous image alternatives deterministic", () => {
    const discovery = buildImageDiscovery({
      "../assets/backgrounds/zeta room/shared.png": "/assets/zeta.png",
      "../assets/backgrounds/alpha room/shared.png": "/assets/alpha.png",
      "../assets/backgrounds/middle room/shared.png": "/assets/middle.png"
    });

    expect(discovery.ambiguities.shared).toEqual([
      "backgrounds/alpha room/shared",
      "backgrounds/middle room/shared",
      "backgrounds/zeta room/shared"
    ]);
  });

  it("keeps stable aliases only when their targets resolve", () => {
    const registry = buildImageRegistry({
      "../assets/scenes/001/demo image.png": "/assets/demo-image.png"
    }, {
      "demo image": "scenes/001/demo image",
      missing_alias: "missing_target"
    });

    expect(registry["demo image"]).toBe("/assets/demo-image.png");
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

    expect(registry["backgrounds/room OLD"]).toBeUndefined();
    expect(registry["backgrounds/room"]).toBe("/assets/room.png");
    expect(registry.room).toBe("/assets/room.png");
  });
});
