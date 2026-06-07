import { describe, expect, it } from "vitest";
import { basicSceneExample } from "./basic-scene.example.js";
import { chapterPackExample } from "./chapter-pack.example.js";
import { FIRST_SCENE_ID, SCENES } from "./index.js";

describe("game scene discovery", () => {
  it("ignores copyable example scenes", () => {
    expect(SCENES.scene_example_basic).toBeUndefined();
    expect(SCENES.scene_example_pack_intro).toBeUndefined();
    expect(SCENES.scene_example_pack_followup).toBeUndefined();
    expect(FIRST_SCENE_ID).toEqual(expect.any(String));
  });

  it("keeps the basic scene example copyable and scene-shaped", () => {
    expect(basicSceneExample).toMatchObject({
      id: "scene_example_basic",
      mode: "test",
      script: expect.arrayContaining([
        expect.objectContaining({ type: "surface", id: "irl" }),
        expect.objectContaining({ type: "say" })
      ])
    });
  });

  it("keeps the chapter pack example copyable and scene-shaped", () => {
    expect(chapterPackExample).toHaveLength(2);
    expect(chapterPackExample.map((scene) => scene.id)).toEqual([
      "scene_example_pack_intro",
      "scene_example_pack_followup"
    ]);
    expect(chapterPackExample[0].script).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "surface", id: "irl" }),
      expect.objectContaining({ type: "transition", target: "scene_example_pack_followup" })
    ]));
  });
});
