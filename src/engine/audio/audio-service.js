/**
 * Browser-backed audio adapter for music, sound effects, and voice lines.
 */
export class BrowserAudioService {
  /**
   * @param {object} [options] - Audio options.
   * @param {Function} [options.getSettings] - Settings provider.
   * @param {Function} [options.onLog] - Debug logger.
   * @param {Function} [options.resolveAudio] - Game-package audio resolver.
   */
  constructor({ getSettings, onLog, resolveAudio } = {}) {
    this.getSettings = getSettings ?? (() => ({}));
    this.onLog = onLog ?? (() => {});
    this.resolveAudio = resolveAudio ?? (() => null);
    this.music = null;
    this.musicId = null;
    this.ambience = null;
    this.ambienceId = null;
    this.voice = null;
    this.managedSounds = new Map();
    this.transientMeta = new WeakMap();
    this.transientTimers = new WeakMap();
  }

  /**
   * Syncs durable audio state after load or rollback reconstruction.
   *
   * @param {object} audioState - Runner-owned audio state.
   * @param {object} [options] - Sync options.
   * @param {boolean} [options.instant] - Skip fades.
   * @returns {void}
   */
  sync(audioState, { instant = false } = {}) {
    const music = audioState?.music ?? null;
    if (!music) {
      this.stopMusic({ instant });
    } else if (this.musicId !== music.id) {
      this.playMusic(music, { instant });
    } else if (this.music) {
      this.music.volume = this.resolveVolume(music.volume, "music");
      this.music.loop = music.loop !== false;
    }

    const ambience = audioState?.ambience ?? null;
    if (!ambience) {
      this.stopAmbience({ instant });
      return;
    }
    if (this.ambienceId !== ambience.id) {
      this.playAmbience(ambience, { instant });
      return;
    }
    if (this.ambience) {
      this.ambience.volume = this.resolveVolume(ambience.volume, "ambience");
      this.ambience.loop = ambience.loop !== false;
    }
  }

  /**
   * Starts or changes background music.
   *
   * @param {object} music - Music state.
   * @param {object} [options] - Playback options.
   * @returns {void}
   */
  playMusic(music, { instant = false } = {}) {
    const url = this.resolveAudio(music.id);
    if (!url) {
      this.onLog(`Missing music asset: ${music.id}`);
      return;
    }

    if (this.musicId === music.id && this.music) {
      this.music.loop = music.loop !== false;
      this.music.volume = this.resolveVolume(music.volume, "music");
      this.music.play().catch(() => {});
      return;
    }

    const previous = this.music;
    const previousFadeOut = music.fadeOut ?? music.fadeIn ?? 0;
    const audio = new Audio(url);
    audio.loop = music.loop !== false;
    audio.volume = instant ? this.resolveVolume(music.volume, "music") : 0;
    this.music = audio;
    this.musicId = music.id;
    audio.play().catch(() => {});
    this.fadeOutAndStop(previous, { instant, fadeOut: previousFadeOut });

    if (instant || !music.fadeIn) {
      audio.volume = this.resolveVolume(music.volume, "music");
      return;
    }
    this.fade(audio, 0, this.resolveVolume(music.volume, "music"), music.fadeIn);
  }

  /**
   * Stops background music.
   *
   * @param {object} [options] - Stop options.
   * @returns {void}
   */
  stopMusic({ instant = false, fadeOut = 0 } = {}) {
    const current = this.music;
    this.music = null;
    this.musicId = null;
    if (!current) {
      return;
    }
    const finish = () => {
      current.pause();
      current.currentTime = 0;
    };
    if (instant || !fadeOut) {
      finish();
      return;
    }
    this.fade(current, current.volume, 0, fadeOut, finish);
  }

  /**
   * Starts or changes looping ambience.
   *
   * @param {object} ambience - Ambience state.
   * @param {object} [options] - Playback options.
   * @returns {void}
   */
  playAmbience(ambience, { instant = false } = {}) {
    const url = this.resolveAudio(ambience.id);
    if (!url) {
      this.onLog(`Missing ambience asset: ${ambience.id}`);
      return;
    }

    if (this.ambienceId === ambience.id && this.ambience) {
      this.ambience.loop = ambience.loop !== false;
      this.ambience.volume = this.resolveVolume(ambience.volume, "ambience");
      this.ambience.play().catch(() => {});
      return;
    }

    const previous = this.ambience;
    const previousFadeOut = ambience.fadeOut ?? ambience.fadeIn ?? 0;
    const audio = new Audio(url);
    audio.loop = ambience.loop !== false;
    audio.volume = instant ? this.resolveVolume(ambience.volume, "ambience") : 0;
    this.ambience = audio;
    this.ambienceId = ambience.id;
    audio.play().catch(() => {});
    this.fadeOutAndStop(previous, { instant, fadeOut: previousFadeOut });

    if (instant || !ambience.fadeIn) {
      audio.volume = this.resolveVolume(ambience.volume, "ambience");
      return;
    }
    this.fade(audio, 0, this.resolveVolume(ambience.volume, "ambience"), ambience.fadeIn);
  }

  /**
   * Stops looping ambience.
   *
   * @param {object} [options] - Stop options.
   * @returns {void}
   */
  stopAmbience({ instant = false, fadeOut = 0 } = {}) {
    const current = this.ambience;
    this.ambience = null;
    this.ambienceId = null;
    if (!current) {
      return;
    }
    const finish = () => {
      current.pause();
      current.currentTime = 0;
    };
    if (instant || !fadeOut) {
      finish();
      return;
    }
    this.fade(current, current.volume, 0, fadeOut, finish);
  }

  /**
   * Plays a one-shot sound effect.
   *
   * @param {object} command - Sound command.
   * @returns {void}
   */
  playSound(command) {
    this.playOneShot(command, "sound");
  }

  /**
   * Stops a named sound effect that was started with sound(id, { as }).
   *
   * @param {string} handle - Author-facing sound handle.
   * @param {object} [options] - Stop options.
   * @returns {void}
   */
  stopSound(handle, options = {}) {
    const audio = this.managedSounds.get(handle);
    if (!audio) {
      return;
    }
    this.managedSounds.delete(handle);
    this.stopTransientAudio(audio, options);
  }

  /**
   * Plays a one-shot voice line, replacing any current voice line.
   *
   * @param {object} command - Voice command.
   * @returns {void}
   */
  playVoice(command) {
    this.stopTransientAudio(this.voice, { fadeOut: command.fadeOut });
    this.voice = this.playOneShot(command, "voice");
  }

  /**
   * Stops all currently managed audio.
   *
   * @returns {void}
   */
  stopAll() {
    this.stopMusic({ instant: true });
    this.stopAmbience({ instant: true });
    this.stopTransient();
  }

  /**
   * Stops transient audio that should not survive scene transitions or loads.
   *
   * @returns {void}
   */
  stopTransient() {
    this.stopTransientAudio(this.voice);
    this.voice = null;
    for (const audio of this.managedSounds.values()) {
      this.stopTransientAudio(audio);
    }
    this.managedSounds.clear();
  }

  /**
   * Plays a one-shot audio asset.
   *
   * @private
   * @param {object} command - Audio command.
   * @returns {HTMLAudioElement|null} Audio element or null.
   */
  playOneShot(command, channel = "sound") {
    const url = this.resolveAudio(command.id);
    if (!url) {
      this.onLog(`Missing audio asset: ${command.id}`);
      return null;
    }
    const handle = command.as ?? command.handle ?? null;
    if (handle && channel === "sound") {
      this.stopSound(handle, { fadeOut: command.fadeOut });
    }
    const audio = new Audio(url);
    const targetVolume = this.resolveVolume(command.volume ?? 1, channel);
    audio.volume = command.fadeIn ? 0 : targetVolume;
    audio.playbackRate = command.rate ?? 1;
    audio.loop = Boolean(command.loop) && command.end == null && command.duration == null;
    if (command.start != null) {
      audio.currentTime = millisecondsToMediaSeconds(command.start);
    }
    if (handle && channel === "sound") {
      this.managedSounds.set(handle, audio);
    }
    this.bindTransientCleanup(audio, {
      handle: channel === "sound" ? handle : null,
      isVoice: channel === "voice"
    });
    audio.play().catch(() => {});
    if (command.fadeIn) {
      this.fade(audio, 0, targetVolume, command.fadeIn);
    }
    this.scheduleTransientStop(audio, command);
    return audio;
  }

  /**
   * Schedules authored crop and duration stops for transient audio.
   *
   * @private
   * @param {HTMLAudioElement} audio - Transient audio element.
   * @param {object} command - Audio command.
   * @returns {void}
   */
  scheduleTransientStop(audio, command) {
    const durationMs = resolveTransientDuration(command);
    if (durationMs == null) {
      return;
    }
    const start = millisecondsToMediaSeconds(command.start ?? 0);
    const fadeOut = command.fadeOut ?? 0;
    const timer = globalThis.setTimeout(() => {
      if (command.loop) {
        audio.currentTime = start;
        audio.play().catch(() => {});
        this.scheduleTransientStop(audio, command);
        return;
      }
      this.stopTransientAudio(audio, { fadeOut });
    }, Math.max(0, durationMs));
    this.transientTimers.set(audio, timer);
  }

  /**
   * Registers cleanup hooks for transient audio that ends on its own.
   *
   * @private
   * @param {HTMLAudioElement} audio - Transient audio element.
   * @param {object} options - Cleanup options.
   * @param {string|null} [options.handle] - Named sound handle.
   * @param {boolean} [options.isVoice] - Whether this is the active voice line.
   * @returns {void}
   */
  bindTransientCleanup(audio, { handle = null, isVoice = false } = {}) {
    this.transientMeta.set(audio, { handle, isVoice });
    audio.addEventListener?.("ended", () => this.cleanupTransientAudio(audio), { once: true });
  }

  /**
   * Stops a transient audio element and clears its crop/duration timer.
   *
   * @private
   * @param {HTMLAudioElement|null} audio - Audio element to stop.
   * @param {object} [options] - Stop options.
   * @param {number} [options.fadeOut] - Fade-out duration in ms.
   * @returns {void}
   */
  stopTransientAudio(audio, { fadeOut = 0 } = {}) {
    if (!audio) {
      return;
    }
    this.cleanupTransientAudio(audio);
    this.fadeOutAndStop(audio, { fadeOut });
  }

  /**
   * Removes transient bookkeeping for an audio element.
   *
   * @private
   * @param {HTMLAudioElement} audio - Audio element.
   * @returns {void}
   */
  cleanupTransientAudio(audio) {
    this.clearTransientTimer(audio);
    const meta = this.transientMeta.get(audio);
    if (!meta) {
      return;
    }
    if (meta.handle && this.managedSounds.get(meta.handle) === audio) {
      this.managedSounds.delete(meta.handle);
    }
    if (meta.isVoice && this.voice === audio) {
      this.voice = null;
    }
    this.transientMeta.delete(audio);
  }

  /**
   * Clears the scheduled crop/duration timer for a transient audio element.
   *
   * @private
   * @param {HTMLAudioElement} audio - Audio element.
   * @returns {void}
   */
  clearTransientTimer(audio) {
    const timer = this.transientTimers.get(audio);
    if (timer != null) {
      globalThis.clearTimeout(timer);
      this.transientTimers.delete(audio);
    }
  }

  /**
   * Fades a replaced audio element out and stops it.
   *
   * @private
   * @param {HTMLAudioElement|null} audio - Replaced audio element.
   * @param {object} options - Fade options.
   * @param {boolean} [options.instant] - Stop immediately.
   * @param {number} [options.fadeOut] - Fade duration.
   * @returns {void}
   */
  fadeOutAndStop(audio, { instant = false, fadeOut = 0 } = {}) {
    if (!audio) {
      return;
    }
    const finish = () => {
      audio.pause();
      audio.currentTime = 0;
    };
    if (instant || !fadeOut) {
      finish();
      return;
    }
    this.fade(audio, audio.volume, 0, fadeOut, finish);
  }

  /**
   * Resolves command volume through global settings.
   *
   * @private
   * @param {number} value - Command volume.
   * @param {"music"|"ambience"|"sound"|"voice"} [channel] - Mixer channel.
   * @returns {number} Effective volume.
   */
  resolveVolume(value = 1, channel = "sound") {
    const settings = this.getSettings() ?? {};
    const master = settings.masterVolume ?? 1;
    const channelVolume = settings[`${channel}Volume`] ?? 1;
    return Math.max(0, Math.min(1, value * master * channelVolume));
  }

  /**
   * Fades one audio element.
   *
   * @private
   * @param {HTMLAudioElement} audio - Audio element.
   * @param {number} from - Start volume.
   * @param {number} to - End volume.
   * @param {number} duration - Duration in ms.
   * @param {Function} [onDone] - Completion callback.
   * @returns {void}
   */
  fade(audio, from, to, duration, onDone = () => {}) {
    if (!duration) {
      audio.volume = clampVolume(to);
      onDone();
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      audio.volume = clampVolume(from + (to - from) * t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    requestAnimationFrame(tick);
  }
}

/**
 * Keeps browser media volume assignments inside the allowed HTMLMediaElement
 * range even when animation-frame timing produces tiny interpolation drift.
 *
 * @param {number} volume - Calculated volume.
 * @returns {number} Volume clamped to the browser-safe range.
 */
function clampVolume(volume) {
  return Math.min(1, Math.max(0, volume));
}

/**
 * Resolves how long a transient should play before it is stopped or looped.
 * `duration`, `start`, and `end` are authored in milliseconds. Browser media
 * elements use seconds internally, but the author-facing API stays consistent.
 *
 * @param {object} command - Sound or voice command.
 * @returns {number|null} Duration in milliseconds, or null for natural length.
 */
function resolveTransientDuration(command) {
  if (command.duration != null) {
    return command.duration;
  }
  if (command.end == null) {
    return null;
  }
  const start = command.start ?? 0;
  const rate = Math.max(0.01, command.rate ?? 1);
  return Math.max(0, (command.end - start) / rate);
}

/**
 * Converts author-facing millisecond timing to HTMLMediaElement seconds.
 *
 * @param {number} milliseconds - Authored time in milliseconds.
 * @returns {number} Media timeline time in seconds.
 */
function millisecondsToMediaSeconds(milliseconds) {
  return milliseconds / 1000;
}
