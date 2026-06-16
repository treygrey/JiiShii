/**
 * Resolves call/contact metadata from authored command overrides plus character
 * defaults.
 *
 * @param {object} runner - Scene runner.
 * @param {string} contactId - Character/contact id.
 * @param {object} command - Command metadata.
 * @returns {object} Normalized contact metadata.
 */
export function resolveCallContact(runner, contactId, command = {}) {
  const character = runner.characters.get(contactId) ?? {};
  const name = command.name ?? character.name ?? contactId;
  return {
    id: contactId,
    name,
    avatar: command.avatar ?? character.avatar ?? name.slice(0, 1),
    color: command.color ?? character.color ?? null,
    subtitle: command.subtitle ?? ""
  };
}
