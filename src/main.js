import "./styles.css";
import { validateScenes } from "./engine/validator.js";
import { normalizeGameConfig } from "./engine/game-config.js";
import { createInitialState } from "./engine/state.js";
import { readSaveMetadata } from "./engine/save-format.js";
import { SceneRunner } from "./engine/runner.js";
import { LayerCompositor } from "./engine/layer-compositor.js";
import { BackgroundTransitioner } from "./engine/background-transitioner.js";
import { BrowserAudioService } from "./engine/audio-service.js";
import { setMarkupVarsProvider } from "./engine/markup.js";
import { createDebugOverlay } from "./ui/debug-overlay.js";
import { createHistoryRows, historySurfaceLabel } from "./ui/shell-history.js";
import { createSaveSlotView } from "./ui/shell-save-slots.js";
import {
  DEFAULT_SHELL_SETTINGS,
  autoDelayLabel,
  parseShellSettings,
  speedLabel,
  volumeLabel
} from "./ui/shell-settings.js";
import { isEditableTarget, resolveShellShortcut } from "./ui/shell-shortcuts.js";
import { TextingRenderer } from "./renderers/texting/texting-renderer.js";
import { IrlRenderer } from "./renderers/irl/irl-renderer.js";
import { StreamingRenderer } from "./renderers/streaming/streaming-renderer.js";
import { PhoneHomeRenderer } from "./renderers/phone/phone-home-renderer.js";
import { GalleryRenderer } from "./renderers/phone/gallery-renderer.js";
import { SocialRenderer } from "./renderers/phone/social-renderer.js";
import { loadGamePackage } from "./player/package-loader.js";

let GAME_PACKAGE = null;
let GAME = null;
let SCENES = null;
let FIRST_SCENE_ID = null;
let SURFACE_MODULES = null;
let SURFACE_RENDERER_CONSTRUCTORS = null;
let GLOBAL_CHARACTERS = null;
let listImageIds = null;
let resolveImage = null;
let resolveImageAmbiguity = null;
let listAudioIds = null;
let resolveAudio = null;
let resolveAudioAmbiguity = null;
let listExpressions = null;
let listBodies = null;
let listOutfits = null;
let listMissingRequiredSpriteLayers = null;
let resolveExpression = null;
let resolveSprite = null;
let SAVE_KEY = null;
let AUTOSAVE_KEY = null;
let SETTINGS_KEY = null;
let SLOT_PREFIX = null;
let LEGACY_SAVE_KEY = null;
let LEGACY_AUTOSAVE_KEY = null;
let LEGACY_SETTINGS_KEY = null;
let LEGACY_SLOT_PREFIX = null;
let GAME_TITLE = null;
let GAME_SUBTITLE = null;
let GAME_FOOTER = null;
let ABOUT_TEXT = null;
let SAVE_TITLE = null;
let LOAD_TITLE = null;
let AUTOSAVE_LABEL = null;
let MANUAL_SLOT_COUNT = null;
let MANUAL_SLOT_LABEL = null;
let PREFERENCES_TITLE = null;
let PREFERENCES_DEFAULTS_LABEL = null;
let HISTORY_TITLE = null;
let HISTORY_EMPTY_LABEL = null;
let CONFIRM_OVERWRITE = null;
let CONFIRM_LOAD = null;
let END_KICKER = null;
let END_TITLE = null;
let END_DEFAULT_MESSAGE = null;
let MISSING_TARGET_MESSAGE = null;
let RETURN_TO_TITLE_LABEL = null;
let PHONE_CONFIG = null;
let settings = null;
let runner = null;
let autoOn = false;
let skipOn = false;
let autoTimer = null;
let appRoot = null;
let stage = null;
let quickMenu = null;
let mainMenu = null;
let phoneButton = null;
let stageBg = null;
let backgrounds = null;

bootApp().catch((error) => {
  console.error(error);
  const root = document.querySelector("#app");
  if (root) {
    root.innerHTML = `
      <div class="scene-errors">
        <div class="scene-errors-card">
          <h2>JiiShii could not start</h2>
          <p>${escapeHtml(error?.message ?? error)}</p>
        </div>
      </div>
    `;
  }
});

/**
 * Returns the configured manual save-slot key.
 *
 * @param {number} slot - Slot number.
 * @returns {string} Storage key.
 */
function saveSlotKey(slot) {
  return `${SLOT_PREFIX}${slot}`;
}

/**
 * Reads the first populated localStorage value from a key list.
 *
 * @param {Array<string|null>} keys - Candidate keys.
 * @returns {string|null} Stored value or null.
 */
function readFirstStorage(keys) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }
  return null;
}

/**
 * Loads the active package, initializes shell constants, and wires the player.
 *
 * @returns {Promise<void>} Resolves when the player shell is ready.
 */
async function bootApp() {
  GAME_PACKAGE = await loadGamePackage();
  GAME = normalizeGameConfig(GAME_PACKAGE.gameConfig);
  SCENES = GAME_PACKAGE.scenes;
  FIRST_SCENE_ID = GAME_PACKAGE.firstSceneId;
  SURFACE_MODULES = GAME_PACKAGE.surfaceModules;
  SURFACE_RENDERER_CONSTRUCTORS = GAME_PACKAGE.rendererConstructors;
  GLOBAL_CHARACTERS = GAME_PACKAGE.globalCharacters;
  ({
    listImageIds,
    resolveImage,
    resolveImageAmbiguity,
    listAudioIds,
    resolveAudio,
    resolveAudioAmbiguity,
    listExpressions,
    listBodies,
    listOutfits,
    listMissingRequiredSpriteLayers,
    resolveExpression,
    resolveSprite
  } = GAME_PACKAGE);
  for (const warning of GAME_PACKAGE.packageWarnings ?? []) {
    console.warn(`[package] ${warning}`);
  }
  SAVE_KEY = GAME.storage.save;
  AUTOSAVE_KEY = GAME.storage.autosave;
  SETTINGS_KEY = GAME.storage.settings;
  SLOT_PREFIX = GAME.storage.slotPrefix;
  LEGACY_SAVE_KEY = GAME.storage.legacySave;
  LEGACY_AUTOSAVE_KEY = GAME.storage.legacyAutosave;
  LEGACY_SETTINGS_KEY = GAME.storage.legacySettings;
  LEGACY_SLOT_PREFIX = GAME.storage.legacySlotPrefix;
  GAME_TITLE = GAME.title;
  GAME_SUBTITLE = GAME.subtitle;
  GAME_FOOTER = GAME.footer;
  ABOUT_TEXT = GAME.about;
  SAVE_TITLE = GAME.shell.saveTitle;
  LOAD_TITLE = GAME.shell.loadTitle;
  AUTOSAVE_LABEL = GAME.shell.autosaveLabel;
  MANUAL_SLOT_COUNT = GAME.shell.manualSlotCount;
  MANUAL_SLOT_LABEL = GAME.shell.manualSlotLabel;
  PREFERENCES_TITLE = GAME.shell.preferencesTitle;
  PREFERENCES_DEFAULTS_LABEL = GAME.shell.preferencesDefaultsLabel;
  HISTORY_TITLE = GAME.shell.historyTitle;
  HISTORY_EMPTY_LABEL = GAME.shell.historyEmptyLabel;
  CONFIRM_OVERWRITE = GAME.shell.confirmOverwrite;
  CONFIRM_LOAD = GAME.shell.confirmLoad;
  END_KICKER = GAME.shell.endKicker;
  END_TITLE = GAME.shell.endTitle;
  END_DEFAULT_MESSAGE = GAME.shell.endDefaultMessage;
  MISSING_TARGET_MESSAGE = GAME.shell.missingTargetMessage;
  RETURN_TO_TITLE_LABEL = GAME.shell.returnToTitleLabel;
  PHONE_CONFIG = GAME.phone;
  settings = loadSettings();

  if (import.meta.env.DEV) {
    window.__JIISHII_TEST__ = {
      get runner() {
        return runner;
      },
      getState() {
        return runner?.getDebugSnapshot?.() ?? null;
      }
    };
  }

  appRoot = document.querySelector("#app");
  appRoot.innerHTML = buildShell();
  stage = appRoot.querySelector("#game-stage");
  quickMenu = appRoot.querySelector(".quick-menu");
  mainMenu = appRoot.querySelector("#main-menu");
  phoneButton = appRoot.querySelector("[data-phone-button]");

  stageBg = document.createElement("div");
  stageBg.className = "stage-bg";
  stageBg.setAttribute("aria-hidden", "true");
  stage.append(stageBg);
  backgrounds = new BackgroundTransitioner(stageBg, {
    resolveImage,
    shouldInstant: () => skipOn
  });

  setMarkupVarsProvider(() => runner?.state?.vars ?? {});
  createDebugOverlay({ getRunner: () => runner });

  bootMenu();
  wireMainMenu();
  wireQuickMenu();
  wireOverlays();
  wirePhoneButton();
  wirePhoneChromeNavigation();
  refreshContinueState();
  wireStoryInput();
  validateActiveScenes();
}

/**
 * Wires stage click, rollback, and shell shortcuts after the shell exists.
 *
 * @returns {void}
 */
function wireStoryInput() {
  stage.addEventListener("click", () => {
    if (hasOpenOverlay()) {
      return;
    }
    runner?.advance();
  });

  let lastRollbackAt = 0;
  const tryRollback = (direction) => {
    if (!runner || !mainMenu.hidden) {
      return;
    }
    if (hasOpenOverlay()) {
      return;
    }
    const now = performance.now();
    if (now - lastRollbackAt < 90) {
      return;
    }
    lastRollbackAt = now;
    if (direction < 0) {
      runner.rollBack();
    } else {
      runner.rollForward();
    }
  };

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.target.closest?.(".message-list, .phone-app-shell")) {
        return;
      }
      tryRollback(event.deltaY < 0 ? -1 : 1);
    },
    { passive: true }
  );
  window.addEventListener("keydown", (event) => {
    if (event.key === "PageUp") {
      event.preventDefault();
      tryRollback(-1);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      tryRollback(1);
    } else {
      const action = resolveShellShortcut({
        key: event.key,
        hasOverlay: hasOpenOverlay(),
        inMenu: !mainMenu.hidden,
        isEditable: isEditableTarget(event.target),
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey
      });
      if (action) {
        event.preventDefault();
        handleShellAction(action);
      }
    }
  });
}

/**
 * Validates every scene up front and blocks play on production errors.
 *
 * @returns {void}
 */
function validateActiveScenes() {
  const sceneCheck = validateScenes(SCENES, {
    surfaceModules: SURFACE_MODULES,
    audioScenes: GAME.audioScenes,
    globalCharacters: GLOBAL_CHARACTERS,
    resolveImage,
    resolveImageAmbiguity,
    listImageIds,
    resolveAudio,
    resolveAudioAmbiguity,
    listAudioIds,
    resolveExpression,
    listExpressions,
    listBodies,
    listOutfits,
    listMissingRequiredSpriteLayers
  });
  sceneCheck.warnings.forEach((warning) => console.warn(`[scene check] ${warning}`));
  if (sceneCheck.testWarnings?.length) {
    console.groupCollapsed(`[scene check] ${sceneCheck.testWarnings.length} note(s) from demo/test scenes`);
    sceneCheck.testWarnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }
  if (sceneCheck.errors.length) {
    showSceneErrors(sceneCheck.errors);
  }
}
/**
 * Shows a blocking, plain-English panel of scene errors and refuses to play.
 *
 * @param {string[]} errors - Validation error messages.
 * @returns {void}
 */
function showSceneErrors(errors) {
  errors.forEach((error) => console.error(`[scene check] ${error}`));
  const panel = document.createElement("div");
  panel.className = "scene-errors";
  panel.innerHTML = `
    <div class="scene-errors-card">
      <h2>This scene can't run yet</h2>
      <p>Found ${errors.length} thing${errors.length === 1 ? "" : "s"} to fix:</p>
      <ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>
    </div>
  `;
  appRoot.append(panel);
}

// =============================================================================
// SHELL
// =============================================================================

/**
 * Builds the static app shell HTML: game stage, quick menu, title screen, and
 * the preferences / history / about / scene-end overlays.
 *
 * @returns {string} Shell markup.
 */
function buildShell() {
  return `
    <div class="vn-root">
      <div id="game-stage" class="game-stage"></div>
      <button class="floating-phone-button" type="button" data-phone-button hidden aria-label="Open phone">
        <span class="floating-phone-glyph" aria-hidden="true"></span>
        <span class="floating-phone-badge" aria-hidden="true"></span>
      </button>

      <div class="quick-menu" hidden>
        <button type="button" data-q="back">Back</button>
        <span class="quick-sep"></span>
        <button type="button" data-q="history">History</button>
        <button type="button" data-q="auto">Auto</button>
        <button type="button" data-q="skip">Skip</button>
        <span class="quick-sep"></span>
        <button type="button" data-q="save">Save</button>
        <button type="button" data-q="load">Load</button>
        <button type="button" data-q="prefs">Prefs</button>
        <button type="button" data-q="menu">Menu</button>
      </div>

      <section class="menu-screen" id="main-menu">
        <div class="menu-bg" aria-hidden="true"></div>
        <div class="menu-vignette" aria-hidden="true"></div>
        <div class="menu-inner">
          <div class="menu-brand">
            <h1>${GAME_TITLE}</h1>
            <p>${escapeHtml(GAME_SUBTITLE)}</p>
          </div>
          <nav class="menu-nav">
            <button type="button" data-m="start">Start</button>
            <button type="button" data-m="continue">Continue</button>
            <button type="button" data-m="prefs">Preferences</button>
            <button type="button" data-m="about">About</button>
          </nav>
        </div>
        <div class="menu-foot">${escapeHtml(GAME_FOOTER)}</div>
      </section>

      <div class="overlay" id="prefs-overlay" hidden>
        <div class="overlay-card">
          <header class="overlay-head"><h2>${escapeHtml(PREFERENCES_TITLE)}</h2><button type="button" data-close>Close</button></header>
          <div class="pref-row">
            <label for="pref-speed">Text speed</label>
            <input id="pref-speed" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-speed-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-auto">Auto-forward time</label>
            <input id="pref-auto" type="range" min="400" max="4000" step="100" />
            <span class="pref-val" data-auto-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-master">Master volume</label>
            <input id="pref-master" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-master-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-music">Music volume</label>
            <input id="pref-music" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-music-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-ambience">Ambience volume</label>
            <input id="pref-ambience" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-ambience-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-sound">Sound volume</label>
            <input id="pref-sound" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-sound-val></span>
          </div>
          <div class="pref-row">
            <label for="pref-voice">Voice volume</label>
            <input id="pref-voice" type="range" min="0" max="1" step="0.05" />
            <span class="pref-val" data-voice-val></span>
          </div>
          <div class="pref-actions">
            <button type="button" data-pref-defaults>${escapeHtml(PREFERENCES_DEFAULTS_LABEL)}</button>
          </div>
        </div>
      </div>

      <div class="overlay" id="history-overlay" hidden>
        <div class="overlay-card overlay-card--tall">
          <header class="overlay-head"><h2>${escapeHtml(HISTORY_TITLE)}</h2><button type="button" data-close>Close</button></header>
          <div class="history-log" data-history></div>
        </div>
      </div>

      <div class="overlay" id="saves-overlay" hidden>
        <div class="overlay-card overlay-card--tall">
          <header class="overlay-head"><h2 id="saves-title">${escapeHtml(SAVE_TITLE)}</h2><button type="button" data-close>Close</button></header>
          <p class="save-feedback" id="save-feedback" role="status" aria-live="polite"></p>
          <div class="save-grid" id="save-grid"></div>
        </div>
      </div>

      <div class="overlay" id="about-overlay" hidden>
        <div class="overlay-card">
          <header class="overlay-head"><h2>About</h2><button type="button" data-close>Close</button></header>
          <p class="about-text">${escapeHtml(ABOUT_TEXT)}</p>
        </div>
      </div>

      <div class="overlay overlay--solid" id="end-overlay" hidden>
        <div class="end-card">
          <p class="end-kicker">${escapeHtml(END_KICKER)}</p>
          <h2 class="end-title">${escapeHtml(END_TITLE)}</h2>
          <p class="end-sub" data-end-sub></p>
          <button type="button" data-end-menu>${escapeHtml(RETURN_TO_TITLE_LABEL)}</button>
        </div>
      </div>

      <div class="overlay overlay--lightbox" id="lightbox-overlay" hidden>
        <img class="lightbox-image" src="" alt="Attachment fullscreen view" />
      </div>
    </div>
  `;
}

// =============================================================================
// MENU + GAME LIFECYCLE
// =============================================================================

/**
 * Sets the shared background (IRL room) layer and recesses it behind the
 * active surface. A null/unknown id clears it.
 *
 * @param {string | null} id - Background asset id.
 * @returns {void}
 */
function setBackground(id, options = {}) {
  if (!id || !resolveImage(id)) {
    clearBackground();
    return;
  }
  stageBg.classList.add("is-visible");
  backgrounds.show(id, options);
}

/**
 * Clears the background layer and scrim.
 *
 * @returns {void}
 */
function clearBackground() {
  backgrounds.clear();
  stageBg.classList.remove("is-visible");
}

/**
 * Removes renderer-mounted surfaces from the stage while preserving the
 * persistent compositor layers (background, scrim).
 *
 * @returns {void}
 */
function clearSurfaces() {
  for (const child of [...stage.children]) {
    // Preserve the background and any compositor-owned elements
    if (child === stageBg || child.classList.contains("compositor-scrim") || child.classList.contains("compositor-narration")) {
      continue;
    }
    child.remove();
  }
}

/**
 * Tears down the active runner's presentation objects before replacing it.
 *
 * @param {object} [options] - Teardown options.
 * @param {boolean} [options.stopAudio] - Stop all audio owned by the runner.
 * @returns {void}
 */
function teardownActiveRunner({ stopAudio = false } = {}) {
  runner?.teardownMountedSurfaces?.();
  runner?.compositor?.dispose?.();
  if (stopAudio) {
    runner?.audio?.stopAll?.();
  }
}

/**
 * Shows the title screen and hides in-game chrome.
 *
 * @returns {void}
 */
function bootMenu() {
  teardownActiveRunner({ stopAudio: true });
  mainMenu.hidden = false;
  quickMenu.hidden = true;
  if (phoneButton) {
    phoneButton.hidden = true;
  }
  closeAllOverlays();
  clearSurfaces();
  clearBackground();
}

/**
 * Wires the title-screen buttons.
 *
 * @returns {void}
 */
function wireMainMenu() {
  mainMenu.querySelector('[data-m="start"]').addEventListener("click", () => startGame({ load: false }));
  mainMenu.querySelector('[data-m="continue"]').addEventListener("click", () => startGame({ load: true }));
  mainMenu.querySelector('[data-m="prefs"]').addEventListener("click", () => {
    syncPreferenceControls();
    setOverlay("prefs-overlay", true);
  });
  mainMenu.querySelector('[data-m="about"]').addEventListener("click", () => setOverlay("about-overlay", true));
}

/**
 * Greys out Continue when there is no save to resume.
 *
 * @returns {void}
 */
function refreshContinueState() {
  const button = mainMenu.querySelector('[data-m="continue"]');
  const hasSave = Boolean(readFirstStorage([
    AUTOSAVE_KEY,
    SAVE_KEY,
    LEGACY_AUTOSAVE_KEY,
    LEGACY_SAVE_KEY
  ]));
  button.disabled = !hasSave;
}

/**
 * Wires the optional floating phone button.
 *
 * @returns {void}
 */
function wirePhoneButton() {
  phoneButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    runner?.togglePhone?.();
    syncPhoneButton();
  });
  window.setInterval(syncPhoneButton, 150);
}

/**
 * Routes shared phone OS chrome before individual surfaces treat it as a
 * story-advance dead zone. This keeps the Android home control reliable for
 * built-in and custom phone apps.
 *
 * @returns {void}
 */
function wirePhoneChromeNavigation() {
  const routePhoneChrome = (event) => {
    const navTarget = event.target.closest?.("[data-phone-nav]");
    if (!navTarget || !stage.contains(navTarget)) {
      return;
    }
    event.stopPropagation();
    if (navTarget.dataset.phoneNav === "home") {
      runner?.openPhoneApp?.("home");
      syncPhoneButton();
    }
  };
  document.addEventListener("click", routePhoneChrome, true);
  document.addEventListener("pointerup", routePhoneChrome, true);
}

/**
 * Projects runner phone state into the floating button.
 *
 * @returns {void}
 */
function syncPhoneButton() {
  if (!phoneButton) {
    return;
  }
  const phone = runner?.state?.visuals?.phone;
  const visible = Boolean(
    PHONE_CONFIG.enabled &&
    runner &&
    mainMenu.hidden &&
    phone?.isButtonEnabled
  );
  phoneButton.hidden = !visible;
  phoneButton.classList.toggle("has-badge", Boolean(runner?.hasUnreadPhoneNotifications?.()));
  phoneButton.setAttribute("aria-label", runner?.isPhoneOpen?.() ? "Return to story" : "Open phone");
}

/**
 * Builds a fresh runner + renderers and begins play (new game or loaded save).
 *
 * @param {object} options - Start options.
 * @param {boolean} options.load - Resume from the existing save when true.
 * @returns {void}
 */
function startGame({ load }) {
  cancelAuto();
  autoOn = false;
  skipOn = false;
  teardownActiveRunner({ stopAudio: true });
  clearSurfaces();
  clearBackground();

  const rendererOptions = {
    getSettings: getEffectiveSettings,
    onLog: logMessage,
    resolveImage,
    resolveSprite,
    resolveExpression
  };
  const renderers = {
    texting: new TextingRenderer(stage, rendererOptions),
    irl: new IrlRenderer(stage, rendererOptions),
    streaming: new StreamingRenderer(stage, rendererOptions),
    phone_home: new PhoneHomeRenderer(stage, rendererOptions),
    gallery: new GalleryRenderer(stage, rendererOptions),
    social: new SocialRenderer(stage, rendererOptions),
    ...createDiscoveredSurfaceRenderers(rendererOptions)
  };

  // Create the layer compositor that manages z-index stacking of surfaces,
  // the shared blur scrim, and the unified narration box.
  const compositor = new LayerCompositor(stage, {
    getSettings: getEffectiveSettings,
    onLog: logMessage,
    onAdvance: () => runner?.advance()
  });
  compositor.registerBackground(stageBg);
  const audio = new BrowserAudioService({
    getSettings: getEffectiveSettings,
    onLog: logMessage,
    resolveAudio
  });

  runner = new SceneRunner({
    initialScene: SCENES[FIRST_SCENE_ID],
    initialState: createInitialState(),
    renderers,
    compositor,
    registry: SCENES,
    surfaceModules: SURFACE_MODULES,
    audioScenes: GAME.audioScenes,
    globalCharacters: GLOBAL_CHARACTERS,
    phoneConfig: PHONE_CONFIG,
    onIdle: scheduleAuto,
    onTransition: handleSceneEnd,
    onBackground: setBackground,
    audio,
    storageKeys: {
      save: SAVE_KEY,
      autosave: AUTOSAVE_KEY,
      slotPrefix: SLOT_PREFIX,
      legacySave: LEGACY_SAVE_KEY,
      legacyAutosave: LEGACY_AUTOSAVE_KEY,
      legacySlotPrefix: LEGACY_SLOT_PREFIX
    }
  });

  for (const renderer of Object.values(renderers)) {
    renderer.bindRunner(runner);
  }

  mainMenu.hidden = true;
  quickMenu.hidden = false;
  setOverlay("end-overlay", false);
  syncToggleButtons();

  if (load && readFirstStorage([AUTOSAVE_KEY, SAVE_KEY, LEGACY_AUTOSAVE_KEY, LEGACY_SAVE_KEY])) {
    runner.load({ auto: true });
  } else {
    runner.start();
  }
  syncPhoneButton();
}

/**
 * Instantiates renderers exported by discovered surface modules.
 *
 * @param {object} rendererOptions - Shared renderer options.
 * @returns {Record<string, object>} Renderer instances keyed by surface id.
 */
function createDiscoveredSurfaceRenderers(rendererOptions) {
  return Object.fromEntries(
    Object.entries(SURFACE_RENDERER_CONSTRUCTORS).map(([surfaceId, Renderer]) => [
      surfaceId,
      new Renderer(stage, rendererOptions)
    ])
  );
}

/**
 * Handles a scene-ending transition with no further scene to load.
 *
 * @param {string | null} target - Unresolved transition target.
 * @returns {void}
 */
function handleSceneEnd(target) {
  cancelAuto();
  autoOn = false;
  skipOn = false;
  syncToggleButtons();
  const sub = appRoot.querySelector("[data-end-sub]");
  sub.textContent = target ? MISSING_TARGET_MESSAGE(target) : END_DEFAULT_MESSAGE;
  setOverlay("end-overlay", true);
}

// =============================================================================
// QUICK MENU
// =============================================================================

/**
 * Wires the in-game quick menu bar and the scene-end overlay button.
 *
 * @returns {void}
 */
function wireQuickMenu() {
  quickMenu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-q]")?.dataset.q;
    if (!action) {
      return;
    }
    handleShellAction(action);
  });

  appRoot.querySelector("[data-end-menu]").addEventListener("click", () => {
    setOverlay("end-overlay", false);
    bootMenu();
    refreshContinueState();
  });
}

/**
 * Runs one player-shell action from the quick menu or keyboard shortcuts.
 *
 * @param {string} action - Shell action id.
 * @returns {void}
 */
function handleShellAction(action) {
  if (action === "back") {
    cancelAuto();
    autoOn = false;
    skipOn = false;
    syncToggleButtons();
    tryRollback(-1);
  } else if (action === "history") {
    renderHistory();
    setOverlay("history-overlay", true);
  } else if (action === "auto") {
    toggleAuto();
  } else if (action === "skip") {
    toggleSkip();
  } else if (action === "save") {
    renderSaveGrid("save");
    setOverlay("saves-overlay", true);
  } else if (action === "load") {
    renderSaveGrid("load");
    setOverlay("saves-overlay", true);
  } else if (action === "prefs") {
    syncPreferenceControls();
    setOverlay("prefs-overlay", true);
  } else if (action === "menu") {
    cancelAuto();
    autoOn = false;
    skipOn = false;
    bootMenu();
    refreshContinueState();
  } else if (action === "closeOverlay") {
    closeTopOverlay();
  }
}

/**
 * Toggles auto-forward mode.
 *
 * @returns {void}
 */
function toggleAuto() {
  autoOn = !autoOn;
  if (skipOn && autoOn) {
    skipOn = false;
  }
  syncToggleButtons();
  if (autoOn) {
    scheduleAuto();
  } else {
    cancelAuto();
  }
}

/**
 * Toggles skip mode (fast auto-forward).
 *
 * @returns {void}
 */
function toggleSkip() {
  skipOn = !skipOn;
  if (skipOn && autoOn) {
    autoOn = false;
  }
  syncToggleButtons();
  if (skipOn) {
    scheduleAuto();
  } else {
    cancelAuto();
  }
}

/**
 * Reflects auto/skip state on the toggle buttons.
 *
 * @returns {void}
 */
function syncToggleButtons() {
  quickMenu.querySelector('[data-q="auto"]').classList.toggle("is-active", autoOn);
  quickMenu.querySelector('[data-q="skip"]').classList.toggle("is-active", skipOn);
}

/**
 * Schedules the next auto/skip advance when either mode is active.
 *
 * @returns {void}
 */
function scheduleAuto() {
  if (!autoOn && !skipOn) {
    return;
  }
  cancelAuto();
  const delay = skipOn ? 150 : settings.autoDelay;
  autoTimer = window.setTimeout(() => {
    if ((autoOn || skipOn) && runner && !runner.isBlockingInput() && !hasOpenOverlay() && mainMenu.hidden) {
      runner.advance();
    }
  }, delay);
}

/**
 * Cancels any pending auto/skip advance.
 *
 * @returns {void}
 */
function cancelAuto() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

// =============================================================================
// OVERLAYS + HISTORY + SAVES
// =============================================================================

/**
 * Renders the save/load selector grid.
 *
 * @param {"save"|"load"} mode - Which mode the overlay is in.
 * @returns {void}
 */
/**
 * Renders the save/load selector grid with save-envelope metadata.
 *
 * @param {"save"|"load"} mode - Which mode the overlay is in.
 * @returns {void}
 */
function renderSaveGrid(mode) {
  const title = appRoot.querySelector("#saves-title");
  title.textContent = mode === "save" ? SAVE_TITLE : LOAD_TITLE;
  showSaveFeedback("");

  const grid = appRoot.querySelector("#save-grid");
  grid.innerHTML = "";

  const autoRaw = readFirstStorage([AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEY]);
  const autoData = readSlotMetadata(autoRaw);
  const autoView = createSaveSlotView(AUTOSAVE_LABEL, autoData);
  const autoButton = document.createElement("button");
  autoButton.className = `save-tile auto-tile ${autoView.className}`;
  autoButton.type = "button";
  autoButton.disabled = mode === "save" || !autoView.canLoad;
  autoButton.innerHTML = renderSlotContent(autoView);
  autoButton.addEventListener("click", () => handleSlotClick(mode, null, true, autoData));
  grid.append(autoButton);

  for (let slot = 1; slot <= MANUAL_SLOT_COUNT; slot += 1) {
    const raw = readFirstStorage([
      saveSlotKey(slot),
      LEGACY_SLOT_PREFIX ? `${LEGACY_SLOT_PREFIX}${slot}` : null
    ]);
    const data = readSlotMetadata(raw);
    const view = createSaveSlotView(`${MANUAL_SLOT_LABEL} ${slot}`, data);
    const button = document.createElement("button");
    button.className = `save-tile ${view.className}`;
    button.type = "button";
    button.disabled = mode === "load" && !view.canLoad;
    button.innerHTML = renderSlotContent(view);
    button.addEventListener("click", () => handleSlotClick(mode, slot, false, data));
    grid.append(button);
  }
}

/**
 * Reads slot metadata and keeps corrupt saves visible as load targets.
 *
 * @param {string|null} rawSave - Raw localStorage save payload.
 * @returns {object|null} Slot metadata or null for an empty slot.
 */
function readSlotMetadata(rawSave) {
  if (!rawSave) {
    return null;
  }
  return readSaveMetadata(rawSave) ?? { corrupted: true };
}

/**
 * Renders a save slot with scene, kind, surface, and timestamp metadata.
 *
 * @param {object} view - Slot view model.
 * @returns {string} Slot HTML.
 */
function renderSlotContent(view) {
  return `
    <span class="save-slot-id">${escapeHtml(view.label)}</span>
    <span class="save-scene">${escapeHtml(view.scene)}</span>
    <span class="save-kind">${escapeHtml(view.detail)}</span>
    <span class="save-date">${escapeHtml(view.date)}</span>
  `;
}

/**
 * Shows save/load feedback inside the save overlay.
 *
 * @param {string} message - Feedback text.
 * @returns {void}
 */
function showSaveFeedback(message) {
  const feedback = appRoot.querySelector("#save-feedback");
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.hidden = !message;
}

/**
 * Handles clicking a slot in the save grid.
 *
 * @param {"save"|"load"} mode - The active menu mode.
 * @param {number|null} slot - The manual slot number (or null for auto).
 * @param {boolean} isAuto - True if the autosave slot was clicked.
 * @param {object|null} metadata - Current slot metadata.
 * @returns {void}
 */
function handleSlotClick(mode, slot, isAuto, metadata) {
  if (mode === "save" && !isAuto) {
    if (metadata && !window.confirm(CONFIRM_OVERWRITE)) {
      return;
    }
    runner?.save({ announce: true, slot });
    renderSaveGrid("save");
    setOverlay("saves-overlay", false);
  } else if (mode === "load") {
    if (runner && !window.confirm(CONFIRM_LOAD)) {
      return;
    }
    const result = runner?.load({ auto: isAuto, slot }) ?? { ok: false, message: "No active game to load into" };
    if (!result.ok) {
      showSaveFeedback(result.message ?? "Load failed");
      return;
    }
    setOverlay("saves-overlay", false);
  }
  refreshContinueState();
}

/**
 * Wires close buttons and preference inputs on the overlays.
 *
 * @returns {void}
 */
function wireOverlays() {
  for (const overlay of appRoot.querySelectorAll(".overlay")) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-close]")) {
        setOverlay(overlay.id, false);
      }
    });
  }

  const speed = appRoot.querySelector("#pref-speed");
  const auto = appRoot.querySelector("#pref-auto");
  const volumeControls = [
    ["masterVolume", appRoot.querySelector("#pref-master")],
    ["musicVolume", appRoot.querySelector("#pref-music")],
    ["ambienceVolume", appRoot.querySelector("#pref-ambience")],
    ["soundVolume", appRoot.querySelector("#pref-sound")],
    ["voiceVolume", appRoot.querySelector("#pref-voice")]
  ];

  speed.addEventListener("input", () => {
    settings.textSpeed = Number(speed.value);
    syncPreferenceControls();
    saveSettings();
  });
  auto.addEventListener("input", () => {
    settings.autoDelay = Number(auto.value);
    syncPreferenceControls();
    saveSettings();
  });
  for (const [key, input] of volumeControls) {
    input.addEventListener("input", () => {
      settings[key] = Number(input.value);
      syncPreferenceControls();
      saveSettings();
      runner?.syncAudioState?.({ instant: true });
    });
  }
  appRoot.querySelector("[data-pref-defaults]").addEventListener("click", () => {
    Object.assign(settings, DEFAULT_SHELL_SETTINGS);
    syncPreferenceControls();
    saveSettings();
    runner?.syncAudioState?.({ instant: true });
  });
  syncPreferenceControls();

  // Global listener for opening the lightbox
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox]");
    if (trigger) {
      const src = trigger.dataset.lightbox;
      const lightbox = appRoot.querySelector("#lightbox-overlay");
      const img = lightbox.querySelector(".lightbox-image");
      img.src = src;
      lightbox.hidden = false;
    }
  });
}

/**
 * Updates preference input values and labels from the current settings object.
 *
 * @returns {void}
 */
function syncPreferenceControls() {
  const speed = appRoot.querySelector("#pref-speed");
  const auto = appRoot.querySelector("#pref-auto");
  const speedVal = appRoot.querySelector("[data-speed-val]");
  const autoVal = appRoot.querySelector("[data-auto-val]");
  const volumeControls = [
    ["masterVolume", appRoot.querySelector("#pref-master"), appRoot.querySelector("[data-master-val]")],
    ["musicVolume", appRoot.querySelector("#pref-music"), appRoot.querySelector("[data-music-val]")],
    ["ambienceVolume", appRoot.querySelector("#pref-ambience"), appRoot.querySelector("[data-ambience-val]")],
    ["soundVolume", appRoot.querySelector("#pref-sound"), appRoot.querySelector("[data-sound-val]")],
    ["voiceVolume", appRoot.querySelector("#pref-voice"), appRoot.querySelector("[data-voice-val]")]
  ];

  speed.value = String(settings.textSpeed);
  auto.value = String(settings.autoDelay);
  speedVal.textContent = speedLabel(settings.textSpeed);
  autoVal.textContent = autoDelayLabel(settings.autoDelay);
  for (const [key, input, valueLabel] of volumeControls) {
    input.value = String(settings[key]);
    valueLabel.textContent = volumeLabel(settings[key]);
  }
}

/**
 * Toggles an overlay's visibility by id.
 *
 * @param {string} id - Overlay element id.
 * @param {boolean} visible - Desired visibility.
 * @returns {void}
 */
function setOverlay(id, visible) {
  const overlay = appRoot.querySelector(`#${id}`);
  if (overlay) {
    overlay.hidden = !visible;
  }
}

/**
 * Reports whether any blocking player-shell overlay is open.
 *
 * @returns {boolean} True when an overlay is visible.
 */
function hasOpenOverlay() {
  return Boolean(appRoot.querySelector(".overlay:not([hidden])"));
}

/**
 * Closes the most recently declared visible overlay.
 *
 * @returns {void}
 */
function closeTopOverlay() {
  const overlays = [...appRoot.querySelectorAll(".overlay:not([hidden])")];
  overlays.at(-1)?.setAttribute("hidden", "");
}

/**
 * Closes every player-shell overlay.
 *
 * @returns {void}
 */
function closeAllOverlays() {
  for (const overlay of appRoot.querySelectorAll(".overlay:not([hidden])")) {
    overlay.hidden = true;
  }
}

/**
 * Logs non-history diagnostics from renderers and services.
 *
 * @param {object|string} message - Diagnostic payload.
 * @returns {void}
 */
function logMessage(message) {
  if (typeof message === "string") {
    console.warn(message);
  }
}

/**
 * Renders the history backlog into the overlay.
 *
 * @returns {void}
 */
function renderHistory() {
  const log = appRoot.querySelector("[data-history]");
  const rows = createHistoryRows(runner?.getHistory?.() ?? []);
  if (!rows.length) {
    log.innerHTML = `<p class="history-empty">${escapeHtml(HISTORY_EMPTY_LABEL)}</p>`;
    return;
  }
  log.innerHTML = rows
    .map((row) => {
      if (row.kind === "narration") {
        return `<p class="history-narration">${escapeHtml(row.message)}</p>`;
      }
      const surface = historySurfaceLabel(row.surface);
      const surfaceHtml = surface ? `<span class="history-surface">${escapeHtml(surface)}</span>` : "";
      return `<p class="history-line history-line--${row.side}"><span class="history-who">${escapeHtml(row.speaker)}</span>${surfaceHtml}${escapeHtml(row.message)}</p>`;
    })
    .join("");
  log.scrollTop = log.scrollHeight;
}

// =============================================================================
// SETTINGS
// =============================================================================

/**
 * Returns renderer-facing settings, overriding speed while skipping.
 *
 * @returns {{ textSpeed: number, masterVolume: number, musicVolume: number, ambienceVolume: number, soundVolume: number, voiceVolume: number }} Effective settings.
 */
function getEffectiveSettings() {
  return {
    ...settings,
    textSpeed: skipOn ? 1 : settings.textSpeed
  };
}

/**
 * Loads persisted settings or sensible defaults.
 *
 * @returns {{ textSpeed: number, autoDelay: number, masterVolume: number, musicVolume: number, ambienceVolume: number, soundVolume: number, voiceVolume: number }} Settings.
 */
function loadSettings() {
  return parseShellSettings(readFirstStorage([SETTINGS_KEY, LEGACY_SETTINGS_KEY]));
}

/**
 * Persists the current settings.
 *
 * @returns {void}
 */
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Escapes HTML for safe shell rendering.
 *
 * @param {string} value - Raw text.
 * @returns {string} Escaped text.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
