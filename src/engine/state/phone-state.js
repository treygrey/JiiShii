const DEFAULT_PHONE_APPS = ["texting", "calls", "gallery", "social"];

/**
 * Creates the shared phone state used by phone-family surfaces.
 *
 * @param {object} [config] - Optional normalized game phone config.
 * @returns {object} Serializable phone state.
 */
export function createPhoneState(config = {}) {
  const apps = normalizeAppList(config.apps, DEFAULT_PHONE_APPS);
  return {
    enabledApps: apps,
    homeAppOrder: normalizeAppList(config.homeAppOrder, apps),
    wallpaperImage: config.defaultWallpaper ?? null,
    notifications: [],
    badges: {},
    currentApp: "home",
    isButtonEnabled: config.button ?? true
  };
}

/**
 * Normalizes saved/shared phone state and fills missing fields.
 *
 * @param {object} [value] - Saved phone state.
 * @param {object} [config] - Optional normalized game phone config.
 * @returns {object} Normalized phone state.
 */
export function normalizePhoneState(value = {}, config = {}) {
  const created = createPhoneState(config);
  return {
    enabledApps: normalizeAppList(value.enabledApps, created.enabledApps),
    homeAppOrder: normalizeAppList(value.homeAppOrder, created.homeAppOrder),
    wallpaperImage: value.wallpaperImage ?? created.wallpaperImage,
    notifications: normalizeNotifications(value.notifications),
    badges: normalizeBadges(value.badges),
    currentApp: typeof value.currentApp === "string" && value.currentApp ? value.currentApp : created.currentApp,
    isButtonEnabled: typeof value.isButtonEnabled === "boolean" ? value.isButtonEnabled : created.isButtonEnabled
  };
}

/**
 * Creates gallery app state.
 *
 * @returns {object} Serializable gallery state.
 */
export function createGalleryState() {
  return {
    images: []
  };
}

/**
 * Normalizes gallery app state.
 *
 * @param {object} [value] - Saved gallery state.
 * @returns {object} Normalized gallery state.
 */
export function normalizeGalleryState(value = {}) {
  return {
    images: Array.isArray(value.images)
      ? value.images
          .filter((image) => image?.id && image?.image)
          .map((image) => ({
            id: image.id,
            image: image.image,
            caption: image.caption ?? "",
            tags: normalizeStringList(image.tags),
            persistent: Boolean(image.persistent)
          }))
      : []
  };
}

/**
 * Creates social app state.
 *
 * @returns {object} Serializable social state.
 */
export function createSocialState() {
  return {
    posts: [],
    likes: {},
    follows: {}
  };
}

/**
 * Normalizes social app state.
 *
 * @param {object} [value] - Saved social state.
 * @returns {object} Normalized social state.
 */
export function normalizeSocialState(value = {}) {
  return {
    posts: Array.isArray(value.posts)
      ? value.posts
          .filter((post) => post?.id)
          .map((post) => ({
            id: post.id,
            poster: post.poster ?? null,
            text: post.text ?? "",
            image: post.image ?? null,
            likeFlag: post.likeFlag ?? null,
            followFlag: post.followFlag ?? null,
            metrics: normalizeSocialMetrics(post.metrics ?? post),
            persistent: Boolean(post.persistent)
          }))
      : [],
    likes: normalizeBooleanRecord(value.likes),
    follows: normalizeBooleanRecord(value.follows)
  };
}

/**
 * Enables or replaces the available app list.
 *
 * @param {object} phone - Mutable phone state.
 * @param {string[]} apps - Enabled app ids.
 * @returns {void}
 */
export function setPhoneApps(phone, apps) {
  phone.enabledApps = normalizeAppList(apps, phone.enabledApps);
  phone.homeAppOrder = phone.homeAppOrder.filter((app) => phone.enabledApps.includes(app));
  for (const app of phone.enabledApps) {
    if (!phone.homeAppOrder.includes(app)) {
      phone.homeAppOrder.push(app);
    }
  }
}

/**
 * Adds or replaces a phone notification.
 *
 * @param {object} phone - Mutable phone state.
 * @param {string} app - Target app id.
 * @param {object} options - Notification options.
 * @returns {object} Created notification.
 */
export function addPhoneNotification(phone, app, options = {}) {
  const id = options.id ?? `${app}:${phone.notifications.length + 1}`;
  const notification = {
    id,
    app,
    text: options.text ?? "New notification",
    read: false
  };
  phone.notifications = [
    ...phone.notifications.filter((entry) => entry.id !== id),
    notification
  ];
  phone.badges[app] = true;
  return notification;
}

/**
 * Clears unread notification state for an app.
 *
 * @param {object} phone - Mutable phone state.
 * @param {string} app - App id.
 * @returns {void}
 */
export function clearPhoneNotification(phone, app) {
  phone.notifications = phone.notifications.map((entry) => (
    entry.app === app ? { ...entry, read: true } : entry
  ));
  phone.badges[app] = false;
}

/**
 * Adds or updates a gallery image.
 *
 * @param {object} gallery - Mutable gallery state.
 * @param {object} command - Gallery image command.
 * @returns {void}
 */
export function saveGalleryImageState(gallery, command) {
  const entry = {
    id: command.id,
    image: command.image,
    caption: command.caption ?? "",
    tags: normalizeStringList(command.tags),
    persistent: Boolean(command.persistent)
  };
  gallery.images = [
    ...gallery.images.filter((image) => image.id !== command.id),
    entry
  ];
}

/**
 * Removes a gallery image.
 *
 * @param {object} gallery - Mutable gallery state.
 * @param {string} id - Gallery entry id.
 * @returns {void}
 */
export function removeGalleryImageState(gallery, id) {
  gallery.images = gallery.images.filter((image) => image.id !== id);
}

/**
 * Adds or updates a social post.
 *
 * @param {object} social - Mutable social state.
 * @param {object} command - Social post command.
 * @returns {void}
 */
export function saveSocialPostState(social, command) {
  const post = {
    id: command.id,
    poster: command.poster ?? null,
    text: command.text ?? "",
    image: command.image ?? null,
    likeFlag: command.likeFlag ?? command.like ?? null,
    followFlag: command.followFlag ?? command.follow ?? null,
    metrics: normalizeSocialMetrics(command.metrics ?? command),
    persistent: Boolean(command.persistent)
  };
  social.posts = [
    ...social.posts.filter((entry) => entry.id !== command.id),
    post
  ];
}

/**
 * Merges nonrollback phone presentation choices into reconstructed state.
 *
 * @param {object} target - State being reconstructed.
 * @param {object} preserved - State captured before reconstruction.
 * @returns {void}
 */
export function mergePersistentPhoneState(target, preserved) {
  if (!target?.visuals || !preserved?.visuals) {
    return;
  }
  const preservedPhone = preserved.visuals.phone;
  if (preservedPhone?.wallpaperImage) {
    target.visuals.phone.wallpaperImage = preservedPhone.wallpaperImage;
  }

  const persistentImages = (preserved.visuals.gallery?.images ?? []).filter((image) => image.persistent);
  const targetImages = target.visuals.gallery?.images ?? [];
  if (persistentImages.length && target.visuals.gallery) {
    target.visuals.gallery.images = mergeById(targetImages, persistentImages);
  }

  const persistentPosts = (preserved.visuals.social?.posts ?? []).filter((post) => post.persistent);
  const targetPosts = target.visuals.social?.posts ?? [];
  if (persistentPosts.length && target.visuals.social) {
    target.visuals.social.posts = mergeById(targetPosts, persistentPosts);
  }
}

/**
 * Returns whether the phone has an unread notification.
 *
 * @param {object} phone - Phone state.
 * @returns {boolean} True when any notification is unread.
 */
export function hasUnreadPhoneNotifications(phone) {
  return (phone?.notifications ?? []).some((entry) => !entry.read);
}

/**
 * Normalizes an app id array.
 *
 * @param {unknown} value - Candidate app list.
 * @param {string[]} fallback - Fallback app list.
 * @returns {string[]} App ids.
 */
function normalizeAppList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  return [...new Set(list.filter((app) => typeof app === "string" && app.trim()))];
}

/**
 * Normalizes notification arrays.
 *
 * @param {unknown} value - Candidate notification list.
 * @returns {object[]} Normalized notifications.
 */
function normalizeNotifications(value) {
  return Array.isArray(value)
    ? value
        .filter((entry) => entry?.id && entry?.app)
        .map((entry) => ({
          id: entry.id,
          app: entry.app,
          text: entry.text ?? "New notification",
          read: Boolean(entry.read)
        }))
    : [];
}

/**
 * Normalizes badge records.
 *
 * @param {unknown} value - Candidate badge record.
 * @returns {Record<string, boolean>} Normalized badges.
 */
function normalizeBadges(value) {
  return normalizeBooleanRecord(value);
}

/**
 * Normalizes a boolean record.
 *
 * @param {unknown} value - Candidate record.
 * @returns {Record<string, boolean>} Normalized record.
 */
function normalizeBooleanRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => typeof key === "string" && key)
      .map(([key, enabled]) => [key, Boolean(enabled)])
  );
}

/**
 * Normalizes author-facing string arrays like gallery tags.
 *
 * @param {unknown} value - Candidate string list.
 * @returns {string[]} Clean unique strings.
 */
function normalizeStringList(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()))]
    : [];
}

/**
 * Normalizes social post accessory counts.
 *
 * @param {object} value - Candidate metric values.
 * @returns {{ replies: number, reposts: number, likes: number, views: number }} Metric record.
 */
function normalizeSocialMetrics(value = {}) {
  return {
    replies: normalizeCount(value.replies ?? value.comments ?? value.replyCount ?? value.commentCount),
    reposts: normalizeCount(value.reposts ?? value.shares ?? value.repostCount ?? value.shareCount),
    likes: normalizeCount(value.likes ?? value.likeCount),
    views: normalizeCount(value.views ?? value.viewCount)
  };
}

/**
 * Normalizes a nonnegative integer-ish display count.
 *
 * @param {unknown} value - Candidate count.
 * @returns {number} Nonnegative count.
 */
function normalizeCount(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/**
 * Merges records by id, preferring incoming persistent entries.
 *
 * @param {object[]} current - Existing entries.
 * @param {object[]} incoming - Entries to merge.
 * @returns {object[]} Merged entries.
 */
function mergeById(current, incoming) {
  const merged = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    merged.set(entry.id, entry);
  }
  return [...merged.values()];
}
