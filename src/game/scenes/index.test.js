import { beforeAll, describe, expect, it } from "vitest";
import { installAuthorApiGlobal } from "../../player/author-api.js";

let basicSceneExample = null;
let chapterPackExample = null;
let FIRST_SCENE_ID = null;
let SCENES = null;

beforeAll(async () => {
  installAuthorApiGlobal();
  basicSceneExample = (await import("./basic-scene.example.js")).basicSceneExample;
  chapterPackExample = (await import("./chapter-pack.example.js")).chapterPackExample;
  const discovered = await import("./index.js");
  FIRST_SCENE_ID = discovered.FIRST_SCENE_ID;
  SCENES = discovered.SCENES;
});

describe("game scene discovery", () => {
  it("ignores copyable example scenes", () => {
    expect(SCENES["scene-example-basic"]).toBeUndefined();
    expect(SCENES["scene-example-pack-intro"]).toBeUndefined();
    expect(SCENES["scene-example-pack-followup"]).toBeUndefined();
    expect(FIRST_SCENE_ID).toEqual(expect.any(String));
  });

  it("keeps the basic scene example copyable and scene-shaped", () => {
    expect(basicSceneExample).toMatchObject({
      id: "scene-example-basic",
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
      "scene-example-pack-intro",
      "scene-example-pack-followup"
    ]);
    expect(chapterPackExample[0].script).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "surface", id: "irl" }),
      expect.objectContaining({ type: "transition", target: "scene-example-pack-followup" })
    ]));
  });
});
