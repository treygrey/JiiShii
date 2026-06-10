import {
  clearPhoneNotification,
  hasUnreadPhoneNotifications as phoneHasUnreadPhoneNotifications
} from "../phone-state.js";

/**
 * Builds launcher metadata from registered surface modules. Custom authors can
 * expose a phone app by registering a normal surface with `phoneApp` metadata.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {Record<string, object>} Phone app metadata keyed by surface id.
 */
export function createPhoneAppMetadata(runner) {
  const apps = {};
  for (const [id, surface] of runner.surfaceRegistry.entries()) {
    if (surface.phoneApp) {
      apps[id] = {
        label: surface.phoneApp.label ?? id,
        icon: surface.phoneApp.icon ?? null
      };
    }
  }
  return apps;
}

/**
 * Returns true when a surface id belongs to the shared phone/app system.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string|null} surfaceId - Surface id to inspect.
 * @returns {boolean} True for app-kind surfaces.
 */
export function isPhoneSurface(runner, surfaceId) {
  return runner.surfaceRegistry.get(surfaceId)?.kind === "app";
}

/**
 * Records which top surface is currently acting as phone navigation overlay.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string|null} surfaceId - Phone navigation surface, or null.
 * @returns {void}
 */
export function setPhoneNavigationSurface(runner, surfaceId) {
  runner.phoneNavigationSurface = surfaceId;
  runner.state.phoneNavigationSurface = surfaceId;
}

/**
 * Returns true when a stack entry is acting as navigable phone chrome/app UI,
 * not an authored story surface.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string|null} surfaceId - Surface id to inspect.
 * @param {number} [index] - Surface stack index.
 * @returns {boolean} True when the entry should pause story advancement.
 */
export function isPhoneNavigationLayer(runner, surfaceId, index = runner.surfaceStack.length - 1) {
  if (!surfaceId) {
    return false;
  }
  if (surfaceId === "texting") {
    return runner.phoneNavigationSurface === "texting" && index === runner.surfaceStack.length - 1;
  }
  return runner.isPhoneSurface(surfaceId);
}

/**
 * Returns true when focus is currently inside phone chrome instead of the
 * authored story surface.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True when a phone app is open.
 */
export function isPhoneOpen(runner) {
  const top = runner.surfaceStack[runner.surfaceStack.length - 1] ?? runner.state.currentSurface ?? null;
  return runner.isPhoneNavigationLayer(top);
}

/**
 * Returns true when Messages was opened from phone navigation and should
 * start at the conversation list.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True when the Messages inbox should be shown.
 */
export function isTextingInboxMode(runner) {
  const topSurface = runner.surfaceStack[runner.surfaceStack.length - 1] ?? runner.state.currentSurface ?? null;
  return topSurface === "texting" && runner.phoneNavigationSurface === "texting" && runner.isPhoneOpen();
}

/**
 * Returns true when the currently visible texting surface is the authored
 * story thread, not the Messages app opened through phone navigation.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True when story progress should remain available.
 */
export function isStoryTextingActive(runner) {
  const topSurface = runner.surfaceStack[runner.surfaceStack.length - 1] ?? runner.state.currentSurface ?? null;
  return topSurface === "texting" && !runner.isTextingInboxMode();
}

/**
 * Finds the story surface underneath an open phone app.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {string|null} Surface id to return to.
 */
export function getPhoneReturnSurface(runner) {
  for (let index = runner.surfaceStack.length - 1; index >= 0; index -= 1) {
    const surfaceId = runner.surfaceStack[index];
    if (!runner.isPhoneNavigationLayer(surfaceId, index)) {
      return surfaceId;
    }
  }
  const currentSurface = runner.state.currentSurface ?? null;
  return runner.isPhoneSurface(currentSurface) ? "texting" : currentSurface;
}

/**
 * Opens a phone app through the runner's phone navigation policy.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} app - App id.
 * @param {object} [options] - Navigation options.
 * @returns {void}
 */
export function openPhoneApp(runner, app = "home", options = {}) {
  const { fromHistory = false } = options;
  const surfaceId = app === "home" ? "phone_home" : app;
  if (!runner.surfaceRegistry.has(surfaceId)) {
    return;
  }
  const returnSurface = runner.getPhoneReturnSurface() ?? runner.state.currentSurface ?? "texting";
  const topSurface = runner.surfaceStack[runner.surfaceStack.length - 1] ?? null;
  const previousApp = runner.state.visuals.phone.currentApp ?? "home";
  if (!fromHistory && runner.isPhoneOpen() && previousApp !== app) {
    runner.phoneAppHistory.push(previousApp);
  }
  runner.state.visuals.phone.currentApp = app;
  if (app !== "home") {
    clearPhoneNotification(runner.state.visuals.phone, app);
  }
  if (runner.isPhoneOpen()) {
    if (surfaceId === returnSurface) {
      runner.returnToStorySurface();
    } else if (topSurface !== surfaceId) {
      while (runner.surfaceStack.length > 1 && runner.isPhoneNavigationLayer(runner.surfaceStack.at(-1))) {
        runner.popSurface();
      }
      runner.setPhoneNavigationSurface(surfaceId);
      runner.pushSurface(surfaceId);
    }
  } else if (surfaceId !== returnSurface) {
    runner.setPhoneNavigationSurface(surfaceId);
    runner.pushSurface(surfaceId);
  } else {
    runner.setPhoneNavigationSurface(null);
  }
  if (!runner.reconstructing) {
    runner.updatePhoneCheckpointState();
    runner.save();
  }
}

/**
 * Moves to the previous phone app, or closes the phone when history is empty.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function goBackPhoneApp(runner) {
  if (!runner.isPhoneOpen()) {
    return;
  }
  const previousApp = runner.phoneAppHistory.pop();
  if (previousApp) {
    runner.openPhoneApp(previousApp, { fromHistory: true });
    return;
  }
  runner.returnToStorySurface();
}

/**
 * Toggles the phone through the runner's phone navigation policy.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function togglePhone(runner) {
  if (runner.isPhoneOpen()) {
    runner.returnToStorySurface();
    return;
  }
  runner.openPhoneApp("home");
}

/**
 * Closes phone app layers and restores the story surface underneath.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {void}
 */
export function returnToStorySurface(runner) {
  const returnSurface = runner.getPhoneReturnSurface() ?? "texting";
  runner.phoneAppHistory = [];
  while (runner.surfaceStack.length > 1 && runner.isPhoneNavigationLayer(runner.surfaceStack.at(-1))) {
    runner.popSurface();
  }
  runner.setPhoneNavigationSurface(null);
  if (runner.state.currentSurface !== returnSurface && runner.surfaceRegistry.has(returnSurface)) {
    runner.setSurface(returnSurface);
  }
}

/**
 * Reports whether the floating phone button should show an unread badge.
 *
 * @param {object} runner - Scene runner instance.
 * @returns {boolean} True when unread notifications exist.
 */
export function hasUnreadPhoneNotifications(runner) {
  return phoneHasUnreadPhoneNotifications(runner.state.visuals.phone);
}

/**
 * Sets wallpaper from player UI without advancing the script.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string|null} image - Image asset id.
 * @returns {void}
 */
export function setPhoneWallpaper(runner, image) {
  runner.state.visuals.phone.wallpaperImage = image ?? null;
  runner.syncVisualState({ instant: true });
  runner.updatePhoneCheckpointState();
  runner.save();
}

/**
 * Records a player social like without advancing the script.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} id - Post id.
 * @param {string|null} [flag] - Optional story flag.
 * @returns {void}
 */
export function likeSocialPost(runner, id, flag = null) {
  runner.state.visuals.social.likes[id] = true;
  if (flag) {
    runner.state.vars[flag] = true;
  }
  runner.projectSurface("social", { instant: true });
  runner.updatePhoneCheckpointState();
  runner.save();
}

/**
 * Records a player social follow without advancing the script.
 *
 * @param {object} runner - Scene runner instance.
 * @param {string} poster - Poster id.
 * @param {string|null} [flag] - Optional story flag.
 * @returns {void}
 */
export function followSocialPoster(runner, poster, flag = null) {
  runner.state.visuals.social.follows[poster] = true;
  if (flag) {
    runner.state.vars[flag] = true;
  }
  runner.projectSurface("social", { instant: true });
  runner.updatePhoneCheckpointState();
  runner.save();
}
