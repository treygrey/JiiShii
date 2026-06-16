import { expect, test } from "@playwright/test";

const STAGE = "#game-stage";

/**
 * Clears persisted state and starts the packaged guided tour.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function startTour(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByLabel("Open phone")).toBeVisible();
}

/**
 * Advances the story until text appears.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string|RegExp} text - Text to wait for.
 * @returns {Promise<import('@playwright/test').Locator>} Visible locator.
 */
async function advanceUntilVisible(page, text) {
  const target = page.getByText(text, { exact: typeof text === "string" });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await target.first().isVisible().catch(() => false)) {
      return target.first();
    }
    await page.locator(STAGE).click({ position: { x: 320, y: 320 } });
    await page.waitForTimeout(50);
  }
  await expect(target.first()).toBeVisible();
  return target.first();
}

/**
 * Chooses a visible guided-tour checkpoint option.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} prompt - Checkpoint prompt.
 * @param {string} option - Option text.
 * @returns {Promise<void>}
 */
async function chooseCheckpoint(page, prompt, option) {
  await advanceUntilVisible(page, prompt);
  await page.getByRole("option", { name: option }).click();
}

/**
 * Clears the modal phone call and Calls app checkpoints added before streaming.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function completeCallTour(page) {
  await chooseCheckpoint(page, "Call checkpoint", "Stay on the call.");
  await chooseCheckpoint(page, "Calls app checkpoint", "Calls and voicemail worked.");
}

/**
 * Opens the floating phone and chooses an app from Home.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} appName - Accessible app label.
 * @returns {Promise<void>}
 */
async function openPhoneApp(page, appName) {
  await page.getByLabel(/Open phone|Return to story/).click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: appName }).click();
}

/**
 * Reads a small slice of live runner state through the dev-only test hook.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<object>} Serializable runtime state summary.
 */
async function readRuntime(page) {
  return page.evaluate(() => {
    const runner = window.__JIISHII_TEST__?.runner;
    return {
      currentCommandIndex: runner?.state?.currentCommandIndex,
      currentSurface: runner?.state?.currentSurface,
      isRewound: runner?.isRewound,
      wallpaperImage: runner?.state?.visuals?.phone?.wallpaperImage,
      follows: runner?.state?.visuals?.social?.follows ?? {},
      likes: runner?.state?.visuals?.social?.likes ?? {}
    };
  });
}

test("phone apps stay above an IRL choice and Messages opens as inbox outside story texting", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await openPhoneApp(page, "Messages");

  await expect(page.locator(".texting-shell")).toBeVisible();
  await expect(page.getByText("No conversations")).toBeVisible();
  await expect(page.locator(".irl-choice-overlay")).toHaveCount(1);

  const topLayer = await page.locator(".texting-shell .phone-frame").evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const element = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element?.closest(".texting-shell, .irl-choice-overlay")?.className ?? "";
  });
  expect(topLayer).toContain("texting-shell");

  await page.locator(".texting-shell [data-phone-nav='back']").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await expect(page.locator(".irl-choice-overlay")).toHaveCount(1);

  await page.locator(".phone-home-shell [data-phone-nav='back']").click();
  await expect(page.locator(".phone-home-shell")).toHaveCount(0);
  await expect(page.locator(".texting-shell")).toHaveCount(0);
  await expect(page.getByRole("option", { name: "I checked the gallery and wallpaper." })).toBeVisible();
});

test("guided tour exercises gallery, wallpaper, social follow, like, and scroll guards", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await openPhoneApp(page, "Gallery");
  await page.locator('[data-gallery-image="tour_wallpaper"]').click();
  await page.getByRole("button", { name: "Set wallpaper" }).click();
  await expect.poll(() => readRuntime(page).then((state) => state.wallpaperImage)).toBe("tour_wallpaper");

  await page.locator('[data-phone-nav="back"]').click();
  await page.locator('[data-phone-nav="home"]').click();
  await page.getByRole("button", { name: "Social" }).click();

  await expect(page.getByText("Your timeline is quiet.")).toBeVisible();
  await page.getByRole("tab", { name: "Discover" }).click();
  await page.locator('[data-social-follow="friend"]').click();
  await expect.poll(() => readRuntime(page).then((state) => state.follows.friend)).toBe(true);

  await page.getByRole("tab", { name: "Following" }).click();
  await expect(page.locator('[data-social-image="tour_alex_first_post"]')).toBeVisible();

  const beforeWheel = await readRuntime(page);
  await page.locator(".social-feed").hover();
  await page.mouse.wheel(0, -800);
  const afterWheel = await readRuntime(page);
  expect(afterWheel.currentCommandIndex).toBe(beforeWheel.currentCommandIndex);
  expect(afterWheel.isRewound).toBe(false);

  await page.locator('[data-social-like="tour_alex_first_post"]').click();
  await expect.poll(() => readRuntime(page).then((state) => state.likes.tour_alex_first_post)).toBe(true);
  await expect(page.locator(".social-action-button--like.is-like-flashing")).toHaveCount(1);

  await page.getByLabel("Return to story").click();
  await page.getByRole("option", { name: "I checked the gallery and wallpaper." }).click();
});

test("texting choices survive visiting Home and returning to the active story thread", async ({ page }) => {
  await startTour(page);

  await chooseCheckpoint(page, "Gallery checkpoint", "I checked the gallery and wallpaper.");
  await chooseCheckpoint(page, "Social checkpoint", "I followed Alex and opened the post.");
  await chooseCheckpoint(page, "Post image checkpoint", "The post image opened full-size.");
  await completeCallTour(page);
  await chooseCheckpoint(page, "Stream checkpoint", "Phone returns to the current surface.");
  await advanceUntilVisible(page, "The active thread kept its choice.");

  await expect(page.getByRole("button", { name: "The active thread kept its choice." })).toBeVisible();
  await expect(page.getByText("Open Home, look around, then return to this active thread. The choice should still be here.")).toHaveCount(1);

  await page.locator(".texting-shell .phone-home-button").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: "Messages" }).click();

  await expect(page.locator(".texting-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "The active thread kept its choice." })).toBeVisible();
  await expect(page.getByText("Open Home, look around, then return to this active thread. The choice should still be here.")).toHaveCount(1);
});

test("browser rollback and roll-forward return to the active tour choice", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  const beforeRollback = await readRuntime(page);
  await page.mouse.wheel(0, -900);
  await expect.poll(() => readRuntime(page).then((state) => state.isRewound)).toBe(true);
  const rolledBack = await readRuntime(page);
  expect(rolledBack.currentCommandIndex).toBeLessThan(beforeRollback.currentCommandIndex);

  await page.waitForTimeout(120);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => readRuntime(page).then((state) => state.isRewound)).toBe(false);
  await advanceUntilVisible(page, "Gallery checkpoint");
  await expect(page.getByRole("option", { name: "I checked the gallery and wallpaper." })).toBeVisible();
});

test("quick menu save and load restore a blocked choice", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await page.locator('[data-q="save"]').click();
  await expect(page.locator("#saves-overlay")).toBeVisible();
  await page.locator("#save-grid .save-tile:not(.auto-tile)").first().click();
  await expect(page.locator("#saves-overlay")).toBeHidden();

  await page.getByRole("option", { name: "I checked the gallery and wallpaper." }).click();
  await advanceUntilVisible(page, "Social checkpoint");

  await page.locator('[data-q="load"]').click();
  await expect(page.locator("#saves-overlay")).toBeVisible();
  await page.locator("#save-grid .save-tile.has-data:not(.auto-tile)").first().click();

  await expect(page.locator("#saves-overlay")).toBeHidden();
  await expect(page.getByRole("option", { name: "I checked the gallery and wallpaper." })).toBeVisible();
});

test("keyboard shell shortcuts open overlays and page keys roll beats", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await page.keyboard.press("h");
  await expect(page.locator("#history-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#history-overlay")).toBeHidden();

  await page.keyboard.press("s");
  await expect(page.locator("#saves-overlay")).toBeVisible();
  await expect(page.locator("#saves-title")).toHaveText("Save Game");
  await page.keyboard.press("Escape");
  await expect(page.locator("#saves-overlay")).toBeHidden();

  await page.keyboard.press("l");
  await expect(page.locator("#saves-overlay")).toBeVisible();
  await expect(page.locator("#saves-title")).toHaveText("Load Game");
  await page.keyboard.press("Escape");
  await expect(page.locator("#saves-overlay")).toBeHidden();

  const beforePageUp = await readRuntime(page);
  await page.keyboard.press("PageUp");
  await expect.poll(() => readRuntime(page).then((state) => state.isRewound)).toBe(true);
  const rewound = await readRuntime(page);
  expect(rewound.currentCommandIndex).toBeLessThan(beforePageUp.currentCommandIndex);

  await page.waitForTimeout(120);
  await page.keyboard.press("PageDown");
  await expect.poll(() => readRuntime(page).then((state) => state.isRewound)).toBe(false);
});

test("skip defaults to seen text only and can opt into all text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByLabel("Open phone")).toBeVisible();

  const unreadStart = await readRuntime(page);
  await page.locator('[data-q="skip"]').click();
  await expect(page.locator('[data-q="skip"]')).not.toHaveClass(/is-active/);
  await expect.poll(() => readRuntime(page).then((state) => state.currentCommandIndex)).toBe(unreadStart.currentCommandIndex);

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("jiishii-starter-settings", JSON.stringify({ skipMode: "all" }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByLabel("Open phone")).toBeVisible();

  const allStart = await readRuntime(page);
  await page.locator('[data-q="skip"]').click();
  await expect.poll(() => readRuntime(page).then((state) => state.currentCommandIndex))
    .toBeGreaterThan(allStart.currentCommandIndex);
});

test("skip all keeps advancing through streaming readable beats", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("jiishii-starter-settings", JSON.stringify({ skipMode: "all" }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByLabel("Open phone")).toBeVisible();

  await chooseCheckpoint(page, "Gallery checkpoint", "I checked the gallery and wallpaper.");
  await chooseCheckpoint(page, "Social checkpoint", "I followed Alex and opened the post.");
  await chooseCheckpoint(page, "Post image checkpoint", "The post image opened full-size.");
  await completeCallTour(page);

  await page.locator('[data-q="skip"]').click();
  await expect(page.getByRole("option", { name: "Phone returns to the current surface." }))
    .toBeVisible();
  await expect(page.locator('[data-q="skip"]')).toHaveClass(/is-active/);
});

test("rollback to streaming chat does not duplicate already projected rows", async ({ page }) => {
  await startTour(page);
  await chooseCheckpoint(page, "Gallery checkpoint", "I checked the gallery and wallpaper.");
  await chooseCheckpoint(page, "Social checkpoint", "I followed Alex and opened the post.");
  await chooseCheckpoint(page, "Post image checkpoint", "The post image opened full-size.");
  await completeCallTour(page);
  await advanceUntilVisible(page, "Stream checkpoint");

  const chatBlockIndex = await page.evaluate(() => {
    const runner = window.__JIISHII_TEST__?.runner;
    return runner?.scene?.script?.findIndex((command) => command.type === "streamChatBlock");
  });
  expect(chatBlockIndex).toBeGreaterThan(0);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await readRuntime(page);
    if (state.currentCommandIndex <= chatBlockIndex) {
      break;
    }
    await page.keyboard.press("PageUp");
    await page.waitForTimeout(120);
  }

  await expect.poll(() => readRuntime(page).then((state) => state.currentCommandIndex)).toBe(chatBlockIndex);
  await expect(page.locator(".stream-site")).toBeVisible();
  await expect(page.locator(".stream-chat-log .chat-row")).toHaveCount(4);

  await page.waitForTimeout(1400);
  await expect(page.locator(".stream-chat-log .chat-row")).toHaveCount(4);
});

test("seen choice options are marked on later playthroughs", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");
  await page.getByRole("option", { name: "I checked the gallery and wallpaper." }).click();
  await advanceUntilVisible(page, "Social checkpoint");

  await page.locator('[data-q="menu"]').click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await advanceUntilVisible(page, "Gallery checkpoint");

  await expect(page.getByRole("option", { name: "I checked the gallery and wallpaper." }))
    .toHaveClass(/is-seen/);
});

test("title Extras opens an interactive gallery and resets its image viewer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("jiishii-starter-persistent", JSON.stringify({
      version: 1,
      seen: {},
      choices: {},
      unlocks: {
        gallery: {
          tour_gallery_wallpaper: true
        },
        music: {}
      },
      flags: {}
    }));
  });
  await page.reload();

  await page.getByRole("button", { name: "Extras" }).click();
  await expect(page.locator("#extras-overlay")).toBeVisible();
  await expect(page.locator("#extras-overlay .overlay-card")).toBeVisible();
  await expect(page.locator('[data-extras-image="tour_gallery_wallpaper"]')).toBeVisible();

  await page.locator('[data-extras-image="tour_gallery_wallpaper"]').click();
  await expect(page.locator("[data-extras-viewer]")).toBeVisible();
  await expect(page.locator("[data-extras-viewer] img")).toHaveAttribute("src", /tour_gallery_wallpaper/);

  await page.locator("[data-extras-viewer-close]").click();
  await expect(page.locator("[data-extras-viewer]")).toBeHidden();
  await expect(page.locator('[data-extras-image="tour_gallery_wallpaper"]')).toBeVisible();

  await page.locator("#extras-overlay .overlay-head [data-close]").click();
  await expect(page.locator("#extras-overlay")).toBeHidden();

  await page.getByRole("button", { name: "Extras" }).click();
  await expect(page.locator("#extras-overlay .overlay-card")).toBeVisible();
  await expect(page.locator("[data-extras-viewer]")).toBeHidden();
  await expect(page.locator('[data-extras-image="tour_gallery_wallpaper"]')).toBeVisible();
});

test("display settings lock the authored frame and apply accessibility preferences", async ({ page }) => {
  await page.setViewportSize({ width: 2100, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("jiishii-starter-settings", JSON.stringify({
      fontScale: 1.3,
      reducedMotion: "on"
    }));
  });
  await page.reload();

  const display = await page.locator(".vn-root").evaluate((root) => {
    const rect = root.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      aspect: rect.width / rect.height,
      fontScale: getComputedStyle(root).getPropertyValue("--font-scale").trim(),
      narrationMaxChars: getComputedStyle(root).getPropertyValue("--narration-max-ch").trim(),
      reducedMotion: root.classList.contains("is-reduced-motion")
    };
  });

  expect(display.width).toBeLessThan(2100);
  expect(display.height).toBeCloseTo(900, 0);
  expect(display.aspect).toBeCloseTo(16 / 9, 2);
  expect(display.fontScale).toBe("1.3");
  expect(display.narrationMaxChars).toBe("80");
  expect(display.reducedMotion).toBe(true);
});

test("main menu stays inside the authored frame with no document margin leak", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");

  const layout = await page.locator(".vn-root").evaluate((root) => {
    const app = document.querySelector("#app");
    const menu = document.querySelector("#main-menu");
    const menuBackground = document.querySelector(".menu-bg");
    if (!app || !menu || !menuBackground) {
      throw new Error("Missing shell elements");
    }
    const readRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    };
    return {
      app: readRect(app),
      root: readRect(root),
      menu: readRect(menu),
      menuBackground: readRect(menuBackground),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      backgrounds: {
        html: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        app: getComputedStyle(app).backgroundColor
      }
    };
  });

  expect(layout.app.top).toBeCloseTo(0, 0);
  expect(layout.app.left).toBeCloseTo(0, 0);
  expect(layout.app.width).toBeCloseTo(layout.viewport.width, 0);
  expect(layout.app.height).toBeCloseTo(layout.viewport.height, 0);
  expect(layout.root.width / layout.root.height).toBeCloseTo(16 / 9, 2);
  expect(layout.menu).toEqual(layout.root);
  expect(layout.menuBackground).toEqual(layout.root);
  expect(layout.backgrounds.html).toBe("rgb(8, 8, 12)");
  expect(layout.backgrounds.body).toBe("rgb(8, 8, 12)");
  expect(layout.backgrounds.app).toBe("rgb(8, 8, 12)");
});

test("phone home fits inside the authored frame at 16:9", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await startTour(page);
  await page.getByLabel("Open phone").click();
  await expect(page.locator(".phone-home-shell .phone-frame")).toBeVisible();

  const layout = await page.locator(".phone-home-shell .phone-frame").evaluate((frame) => {
    const stage = document.querySelector("#game-stage");
    const root = document.querySelector(".vn-root");
    if (!stage || !root) {
      throw new Error("Missing VN layout root");
    }
    const frameRect = frame.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const stageStyle = getComputedStyle(stage);
    const contentTop = stageRect.top + Number.parseFloat(stageStyle.paddingTop);
    const contentBottom = stageRect.bottom - Number.parseFloat(stageStyle.paddingBottom);
    const contentLeft = stageRect.left + Number.parseFloat(stageStyle.paddingLeft);
    const contentRight = stageRect.right - Number.parseFloat(stageStyle.paddingRight);
    return {
      frame: {
        top: frameRect.top,
        right: frameRect.right,
        bottom: frameRect.bottom,
        left: frameRect.left,
        width: frameRect.width,
        height: frameRect.height
      },
      content: {
        top: contentTop,
        right: contentRight,
        bottom: contentBottom,
        left: contentLeft
      },
      root: {
        width: rootRect.width,
        height: rootRect.height
      }
    };
  });

  expect(layout.root.width / layout.root.height).toBeCloseTo(16 / 9, 2);
  expect(layout.frame.width / layout.frame.height).toBeCloseTo(390 / 844, 2);
  expect(layout.frame.top).toBeGreaterThanOrEqual(layout.content.top + 10);
  expect(layout.frame.bottom).toBeLessThanOrEqual(layout.content.bottom - 10);
  expect(layout.frame.left).toBeGreaterThanOrEqual(layout.content.left - 1);
  expect(layout.frame.right).toBeLessThanOrEqual(layout.content.right + 1);
});

test("stream surface fits inside the authored frame at 16:9", async ({ page }) => {
  await page.setViewportSize({ width: 1110, height: 625 });
  await startTour(page);
  await chooseCheckpoint(page, "Gallery checkpoint", "I checked the gallery and wallpaper.");
  await chooseCheckpoint(page, "Social checkpoint", "I followed Alex and opened the post.");
  await chooseCheckpoint(page, "Post image checkpoint", "The post image opened full-size.");
  await completeCallTour(page);
  await expect(page.locator(".stream-site")).toBeVisible();

  const layout = await page.locator(".stream-site").evaluate((stream) => {
    const stage = document.querySelector("#game-stage");
    const root = document.querySelector(".vn-root");
    if (!stage || !root) {
      throw new Error("Missing VN layout root");
    }
    const streamRect = stream.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const shellRect = document.querySelector(".stream-shell").getBoundingClientRect();
    return {
      stream: {
        top: streamRect.top,
        right: streamRect.right,
        bottom: streamRect.bottom,
        left: streamRect.left,
        width: streamRect.width,
        height: streamRect.height
      },
      shell: {
        top: shellRect.top,
        right: shellRect.right,
        bottom: shellRect.bottom,
        left: shellRect.left,
        width: shellRect.width,
        height: shellRect.height
      },
      root: {
        top: rootRect.top,
        right: rootRect.right,
        bottom: rootRect.bottom,
        left: rootRect.left,
        width: rootRect.width,
        height: rootRect.height
      }
    };
  });

  expect(layout.root.width / layout.root.height).toBeCloseTo(16 / 9, 2);
  expect(layout.shell.top).toBeGreaterThanOrEqual(layout.root.top - 1);
  expect(layout.shell.bottom).toBeLessThanOrEqual(layout.root.bottom + 1);
  expect(layout.shell.left).toBeGreaterThanOrEqual(layout.root.left - 1);
  expect(layout.shell.right).toBeLessThanOrEqual(layout.root.right + 1);
  expect(layout.stream.top).toBeGreaterThanOrEqual(layout.shell.top + 12);
  expect(layout.stream.bottom).toBeLessThanOrEqual(layout.shell.bottom - 48);
  expect(layout.stream.left).toBeGreaterThanOrEqual(layout.shell.left + 20);
  expect(layout.stream.right).toBeLessThanOrEqual(layout.shell.right - 20);
});
