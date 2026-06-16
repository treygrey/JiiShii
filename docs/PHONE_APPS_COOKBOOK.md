# Phone Apps Cookbook

Phone apps are display and navigation surfaces inside the shared Android-style phone shell. Texting can be story-driving, but Home, Gallery, Social, and custom apps are usually flavor surfaces: the player can open them, inspect them, and return to the story without advancing the script.

Import the phone verbs from `src/game/vn.js` in scene files:

```js
import {
  phoneButton,
  phoneApps,
  phoneNotify,
  clearPhoneNotify,
  openPhone,
  setWallpaper,
  saveGalleryImage,
  removeGalleryImage,
  call,
  endCall,
  voicemail,
  socialPost,
  socialFollow,
  socialLike
} from "../vn.js";
```

## Phone Setup

Set the default phone shape in `src/game/game.config.js`:

```js
phone: {
  enabled: true,
  button: true,
  apps: ["texting", "calls", "gallery", "social"],
  homeAppOrder: ["texting", "calls", "gallery", "social"],
  defaultWallpaper: null
}
```

These config values are the starting state for a new game:

| Field | Purpose |
| --- | --- |
| `enabled` | Enables the phone system for this game package. Set `false` for games with no phone UI. |
| `button` | Shows the floating bottom-right phone toggle button by default. |
| `apps` | Default list of installed app ids. |
| `homeAppOrder` | Launcher order for enabled apps. Apps not listed here are appended after the listed apps. |
| `defaultWallpaper` | Initial wallpaper image asset id, or `null`. |

Use game config for what the player has when the game begins. Use scene commands when the story changes the phone later.

```js
phoneButton(false); // hide the floating phone toggle
phoneButton(true);  // show it again
```

`phoneApps(...)` replaces the installed app list until rollback/load/replay changes it again:

```js
phoneApps(["texting", "calls", "gallery", "social"]);
openPhone("home");
```

The floating phone button opens Home. Pressing it again returns to the current story surface. Phone chrome, app icons, gallery controls, and social controls are story-advance dead zones.

If `phone.button` is `false` in config, or `phoneButton(false)` runs in script, the in-phone Android Home button is disabled too. This prevents a soft lock where the player can navigate into Home but no longer has the floating phone toggle to return to the current story surface.

Authors can still open a phone app manually from script with `openPhone("gallery")`, `openPhone("social")`, or `openPhone("texting")`. If the floating toggle is disabled, make sure the scene itself gives the player a clear authored path back.

## Story Texting vs Messages

Texting has two roles:

- `stage("texting")` is a story surface. The script is actively happening inside a specific text thread.
- Opening `texting` from the phone Home screen is the Messages app. It starts at the conversation list unless the player is returning to the active story thread.

When the story is in a texting stage, the active thread is the only texting place that resumes script progress. Opening Home or another app pauses the story; returning to that active thread shows the same messages and choices instead of rebuilding or clearing them.

This lets authors use texting as a normal visual novel surface while still letting the phone feel like a navigable object.

## Navigation Rules

Phone controls have fixed jobs:

| Control | Result |
| --- | --- |
| Floating phone button, phone closed | Opens Home |
| Floating phone button, phone open | Returns to the current story surface |
| Floating phone button while already in the active story text thread | Does nothing visible |
| Android home button inside a phone app | Opens Home when the floating phone toggle is enabled |
| Android home button when the floating phone toggle is disabled | Disabled; does not navigate |
| Android back button inside a phone app | Goes back through phone app history, then returns to story |
| App controls, phone chrome, gallery/social buttons | Do not advance the story |

Closing the phone returns to the current story surface: IRL returns to IRL, streaming returns to streaming, and texting returns to the active story thread.

## Story Phone Calls vs Calls App

Phone calls also have two roles:

- `stage("phone_call")` is a story surface. It looks like the phone, but it is modal and time-sensitive.
- Opening `calls` from the phone Home screen is the Calls app. It shows Recents and Voicemail, but it does not advance the story.

Active calls block phone navigation. The floating phone button, Android Home, and Android Back do not open other apps while `call(...)` is active. The author ends the call with `endCall(...)`.

```js
stage("phone_call");
call("alex", { title: "Connected" });
say("alex", "Are you there?");
say("me", "I'm here.");
endCall();
```

`canHangUp` defaults to `false`. The red hang-up control is visible but disabled, because hanging up is almost always a story decision. Only enable it when the branch is authored.

```js
call("alex", { canHangUp: true });
```

Calls auto-record to the Calls app by default. Use `log: false` for calls that should not appear in Recents:

```js
call("unknown", { title: "Unknown caller", log: false });
```

Voicemail lives in the Calls app and behaves like a saved phone-call-style message:

```js
voicemail("alex_vm_01", "alex", {
  text: "Call me when you get this.",
  audio: "alex_voicemail_01",
  notify: true
});
```

Audio is optional. If `audio` is present, the voicemail detail can play it through the existing voice channel. The transcript/text is still the source of truth for rollback and save/load.

## Notifications

Use notifications when the world changes while the player is elsewhere.

```js
phoneNotify("social", {
  id: "alex_post_notification",
  text: "Alex posted to their timeline"
});

clearPhoneNotify("social");
```

If the phone is closed, unread notifications put a red badge on the floating phone button. If the phone is open and the active app supports toasts, the player gets a small tappable notification.

Use stable `id` values for authored notifications. That lets rollback and replay replace the same notification instead of stacking duplicates.

## Saving Images To Gallery

Gallery entries are authored with a stable gallery entry id and an image asset id:

```js
saveGalleryImage("alex_photo_01", "alex_room_photo", {
  caption: "Room photo",
  tags: ["Alex", "Photos"],
  persistent: false
});
```

The player sees saved images under **All Pics**. If `tags` are provided, the same image also appears under **Galleries**, grouped by tag. Use tags for character collections, locations, outfits, or whatever sorting language fits the game.

One image can belong to several galleries:

```js
saveGalleryImage("beach_group_01", "beach_group_photo", {
  tags: ["Alex", "Sam", "Beach Day"]
});
```

Remove an image by its gallery entry id:

```js
removeGalleryImage("alex_photo_01");
```

Gallery entries are rollbackable by default. If the player rolls back before the `saveGalleryImage(...)` command, the image is gone. Set `persistent: true` only when the author wants the image to survive rollback as a player-earned unlock.

The player can set a saved gallery image as phone wallpaper. Wallpaper behaves like a player preference and survives rollback.

You can also set wallpaper directly from script:

```js
setWallpaper("alex_room_photo");
setWallpaper(null); // clear wallpaper
```

## Making Social Posts

Social posts are authored with `socialPost(...)`:

```js
socialPost("alex_photo_post", {
  poster: "alex",
  text: "still alive after today",
  image: "alex_room_photo",
  notify: true,
  notifyText: "Alex posted to their timeline",
  likeFlag: "liked_alex_photo_post",
  followFlag: "follows_alex",
  replies: 2,
  reposts: 0,
  likes: 12,
  views: 140
});
```

`poster` should be a character id when possible. The app uses the character name and color for the account row and post avatar.

Posts can include text, an image, or both. `notify: true` creates a Social notification and badge. Use `notifyText` to control the notification copy and `notifyId` if the notification needs a stable custom id.

Post images render as cropped feed thumbnails so tall phone photos do not stretch the timeline. The player can tap a post image to open the full image view, then return to the feed.

Posts also render social-style accessory metrics for replies, reposts, likes, and views. Counts default to `0`; authors can provide `replies`, `reposts`, `likes`, and `views`, or group them under `metrics`.

Social is intentionally quiet unless the player follows people. The **Following** tab shows posts from followed accounts. The **Discover** tab shows accounts that have at least one authored post.

Follow state can be changed by script:

```js
socialFollow("alex", { flag: "follows_alex" });
```

Likes can also be changed by script:

```js
socialLike("alex_photo_post", { flag: "liked_alex_photo_post" });
```

The player can follow discoverable accounts in the UI. If a post or command includes a `followFlag`, following also sets that story variable. Like buttons only appear for posts with a `likeFlag`.

Likes can be UI-only. If a post does not provide `likeFlag`, the button can still feel responsive, but it will not set a story variable.

Posts are rollbackable by default. Use `persistent: true` for posts that should survive rollback.

## Rollback Rules

Phone state follows normal visual rollback unless a feature is explicitly player-persistent.

| Thing | Rolls Back? |
| --- | --- |
| Gallery image | Yes, by default |
| Gallery image with `persistent: true` | No |
| Social post | Yes, by default |
| Social post with `persistent: true` | No |
| Recent call | Yes |
| Voicemail | Yes |
| Wallpaper | No |
| Likes/follows with flags | Same as the story variable they set |
| Notifications | Yes, with visual state |

Use `persistent: true` sparingly. Most authored gallery/social changes should roll back, because they are part of what the player has seen in the story timeline.

## Editing The Social App

Most social authoring should happen through scene commands, not renderer edits:

```js
socialPost("sam_vaguepost_001", {
  poster: "sam",
  text: "some people should learn when to stop talking",
  notify: false
});

socialPost("alex_photo_002", {
  poster: "alex",
  image: "alex_mirror_photo",
  text: "not deleting this one"
});
```

For game-specific presentation changes, edit:

- `src/renderers/phone/social-renderer.js` for app structure, tabs, account rows, and post layout.
- `src/styles.css` for `.social-*` classes, spacing, colors, and typography.
- `src/engine/state/phone-state.js` if the app needs new saved social fields.

Keep Social display-first unless the story really needs stronger interaction. If a social action matters to story logic, put that action behind a flag (`likeFlag`, `followFlag`, or a scene command) so it is visible in state and save/load.

## Authoring New Phone Apps

A phone app is a normal surface module with `phoneApp` metadata. Drop a `.js` file into `src/game/surface-modules/`. Files named `*.example.js`, `*.test.js`, `*.spec.js`, or starting with `_` are ignored.

Minimal surface module:

```js
import { defineSurfaceModule } from "../../engine/surfaces/index.js";

export const PINBALL_SURFACE = defineSurfaceModule({
  id: "pinball",
  phoneApp: {
    label: "Pinball",
    icon: "P"
  },
  renderer: {
    surface: "pinball",
    commands: ["choice", "transition"],
    projections: ["renderPinballState"]
  },
  state: {
    create: () => ({ highScore: 0 }),
    normalize: (value = {}) => ({ highScore: Number(value.highScore ?? 0) }),
    clone: (value) => structuredClone(value),
    project: ({ renderer, state }) => renderer?.renderPinballState?.(state)
  },
  commands: {},
  handlers: {}
});
```

If the app needs a renderer, export `rendererConstructors` from the same file:

```js
class PinballRenderer {
  static contract = {
    surface: "pinball",
    commands: ["choice", "transition"],
    projections: ["renderPinballState"]
  };

  constructor(appRoot) {
    this.appRoot = appRoot;
    this.surface = null;
  }

  bindRunner(runner) {
    this.runner = runner;
  }

  mount() {
    this.surface = document.createElement("div");
    this.surface.className = "phone-app-shell pinball-phone-shell";
    this.surface.innerHTML = `<section class="phone-frame"><div class="phone-screen">Pinball</div></section>`;
    this.appRoot.append(this.surface);
  }

  unmount() {
    this.surface?.remove();
    this.surface = null;
  }

  renderPinballState(state) {
    this.surface.querySelector(".phone-screen").textContent = `High score: ${state.highScore}`;
  }
}

export const rendererConstructors = {
  pinball: PinballRenderer
};
```

Then enable and open it from script:

```js
phoneApps(["texting", "calls", "gallery", "social", "pinball"]);
openPhone("pinball");
```

Custom apps should use the same rules as built-in phone apps:

- App chrome clicks should not advance the story.
- Persistent player achievements should be deliberately marked or stored.
- Use a stable app id, command ids, and state shape so save/load and rollback can rebuild it.
- Renderers should tolerate projection before or after mount. Guard DOM writes:

```js
renderPinballState(state) {
  if (!this.surface) {
    return;
  }
  this.surface.querySelector(".phone-screen").textContent = `High score: ${state.highScore}`;
}
```

For more complete examples, copy `templates/game-package/surface-modules/gallery.example.js` into a game package and rename the ids/commands.

## Integration Tour

`src/game/scenes/scene-phone-tour.js` is the packaged reference scene for the phone system. It walks through:

- opening the phone from story
- saving gallery images
- setting wallpaper
- making a modal story phone call
- checking recent calls and voicemail
- following a social account
- opening a social post image
- using the phone over a streaming surface
- returning from streaming into story texting
- preserving an active texting choice while navigating the phone

Use it as the first place to check when changing phone behavior.
