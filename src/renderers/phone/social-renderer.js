import { SOCIAL_SURFACE } from "../../engine/surfaces/index.js";
import { renderMarkup } from "../../engine/dom/markup.js";
import {
  escapeAttr,
  escapeHtml,
  escapeInitial,
  safeBackgroundStyle
} from "../html.js";
import { PhoneShell, stopPhoneStoryAdvance } from "./phone-shell.js";

const COMMENT_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8.5z"></path>
  </svg>
`;

const REPOST_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 2l4 4-4 4"></path>
    <path d="M3 11V8a2 2 0 0 1 2-2h16"></path>
    <path d="M7 22l-4-4 4-4"></path>
    <path d="M21 13v3a2 2 0 0 1-2 2H3"></path>
  </svg>
`;

const HEART_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
  </svg>
`;

const VIEW_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3v18h18"></path>
    <rect x="7" y="11" width="3" height="6"></rect>
    <rect x="12" y="7" width="3" height="10"></rect>
    <rect x="17" y="13" width="3" height="4"></rect>
  </svg>
`;

/**
 * Renders the phone social feed.
 */
export class SocialRenderer {
  static contract = {
    ...SOCIAL_SURFACE.renderer
  };

  /**
   * @param {Element} appRoot - Stage root.
   * @param {object} [options] - Renderer services.
   */
  constructor(appRoot, options = {}) {
    this.resolveImage = options.resolveImage ?? (() => null);
    this.shell = new PhoneShell(appRoot, options);
    this.surface = null;
    this.runner = null;
    this.activeTab = "following";
    this.lastSocialState = null;
    this.lastPhoneState = null;
    this.lastCharacters = null;
    this.animatingLikeId = null;
  }

  /**
   * Binds the scene runner.
   *
   * @param {object} runner - Scene runner.
   * @returns {void}
   */
  bindRunner(runner) {
    this.runner = runner;
    this.shell.bindRunner(runner);
    this.shell.setHomeHandler(() => this.runner?.openPhoneApp?.("home"));
  }

  /**
   * Mounts the social feed.
   *
   * @returns {void}
   */
  mount() {
    this.shell.mount({ className: "social-phone-shell", title: "Social" });
    this.surface = this.shell.surface;
  }

  /**
   * Unmounts the social feed.
   *
   * @returns {void}
   */
  unmount() {
    this.shell.unmount();
    this.surface = null;
  }

  reset() {}
  clearChoices() {}
  showTransition() {}
  showChoice() {}
  showEnd() {}

  /**
   * Shows a shared in-phone notification toast.
   *
   * @param {object} notification - Notification state.
   * @param {object} options - Toast callbacks.
   * @returns {void}
   */
  showPhoneToast(notification, options) {
    this.shell.showToast(notification, options);
  }

  /**
   * Projects social state.
   *
   * @param {object} social - Social state.
   * @param {object} options - Projection options.
   * @returns {void}
   */
  renderSocialState(social, { phone, characters } = {}) {
    this.shell.setBackHandler(this.activeTab === "following" ? null : () => {
      this.activeTab = "following";
      this.renderSocialState(social, { phone, characters });
      return true;
    });
    this.lastSocialState = social;
    this.lastPhoneState = phone;
    this.lastCharacters = characters;
    this.shell.renderPhoneChrome(phone);
    if (!this.shell.content) {
      return;
    }
    const followedPosters = new Set(
      Object.entries(social.follows ?? {})
        .filter(([, isFollowing]) => isFollowing)
        .map(([poster]) => poster)
    );
    const timelinePosts = social.posts.filter((post) => followedPosters.has(post.poster));
    const accountProfiles = this.createAccountProfiles(social, characters);

    this.shell.content.innerHTML = `
      <section class="social-app-root">
        <div class="social-app-tabs" role="tablist" aria-label="Social sections">
          ${this.renderTab("following", "Following")}
          ${this.renderTab("discover", "Discover")}
        </div>
        ${this.activeTab === "discover"
          ? this.renderDiscover(accountProfiles, social, characters)
          : this.renderTimeline(timelinePosts, social, characters)}
      </section>
    `;
    for (const button of this.shell.content.querySelectorAll("[data-social-tab]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activeTab = button.dataset.socialTab;
        this.renderSocialState(social, { phone, characters });
      });
    }
    for (const button of this.shell.content.querySelectorAll("[data-social-like]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.animatingLikeId = button.dataset.socialLike;
        this.runner?.likeSocialPost?.(button.dataset.socialLike, button.dataset.socialFlag || null);
      });
    }
    for (const button of this.shell.content.querySelectorAll("[data-social-follow]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.runner?.followSocialPoster?.(button.dataset.socialFollow, button.dataset.socialFlag || null);
      });
    }
    for (const button of this.shell.content.querySelectorAll("[data-social-image]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const post = social.posts.find((entry) => entry.id === button.dataset.socialImage);
        this.showPostImageDetail(post, { social, phone, characters });
      });
    }
    for (const element of this.shell.content.querySelectorAll("button")) {
      element.addEventListener("pointerdown", stopPhoneStoryAdvance);
      element.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
    this.clearCompletedLikeAnimation();
  }

  /**
   * Builds discoverable account rows from authored posts.
   *
   * @param {object} social - Social state.
   * @param {Map<string, object>} characters - Character map.
   * @returns {object[]} Account summaries.
   */
  createAccountProfiles(social, characters) {
    const profiles = new Map();
    for (const post of social.posts ?? []) {
      if (!post.poster) {
        continue;
      }
      const existing = profiles.get(post.poster) ?? { id: post.poster, postCount: 0 };
      existing.postCount += 1;
      existing.latestText = post.text || existing.latestText || "";
      profiles.set(post.poster, existing);
    }
    return [...profiles.values()].map((profile) => {
      const character = characters?.get?.(profile.id) ?? {};
      return {
        ...profile,
        name: character.name ?? profile.id,
        color: character.color ?? null
      };
    });
  }

  /**
   * Renders one social root tab.
   *
   * @param {string} tab - Tab id.
   * @param {string} label - Visible label.
   * @returns {string} Tab button HTML.
   */
  renderTab(tab, label) {
    return `
      <button class="social-tab ${tab === this.activeTab ? "is-active" : ""}" type="button" role="tab" aria-selected="${tab === this.activeTab}" data-social-tab="${tab}">
        ${label}
      </button>
    `;
  }

  /**
   * Renders the followed timeline.
   *
   * @param {object[]} posts - Posts from followed accounts.
   * @param {object} social - Social state.
   * @param {Map<string, object>} characters - Character map.
   * @returns {string} Timeline HTML.
   */
  renderTimeline(posts, social, characters) {
    return `
      <div class="social-feed">
        ${posts.length
          ? posts.map((post) => this.renderPost(post, social, characters)).join("")
          : `
            <div class="phone-empty-state social-empty-state">
              <strong>Your timeline is quiet.</strong>
              <span>Follow people in Discover to start seeing posts here.</span>
            </div>
          `}
      </div>
    `;
  }

  /**
   * Renders discoverable accounts.
   *
   * @param {object[]} accountProfiles - Account summaries.
   * @param {object} social - Social state.
   * @returns {string} Discover HTML.
   */
  renderDiscover(accountProfiles, social) {
    return `
      <div class="social-discover">
        ${accountProfiles.length
          ? accountProfiles.map((profile) => this.renderAccountProfile(profile, social)).join("")
          : `
            <div class="phone-empty-state social-empty-state">
              <strong>No one to follow yet.</strong>
              <span>New accounts will appear here when the story adds posts.</span>
            </div>
          `}
      </div>
    `;
  }

  /**
   * Renders one discover account row.
   *
   * @param {object} profile - Account summary.
   * @param {object} social - Social state.
   * @returns {string} Account HTML.
   */
  renderAccountProfile(profile, social) {
    const followed = Boolean(social.follows?.[profile.id]);
    const profileId = escapeAttr(profile.id);
    const profileName = escapeHtml(profile.name);
    return `
      <article class="social-account-card">
        <span class="social-avatar" style="${safeBackgroundStyle(profile.color)}">${escapeInitial(profile.name)}</span>
        <div class="social-account-copy">
          <strong>${profileName}</strong>
          <span>${profile.postCount} ${profile.postCount === 1 ? "post" : "posts"}</span>
          ${profile.latestText ? `<p>${renderMarkup(profile.latestText)}</p>` : ""}
        </div>
        <button class="social-follow-button" type="button" data-social-follow="${profileId}" ${followed ? "disabled" : ""}>
          ${followed ? "Following" : "Follow"}
        </button>
      </article>
    `;
  }

  /**
   * Renders one social post.
   *
   * @param {object} post - Post state.
   * @param {object} social - Social state.
   * @param {Map<string, object>} characters - Character map.
   * @returns {string} Post HTML.
   */
  renderPost(post, social, characters) {
    const character = characters?.get?.(post.poster) ?? {};
    const name = character.name ?? post.poster ?? "Unknown";
    const src = post.image ? this.resolveImage(post.image) : null;
    const liked = Boolean(social.likes?.[post.id]);
    const followed = post.poster ? Boolean(social.follows?.[post.poster]) : false;
    const metrics = this.normalizeMetrics(post.metrics);
    return `
      <article class="social-post">
        <header>
          <span class="social-avatar" style="${safeBackgroundStyle(character.color)}">${escapeInitial(name)}</span>
          <strong>${escapeHtml(name)}</strong>
        </header>
        ${post.text ? `<p>${renderMarkup(post.text)}</p>` : ""}
        ${src ? `
          <button class="social-post-image-button" type="button" data-social-image="${escapeAttr(post.id)}" aria-label="Open image">
            <img src="${escapeAttr(src)}" alt="">
          </button>
        ` : ""}
        <footer class="social-post-actions">
          ${this.renderMetricButton("reply", "Replies", metrics.replies, COMMENT_ICON)}
          ${this.renderMetricButton("repost", "Reposts", metrics.reposts, REPOST_ICON)}
          ${this.renderMetricButton("like", liked ? "Liked" : "Likes", metrics.likes + (liked ? 1 : 0), HEART_ICON, {
            ...post,
            liked,
            animateLike: this.animatingLikeId === post.id
          })}
          ${this.renderMetricButton("view", "Views", metrics.views, VIEW_ICON)}
          ${post.poster && !followed ? `<button class="social-follow-button social-follow-button--inline" type="button" data-social-follow="${escapeAttr(post.poster)}" data-social-flag="${escapeAttr(post.followFlag ?? "")}">Follow</button>` : ""}
        </footer>
      </article>
    `;
  }

  /**
   * Normalizes a post metric record for rendering.
   *
   * @param {object} metrics - Candidate metric record.
   * @returns {{ replies: number, reposts: number, likes: number, views: number }} Render metrics.
   */
  normalizeMetrics(metrics = {}) {
    return {
      replies: Number(metrics.replies ?? 0),
      reposts: Number(metrics.reposts ?? 0),
      likes: Number(metrics.likes ?? 0),
      views: Number(metrics.views ?? 0)
    };
  }

  /**
   * Renders one social accessory action with a count.
   *
   * @param {string} kind - Action id.
   * @param {string} label - Accessible label.
   * @param {number} count - Display count.
   * @param {string} icon - Inline SVG icon.
   * @param {object|null} post - Post for like wiring.
   * @returns {string} Action button HTML.
   */
  renderMetricButton(kind, label, count, icon, post = null) {
    const countText = this.formatMetricCount(count);
    const likeAttrs = kind === "like" && post
      ? `data-social-like="${escapeAttr(post.id)}" data-social-flag="${escapeAttr(post.likeFlag ?? "")}"`
      : "";
    const likedClass = kind === "like" && post?.liked ? " is-liked" : "";
    const animateClass = kind === "like" && post?.animateLike ? " is-like-flashing" : "";
    return `
      <button class="social-action-button social-action-button--${kind}${likedClass}${animateClass}" type="button" aria-label="${label}" ${likeAttrs}>
        <span class="social-action-icon" aria-hidden="true">${icon}</span>
        <span>${countText}</span>
      </button>
    `;
  }

  /**
   * Clears the one-shot like animation marker after the rendered flash starts.
   *
   * @returns {void}
   */
  clearCompletedLikeAnimation() {
    if (!this.animatingLikeId) {
      return;
    }
    window.setTimeout(() => {
      this.animatingLikeId = null;
    }, 450);
  }

  /**
   * Formats compact social metric counts.
   *
   * @param {number} count - Raw count.
   * @returns {string} Display count.
   */
  formatMetricCount(count) {
    const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    if (safeCount >= 1000000) {
      return `${(safeCount / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (safeCount >= 1000) {
      return `${(safeCount / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return String(safeCount);
  }

  /**
   * Shows a full-size social image inside the Social app.
   *
   * @param {object|null} post - Post with an image.
   * @param {object} options - Previous projection context.
   * @param {object} options.social - Social state to restore on back.
   * @param {object} options.phone - Phone state to restore on back.
   * @param {Map<string, object>} options.characters - Character map.
   * @returns {void}
   */
  showPostImageDetail(post, { social, phone, characters } = {}) {
    if (!post?.image || !this.shell.content) {
      return;
    }
    const src = this.resolveImage(post.image);
    this.shell.setBackHandler(() => {
      this.renderSocialState(social ?? this.lastSocialState, {
        phone: phone ?? this.lastPhoneState,
        characters: characters ?? this.lastCharacters
      });
      return true;
    });
    this.shell.content.innerHTML = `
      <div class="social-image-detail">
        <div class="social-image-frame">
          ${src ? `<img src="${escapeAttr(src)}" alt="">` : `<div class="phone-empty-state">${escapeHtml(post.image)}</div>`}
        </div>
      </div>
    `;
    for (const element of this.shell.content.querySelectorAll("button")) {
      element.addEventListener("pointerdown", stopPhoneStoryAdvance);
      element.addEventListener("pointerup", stopPhoneStoryAdvance);
    }
  }
}
