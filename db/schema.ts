import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const nflSnapshotCache = sqliteTable('nfl_snapshot_cache', {
  cacheKey: text('cache_key').primaryKey(),
  cacheDate: text('cache_date').notNull(),
  horizonDays: integer('horizon_days').notNull(),
  maxGames: integer('max_games').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  payload: text('payload').notNull(),
});
