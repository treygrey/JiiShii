import { describe, expect, it } from "vitest";
import {
  addPhoneNotification,
  clearPhoneNotification,
  createGalleryState,
  createPhoneState,
  createSocialState,
  hasUnreadPhoneNotifications,
  mergePersistentPhoneState,
  normalizePhoneState,
  removeGalleryImageState,
  saveGalleryImageState,
  saveSocialPostState,
  setPhoneApps
} from "./state/phone-state.js";

describe("phone state", () => {
  it("creates and normalizes shared phone state from config", () => {
    const phone = createPhoneState({
      apps: ["texting", "pinball"],
      homeAppOrder: ["pinball", "texting"],
      defaultWallpaper: "wallpaper_day",
      button: false
    });

    expect(phone).toMatchObject({
      enabledApps: ["texting", "pinball"],
      homeAppOrder: ["pinball", "texting"],
      wallpaperImage: "wallpaper_day",
      currentApp: "home",
      isButtonEnabled: false
    });

    expect(normalizePhoneState({ enabledApps: ["social"] }, { apps: ["texting"] }).enabledApps).toEqual(["social"]);
  });

  it("updates enabled apps while keeping home order usable", () => {
    const phone = createPhoneState({ apps: ["texting", "gallery", "social"] });

    setPhoneApps(phone, ["social", "pinball"]);

    expect(phone.enabledApps).toEqual(["social", "pinball"]);
    expect(phone.homeAppOrder).toEqual(["social", "pinball"]);
  });

  it("tracks unread notifications and badges through read clearing", () => {
    const phone = createPhoneState();
    const notification = addPhoneNotification(phone, "social", { id: "social:alex", text: "Alex posted" });

    expect(notification).toMatchObject({ id: "social:alex", app: "social", read: false });
    expect(hasUnreadPhoneNotifications(phone)).toBe(true);
    expect(phone.badges.social).toBe(true);

    clearPhoneNotification(phone, "social");

    expect(hasUnreadPhoneNotifications(phone)).toBe(false);
    expect(phone.badges.social).toBe(false);
  });

  it("keeps persistent gallery and social entries across rollback merges", () => {
    const target = {
      visuals: {
        phone: createPhoneState(),
        gallery: createGalleryState(),
        social: createSocialState()
      }
    };
    const preserved = structuredClone(target);
    preserved.visuals.phone.wallpaperImage = "wallpaper_night";
    saveGalleryImageState(preserved.visuals.gallery, {
      id: "alex_photo",
      image: "alex_photo_cg",
      tags: ["Alex", "Photos"],
      persistent: true
    });
    saveSocialPostState(preserved.visuals.social, {
      id: "post_alex",
      poster: "alex",
      text: "still alive",
      persistent: true
    });

    mergePersistentPhoneState(target, preserved);

    expect(target.visuals.phone.wallpaperImage).toBe("wallpaper_night");
    expect(target.visuals.gallery.images).toEqual([
      expect.objectContaining({ id: "alex_photo", tags: ["Alex", "Photos"], persistent: true })
    ]);
    expect(target.visuals.social.posts).toEqual([
      expect.objectContaining({ id: "post_alex", persistent: true })
    ]);
  });

  it("removes nonpersistent gallery entries through authored state commands", () => {
    const gallery = createGalleryState();

    saveGalleryImageState(gallery, { id: "temp", image: "temp_cg" });
    removeGalleryImageState(gallery, "temp");

    expect(gallery.images).toEqual([]);
  });

  it("normalizes gallery tags from authored image metadata", () => {
    const gallery = createGalleryState();

    saveGalleryImageState(gallery, {
      id: "alex_photo",
      image: "alex_photo_cg",
      tags: ["Alex", "Alex", "  Photos  ", ""]
    });

    expect(gallery.images).toEqual([
      expect.objectContaining({
        id: "alex_photo",
        tags: ["Alex", "Photos"]
      })
    ]);
  });
});
