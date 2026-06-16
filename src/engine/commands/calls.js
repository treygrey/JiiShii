/**
 * Starts or updates an authored phone call on the phone_call story surface.
 *
 * @param {string} contact - Character/contact id.
 * @param {object} [options] - Call metadata.
 * @returns {object} Phone call command.
 */
export function call(contact, options = {}) {
  return {
    ...options,
    type: "call",
    contact
  };
}

/**
 * Ends the active authored phone call.
 *
 * @param {object} [options] - End-call metadata.
 * @returns {object} End call command.
 */
export function endCall(options = {}) {
  return {
    ...options,
    type: "endCall"
  };
}

/**
 * Adds a voicemail entry to the Calls phone app.
 *
 * @param {string} id - Stable voicemail id.
 * @param {string} contact - Character/contact id.
 * @param {object} [options] - Voicemail metadata.
 * @returns {object} Voicemail command.
 */
export function voicemail(id, contact, options = {}) {
  return {
    ...options,
    type: "voicemail",
    id,
    contact
  };
}
