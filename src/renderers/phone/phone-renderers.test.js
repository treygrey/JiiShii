import { describe, expect, it } from "vitest";
import { PhoneHomeRenderer } from "./phone-home-renderer.js";
import { SocialRenderer } from "./social-renderer.js";

describe("phone app renderers", () => {
  it("renders badges only for the app currently being drawn", () => {
    const renderer = new PhoneHomeRenderer(null);

    expect(renderer.renderAppIcon("gallery", { badges: { social: true } })).not.toContain("phone-app-badge");
    expect(renderer.renderAppIcon("social", { badges: { social: true } })).toContain("phone-app-badge");
  });

  it("ignores stale social follows and likes when posts are not present", () => {
    const renderer = new SocialRenderer(null);
    const social = {
      posts: [{ id: "post_alex", poster: "alex", text: "hello", metrics: {} }],
      follows: { ghost: true },
      likes: { missing_post: true }
    };
    const characters = new Map([["alex", { name: "Alex" }]]);

    const profiles = renderer.createAccountProfiles(social, characters);
    const discoverHtml = renderer.renderDiscover(profiles, social);
    const timelineHtml = renderer.renderTimeline([], social, characters);
    const postHtml = renderer.renderPost(social.posts[0], social, characters);

    expect(discoverHtml).toContain("Alex");
    expect(discoverHtml).not.toContain("ghost");
    expect(timelineHtml).toContain("Your timeline is quiet.");
    expect(postHtml).not.toContain("is-liked");
  });
});
