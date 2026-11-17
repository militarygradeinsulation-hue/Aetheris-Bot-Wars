import type { ArenaId, WeaponId } from '../shared/types';

const WORKSHOP_TRACK = {
  title: 'Garage Rock Intro',
  src: '/assets/aistudio/audioera-sport-rock-energetic-intro-628912_af2fc38d.mp3',
};

const BATTLE_TRACKS: Array<{ title: string; src: string }> = [
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

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  // Background music playback (Workshop customization & Rotating Battle playlist)
  private musicEl: HTMLAudioElement | null = null;
  private musicMode: 'none' | 'workshop' | 'battle' = 'none';
  private battleTrackIndex = -1;
  private currentMusicSrc = '';
  private musicBlockedPendingUnlock = false;

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

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.musicEl) {
      this.musicEl = new Audio();
      this.musicEl.preload = 'auto';
      this.musicEl.addEventListener('ended', () => {
        if (this.musicMode === 'battle' && !this.muted) {
          this.playNextBattleMusic();
        }
      });
    }
    return this.musicEl;
  }

  private startTrack(src: string, loop: boolean, volume: number) {
    const el = this.ensureMusicElement();
    if (!el) return;

    const srcChanged = this.currentMusicSrc !== src;
    this.currentMusicSrc = src;
    el.loop = loop;
    el.volume = volume;
    el.muted = this.muted;

    if (srcChanged) {
      el.src = src;
      el.currentTime = 0;
    }

    if (this.muted) {
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

  public playWorkshopMusic() {
    this.musicMode = 'workshop';
    this.startTrack(WORKSHOP_TRACK.src, true, 0.24);
  }

  public playNextBattleMusic(arenaId?: ArenaId) {
    this.musicMode = 'battle';
    if (this.battleTrackIndex < 0 && arenaId) {
      const startMap: Record<ArenaId, number> = {
        foundry: 0,
        cryo: 1,
        reactor: 2,
        colosseum: 3,
        aether_nexus: 2,
        toxic_scrapyard: 4,
        volcano_caldera: 0,
        cyber_grid: 5,
        skyforge: 1,
        storm: 2,
      };
      this.battleTrackIndex = (startMap[arenaId] ?? 0) % BATTLE_TRACKS.length;
    } else {
      this.battleTrackIndex = (this.battleTrackIndex + 1) % BATTLE_TRACKS.length;
    }
    const track = BATTLE_TRACKS[this.battleTrackIndex];
    this.startTrack(track.src, false, 0.28);
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
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
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
    this.driveGain.connect(ctx.destination);
    this.driveOscMain.start();
    this.driveOscSub.start();

    // 2. Continuous Weapon Loop (Saw / Flywheel Whine / Flame Torch Roar)
    this.weaponOsc = ctx.createOscillator();
    this.weaponOsc.type = 'sawtooth';
    this.weaponOsc.frequency.value = 140;

    this.weaponGain = ctx.createGain();
    this.weaponGain.gain.value = 0.0001;
    this.weaponOsc.connect(this.weaponGain);
    this.weaponGain.connect(ctx.destination);
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
    this.weaponNoiseGain.connect(ctx.destination);
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

  public playHammerStrike(intensity = 1.2) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.38, 0.18 + intensity * 0.12);

    // 1. Sub-bass kinetic slam
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.24);
    subGain.gain.setValueAtTime(vol, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.27);

    // 2. Heavy steel anvil partials
    [215, 485, 920].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq * (0.96 + Math.random() * 0.08), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.28);
      g.gain.setValueAtTime(vol * (0.35 / (idx + 1)), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    });

    // 3. Pneumatic burst + crunch noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.18);
  }

  public playSawGrind(intensity = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.28, 0.12 + intensity * 0.1);

    // Screeching metal-on-metal circular saw bite
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520 + Math.random() * 140, now);
    osc.frequency.linearRampToValueAtTime(860, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.2);
    g.gain.setValueAtTime(vol * 0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, now);
    filter.Q.value = 4.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.75, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  public playSpinnerSlash(intensity = 1.1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.34, 0.14 + intensity * 0.12);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.2);
    g.gain.setValueAtTime(vol * 0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.6, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.16);
  }

  public playFlameBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.24);
    filter.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  public playCrowdCheer(intensity = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.linearRampToValueAtTime(1050, now + 0.35);
    filter.frequency.linearRampToValueAtTime(680, now + 1.15);
    filter.Q.value = 1.3;

    const gain = ctx.createGain();
    const peak = Math.min(0.14, 0.05 + intensity * 0.05);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.25);
  }

  public playImpact(intensity = 1, isCrit = false, weaponId?: WeaponId) {
    if (weaponId === 'hammer' || weaponId === 'crush_jaw') {
      this.playHammerStrike(intensity);
      return;
    }
    if (weaponId === 'sawblade') {
      this.playSawGrind(intensity);
      return;
    }
    if (weaponId === 'vspinner' || weaponId === 'hbar' || weaponId === 'drum' || weaponId === 'tesla') {
      this.playSpinnerSlash(intensity);
      return;
    }
    if (weaponId === 'flame' || weaponId === 'cryo_jet') {
      this.playFlameBurst();
      return;
    }
    if (weaponId === 'railgun' || weaponId === 'mortar') {
      this.playExplosion();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.32, 0.11 + intensity * 0.12);

    // Metallic hull slam
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'triangle';
    const baseFreq = isCrit ? 260 : 145 + Math.random() * 55;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // Steel crunch transient
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isCrit ? 1900 : 1100, now);
    filter.Q.value = 1.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  public playFlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Pneumatic CO2 blast + upward hydraulic whistle
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1600, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.22, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.19);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.19);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.5);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.54);

    // Rumbling blast noise tail
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.65);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.32, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.7);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.07);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playCountdown(final = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(final ? 880 : 440, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (final ? 0.28 : 0.14));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (final ? 0.3 : 0.15));
  }

  public playCrusherSlam() {
    this.playHammerStrike(1.45);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Hydraulic air release hiss + heavy floor thud
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.36);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.24, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.4);
  }

  public playHazardWarning() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.12].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 640 : 820, now + offset);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  public playKo() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playExplosion();
    this.playCrowdCheer(1.6);

    [440, 554, 659].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.16, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, dur: number, vol: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
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
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + dur + 0.02);
  }

  public playZap(intensity = 1) {
    this.tone('square', 1800, 220, 0, 0.12, 0.07 * intensity);
    this.tone('sawtooth', 960, 120, 0.03, 0.16, 0.06 * intensity);
    this.noiseBurst('highpass', 4200, 1800, 0, 0.14, 0.12 * intensity);
  }

  public playThunder() {
    this.noiseBurst('highpass', 6000, 2400, 0, 0.08, 0.3);
    this.noiseBurst('lowpass', 900, 60, 0.05, 1.4, 0.42);
    this.tone('sine', 70, 30, 0.05, 1.0, 0.28);
  }

  public playMissileLaunch() {
    this.noiseBurst('bandpass', 600, 2400, 0, 0.45, 0.22);
    this.tone('sawtooth', 180, 620, 0, 0.35, 0.06);
  }

  public playMagnetHum() {
    this.tone('sine', 90, 60, 0, 0.45, 0.16);
    this.tone('triangle', 180, 120, 0, 0.4, 0.06);
  }

  public playLanceThrust() {
    this.noiseBurst('bandpass', 2400, 600, 0, 0.12, 0.2);
    this.tone('square', 300, 90, 0, 0.14, 0.12);
  }

  public playPitFall() {
    this.tone('sine', 520, 60, 0, 0.9, 0.16);
    this.noiseBurst('lowpass', 1200, 120, 0.6, 0.5, 0.25);
  }

  public playAnnouncerSting(kind: 'event' | 'wave' | 'hill' = 'event') {
    const notes = kind === 'wave' ? [330, 392, 494, 659] : kind === 'hill' ? [523, 659] : [392, 523, 784];
    notes.forEach((f, i) => this.tone('triangle', f, f * 0.98, i * 0.09, 0.26, 0.11));
  }
}

export const soundEngine = new SoundEngine();
