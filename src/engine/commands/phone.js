/**
 * Enables or hides the floating phone button.
 *
 * @param {boolean} enabled - True to show the phone button.
 * @returns {object} Phone button command.
 */
export function phoneButton(enabled = true) {
  return {
    type: "phoneButton",
    enabled: Boolean(enabled)
  };
}

/**
 * Replaces the enabled app list for the phone home screen.
 *
 * @param {string[]} apps - Enabled phone app ids.
 * @returns {object} Phone apps command.
 */
export function phoneApps(apps) {
  return {
    type: "phoneApps",
    apps
  };
}

/**
 * Adds an unread phone notification for an app.
 *
 * @param {string} app - Target app id.
 * @param {object} [options] - Notification options.
 * @returns {object} Phone notification command.
 */
export function phoneNotify(app, options = {}) {
  return {
    type: "phoneNotify",
    app,
    ...options
  };
}

/**
 * Marks notifications for an app as read.
 *
 * @param {string} app - App id.
 * @returns {object} Clear notification command.
 */
export function clearPhoneNotify(app) {
  return {
    type: "clearPhoneNotify",
    app
  };
}

/**
 * Opens the phone to a specific app.
 *
 * @param {"home"|"texting"|"gallery"|"social"} app - App id or home.
 * @returns {object} Open phone command.
 */
export function openPhone(app = "home") {
  return {
    type: "openPhone",
    app
  };
}

/**
 * Sets the phone wallpaper image.
 *
 * @param {string|null} image - Image asset id or null.
 * @returns {object} Wallpaper command.
 */
export function setWallpaper(image) {
  return {
    type: "setWallpaper",
    image
  };
}

/**
 * Saves an image into the phone gallery.
 *
 * @param {string} id - Stable gallery entry id.
 * @param {string} image - Image asset id.
 * @param {object} [options] - Gallery metadata.
 * @param {string} [options.caption] - Display caption.
 * @param {string[]} [options.tags] - Gallery sections this image belongs to.
 * @param {boolean} [options.persistent] - True to survive rollback.
 * @returns {object} Gallery save command.
 */
export function saveGalleryImage(id, image, options = {}) {
  return {
    type: "saveGalleryImage",
    id,
    image,
    ...options
  };
}

/**
 * Removes an image from the phone gallery.
 *
 * @param {string} id - Stable gallery entry id.
 * @returns {object} Gallery remove command.
 */
export function removeGalleryImage(id) {
  return {
    type: "removeGalleryImage",
    id
  };
}

/**
 * Adds a post to the social feed.
 *
 * @param {string} id - Stable post id.
 * @param {object} options - Post metadata.
 * @param {number} [options.replies] - Display reply/comment count.
 * @param {number} [options.reposts] - Display repost/share count.
 * @param {number} [options.likes] - Display like count.
 * @param {number} [options.views] - Display view count.
 * @param {object} [options.metrics] - Optional grouped metrics override.
 * @returns {object} Social post command.
 */
export function socialPost(id, options = {}) {
  return {
    type: "socialPost",
    id,
    ...options
  };
}

/**
 * Records a player follow action, optionally setting a story flag.
 *
 * @param {string} poster - Poster id.
 * @param {object} [options] - Follow options.
 * @returns {object} Social follow command.
 */
export function socialFollow(poster, options = {}) {
  return {
    type: "socialFollow",
    poster,
    ...options
  };
}

/**
 * Records a player like action, optionally setting a story flag.
 *
 * @param {string} id - Post id.
 * @param {object} [options] - Like options.
 * @returns {object} Social like command.
 */
export function socialLike(id, options = {}) {
  return {
    type: "socialLike",
    id,
    ...options
  };
}
