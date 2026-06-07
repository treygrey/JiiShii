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
   * Plays a one-shot voice line, replacing any current voice line.
   *
   * @param {object} command - Voice command.
   * @returns {void}
   */
  playVoice(command) {
    this.voice?.pause();
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
    this.voice?.pause();
    this.voice = null;
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
    const audio = new Audio(url);
    audio.volume = this.resolveVolume(command.volume ?? 1, channel);
    audio.playbackRate = command.rate ?? 1;
    audio.play().catch(() => {});
    return audio;
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
