import { normalizeGameConfig } from "../engine/game-config.js";

export const GAME_CONFIG = normalizeGameConfig({
  title: "Starter VN",
  subtitle: "A new JiiShii game",
  about: "Replace this starter package with your own scenes and assets.",
  footer: "Built with JiiShii",
  firstSceneId: "starter_scene",
  storageNamespace: "starter-vn",
  shell: {
    historyTitle: "History",
    historyEmptyLabel: "No dialogue yet.",
    preferencesTitle: "Preferences",
    preferencesDefaultsLabel: "Defaults",
    confirmOverwriteText: "Overwrite this save slot?",
    confirmLoadText: "Load this save and leave the current scene?"
  },
  audioScenes: {}
});
