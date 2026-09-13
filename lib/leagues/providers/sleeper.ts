import { fetchLeagueProviderJson } from '@/lib/leagues/providers/http';
import type { LeagueRoster, RosterSlot, RosteredPlayer } from '@/lib/leagues/types';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

// Sleeper's player dictionary is ~5MB and their own docs ask that it be
// fetched "sparingly, once per day at most" -- cache it in memory.
const PLAYERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
  // Ordered starting-lineup slot labels, e.g. ["QB","RB","RB","WR","WR","TE",
  // "FLEX","FLEX","K","DEF","BN",...]. The non-"BN" entries line up 1:1, in
  // order, with a roster's `starters` array.
  roster_positions?: string[] | null;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null; // IR
  taxi: string[] | null;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string | null;
  metadata?: { team_name?: string | null } | null;
};

export type SleeperPlayer = {
  player_id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
};

export class SleeperUserNotFoundError extends Error {
  constructor(username: string) {
    super(`Sleeper user "${username}" was not found`);
    this.name = 'SleeperUserNotFoundError';
  }
}

export class SleeperRosterNotFoundError extends Error {
  constructor(userId: string, leagueId: string) {
    super(`No roster owned by user ${userId} in league ${leagueId}`);
    this.name = 'SleeperRosterNotFoundError';
  }
}

function sleeperUrl(path: string) {
  return new URL(`${SLEEPER_BASE_URL}${path}`);
}

export function currentNflSeason(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  // Sleeper seasons are labeled by the year they start in (Sept-Feb);
  // January/February still belong to the previous year's season.
  return String(month <= 2 ? year - 1 : year);
}

export async function getSleeperUser(username: string) {
  return fetchLeagueProviderJson<SleeperUser | null>(
    'sleeper',
    sleeperUrl(`/user/${encodeURIComponent(username)}`),
  );
}

export function getSleeperUserLeagues(userId: string, season: string) {
  return fetchLeagueProviderJson<SleeperLeague[]>(
    'sleeper',
    sleeperUrl(
      `/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`,
    ),
  );
}

export function getSleeperLeague(leagueId: string) {
  return fetchLeagueProviderJson<SleeperLeague | null>(
    'sleeper',
    sleeperUrl(`/league/${encodeURIComponent(leagueId)}`),
  );
}

export function getSleeperLeagueRosters(leagueId: string) {
  return fetchLeagueProviderJson<SleeperRoster[]>(
    'sleeper',
    sleeperUrl(`/league/${encodeURIComponent(leagueId)}/rosters`),
  );
}

export function getSleeperLeagueUsers(leagueId: string) {
  return fetchLeagueProviderJson<SleeperLeagueUser[]>(
    'sleeper',
    sleeperUrl(`/league/${encodeURIComponent(leagueId)}/users`),
  );
}

let playersCache: { fetchedAt: number; players: Map<string, SleeperPlayer> } | null =
  null;

export async function getSleeperPlayersDictionary() {
  if (playersCache && Date.now() - playersCache.fetchedAt < PLAYERS_CACHE_TTL_MS) {
    return playersCache.players;
  }

  const dictionary = await fetchLeagueProviderJson<Record<string, SleeperPlayer>>(
    'sleeper',
    sleeperUrl('/players/nfl'),
  );
  const players = new Map(Object.entries(dictionary));
  playersCache = { fetchedAt: Date.now(), players };
  return players;
}

/**
 * Resolves a username to their leagues for the given (or current) season.
 * Throws SleeperUserNotFoundError if the username doesn't exist.
 */
export async function getSleeperLeaguesForUsername(
  username: string,
  season: string = currentNflSeason(),
) {
  const user = await getSleeperUser(username);
  if (!user) throw new SleeperUserNotFoundError(username);

  const leagues = await getSleeperUserLeagues(user.user_id, season);
  return { user, leagues };
}

type SlotAssignment = {
  slot: RosterSlot;
  starterSlotLabel: string | null;
  starterSlotOrder: number | null;
};

/**
 * Maps every rostered player to a lineup slot from Sleeper's own roster
 * fields: `starters` (paired index-for-index with the league's
 * roster_positions, minus "BN" entries) for starter labels, then `reserve`
 * (IR) and `taxi` (dynasty taxi squad), with everything else on `players`
 * falling back to bench.
 */
function resolveRosterSlots(
  roster: SleeperRoster,
  rosterPositions: string[] | null | undefined,
): Map<string, SlotAssignment> {
  const slots = new Map<string, SlotAssignment>();

  const starterLabels = (rosterPositions ?? []).filter((label) => label !== 'BN');
  (roster.starters ?? []).forEach((playerId, index) => {
    if (!playerId || playerId === '0') return; // empty starting slot
    slots.set(playerId, {
      slot: 'starter',
      starterSlotLabel: starterLabels[index] ?? null,
      starterSlotOrder: index,
    });
  });

  for (const playerId of roster.reserve ?? []) {
    if (!slots.has(playerId))
      slots.set(playerId, { slot: 'ir', starterSlotLabel: null, starterSlotOrder: null });
  }
  for (const playerId of roster.taxi ?? []) {
    if (!slots.has(playerId))
      slots.set(playerId, { slot: 'taxi', starterSlotLabel: null, starterSlotOrder: null });
  }
  for (const playerId of roster.players ?? []) {
    if (!slots.has(playerId))
      slots.set(playerId, { slot: 'bench', starterSlotLabel: null, starterSlotOrder: null });
  }

  return slots;
}

function rosteredPlayerFromSleeperId(
  playerId: string,
  playersDictionary: Map<string, SleeperPlayer>,
  slotAssignment: SlotAssignment,
): RosteredPlayer {
  const player = playersDictionary.get(playerId);
  const name =
    player?.full_name ||
    [player?.first_name, player?.last_name].filter(Boolean).join(' ') ||
    playerId;

  return {
    externalId: playerId,
    name,
    position: player?.position ?? player?.fantasy_positions?.[0] ?? null,
    team: player?.team ?? null,
    matchedSlug: null,
    slot: slotAssignment.slot,
    starterSlotLabel: slotAssignment.starterSlotLabel,
    starterSlotOrder: slotAssignment.starterSlotOrder,
  };
}

/**
 * Fetches a user's roster for a specific Sleeper league. The returned
 * players carry matchedSlug: null -- resolving that against BookBacked's
 * own player data is the job of lib/leagues/matching.ts.
 */
export async function getSleeperLeagueRoster(
  username: string,
  leagueId: string,
): Promise<LeagueRoster> {
  const user = await getSleeperUser(username);
  if (!user) throw new SleeperUserNotFoundError(username);

  const [league, rosters, playersDictionary] = await Promise.all([
    getSleeperLeague(leagueId),
    getSleeperLeagueRosters(leagueId),
    getSleeperPlayersDictionary(),
  ]);

  const roster = rosters.find((candidate) => candidate.owner_id === user.user_id);
  if (!roster) throw new SleeperRosterNotFoundError(user.user_id, leagueId);

  const slotsByPlayerId = resolveRosterSlots(roster, league?.roster_positions);
  const players = (roster.players ?? []).map((playerId) =>
    rosteredPlayerFromSleeperId(
      playerId,
      playersDictionary,
      slotsByPlayerId.get(playerId) ?? {
        slot: 'bench',
        starterSlotLabel: null,
        starterSlotOrder: null,
      },
    ),
  );

  return {
    provider: 'sleeper',
    leagueId,
    leagueName: league?.name ?? `League ${leagueId}`,
    season: league?.season ?? currentNflSeason(),
    ownerDisplayName: user.display_name,
    players,
  };
}
