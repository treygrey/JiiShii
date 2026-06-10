const SAVE_KEY = "jiishii-save";
const AUTOSAVE_KEY = "jiishii-autosave";
const SLOT_PREFIX = "jiishii-save-slot-";

/**
 * Normalizes localStorage key settings for saves.
 *
 * @param {object} [storageKeys] - Configured storage keys.
 * @returns {object} Normalized storage key config.
 */
export function normalizeStorageKeys(storageKeys = {}) {
  return {
    save: storageKeys.save ?? SAVE_KEY,
    autosave: storageKeys.autosave ?? AUTOSAVE_KEY,
    slotPrefix: storageKeys.slotPrefix ?? SLOT_PREFIX,
    legacySave: storageKeys.legacySave ?? null,
    legacyAutosave: storageKeys.legacyAutosave ?? null,
    legacySlotPrefix: storageKeys.legacySlotPrefix ?? null
  };
}

/**
 * Reads the first populated localStorage value from a key list.
 *
 * @param {Array<string|null>} keys - Candidate keys.
 * @returns {string|null} Stored value or null.
 */
export function readFirstStorage(keys) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }
  return null;
}
