export const GAME_CONFIG = {
  title: "Starter VN",
  subtitle: "A new JiiShii game",
  about: "Replace this starter package with your own scenes and assets.",
  footer: "Built with JiiShii",
  firstSceneId: "starter-scene",
  storageNamespace: "starter-vn",
  display: {
    // Use "16:9", "4:3", "21:9", or "free" for fully responsive layout.
    aspectRatio: "16:9",
    // Caps narration line length on ultrawide displays.
    narrationMaxChars: 80
  },
  shell: {
    historyTitle: "History",
    historyEmptyLabel: "No dialogue yet.",
    preferencesTitle: "Preferences",
    preferencesDefaultsLabel: "Defaults",
    confirmOverwriteText: "Overwrite this save slot?",
    confirmLoadText: "Load this save and leave the current scene?"
  },
  audioScenes: {},
  extras: {
    // Title-screen gallery/music room. Entries unlock automatically the first
    // time the asset is shown (cg/image/saveGalleryImage) or played (music).
    gallery: [],
    music: []
  }
};
