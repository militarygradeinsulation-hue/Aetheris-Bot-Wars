import type { ArenaId, ArenaSnapshot, BotConfig, BotPhysicsState, CombatEvent } from '../shared/types';
import {
  ARENA_CATALOG,
  ARMOR_CATALOG,
  CHASSIS_CATALOG,
  getBotWeapons,
  WEAPON_CATALOG,
} from '../shared/types';

export interface CommentaryLine {
  id: number;
  speaker: 'REX VANCE (HOST)' | 'KIRA VOLT (ANALYST)';
  text: string;
  coSpeaker?: 'KIRA VOLT (ANALYST)' | 'REX VANCE (HOST)';
  coText?: string;
  accent: 'amber' | 'sky' | 'rose' | 'emerald';
  timestamp: number;
}

type CommentaryListener = (line: CommentaryLine) => void;

function describeWeapons(config: BotConfig): string {
  const weapons = getBotWeapons(config);
  if (weapons.length === 0) return 'ramming hull';
  return weapons
    .slice(0, 2)
    .map((w) => WEAPON_CATALOG[w]?.label || w)
    .join(' and ');
}

function describeChassisAndArmor(config: BotConfig): string {
  const ch = CHASSIS_CATALOG[config.chassis]?.label || config.chassis;
  const ar = ARMOR_CATALOG[config.armor]?.label || config.armor;
  return `${ar} ${ch}`;
}

type CommentaryUrgency = 1 | 2 | 3;

interface PendingCallout {
  rexText: string;
  kiraText: string;
  accent: CommentaryLine['accent'];
  urgency: CommentaryUrgency;
  isMatchEnd: boolean;
  createdAt: number;
}

interface PhraseCandidate {
  sig: string;
  rex: string;
  kira: string;
  accent: CommentaryLine['accent'];
}

class VoiceCommentatorEngine {
  private masterMuted = false;
  private commentaryMuted = true;
  private volume = 0.9;
  private nextId = 1;
  private lastSpokenAt = 0;
  private lastEventSpokenAt = 0;
  private lastMidFightBanterAt = 0;
  private listeners = new Set<CommentaryListener>();
  private audioCache = new Map<string, string>();
  private currentAudioEl: HTMLAudioElement | null = null;
  private inFlightTts = false;
  private matchEnded = false;
  private queuedCallout: PendingCallout | null = null;
  private drainTimerId: number | null = null;

  // Anti-repetition memory across the session
  private recentSignatures: string[] = [];
  private lastCategoryAt = new Map<string, number>();

  // Live Match Context for fight-specific commentary
  private activeArenaId: ArenaId = 'foundry';
  private playerBot: BotPhysicsState | null = null;
  private rivalBot: BotPhysicsState | null = null;
  private allBots: BotPhysicsState[] = [];

  private stopCurrentPlayback() {
    if (this.drainTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.drainTimerId);
      this.drainTimerId = null;
    }
    this.queuedCallout = null;
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.currentTime = 0;
      } catch {
        // Ignore
      }
      this.currentAudioEl = null;
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentAudioEl) {
      this.currentAudioEl.volume = Math.min(1, 0.96 * this.volume);
    }
    if (this.volume <= 0.001) {
      this.stopCurrentPlayback();
    }
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean) {
    this.masterMuted = muted;
    if (this.isSilenced()) {
      this.stopCurrentPlayback();
    }
  }

  setCommentaryMuted(muted: boolean) {
    this.commentaryMuted = muted;
    if (this.isSilenced()) {
      this.stopCurrentPlayback();
    }
  }

  isCommentaryMuted(): boolean {
    return this.commentaryMuted;
  }

  private isSilenced(): boolean {
    return this.masterMuted || this.commentaryMuted || this.volume <= 0.005;
  }

  subscribe(listener: CommentaryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private isBusy(): boolean {
    return this.inFlightTts || Boolean(this.currentAudioEl && !this.currentAudioEl.paused);
  }

  private pickNonRepeating(pool: PhraseCandidate[]): PhraseCandidate {
    const fresh = pool.filter((item) => !this.recentSignatures.includes(item.sig));
    const candidates = fresh.length > 0 ? fresh : pool;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    this.recentSignatures.push(picked.sig);
    if (this.recentSignatures.length > 18) {
      this.recentSignatures.shift();
    }
    return picked;
  }

  private canTriggerCategory(category: string, cooldownMs: number): boolean {
    const now = performance.now();
    const prev = this.lastCategoryAt.get(category) ?? 0;
    if (now - prev < cooldownMs) return false;
    this.lastCategoryAt.set(category, now);
    return true;
  }

  private scheduleDrainQueue(delayMs = 240) {
    if (typeof window === 'undefined') return;
    if (this.drainTimerId !== null) {
      window.clearTimeout(this.drainTimerId);
    }
    this.drainTimerId = window.setTimeout(() => {
      this.drainTimerId = null;
      this.drainQueuedCallout();
    }, delayMs);
  }

  private drainQueuedCallout() {
    if (this.isSilenced() || this.isBusy() || !this.queuedCallout) return;
    const next = this.queuedCallout;
    this.queuedCallout = null;

    // Discard queued mid-fight callouts if they waited too long (> 4.2s), but always play match-end
    const age = performance.now() - next.createdAt;
    if (!next.isMatchEnd && (this.matchEnded || age > 4200)) {
      return;
    }

    this.dispatchNow(next.rexText, next.kiraText, next.accent, next.isMatchEnd);
  }

  private playDataUri(dataUri: string) {
    if (this.isSilenced() || typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.scheduleDrainQueue(200);
      return;
    }

    try {
      const audio = new Audio(dataUri);
      audio.volume = Math.min(1, 0.96 * this.volume);
      audio.playbackRate = 1.04;
      if ('preservesPitch' in audio) {
        (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      }
      this.currentAudioEl = audio;

      const onFinished = () => {
        if (this.currentAudioEl === audio) {
          this.currentAudioEl = null;
        }
        this.scheduleDrainQueue(240);
      };

      audio.addEventListener('ended', onFinished, { once: true });
      audio.addEventListener('error', onFinished, { once: true });
      audio.play().catch(() => {
        onFinished();
      });
    } catch {
      this.currentAudioEl = null;
      this.scheduleDrainQueue(240);
    }
  }

  private async synthesizeAndPlay(rexText: string, kiraText: string) {
    if (this.isSilenced() || typeof window === 'undefined') return;

    const cacheKey = `duo:${rexText}||${kiraText}`;
    const cachedUri = this.audioCache.get(cacheKey);
    if (cachedUri) {
      this.playDataUri(cachedUri);
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    this.inFlightTts = true;
    try {
      const res = await fetch('/api/tts/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rexText, kiraText }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (data?.audioBase64) {
        const mime = data.mimeType || 'audio/wav';
        const dataUri = `data:${mime};base64,${data.audioBase64}`;
        if (this.audioCache.size >= 120) {
          const firstKey = this.audioCache.keys().next().value;
          if (firstKey) this.audioCache.delete(firstKey);
        }
        this.audioCache.set(cacheKey, dataUri);
        if (!this.isSilenced()) {
          this.playDataUri(dataUri);
        }
      }
    } catch {
      // Never fall back to robotic OS speechSynthesis
    } finally {
      this.inFlightTts = false;
      if (!this.currentAudioEl) {
        this.scheduleDrainQueue(200);
      }
    }
  }

  private dispatchNow(
    rexText: string,
    kiraText: string,
    accent: CommentaryLine['accent'],
    isMatchEnd: boolean,
  ) {
    const cleanRex = rexText.trim();
    const cleanKira = kiraText.trim();
    if (!cleanRex && !cleanKira) return;

    const now = performance.now();
    this.lastSpokenAt = now;
    if (isMatchEnd) {
      this.matchEnded = true;
    }

    const line: CommentaryLine = cleanRex
      ? {
          id: this.nextId++,
          speaker: 'REX VANCE (HOST)',
          text: cleanRex,
          ...(cleanKira
            ? {
                coSpeaker: 'KIRA VOLT (ANALYST)',
                coText: cleanKira,
              }
            : {}),
          accent,
          timestamp: Date.now(),
        }
      : {
          id: this.nextId++,
          speaker: 'KIRA VOLT (ANALYST)',
          text: cleanKira,
          accent,
          timestamp: Date.now(),
        };

    this.listeners.forEach((cb) => cb(line));
    void this.synthesizeAndPlay(cleanRex, cleanKira);
  }

  private emitCallout(
    rexText: string,
    kiraText: string,
    accent: CommentaryLine['accent'] = 'amber',
    urgency: CommentaryUrgency = 2,
    isMatchEnd = false,
  ) {
    if (this.commentaryMuted) return;
    if (this.matchEnded && !isMatchEnd) return;

    const cleanRex = rexText.trim();
    const cleanKira = kiraText.trim();
    if (!cleanRex && !cleanKira) return;

    const now = performance.now();
    if (urgency >= 2) {
      this.lastEventSpokenAt = now;
    }

    // Never cut off a sentence mid-speech! If currently speaking or fetching TTS,
    // place high-priority events in the 1-slot on-deck queue so they play right after the current sentence finishes.
    if (this.isBusy()) {
      if (urgency === 1 && !isMatchEnd) {
        return;
      }
      if (
        !this.queuedCallout ||
        isMatchEnd ||
        urgency >= this.queuedCallout.urgency
      ) {
        this.queuedCallout = {
          rexText: cleanRex,
          kiraText: cleanKira,
          accent,
          urgency,
          isMatchEnd,
          createdAt: now,
        };
      }
      return;
    }

    this.dispatchNow(cleanRex, cleanKira, accent, isMatchEnd);
  }

  private resolveBotName(botId?: string, fallback = 'the warbot'): string {
    if (!botId) return fallback;
    const found = this.allBots.find((b) => b.id === botId);
    return found?.config?.name || found?.name || fallback;
  }

  syncLiveFightContext(snap: ArenaSnapshot, playerId: string) {
    this.activeArenaId = snap.arenaId;
    this.allBots = snap.bots;
    const pBot = snap.bots.find((b) => b.id === playerId) || snap.bots[0] || null;
    this.playerBot = pBot;
    const pTeam = pBot?.team ?? 0;
    const livingRivals = snap.bots.filter((b) => b.id !== pBot?.id && b.team !== pTeam && !b.isDead);
    this.rivalBot =
      livingRivals[0] || snap.bots.find((b) => b.id !== pBot?.id && b.team !== pTeam) || null;

    if (snap.phase !== 'active' || !pBot || !this.rivalBot || pBot.isDead || this.matchEnded) return;
    if (this.isBusy() || this.queuedCallout) return;

    const now = performance.now();
    if (
      now - this.lastSpokenAt < 8500 ||
      now - this.lastEventSpokenAt < 6500 ||
      now - this.lastMidFightBanterAt < 11000
    ) {
      return;
    }

    this.lastMidFightBanterAt = now;

    const arenaSpec = ARENA_CATALOG[snap.arenaId];
    const pName = pBot.config.name;
    const rName = this.rivalBot.config.name;
    const pHpPct = Math.round((pBot.hp / Math.max(1, pBot.maxHp)) * 100);
    const rHpPct = Math.round((this.rivalBot.hp / Math.max(1, this.rivalBot.maxHp)) * 100);
    const pWeapon = describeWeapons(pBot.config);
    const rWeapon = describeWeapons(this.rivalBot.config);
    const lowZone =
      this.rivalBot.armorZones.front < this.rivalBot.armorZones.rear ? 'front' : 'rear';

    const pool: PhraseCandidate[] = [
      {
        sig: 'ctx_center_control',
        rex: `${pName} and ${rName} are battling hard for center control in ${arenaSpec.name}!`,
        kira: '',
        accent: 'sky',
      },
      {
        sig: 'ctx_seam_pressure',
        rex: '',
        kira: `${rName}'s ${lowZone} plating is wearing thin—one clean ${pWeapon} strike from ${pName} could breach the frame.`,
        accent: 'amber',
      },
      {
        sig: 'ctx_drift_angles',
        rex: `Look at the drift angles from ${pName}, cutting inside ${rName}'s turning radius!`,
        kira: '',
        accent: 'sky',
      },
      {
        sig: 'ctx_telemetry_compare',
        rex: '',
        kira: `${pName} sits at ${pHpPct}% hull integrity against ${rName} at ${rHpPct}% as they circle the hazards.`,
        accent: 'emerald',
      },
      {
        sig: 'ctx_weapon_timing',
        rex: `Neither pilot is backing off the throttle inside ${arenaSpec.name}!`,
        kira: `${rName} is looking for an opening with that ${rWeapon}, so ${pName} has to stay mobile.`,
        accent: 'sky',
      },
      {
        sig: 'ctx_aggression_pace',
        rex: `Relentless pace from ${pName}, forcing ${rName} toward the perimeter traps!`,
        kira: '',
        accent: 'amber',
      },
      {
        sig: 'ctx_power_cycling',
        rex: '',
        kira: `Smart energy discipline from ${pName}, keeping the ${pWeapon} spun up and ready to punish any mistake.`,
        accent: 'emerald',
      },
    ];

    if (pHpPct < 32 && rHpPct < 32) {
      pool.unshift({
        sig: 'ctx_both_critical',
        rex: `Both machines are sparking badly under thirty percent hull!`,
        kira: `One more clean weapon bite from either driver is going to end this fight!`,
        accent: 'rose',
      });
    } else if (rHpPct < 35) {
      pool.unshift({
        sig: 'ctx_rival_low',
        rex: `${rName} is smoking at ${rHpPct}% integrity, and ${pName} is closing in for the finish!`,
        kira: '',
        accent: 'emerald',
      });
    } else if (pHpPct < 35) {
      pool.unshift({
        sig: 'ctx_player_low',
        rex: '',
        kira: `Careful now—${pName} is down to ${pHpPct}% hull and needs to protect that exposed seam!`,
        accent: 'rose',
      });
    }

    const picked = this.pickNonRepeating(pool);
    this.emitCallout(picked.rex, picked.kira, picked.accent, 1, false);
  }

  announceMatchStart(
    arenaId: ArenaId,
    playerBotName: string,
    rivalBotName?: string,
    playerConfig?: BotConfig,
    rivalConfig?: BotConfig,
  ) {
    this.stopCurrentPlayback();
    this.activeArenaId = arenaId;
    this.matchEnded = false;
    this.lastCategoryAt.clear();
    const now = performance.now();
    this.lastMidFightBanterAt = now;
    this.lastEventSpokenAt = now;

    const arenaSpec = ARENA_CATALOG[arenaId];
    const arenaName = arenaSpec?.name || 'the BattleBox';
    const pBotCfg = playerConfig || this.playerBot?.config;
    const rBotCfg = rivalConfig || this.rivalBot?.config;
    const rName = rivalBotName || rBotCfg?.name || 'the challenger';
    const pWeaponLabel = pBotCfg ? describeWeapons(pBotCfg) : 'custom weapons';
    const rWeaponLabel = rBotCfg ? describeWeapons(rBotCfg) : 'heavy combat weaponry';
    const pHullDesc = pBotCfg ? describeChassisAndArmor(pBotCfg) : 'reinforced hull';

    const intros: PhraseCandidate[] = [
      {
        sig: 'intro_weapons_hot',
        rex: `Weapons are hot inside ${arenaName} as ${playerBotName} charges out to meet ${rName}!`,
        kira: `Watch that ${pWeaponLabel} spin up to full speed right out of the corner!`,
        accent: 'amber',
      },
      {
        sig: 'intro_locks_off',
        rex: `The safety locks are off in ${arenaName}! ${playerBotName} goes head-to-head with ${rName}!`,
        kira: `${playerBotName}'s ${pHullDesc} is squaring up against ${rName}'s ${rWeaponLabel}—here comes the first impact!`,
        accent: 'amber',
      },
      {
        sig: 'intro_green_light',
        rex: `Green light in ${arenaName}! ${playerBotName} and ${rName} are gunning straight for center ring!`,
        kira: `Both drivers want early ground control before the floor hazards arm!`,
        accent: 'sky',
      },
      {
        sig: 'intro_showdown',
        rex: `Here we go inside ${arenaName}—${playerBotName} packing ${pWeaponLabel} against ${rName}!`,
        kira: `Keep your eyes on the opening exchange, Rex, because neither bot is tapping the brakes!`,
        accent: 'amber',
      },
      {
        sig: 'intro_steel_clash',
        rex: `The BattleBox is sealed at ${arenaName} as ${playerBotName} rolls out across from ${rName}!`,
        kira: `High kinetic energy on both sides tonight—one clean flank shot could tear armor loose early!`,
        accent: 'emerald',
      },
    ];

    const picked = this.pickNonRepeating(intros);
    this.emitCallout(picked.rex, picked.kira, picked.accent, 3, false);
  }

  announceMatchEnd(playerWon: boolean, botName: string, reason?: string) {
    const arenaName = ARENA_CATALOG[this.activeArenaId]?.name || 'the arena';
    const rivalName = this.rivalBot?.config.name || 'the rival machine';

    if (playerWon) {
      const winPool: PhraseCandidate[] =
        reason === 'ring_out'
          ? [
              {
                sig: 'win_ringout_1',
                rex: `Out of the arena! ${botName} launches ${rivalName} clean over the wall for the victory!`,
                kira: `Unbelievable kinetic force to clear the polycarbonate barrier in ${arenaName}!`,
                accent: 'emerald',
              },
              {
                sig: 'win_ringout_2',
                rex: `Ring-out victory! ${botName} sends ${rivalName} flying right out of the BattleBox!`,
                kira: `Pinpoint leverage right against the glass—what a finish from ${botName}!`,
                accent: 'emerald',
              },
            ]
          : reason === 'ko'
            ? [
                {
                  sig: 'win_ko_1',
                  rex: `It is all over by knockout in ${arenaName}! ${botName} completely dismantles ${rivalName}!`,
                  kira: `Dominant weapon control and driving from ${botName} from start to finish!`,
                  accent: 'emerald',
                },
                {
                  sig: 'win_ko_2',
                  rex: `Knockout victory for ${botName}! ${rivalName}'s drive core is completely shut down!`,
                  kira: `Clinical precision on those armor seams—${botName} takes a well-earned win!`,
                  accent: 'emerald',
                },
                {
                  sig: 'win_ko_3',
                  rex: `The referee waves it off! ${botName} scores a decisive knockout over ${rivalName}!`,
                  kira: `${rivalName} simply couldn't absorb any more kinetic punishment in ${arenaName}!`,
                  accent: 'emerald',
                },
              ]
            : [
                {
                  sig: 'win_judge_1',
                  rex: `The final buzzer sounds in ${arenaName}, and ${botName} takes the judges' decision!`,
                  kira: `Superior aggression and ring control sealed that scorecard for ${botName}!`,
                  accent: 'emerald',
                },
                {
                  sig: 'win_judge_2',
                  rex: `Time expires in ${arenaName}, and the judges award a clear victory to ${botName}!`,
                  kira: `${botName} out-scored ${rivalName} on damage and control in every single exchange!`,
                  accent: 'emerald',
                },
              ];
      const picked = this.pickNonRepeating(winPool);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3, true);
    } else {
      const lossPool: PhraseCandidate[] =
        reason === 'ring_out'
          ? [
              {
                sig: 'loss_ringout_1',
                rex: `Ring-out in ${arenaName}! ${rivalName} launches ${botName} over the perimeter wall!`,
                kira: `Getting pinned near the glass was costly—head to the garage, tune the hull, and run it back!`,
                accent: 'rose',
              },
            ]
          : [
              {
                sig: 'loss_ko_1',
                rex: `Tough break in ${arenaName} as ${rivalName} takes this round over ${botName}!`,
                kira: `Upgrade your armor plating or weapon mounts in the garage and come back swinging!`,
                accent: 'rose',
              },
              {
                sig: 'loss_ko_2',
                rex: `${rivalName} survives a fierce battle in ${arenaName} to claim the round over ${botName}!`,
                kira: `${botName} landed heavy shots, Rex—a quick pit-stop upgrade in the garage will turn the tables next fight!`,
                accent: 'rose',
              },
            ];
      const picked = this.pickNonRepeating(lossPool);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3, true);
    }
  }

  onCombatEvent(ev: CombatEvent) {
    if (this.matchEnded) return;

    const now = performance.now();
    const isCritical = ev.type === 'ko' || ev.type === 'ring_out';

    // Global minimum gap between non-critical combat callouts so sentences finish cleanly
    if (!isCritical && now - this.lastEventSpokenAt < 3800) {
      return;
    }

    const sourceName = this.resolveBotName(
      ev.sourceId,
      this.playerBot?.config.name || 'Our contender',
    );
    const targetName = this.resolveBotName(
      ev.targetId,
      this.rivalBot?.config.name || 'the opponent',
    );
    const weaponLabel = ev.weapon ? WEAPON_CATALOG[ev.weapon]?.label : undefined;

    if (ev.type === 'ring_out') {
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_ringout_1',
          rex: `Out of the ring! ${sourceName} blasts ${targetName} clean over the polycarbonate wall!`,
          kira: `Massive upward launch right at the barrier!`,
          accent: 'rose',
        },
        {
          sig: 'ev_ringout_2',
          rex: `Unbelievable! ${sourceName} just ejected ${targetName} completely out of the BattleBox!`,
          kira: `That final hit had insane kinetic lift!`,
          accent: 'rose',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'ko') {
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_ko_1',
          rex: `Huge knockout! Smoke is pouring from ${targetName}'s chassis after that finishing blow from ${sourceName}!`,
          kira: `The main drive core on ${targetName} is completely offline!`,
          accent: 'rose',
        },
        {
          sig: 'ev_ko_2',
          rex: `Total knockout! ${sourceName} shuts ${targetName} down in a shower of titanium sparks!`,
          kira: `That chassis isn't moving another inch, Rex!`,
          accent: 'rose',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'weapon_clash') {
      if (!this.canTriggerCategory('weapon_clash', 7000)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_clash_1',
          rex: `Sparks erupt in center ring as ${sourceName} and ${targetName} collide weapon-to-weapon!`,
          kira: '',
          accent: 'sky',
        },
        {
          sig: 'ev_clash_2',
          rex: '',
          kira: `Incredible parry! Both weapons struck at the exact same split-second and absorbed the recoil!`,
          accent: 'sky',
        },
        {
          sig: 'ev_clash_3',
          rex: `Listen to that shockwave echo off the glass as both spinning weapons clash head-on!`,
          kira: '',
          accent: 'sky',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'thermal_shock') {
      if (!this.canTriggerCategory('thermal_shock', 7500)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_thermal_1',
          rex: `Thermal shock detonation on ${targetName}! Freezing followed by extreme heat cracked the hull!`,
          kira: '',
          accent: 'rose',
        },
        {
          sig: 'ev_thermal_2',
          rex: '',
          kira: `Brittle fracture on ${targetName}! Combining cryo-freeze with plasma heat shatters armor plates instantly!`,
          accent: 'rose',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'frozen_solid') {
      if (!this.canTriggerCategory('frozen_solid', 9000)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_frozen_1',
          rex: '',
          kira: `${targetName} is frozen solid in cryo-ice, leaving their drive motors completely locked up!`,
          accent: 'sky',
        },
        {
          sig: 'ev_frozen_2',
          rex: `Sub-zero freeze locks ${targetName} in place right on the arena floor!`,
          kira: '',
          accent: 'sky',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'arena_event' && ev.callout) {
      if (!this.canTriggerCategory('arena_event', 10000)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_arena_1',
          rex: `Heads up inside the BattleBox—${ev.callout}!`,
          kira: '',
          accent: 'amber',
        },
        {
          sig: 'ev_arena_2',
          rex: '',
          kira: `Arena hazard alert: ${ev.callout}! Both pilots need to adjust their driving lines right now!`,
          accent: 'amber',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'flip') {
      if (!this.canTriggerCategory('flip', 6500)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_flip_1',
          rex: `Huge launch! ${sourceName} gets right underneath ${targetName} and flips them sky-high!`,
          kira: '',
          accent: 'sky',
        },
        {
          sig: 'ev_flip_2',
          rex: '',
          kira: `Clean wedge leverage from ${sourceName}, tossing ${targetName} upside down onto the steel deck!`,
          accent: 'sky',
        },
        {
          sig: 'ev_flip_3',
          rex: `Airborne in the BattleBox! ${sourceName} sends ${targetName} tumbling across the floor!`,
          kira: '',
          accent: 'sky',
        },
        {
          sig: 'ev_flip_4',
          rex: '',
          kira: `${targetName} got caught with high ground clearance and ${sourceName} launched them right onto their roof!`,
          accent: 'sky',
        },
        {
          sig: 'ev_flip_5',
          rex: `What a toss from ${sourceName}, flipping ${targetName} end-over-end!`,
          kira: '',
          accent: 'sky',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'self_right') {
      if (!this.canTriggerCategory('self_right', 9500)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_sr_1',
          rex: '',
          kira: `Quick self-righting recovery from ${sourceName}, snapping right back onto its wheels!`,
          accent: 'emerald',
        },
        {
          sig: 'ev_sr_2',
          rex: `${sourceName} fires the self-righting actuator and gets back in the fight!`,
          kira: '',
          accent: 'emerald',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'armor_break' || ev.type === 'part_detach') {
      if (!this.canTriggerCategory('armor_break', 5500)) return;
      const zoneText = ev.zone ? `${ev.zone} ` : '';
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_armor_1',
          rex: `Heavy structural damage! ${targetName}'s ${zoneText}armor plating just sheared clean off the frame!`,
          kira: '',
          accent: 'amber',
        },
        {
          sig: 'ev_armor_2',
          rex: '',
          kira: `Those mounting bolts gave way on ${targetName}'s ${zoneText}side, leaving the internal chassis wide open!`,
          accent: 'amber',
        },
        {
          sig: 'ev_armor_3',
          rex: `Parts are flying! ${sourceName} just ripped a chunk of ${zoneText}plating right off ${targetName}!`,
          kira: '',
          accent: 'amber',
        },
        {
          sig: 'ev_armor_4',
          rex: '',
          kira: `${targetName} just lost its ${zoneText}armor shield—every hit there now transfers straight to the core!`,
          accent: 'amber',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'lightning') {
      if (!this.canTriggerCategory('lightning', 8500)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_lightning_1',
          rex: `High-voltage lightning arcs through ${targetName}'s conductive frame!`,
          kira: '',
          accent: 'sky',
        },
        {
          sig: 'ev_lightning_2',
          rex: '',
          kira: `That electromagnetic surge on ${targetName} drains weapon capacitors on contact!`,
          accent: 'sky',
        },
        {
          sig: 'ev_lightning_3',
          rex: `Blinding Tesla discharge slams straight into ${targetName}!`,
          kira: '',
          accent: 'sky',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'bomb_blast' || ev.type === 'mortar_blast' || ev.type === 'explosion') {
      if (ev.intensity < 0.75 || !this.canTriggerCategory('bomb_blast', 8000)) return;
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_bomb_1',
          rex: `Direct mortar detonation on ${targetName}! The blast shockwave rattled the safety glass!`,
          kira: '',
          accent: 'rose',
        },
        {
          sig: 'ev_bomb_2',
          rex: '',
          kira: `Pinpoint ordnance from ${sourceName}, hammering all four of ${targetName}'s armor zones at once!`,
          accent: 'rose',
        },
        {
          sig: 'ev_bomb_3',
          rex: `Explosive impact right on top of ${targetName}!`,
          kira: '',
          accent: 'rose',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'rail_shot' || ev.type === 'laser_beam') {
      if (!this.canTriggerCategory('ranged_beam', 8500)) return;
      const isRail = ev.type === 'rail_shot';
      const picked = this.pickNonRepeating(
        isRail
          ? [
              {
                sig: 'ev_rail_1',
                rex: `Magnetic rail cannon from ${sourceName} punches a hyper-velocity slug straight into ${targetName}!`,
                kira: '',
                accent: 'sky',
              },
              {
                sig: 'ev_rail_2',
                rex: '',
                kira: `Pinpoint railgun snipe from ${sourceName} before ${targetName} could even close the gap!`,
                accent: 'sky',
              },
              {
                sig: 'ev_rail_3',
                rex: `Dead-on rail shot from ${sourceName} rocks ${targetName} back on its heels!`,
                kira: '',
                accent: 'sky',
              },
              {
                sig: 'ev_rail_4',
                rex: '',
                kira: `Hypersonic kinetic transfer from ${sourceName}'s railgun right through ${targetName}'s front plate!`,
                accent: 'sky',
              },
            ]
          : [
              {
                sig: 'ev_laser_1',
                rex: `${sourceName} locks that high-energy thermal beam right onto ${targetName}'s hull!`,
                kira: '',
                accent: 'sky',
              },
              {
                sig: 'ev_laser_2',
                rex: '',
                kira: `Sustained laser contact from ${sourceName} is superheating ${targetName}'s armor plating!`,
                accent: 'sky',
              },
              {
                sig: 'ev_laser_3',
                rex: `Searing beam weapon from ${sourceName} carves a glowing trench across ${targetName}!`,
                kira: '',
                accent: 'sky',
              },
              {
                sig: 'ev_laser_4',
                rex: '',
                kira: `${sourceName} is keeping distance and melting ${targetName}'s outer shell with precision laser fire!`,
                accent: 'sky',
              },
            ],
      );
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if (ev.type === 'crusher_slam' || ev.type === 'pit_fall') {
      if (!this.canTriggerCategory('hazard_trap', 6500)) return;
      const isPit = ev.type === 'pit_fall';
      const picked = this.pickNonRepeating(
        isPit
          ? [
              {
                sig: 'ev_pit_1',
                rex: `Down into the drop pit! ${targetName} gets swallowed by the arena floor!`,
                kira: '',
                accent: 'rose',
              },
              {
                sig: 'ev_pit_2',
                rex: '',
                kira: `Brilliant herding from ${sourceName} to force ${targetName} right over the open pit edge!`,
                accent: 'rose',
              },
            ]
          : [
              {
                sig: 'ev_crusher_1',
                rex: `The hydraulic crusher slams down right on top of ${targetName}'s upper deck!`,
                kira: '',
                accent: 'rose',
              },
              {
                sig: 'ev_crusher_2',
                rex: '',
                kira: `Forty tons of house crusher pressure just punctured straight into ${targetName}'s top armor!`,
                accent: 'rose',
              },
            ],
      );
      this.emitCallout(picked.rex, picked.kira, picked.accent, 3);
      return;
    }

    if (ev.type === 'crit' && ev.intensity >= 1.08) {
      if (!this.canTriggerCategory('crit', 7500)) return;
      const wText = weaponLabel ? ` with the ${weaponLabel}` : '';
      const picked = this.pickNonRepeating([
        {
          sig: 'ev_crit_1',
          rex: `Brutal critical impact from ${sourceName}${wText}, sending sparks flying off ${targetName}!`,
          kira: '',
          accent: 'amber',
        },
        {
          sig: 'ev_crit_2',
          rex: '',
          kira: `Direct bite right on ${targetName}'s exposed seam—${sourceName} got maximum kinetic transfer on that strike!`,
          accent: 'amber',
        },
        {
          sig: 'ev_crit_3',
          rex: `Massive critical shot from ${sourceName} rattles ${targetName}'s entire chassis!`,
          kira: '',
          accent: 'amber',
        },
        {
          sig: 'ev_crit_4',
          rex: '',
          kira: `You could see ${targetName}'s frame flex from that critical hit${wText}!`,
          accent: 'amber',
        },
        {
          sig: 'ev_crit_5',
          rex: `Clean critical connection by ${sourceName}, tearing into ${targetName}'s flank!`,
          kira: '',
          accent: 'amber',
        },
      ]);
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
      return;
    }

    if ((ev.type === 'hit' || ev.type === 'era_blast') && ev.intensity >= 1.3) {
      if (!this.canTriggerCategory('heavy_hit', 9500)) return;
      const picked = this.pickNonRepeating(
        ev.type === 'era_blast'
          ? [
              {
                sig: 'ev_era_1',
                rex: '',
                kira: `Explosive reactive armor on ${targetName} detonates outward and deflects the incoming blow!`,
                accent: 'amber',
              },
              {
                sig: 'ev_era_2',
                rex: `Reactive armor tiles fire on ${targetName}, blowing ${sourceName} back!`,
                kira: '',
                accent: 'amber',
              },
            ]
          : [
              {
                sig: 'ev_hit_1',
                rex: `Heavy steel collision in center ring between ${sourceName} and ${targetName}!`,
                kira: '',
                accent: 'amber',
              },
              {
                sig: 'ev_hit_2',
                rex: '',
                kira: `Solid kinetic exchange there—${sourceName} and ${targetName} are trading full-throttle impacts!`,
                accent: 'amber',
              },
              {
                sig: 'ev_hit_3',
                rex: `Bone-rattling impact as ${sourceName} slams head-on into ${targetName}!`,
                kira: '',
                accent: 'amber',
              },
              {
                sig: 'ev_hit_4',
                rex: '',
                kira: `Look at the recoil on both chassis after that heavy collision between ${sourceName} and ${targetName}!`,
                accent: 'amber',
              },
            ],
      );
      this.emitCallout(picked.rex, picked.kira, picked.accent, 2);
    }
  }
}

export const voiceCommentator = new VoiceCommentatorEngine();
