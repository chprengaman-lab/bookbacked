import { finalizeMarket } from '@/lib/bookbacked/consensus';
import {
  ingestPropLine,
  ingestSportsGameOdds,
  SPORTS_GAME_ODDS_MARKETS,
  type MutablePlayer,
} from '@/lib/bookbacked/ingest';
import { sameGame } from '@/lib/bookbacked/matching';
import {
  getPropLineNflEvents,
  getPropLineNflOdds,
  type PropLineEvent,
  type PropLineOddsEvent,
} from '@/lib/bookbacked/providers/propline';
import {
  getSportsGameOddsNflEvents,
  getSportsGameOddsPlayers,
  type SportsGameOddsEvent,
  type SportsGameOddsPlayer,
  type SportsGameOddsTeam,
} from '@/lib/bookbacked/providers/sports-game-odds';
import {
  boomBustRange,
  fantasyProjectionBreakdownPpr,
  fantasyRangePpr,
} from '@/lib/bookbacked/scoring';
import { getDailyNflSnapshot } from '@/lib/bookbacked/snapshot-cache';
import type {
  NflGameSnapshot,
  NflPlayerSnapshot,
  NflSnapshot,
  NflTeamSnapshot,
  OddsProvider,
  ProviderState,
} from '@/lib/bookbacked/types';

const DEFAULT_HORIZON_DAYS = 10;
const DEFAULT_MAX_GAMES = 18;
const LIVE_LOOKBACK_HOURS = 8;
const PROVIDER_CONCURRENCY = 4;

type PropLineEventData = {
  event: PropLineEvent;
  odds: PropLineOddsEvent | null;
};

export type GetNflSnapshotOptions = {
  now?: Date;
  horizonDays?: number;
  maxGames?: number;
};

export class NflDataUnavailableError extends Error {
  constructor() {
    super('NFL data providers are unavailable');
    this.name = 'NflDataUnavailableError';
  }
}

function finalizePlayers(
  players: Map<string, MutablePlayer>,
): NflPlayerSnapshot[] {
  return [...players.values()]
    .map((player) => {
      const markets = [...player.markets.values()]
        .map(finalizeMarket)
        .sort((left, right) => left.label.localeCompare(right.label));
      const marketsByKey = new Map(
        markets.map((market) => [market.marketKey, market]),
      );
      const projectionBreakdown = fantasyProjectionBreakdownPpr(marketsByKey);
      return {
        id: player.id,
        slug: player.slug,
        name: player.name,
        position: player.position,
        teamId: player.teamId,
        fantasyProjectionPpr: projectionBreakdown?.total ?? null,
        fantasyProjectionBreakdownPpr: projectionBreakdown,
        fantasyRangePpr: fantasyRangePpr(marketsByKey),
        markets,
        boomBust: boomBustRange(markets),
      };
    })
    .sort((left, right) => {
      const projectionOrder =
        (right.fantasyProjectionPpr ?? -1) - (left.fantasyProjectionPpr ?? -1);
      return projectionOrder || left.name.localeCompare(right.name);
    });
}

function teamFromProviders(
  propLineName: string,
  propLineKey: string | null | undefined,
  propLineId: string | null | undefined,
  sportsGameOddsTeam: SportsGameOddsTeam | undefined,
): NflTeamSnapshot {
  return {
    id: propLineId ?? sportsGameOddsTeam?.teamID ?? null,
    key: propLineKey ?? null,
    name: propLineName,
    abbreviation: sportsGameOddsTeam?.names?.short ?? null,
    color: sportsGameOddsTeam?.colors?.primary ?? null,
  };
}

function teamFromSportsGameOdds(
  team: NonNullable<NonNullable<SportsGameOddsEvent['teams']>['home']>,
): NflTeamSnapshot {
  return {
    id: team.teamID ?? null,
    key: null,
    name:
      team.names?.long ??
      team.names?.medium ??
      team.names?.short ??
      'Unknown team',
    abbreviation: team.names?.short ?? null,
    color: team.colors?.primary ?? null,
  };
}

function gameFromPropLine(
  eventData: PropLineEventData,
  sportsGameOddsEvent: SportsGameOddsEvent | null,
  playerMetadata: Map<string, SportsGameOddsPlayer>,
): NflGameSnapshot {
  const players = new Map<string, MutablePlayer>();
  ingestPropLine(players, eventData.odds);
  ingestSportsGameOdds(players, sportsGameOddsEvent, playerMetadata);

  const eventId = String(eventData.event.id);
  return {
    id: 'propline:' + eventId,
    proplineEventId: eventId,
    sportsGameOddsEventId: sportsGameOddsEvent?.eventID ?? null,
    commenceTime: eventData.event.commence_time,
    homeTeam: teamFromProviders(
      eventData.event.home_team,
      eventData.event.home_team_key,
      eventData.event.home_team_id,
      sportsGameOddsEvent?.teams?.home,
    ),
    awayTeam: teamFromProviders(
      eventData.event.away_team,
      eventData.event.away_team_key,
      eventData.event.away_team_id,
      sportsGameOddsEvent?.teams?.away,
    ),
    players: finalizePlayers(players),
  };
}

function gameFromSportsGameOdds(
  event: SportsGameOddsEvent,
  playerMetadata: Map<string, SportsGameOddsPlayer>,
): NflGameSnapshot | null {
  const homeTeam = event.teams?.home;
  const awayTeam = event.teams?.away;
  const commenceTime = event.status?.startsAt;
  if (!homeTeam || !awayTeam || !commenceTime) return null;

  const players = new Map<string, MutablePlayer>();
  ingestSportsGameOdds(players, event, playerMetadata);
  return {
    id: 'sports-game-odds:' + event.eventID,
    proplineEventId: null,
    sportsGameOddsEventId: event.eventID,
    commenceTime,
    homeTeam: teamFromSportsGameOdds(homeTeam),
    awayTeam: teamFromSportsGameOdds(awayTeam),
    players: finalizePlayers(players),
  };
}

async function mapWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<Result>,
) {
  const results: Result[] = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

async function loadPropLineEventData(events: PropLineEvent[]) {
  return mapWithConcurrency(events, PROVIDER_CONCURRENCY, async (event) => {
    const eventId = String(event.id);
    const oddsResult = await Promise.allSettled([getPropLineNflOdds(eventId)]);

    return {
      event,
      odds: oddsResult[0].status === 'fulfilled' ? oddsResult[0].value : null,
    } satisfies PropLineEventData;
  });
}

function fantasyPlayerIds(events: SportsGameOddsEvent[]) {
  const ids = new Set<string>();
  for (const event of events) {
    for (const odd of Object.values(event.odds ?? {})) {
      const marketKey = SPORTS_GAME_ODDS_MARKETS[odd.statID];
      if (!marketKey || marketKey === 'player_anytime_td') continue;
      const playerId = odd.playerID ?? odd.statEntityID;
      if (playerId && !['all', 'home', 'away'].includes(playerId)) {
        ids.add(playerId);
      }
    }
  }
  return [...ids];
}

async function loadSportsGameOddsPlayerMetadata(events: SportsGameOddsEvent[]) {
  const ids = fantasyPlayerIds(events);
  const batches = Array.from(
    { length: Math.ceil(ids.length / 100) },
    (_, index) => ids.slice(index * 100, (index + 1) * 100),
  );
  const results = await Promise.allSettled(
    batches.map((batch) => getSportsGameOddsPlayers(batch)),
  );
  const players = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  return new Map(
    players
      .filter((player) => player.playerID)
      .map((player) => [player.playerID as string, player]),
  );
}

function inWindow(event: PropLineEvent, startsAfter: Date, startsBefore: Date) {
  const commenceTime = Date.parse(event.commence_time);
  return (
    Number.isFinite(commenceTime) &&
    commenceTime >= startsAfter.getTime() &&
    commenceTime <= startsBefore.getTime()
  );
}

type NormalizedGetNflSnapshotOptions = {
  now: Date;
  horizonDays: number;
  maxGames: number;
};

function normalizeOptions(
  options: GetNflSnapshotOptions,
): NormalizedGetNflSnapshotOptions {
  const now = options.now ?? new Date();
  const horizonDays = Math.min(
    Math.max(options.horizonDays ?? DEFAULT_HORIZON_DAYS, 1),
    21,
  );
  const maxGames = Math.min(
    Math.max(options.maxGames ?? DEFAULT_MAX_GAMES, 1),
    32,
  );

  return { now, horizonDays, maxGames };
}

async function loadNflSnapshot({
  now,
  horizonDays,
  maxGames,
}: NormalizedGetNflSnapshotOptions): Promise<NflSnapshot> {
  const startsAfter = new Date(
    now.getTime() - LIVE_LOOKBACK_HOURS * 60 * 60 * 1000,
  );
  const startsBefore = new Date(
    now.getTime() + horizonDays * 24 * 60 * 60 * 1000,
  );

  const [propLineEventsResult, sportsGameOddsEventsResult] =
    await Promise.allSettled([
      getPropLineNflEvents(),
      getSportsGameOddsNflEvents(startsAfter, startsBefore),
    ]);

  if (
    propLineEventsResult.status === 'rejected' &&
    sportsGameOddsEventsResult.status === 'rejected'
  ) {
    throw new NflDataUnavailableError();
  }

  const providerStates: Record<OddsProvider, ProviderState> = {
    propline:
      propLineEventsResult.status === 'fulfilled' ? 'available' : 'unavailable',
    'sports-game-odds':
      sportsGameOddsEventsResult.status === 'fulfilled'
        ? 'available'
        : 'unavailable',
  };
  const sportsGameOddsEvents =
    sportsGameOddsEventsResult.status === 'fulfilled'
      ? sportsGameOddsEventsResult.value
      : [];
  const propLineEvents =
    propLineEventsResult.status === 'fulfilled'
      ? propLineEventsResult.value
          .filter((event) => inWindow(event, startsAfter, startsBefore))
          .sort(
            (left, right) =>
              Date.parse(left.commence_time) - Date.parse(right.commence_time),
          )
          .slice(0, maxGames)
      : [];

  const [propLineEventData, playerMetadata] = await Promise.all([
    loadPropLineEventData(propLineEvents),
    loadSportsGameOddsPlayerMetadata(sportsGameOddsEvents),
  ]);
  if (propLineEventData.some((event) => event.odds == null)) {
    providerStates.propline = 'degraded';
  }

  const matchedSportsGameOddsIds = new Set<string>();
  const games = propLineEventData.map((eventData) => {
    const match =
      sportsGameOddsEvents.find((event) => sameGame(eventData.event, event)) ??
      null;
    if (match) matchedSportsGameOddsIds.add(match.eventID);
    return gameFromPropLine(eventData, match, playerMetadata);
  });

  for (const event of sportsGameOddsEvents) {
    if (matchedSportsGameOddsIds.has(event.eventID)) continue;
    const fallbackGame = gameFromSportsGameOdds(event, playerMetadata);
    if (fallbackGame) games.push(fallbackGame);
  }

  return {
    generatedAt: new Date().toISOString(),
    window: {
      startsAfter: startsAfter.toISOString(),
      startsBefore: startsBefore.toISOString(),
    },
    providers: providerStates,
    games: games
      .filter((game) => {
        const start = Date.parse(game.commenceTime);
        return (
          Number.isFinite(start) &&
          start >= startsAfter.getTime() &&
          start <= startsBefore.getTime()
        );
      })
      .sort(
        (left, right) =>
          Date.parse(left.commenceTime) - Date.parse(right.commenceTime),
      )
      .slice(0, maxGames),
  };
}

export async function getNflSnapshot(
  options: GetNflSnapshotOptions = {},
): Promise<NflSnapshot> {
  const request = normalizeOptions(options);

  // Explicit timestamps are used for deterministic snapshots and should not
  // read from or write to the production daily cache.
  if (options.now) return loadNflSnapshot(request);

  return getDailyNflSnapshot(request, () => loadNflSnapshot(request));
}
