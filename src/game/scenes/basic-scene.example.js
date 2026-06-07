import { scene, stage, say, show, transition } from "../vn.js";

export const basicSceneExample = scene({
  id: "scene_example_basic",
  mode: "test",
  cast: ["me", "alex"],
  script: [
    stage("irl"),
    show("alex", {
      outfit: "casual",
      expression: "neutral",
      at: "center"
    }),
    say("alex", "This is the shape of a scene."),
    transition("Continue", null)
  ]
});

