import {
  type FunctionDeclaration,
  GoogleGenAI,
  type LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';
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
  app.use(express.json({ limit: '25mb' }));

  const createGenAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }
    return new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  interface MediaHistoryRecord {
    id: number;
    kind: string;
    title: string;
    prompt: string;
    modelUsed: string;
    createdAt: string;
  }
  const mediaHistoryStore: MediaHistoryRecord[] = [];
  let mediaIdSeq = 1;
  const recordMediaHistory = (kind: string, title: string, prompt: string, modelUsed: string) => {
    mediaHistoryStore.unshift({
      id: mediaIdSeq++,
      kind,
      title: title.slice(0, 64),
      prompt: prompt.slice(0, 240),
      modelUsed,
      createdAt: new Date().toISOString(),
    });
    if (mediaHistoryStore.length > 30) mediaHistoryStore.pop();
  };

  app.get('/api/ai/history', (_req, res) => {
    res.json({ items: mediaHistoryStore });
  });

  // Lyria 3 AI Music Generation (lyria-3-clip-preview for 30s clips, lyria-3-pro-preview for full tracks)
  app.post('/api/ai/music', async (req, res) => {
    const { prompt, mode, title, imageBase64, imageMimeType } = (req.body || {}) as {
      prompt?: string;
      mode?: 'clip' | 'full';
      title?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Music prompt is required.' });
      return;
    }
    const model = mode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    const trackTitle = String(title || 'Custom Arena Anthem').trim().slice(0, 60);

    try {
      const ai = createGenAiClient();
      const stripDataUrl = (raw: string) => {
        const idx = raw.indexOf('base64,');
        return idx >= 0 ? raw.slice(idx + 7) : raw;
      };

      const contents = imageBase64
        ? {
            parts: [
              { text: cleanPrompt },
              {
                inlineData: {
                  data: stripDataUrl(imageBase64),
                  mimeType: imageMimeType || 'image/jpeg',
                },
              },
            ],
          }
        : cleanPrompt;

      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({ error: 'No audio stream returned from Lyria music model.' });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
      recordMediaHistory('music', trackTitle, cleanPrompt, model);

      res.json({
        audioDataUrl,
        lyrics: lyrics.trim(),
        model,
        title: trackTitle,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lyria music generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // AI Bot Concept Art & Livery Image Generation / Editing
  app.post('/api/ai/image', async (req, res) => {
    const {
      prompt,
      aspectRatio = '16:9',
      imageSize = '1K',
      baseImageBase64,
      baseImageMimeType = 'image/png',
      useSearch = false,
      title = 'Bot Concept Art',
    } = (req.body || {}) as {
      prompt?: string;
      aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
      imageSize?: '1K' | '2K' | '4K';
      baseImageBase64?: string;
      baseImageMimeType?: string;
      useSearch?: boolean;
      title?: string;
    };

    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Image prompt is required.' });
      return;
    }

    const upgradeToHigh = imageSize !== '1K' || Boolean(useSearch);
    const model = upgradeToHigh ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    try {
      const ai = createGenAiClient();
      const stripDataUrl = (raw: string) => {
        const idx = raw.indexOf('base64,');
        return idx >= 0 ? raw.slice(idx + 7) : raw;
      };

      const parts: Array<
        | { text: string }
        | { inlineData: { data: string; mimeType: string } }
      > = [];

      if (baseImageBase64) {
        parts.push({
          inlineData: {
            data: stripDataUrl(baseImageBase64),
            mimeType: baseImageMimeType || 'image/png',
          },
        });
      }
      parts.push({ text: cleanPrompt });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            ...(upgradeToHigh ? { imageSize } : {}),
          },
          ...(useSearch && upgradeToHigh
            ? {
                tools: [
                  {
                    googleSearch: {
                      searchTypes: {
                        webSearch: {},
                        imageSearch: {},
                      },
                    },
                  },
                ],
              }
            : {}),
        },
      });

      let imageUrl = '';
      let textOut = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data && !imageUrl) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOut += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({ error: 'No image returned from Gemini image model.' });
        return;
      }

      recordMediaHistory('image', String(title), cleanPrompt, model);
      res.json({ imageUrl, text: textOut.trim(), model });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // Omni Flash Video Generation & Image-to-Video Highlight Animation (gemini-omni-1.2-flash)
  app.post('/api/ai/video', async (req, res) => {
    const {
      prompt,
      imageBase64,
      imageMimeType = 'image/png',
      aspectRatio = '16:9',
      duration = '5s',
      title = 'Combat Highlight Video',
    } = (req.body || {}) as {
      prompt?: string;
      imageBase64?: string;
      imageMimeType?: string;
      aspectRatio?: '16:9' | '9:16';
      duration?: '5s' | '10s';
      title?: string;
    };

    const cleanPrompt =
      String(prompt || '').trim() ||
      'Dynamic combat robot spinning its weapon on the steel arena floor with sparks flying.';

    try {
      const ai = createGenAiClient();
      const stripDataUrl = (raw: string) => {
        const idx = raw.indexOf('base64,');
        return idx >= 0 ? raw.slice(idx + 7) : raw;
      };

      const input = imageBase64
        ? [
            {
              type: 'image' as const,
              mime_type: imageMimeType || 'image/png',
              data: stripDataUrl(imageBase64),
            },
            {
              type: 'text' as const,
              text: cleanPrompt,
            },
          ]
        : cleanPrompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio,
            duration,
            resolution: '720p',
          },
        },
        { timeout: 300000 },
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({ error: 'No video data returned from Omni Flash.' });
        return;
      }
      const mimeType = videoPart.mime_type || 'video/mp4';
      const videoDataUrl = `data:${mimeType};base64,${videoPart.data}`;
      recordMediaHistory('video', String(title), cleanPrompt, 'gemini-omni-1.2-flash');
      res.json({ videoDataUrl, mimeType });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video animation failed.';
      res.status(500).json({ error: message });
    }
  });

  // Google Search Grounded Combat Robotics Intel (gemini-4-hydrogen)
  app.post('/api/ai/search-intel', async (req, res) => {
    const { query } = (req.body || {}) as { query?: string };
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    try {
      const ai = createGenAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: cleanQuery,
        config: {
          systemInstruction:
            'You are the Chief Combat Robotics Engineer for Aetheris Bot Wars. Provide concise, accurate mechanical engineering and combat robotics insights.',
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: Array<{ uri: string; title: string }> = [];
      for (const c of chunks) {
        const web = (c as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri) {
          sources.push({
            uri: web.uri,
            title: web.title || web.uri,
          });
        }
      }

      res.json({
        text: response.text ?? '',
        sources,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search grounding failed.';
      res.status(500).json({ error: message });
    }
  });

  // Google Maps Grounded Robotics & Fabrication Scouting (gemini-4-hydrogen)
  app.post('/api/ai/maps-scouting', async (req, res) => {
    const { query, lat, lng } = (req.body || {}) as {
      query?: string;
      lat?: number;
      lng?: number;
    };
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      res.status(400).json({ error: 'Maps query is required.' });
      return;
    }

    try {
      const ai = createGenAiClient();
      const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng);
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: cleanQuery,
        config: {
          tools: [{ googleMaps: {} }],
          ...(hasCoords
            ? {
                toolConfig: {
                  retrievalConfig: {
                    latLng: {
                      latitude: lat!,
                      longitude: lng!,
                    },
                  },
                },
              }
            : {}),
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places: Array<{ uri: string; title: string; reviews: string[] }> = [];
      for (const c of chunks) {
        const maps = (
          c as {
            maps?: {
              uri?: string;
              title?: string;
              placeAnswerSources?: { reviewSnippets?: Array<{ text?: string }> };
            };
          }
        ).maps;
        if (maps?.uri) {
          const reviews =
            maps.placeAnswerSources?.reviewSnippets
              ?.map((r) => r.text || '')
              .filter(Boolean) ?? [];
          places.push({
            uri: maps.uri,
            title: maps.title || 'View on Google Maps',
            reviews,
          });
        }
      }

      res.json({
        text: response.text ?? '',
        places,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Maps grounding failed.';
      res.status(500).json({ error: message });
    }
  });

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

  app.post('/api/admin/verify', (req, res) => {
    const code = String((req.body as { code?: string })?.code || '').trim();
    res.json({ valid: code === '9822' });
  });

  // Server-side Gemini 3.8 Human Broadcast Voice Commentary TTS with in-memory LRU cache
  const ttsCache = new Map<string, string>();

  const pcm16ToWavBuffer = (pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer => {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  };

  const ensureWavBase64 = (base64Audio: string): string => {
    const buf = Buffer.from(base64Audio, 'base64');
    if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF') {
      return base64Audio;
    }
    return pcm16ToWavBuffer(buf, 24000, 1, 16).toString('base64');
  };

  const synthesizeSpeechViaLive = async (
    ai: GoogleGenAI,
    script: string,
    voiceName: 'Puck' | 'Kore' | 'Zephyr',
    personaGuide: string,
  ): Promise<Buffer> => {
    return await new Promise<Buffer>((resolve, reject) => {
      const pcmChunks: Buffer[] = [];
      let settled = false;
      let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          liveSession?.close();
        } catch {
          // Ignore close errors
        }
        if (err) {
          reject(err);
        } else if (pcmChunks.length === 0) {
          reject(new Error('Gemini Live TTS returned empty audio stream'));
        } else {
          resolve(Buffer.concat(pcmChunks));
        }
      };

      const timeoutId = setTimeout(() => {
        if (pcmChunks.length > 0) {
          finish();
        } else {
          finish(new Error('Gemini Live TTS timed out'));
        }
      }, 14000);

      ai.live
        .connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction: `${personaGuide} Speak the user's exact broadcast line verbatim with authentic human broadcast energy, natural pacing, and emotion. Output only the spoken line.`,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  pcmChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                }
              }
              if (content?.turnComplete) {
                finish();
              }
            },
            onerror: (err: unknown) => {
              const detail =
                err instanceof Error
                  ? err.message
                  : typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as { message?: unknown }).message)
                    : JSON.stringify(err);
              finish(new Error(`Gemini Live TTS error: ${detail}`));
            },
            onclose: (ev?: { code?: number; reason?: string }) => {
              if (!settled) {
                if (pcmChunks.length > 0) finish();
                else finish(new Error(`Gemini Live TTS closed (${ev?.code ?? 'no-code'}: ${ev?.reason || 'no-reason'})`));
              }
            },
          },
        })
        .then((session) => {
          liveSession = session;
          if (settled) {
            try {
              session.close();
            } catch {
              // Ignore
            }
            return;
          }
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: script }],
              },
            ],
            turnComplete: true,
          });
        })
        .catch((err) => {
          finish(err instanceof Error ? err : new Error(`Failed to open Gemini Live TTS session: ${String(err)}`));
        });
    });
  };

  app.post('/api/tts/commentary', async (req, res) => {
    const { text, speaker } = (req.body || {}) as { text?: string; speaker?: 'rex' | 'kira' };
    const cleanText = String(text || '').trim().slice(0, 260);
    if (!cleanText) {
      res.status(400).json({ error: 'Commentary text is required' });
      return;
    }
    const voiceRole = speaker === 'kira' ? 'kira' : 'rex';
    const cacheKey = `${voiceRole}:${cleanText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
      return;
    }

    try {
      const ai = createGenAiClient();
      const voiceName: 'Puck' | 'Kore' = voiceRole === 'rex' ? 'Puck' : 'Kore';
      const stylePrompt =
        voiceRole === 'rex'
          ? 'Live sports play-by-play arena announcer, natural, warm, excited, authentic human broadcast voice'
          : 'Live robotics combat analyst and color commentator, natural, expressive, conversational human voice';

      let wavBase64 = '';
      let primaryErr = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const rawAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (rawAudio) {
          wavBase64 = ensureWavBase64(rawAudio);
        }
      } catch (e) {
        primaryErr = e instanceof Error ? e.message : String(e);
      }

      if (!wavBase64) {
        try {
          const pcm = await synthesizeSpeechViaLive(ai, cleanText, voiceName, stylePrompt);
          wavBase64 = pcm16ToWavBuffer(pcm, 24000, 1, 16).toString('base64');
        } catch (liveErr) {
          const liveMsg = liveErr instanceof Error ? liveErr.message : String(liveErr);
          throw new Error(`TTS failed | primary: ${primaryErr} | live: ${liveMsg}`);
        }
      }

      if (ttsCache.size >= 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, wavBase64);

      res.json({ audioBase64: wavBase64, mimeType: 'audio/wav' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tts/dialogue', async (req, res) => {
    const { rexText, kiraText } = req.body as {
      rexText?: string;
      kiraText?: string;
    };
    const cleanRex = String(rexText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    const cleanKira = String(kiraText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);

    if (!cleanRex && !cleanKira) {
      res.status(400).json({ error: 'rexText or kiraText is required' });
      return;
    }

    const cacheKey = `duo:${cleanRex}||${cleanKira}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ audioBase64: cached, mimeType: 'audio/wav' });
      return;
    }

    try {
      const ai = createGenAiClient();

      let wavBase64 = '';
      let primaryErr = '';
      try {
        const parts: Array<{
          text: string;
          speechMetadata: { speaker: string; style: string };
        }> = [];
        if (cleanRex) {
          parts.push({
            text: `Rex: ${cleanRex}\n`,
            speechMetadata: {
              speaker: 'Rex',
              style:
                'Live sports play-by-play arena host, natural, warm, energetic, conversational human broadcast voice',
            },
          });
        }
        if (cleanKira) {
          parts.push({
            text: `Kira: ${cleanKira}`,
            speechMetadata: {
              speaker: 'Kira',
              style:
                'Live robotics combat engineer and color analyst, natural, sharp, insightful, conversational human broadcast voice',
            },
          });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'Rex',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Puck' },
                    },
                  },
                  {
                    speaker: 'Kira',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                  },
                ],
              },
            },
          },
        });

        const rawAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (rawAudio) {
          wavBase64 = ensureWavBase64(rawAudio);
        }
      } catch (e) {
        primaryErr = e instanceof Error ? e.message : String(e);
      }

      if (!wavBase64) {
        try {
          const tracks = await Promise.all([
            cleanRex
              ? synthesizeSpeechViaLive(
                  ai,
                  cleanRex,
                  'Puck',
                  'You are Rex Vance, energetic warm human sports play-by-play host.',
                )
              : Promise.resolve(Buffer.alloc(0)),
            cleanKira
              ? synthesizeSpeechViaLive(
                  ai,
                  cleanKira,
                  'Kore',
                  'You are Kira Volt, sharp, expressive human robotics color analyst.',
                )
              : Promise.resolve(Buffer.alloc(0)),
          ]);
          const silenceGap = cleanRex && cleanKira ? Buffer.alloc(Math.floor(24000 * 0.16) * 2) : Buffer.alloc(0);
          const combinedPcm = Buffer.concat([tracks[0], silenceGap, tracks[1]]);
          if (combinedPcm.length === 0) {
            res.status(502).json({ error: 'No audio returned from Gemini voice synthesis' });
            return;
          }
          wavBase64 = pcm16ToWavBuffer(combinedPcm, 24000, 1, 16).toString('base64');
        } catch (liveErr) {
          const liveMsg = liveErr instanceof Error ? liveErr.message : String(liveErr);
          throw new Error(`Duo TTS failed | primary: ${primaryErr} | live: ${liveMsg}`);
        }
      }

      if (ttsCache.size >= 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, wavBase64);

      res.json({ audioBase64: wavBase64, mimeType: 'audio/wav' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Multi-speaker TTS failed';
      res.status(500).json({ error: message });
    }
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
  const liveVoiceWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/live-voice') {
      liveVoiceWss.handleUpgrade(request, socket, head, (ws) => {
        liveVoiceWss.emit('connection', ws, request);
      });
    }
  });

  // Real-time bidirectional voice conversation via Gemini Live API (gemini-3.8-live)
  const liveVoiceTools: FunctionDeclaration[] = [
    {
      name: 'configureBotLoadout',
      description:
        'Update the player robot loadout in the 3D Hangar: equip weapons, change chassis, armor, paint color, or generate a random bot name.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          weapon: {
            type: Type.STRING,
            description:
              'Optional weapon ID to equip (e.g. vspinner, hbar, body_spinner, sawblade, drum, flipper, hammer, crush_jaw, flame, cryo_jet, tesla, laser, railgun, mortar, lance, magnet, missiles, lightning_strike, bomb_drop)',
          },
          chassis: {
            type: Type.STRING,
            description:
              'Optional chassis ID (e.g. wedge, juggernaut, shell_spinner, spider, hover_disc, katana, phantom, viper, goliath, twin_fang, ufo, scorpion)',
          },
          armor: {
            type: Type.STRING,
            description:
              'Optional armor ID (e.g. titanium, reactive_era, aetherium, tungsten, nanoweave, kevlar, magma_plate, cryo_alloy)',
          },
          randomizeName: {
            type: Type.BOOLEAN,
            description: 'Set true to generate a random bot name.',
          },
        },
      },
    },
    {
      name: 'controlThreeScene',
      description:
        'Control the 3D Three.js scene inspector, exploded view separation, studio lighting rig, or launch a live battle in an arena.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          explodedRatio: {
            type: Type.NUMBER,
            description: 'Exploded 3D view separation from 0 (assembled) to 1 (fully exploded).',
          },
          lightingPreset: {
            type: Type.STRING,
            description: '3D studio lighting preset: arena, cyber_neon, golden_forge, or cryo_lab.',
          },
          arenaId: {
            type: Type.STRING,
            description:
              'Optional arena ID to switch to (foundry, cryo, reactor, colosseum, aether_nexus, toxic_scrapyard, volcano_caldera, cyber_grid, skyforge, storm).',
          },
          startBattleMode: {
            type: Type.STRING,
            description: 'Optional battle mode to start immediately: practice, duel_1v1, brawl_4bot, or survival.',
          },
        },
      },
    },
  ];

  liveVoiceWss.on('connection', (clientWs, request) => {
    const reqUrl = new URL(request.url || '/live-voice', 'http://localhost');
    const persona = reqUrl.searchParams.get('persona') || 'engineer';
    const botSummary = reqUrl.searchParams.get('context') || 'Aetheris custom combat robot';

    const voiceName =
      persona === 'rex' ? 'Puck' : persona === 'kira' ? 'Kore' : 'Zephyr';

    const personaInstruction =
      persona === 'rex'
        ? `You are Rex Vance, the energetic, human-sounding play-by-play host of Aetheris Bot Wars. You are talking live on voice comms with the pilot. Current pilot telemetry: ${botSummary}. Keep responses punchy, enthusiastic, and natural (1-3 sentences). You can also call configureBotLoadout or controlThreeScene when the pilot asks to change weapons, inspect the 3D exploded view, change lighting, or start a battle.`
        : persona === 'kira'
          ? `You are Kira Volt, the sharp combat robotics engineer and tactical analyst for Aetheris Bot Wars. Current pilot telemetry: ${botSummary}. Give crisp, insightful tactical advice on weapon counters, armor seams, drift angles, and arena hazards in 1-3 natural spoken sentences. Call configureBotLoadout or controlThreeScene whenever the pilot asks to adjust their bot or 3D scene.`
          : `You are Chief Forge Engineer Orion, the pilot's real-time AI Pit Chief and 3D Hangar Voice Copilot in Aetheris Bot Wars. Current pilot telemetry: ${botSummary}. Speak naturally and concisely (1-3 sentences), helping the pilot tune their bot, inspect the 3D exploded view, switch studio lighting, or deploy into battle using your tools.`;

    let sessionClosed = false;
    let activeSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;

    const sessionPromise = (async () => {
      try {
        const ai = createGenAiClient();
        const session = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: liveVoiceTools }],
            systemInstruction: personaInstruction,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'input_transcript',
                    text: content.inputTranscription.text,
                  }),
                );
              }
              if (content?.outputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'output_transcript',
                    text: content.outputTranscription.text,
                  }),
                );
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'audio',
                      audio: part.inlineData.data,
                    }),
                  );
                }
              }
              if (content?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
              if (content?.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'turn_complete' }));
              }
              for (const call of message.toolCall?.functionCalls ?? []) {
                clientWs.send(
                  JSON.stringify({
                    type: 'tool_call',
                    id: call.id,
                    name: call.name,
                    args: call.args || {},
                  }),
                );
                session.sendToolResponse({
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: { status: 'applied_in_client_3d_scene' },
                    },
                  ],
                });
              }
            },
            onerror: (err: unknown) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                const msg = err instanceof Error ? err.message : 'Gemini Live session error';
                clientWs.send(JSON.stringify({ type: 'error', error: msg }));
              }
            },
            onclose: () => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'closed' }));
              }
            },
          },
        });

        activeSession = session;
        if (sessionClosed) {
          session.close();
          return null;
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'ready', voiceName, persona }));
        }
        return session;
      } catch (err) {
        if (clientWs.readyState === WebSocket.OPEN) {
          const msg = err instanceof Error ? err.message : 'Failed to connect to Gemini Live API';
          clientWs.send(JSON.stringify({ type: 'error', error: msg }));
        }
        return null;
      }
    })();

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          audio?: string;
          text?: string;
        };
        sessionPromise.then((session) => {
          if (!session || sessionClosed) return;
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (msg.text) {
            session.sendRealtimeInput({
              text: msg.text,
            });
          }
        });
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      sessionClosed = true;
      if (activeSession) {
        try {
          activeSession.close();
        } catch {
          // Ignore close error
        }
      }
    });
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
          seat?: 1 | 2;
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

        if (msg.type === 'admin:join_seat' && (msg.seat === 1 || msg.seat === 2) && msg.config) {
          removePlayerFromRoom(ws);
          const seatId = msg.seat === 1 ? 'admin_p1' : 'admin_p2';
          const otherSeatId = msg.seat === 1 ? 'admin_p2' : 'admin_p1';
          const arenaId: ArenaId = msg.arenaId && msg.arenaId in ARENA_CATALOG ? msg.arenaId : 'foundry';
          const rawDur = Number(msg.durationSeconds ?? 180);
          const durationSeconds = [90, 150, 180, 300].includes(rawDur) ? rawDur : 180;
          const roomId = 'admin_duel_room';

          let room = rooms.get(roomId);
          if (room && room.snapshot && room.snapshot.phase === 'finished') {
            if (room.interval) clearInterval(room.interval);
            rooms.delete(roomId);
            room = undefined;
          }

          if (!room) {
            room = {
              id: roomId,
              mode: 'duel_1v1',
              arenaId,
              durationSeconds,
              maxHumans: 2,
              players: new Map(),
              snapshot: null,
              interval: null,
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          } else if (msg.arenaId && msg.arenaId in ARENA_CATALOG && room.players.size === 0) {
            room.arenaId = arenaId;
          }

          const pWeapons = getBotWeapons(msg.config);
          const pStyles = getBotChassisStyles(msg.config);
          const safeConfig: BotConfig = {
            ...msg.config,
            weapon: pWeapons[0] ?? msg.config.weapon,
            weapons: pWeapons,
            chassis: pStyles[0],
            chassisStyles: pStyles,
            wheelLayout: msg.config.wheelLayout || '4wd_wide',
          };

          room.players.set(seatId, {
            id: seatId,
            name: (msg.name || `Player ${msg.seat}`).slice(0, 24),
            clanTag: (msg.clanTag || `P${msg.seat}`).slice(0, 5),
            config: safeConfig,
            skills: msg.skills || DEFAULT_SKILLS,
            ws,
            input: { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false, drift: false },
          });
          clientRoomMap.set(ws, { roomId: room.id, playerId: seatId });

          // Always build/rebuild a fresh 2-player snapshot when a seat joins or resets so both P1 and P2 start cleanly
          if (room.interval) {
            clearInterval(room.interval);
            room.interval = null;
          }
          const p1 = room.players.get('admin_p1');
          const p2 = room.players.get('admin_p2');
          const fallbackPreset = AI_RIVAL_PRESETS[2];
          const roster: BotRosterTemplate[] = [
            p1
              ? {
                  id: 'admin_p1',
                  name: p1.name,
                  clanTag: p1.clanTag,
                  config: p1.config,
                  skills: p1.skills,
                  isBot: false,
                  team: 0,
                }
              : {
                  id: 'admin_p1',
                  name: 'Waiting Player 1 (AI)',
                  clanTag: 'P1',
                  config: fallbackPreset.config,
                  skills: DEFAULT_SKILLS,
                  isBot: true,
                  team: 0,
                },
            p2
              ? {
                  id: 'admin_p2',
                  name: p2.name,
                  clanTag: p2.clanTag,
                  config: p2.config,
                  skills: p2.skills,
                  isBot: false,
                  team: 1,
                }
              : {
                  id: 'admin_p2',
                  name: 'Waiting Player 2 (AI)',
                  clanTag: 'P2',
                  config: fallbackPreset.config,
                  skills: DEFAULT_SKILLS,
                  isBot: true,
                  team: 1,
                },
          ];

          room.arenaId = arenaId;
          room.snapshot = createInitialSnapshot('multiplayer', room.arenaId, roster, room.durationSeconds);
          room.participants = Array.from(room.players.values()).map((p) => ({
            id: p.id,
            name: p.name,
            clanTag: p.clanTag,
            botName: p.config.name,
          }));

          broadcastRoom(room, {
            type: 'match:started',
            roomId: room.id,
            assignedPlayerId: seatId,
            otherSeatConnected: room.players.has(otherSeatId),
            snapshot: room.snapshot,
          });

          const dt = 1 / 30;
          room.interval = setInterval(() => {
            if (!room || !room.snapshot) return;
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
              schedulePresence();
            }
          }, 33);

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
