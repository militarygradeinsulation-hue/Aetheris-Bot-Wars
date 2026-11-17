import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  callsign: text('callsign').notNull().default('Valkyrie Pilot'),
  clanId: text('clan_id'),
  clanTag: text('clan_tag').notNull().default('SOLO'),
  rating: integer('rating').notNull().default(1200),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  scrap: integer('scrap').notNull().default(250),
  skillPoints: integer('skill_points').notNull().default(2),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  kos: integer('kos').notNull().default(0),
  gauntletStage: integer('gauntlet_stage').notNull().default(1),
  botName: text('bot_name').notNull().default('Valkyrie MK-IV'),
  weapon: text('weapon').notNull().default('vspinner'),
  armor: text('armor').notNull().default('titanium'),
  powerScore: integer('power_score').notNull().default(500),
  botConfigJson: text('bot_config_json').notNull().default('{}'),
  skillsJson: text('skills_json').notNull().default('{}'),
  claimedEventsJson: text('claimed_events_json').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clans = pgTable('clans', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tag: text('tag').notNull(),
  motto: text('motto').notNull(),
  warPoints: integer('war_points').notNull().default(500),
  memberCount: integer('member_count').notNull().default(1),
  wins: integer('wins').notNull().default(0),
  tournamentSeed: integer('tournament_seed').notNull().default(1),
  chatJson: text('chat_json').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const mediaCreations = pgTable('media_creations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  kind: text('kind').notNull(), // 'music' | 'image' | 'video'
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  modelUsed: text('model_used').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  mediaCreations: many(mediaCreations),
}));

export const mediaCreationsRelations = relations(mediaCreations, ({ one }) => ({
  author: one(users, {
    fields: [mediaCreations.userId],
    references: [users.id],
  }),
}));
