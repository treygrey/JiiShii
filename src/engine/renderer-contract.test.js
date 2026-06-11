import { describe, expect, it } from "vitest";
import { validateRendererContracts } from "./surfaces/renderer-contract.js";

/**
 * Builds a fake renderer with only contract metadata.
 *
 * @param {string} surface - Surface id.
 * @param {string[]} commands - Supported command types.
 * @returns {object} Fake renderer.
 */
function renderer(surface, commands, projections = []) {
  const fake = {
    contract: { surface, commands, projections }
  };
  for (const projection of projections) {
    fake[projection] = () => {};
  }
  return fake;
}

function validRenderers() {
  return {
    texting: renderer("texting", ["textBlock", "thread", "choice", "transition"], ["renderTextingState"]),
    irl: renderer("irl", [
      "showCharacter",
      "hideCharacter",
      "hideAllCharacters",
      "clearIrlStage",
      "setCharacterExpression",
      "moveCharacter",
      "showIrlImage",
      "moveIrlImage",
      "clearIrlImage",
      "lineBlock",
      "choice",
      "transition"
    ], ["renderSpriteState"]),
    streaming: renderer("streaming", [
      "streamLayout",
      "streamImage",
      "streamChatBlock",
      "streamNarration",
      "streamTitle",
      "streamWindow",
      "streamSystem",
      "streamPost",
      "choice",
      "transition"
    ], ["renderStreamingState"]),
    phone_home: renderer("phone_home", ["choice", "transition"], ["renderPhoneHomeState"]),
    gallery: renderer("gallery", ["choice", "transition"], ["renderGalleryState"]),
    social: renderer("social", ["choice", "transition"], ["renderSocialState"])
  };
}

describe("validateRendererContracts", () => {
  it("accepts a renderer map that covers command metadata", () => {
    expect(() => validateRendererContracts(validRenderers())).not.toThrow();
  });

  it("throws when a required renderer is missing", () => {
    const renderers = validRenderers();
    delete renderers.texting;

    expect(() => validateRendererContracts(renderers)).toThrow(/missing renderer.*texting/);
  });

  it("throws when a renderer declares the wrong surface", () => {
    const renderers = validRenderers();
    renderers.texting = renderer("irl", ["textBlock", "thread", "choice", "transition"], ["renderTextingState"]);

    expect(() => validateRendererContracts(renderers)).toThrow(/registered as "texting".*declares surface "irl"/);
  });

  it("throws when a renderer is missing required command support", () => {
    const renderers = validRenderers();
    renderers.streaming = renderer("streaming", ["streamLayout", "choice", "transition"], ["renderStreamingState"]);

    expect(() => validateRendererContracts(renderers)).toThrow(/streaming.*missing command support/);
    expect(() => validateRendererContracts(renderers)).toThrow(/streamWindow/);
  });

  it("throws when a renderer is missing required projection support", () => {
    const renderers = validRenderers();
    renderers.texting = renderer("texting", ["textBlock", "thread", "choice", "transition"]);

    expect(() => validateRendererContracts(renderers)).toThrow(/texting.*missing projection support/);
    expect(() => validateRendererContracts(renderers)).toThrow(/renderTextingState/);
  });

  it("throws when a declared projection method is not implemented", () => {
    const renderers = validRenderers();
    renderers.irl.renderSpriteState = undefined;

    expect(() => validateRendererContracts(renderers)).toThrow(/irl.*missing projection support/);
    expect(() => validateRendererContracts(renderers)).toThrow(/renderSpriteState/);
  });
});
