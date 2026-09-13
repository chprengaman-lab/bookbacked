import { annotateLockStatus } from '@/lib/leagues/locked';
import { matchRosterToSnapshot } from '@/lib/leagues/matching';
import {
  getSleeperLeagueRoster,
  getSleeperLeaguesForUsername,
  SleeperRosterNotFoundError,
  SleeperUserNotFoundError,
} from '@/lib/leagues/providers/sleeper';
import { LeagueProviderRequestError } from '@/lib/leagues/providers/http';
import { getNflSnapshot } from '@/lib/bookbacked/nfl-data';

export const dynamic = 'force-dynamic';

// Lock status changes the instant a game kicks off, so this route is
// intentionally not cached the way the odds snapshot route is.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username')?.trim();
  const leagueId = url.searchParams.get('leagueId')?.trim();

  if (!username) {
    return Response.json(
      { error: 'A Sleeper username is required.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    if (!leagueId) {
      const { user, leagues } = await getSleeperLeaguesForUsername(username);
      return Response.json(
        {
          user: { userId: user.user_id, displayName: user.display_name },
          leagues: leagues.map((league) => ({
            leagueId: league.league_id,
            name: league.name,
            season: league.season,
          })),
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    // Roster access must not depend on the NFL odds pipeline: that's a
    // separate integration to be layered in later, and its rate limits
    // (or outages) are unrelated to whether Sleeper data is reachable.
    const [rosterResult, snapshotResult] = await Promise.allSettled([
      getSleeperLeagueRoster(username, leagueId),
      getNflSnapshot(),
    ]);

    if (rosterResult.status === 'rejected') throw rosterResult.reason;
    const roster = rosterResult.value;

    const oddsAvailable = snapshotResult.status === 'fulfilled';
    const games = oddsAvailable ? snapshotResult.value.games : [];
    const matchedRoster = {
      ...roster,
      players: matchRosterToSnapshot(roster.players, games),
    };

    return Response.json(
      {
        ...annotateLockStatus(matchedRoster, { games }),
        oddsAvailable,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof SleeperUserNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof SleeperRosterNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof LeagueProviderRequestError) {
      return Response.json(
        { error: 'Sleeper is temporarily unavailable.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      { error: 'Unable to load the Sleeper roster.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
