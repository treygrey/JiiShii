import { scene, stage, say, transition } from "../vn.js";

export const chapterPackExample = [
  scene({
    id: "scene_example_pack_intro",
    mode: "test",
    cast: ["me", "alex"],
    script: [
      stage("irl"),
      say("alex", "This is the first scene in a pack."),
      transition("Next", "scene_example_pack_followup")
    ]
  }),
  scene({
    id: "scene_example_pack_followup",
    mode: "test",
    cast: ["me", "alex"],
    script: [
      stage("texting"),
      say("alex", "This is the follow-up scene.")
    ]
  })
];

