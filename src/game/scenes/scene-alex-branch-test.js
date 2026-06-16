import {
  background,
  block,
  call,
  cg,
  character,
  choice,
  clearCg,
  clearImage,
  clearStage,
  condition,
  endCall,
  expression,
  flash,
  goto,
  hide,
  hideAll,
  image,
  input,
  line,
  lineBlock,
  mark,
  move,
  moveImage,
  narrate,
  pause,
  persistFlag,
  phoneApps,
  phoneButton,
  phoneNotify,
  reply,
  roll,
  saveAdd,
  saveGalleryImage,
  saveVar,
  say,
  scene,
  set,
  setWallpaper,
  shake,
  show,
  socialFollow,
  socialLike,
  socialPost,
  stage,
  streamChat,
  streamChatBlock,
  streamLayout,
  streamPost,
  streamTitle,
  streamVideo,
  text,
  textImage,
  thread,
  transition,
  video,
  voicemail
} from "../vn.js";

export default scene({
  id: "scene-alex-branch-test",
  title: "Alex Branch And Sprite Test",
  cast: ["alex", "riley", "guide", "player"],
  characters: [
    character({
      id: "alex",
      name: "Alex",
      color: "#fb6f92",
      side: "left",
      defaultExpression: "smile",
      defaultOutfit: "casual"
    }),
    character({ id: "riley", name: "Riley", color: "#6bcb77", side: "left" }),
    character({ id: "guide", name: "Guide", color: "#8ab4f8", side: "left" })
  ],
  script: [
    stage("irl"),
    background("tour_room_day", { transition: "fade_to_black", duration: 500 }),
    phoneButton(true),
    phoneApps(["texting", "calls", "gallery", "social"]),
    saveVar("branch_test_runs", 1),
    saveAdd("branch_test_runs", 1),
    persistFlag("alex_branch_test_unlocked", true),
    set("alex_points", 0),
    set("route_style", ""),
    roll("test_roll", 1, 6),
    saveGalleryImage("branch_wallpaper", "tour_gallery_wallpaper", {
      caption: "Wallpaper saved by the branching test.",
      tags: ["Tests", "Wallpapers"]
    }),
    saveGalleryImage("branch_social_photo", "tour_social_post", {
      caption: "Photo used by the social and texting checkpoints.",
      tags: ["Tests", "Alex"]
    }),
    setWallpaper("tour_gallery_wallpaper"),
    socialPost("branch_alex_post", {
      poster: "alex",
      text: "Running the branch harness. If this shows up, social posts survived the setup pass.",
      image: "tour_social_post",
      notify: true,
      followFlag: "branch_follows_alex",
      likeFlag: "branch_liked_alex_post",
      replies: 2,
      reposts: 0,
      likes: 11,
      views: 63
    }),
    socialFollow("alex", { flag: "branch_follows_alex" }),
    socialLike("branch_alex_post", { flag: "branch_liked_alex_post" }),
    voicemail("branch_voicemail", "alex", {
      text: "This voicemail was created before the call, so the Calls app has both tabs populated.",
      notify: true
    }),
    input("tester_name", {
      prompt: "Name for interpolation/input testing",
      default: "Tester",
      maxLength: 24
    }),
    narrate("This scene is a command gauntlet. It uses Alex's new full-body sprite poses, branches, converges, and tries to touch most non-audio systems."),
    show("alex", {
      expression: "wave",
      at: "center",
      transition: "moveInLeft",
      duration: 420
    }),
    say("alex", "New sprite check: wave pose, full-body recipe, center staging."),
    expression("alex", "smile"),
    say("alex", "Expression swap check. This should replace the full-body pose without losing the stage."),
    move("alex", { at: "left", scale: 1.04, duration: 350, transition: "dissolve" }),
    image("branch_photo", "tour_gallery_selfie", {
      layer: "front",
      fit: "contain",
      x: 74,
      y: 47,
      width: 24,
      alpha: 0.92,
      transition: "dissolve"
    }),
    say("alex", "Foreground image check. This little photo should sit in front of the sprite layer."),
    moveImage("branch_photo", { x: 70, y: 42, width: 28, alpha: 1, duration: 300 }),
    say("alex", "Foreground image check. The photo moved without stealing the whole stage."),
    clearImage("branch_photo", { transition: "fade", duration: 240 }),

    choice({
      id: "branch_test_route_choice",
      prompt: "Pick a branch. Both paths converge, but they set different variables.",
      options: [
        {
          text: "Trust Alex and step closer.",
          goto: "trust_path",
          set: { route_style: "trust", alex_points: "+2", trusted_alex: true }
        },
        {
          text: "Challenge Alex and keep distance.",
          goto: "challenge_path",
          set: { route_style: "challenge", alex_points: "+1", challenged_alex: true }
        },
        {
          text: "Stay quiet and make the engine decide.",
          goto: "quiet_path",
          set: { route_style: "quiet" }
        }
      ]
    }),

    mark("trust_path"),
    expression("alex", "clasped_hands_smile"),
    say("alex", "Trust path. Points went up harder, and the pose should soften."),
    goto("branch_converge"),

    mark("challenge_path"),
    expression("alex", "crossed_arms"),
    say("alex", "Challenge path. Less points, sharper pose, same convergence target."),
    goto("branch_converge"),

    mark("quiet_path"),
    expression("alex", "thinking"),
    condition({
      if: { var: "test_roll", atLeast: 4 },
      then: [
        set("alex_points", "+2"),
        say("alex", "Quiet path rolled high, so the branch still pays out.")
      ],
      else: [
        set("alex_points", "+1"),
        say("alex", "Quiet path rolled low, so the branch pays out cautiously.")
      ]
    }),
    goto("branch_converge"),

    mark("branch_converge"),
    lineBlock([
      line("alex", "Convergence check. The route variable is {$route_style}.", { expression: "questioning" }),
      line("riley", "And the numeric test value is {$alex_points}.")
    ]),
    condition({
      if: { var: "alex_points", atLeast: 2 },
      then: [
        expression("alex", "wink"),
        say("alex", "Condition branch: high score line.")
      ],
      elseIf: [
        {
          if: { flag: "challenged_alex" },
          then: [
            expression("alex", "puzzled"),
            say("alex", "Else-if branch: challenge flag line.")
          ]
        }
      ],
      else: [
        expression("alex", "hand_on_cheek"),
        say("alex", "Else branch: fallback line.")
      ]
    }),
    flash({ color: "rgba(138, 180, 248, 0.5)", duration: 180 }),
    shake({ intensity: 4, duration: 180 }),
    pause(220),
    cg("tour_gallery_group", { fit: "cover", transition: "dissolve" }),
    narrate("CG check. This should cover the stage, then clear cleanly."),
    clearCg({ transition: "fade", duration: 260 }),
    video("tour_stream_preview_video", {
      startAt: 0,
      endAt: 1100,
      fit: "cover",
      muted: true
    }),
    narrate("Fullscreen video check complete. Next stop: phone systems."),
    goto("phone_branch_checkpoint"),

    mark("phone_branch_checkpoint"),
    phoneNotify("gallery", { text: "Branch test images saved" }),
    phoneNotify("social", { text: "Alex posted from the branch test" }),
    say("alex", "Phone apps are preloaded. Gallery, Social, and Calls should all have something to inspect."),
    choice({
      id: "branch_test_phone_choice",
      prompt: "Optional app checkpoint",
      options: [
        { text: "I checked the phone apps.", goto: "call_branch" },
        { text: "Skip app inspection for now.", goto: "skip_phone_inspection" }
      ]
    }),

    mark("skip_phone_inspection"),
    set("skipped_phone_inspection", true),
    say("alex", "Skipping the app inspection is fine. This branch just proves a second choice target can converge cleanly."),
    goto("call_branch"),

    mark("call_branch"),
    stage("phone_call"),
    call("alex", { title: "Branch follow-up" }),
    say("alex", "Phone call surface check. Same phone shell, shared narration, modal controls."),
    choice({
      id: "branch_test_call_choice",
      prompt: "Call branch",
      options: [
        { text: "Ask for the stream test.", goto: "call_stream_request", set: { asked_for_stream: true } },
        { text: "End the call cleanly.", goto: "call_clean_end" }
      ]
    }),

    mark("call_stream_request"),
    say("alex", "Good. The stream test should not freeze chat behind the video anymore."),
    goto("after_call_choice"),

    mark("call_clean_end"),
    say("alex", "Clean end path. Still converges before the stream."),

    mark("after_call_choice"),
    endCall(),
    stage("streaming"),
    streamTitle("test.local/alex-branch"),
    streamLayout("channel"),
    streamVideo("tour_stream_preview_video", {
      mode: "replace",
      image: "tour_stream_preview",
      fit: "cover",
      muted: true
    }),
    streamChatBlock("branch_stream_chat", [
      streamChat("pixelrat", "video and chat at the same time?"),
      streamChat("softserve", "branch variable is {$route_style}"),
      streamChat("modemghost", "sprite test passed?"),
      streamChat("nightjar", "now post as the player")
    ]),
    condition({
      if: { flag: "asked_for_stream" },
      then: [
        streamPost("Asked for this stream on the call."),
        say("alex", "The call choice changed the stream text.")
      ],
      else: [
        streamPost("Let the call end without asking."),
        say("alex", "The stream still runs after the alternate call choice.")
      ]
    }),
    choice({
      id: "branch_test_stream_choice",
      prompt: "Stream checkpoint",
      options: [
        { text: "Video, chat, and stream post worked.", goto: "texting_branch" }
      ]
    }),

    mark("texting_branch"),
    stage("texting"),
    thread("alex", { subtitle: "Branch harness" }),
    block([
      text("alex", "Texting stage check. Your chosen route was {$route_style}."),
      textImage("alex", "tour_social_post", { caption: "Image attachment in the active thread." }),
      reply("The message image and thread state are visible.")
    ]),
    condition({
      if: { var: "tester_name", hasText: true },
      then: [
        say("alex", "Input check says your test name is {$tester_name}.")
      ],
      else: [
        say("alex", "Input check found no name.")
      ]
    }),
    choice({
      id: "branch_test_text_choice",
      prompt: "Final texting branch",
      options: [
        { text: "Save route completion.", goto: "route_complete", set: { final_text_choice: "save" } },
        { text: "End without saving route.", goto: "route_skip", set: { final_text_choice: "skip" } }
      ]
    }),

    mark("route_complete"),
    persistFlag("alex_branch_test_complete", true),
    say("alex", "Persistent route flag set. This is the New Game Plus style domain."),
    goto("finish"),

    mark("route_skip"),
    say("alex", "Skipped the persistent completion flag. Regular story variables still recorded the choice."),

    mark("finish"),
    stage("irl"),
    background("tour_room_day", { transition: "cut" }),
    show("alex", { expression: "peace_sign", at: "center", transition: "moveInRight" }),
    condition({
      if: { flag: "persistent:alex_branch_test_complete" },
      then: [
        say("alex", "Finish check: this run marked completion.")
      ],
      else: [
        say("alex", "Finish check: this run ended without the completion flag.")
      ]
    }),
    hide("alex", { transition: "fade", duration: 260 }),
    hideAll({ transition: "fade", duration: 260 }),
    clearStage({ transition: "fade", duration: 260 }),
    narrate("Alex branch and sprite test complete."),
    transition("Return to the phone tour", "scene-phone-tour")
  ]
});
