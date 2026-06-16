import { describe, expect, it } from "vitest";
import {
  applyHideCharacter,
  applyHideAllCharacters,
  applyClearIrlImage,
  applyClearIrlStage,
  applyShowCharacter,
  applyShowIrlImage,
  applyIrlImageTransform,
  applySpriteExpression,
  applySpriteTransform,
  cloneSpriteState,
  createSpriteState,
  normalizeSpriteState
} from "./state/sprite-state.js";

function characters() {
  return new Map([
    ["alex", { id: "alex", defaultOutfit: "casual", defaultExpression: "neutral" }],
    ["riley", { id: "riley", defaultOutfit: "stage_outfit", defaultExpression: "smug" }]
  ]);
}

describe("sprite state helpers", () => {
  it("creates a visible sprite with character defaults", () => {
    const sprites = createSpriteState();

    applyShowCharacter(sprites, { id: "alex", side: "left", flip: true }, characters());

    expect(sprites.irl.visible).toEqual([
      {
        id: "alex",
        outfit: "casual",
        expression: "neutral",
        body: "default",
        side: "left",
        flip: true,
        at: "left",
        x: null,
        y: null,
        scale: 1,
        alpha: 1,
        z: null,
        layer: "characters",
        transition: null,
        duration: null,
        easing: null
      }
    ]);
  });

  it("preserves sticky show fields on partial updates", () => {
    const sprites = createSpriteState();

    applyShowCharacter(
      sprites,
      { id: "alex", outfit: "nude", expression: "happy", side: "right", flip: true },
      characters()
    );
    applyShowCharacter(sprites, { id: "alex", expression: "smirk" }, characters());

    expect(sprites.irl.visible[0]).toEqual({
      id: "alex",
      outfit: "nude",
      expression: "smirk",
      body: "default",
      side: "right",
      flip: true,
      at: "right",
      x: null,
      y: null,
      scale: 1,
      alpha: 1,
      z: null,
      layer: "characters",
      transition: null,
      duration: null,
      easing: null
    });
  });

  it("preserves sticky transform fields on partial show updates", () => {
    const sprites = createSpriteState();

    applyShowCharacter(
      sprites,
      { id: "alex", outfit: "nude", at: "left", x: "32%", y: "4%", scale: 0.92, alpha: 0.8, z: 12 },
      characters()
    );
    applyShowCharacter(sprites, { id: "alex", expression: "smirk" }, characters());

    expect(sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      expression: "smirk",
      at: "left",
      x: "32%",
      y: "4%",
      scale: 0.92,
      alpha: 0.8,
      z: 12
    });
  });

  it("preserves sticky body fields on partial show updates", () => {
    const sprites = createSpriteState();

    applyShowCharacter(sprites, { id: "alex", outfit: "casual", body: "guarded" }, characters());
    applyShowCharacter(sprites, { id: "alex", expression: "smirk" }, characters());

    expect(sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      outfit: "casual",
      expression: "smirk",
      body: "guarded"
    });
  });

  it("preserves sticky transition timing on partial sprite updates", () => {
    const sprites = createSpriteState();

    applyShowCharacter(
      sprites,
      {
        id: "alex",
        transition: "move",
        duration: 180,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      },
      characters()
    );
    applySpriteTransform(sprites, "alex", { at: "right" });
    applyShowCharacter(sprites, { id: "alex", expression: "smirk" }, characters());

    expect(sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      transition: "move",
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    });
  });

  it("hides only the target sprite", () => {
    const sprites = createSpriteState();
    applyShowCharacter(sprites, { id: "alex" }, characters());
    applyShowCharacter(sprites, { id: "riley" }, characters());

    applyHideCharacter(sprites, "alex");

    expect(sprites.irl.visible.map((sprite) => sprite.id)).toEqual(["riley"]);
  });

  it("updates expressions only for visible sprites", () => {
    const sprites = createSpriteState();
    applyShowCharacter(sprites, { id: "alex" }, characters());

    applySpriteExpression(sprites, "alex", "embarrassed");
    applySpriteExpression(sprites, "riley", "annoyed");

    expect(sprites.irl.visible).toHaveLength(1);
    expect(sprites.irl.visible[0].expression).toBe("embarrassed");
  });

  it("applies movement only to visible sprites", () => {
    const sprites = createSpriteState();
    applyShowCharacter(sprites, { id: "alex" }, characters());

    applySpriteTransform(sprites, "alex", { at: "right", scale: 1.08, flip: true });
    applySpriteTransform(sprites, "riley", { at: "left" });

    expect(sprites.irl.visible).toHaveLength(1);
    expect(sprites.irl.visible[0]).toMatchObject({
      id: "alex",
      at: "right",
      scale: 1.08,
      flip: true
    });
  });

  it("hides every sprite and clears focus", () => {
    const sprites = createSpriteState();
    applyShowCharacter(sprites, { id: "alex" }, characters());
    applyShowCharacter(sprites, { id: "riley" }, characters());
    sprites.irl.focus = "alex";

    applyHideAllCharacters(sprites);

    expect(sprites.irl.visible).toEqual([]);
    expect(sprites.irl.focus).toBeNull();
  });

  it("shows and clears IRL CGs and image displayables", () => {
    const sprites = createSpriteState();

    applyShowIrlImage(sprites, {
      id: "__cg",
      asset: "demo_portrait",
      kind: "cg",
      transition: "dissolve"
    });
    applyShowIrlImage(sprites, {
      id: "letter",
      asset: "demo_portrait",
      kind: "image",
      at: "center",
      scale: 0.72
    });

    expect(sprites.irl.images).toEqual([
      expect.objectContaining({
        id: "__cg",
        asset: "demo_portrait",
        kind: "cg",
        layer: "cg",
        fit: "cover"
      }),
      expect.objectContaining({
        id: "letter",
        asset: "demo_portrait",
        kind: "image",
        at: "center",
        scale: 0.72,
        layer: "front",
        fit: "contain"
      })
    ]);

    applyClearIrlImage(sprites, { id: "letter", kind: "image" });
    expect(sprites.irl.images.map((entry) => entry.id)).toEqual(["__cg"]);

    applyClearIrlImage(sprites, { kind: "cg" });
    expect(sprites.irl.images).toEqual([]);
  });

  it("moves image displayables without changing their asset", () => {
    const sprites = createSpriteState();
    applyShowIrlImage(sprites, {
      id: "letter",
      asset: "demo_portrait",
      kind: "image",
      at: "center",
      scale: 0.72
    });

    applyIrlImageTransform(sprites, "letter", { at: "right", scale: 0.9, alpha: 0.7 });
    applyIrlImageTransform(sprites, "missing", { at: "left" });

    expect(sprites.irl.images).toEqual([
      expect.objectContaining({
        id: "letter",
        asset: "demo_portrait",
        at: "right",
        scale: 0.9,
        alpha: 0.7
      })
    ]);
  });

  it("preserves sticky transition timing on partial image updates", () => {
    const sprites = createSpriteState();
    applyShowIrlImage(sprites, {
      id: "letter",
      asset: "demo_portrait",
      kind: "image",
      transition: "move",
      duration: 220,
      easing: "ease-out"
    });

    applyIrlImageTransform(sprites, "letter", { at: "right", alpha: 0.8 });

    expect(sprites.irl.images[0]).toMatchObject({
      id: "letter",
      asset: "demo_portrait",
      transition: "move",
      duration: 220,
      easing: "ease-out",
      at: "right",
      alpha: 0.8
    });
  });

  it("clears all IRL stage displayables", () => {
    const sprites = createSpriteState();
    applyShowCharacter(sprites, { id: "alex", outfit: "casual" }, characters());
    applyShowIrlImage(sprites, { id: "__cg", asset: "demo_portrait", kind: "cg" });
    applyShowIrlImage(sprites, { id: "letter", asset: "demo_portrait", kind: "image" });
    sprites.irl.focus = "alex";

    applyClearIrlStage(sprites);

    expect(sprites.irl).toEqual({
      visible: [],
      images: [],
      focus: null
    });
  });

  it("replaces the active CG instead of stacking multiple CGs", () => {
    const sprites = createSpriteState();

    applyShowIrlImage(sprites, { id: "__cg", asset: "first", kind: "cg" });
    applyShowIrlImage(sprites, { id: "__cg", asset: "second", kind: "cg" });

    expect(sprites.irl.images).toEqual([
      expect.objectContaining({ id: "__cg", asset: "second", kind: "cg" })
    ]);
  });

  it("clones without sharing references and normalizes old shapes", () => {
    const sprites = normalizeSpriteState({
      irl: {
        visible: [{ id: "alex", outfit: "nude" }],
        focus: "alex"
      }
    });

    const clone = cloneSpriteState(sprites);
    clone.irl.visible[0].expression = "happy";
    clone.irl.images.push({ id: "letter", asset: "demo_portrait", kind: "image" });

    expect(sprites.irl.visible[0].expression).toBe("neutral");
    expect(sprites.irl.images).toEqual([]);
    expect(clone.irl.visible[0]).toEqual({
      id: "alex",
      outfit: "nude",
      expression: "happy",
      body: "default",
      side: null,
      flip: false,
      at: null,
      x: null,
      y: null,
      scale: 1,
      alpha: 1,
      z: null,
      layer: "characters",
      transition: null,
      duration: null,
      easing: null
    });
  });
});
