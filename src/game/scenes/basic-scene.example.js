// =============================================================================
// Example scene module
//
// Copy this file to a new .js file in this folder, rename the scene id, and
// edit the script. Files ending in .example.js are ignored by auto-discovery.
// =============================================================================

import {
  background,
  audioScene,
  scene,
  show,
  stage,
  say,
  transition
} from "../vn.js";

export const basicSceneExample = scene({
  id: "scene-example-basic",
  mode: "test",
  cast: ["me", "alex"],
  script: [
    stage("irl"),
    background("starter-room-day"),
    audioScene("quiet-room", { transition: 800 }),
    show("alex", {
      outfit: "casual",
      expression: "neutral",
      at: "center",
      transition: "dissolve"
    }),
    say("alex", "This is the shape of a scene."),
    say("Copy it, rename it, and make it yours."),
    transition("Continue", null)
  ]
});
