import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { clans, mediaCreations, users } from './schema.ts';
import {
  type ArmorId,
  type BotConfig,
  type ClanChatMessage,
  type ClanInfo,
  computeBotStats,
  DEFAULT_BOT_CONFIG,
  DEFAULT_SKILLS,
  type LeaderboardEntry,
  type SkillTree,
  type WeaponId,
} from '../shared/types.ts';

async function withDbRetry<T>(operation: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return withDbRetry(operation, retries - 1);
    }
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getOrCreateUser(uid: string, email: string) {
  return withDbRetry(async () => {
    const defaultStats = computeBotStats(DEFAULT_BOT_CONFIG, DEFAULT_SKILLS);
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        callsign: email.split('@')[0]?.slice(0, 18) || 'Valkyrie Pilot',
        clanTag: 'SOLO',
        rating: 1200,
        botName: DEFAULT_BOT_CONFIG.name,
        weapon: DEFAULT_BOT_CONFIG.weapon,
        armor: DEFAULT_BOT_CONFIG.armor,
        powerScore: defaultStats.powerScore,
        botConfigJson: JSON.stringify(DEFAULT_BOT_CONFIG),
        skillsJson: JSON.stringify(DEFAULT_SKILLS),
        claimedEventsJson: '[]',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  });
}

export async function upsertUserProfile(params: {
  uid: string;
  email: string;
  callsign: string;
  clanId?: string | null;
  clanTag: string;
  rating: number;
  level: number;
  xp: number;
  scrap: number;
  skillPoints: number;
  wins: number;
  losses: number;
  kos: number;
  gauntletStage: number;
  botConfig: BotConfig;
  skills: SkillTree;
  claimedEvents?: string[];
}) {
  return withDbRetry(async () => {
    const stats = computeBotStats(params.botConfig, params.skills);
    const now = new Date();
    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email,
        callsign: params.callsign.slice(0, 24),
        clanId: params.clanId ?? null,
        clanTag: (params.clanTag || 'SOLO').slice(0, 5).toUpperCase(),
        rating: params.rating,
        level: params.level,
        xp: params.xp,
        scrap: params.scrap,
        skillPoints: params.skillPoints,
        wins: params.wins,
        losses: params.losses,
        kos: params.kos,
        gauntletStage: params.gauntletStage,
        botName: params.botConfig.name.slice(0, 24),
        weapon: params.botConfig.weapon,
        armor: params.botConfig.armor,
        powerScore: stats.powerScore,
        botConfigJson: JSON.stringify(params.botConfig),
        skillsJson: JSON.stringify(params.skills),
        claimedEventsJson: JSON.stringify(params.claimedEvents ?? []),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: params.email,
          callsign: params.callsign.slice(0, 24),
          clanId: params.clanId ?? null,
          clanTag: (params.clanTag || 'SOLO').slice(0, 5).toUpperCase(),
          rating: params.rating,
          level: params.level,
          xp: params.xp,
          scrap: params.scrap,
          skillPoints: params.skillPoints,
          wins: params.wins,
          losses: params.losses,
          kos: params.kos,
          gauntletStage: params.gauntletStage,
          botName: params.botConfig.name.slice(0, 24),
          weapon: params.botConfig.weapon,
          armor: params.botConfig.armor,
          powerScore: stats.powerScore,
          botConfigJson: JSON.stringify(params.botConfig),
          skillsJson: JSON.stringify(params.skills),
          claimedEventsJson: JSON.stringify(params.claimedEvents ?? []),
          updatedAt: now,
        },
      })
      .returning();

    return result[0];
  });
}

export async function getLeaderboardFromSql(limit = 25): Promise<LeaderboardEntry[]> {
  return withDbRetry(async () => {
    const rows = await db
      .select()
      .from(users)
      .orderBy(desc(users.rating), desc(users.wins))
      .limit(limit);

    return rows.map((r) => ({
      id: r.uid,
      name: r.callsign,
      clanTag: r.clanTag,
      rating: r.rating,
      wins: r.wins,
      losses: r.losses,
      kos: r.kos,
      botName: r.botName,
      weapon: (r.weapon as WeaponId) || 'vspinner',
      armor: (r.armor as ArmorId) || 'titanium',
      powerScore: r.powerScore,
      updatedAt: (r.updatedAt || r.createdAt || new Date()).toISOString(),
    }));
  });
}

export async function getClansFromSql(): Promise<ClanInfo[]> {
  return withDbRetry(async () => {
    const rows = await db.select().from(clans).orderBy(desc(clans.warPoints));
    return rows.map((c, idx) => {
      let parsedChat: ClanChatMessage[] = [];
      try {
        parsedChat = JSON.parse(c.chatJson) as ClanChatMessage[];
      } catch {
        parsedChat = [];
      }
      return {
        id: c.slug,
        name: c.name,
        tag: c.tag,
        motto: c.motto,
        warPoints: c.warPoints,
        memberCount: c.memberCount,
        wins: c.wins,
        tournamentSeed: idx + 1,
        chat: parsedChat,
      };
    });
  });
}

export async function upsertClanInSql(clan: ClanInfo): Promise<void> {
  return withDbRetry(async () => {
    await db
      .insert(clans)
      .values({
        slug: clan.id,
        name: clan.name,
        tag: clan.tag,
        motto: clan.motto,
        warPoints: clan.warPoints,
        memberCount: clan.memberCount,
        wins: clan.wins,
        tournamentSeed: clan.tournamentSeed,
        chatJson: JSON.stringify(clan.chat.slice(-30)),
      })
      .onConflictDoUpdate({
        target: clans.slug,
        set: {
          name: clan.name,
          tag: clan.tag,
          motto: clan.motto,
          warPoints: clan.warPoints,
          memberCount: clan.memberCount,
          wins: clan.wins,
          tournamentSeed: clan.tournamentSeed,
          chatJson: JSON.stringify(clan.chat.slice(-30)),
        },
      });
  });
}

export async function recordMediaCreation(params: {
  uid: string;
  email: string;
  kind: 'music' | 'image' | 'video';
  title: string;
  prompt: string;
  modelUsed: string;
}) {
  return withDbRetry(async () => {
    const userRow = await getOrCreateUser(params.uid, params.email);
    const inserted = await db
      .insert(mediaCreations)
      .values({
        userId: userRow.id,
        kind: params.kind,
        title: params.title.slice(0, 64),
        prompt: params.prompt.slice(0, 500),
        modelUsed: params.modelUsed,
      })
      .returning();
    return inserted[0];
  });
}

export async function getUserMediaHistory(uid: string) {
  return withDbRetry(async () => {
    const rows = await db
      .select({
        id: mediaCreations.id,
        kind: mediaCreations.kind,
        title: mediaCreations.title,
        prompt: mediaCreations.prompt,
        modelUsed: mediaCreations.modelUsed,
        createdAt: mediaCreations.createdAt,
      })
      .from(mediaCreations)
      .innerJoin(users, eq(mediaCreations.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(mediaCreations.createdAt))
      .limit(20);
    return rows;
  });
}
