import { scene, stage, say, transition } from "../vn.js";

export default scene({
  id: "starter_scene",
  title: "Starter Scene",
  cast: ["me", "alex"],
  script: [
    stage("irl"),
    say("alex", "This is a clean starter scene."),
    say("Drop your own game package into src/game when you are ready."),
    transition("Restart", "starter_scene")
  ]
});
