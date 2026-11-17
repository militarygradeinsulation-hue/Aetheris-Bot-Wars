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

class VoiceCommentatorEngine {
  private masterMuted = false;
  private commentaryMuted = true;
  private volume = 0.9;
  private nextId = 1;
  private lastSpokenAt = 0;
  private lastMidFightBanterAt = 0;
  private listeners = new Set<CommentaryListener>();
  private audioCache = new Map<string, string>();
  private currentAudioEl: HTMLAudioElement | null = null;
  private inFlightTts = false;

  // Live Match Context for fight-specific 2-commentator dialogue
  private activeArenaId: ArenaId = 'foundry';
  private playerBot: BotPhysicsState | null = null;
  private rivalBot: BotPhysicsState | null = null;
  private allBots: BotPhysicsState[] = [];
  private insightVariant = 0;

  private stopCurrentPlayback() {
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

  private playDataUri(dataUri: string, priority: boolean) {
    if (this.isSilenced() || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (this.currentAudioEl && !this.currentAudioEl.paused) {
      if (!priority) return;
      this.stopCurrentPlayback();
    }
    try {
      const audio = new Audio(dataUri);
      audio.volume = Math.min(1, 0.96 * this.volume);
      this.currentAudioEl = audio;
      audio.addEventListener(
        'ended',
        () => {
          if (this.currentAudioEl === audio) {
            this.currentAudioEl = null;
          }
        },
        { once: true },
      );
      audio.play().catch(() => {
        if (this.currentAudioEl === audio) {
          this.currentAudioEl = null;
        }
      });
    } catch {
      // Ignore playback restrictions
    }
  }

  private async speakDuoCommentary(rexText: string, kiraText: string, priority: boolean) {
    if (this.isSilenced() || typeof window === 'undefined') return;
    const cacheKey = `duo:${rexText}||${kiraText}`;
    const cachedUri = this.audioCache.get(cacheKey);
    if (cachedUri) {
      this.playDataUri(cachedUri, priority);
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    if (this.inFlightTts && !priority) return;
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
        this.audioCache.set(cacheKey, dataUri);
        if (!this.isSilenced()) {
          this.playDataUri(dataUri, priority);
        }
      }
    } catch {
      // Skip audio if TTS endpoint unreachable; never fall back to robotic OS speechSynthesis
    } finally {
      this.inFlightTts = false;
    }
  }

  private emitDuoExchange(
    rexText: string,
    kiraText: string,
    accent: CommentaryLine['accent'] = 'amber',
    priority = false,
  ) {
    if (this.commentaryMuted) return;

    const now = performance.now();
    if (!priority && now - this.lastSpokenAt < 5800) return;
    this.lastSpokenAt = now;

    const line: CommentaryLine = {
      id: this.nextId++,
      speaker: 'REX VANCE (HOST)',
      text: rexText,
      coSpeaker: 'KIRA VOLT (ANALYST)',
      coText: kiraText,
      accent,
      timestamp: Date.now(),
    };
    this.listeners.forEach((cb) => cb(line));

    void this.speakDuoCommentary(rexText, kiraText, priority);
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

    if (snap.phase !== 'active' || !pBot || !this.rivalBot || pBot.isDead) return;

    const now = performance.now();
    if (now - this.lastSpokenAt < 12500 || now - this.lastMidFightBanterAt < 14500) return;
    this.lastMidFightBanterAt = now;

    const arenaSpec = ARENA_CATALOG[snap.arenaId];
    const pName = pBot.config.name;
    const rName = this.rivalBot.config.name;
    const pHpPct = Math.round((pBot.hp / Math.max(1, pBot.maxHp)) * 100);
    const rHpPct = Math.round((this.rivalBot.hp / Math.max(1, this.rivalBot.maxHp)) * 100);
    const pWeapon = describeWeapons(pBot.config);
    const rWeapon = describeWeapons(this.rivalBot.config);

    const variant = this.insightVariant++ % 4;
    if (variant === 0) {
      this.emitDuoExchange(
        `${pName} and ${rName} are trading heavy blows right in the center of ${arenaSpec.name}!`,
        `Look at the telemetry, Rex—${pName} is sitting at ${pHpPct}% hull integrity with that ${pWeapon}, while ${rName} is down to ${rHpPct}%! Positioning around ${arenaSpec.hazardTag.split('·')[0].trim()} is going to decide this.`,
        'sky',
      );
    } else if (variant === 1) {
      const lowZone =
        this.rivalBot.armorZones.front < this.rivalBot.armorZones.rear ? 'front' : 'rear';
      this.emitDuoExchange(
        `Non-stop aggression from ${pName}, keeping ${rName} on the back foot!`,
        `Smart driving! ${rName}'s ${lowZone} armor plating is taking a beating, and if ${pName} lands one clean shot with the ${pWeapon} on that seam, we could see a core breach.`,
        'amber',
      );
    } else if (variant === 2) {
      this.emitDuoExchange(
        `Watch the speed and drift angles here in ${arenaSpec.name}—neither pilot is backing off the throttle!`,
        `${rName} is trying to line up its ${rWeapon}, Rex, so ${pName} needs to use boost-drifts to cut inside their turning radius and attack the flank.`,
        'sky',
      );
    } else {
      this.emitDuoExchange(
        `The sparks are flying as ${pName} presses the attack against ${rName}!`,
        `Power management is critical right now, Rex. ${pName} is cycling its ${pWeapon} efficiently so the battery recharges between strikes.`,
        'emerald',
      );
    }
  }

  announceMatchStart(
    arenaId: ArenaId,
    playerBotName: string,
    rivalBotName?: string,
    playerConfig?: BotConfig,
    rivalConfig?: BotConfig,
  ) {
    this.activeArenaId = arenaId;
    this.lastMidFightBanterAt = performance.now();
    const arenaSpec = ARENA_CATALOG[arenaId];
    const arenaName = arenaSpec?.name || 'the BattleBox';
    const hazardNote = arenaSpec?.hazardTag || arenaSpec?.subtitle || 'live arena hazards';
    const pBotCfg = playerConfig || this.playerBot?.config;
    const rBotCfg = rivalConfig || this.rivalBot?.config;
    const rName = rivalBotName || rBotCfg?.name || 'the challenger';

    const pWeaponLabel = pBotCfg ? describeWeapons(pBotCfg) : 'custom weapon array';
    const rWeaponLabel = rBotCfg ? describeWeapons(rBotCfg) : 'heavy combat loadout';
    const pHullDesc = pBotCfg ? describeChassisAndArmor(pBotCfg) : 'reinforced hull';
    const rHullDesc = rBotCfg ? describeChassisAndArmor(rBotCfg) : 'armored frame';

    const rexLine = `Welcome to Aetheris Bot Wars, live from ${arenaName}! In the near corner we have ${playerBotName} packing ${pWeaponLabel}, squaring off against ${rName} armed with ${rWeaponLabel}!`;
    const kiraLine = `What a matchup, Rex! ${playerBotName}'s ${pHullDesc} goes head-to-head with ${rName}'s ${rHullDesc}, and with ${hazardNote} active on this floor, one mistake could end it in seconds!`;

    this.emitDuoExchange(rexLine, kiraLine, 'amber', true);
  }

  announceMatchEnd(playerWon: boolean, botName: string, reason?: string) {
    const arenaName = ARENA_CATALOG[this.activeArenaId]?.name || 'the arena';
    const rivalName = this.rivalBot?.config.name || 'the rival machine';
    const pWeapons = this.playerBot ? describeWeapons(this.playerBot.config) : 'those weapons';

    if (playerWon) {
      const rexLine =
        reason === 'ring_out'
          ? `OUT OF THE ARENA! ${botName} launches ${rivalName} clean over the perimeter wall for an instant Ring-Out victory in ${arenaName}!`
          : reason === 'ko'
            ? `It is all over by knockout in ${arenaName}! ${botName} completely dismantles ${rivalName} for a statement victory!`
            : `The final buzzer sounds in ${arenaName}, and the judges score it a decisive victory for ${botName}!`;
      const kiraLine =
        reason === 'ring_out'
          ? `Unbelievable kinetic force, Rex! ${botName}'s ${pWeapons} transferred so much upward momentum at the wall that ${rivalName} cleared the Lexan barrier completely!`
          : reason === 'ko'
            ? `Total engineering dominance, Rex! ${botName}'s ${pWeapons} overwhelmed ${rivalName}'s armor zones and shut down their drive core!`
            : `Clinical driving from start to finish! ${botName} controlled the center of ${arenaName} and out-damaged ${rivalName} on every judge's card.`;
      this.emitDuoExchange(rexLine, kiraLine, 'emerald', true);
    } else {
      const rexLine =
        reason === 'ring_out'
          ? `OH NO! ${botName} has been knocked right out of the ring by ${rivalName} in ${arenaName}!`
          : `Heartbreaker in ${arenaName}! ${rivalName} takes this round after an all-out war with ${botName}!`;
      const kiraLine =
        reason === 'ring_out'
          ? `Getting trapped against the perimeter rail against ${rivalName} was fatal, Rex—one massive launch sent ${botName} over the wall!`
          : `${botName} landed some heavy shots with ${pWeapons}, Rex, but ${rivalName} found an opening in the armor seams. Swap the plating or tune the weapon mounts in the garage and run it back!`;
      this.emitDuoExchange(rexLine, kiraLine, 'rose', true);
    }
  }

  onCombatEvent(ev: CombatEvent) {
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
      this.emitDuoExchange(
        `OUT OF THE RING! ${sourceName} just blasted ${targetName} clean over the arena wall!`,
        `Are you kidding me, Rex?! That impact${weaponLabel ? ` from the ${weaponLabel}` : ''} had enough raw kinetic impulse to launch ${targetName} completely out of the BattleBox!`,
        'rose',
        true,
      );
      return;
    }

    if (ev.type === 'ko') {
      this.emitDuoExchange(
        `OH! Huge knockout! Smoke and sparks are pouring out of ${targetName}'s chassis—that bot is not moving!`,
        `${sourceName} delivered the finishing blow${weaponLabel ? ` with the ${weaponLabel}` : ''}, Rex! The internal battery and drive core on ${targetName} are completely offline!`,
        'rose',
        true,
      );
      return;
    }

    if (ev.type === 'weapon_clash') {
      this.emitDuoExchange(
        `Sparks erupt in the center of the arena as ${sourceName} and ${targetName} collide weapon-to-weapon!`,
        `Incredible timing, Rex! Firing their active weapons at the exact same millisecond parried the hydraulic flip and neutralized the launch!`,
        'sky',
        true,
      );
      return;
    }

    if (ev.type === 'thermal_shock') {
      this.emitDuoExchange(
        `Massive thermal shockwave on ${targetName}! The armor plating just cracked wide open!`,
        `That is textbook elemental physics, Rex—slamming sub-zero cryo and superheated plasma onto ${targetName}'s hull caused instant brittle fracture!`,
        'rose',
        true,
      );
      return;
    }

    if (ev.type === 'arena_event' && ev.callout) {
      const arenaName = ARENA_CATALOG[this.activeArenaId]?.name || 'the arena';
      this.emitDuoExchange(
        `Heads up drivers! ${ev.callout} inside ${arenaName}!`,
        `Both pilots have to adjust their lines immediately, Rex—getting caught in that hazard right now will shred their under-chassis!`,
        'amber',
        true,
      );
      return;
    }

    if (ev.type === 'flip') {
      this.emitDuoExchange(
        `HUGE LAUNCH! ${sourceName} gets right underneath ${targetName} and sends them flying across the BattleBox!`,
        `Look at the low ground clearance on ${sourceName}, Rex! When that pneumatic flipper fires under a higher center of gravity, ${targetName} has zero traction to resist!`,
        'sky',
      );
      return;
    }

    if (ev.type === 'armor_break' || ev.type === 'part_detach') {
      const zoneText = ev.zone ? `${ev.zone} ` : '';
      this.emitDuoExchange(
        `Heavy structural damage! A chunk of ${targetName}'s ${zoneText}armor just sheared clean off onto the floor!`,
        `That debris stays live on the arena floor too, Rex! Not only is ${targetName}'s ${zoneText}hull exposed to ${sourceName}, both bots have to watch out for running over that scrap!`,
        'amber',
      );
      return;
    }

    if (ev.type === 'lightning') {
      this.emitDuoExchange(
        `High-voltage lightning slams down onto ${targetName} in a blinding arc!`,
        `Thousands of amps just surged straight through ${targetName}'s conductive frame, Rex—that electromagnetic shock drains weapon capacitor power on impact!`,
        'sky',
      );
      return;
    }

    if (ev.type === 'bomb_blast' || ev.type === 'mortar_blast' || ev.type === 'explosion') {
      if (ev.intensity >= 0.75) {
        this.emitDuoExchange(
          `Direct ordnance detonation on ${targetName}! The shockwave shook the entire safety glass!`,
          `Pinpoint aerial targeting from ${sourceName}! Explosive blast pressure bypasses angled deflection and hammers all four armor zones at once!`,
          'rose',
        );
      }
      return;
    }

    if (ev.type === 'rail_shot' || ev.type === 'laser_beam') {
      this.emitDuoExchange(
        `Searing high-energy beam from ${sourceName} slices straight into ${targetName}!`,
        `Zero travel time on that shot, Rex! ${sourceName} is sniping from range before ${targetName} can close the gap!`,
        'sky',
      );
      return;
    }

    if (ev.type === 'crusher_slam' || ev.type === 'pit_fall') {
      this.emitDuoExchange(
        `OH NO! ${targetName} gets caught right in the arena trap!`,
        `That is exactly what ${sourceName} wanted, Rex—herding ${targetName} into the arena hazards to let the house traps do the heavy damage!`,
        'rose',
        true,
      );
      return;
    }

    if (ev.type === 'crit' && ev.intensity >= 1.1) {
      this.emitDuoExchange(
        `Brutal critical impact from ${sourceName} onto ${targetName}!`,
        `Right on the exposed seam${weaponLabel ? ` with the ${weaponLabel}` : ''}! ${targetName}'s internal systems are taking direct kinetic transfer!`,
        'amber',
      );
    }
  }
}

export const voiceCommentator = new VoiceCommentatorEngine();
