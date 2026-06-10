// =============================================================================
// Example scene pack
//
// Copy this file to a new .js file in this folder when one file should carry
// several related scenes, such as a chapter, route, or optional content pack.
// Files ending in .example.js are ignored by auto-discovery.
// =============================================================================

import {
  mark,
  scene,
  say,
  stage,
  transition
} from "../vn.js";

export const chapterPackExample = [
  scene({
    id: "scene-example-pack-intro",
    mode: "test",
    cast: ["me"],
    script: [
      stage("irl"),
      say("This is the first scene in a pack."),
      transition("Continue", "scene-example-pack-followup")
    ]
  }),

  scene({
    id: "scene-example-pack-followup",
    mode: "test",
    cast: ["me"],
    script: [
      stage("irl"),
      mark("start"),
      say("This is the second scene in the same file."),
      transition("Done", null)
    ]
  })
];

export default chapterPackExample;
