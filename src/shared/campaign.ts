import { describePartKey, type ArenaId, type GameMode, type MatchModifierId, type TimedBattleDuration } from './types';

export type CampaignObjective =
  | { type: 'win' }
  | { type: 'hp'; value: number }
  | { type: 'time'; value: number }
  | { type: 'kos'; value: number }
  | { type: 'allies' }
  | { type: 'wave'; value: number };

export interface CampaignLevel {
  id: string;
  chapter: number;
  title: string;
  brief: string;
  arenaId: ArenaId;
  mode: Exclude<GameMode, 'campaign' | 'multiplayer' | 'gauntlet' | 'practice'>;
  enemies: string[];
  allies?: string[];
  enemySkill: number;
  allySkill?: number;
  modifiers?: MatchModifierId[];
  duration: TimedBattleDuration;
  objectives: [CampaignObjective, CampaignObjective, CampaignObjective];
  rewardScrap: number;
  rewardSkillPoints?: number;
  rewardUnlock?: string;
}

export const CAMPAIGN_CHAPTERS: Array<{ chapter: number; name: string; tagline: string }> = [
  { chapter: 1, name: 'Rookie Circuit', tagline: 'Prove the chassis works before anyone bets on it' },
  { chapter: 2, name: 'Pro League', tagline: 'Tag teams, hill fights and new weapon tech' },
  { chapter: 3, name: 'Heavy Metal', tagline: 'Heavyweights, drop pits, rocket pods and survival' },
  { chapter: 4, name: 'Titan Wars', tagline: 'Raid the four boss machines that run the league' },
];

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 'c1_first_blood',
    chapter: 1,
    title: 'First Blood',
    brief: 'A featherweight saw bot wants your slot. Show it the door.',
    arenaId: 'foundry',
    mode: 'duel_1v1',
    enemies: ['volt_wasp'],
    enemySkill: 0,
    duration: 150,
    objectives: [{ type: 'win' }, { type: 'hp', value: 50 }, { type: 'time', value: 60 }],
    rewardScrap: 180,
  },
  {
    id: 'c1_flame_test',
    chapter: 1,
    title: 'Trial by Fire',
    brief: 'Torch Mantis burns anything that stops moving. Keep it off your flanks.',
    arenaId: 'foundry',
    mode: 'duel_1v1',
    enemies: ['torch_mantis'],
    enemySkill: 1,
    duration: 150,
    objectives: [{ type: 'win' }, { type: 'hp', value: 40 }, { type: 'time', value: 75 }],
    rewardScrap: 220,
    rewardUnlock: 'weapon:drum',
  },
  {
    id: 'c1_ice_breaker',
    chapter: 1,
    title: 'Ice Breaker',
    brief: 'Frostbite Zero slows you down, then shatters brittle armor. Stay warm.',
    arenaId: 'cryo',
    mode: 'duel_1v1',
    enemies: ['frostbite_zero'],
    enemySkill: 1,
    duration: 150,
    objectives: [{ type: 'win' }, { type: 'hp', value: 45 }, { type: 'time', value: 80 }],
    rewardScrap: 260,
    rewardUnlock: 'weapon:cryo_jet',
  },
  {
    id: 'c1_rookie_rumble',
    chapter: 1,
    title: 'Rookie Rumble',
    brief: 'Four rookies, one box, no rules. Last bot rolling takes the purse.',
    arenaId: 'colosseum',
    mode: 'brawl_4bot',
    enemies: ['volt_wasp', 'torch_mantis', 'sting_ray'],
    enemySkill: 1,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'kos', value: 2 }, { type: 'hp', value: 30 }],
    rewardScrap: 340,
    rewardSkillPoints: 1,
    rewardUnlock: 'chassis:scorpion',
  },
  {
    id: 'c2_tag_team',
    chapter: 2,
    title: 'Tag Team',
    brief: 'Gyro Saucer joins your corner. Take down the grapple-and-lance pair.',
    arenaId: 'reactor',
    mode: 'team_2v2',
    allies: ['gyro_saucer'],
    enemies: ['pincer_jack', 'sting_ray'],
    enemySkill: 2,
    allySkill: 2,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'kos', value: 1 }],
    rewardScrap: 380,
    rewardUnlock: 'weapon:lance',
  },
  {
    id: 'c2_hill_climb',
    chapter: 2,
    title: 'Hill Climb',
    brief: 'Score is all that counts. Hold the glowing ring with Aether Sovereign.',
    arenaId: 'cyber_grid',
    mode: 'king_hill',
    allies: ['aether_sovereign'],
    enemies: ['gyro_saucer', 'gauss_stalker'],
    enemySkill: 2,
    allySkill: 2,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'time', value: 90 }],
    rewardScrap: 400,
    rewardUnlock: 'drive:hover',
  },
  {
    id: 'c2_arc_flash',
    chapter: 2,
    title: 'Arc Flash',
    brief: 'Aether Sovereign lives inside the storm cage. Watch the sky and its coils.',
    arenaId: 'storm',
    mode: 'duel_1v1',
    enemies: ['aether_sovereign'],
    enemySkill: 2,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'hp', value: 40 }, { type: 'time', value: 90 }],
    rewardScrap: 420,
    rewardUnlock: 'weapon:tesla',
  },
  {
    id: 'c2_scrap_dogs',
    chapter: 2,
    title: 'Scrap Dogs',
    brief: 'Scrap Jaw grabs, pins and crushes. Never let it close its beak.',
    arenaId: 'toxic_scrapyard',
    mode: 'duel_1v1',
    enemies: ['scrap_jaw'],
    enemySkill: 2,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'hp', value: 35 }, { type: 'time', value: 90 }],
    rewardScrap: 440,
    rewardSkillPoints: 1,
    rewardUnlock: 'weapon:crush_jaw',
  },
  {
    id: 'c3_sky_high',
    chapter: 3,
    title: 'Sky High',
    brief: 'Two heavyweights on a deck full of drop pits. Use the pits.',
    arenaId: 'skyforge',
    mode: 'team_2v2',
    allies: ['pincer_jack'],
    enemies: ['obelisk_siege', 'cryo_leviathan'],
    enemySkill: 3,
    allySkill: 3,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'hp', value: 35 }],
    rewardScrap: 520,
    rewardUnlock: 'armor:tungsten',
  },
  {
    id: 'c3_rocket_rain',
    chapter: 3,
    title: 'Rocket Rain',
    brief: 'Low gravity, homing rockets. Stay close so the salvo has no room to turn.',
    arenaId: 'aether_nexus',
    mode: 'duel_1v1',
    enemies: ['rocket_hex'],
    enemySkill: 3,
    modifiers: ['low_gravity'],
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'hp', value: 35 }, { type: 'time', value: 100 }],
    rewardScrap: 560,
    rewardUnlock: 'weapon:missiles',
  },
  {
    id: 'c3_hold_line',
    chapter: 3,
    title: 'Hold the Line',
    brief: 'Endless waves in the scrapyard. Reach wave six to pass, eight for the record.',
    arenaId: 'toxic_scrapyard',
    mode: 'survival',
    enemies: [],
    enemySkill: 0,
    duration: 300,
    objectives: [{ type: 'wave', value: 6 }, { type: 'wave', value: 8 }, { type: 'kos', value: 12 }],
    rewardScrap: 600,
    rewardUnlock: 'armor:nanoweave',
  },
  {
    id: 'c3_siege_breaker',
    chapter: 3,
    title: 'Siege Breaker',
    brief: 'Full 3v3 war in the Caldera. Your squad is Gauss Stalker and Aether Sovereign.',
    arenaId: 'volcano_caldera',
    mode: 'team_3v3',
    allies: ['gauss_stalker', 'aether_sovereign'],
    enemies: ['obelisk_siege', 'hellfire_howitzer', 'rocket_hex'],
    enemySkill: 3,
    allySkill: 3,
    duration: 180,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'kos', value: 2 }],
    rewardScrap: 680,
    rewardSkillPoints: 1,
    rewardUnlock: 'chassis:juggernaut',
  },
  {
    id: 'c4_iron_maw',
    chapter: 4,
    title: 'Raid: Iron Maw',
    brief: 'A crushing, grabbing monster wrapped in ERA blocks. Hit and leave.',
    arenaId: 'toxic_scrapyard',
    mode: 'boss_raid',
    allies: ['scrap_jaw'],
    enemies: ['iron_maw'],
    enemySkill: 3,
    allySkill: 3,
    duration: 300,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'time', value: 150 }],
    rewardScrap: 800,
    rewardUnlock: 'armor:reactive_era',
  },
  {
    id: 'c4_storm_queen',
    chapter: 4,
    title: 'Raid: Storm Queen',
    brief: 'She hovers over the traps and chains lightning across the deck.',
    arenaId: 'storm',
    mode: 'boss_raid',
    allies: ['aether_sovereign', 'gauss_stalker'],
    enemies: ['storm_queen'],
    enemySkill: 4,
    allySkill: 3,
    duration: 300,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'hp', value: 30 }],
    rewardScrap: 900,
    rewardUnlock: 'weapon:magnet',
  },
  {
    id: 'c4_omega',
    chapter: 4,
    title: 'Raid: Omega Prime',
    brief: 'The Aetheris flagship: railgun, tesla and mortar on one dreadnought.',
    arenaId: 'aether_nexus',
    mode: 'boss_raid',
    allies: ['titan_behemoth', 'hellfire_howitzer'],
    enemies: ['omega_prime'],
    enemySkill: 4,
    allySkill: 4,
    duration: 300,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'time', value: 160 }],
    rewardScrap: 1100,
    rewardSkillPoints: 1,
    rewardUnlock: 'weapon:railgun',
  },
  {
    id: 'c4_overlord',
    chapter: 4,
    title: 'Raid: The Overlord',
    brief: 'The league owner built the biggest machine ever to enter a box. End it.',
    arenaId: 'colosseum',
    mode: 'boss_raid',
    allies: ['titan_behemoth', 'rocket_hex'],
    enemies: ['the_overlord'],
    enemySkill: 5,
    allySkill: 4,
    duration: 300,
    objectives: [{ type: 'win' }, { type: 'allies' }, { type: 'time', value: 180 }],
    rewardScrap: 1500,
    rewardSkillPoints: 2,
    rewardUnlock: 'armor:aetherium',
  },
  {
    id: 'c4_champion',
    chapter: 4,
    title: "Champion's Crown",
    brief: 'Final free-for-all under chaos rules. Win this and the belt is yours.',
    arenaId: 'colosseum',
    mode: 'brawl_4bot',
    enemies: ['titan_behemoth', 'hellfire_howitzer', 'gauss_stalker'],
    enemySkill: 5,
    modifiers: ['chaos_events'],
    duration: 300,
    objectives: [{ type: 'win' }, { type: 'kos', value: 2 }, { type: 'hp', value: 25 }],
    rewardScrap: 2000,
    rewardSkillPoints: 3,
    rewardUnlock: 'weapon:mortar',
  },
];

export function getCampaignLevel(id: string): CampaignLevel | undefined {
  return CAMPAIGN_LEVELS.find((l) => l.id === id);
}

export function isLevelUnlocked(levelId: string, stars: Record<string, number> | undefined): boolean {
  const idx = CAMPAIGN_LEVELS.findIndex((l) => l.id === levelId);
  if (idx <= 0) return true;
  return (stars?.[CAMPAIGN_LEVELS[idx - 1].id] ?? 0) >= 1;
}

export function describeObjective(o: CampaignObjective): string {
  switch (o.type) {
    case 'win':
      return 'Win the match';
    case 'hp':
      return `Finish with ${o.value}%+ hull`;
    case 'time':
      return `Win in under ${o.value}s`;
    case 'kos':
      return `Score ${o.value}+ KOs yourself`;
    case 'allies':
      return 'Win with every ally still running';
    case 'wave':
      return `Reach wave ${o.value}`;
  }
}

export interface CampaignMatchFacts {
  won: boolean;
  hpPct: number;
  elapsed: number;
  kos: number;
  alliesAlive: boolean;
  wave: number;
}

export function evaluateObjective(o: CampaignObjective, f: CampaignMatchFacts): boolean {
  switch (o.type) {
    case 'win':
      return f.won;
    case 'hp':
      return f.won && f.hpPct >= o.value;
    case 'time':
      return f.won && f.elapsed <= o.value;
    case 'kos':
      return f.kos >= o.value;
    case 'allies':
      return f.won && f.alliesAlive;
    case 'wave':
      return f.wave >= o.value;
  }
}

export function levelPassed(level: CampaignLevel, f: CampaignMatchFacts): boolean {
  if (level.mode === 'survival') return evaluateObjective(level.objectives[0], f);
  return f.won;
}

export function describeUnlock(key: string | undefined): string {
  if (!key) return '';
  const cat = key.split(':')[0];
  return `${cat.charAt(0).toUpperCase()}${cat.slice(1)}: ${describePartKey(key)}`;
}
