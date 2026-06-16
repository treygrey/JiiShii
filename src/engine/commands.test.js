import { describe, expect, it } from "vitest";
import {
  audioScene,
  background,
  call,
  character,
  choice,
  condition,
  dialogue,
  image,
  media,
  move,
  music,
  pause,
  phoneNotify,
  photo,
  saveGalleryImage,
  say,
  scene,
  socialFollow,
  socialLike,
  socialPost,
  streamImage,
  streamChat,
  streamChatBlock,
  streamLayout,
  streamNarration,
  streamVideo,
  text,
  textImage,
  thread,
  voicemail
} from "./commands/index.js";

describe("author command helpers", () => {
  it("keeps command structural fields authoritative over options", () => {
    expect(background("room-day", { type: "sound", id: "wrong" })).toMatchObject({
      type: "background",
      id: "room-day"
    });
    expect(image("photo", "asset-id", { type: "sound", id: "wrong", asset: "wrong", kind: "video" })).toMatchObject({
      type: "showIrlImage",
      id: "photo",
      asset: "asset-id",
      kind: "image"
    });
    expect(media("rain", { type: "sound", id: "wrong", kind: "video", asset: "rain-loop" })).toMatchObject({
      type: "showIrlImage",
      id: "rain",
      kind: "video",
      asset: "rain-loop"
    });
    expect(move("alex", "left", { type: "sound", id: "wrong" })).toMatchObject({
      type: "moveCharacter",
      id: "alex",
      at: "left"
    });
    expect(pause(250, { type: "sound", duration: 999 })).toMatchObject({
      type: "pause",
      duration: 250
    });
  });

  it("keeps text, phone, social, audio, and streaming helper identities stable", () => {
    expect(thread("alex", { type: "sound", id: "wrong" })).toMatchObject({ type: "thread", id: "alex" });
    expect(text("alex", "hello", { kind: "image", id: "wrong", message: "wrong" })).toMatchObject({
      kind: "text",
      id: "alex",
      message: "hello"
    });
    expect(textImage("alex", "photo-id", { kind: "text", image: "wrong" })).toMatchObject({
      kind: "image",
      id: "alex",
      image: "photo-id"
    });
    expect(photo("alex", "photo-id", { kind: "text", id: "wrong", image: "wrong" }).texts[0]).toMatchObject({
      kind: "image",
      id: "alex",
      image: "photo-id"
    });
    expect(phoneNotify("social", { type: "sound", app: "wrong" })).toMatchObject({ type: "phoneNotify", app: "social" });
    expect(saveGalleryImage("entry", "asset-id", { type: "sound", id: "wrong", image: "wrong" })).toMatchObject({
      type: "saveGalleryImage",
      id: "entry",
      image: "asset-id"
    });
    expect(socialPost("post", { type: "sound", id: "wrong" })).toMatchObject({ type: "socialPost", id: "post" });
    expect(socialFollow("alex", { type: "sound", poster: "wrong" })).toMatchObject({ type: "socialFollow", poster: "alex" });
    expect(socialLike("post", { type: "sound", id: "wrong" })).toMatchObject({ type: "socialLike", id: "post" });
    expect(music("track", { type: "sound", id: "wrong" })).toMatchObject({ type: "music", id: "track" });
    expect(audioScene("scene-audio", { type: "sound", id: "wrong" })).toMatchObject({ type: "audioScene", id: "scene-audio" });
    expect(streamLayout({ type: "sound", title: "Live" })).toMatchObject({ type: "streamLayout", title: "Live" });
    expect(streamImage("cam", { type: "sound", image: "wrong" })).toMatchObject({ type: "streamImage", image: "cam" });
    expect(streamVideo("clip", { type: "sound", video: "wrong" })).toMatchObject({ type: "streamVideo", video: "clip" });
    expect(streamNarration("hi", { type: "sound", message: "wrong" })).toMatchObject({ type: "streamNarration", message: "hi" });
    expect(streamChat("viewer", "hello", { kind: "system", id: "wrong", message: "wrong" })).toMatchObject({
      kind: "streamChat",
      id: "viewer",
      message: "hello"
    });
    expect(streamChatBlock("block-a", [streamChat("viewer", "hello")], { type: "sound", messages: [] })).toMatchObject({
      type: "streamChatBlock",
      id: "block-a",
      messages: [expect.objectContaining({ id: "viewer", message: "hello" })]
    });
    expect(call("alex", { type: "sound", contact: "wrong" })).toMatchObject({ type: "call", contact: "alex" });
    expect(voicemail("vm-a", "alex", { type: "sound", id: "wrong", contact: "wrong" })).toMatchObject({
      type: "voicemail",
      id: "vm-a",
      contact: "alex"
    });
  });

  it("keeps narrative helper types stable while preserving intended author metadata", () => {
    expect(dialogue("alex", "hello", { type: "sound", id: "wrong", message: "wrong" })).toMatchObject({
      type: "dialogue",
      id: "alex",
      message: "hello"
    });
    expect(say("alex", "hello", { type: "sound", speaker: "wrong", lines: ["wrong"] })).toMatchObject({
      type: "say",
      speaker: "alex",
      lines: ["hello"]
    });
    expect(choice({ type: "sound", id: "choice-a", options: ["A"] })).toMatchObject({
      type: "choice",
      id: "choice-a"
    });
    expect(condition({ type: "sound", flag: "met", then: "yes" })).toMatchObject({
      type: "condition",
      flag: "met",
      then: "yes"
    });
    expect(character({ type: "sound", id: "alex", useGlobal: true })).toMatchObject({
      type: "character",
      id: "alex",
      useGlobal: false
    });
    expect(scene({ id: "demo", script: [condition({ if: { flag: "x" }, then: [say("alex", "yes")] })] }).script)
      .toContainEqual(expect.objectContaining({ type: "condition" }));
  });
});
