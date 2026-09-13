import { and, eq, gt, lt } from 'drizzle-orm';

import { getDb } from '@/db';
import { nflSnapshotCache } from '@/db/schema';
import type { NflSnapshot } from '@/lib/bookbacked/types';

const CACHE_VERSION = 1;
const inFlightSnapshots = new Map<string, Promise<NflSnapshot>>();

type DailySnapshotRequest = {
  now: Date;
  horizonDays: number;
  maxGames: number;
};

function cacheDate(now: Date) {
  return now.toISOString().slice(0, 10);
}

function nextUtcDayEpoch(now: Date) {
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) /
      1000,
  );
}

function cacheKey(request: DailySnapshotRequest) {
  return [
    'nfl-snapshot',
    `v${CACHE_VERSION}`,
    cacheDate(request.now),
    request.horizonDays,
    request.maxGames,
  ].join(':');
}

function reportCacheFailure(action: 'read' | 'write', error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[BookBacked] NFL snapshot cache ${action} failed: ${detail}`);
}

async function readDailySnapshot(
  request: DailySnapshotRequest,
): Promise<NflSnapshot | null> {
  try {
    const row = await getDb()
      .select({ payload: nflSnapshotCache.payload })
      .from(nflSnapshotCache)
      .where(
        and(
          eq(nflSnapshotCache.cacheKey, cacheKey(request)),
          gt(
            nflSnapshotCache.expiresAt,
            Math.floor(request.now.getTime() / 1000),
          ),
        ),
      )
      .get();

    return row ? (JSON.parse(row.payload) as NflSnapshot) : null;
  } catch (error) {
    reportCacheFailure('read', error);
    return null;
  }
}

async function writeDailySnapshot(
  request: DailySnapshotRequest,
  snapshot: NflSnapshot,
) {
  try {
    const db = getDb();
    const key = cacheKey(request);
    const values = {
      cacheKey: key,
      cacheDate: cacheDate(request.now),
      horizonDays: request.horizonDays,
      maxGames: request.maxGames,
      createdAt: Math.floor(request.now.getTime() / 1000),
      expiresAt: nextUtcDayEpoch(request.now),
      payload: JSON.stringify(snapshot),
    };

    await db
      .insert(nflSnapshotCache)
      .values(values)
      .onConflictDoUpdate({
        target: nflSnapshotCache.cacheKey,
        set: values,
      })
      .run();
    await db
      .delete(nflSnapshotCache)
      .where(lt(nflSnapshotCache.expiresAt, values.createdAt))
      .run();
  } catch (error) {
    reportCacheFailure('write', error);
  }
}

export async function getDailyNflSnapshot(
  request: DailySnapshotRequest,
  loadFreshSnapshot: () => Promise<NflSnapshot>,
) {
  const cached = await readDailySnapshot(request);
  if (cached) return cached;

  const key = cacheKey(request);
  const existingRequest = inFlightSnapshots.get(key);
  if (existingRequest) return existingRequest;

  const freshRequest = loadFreshSnapshot()
    .then(async (snapshot) => {
      await writeDailySnapshot(request, snapshot);
      return snapshot;
    })
    .finally(() => {
      inFlightSnapshots.delete(key);
    });

  inFlightSnapshots.set(key, freshRequest);
  return freshRequest;
}
