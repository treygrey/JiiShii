import {
  background,
  call,
  character,
  choice,
  endCall,
  transition,
  mark,
  narrate,
  phoneApps,
  phoneButton,
  phoneNotify,
  saveGalleryImage,
  say,
  scene,
  setWallpaper,
  socialFollow,
  socialLike,
  socialPost,
  stage,
  streamChat,
  streamChatBlock,
  streamLayout,
  streamTitle,
  streamVideo,
  voicemail,
} from "../vn.js";

export default scene({
  id: "scene-phone-tour",
  title: "Phone Surface Tour",
  cast: ["guide", "friend", "critic"],
  characters: [
    character({ id: "guide", name: "Guide", color: "#8ab4f8", side: "left" }),
    character({ id: "friend", name: "Alex", color: "#f472a6", side: "left" }),
    character({ id: "critic", name: "Sam", color: "#4ade80", side: "left" }),
  ],
  script: [
    stage("irl"),
    background("tour_room_day"),
    phoneButton(true),
    phoneApps(["texting", "calls", "gallery", "social"]),
    saveGalleryImage("tour_selfie", "tour_gallery_selfie", {
      caption: "A saved photo from a message thread.",
      tags: ["Friends", "Tour"],
    }),
    saveGalleryImage("tour_group", "tour_gallery_group", {
      caption: "A saved group shot for gallery sorting.",
      tags: ["Friends", "Tour"],
    }),
    saveGalleryImage("tour_wallpaper", "tour_gallery_wallpaper", {
      caption: "A phone wallpaper candidate.",
      tags: ["Wallpapers", "Tour"],
    }),
    socialPost("tour_alex_first_post", {
      poster: "friend",
      text: "testing whether this app can make a normal photo look normal",
      image: "tour_social_post",
      notify: true,
      likeFlag: "liked_tour_alex_first_post",
      followFlag: "follows_alex",
      replies: 3,
      reposts: 1,
      likes: 14,
      views: 128,
    }),
    socialPost("tour_sam_text_post", {
      poster: "critic",
      text: "The trick is making extra interfaces feel like the same story, not a second game taped to the side.",
      followFlag: "follows_sam",
      replies: 0,
      reposts: 2,
      likes: 9,
      views: 74,
    }),
    voicemail("tour_voicemail", "guide", {
      text: "This is a saved voicemail. It lives in the Calls app, but it is not driving the story.",
      notify: true,
    }),
    narrate("The phone icon is live now. This little tour is going to make the phone prove it can behave like a real surface without stealing the whole scene."),
    say("guide", "First stop: gallery. I saved a few images for you."),
    say("guide", "Open the phone, go to Gallery, look at the photos, and try setting the wallpaper image as your phone background."),
    phoneNotify("gallery", { text: "3 new saved images" }),
    choice({
      prompt: "Gallery checkpoint",
      options: [
        { text: "I checked the gallery and wallpaper.", goto: "social_tour" },
      ],
    }),

    mark("social_tour"),
    setWallpaper("tour_gallery_wallpaper"),
    say("critic", "Now social media. You should have a notification waiting."),
    say("critic", "Open Social. If the feed is empty, use Discover to follow Alex. Then come back after you see the post."),
    choice({
      prompt: "Social checkpoint",
      options: [
        { text: "I followed Alex and opened the post.", goto: "social_image_tour" },
      ],
    }),

    mark("social_image_tour"),
    socialFollow("friend", { flag: "follows_alex" }),
    socialLike("tour_alex_first_post", { flag: "liked_tour_alex_first_post" }),
    say("friend", "My post image is phone-shaped on purpose. The feed should crop it like an app thumbnail instead of stretching the whole screen around it."),
    say("friend", "Tap the image in the post. It should open full-size, then you can back out to the feed."),
    choice({
      prompt: "Post image checkpoint",
      options: [
        { text: "The post image opened full-size.", goto: "call_tour" },
      ],
    }),

    mark("call_tour"),
    stage("phone_call"),
    call("guide", { title: "Connected" }),
    say("guide", "This is a phone call. It looks like the phone, but it is story-first and modal."),
    say("guide", "The Home button is disabled because calls are time-sensitive. The author ends the call when the story is ready."),
    choice({
      prompt: "Call checkpoint",
      options: [
        { text: "Stay on the call.", goto: "call_end" },
      ],
    }),

    mark("call_end"),
    endCall(),
    stage("irl"),
    background("tour_room_day"),
    say("guide", "The call is over. Now the Calls app should show a recent call and a voicemail."),
    say("guide", "Open Calls, check Recents and Voicemail, then come back."),
    choice({
      prompt: "Calls app checkpoint",
      options: [
        { text: "Calls and voicemail worked.", goto: "stream_tour" },
      ],
    }),

    mark("stream_tour"),
    stage("streaming"),
    streamTitle("stream.local/channel"),
    streamLayout("channel"),
    streamVideo("tour_stream_preview_video", {
      mode: "replace",
      image: "tour_stream_preview",
      fit: "cover",
      muted: true,
    }),
    streamChatBlock("tour_chat", [
      streamChat("pixelrat", "is this the phone build?"),
      streamChat("softserve", "gallery works now?"),
      streamChat("modemghost", "social app thumbnail check"),
      streamChat("nightjar", "tap the phone button during stream too"),
    ]),
    say("guide", "Streaming is still the story surface here. The phone is just something you can pull over it."),
    say("guide", "Open the phone from this stream, then close it. You should land right back here, not in a blank phone void."),
    choice({
      prompt: "Stream checkpoint",
      options: [
        { text: "Phone returns to the current surface.", goto: "texting_tour" },
      ],
    }),

    mark("texting_tour"),
    stage("texting"),
    say("guide", "Last stop is Messages. This thread is story-driving, so the home button should not erase this choice state."),
    say("guide", "Open Home, look around, then return to this active thread. The choice should still be here."),
    choice({
      prompt: "Texting checkpoint",
      options: [
        { text: "The active thread kept its choice.", goto: "done" },
      ],
    }),

    mark("done"),
    stage("irl"),
    background("tour_room_day"),
    say("critic", "That is the shape of it: home screen, gallery, social, stream overlay, and story texting without the phone eating the script."),
    narrate("Phone surface tour complete."),
    transition("Run Alex branch test", "scene-alex-branch-test"),
  ],
});
