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
  type ArenaId,
  type ArenaSnapshot,
  type BotConfig,
  type ClanInfo,
  computeBotStats,
  DEFAULT_SKILLS,
  getBotChassisStyles,
  getBotWeapons,
  type LeaderboardEntry,
  type PlayerInputState,
  type SeasonalEvent,
  type SkillTree,
  ARENA_CATALOG,
} from './src/shared/types.ts';
import { SEASON_EVENTS } from './src/shared/season.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.join(DATA_DIR, 'arena-store.json');

interface PersistentStore {
  leaderboard: LeaderboardEntry[];
  clans: ClanInfo[];
  seasonalEvents: SeasonalEvent[];
}

function seedStore(): PersistentStore {
  const now = new Date().toISOString();
  return {
    leaderboard: [
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
        armor: 'steel',
        powerScore: 812,
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
        powerScore: 785,
        updatedAt: now,
      },
      {
        id: 'seed_3',
        name: 'Devon Mercer',
        clanTag: 'VOLT',
        rating: 1690,
        wins: 29,
        losses: 12,
        kos: 22,
        botName: 'Arc Catapult',
        weapon: 'flipper',
        armor: 'kevlar',
        powerScore: 740,
        updatedAt: now,
      },
      {
        id: 'seed_4',
        name: 'Sora Lindqvist',
        clanTag: 'CRYO',
        rating: 1620,
        wins: 24,
        losses: 14,
        kos: 19,
        botName: 'Glacier Saw',
        weapon: 'hbar',
        armor: 'ceramic',
        powerScore: 718,
        updatedAt: now,
      },
      {
        id: 'seed_5',
        name: 'Marcus Cole',
        clanTag: 'IRON',
        rating: 1545,
        wins: 19,
        losses: 13,
        kos: 14,
        botName: 'Foundry Ram',
        weapon: 'vspinner',
        armor: 'steel',
        powerScore: 690,
        updatedAt: now,
      },
    ],
    clans: [
      {
        id: 'clan_iron',
        name: 'Iron Vanguard',
        tag: 'IRON',
        motto: 'Heavy steel hulls and relentless frontal pressure.',
        warPoints: 2480,
        memberCount: 18,
        wins: 64,
        tournamentSeed: 1,
        chat: [
          {
            id: 'c1',
            sender: 'Kaelen Vance',
            text: 'Season 05 Storm bracket opens tonight. Check your flank armor.',
            timestamp: now,
          },
        ],
      },
      {
        id: 'clan_apex',
        name: 'Apex Torque',
        tag: 'APEX',
        motto: 'Maximum flywheel RPM and surgical rear-deck strikes.',
        warPoints: 2290,
        memberCount: 15,
        wins: 58,
        tournamentSeed: 2,
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
        motto: 'High-speed wedge interceptors and pneumatic ring-outs.',
        warPoints: 1940,
        memberCount: 12,
        wins: 47,
        tournamentSeed: 3,
        chat: [],
      },
      {
        id: 'clan_cryo',
        name: 'Cryo Breach',
        tag: 'CRYO',
        motto: 'Low-friction drift control and horizontal bar mastery.',
        warPoints: 1710,
        memberCount: 11,
        wins: 39,
        tournamentSeed: 4,
        chat: [],
      },
    ],
    seasonalEvents: SEASON_EVENTS,
  };
}

function loadStore(): PersistentStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PersistentStore;
      // Roll stored data forward to the current season's event list
      parsed.seasonalEvents = SEASON_EVENTS;
      return parsed;
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
      clans: store.clans,
      seasonalEvents: store.seasonalEvents,
      activeRooms: Array.from(rooms.values())
        .filter((r) => !r.snapshot)
        .map(serializeRoomSummary),
    });
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

  wss.on('connection', (ws) => {
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

        if (msg.type === 'match:find' && msg.playerId && msg.config) {
          removePlayerFromRoom(ws);
          const mode = msg.mode === 'brawl_4bot' ? 'brawl_4bot' : 'duel_1v1';
          const maxHumans = mode === 'duel_1v1' ? 2 : 4;
          const arenaId: ArenaId = msg.arenaId && ARENA_CATALOG[msg.arenaId] ? msg.arenaId : 'foundry';
          const rawDur = Number(msg.durationSeconds ?? 180);
          const durationSeconds = [90, 150, 180, 300].includes(rawDur) ? rawDur : 180;

          // Find waiting room with matching mode
          let room = Array.from(rooms.values()).find(
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
