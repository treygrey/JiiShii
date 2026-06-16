import { expect, test } from "@playwright/test";

const STAGE = "#game-stage";

/**
 * Starts a scene through the dev-only direct scene URL.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @param {string} sceneId - Scene id to start.
 * @returns {Promise<void>}
 */
async function startScene(page, sceneId) {
  await page.goto(`/?scene=${sceneId}&chaos=${Date.now()}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
}

/**
 * Advances by clicking the stage until visible text appears.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @param {string|RegExp} text - Text to wait for.
 * @param {number} [limit] - Maximum advance clicks.
 * @returns {Promise<void>}
 */
async function advanceUntilVisible(page, text, limit = 80) {
  const target = page.getByText(text, { exact: typeof text === "string" });
  for (let attempt = 0; attempt < limit; attempt += 1) {
    if (await target.first().isVisible().catch(() => false)) {
      return;
    }
    await page.locator(STAGE).click({ position: { x: 420, y: 300 } });
    await page.waitForTimeout(45);
  }
  await expect(target.first()).toBeVisible();
}

/**
 * Advances by clicking the stage until a locator exists.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @param {import("@playwright/test").Locator} locator - Locator to wait for.
 * @param {number} [limit] - Maximum advance clicks.
 * @returns {Promise<void>}
 */
async function advanceUntilLocator(page, locator, limit = 80) {
  for (let attempt = 0; attempt < limit; attempt += 1) {
    if (await locator.first().isVisible().catch(() => false)) {
      return;
    }
    await page.locator(STAGE).click({ position: { x: 420, y: 300 } });
    await page.waitForTimeout(45);
  }
  await expect(locator.first()).toBeVisible();
}

/**
 * Advances past the Alex test's name input prompt.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function acceptNameInput(page) {
  await expect(page.getByText("Name for interpolation/input testing")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
}

/**
 * Submits the Alex test's name input with a specific value.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @param {string} value - Input value.
 * @returns {Promise<void>}
 */
async function submitNameInput(page, value) {
  await expect(page.getByText("Name for interpolation/input testing")).toBeVisible();
  const field = page.locator(".compositor-input-field");
  await expect(field).toBeVisible();
  await field.fill(value);
  await page.getByRole("button", { name: "OK" }).click();
}

/**
 * Chooses a visible option by role.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @param {string} name - Option text.
 * @returns {Promise<void>}
 */
async function chooseOption(page, name) {
  const option = page.getByRole("option", { name });
  await expect(option).toBeVisible();
  await option.click();
}

/**
 * Reads a small runtime slice through the dev test hook.
 *
 * @param {import("@playwright/test").Page} page - Playwright page.
 * @returns {Promise<object>} Runtime summary.
 */
async function readRuntime(page) {
  return page.evaluate(() => {
    const runner = window.__JIISHII_TEST__?.runner;
    return {
      currentCommandIndex: runner?.state?.currentCommandIndex,
      currentSurface: runner?.state?.currentSurface,
      isRewound: runner?.isRewound,
      stack: [...(runner?.surfaceStack ?? [])],
      phoneNavigationSurface: runner?.phoneNavigationSurface ?? null,
      phoneCurrentApp: runner?.state?.visuals?.phone?.currentApp ?? null
    };
  });
}

test("mashing phone and quick-menu controls over an IRL choice does not eat the choice", async ({ page }) => {
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");

  const before = await readRuntime(page);
  const trustOption = page.getByRole("option", { name: "Trust Alex and step closer." });
  await expect(trustOption).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await page.getByLabel("Open phone").click();
    await expect(page.locator(".phone-home-shell")).toBeVisible();
    await page.locator(".phone-home-shell [data-phone-nav='back']").click();
    await expect(page.locator(".phone-home-shell")).toHaveCount(0);
    await expect(trustOption).toBeVisible();
  }

  for (const action of ["history", "prefs", "save", "load"]) {
    await page.locator(`[data-q="${action}"]`).click();
    await page.keyboard.press("Escape");
    await expect(trustOption).toBeVisible();
  }

  for (let index = 0; index < 8; index += 1) {
    await page.getByLabel("Open phone").click();
    await page.getByLabel("Return to story").click();
  }
  const after = await readRuntime(page);
  expect(after.currentCommandIndex).toBe(before.currentCommandIndex);
  expect(after.currentSurface).toBe("irl");
  await expect(trustOption).toBeVisible();
  await expect(page.getByRole("option", { name: "Challenge Alex and keep distance." })).toBeVisible();
  await expect(page.getByRole("option", { name: "Stay quiet and make the engine decide." })).toBeVisible();
});

test("hostile player input stays text and phone-morse spam cannot break the input beat", async ({ page }) => {
  const payload = "<svg/onload=__j=1>";
  await startScene(page, "scene-alex-branch-test");
  await page.evaluate(() => {
    window.__j = 0;
  });

  await expect(page.locator(".compositor-input-field")).toBeVisible();
  const before = await readRuntime(page);
  for (let index = 0; index < 9; index += 1) {
    await page.getByLabel("Open phone").click({ force: true });
    await page.waitForTimeout(index % 2 === 0 ? 25 : 70);
  }
  await expect(page.locator(".phone-app-shell")).toHaveCount(0);
  await expect(page.locator(".compositor-input-field")).toBeVisible();
  const afterPhoneSpam = await readRuntime(page);
  expect(afterPhoneSpam.currentCommandIndex).toBe(before.currentCommandIndex);

  await submitNameInput(page, payload);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");
  await chooseOption(page, "Trust Alex and step closer.");
  await advanceUntilVisible(page, "Optional app checkpoint");
  await chooseOption(page, "Skip app inspection for now.");
  await advanceUntilVisible(page, "Call branch");
  await chooseOption(page, "End the call cleanly.");
  await advanceUntilVisible(page, "Stream checkpoint");
  await chooseOption(page, "Video, chat, and stream post worked.");
  await advanceUntilVisible(page, /Input check says your test name is/);

  await expect(page.locator(".message-bubble").filter({ hasText: payload })).toBeVisible();
  await expect(page.locator(".message-bubble svg[onload]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__j)).toBe(0);

  await page.locator('[data-q="history"]').click();
  await expect(page.locator("#history-overlay")).toBeVisible();
  await expect(page.locator(".history-log")).toContainText(payload);
  await expect(page.locator(".history-log svg[onload]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__j)).toBe(0);
});

test("poisoned phone-app state renders as text instead of executable markup", async ({ page }) => {
  const payload = "<svg/onload=__s=1>";
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await page.evaluate((poison) => {
    window.__s = 0;
    const runner = window.__JIISHII_TEST__?.runner;
    runner.characters.set("poison", {
      id: "poison",
      name: poison,
      color: "red;background:url(javascript:__s=2)"
    });
    runner.state.visuals.social.posts.push({
      id: "poison-post",
      poster: "poison",
      text: poison,
      metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }
    });
    runner.state.visuals.social.follows.poison = true;
    runner.state.visuals.calls.recents.push({
      contact: { id: "poison", name: poison, avatar: poison },
      status: poison,
      mode: poison
    });
    runner.state.visuals.calls.voicemails.push({
      id: "poison-voicemail",
      contact: { id: "poison", name: poison, avatar: poison },
      text: poison,
      transcript: [{ name: poison, message: poison }]
    });
  }, payload);

  await page.getByLabel("Open phone").click();
  await page.getByRole("button", { name: "Social" }).click();
  await expect(page.locator(".social-phone-shell")).toBeVisible();
  await expect(page.locator(".social-post").filter({ hasText: payload })).toBeVisible();
  await expect(page.locator(".social-post p svg[onload]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__s)).toBe(0);

  await page.locator(".social-phone-shell [data-phone-nav='back']").click();
  await page.getByRole("button", { name: "Calls" }).click();
  await expect(page.locator(".calls-phone-shell")).toBeVisible();
  await expect(page.locator(".calls-list").filter({ hasText: payload })).toBeVisible();
  await expect(page.locator(".calls-phone-shell svg[onload]")).toHaveCount(0);
  await page.getByRole("button", { name: "Voicemail" }).click();
  await page.locator('[data-voicemail-id="poison-voicemail"]').click();
  await expect(page.locator(".voicemail-detail").filter({ hasText: payload })).toBeVisible();
  await expect(page.locator(".voicemail-detail svg[onload]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__s)).toBe(0);
});

test("CG beats fill the authored frame instead of the padded play area", async ({ page }) => {
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");
  await chooseOption(page, "Trust Alex and step closer.");
  await advanceUntilLocator(page, page.locator(".irl-image[data-kind='cg']"));

  const layout = await page.locator(".irl-image[data-kind='cg']").evaluate((cg) => {
    const root = document.querySelector(".vn-root");
    const media = cg.querySelector(".irl-image-media");
    if (!root || !media) {
      throw new Error("Missing root or CG media");
    }
    const readRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    return {
      cg: readRect(cg),
      media: readRect(media),
      root: readRect(root)
    };
  });

  expect(layout.cg).toEqual(layout.root);
  expect(layout.media).toEqual(layout.root);
});

test("story texting ignores Android back spam and preserves the active reply choice", async ({ page }) => {
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");
  await chooseOption(page, "Trust Alex and step closer.");
  await advanceUntilVisible(page, "Optional app checkpoint");
  await chooseOption(page, "Skip app inspection for now.");
  await advanceUntilVisible(page, "Call branch");
  await chooseOption(page, "End the call cleanly.");
  await advanceUntilVisible(page, "Stream checkpoint");
  await chooseOption(page, "Video, chat, and stream post worked.");

  const saveRoute = page.getByRole("button", { name: "Save route completion." });
  await advanceUntilLocator(page, saveRoute);
  const before = await readRuntime(page);

  const backButton = page.locator(".texting-shell [data-phone-nav='back']");
  await expect(backButton).toBeDisabled();
  for (let index = 0; index < 10; index += 1) {
    await backButton.click({ force: true });
    await page.waitForTimeout(25);
  }

  const afterBack = await readRuntime(page);
  expect(afterBack.currentCommandIndex).toBe(before.currentCommandIndex);
  expect(afterBack.currentSurface).toBe("texting");
  await expect(saveRoute).toBeVisible();

  await page.locator(".texting-shell [data-phone-nav='home']").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: "Messages" }).click();

  const afterHomeRoundTrip = await readRuntime(page);
  expect(afterHomeRoundTrip.currentCommandIndex).toBe(before.currentCommandIndex);
  expect(afterHomeRoundTrip.currentSurface).toBe("texting");
  await expect(saveRoute).toBeVisible();
  await expect(page.getByRole("button", { name: "End without saving route." })).toBeVisible();
});

test("opening phone apps during an IRL choice keeps app chrome above the choice and returns cleanly", async ({ page }) => {
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");

  await page.getByLabel("Open phone").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: "Social" }).click();
  await expect(page.locator(".social-phone-shell")).toBeVisible();
  await expect(page.getByRole("option", { name: "Trust Alex and step closer." })).toBeVisible();

  const topLayer = await page.locator(".social-phone-shell .phone-frame").evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const element = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element?.closest(".social-phone-shell, .irl-choice-overlay")?.className ?? "";
  });
  expect(topLayer).toContain("social-phone-shell");

  await page.mouse.wheel(0, -900);
  await page.mouse.wheel(0, 900);
  await expect(page.locator(".social-phone-shell")).toBeVisible();
  await expect(page.getByRole("option", { name: "Trust Alex and step closer." })).toBeVisible();

  await page.locator(".social-phone-shell [data-phone-nav='back']").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.locator(".phone-home-shell [data-phone-nav='back']").click();
  await expect(page.locator(".phone-home-shell")).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Trust Alex and step closer." })).toBeVisible();
});

test("streaming survives phone toggles, scrolls, and chat replay without duplicating rows", async ({ page }) => {
  await startScene(page, "scene-alex-branch-test");
  await acceptNameInput(page);
  await advanceUntilVisible(page, "Pick a branch. Both paths converge, but they set different variables.");
  await chooseOption(page, "Trust Alex and step closer.");
  await advanceUntilVisible(page, "Optional app checkpoint");
  await chooseOption(page, "Skip app inspection for now.");
  await advanceUntilVisible(page, "Call branch");
  await chooseOption(page, "Ask for the stream test.");
  await advanceUntilVisible(page, "Stream checkpoint");

  await expect(page.locator(".stream-site")).toBeVisible();
  await expect(page.locator(".stream-chat-log .chat-row")).toHaveCount(5);
  const beforeRows = await page.locator(".stream-chat-log .chat-row").count();
  for (let index = 0; index < 3; index += 1) {
    await page.getByLabel("Open phone").click();
    await expect(page.locator(".phone-home-shell")).toBeVisible();
    await page.getByLabel("Return to story").click();
    await expect(page.locator(".stream-site")).toBeVisible();
  }

  const chatBox = await page.locator(".stream-chat-log").boundingBox();
  expect(chatBox).not.toBeNull();
  await page.mouse.move(chatBox.x + chatBox.width / 2, chatBox.y + chatBox.height / 2);
  await page.mouse.wheel(0, -1200);
  await page.mouse.wheel(0, 1200);
  await page.keyboard.press("PageUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("PageDown");

  await expect(page.locator(".stream-site")).toBeVisible();
  await expect(page.locator(".stream-chat-log .chat-row")).toHaveCount(beforeRows);
  await expect.poll(() => readRuntime(page).then((state) => state.isRewound)).toBe(false);
  const after = await readRuntime(page);
  expect(after.currentSurface).toBe("streaming");
});
