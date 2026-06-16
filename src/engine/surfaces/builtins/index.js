import { IRL_SURFACE } from "./irl-surface.js";
import { TEXTING_SURFACE } from "./texting-surface.js";
import { STREAMING_SURFACE } from "./streaming-surface.js";
import { PHONE_HOME_SURFACE } from "./phone-home-surface.js";
import { GALLERY_SURFACE } from "./gallery-surface.js";
import { SOCIAL_SURFACE } from "./social-surface.js";
import { PHONE_CALL_SURFACE } from "./phone-call-surface.js";
import { CALLS_SURFACE } from "./calls-surface.js";

export { IRL_SURFACE } from "./irl-surface.js";
export { TEXTING_SURFACE } from "./texting-surface.js";
export { STREAMING_SURFACE } from "./streaming-surface.js";
export { PHONE_HOME_SURFACE } from "./phone-home-surface.js";
export { GALLERY_SURFACE, resolveWallpaperAsset } from "./gallery-surface.js";
export { SOCIAL_SURFACE } from "./social-surface.js";
export { PHONE_CALL_SURFACE } from "./phone-call-surface.js";
export { CALLS_SURFACE } from "./calls-surface.js";

export const BUILTIN_SURFACE_MODULES = [
  IRL_SURFACE,
  TEXTING_SURFACE,
  STREAMING_SURFACE,
  PHONE_HOME_SURFACE,
  GALLERY_SURFACE,
  SOCIAL_SURFACE,
  PHONE_CALL_SURFACE,
  CALLS_SURFACE
];
