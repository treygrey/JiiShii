import { scene, stage, say, transition } from "../vn.js";

export default scene({
  id: "starter-scene",
  title: "Starter Scene",
  cast: ["me"],
  script: [
    stage("irl"),
    say("This is a starter JiiShii scene."),
    transition("Restart", "starter-scene")
  ]
});
