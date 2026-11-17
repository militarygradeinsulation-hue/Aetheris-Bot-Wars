import type { ArenaId, WeaponId } from '../shared/types';

const WORKSHOP_TRACK = {
  title: 'Garage Rock Intro',
  src: '/assets/aistudio/audioera-sport-rock-energetic-intro-628912_af2fc38d.mp3',
};

const BATTLE_TRACKS: Array<{ title: string; src: string }> = [
  {
    title: 'Angry Maiden Nu-Metal',
    src: '/assets/aistudio/nickpanek-angry-maiden-nu-metal-flute-instrumental-391312_a51d1e19.mp3',
  },
  {
    title: 'Sports Metal Surge',
    src: '/assets/aistudio/vibedepot-sports-metal-free-536615_d29bae06.mp3',
  },
  {
    title: 'Heavy Grunge Overdrive',
    src: '/assets/aistudio/nickpanek-coffee-first-heavy-grunge-metal-instrumental-391308_deb6f515.mp3',
  },
  {
    title: 'Modern Metal Clash',
    src: '/assets/aistudio/alec_koff-modern-metal-metal-rock-484512_790c8d89.mp3',
  },
  {
    title: 'Heavy Force Metal',
    src: '/assets/aistudio/strawberry_candy-powerful-heavy-metal-heavy-force-572627_b4bc76cd.mp3',
  },
  {
    title: 'Battle Clash',
    src: '/assets/aistudio/jonasblakewood-battle-battle-music-595522_05b98af0.mp3',
  },
  {
    title: 'Cryo Heavy Bass',
    src: '/assets/aistudio/alex-morgan-dubstep-heavy-bass-537443_68b6bfac.mp3',
  },
  {
    title: 'Void Construct Metal',
    src: '/assets/aistudio/alexgrohl-void-construct-epic-metal-366833_24a6c2fa.mp3',
  },
  {
    title: 'Symphonic Colosseum',
    src: '/assets/aistudio/nickpanek-epic-symphonic-metal-instrumental-263322_1ee5c52d.mp3',
  },
  {
    title: 'Iron Heavy Metal',
    src: '/assets/aistudio/mrclaps-this-heavy-metal-492569_fb8dacdf.mp3',
  },
  {
    title: 'Action Overdrive',
    src: '/assets/aistudio/atlasaudio-action-630755_7b3865b5.mp3',
  },
];

const CHEER_SAMPLES = [
  '/assets/aistudio/pretex-applause-cheer-345912_ccd21709.mp3',
  '/assets/aistudio/dennish18-crowd-cheering-143103_7dd61809.mp3',
];
const EXPLOSION_SAMPLE =
  '/assets/aistudio/explosion-blast-heavy-wood-crash-epic-stock-media-1-1-00-01_cea13ecd.mp3';
const CRASH_SAMPLE =
  '/assets/aistudio/car-crash-into-wall-heavy-smartsound-fx-1-00-06_a1ac8eae.mp3';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBusGain: GainNode | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  // User-adjustable Volume Mix (0.0 .. 1.0)
  private masterVolume = 0.85;
  private musicVolume = 0.65;
  private sfxVolume = 0.85;
  private crowdVolume = 0.7;
  private baseMusicGain = 0.28;
  private currentTrackTitle = 'Garage Rock Intro';

  // Background music playback (Workshop customization & Rotating Battle playlist)
  private musicEl: HTMLAudioElement | null = null;
  private musicMode: 'none' | 'workshop' | 'battle' = 'none';
  private workshopTrackIndex = -1;
  private battleDeck: number[] = [];
  private lastBattleSrc = '';
  private currentMusicSrc = '';
  private musicBlockedPendingUnlock = false;

  // Sampled SFX pool & rate-limiting timestamps
  private sfxLastPlayed: Record<string, number> = {};
  private activeSfxEls = new Set<HTMLAudioElement>();
  private cheerIndex = 0;

  // Continuous driving & weapon audio loops
  private loopsInitialized = false;
  private driveOscMain: OscillatorNode | null = null;
  private driveOscSub: OscillatorNode | null = null;
  private driveFilter: BiquadFilterNode | null = null;
  private driveGain: GainNode | null = null;

  private weaponOsc: OscillatorNode | null = null;
  private weaponGain: GainNode | null = null;
  private weaponNoiseSrc: AudioBufferSourceNode | null = null;
  private weaponNoiseFilter: BiquadFilterNode | null = null;
  private weaponNoiseGain: GainNode | null = null;

  private stopActiveSfx() {
    this.activeSfxEls.forEach((el) => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        // Ignore cleanup errors
      }
    });
    this.activeSfxEls.clear();
  }

  private playSample(
    src: string,
    volume = 0.45,
    playbackRate = 1.0,
    cooldownKey = src,
    minIntervalMs = 350,
    maxDurationMs = 1800,
  ) {
    if (this.muted || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const nowMs = performance.now();
    const prevMs = this.sfxLastPlayed[cooldownKey] ?? 0;
    if (minIntervalMs > 0 && nowMs - prevMs < minIntervalMs) return;
    this.sfxLastPlayed[cooldownKey] = nowMs;

    try {
      const isCrowd = cooldownKey.includes('cheer');
      const channelMult = this.masterVolume * (isCrowd ? this.crowdVolume : this.sfxVolume);
      if (channelMult <= 0.005) return;
      const audio = new Audio(src);
      const startVol = Math.max(0, Math.min(1, volume * channelMult * 1.25));
      audio.volume = startVol;
      audio.playbackRate = Math.max(0.5, Math.min(1.6, playbackRate));
      this.activeSfxEls.add(audio);

      const cleanup = () => {
        this.activeSfxEls.delete(audio);
      };
      audio.addEventListener('ended', cleanup, { once: true });

      audio.play().catch(() => {
        cleanup();
      });

      if (maxDurationMs > 0) {
        const fadeStartMs = Math.max(100, maxDurationMs - 650);
        window.setTimeout(() => {
          if (!this.activeSfxEls.has(audio)) return;
          const steps = 6;
          let step = 0;
          const fadeTimer = window.setInterval(() => {
            step++;
            if (!this.activeSfxEls.has(audio) || step >= steps) {
              clearInterval(fadeTimer);
              try {
                audio.pause();
              } catch {
                // Ignore
              }
              cleanup();
              return;
            }
            audio.volume = Math.max(0, startVol * (1 - step / steps));
          }, 100);
        }, fadeStartMs);
      }
    } catch {
      // Ignore sample playback errors if blocked by browser autoplay policy
    }
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.musicEl) {
      this.musicEl = new Audio();
      this.musicEl.preload = 'auto';
      this.musicEl.addEventListener('ended', () => {
        if (!this.muted) {
          if (this.musicMode === 'battle') {
            this.playNextBattleMusic();
          } else if (this.musicMode === 'workshop') {
            this.playWorkshopMusic(true);
          }
        }
      });
    }
    return this.musicEl;
  }

  private startTrack(src: string, loop: boolean, volume: number, title?: string) {
    const el = this.ensureMusicElement();
    if (!el) return;

    this.baseMusicGain = volume;
    if (title) this.currentTrackTitle = title;
    const srcChanged = this.currentMusicSrc !== src;
    this.currentMusicSrc = src;
    el.loop = loop;
    el.volume = Math.max(0, Math.min(1, volume * 1.45 * this.masterVolume * this.musicVolume));
    el.muted = this.muted;

    if (srcChanged) {
      el.src = src;
      el.currentTime = 0;
    }

    if (this.muted || this.masterVolume * this.musicVolume <= 0.005) {
      el.pause();
      return;
    }

    if (srcChanged || el.paused) {
      el.play()
        .then(() => {
          this.musicBlockedPendingUnlock = false;
        })
        .catch(() => {
          this.musicBlockedPendingUnlock = true;
        });
    }
  }

  public setVolumes(vols: {
    master?: number;
    music?: number;
    sfx?: number;
    crowd?: number;
  }) {
    if (typeof vols.master === 'number') this.masterVolume = Math.max(0, Math.min(1, vols.master));
    if (typeof vols.music === 'number') this.musicVolume = Math.max(0, Math.min(1, vols.music));
    if (typeof vols.sfx === 'number') this.sfxVolume = Math.max(0, Math.min(1, vols.sfx));
    if (typeof vols.crowd === 'number') this.crowdVolume = Math.max(0, Math.min(1, vols.crowd));

    if (this.musicEl) {
      const targetMusicVol = Math.max(0, Math.min(1, this.baseMusicGain * 1.45 * this.masterVolume * this.musicVolume));
      this.musicEl.volume = targetMusicVol;
      if (targetMusicVol <= 0.005) {
        this.musicEl.pause();
      } else if (!this.muted && this.musicMode !== 'none' && this.musicEl.paused && this.currentMusicSrc) {
        this.musicEl.play().catch(() => {});
      }
    }

    if (this.sfxBusGain && this.ctx) {
      this.sfxBusGain.gain.setTargetAtTime(
        Math.max(0.0001, this.masterVolume * this.sfxVolume * 1.2),
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public getVolumes() {
    return {
      master: this.masterVolume,
      music: this.musicVolume,
      sfx: this.sfxVolume,
      crowd: this.crowdVolume,
    };
  }

  public getCurrentTrackTitle(): string {
    return this.currentTrackTitle;
  }

  public skipMusicTrack() {
    if (this.musicMode === 'battle') {
      this.playNextBattleMusic();
    } else {
      this.playWorkshopMusic(true);
    }
  }

  public playWorkshopMusic(advance = false) {
    this.stopActiveSfx();
    const wasWorkshop = this.musicMode === 'workshop';
    this.musicMode = 'workshop';
    const menuPlaylist = [WORKSHOP_TRACK, ...BATTLE_TRACKS];
    if (advance || !wasWorkshop || this.workshopTrackIndex < 0) {
      this.workshopTrackIndex = (this.workshopTrackIndex + 1) % menuPlaylist.length;
    }
    const track = menuPlaylist[this.workshopTrackIndex % menuPlaylist.length] || WORKSHOP_TRACK;
    this.startTrack(track.src, false, 0.24, track.title);
  }

  private refillBattleDeck(avoidSrc: string) {
    const indices = BATTLE_TRACKS.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    // Ensure the very first track of the new deck is never the same as the last played track or current workshop track
    if (
      indices.length > 1 &&
      (BATTLE_TRACKS[indices[0]].src === avoidSrc || BATTLE_TRACKS[indices[0]].src === this.currentMusicSrc)
    ) {
      const swapIdx = indices.findIndex(
        (idx) =>
          BATTLE_TRACKS[idx].src !== avoidSrc && BATTLE_TRACKS[idx].src !== this.currentMusicSrc,
      );
      if (swapIdx > 0) {
        const first = indices[0];
        indices[0] = indices[swapIdx];
        indices[swapIdx] = first;
      }
    }
    this.battleDeck = indices;
  }

  public playNextBattleMusic(_arenaId?: ArenaId) {
    this.musicMode = 'battle';
    let savedLastSrc = this.lastBattleSrc;
    if (!savedLastSrc && typeof window !== 'undefined') {
      try {
        savedLastSrc = window.localStorage.getItem('aetheris_last_battle_track_v1') || '';
      } catch {
        // Ignore storage error
      }
    }

    if (this.battleDeck.length === 0) {
      this.refillBattleDeck(savedLastSrc);
    }

    let nextIdx = this.battleDeck.shift() ?? 0;
    if (
      BATTLE_TRACKS.length > 1 &&
      (BATTLE_TRACKS[nextIdx].src === savedLastSrc || BATTLE_TRACKS[nextIdx].src === this.currentMusicSrc)
    ) {
      if (this.battleDeck.length === 0) {
        this.refillBattleDeck(savedLastSrc);
      }
      const altPos = this.battleDeck.findIndex(
        (idx) =>
          BATTLE_TRACKS[idx].src !== savedLastSrc && BATTLE_TRACKS[idx].src !== this.currentMusicSrc,
      );
      if (altPos >= 0) {
        nextIdx = this.battleDeck.splice(altPos, 1)[0];
      }
    }

    const track = BATTLE_TRACKS[nextIdx] || BATTLE_TRACKS[0];
    this.lastBattleSrc = track.src;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('aetheris_last_battle_track_v1', track.src);
      } catch {
        // Ignore storage error
      }
    }
    this.startTrack(track.src, false, 0.28, track.title);
  }

  public playCustomTrack(
    src: string,
    title = 'Custom Track',
    target: 'workshop' | 'battle' | 'both' = 'both',
  ) {
    if (target === 'battle' || target === 'both') {
      if (!BATTLE_TRACKS.some((t) => t.src === src)) {
        BATTLE_TRACKS.unshift({ title, src });
        this.battleDeck = [];
      }
    }
    this.startTrack(src, true, 0.28, title);
  }

  public stopMusic() {
    this.musicMode = 'none';
    this.musicBlockedPendingUnlock = false;
    if (this.musicEl) {
      this.musicEl.pause();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopLoops();
      this.stopActiveSfx();
      if (this.musicEl) {
        this.musicEl.muted = true;
        this.musicEl.pause();
      }
    } else if (this.musicEl) {
      this.musicEl.muted = false;
      if (this.musicMode !== 'none' && this.currentMusicSrc) {
        this.musicEl.play().catch(() => {
          this.musicBlockedPendingUnlock = true;
        });
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume * this.sfxVolume <= 0.005 || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.sfxBusGain = this.ctx.createGain();
      this.sfxBusGain.gain.value = Math.max(0.0001, this.masterVolume * this.sfxVolume * 1.2);
      this.sfxBusGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getSfxDestination(ctx: AudioContext): AudioNode {
    return this.sfxBusGain || ctx.destination;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Slight pink-ish weighting for fuller industrial body
      lastOut = (lastOut + 0.06 * white) / 1.06;
      data[i] = white * 0.68 + lastOut * 1.4;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  private ensureLoops(ctx: AudioContext) {
    if (this.loopsInitialized) return;
    this.loopsInitialized = true;

    // 1. Brushless Motor + Planetary Gearbox Drive Loop
    this.driveOscMain = ctx.createOscillator();
    this.driveOscMain.type = 'sawtooth';
    this.driveOscMain.frequency.value = 54;

    this.driveOscSub = ctx.createOscillator();
    this.driveOscSub.type = 'triangle';
    this.driveOscSub.frequency.value = 108;

    this.driveFilter = ctx.createBiquadFilter();
    this.driveFilter.type = 'lowpass';
    this.driveFilter.frequency.value = 260;
    this.driveFilter.Q.value = 3.2;

    this.driveGain = ctx.createGain();
    this.driveGain.gain.value = 0.0001;

    this.driveOscMain.connect(this.driveFilter);
    this.driveOscSub.connect(this.driveFilter);
    this.driveFilter.connect(this.driveGain);
    this.driveGain.connect(this.getSfxDestination(ctx));
    this.driveOscMain.start();
    this.driveOscSub.start();

    // 2. Continuous Weapon Loop (Saw / Flywheel Whine / Flame Torch Roar)
    this.weaponOsc = ctx.createOscillator();
    this.weaponOsc.type = 'sawtooth';
    this.weaponOsc.frequency.value = 140;

    this.weaponGain = ctx.createGain();
    this.weaponGain.gain.value = 0.0001;
    this.weaponOsc.connect(this.weaponGain);
    this.weaponGain.connect(this.getSfxDestination(ctx));
    this.weaponOsc.start();

    this.weaponNoiseSrc = ctx.createBufferSource();
    this.weaponNoiseSrc.buffer = this.getNoiseBuffer(ctx);
    this.weaponNoiseSrc.loop = true;

    this.weaponNoiseFilter = ctx.createBiquadFilter();
    this.weaponNoiseFilter.type = 'bandpass';
    this.weaponNoiseFilter.frequency.value = 900;
    this.weaponNoiseFilter.Q.value = 1.6;

    this.weaponNoiseGain = ctx.createGain();
    this.weaponNoiseGain.gain.value = 0.0001;

    this.weaponNoiseSrc.connect(this.weaponNoiseFilter);
    this.weaponNoiseFilter.connect(this.weaponNoiseGain);
    this.weaponNoiseGain.connect(this.getSfxDestination(ctx));
    this.weaponNoiseSrc.start();
  }

  public unlock() {
    this.ensureContext();
    if (
      !this.muted &&
      this.musicMode !== 'none' &&
      this.musicEl &&
      (this.musicBlockedPendingUnlock || this.musicEl.paused) &&
      this.currentMusicSrc
    ) {
      this.musicEl
        .play()
        .then(() => {
          this.musicBlockedPendingUnlock = false;
        })
        .catch(() => {});
    }
  }

  public stopLoops() {
    if (!this.ctx || !this.loopsInitialized) return;
    const now = this.ctx.currentTime;
    this.driveGain?.gain.setTargetAtTime(0.0001, now, 0.06);
    this.weaponGain?.gain.setTargetAtTime(0.0001, now, 0.06);
    this.weaponNoiseGain?.gain.setTargetAtTime(0.0001, now, 0.06);
  }

  public updateCombatAudio(params: {
    active: boolean;
    speed: number;
    maxSpeed: number;
    weapon: WeaponId;
    weapons?: WeaponId[];
    weaponActive: boolean;
    weaponSpin: number;
    boosting: boolean;
    hazards?: unknown[];
    playerX?: number;
    playerZ?: number;
  }) {
    if (this.muted || !params.active) {
      this.stopLoops();
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.ensureLoops(ctx);
    const now = ctx.currentTime;

    const speedRatio = Math.min(1.3, params.speed / Math.max(1, params.maxSpeed));
    const boostAdd = params.boosting ? 0.35 : 0;

    // Modulate electric gearbox drive motor pitch & grit
    const baseHz = 46 + speedRatio * 74 + boostAdd * 45;
    this.driveOscMain?.frequency.setTargetAtTime(baseHz, now, 0.05);
    this.driveOscSub?.frequency.setTargetAtTime(baseHz * 2.02, now, 0.05);
    this.driveFilter?.frequency.setTargetAtTime(210 + speedRatio * 520 + boostAdd * 400, now, 0.06);
    this.driveGain?.gain.setTargetAtTime(0.014 + speedRatio * 0.032 + boostAdd * 0.016, now, 0.06);

    const activeWeapons = params.weapons && params.weapons.length > 0 ? params.weapons : [params.weapon];
    const hasFlame = activeWeapons.includes('flame') || activeWeapons.includes('cryo_jet');
    const hasSaw = activeWeapons.includes('sawblade');
    const hasRotor =
      activeWeapons.includes('vspinner') || activeWeapons.includes('hbar') || activeWeapons.includes('drum');

    // Modulate continuous weapon motor / torch roar
    if (hasFlame && params.weaponActive) {
      if (hasSaw || hasRotor) {
        const spinNorm = Math.min(1.2, params.weaponSpin / 24);
        this.weaponOsc?.frequency.setTargetAtTime(hasSaw ? 160 + spinNorm * 230 : 82 + spinNorm * 135, now, 0.05);
        this.weaponGain?.gain.setTargetAtTime(0.024, now, 0.06);
      } else {
        this.weaponGain?.gain.setTargetAtTime(0.0001, now, 0.05);
      }
      if (this.weaponNoiseFilter) {
        this.weaponNoiseFilter.type = 'lowpass';
        this.weaponNoiseFilter.frequency.setTargetAtTime(720 + Math.random() * 140, now, 0.04);
        this.weaponNoiseFilter.Q.setTargetAtTime(1.1, now, 0.05);
      }
      this.weaponNoiseGain?.gain.setTargetAtTime(0.065, now, 0.05);
    } else if (hasSaw) {
      const spinNorm = Math.min(1.2, params.weaponSpin / 24);
      this.weaponOsc?.frequency.setTargetAtTime(160 + spinNorm * 230, now, 0.05);
      this.weaponGain?.gain.setTargetAtTime(params.weaponActive ? 0.028 : 0.008, now, 0.06);
      if (this.weaponNoiseFilter) {
        this.weaponNoiseFilter.type = 'bandpass';
        this.weaponNoiseFilter.frequency.setTargetAtTime(1400 + spinNorm * 1600, now, 0.05);
        this.weaponNoiseFilter.Q.setTargetAtTime(3.2, now, 0.05);
      }
      this.weaponNoiseGain?.gain.setTargetAtTime(params.weaponActive ? 0.032 : 0.008, now, 0.06);
    } else if (hasRotor) {
      const spinNorm = Math.min(1.2, params.weaponSpin / 24);
      this.weaponOsc?.frequency.setTargetAtTime(82 + spinNorm * 135, now, 0.05);
      this.weaponGain?.gain.setTargetAtTime(params.weaponActive ? 0.024 : 0.007, now, 0.06);
      if (this.weaponNoiseFilter) {
        this.weaponNoiseFilter.type = 'bandpass';
        this.weaponNoiseFilter.frequency.setTargetAtTime(600 + spinNorm * 950, now, 0.05);
        this.weaponNoiseFilter.Q.setTargetAtTime(2.0, now, 0.05);
      }
      this.weaponNoiseGain?.gain.setTargetAtTime(params.weaponActive ? 0.018 : 0.004, now, 0.06);
    } else {
      this.weaponGain?.gain.setTargetAtTime(0.0001, now, 0.06);
      this.weaponNoiseGain?.gain.setTargetAtTime(0.0001, now, 0.06);
    }
  }

  /**
   * Generates a wave-shaped distortion curve so low-frequency body punches sound like
   * real explosive/ballistic pressure waves rather than clean oscillator beeps.
   */
  private makeDistortionCurve(amount = 28): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /**
   * Multi-layered pyrotechnic / ballistic blast (filtered noise crack + sub-bass pressure thump, no synth beeps).
   */
  private triggerBallisticBlast(
    ctx: AudioContext,
    opts: {
      crackFreq: number;
      crackDur: number;
      crackVol: number;
      bodyFreq: number;
      bodyDur: number;
      bodyVol: number;
      subStartHz?: number;
      subEndHz?: number;
      subDur?: number;
      subVol?: number;
    },
  ) {
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);

    // Layer 1: High-velocity muzzle / detonation crack (broadband noise transient)
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = noiseBuf;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(opts.crackFreq, now);
    crackFilter.frequency.exponentialRampToValueAtTime(Math.max(120, opts.crackFreq * 0.28), now + opts.crackDur);
    crackFilter.Q.value = 0.85;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(opts.crackVol, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + opts.crackDur);
    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.getSfxDestination(ctx));
    crackSrc.start(now);
    crackSrc.stop(now + opts.crackDur + 0.02);

    // Layer 2: Low-pass explosion / cannon rumble tail
    const bodySrc = ctx.createBufferSource();
    bodySrc.buffer = noiseBuf;
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(opts.bodyFreq, now);
    bodyFilter.frequency.exponentialRampToValueAtTime(75, now + opts.bodyDur);
    bodyFilter.Q.value = 1.1;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(32);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(opts.bodyVol, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + opts.bodyDur);
    bodySrc.connect(bodyFilter);
    bodyFilter.connect(shaper);
    shaper.connect(bodyGain);
    bodyGain.connect(this.getSfxDestination(ctx));
    bodySrc.start(now);
    bodySrc.stop(now + opts.bodyDur + 0.03);

    // Layer 3: Sub-bass chest thump (below 95Hz only — never audible as a pitched beep)
    if ((opts.subVol ?? 0) > 0) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      const startHz = Math.min(92, opts.subStartHz ?? 78);
      const endHz = Math.max(22, opts.subEndHz ?? 26);
      const dur = opts.subDur ?? 0.28;
      subOsc.frequency.setValueAtTime(startHz, now);
      subOsc.frequency.exponentialRampToValueAtTime(endHz, now + dur);
      subGain.gain.setValueAtTime(opts.subVol!, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      subOsc.connect(subGain);
      subGain.connect(this.getSfxDestination(ctx));
      subOsc.start(now);
      subOsc.stop(now + dur + 0.02);
    }
  }

  public playHammerStrike(intensity = 1.2) {
    this.playSample(
      CRASH_SAMPLE,
      Math.min(0.55, 0.24 + intensity * 0.12),
      0.88 + Math.random() * 0.18,
      'crash_hammer',
      220,
      1500,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = Math.min(0.45, 0.22 + intensity * 0.12);
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1350,
      crackDur: 0.18,
      crackVol: vol * 0.85,
      bodyFreq: 520,
      bodyDur: 0.38,
      bodyVol: vol * 0.9,
      subStartHz: 82,
      subEndHz: 26,
      subDur: 0.3,
      subVol: vol,
    });
  }

  public playSawGrind(intensity = 1.0) {
    this.playSample(
      CRASH_SAMPLE,
      Math.min(0.38, 0.16 + intensity * 0.08),
      1.18 + Math.random() * 0.15,
      'saw_crash',
      320,
      1100,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.32, 0.14 + intensity * 0.1);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + 0.22);
    filter.Q.value = 2.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.9, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.24);
  }

  public playSpinnerSlash(intensity = 1.1) {
    this.playSample(
      CRASH_SAMPLE,
      Math.min(0.48, 0.2 + intensity * 0.1),
      0.96 + Math.random() * 0.18,
      'spinner_crash',
      240,
      1250,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = Math.min(0.38, 0.16 + intensity * 0.12);
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1650,
      crackDur: 0.16,
      crackVol: vol * 0.85,
      bodyFreq: 620,
      bodyDur: 0.28,
      bodyVol: vol * 0.75,
      subStartHz: 76,
      subEndHz: 28,
      subDur: 0.22,
      subVol: vol * 0.85,
    });
  }

  public playFlameBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, now);
    filter.frequency.exponentialRampToValueAtTime(190, now + 0.32);
    filter.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.35);
  }

  public playCrowdCheer(intensity = 1.0, force = false) {
    if (this.musicMode !== 'battle') return;
    const sample = CHEER_SAMPLES[this.cheerIndex % CHEER_SAMPLES.length];
    this.cheerIndex = (this.cheerIndex + 1) % CHEER_SAMPLES.length;
    this.playSample(
      sample,
      Math.min(0.4, 0.15 + intensity * 0.1),
      0.98 + Math.random() * 0.06,
      'cheer_sfx',
      force ? 1200 : 7500,
      force ? 3400 : 2600,
    );
  }

  public playRailgunShot() {
    // Heavy cannon detonation + high-velocity ballistic crack
    this.playSample(
      EXPLOSION_SAMPLE,
      0.56,
      1.18 + Math.random() * 0.1,
      'railgun_shot',
      140,
      1450,
    );
    this.playSample(
      CRASH_SAMPLE,
      0.42,
      1.26,
      'railgun_crack',
      140,
      950,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 2600,
      crackDur: 0.22,
      crackVol: 0.48,
      bodyFreq: 880,
      bodyDur: 0.55,
      bodyVol: 0.45,
      subStartHz: 88,
      subEndHz: 24,
      subDur: 0.42,
      subVol: 0.52,
    });
  }

  public playImpact(intensity = 1, isCrit = false, weaponId?: WeaponId, _damageKind?: string) {
    if (weaponId === 'railgun') {
      this.playRailgunShot();
      return;
    }
    if (weaponId === 'mortar') {
      this.playExplosion();
      return;
    }
    if (weaponId === 'hammer' || weaponId === 'crush_jaw') {
      this.playHammerStrike(intensity);
      return;
    }
    if (weaponId === 'sawblade') {
      this.playSawGrind(intensity);
      return;
    }
    if (weaponId === 'vspinner' || weaponId === 'hbar' || weaponId === 'drum') {
      this.playSpinnerSlash(intensity);
      return;
    }
    if (weaponId === 'tesla') {
      this.playZap(intensity);
      return;
    }
    if (weaponId === 'flame' || weaponId === 'cryo_jet') {
      this.playFlameBurst();
      return;
    }

    this.playSample(
      isCrit ? EXPLOSION_SAMPLE : CRASH_SAMPLE,
      Math.min(0.48, 0.18 + intensity * 0.12),
      0.88 + Math.random() * 0.24,
      isCrit ? 'crit_crash_sfx' : 'crash_sfx',
      220,
      1350,
    );

    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = Math.min(0.4, 0.15 + intensity * 0.14);
    this.triggerBallisticBlast(ctx, {
      crackFreq: isCrit ? 1900 : 1200,
      crackDur: 0.16,
      crackVol: vol * 0.85,
      bodyFreq: isCrit ? 680 : 460,
      bodyDur: 0.3,
      bodyVol: vol * 0.8,
      subStartHz: 78,
      subEndHz: 26,
      subDur: 0.24,
      subVol: vol * 0.9,
    });
  }

  public playFlip() {
    this.playSample(CRASH_SAMPLE, 0.36, 1.08, 'flip_crash', 260, 1100);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1500,
      crackDur: 0.2,
      crackVol: 0.32,
      bodyFreq: 520,
      bodyDur: 0.32,
      bodyVol: 0.3,
      subStartHz: 74,
      subEndHz: 28,
      subDur: 0.25,
      subVol: 0.34,
    });
  }

  public playExplosion() {
    this.playSample(
      EXPLOSION_SAMPLE,
      0.64,
      0.92 + Math.random() * 0.16,
      `explosion_sfx_${Math.floor(Math.random() * 3)}`,
      120,
      1950,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1850,
      crackDur: 0.26,
      crackVol: 0.5,
      bodyFreq: 740,
      bodyDur: 0.82,
      bodyVol: 0.52,
      subStartHz: 85,
      subEndHz: 22,
      subDur: 0.65,
      subVol: 0.58,
    });
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.noiseBurst('bandpass', 1400, 620, 0, 0.16, 0.22);
  }

  public playCountdown(final = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: final ? 1600 : 900,
      crackDur: final ? 0.22 : 0.12,
      crackVol: final ? 0.3 : 0.18,
      bodyFreq: 420,
      bodyDur: final ? 0.3 : 0.16,
      bodyVol: 0.24,
      subStartHz: 72,
      subEndHz: 32,
      subDur: 0.18,
      subVol: 0.25,
    });
  }

  public playCrusherSlam() {
    this.playHammerStrike(1.55);
  }

  public playHazardWarning() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.noiseBurst('bandpass', 950, 380, 0, 0.18, 0.16);
  }

  public playKo() {
    this.playSample(
      EXPLOSION_SAMPLE,
      0.72,
      0.86,
      'ko_explosion_sfx',
      80,
      2300,
    );
    this.playSample(
      CRASH_SAMPLE,
      0.52,
      0.92,
      'ko_crash_sfx',
      80,
      1800,
    );
    this.playCrowdCheer(1.6, true);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 2100,
      crackDur: 0.32,
      crackVol: 0.56,
      bodyFreq: 820,
      bodyDur: 0.95,
      bodyVol: 0.58,
      subStartHz: 88,
      subEndHz: 20,
      subDur: 0.78,
      subVol: 0.64,
    });
  }

  private noiseBurst(type: BiquadFilterType, from: number, to: number, start: number, dur: number, vol: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.getSfxDestination(ctx));
    noise.start(t0);
    noise.stop(t0 + dur + 0.02);
  }

  public playZap(intensity = 1) {
    // High-voltage thunderous arc snap (noise crack + sub punch, no square-wave beep)
    this.playSample(CRASH_SAMPLE, Math.min(0.4, 0.22 * intensity), 1.32, 'zap_crack', 200, 900);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 3200,
      crackDur: 0.16,
      crackVol: 0.36 * intensity,
      bodyFreq: 920,
      bodyDur: 0.26,
      bodyVol: 0.28 * intensity,
      subStartHz: 75,
      subEndHz: 28,
      subDur: 0.2,
      subVol: 0.3 * intensity,
    });
  }

  public playThunder() {
    this.playSample(EXPLOSION_SAMPLE, 0.58, 0.85, 'thunder_sfx', 250, 2100);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 2800,
      crackDur: 0.22,
      crackVol: 0.45,
      bodyFreq: 680,
      bodyDur: 1.1,
      bodyVol: 0.5,
      subStartHz: 76,
      subEndHz: 22,
      subDur: 0.85,
      subVol: 0.52,
    });
  }

  public playMissileLaunch() {
    // Rocket salvo ignition blast + propellant whoosh (no sawtooth beep)
    this.playSample(
      EXPLOSION_SAMPLE,
      0.46,
      1.28 + Math.random() * 0.12,
      'missile_launch_sfx',
      150,
      1150,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1950,
      crackDur: 0.22,
      crackVol: 0.38,
      bodyFreq: 860,
      bodyDur: 0.44,
      bodyVol: 0.38,
      subStartHz: 82,
      subEndHz: 30,
      subDur: 0.28,
      subVol: 0.38,
    });
  }

  public playMagnetHum() {
    this.noiseBurst('lowpass', 360, 110, 0, 0.35, 0.26);
  }

  public playLanceThrust() {
    // Heavy pneumatic breach shot
    this.playSample(CRASH_SAMPLE, 0.44, 1.16, 'lance_shot_sfx', 180, 1050);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 2100,
      crackDur: 0.16,
      crackVol: 0.38,
      bodyFreq: 640,
      bodyDur: 0.28,
      bodyVol: 0.34,
      subStartHz: 80,
      subEndHz: 28,
      subDur: 0.22,
      subVol: 0.38,
    });
  }

  public playPitFall() {
    this.playSample(CRASH_SAMPLE, 0.5, 0.85, 'pit_crash_sfx', 250, 1600);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1200,
      crackDur: 0.25,
      crackVol: 0.38,
      bodyFreq: 480,
      bodyDur: 0.6,
      bodyVol: 0.42,
      subStartHz: 75,
      subEndHz: 22,
      subDur: 0.5,
      subVol: 0.45,
    });
  }

  public playMortarThump() {
    // Heavy artillery cannon firing blast
    this.playSample(
      EXPLOSION_SAMPLE,
      0.52,
      1.08 + Math.random() * 0.1,
      'mortar_fire_sfx',
      150,
      1350,
    );
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 1650,
      crackDur: 0.2,
      crackVol: 0.44,
      bodyFreq: 620,
      bodyDur: 0.48,
      bodyVol: 0.46,
      subStartHz: 86,
      subEndHz: 25,
      subDur: 0.38,
      subVol: 0.5,
    });
  }

  public playPartRip() {
    this.playSample(EXPLOSION_SAMPLE, 0.5, 1.12, 'part_rip_sfx', 180, 1500);
    this.playSample(CRASH_SAMPLE, 0.44, 0.98, 'part_crash_sfx', 180, 1300);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.triggerBallisticBlast(ctx, {
      crackFreq: 2200,
      crackDur: 0.22,
      crackVol: 0.42,
      bodyFreq: 680,
      bodyDur: 0.45,
      bodyVol: 0.4,
      subStartHz: 80,
      subEndHz: 26,
      subDur: 0.35,
      subVol: 0.44,
    });
  }

  public playFreeze() {
    this.noiseBurst('highpass', 5200, 1800, 0, 0.42, 0.24);
  }

  public playSizzle() {
    this.noiseBurst('highpass', 4500, 2000, 0, 0.55, 0.18);
  }

  public playAnnouncerSting(_kind: 'event' | 'wave' | 'hill' = 'event') {
    this.playSample(EXPLOSION_SAMPLE, 0.36, 1.05, 'sting_blast_sfx', 600, 1300);
  }
}

export const soundEngine = new SoundEngine();
