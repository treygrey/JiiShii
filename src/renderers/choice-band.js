/**
 * Creates the shared in-world choice band used by surfaces that sit over the
 * IRL scene. The band preserves the current visual context instead of turning
 * decisions into a modal screen.
 *
 * @param {object} choiceCommand - Choice command with prompt/options.
 * @param {Function} onSelect - Called with the selected option.
 * @returns {HTMLElement} Choice overlay element ready to append.
 */
export function createChoiceBand(choiceCommand, onSelect) {
  const overlay = document.createElement("div");
  overlay.className = "irl-choice-overlay";
  overlay.setAttribute("role", "presentation");

  const band = document.createElement("div");
  band.className = "irl-choice-band";

  if (choiceCommand.prompt) {
    const prompt = document.createElement("div");
    prompt.className = "irl-choice-prompt";
    prompt.textContent = choiceCommand.prompt;
    band.append(prompt);
  }

  const list = document.createElement("div");
  list.className = "irl-choice-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", choiceCommand.prompt || "Choices");

  for (const option of choiceCommand.options) {
    const button = document.createElement("button");
    button.className = "irl-choice-option";
    if (option.seen) {
      button.classList.add("is-seen");
    }
    button.setAttribute("role", "option");
    button.type = "button";
    button.textContent = option.text;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(option);
    });
    list.append(button);
  }

  band.append(list);
  overlay.append(band);
  return overlay;
}
