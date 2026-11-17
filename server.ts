import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  AI_RIVAL_PRESETS,
  createInitialSnapshot,
  stepArenaPhysics,
  type BotRosterTemplate,
} from './src/shared/physicsEngine.ts';
import {
  ARENA_CATALOG,
  type ArenaId,
  type ArenaSnapshot,
  type BotConfig,
  type ClanInfo,
  computeBotStats,
  DEFAULT_SKILLS,
  getBotChassisStyles,
  getBotWeapons,
  type LeaderboardEntry,
  type OnlinePresence,
  type PvpMatchResult,
  type PvpRecord,
  type PlayerInputState,
  type SeasonalEvent,
  type SkillTree,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.join(DATA_DIR, 'arena-store.json');

interface PersistentStore {
  pvp?: PvpRecord[];
  leaderboard: LeaderboardEntry[];
  clans: ClanInfo[];
  seasonalEvents: SeasonalEvent[];
}

function seedStore(): PersistentStore {
  const now = new Date().toISOString();
  return {
    leaderboard: [
      {
        id: 'seed_0',
        name: 'Commander Orion',
        clanTag: 'AETH',
        rating: 1940,
        wins: 54,
        losses: 7,
        kos: 42,
        botName: 'Omega Prime',
        weapon: 'railgun',
        armor: 'aetherium',
        powerScore: 925,
        updatedAt: now,
      },
      {
        id: 'seed_1',
        name: 'Kaelen Vance',
        clanTag: 'IRON',
        rating: 1840,
        wins: 42,
        losses: 9,
        kos: 31,
        botName: 'Obsidian Maul',
        weapon: 'hammer',
        armor: 'reactive_era',
        powerScore: 862,
        updatedAt: now,
      },
      {
        id: 'seed_2',
        name: 'Nora Takahashi',
        clanTag: 'APEX',
        rating: 1765,
        wins: 36,
        losses: 11,
        kos: 28,
        botName: 'Redline Edge',
        weapon: 'vspinner',
        armor: 'titanium',
        powerScore: 815,
        updatedAt: now,
      },
      {
        id: 'seed_3',
        name: 'Viktor Volkov',
        clanTag: 'NOVA',
        rating: 1715,
        wins: 33,
        losses: 11,
        kos: 26,
        botName: 'Hellfire Howitzer',
        weapon: 'mortar',
        armor: 'tungsten',
        powerScore: 804,
        updatedAt: now,
      },
      {
        id: 'seed_4',
        name: 'Devon Mercer',
        clanTag: 'VOLT',
        rating: 1690,
        wins: 29,
        losses: 12,
        kos: 22,
        botName: 'Tesla Catapult',
        weapon: 'tesla',
        armor: 'kevlar',
        powerScore: 770,
        updatedAt: now,
      },
      {
        id: 'seed_5',
        name: 'Sora Lindqvist',
        clanTag: 'CRYO',
        rating: 1620,
        wins: 24,
        losses: 14,
        kos: 19,
        botName: 'Glacier Drum',
        weapon: 'cryo_jet',
        armor: 'nanoweave',
        powerScore: 748,
        updatedAt: now,
      },
    ],
    clans: [
      {
        id: 'clan_aether',
        name: 'Aetheris Prime',
        tag: 'AETH',
        motto: 'Quantum energy shields, railgun precision, and orbital supremacy.',
        perkLabel: '+8% Energy Regen & Aether Shield Synergy',
        warPoints: 2890,
        memberCount: 24,
        wins: 78,
        tournamentSeed: 1,
        chat: [
          {
            id: 'c0',
            sender: 'Commander Orion',
            text: 'Aetheris Nexus low-gravity qualifier is live. Equip Tesla or Railgun slots!',
            timestamp: now,
          },
        ],
      },
      {
        id: 'clan_iron',
        name: 'Iron Vanguard',
        tag: 'IRON',
        motto: 'Heavy steel hulls, ERA blast plating, and relentless frontal pressure.',
        perkLabel: '+10% Armor Zone Durability & Ramming Mass',
        warPoints: 2640,
        memberCount: 19,
        wins: 69,
        tournamentSeed: 2,
        chat: [
          {
            id: 'c1',
            sender: 'Kaelen Vance',
            text: 'Reactive ERA blocks shred horizontal spinners in 2v2 Clan Wars.',
            timestamp: now,
          },
        ],
      },
      {
        id: 'clan_apex',
        name: 'Apex Torque',
        tag: 'APEX',
        motto: 'Maximum flywheel RPM and surgical rear-deck strikes.',
        perkLabel: '+8% Rotor Spin-Up & Kinetic Impulse',
        warPoints: 2410,
        memberCount: 17,
        wins: 61,
        tournamentSeed: 3,
        chat: [
          {
            id: 'c2',
            sender: 'Nora Takahashi',
            text: 'Vertical spinner torque upgrades pay off in 4-bot brawls.',
            timestamp: now,
          },
        ],
      },
      {
        id: 'clan_volt',
        name: 'Volt Syndicate',
        tag: 'VOLT',
        motto: 'High-speed interceptors, Tesla arcs, and pneumatic ring-outs.',
        perkLabel: '+6% Top Speed & EMP Discharge Power',
        warPoints: 2180,
        memberCount: 15,
        wins: 54,
        tournamentSeed: 4,
        chat: [],
      },
      {
        id: 'clan_cryo',
        name: 'Cryo Breach',
        tag: 'CRYO',
        motto: 'Sub-zero nitrogen jets and low-friction drift mastery.',
        perkLabel: '+15% Freeze Duration & Ice Traction',
        warPoints: 1960,
        memberCount: 14,
        wins: 48,
        tournamentSeed: 5,
        chat: [],
      },
      {
        id: 'clan_nova',
        name: 'Nova Artillery',
        tag: 'NOVA',
        motto: 'Long-range Gauss rail spikes and dorsal plasma mortar barrages.',
        perkLabel: '+10% Artillery & Railgun Impact Force',
        warPoints: 1820,
        memberCount: 12,
        wins: 43,
        tournamentSeed: 6,
        chat: [],
      },
    ],
    seasonalEvents: [
      {
        id: 's5_aether_ascension',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Quantum Nexus Trial',
        description: 'Harness low-gravity physics and +40% energy recharge in the Aetheris Quantum Nexus to score 2 wins.',
        arenaId: 'aether_nexus',
        modifierLabel: 'Low Gravity · Twin EMP Rings',
        targetWins: 2,
        rewardScrap: 450,
        rewardSkillPoints: 2,
        badgeTitle: 'Quantum Vanguard',
        endsAt: '2026-12-01T00:00:00Z',
      },
      {
        id: 's5_foundry_clash',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Foundry Crucible Qualifier',
        description: 'Win 4 arena matches in Molten Foundry amidst floor saws and explosive fuel drums.',
        arenaId: 'foundry',
        modifierLabel: 'Floor Saws & Explosive Drums',
        targetWins: 4,
        rewardScrap: 550,
        rewardSkillPoints: 2,
        badgeTitle: 'Forge Master',
        endsAt: '2026-12-05T00:00:00Z',
      },
      {
        id: 's5_cryo_drift',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Sub-Zero Drift Masters',
        description: 'Adapt to low-friction ice physics in the Cryo Pit and score 6 total wins.',
        arenaId: 'cryo',
        modifierLabel: 'Low Traction Ice + Launch Pads',
        targetWins: 6,
        rewardScrap: 700,
        rewardSkillPoints: 3,
        badgeTitle: 'Sub-Zero Drift King',
        endsAt: '2026-12-10T00:00:00Z',
      },
      {
        id: 's5_scrapyard_survivor',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Acid Scrapyard Reclamation',
        description: 'Outlast corrosive acid pools and twin hydraulic crushers for 8 total wins.',
        arenaId: 'toxic_scrapyard',
        modifierLabel: 'Corrosive Acid Pool + Extra Crates',
        targetWins: 8,
        rewardScrap: 850,
        rewardSkillPoints: 3,
        badgeTitle: 'Scrapyard Warlord',
        endsAt: '2026-12-14T00:00:00Z',
      },
      {
        id: 's5_caldera_inferno',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Magma Caldera Siege',
        description: 'Conquer erupting thermal vents and quadruple saws in the Magma Caldera for 10 wins.',
        arenaId: 'volcano_caldera',
        modifierLabel: 'Erupting Lava Vents · Quad Saws',
        targetWins: 10,
        rewardScrap: 1000,
        rewardSkillPoints: 4,
        badgeTitle: 'Caldera Warlord',
        endsAt: '2026-12-18T00:00:00Z',
      },
      {
        id: 's5_cyber_overdrive',
        seasonName: 'Season 05 · Aetheris Ascension',
        title: 'Neon Cyber Grid Grand Prix',
        description: 'Dominate the high-grip synthwave circuit and reach 12 career arena victories.',
        arenaId: 'cyber_grid',
        modifierLabel: 'High Grip · +35% Energy · Rotors',
        targetWins: 12,
        rewardScrap: 1250,
        rewardSkillPoints: 5,
        badgeTitle: 'Aetheris Grand Champion',
        endsAt: '2026-12-25T00:00:00Z',
      },
    ],
  };
}

function loadStore(): PersistentStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as PersistentStore;
    }
  } catch {
    // Fallback to fresh seed
  }
  const initial = seedStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: PersistentStore) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // Ignore write failure in read-only edge envs
  }
}

const store = loadStore();
if (!Array.isArray(store.pvp)) store.pvp = [];

// Live PvP ladder: Elo between real pilots, recorded by the server when a room finishes
function pvpBoard(): PvpRecord[] {
  return [...(store.pvp ?? [])]
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
    .slice(0, 50);
}

function getPvpRecord(id: string, name: string, clanTag: string, botName: string): PvpRecord {
  let rec = store.pvp!.find((r) => r.id === id);
  if (!rec) {
    rec = {
      id,
      name,
      clanTag,
      botName,
      rating: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      kos: 0,
      streak: 0,
      bestStreak: 0,
      lastMatchAt: new Date().toISOString(),
    };
    store.pvp!.push(rec);
  }
  rec.name = name.slice(0, 24);
  rec.clanTag = clanTag.slice(0, 5).toUpperCase();
  rec.botName = botName.slice(0, 24);
  return rec;
}

function recordRoomResult(room: ArenaRoom): PvpMatchResult[] {
  const snap = room.snapshot;
  if (!snap) return [];
  const humans =
    room.participants ??
    Array.from(room.players.values()).map((p) => ({ id: p.id, name: p.name, clanTag: p.clanTag, botName: p.config.name }));
  const ranked = humans.length >= 2;
  const outcomeFor = (id: string): 'win' | 'loss' | 'draw' => {
    const bot = snap.bots.find((b) => b.id === id);
    if (snap.winnerId) return snap.winnerId === id ? 'win' : 'loss';
    if (snap.winningTeam !== undefined && snap.winningTeam !== null && bot) {
      return bot.team === snap.winningTeam ? 'win' : 'loss';
    }
    return 'draw';
  };
  const recs = humans.map((h) => ({
    h,
    rec: getPvpRecord(h.id, h.name, h.clanTag, h.botName),
    outcome: outcomeFor(h.id),
    bot: snap.bots.find((b) => b.id === h.id),
  }));
  const deltas = new Map<string, number>();
  if (ranked) {
    // Pairwise Elo across every pair of real pilots in the room
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const a = recs[i];
        const b = recs[j];
        const scoreA =
          a.outcome === b.outcome
            ? 0.5
            : a.outcome === 'win' || (a.outcome === 'draw' && b.outcome === 'loss')
              ? 1
              : 0;
        const expectedA = 1 / (1 + Math.pow(10, (b.rec.rating - a.rec.rating) / 400));
        const k = 32 / Math.max(1, recs.length - 1);
        const d = k * (scoreA - expectedA);
        deltas.set(a.h.id, (deltas.get(a.h.id) ?? 0) + d);
        deltas.set(b.h.id, (deltas.get(b.h.id) ?? 0) - d);
      }
    }
  }
  const results: PvpMatchResult[] = [];
  for (const r of recs) {
    const delta = Math.round(deltas.get(r.h.id) ?? 0);
    if (ranked) {
      r.rec.rating = Math.max(100, r.rec.rating + delta);
      if (r.outcome === 'win') {
        r.rec.wins += 1;
        r.rec.streak = Math.max(1, r.rec.streak + 1);
        r.rec.bestStreak = Math.max(r.rec.bestStreak, r.rec.streak);
      } else if (r.outcome === 'loss') {
        r.rec.losses += 1;
        r.rec.streak = Math.min(-1, r.rec.streak - 1);
      } else {
        r.rec.draws += 1;
        r.rec.streak = 0;
      }
      r.rec.kos += r.bot?.kos ?? 0;
      r.rec.lastMatchAt = new Date().toISOString();
    }
    results.push({ playerId: r.h.id, outcome: r.outcome, ratingDelta: ranked ? delta : 0, record: { ...r.rec }, ranked });
  }
  if (ranked) saveStore(store);
  return results;
}

// Presence: who is connected and what they are doing
const clientIdentity = new Map<WebSocket, { id: string; name: string; clanTag: string }>();
let presenceTimer: NodeJS.Timeout | null = null;
let wssRef: WebSocketServer | null = null;

function buildPresence(): OnlinePresence {
  const pilots: OnlinePresence['pilots'] = [];
  clientIdentity.forEach((ident, ws) => {
    const link = clientRoomMap.get(ws);
    const room = link ? rooms.get(link.roomId) : undefined;
    pilots.push({
      ...ident,
      status: room ? (room.snapshot ? 'fighting' : 'searching') : 'idle',
    });
  });
  return {
    online: wssRef ? wssRef.clients.size : pilots.length,
    searching: pilots.filter((p) => p.status === 'searching').length,
    fighting: pilots.filter((p) => p.status === 'fighting').length,
    pilots: pilots.slice(0, 40),
  };
}

function schedulePresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    broadcastAll({ type: 'presence', presence: buildPresence(), rooms: openRoomSummaries() });
  }, 400);
}

function broadcastAll(payload: unknown) {
  if (!wssRef) return;
  const encoded = JSON.stringify(payload);
  wssRef.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(encoded);
  });
}

function openRoomSummaries() {
  return Array.from(rooms.values())
    .filter((r) => !r.snapshot)
    .map(serializeRoomSummary);
}

// Multiplayer Room Management
interface RoomPlayer {
  id: string;
  name: string;
  clanTag: string;
  config: BotConfig;
  skills: SkillTree;
  ws: WebSocket;
  input: PlayerInputState;
}

interface ArenaRoom {
  id: string;
  mode: 'duel_1v1' | 'brawl_4bot';
  arenaId: ArenaId;
  durationSeconds: number;
  maxHumans: number;
  players: Map<string, RoomPlayer>;
  snapshot: ArenaSnapshot | null;
  interval: NodeJS.Timeout | null;
  createdAt: number;
  /** Real pilots locked in when the fight started (leavers still count). */
  participants?: Array<{ id: string; name: string; clanTag: string; botName: string }>;
}

const rooms = new Map<string, ArenaRoom>();
const clientRoomMap = new Map<WebSocket, { roomId: string; playerId: string }>();

function serializeRoomSummary(room: ArenaRoom) {
  return {
    id: room.id,
    mode: room.mode,
    arenaId: room.arenaId,
    playerCount: room.players.size,
    maxPlayers: room.maxHumans,
    inProgress: Boolean(room.snapshot),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      clanTag: p.clanTag,
      botName: p.config.name,
    })),
  };
}

function broadcastRoom(room: ArenaRoom, payload: unknown) {
  const encoded = JSON.stringify(payload);
  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(encoded);
    }
  });
}

function startRoomMatch(room: ArenaRoom) {
  if (room.snapshot) return;
  const roster: BotRosterTemplate[] = [];
  let teamIdx = 0;
  room.players.forEach((p) => {
    roster.push({
      id: p.id,
      name: p.name,
      clanTag: p.clanTag,
      config: p.config,
      skills: p.skills,
      isBot: false,
      team: teamIdx++,
    });
  });

  // Fill remaining slots up to target capacity with server-authoritative tiered AI bots
  const targetTotal = room.mode === 'duel_1v1' ? 2 : 4;
  let aiIdx = 0;
  while (roster.length < targetTotal) {
    const preset = AI_RIVAL_PRESETS[(aiIdx + 1) % AI_RIVAL_PRESETS.length];
    roster.push({
      id: `srv_ai_${room.id}_${aiIdx}`,
      name: preset.config.name,
      clanTag: preset.clanTag,
      botLevel: preset.botLevel,
      weightClassOverride: preset.weightClass,
      scaleOverride: preset.scale,
      hpMult: preset.hpMult,
      speedMult: preset.speedMult,
      dmgMult: preset.dmgMult,
      config: preset.config,
      skills: { ...DEFAULT_SKILLS, chassisReinforcement: 2, weaponTorque: 2 },
      isBot: true,
      team: teamIdx++,
    });
    aiIdx++;
  }

  room.snapshot = createInitialSnapshot('multiplayer', room.arenaId, roster, room.durationSeconds);
  room.participants = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    clanTag: p.clanTag,
    botName: p.config.name,
  }));
  schedulePresence();
  broadcastRoom(room, {
    type: 'match:started',
    roomId: room.id,
    snapshot: room.snapshot,
  });

  const dt = 1 / 30;
  room.interval = setInterval(() => {
    if (!room.snapshot) return;
    const inputs: Record<string, PlayerInputState> = {};
    room.players.forEach((p) => {
      inputs[p.id] = p.input;
    });
    stepArenaPhysics(room.snapshot, inputs, dt, 0.85);
    broadcastRoom(room, {
      type: 'match:snapshot',
      roomId: room.id,
      snapshot: room.snapshot,
    });

    if (room.snapshot.phase === 'finished') {
      if (room.interval) {
        clearInterval(room.interval);
        room.interval = null;
      }
      const results = recordRoomResult(room);
      broadcastRoom(room, { type: 'match:result', roomId: room.id, results });
      if (results.some((r) => r.ranked)) broadcastAll({ type: 'pvp:board', board: pvpBoard() });
      schedulePresence();
      setTimeout(() => {
        rooms.delete(room.id);
      }, 6000);
    }
  }, 33);
}

function removePlayerFromRoom(ws: WebSocket) {
  const link = clientRoomMap.get(ws);
  if (!link) return;
  clientRoomMap.delete(ws);

  const room = rooms.get(link.roomId);
  if (!room) return;
  room.players.delete(link.playerId);

  // Leaving a live fight is a forfeit: the bot powers down and counts as knocked out
  if (room.snapshot && room.snapshot.phase !== 'finished') {
    const bot = room.snapshot.bots.find((b) => b.id === link.playerId);
    if (bot && !bot.isDead) {
      bot.hp = 0;
      bot.isDead = true;
    }
  }

  if (room.players.size === 0) {
    if (room.interval) clearInterval(room.interval);
    rooms.delete(room.id);
  } else {
    broadcastRoom(room, {
      type: 'room:lobby',
      room: serializeRoomSummary(room),
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      leaderboard: store.leaderboard.slice(0, 25),
      pvpBoard: pvpBoard(),
      presence: buildPresence(),
      clans: store.clans,
      seasonalEvents: store.seasonalEvents,
      activeRooms: Array.from(rooms.values())
        .filter((r) => !r.snapshot)
        .map(serializeRoomSummary),
    });
  });

  app.get('/api/pvp', (_req, res) => {
    res.json({ board: pvpBoard(), presence: buildPresence() });
  });

  app.post('/api/profile/sync', (req, res) => {
    const body = req.body as {
      id?: string;
      name?: string;
      clanTag?: string;
      rating?: number;
      wins?: number;
      losses?: number;
      kos?: number;
      botConfig?: BotConfig;
      skills?: SkillTree;
    };
    if (!body?.id || !body?.name || !body?.botConfig) {
      res.status(400).json({ error: 'Invalid profile payload' });
      return;
    }
    const safeWeapons = getBotWeapons(body.botConfig);
    const safeStyles = getBotChassisStyles(body.botConfig);
    const safeBotConfig: BotConfig = {
      ...body.botConfig,
      weapon: safeWeapons[0],
      weapons: safeWeapons,
      chassis: safeStyles[0],
      chassisStyles: safeStyles,
      wheelLayout: body.botConfig.wheelLayout || '4wd_wide',
    };
    const stats = computeBotStats(safeBotConfig, body.skills || DEFAULT_SKILLS);
    const entry: LeaderboardEntry = {
      id: body.id,
      name: body.name.slice(0, 24),
      clanTag: (body.clanTag || 'SOLO').slice(0, 5).toUpperCase(),
      rating: Number(body.rating ?? 1200),
      wins: Number(body.wins ?? 0),
      losses: Number(body.losses ?? 0),
      kos: Number(body.kos ?? 0),
      botName: body.botConfig.name.slice(0, 24),
      weapon: body.botConfig.weapon,
      armor: body.botConfig.armor,
      powerScore: stats.powerScore,
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = store.leaderboard.findIndex((e) => e.id === entry.id);
    if (existingIdx >= 0) {
      store.leaderboard[existingIdx] = entry;
    } else {
      store.leaderboard.push(entry);
    }
    store.leaderboard.sort((a, b) => b.rating - a.rating || b.wins - a.wins);
    store.leaderboard = store.leaderboard.slice(0, 50);
    saveStore(store);

    res.json({ leaderboard: store.leaderboard.slice(0, 25) });
  });

  app.post('/api/clans', (req, res) => {
    const { name, tag, motto } = req.body as { name?: string; tag?: string; motto?: string };
    if (!name || !tag) {
      res.status(400).json({ error: 'Clan name and tag are required' });
      return;
    }
    const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    if (cleanTag.length < 2) {
      res.status(400).json({ error: 'Tag must be 2-4 alphanumeric characters' });
      return;
    }
    const newClan: ClanInfo = {
      id: `clan_${Date.now()}`,
      name: name.trim().slice(0, 28),
      tag: cleanTag,
      motto: (motto || 'Built for arena supremacy.').trim().slice(0, 80),
      warPoints: 500,
      memberCount: 1,
      wins: 0,
      tournamentSeed: store.clans.length + 1,
      chat: [],
    };
    store.clans.push(newClan);
    saveStore(store);
    res.json({ clan: newClan, clans: store.clans });
  });

  app.post('/api/clans/:id/join', (req, res) => {
    const { id } = req.params;
    const { previousClanId } = req.body as { previousClanId?: string | null };
    const target = store.clans.find((c) => c.id === id);
    if (!target) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }
    if (previousClanId && previousClanId !== id) {
      const prev = store.clans.find((c) => c.id === previousClanId);
      if (prev && prev.memberCount > 1) prev.memberCount -= 1;
    }
    if (previousClanId !== id) {
      target.memberCount += 1;
    }
    saveStore(store);
    res.json({ clan: target, clans: store.clans });
  });

  app.post('/api/clans/:id/tournament', (req, res) => {
    const { id } = req.params;
    const { won, warPointsDelta } = req.body as { won?: boolean; warPointsDelta?: number };
    const target = store.clans.find((c) => c.id === id);
    if (!target) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }
    if (won) target.wins += 1;
    target.warPoints += Number(warPointsDelta ?? (won ? 120 : 30));
    store.clans.sort((a, b) => b.warPoints - a.warPoints);
    store.clans.forEach((c, idx) => {
      c.tournamentSeed = idx + 1;
    });
    saveStore(store);
    res.json({ clans: store.clans });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wssRef = wss;
  wss.on('connection', (ws) => {
    schedulePresence();
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          roomId?: string;
          playerId?: string;
          name?: string;
          clanTag?: string;
          clanId?: string;
          text?: string;
          mode?: 'duel_1v1' | 'brawl_4bot';
          arenaId?: ArenaId;
          durationSeconds?: number;
          config?: BotConfig;
          skills?: SkillTree;
          input?: PlayerInputState;
        };

        if (msg.type === 'hello' && msg.playerId && msg.name) {
          clientIdentity.set(ws, {
            id: msg.playerId.slice(0, 64),
            name: msg.name.slice(0, 24),
            clanTag: (msg.clanTag || 'SOLO').slice(0, 5).toUpperCase(),
          });
          schedulePresence();
          return;
        }

        if (msg.type === 'match:find' && msg.playerId && msg.config) {
          removePlayerFromRoom(ws);
          if (msg.name) {
            clientIdentity.set(ws, {
              id: msg.playerId.slice(0, 64),
              name: msg.name.slice(0, 24),
              clanTag: (msg.clanTag || 'SOLO').slice(0, 5).toUpperCase(),
            });
          }
          const mode = msg.mode === 'brawl_4bot' ? 'brawl_4bot' : 'duel_1v1';
          const maxHumans = mode === 'duel_1v1' ? 2 : 4;
          const arenaId: ArenaId = msg.arenaId && msg.arenaId in ARENA_CATALOG ? msg.arenaId : 'foundry';
          const rawDur = Number(msg.durationSeconds ?? 180);
          const durationSeconds = [90, 150, 180, 300].includes(rawDur) ? rawDur : 180;

          // Join the requested open room, else any waiting room with matching mode
          const wanted = msg.roomId ? rooms.get(msg.roomId) : undefined;
          let room =
            wanted && !wanted.snapshot && wanted.players.size < wanted.maxHumans
              ? wanted
              : Array.from(rooms.values()).find(
                  (r) => !r.snapshot && r.mode === mode && r.players.size < r.maxHumans,
                );
          if (!room) {
            const roomId = `arena_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            room = {
              id: roomId,
              mode,
              arenaId,
              durationSeconds,
              maxHumans,
              players: new Map(),
              snapshot: null,
              interval: null,
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          }

          const pWeapons = getBotWeapons(msg.config);
          const pStyles = getBotChassisStyles(msg.config);
          room.players.set(msg.playerId, {
            id: msg.playerId,
            name: (msg.name || 'Pilot').slice(0, 24),
            clanTag: (msg.clanTag || 'SOLO').slice(0, 5),
            config: {
              ...msg.config,
              weapon: pWeapons[0],
              weapons: pWeapons,
              chassis: pStyles[0],
              chassisStyles: pStyles,
              wheelLayout: msg.config.wheelLayout || '4wd_wide',
            },
            skills: msg.skills || DEFAULT_SKILLS,
            ws,
            input: { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false },
          });
          clientRoomMap.set(ws, { roomId: room.id, playerId: msg.playerId });

          broadcastRoom(room, {
            type: 'room:lobby',
            room: serializeRoomSummary(room),
          });

          if (room.players.size >= room.maxHumans) {
            startRoomMatch(room);
          }
          schedulePresence();
        } else if (msg.type === 'match:start_now' && msg.roomId) {
          const room = rooms.get(msg.roomId);
          if (room && !room.snapshot) {
            startRoomMatch(room);
          }
        } else if (msg.type === 'match:input' && msg.roomId && msg.playerId && msg.input) {
          const room = rooms.get(msg.roomId);
          const player = room?.players.get(msg.playerId);
          if (player) {
            player.input = msg.input;
          }
        } else if (msg.type === 'match:leave') {
          removePlayerFromRoom(ws);
          schedulePresence();
        } else if (msg.type === 'clan:chat' && msg.clanId && msg.name && msg.text) {
          const clan = store.clans.find((c) => c.id === msg.clanId);
          if (clan) {
            const chatMsg = {
              id: `msg_${Date.now()}`,
              sender: msg.name.slice(0, 24),
              text: msg.text.trim().slice(0, 180),
              timestamp: new Date().toISOString(),
            };
            clan.chat = [...clan.chat.slice(-29), chatMsg];
            saveStore(store);

            const payload = JSON.stringify({
              type: 'clan:chat_message',
              clanId: clan.id,
              message: chatMsg,
            });
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            });
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      clientIdentity.delete(ws);
      schedulePresence();
      removePlayerFromRoom(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server },
        hmr: process.env.DISABLE_HMR !== 'true' ? { server } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ForgeClash server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
