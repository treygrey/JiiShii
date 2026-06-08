import { beforeEach, describe, expect, it, vi } from "vitest";

const audioElements = [];

const resolveAudio = (id) => (id.startsWith("missing") ? null : `/audio/${id}.ogg`);

class FakeAudio {
  constructor(url) {
    this.url = url;
    this.loop = false;
    this.volume = 1;
    this.playbackRate = 1;
    this.currentTime = 0;
    this.play = vi.fn(() => Promise.resolve());
    this.pause = vi.fn();
    audioElements.push(this);
  }
}

const { BrowserAudioService } = await import("./audio-service.js");

describe("BrowserAudioService", () => {
  beforeEach(() => {
    audioElements.length = 0;
    vi.stubGlobal("Audio", FakeAudio);
    let now = 1000;
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      now += 1000;
      callback(now);
    });
    vi.stubGlobal("performance", { now: () => now });
  });

  it("applies master and channel volume to music", () => {
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 0.5,
        musicVolume: 0.4
      })
    });

    service.playMusic({ id: "theme", volume: 0.8 }, { instant: true });

    expect(audioElements[0].url).toBe("/audio/theme.ogg");
    expect(audioElements[0].volume).toBeCloseTo(0.16);
  });

  it("updates current music volume when synced after settings change", () => {
    let musicVolume = 1;
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 1,
        musicVolume
      })
    });

    service.playMusic({ id: "theme", volume: 0.75 }, { instant: true });
    musicVolume = 0.2;
    service.sync({ music: { id: "theme", volume: 0.75, loop: true } }, { instant: true });

    expect(audioElements[0].volume).toBeCloseTo(0.15);
  });

  it("syncs the same music track without replacing or rewinding it", () => {
    const service = new BrowserAudioService({ resolveAudio });

    service.playMusic({ id: "theme", volume: 0.75 }, { instant: true });
    audioElements[0].currentTime = 22;
    audioElements[0].play.mockClear();
    audioElements[0].pause.mockClear();

    service.sync({ music: { id: "theme", volume: 0.5, loop: true } }, { instant: true });

    expect(audioElements).toHaveLength(1);
    expect(audioElements[0].currentTime).toBe(22);
    expect(audioElements[0].play).not.toHaveBeenCalled();
    expect(audioElements[0].pause).not.toHaveBeenCalled();
    expect(audioElements[0].volume).toBe(0.5);
  });

  it("keeps using the music channel when replaying the current track", () => {
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 0.5,
        musicVolume: 0.2
      })
    });

    service.playMusic({ id: "theme", volume: 1 }, { instant: true });
    service.playMusic({ id: "theme", volume: 0.5 }, { instant: true });

    expect(audioElements).toHaveLength(1);
    expect(audioElements[0].volume).toBeCloseTo(0.05);
  });

  it("crossfades replaced music tracks", () => {
    const service = new BrowserAudioService({ resolveAudio });

    service.playMusic({ id: "theme", volume: 1 }, { instant: true });
    service.playMusic({ id: "second_theme", volume: 0.5, fadeIn: 500, fadeOut: 700 });

    expect(audioElements).toHaveLength(2);
    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    expect(audioElements[0].currentTime).toBe(0);
    expect(audioElements[1].url).toBe("/audio/second_theme.ogg");
    expect(audioElements[1].volume).toBeCloseTo(0.5);
  });

  it("uses separate sound and voice volume channels", () => {
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 0.5,
        soundVolume: 0.8,
        voiceVolume: 0.3
      })
    });

    service.playSound({ id: "door", volume: 0.5 });
    service.playVoice({ id: "voice_line", volume: 1 });

    expect(audioElements[0].volume).toBeCloseTo(0.2);
    expect(audioElements[1].volume).toBeCloseTo(0.15);
  });

  it("applies transient crop, fade, loop, and playback rate options", () => {
    const service = new BrowserAudioService({ resolveAudio });

    service.playSound({
      id: "blanket",
      volume: 0.5,
      start: 250,
      fadeIn: 120,
      loop: true,
      rate: 1.5
    });

    expect(audioElements[0].currentTime).toBe(0.25);
    expect(audioElements[0].playbackRate).toBe(1.5);
    expect(audioElements[0].loop).toBe(true);
    expect(audioElements[0].volume).toBeCloseTo(0.5);
  });

  it("treats transient crop start and end as authored milliseconds", () => {
    vi.useFakeTimers();
    const service = new BrowserAudioService({ resolveAudio });

    service.playSound({ id: "blanket", start: 250, end: 1000, rate: 1.5 });

    expect(audioElements[0].currentTime).toBe(0.25);
    vi.advanceTimersByTime(499);
    expect(audioElements[0].pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("stops transients after an authored duration", () => {
    vi.useFakeTimers();
    const service = new BrowserAudioService({ resolveAudio });

    service.playSound({ id: "door", duration: 500 });

    expect(audioElements[0].pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(audioElements[0].pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    expect(audioElements[0].currentTime).toBe(0);
    vi.useRealTimers();
  });

  it("can stop and replace named transient sounds", () => {
    const service = new BrowserAudioService({ resolveAudio });

    service.playSound({ id: "buzz", as: "phone", loop: true });
    service.playSound({ id: "buzz_louder", as: "phone", loop: true, fadeOut: 200 });

    expect(audioElements).toHaveLength(2);
    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    expect(audioElements[1].url).toBe("/audio/buzz_louder.ogg");

    service.stopSound("phone", { fadeOut: 100 });

    expect(audioElements[1].pause).toHaveBeenCalledOnce();
  });

  it("plays ambience as a durable loop on the ambience channel", () => {
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 0.5,
        ambienceVolume: 0.6
      })
    });

    service.playAmbience({ id: "rain_room", volume: 0.4 }, { instant: true });

    expect(audioElements[0].loop).toBe(true);
    expect(audioElements[0].volume).toBeCloseTo(0.12);
  });

  it("fades replaced ambience tracks", () => {
    const service = new BrowserAudioService({ resolveAudio });

    service.playAmbience({ id: "rain_room", volume: 1 }, { instant: true });
    service.playAmbience({ id: "club_room", volume: 0.4, fadeIn: 300, fadeOut: 300 });

    expect(audioElements).toHaveLength(2);
    expect(audioElements[0].pause).toHaveBeenCalledOnce();
    expect(audioElements[1].url).toBe("/audio/club_room.ogg");
    expect(audioElements[1].volume).toBeCloseTo(0.4);
  });

  it("syncs and stops ambience separately from music", () => {
    const service = new BrowserAudioService({
      resolveAudio,
      getSettings: () => ({
        masterVolume: 1,
        musicVolume: 1,
        ambienceVolume: 0.25
      })
    });

    service.sync({
      music: { id: "theme", volume: 0.8, loop: true },
      ambience: { id: "rain_room", volume: 0.8, loop: true }
    }, { instant: true });

    expect(audioElements).toHaveLength(2);
    expect(audioElements[0].url).toBe("/audio/theme.ogg");
    expect(audioElements[1].url).toBe("/audio/rain_room.ogg");
    expect(audioElements[1].volume).toBeCloseTo(0.2);

    service.sync({
      music: { id: "theme", volume: 0.8, loop: true },
      ambience: null
    }, { instant: true });

    expect(audioElements[0].pause).not.toHaveBeenCalled();
    expect(audioElements[1].pause).toHaveBeenCalledOnce();
  });

  it("logs and skips missing audio assets", () => {
    const onLog = vi.fn();
    const service = new BrowserAudioService({ onLog, resolveAudio });

    service.playSound({ id: "missing_door" });

    expect(audioElements).toEqual([]);
    expect(onLog).toHaveBeenCalledWith("Missing audio asset: missing_door");
  });
});
