/**
 * Returns the visual state class for a save slot.
 *
 * @param {object|null} metadata - Save metadata.
 * @returns {string} Tile state class.
 */
export function saveSlotClassName(metadata) {
  if (!metadata) {
    return "is-empty";
  }
  return metadata.corrupted ? "is-corrupt" : "has-data";
}

/**
 * Builds display text for a save slot without embedding HTML.
 *
 * @param {string} label - Slot label.
 * @param {object|null} metadata - Save metadata.
 * @returns {object} Slot view model.
 */
export function createSaveSlotView(label, metadata) {
  if (!metadata) {
    return {
      label,
      scene: "Empty",
      detail: "-",
      date: "-",
      className: saveSlotClassName(metadata),
      canOverwrite: false,
      canLoad: false
    };
  }
  if (metadata.corrupted) {
    return {
      label,
      scene: "Unreadable save",
      detail: "Load to inspect",
      date: "Could not parse",
      className: saveSlotClassName(metadata),
      canOverwrite: true,
      canLoad: true
    };
  }

  const scene = metadata.sceneTitle ?? metadata.currentSceneId ?? metadata.sceneId ?? "Unknown scene";
  const kind = metadata.kind === "snapshot" ? "Snapshot" : "Scene start";
  const surface = metadata.activeSurface ? ` / ${metadata.activeSurface}` : "";
  const command = Number.isInteger(metadata.commandIndex) && metadata.commandIndex > 0
    ? ` / #${metadata.commandIndex}`
    : "";
  const date = metadata.timestamp ? new Date(metadata.timestamp).toLocaleString() : "No timestamp";
  return {
    label,
    scene,
    detail: `${kind}${surface}${command}`,
    date,
    className: saveSlotClassName(metadata),
    canOverwrite: true,
    canLoad: true
  };
}
