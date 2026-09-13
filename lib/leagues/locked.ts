import type { NflGameSnapshot } from '@/lib/bookbacked/types';
import type { LeagueRoster, RosteredPlayer } from '@/lib/leagues/types';

export type LockStatus = 'locked' | 'upcoming' | 'unmatched';

export type LockedRosteredPlayer = RosteredPlayer & {
  lockStatus: LockStatus;
  commenceTime: string | null;
};

export type LockedLeagueRoster = Omit<LeagueRoster, 'players'> & {
  players: LockedRosteredPlayer[];
  generatedAt: string;
};

function gameForSlug(games: NflGameSnapshot[], slug: string) {
  return (
    games.find((game) => game.players.some((player) => player.slug === slug)) ??
    null
  );
}

function annotatePlayer(
  player: RosteredPlayer,
  games: NflGameSnapshot[],
  now: Date,
): LockedRosteredPlayer {
  const game = player.matchedSlug ? gameForSlug(games, player.matchedSlug) : null;

  // No matched game means we can't tell if they're locked (bye week, not
  // rostered in the current odds window, etc.) -- keep that distinct from
  // "locked" rather than defaulting one way or the other.
  if (!game) {
    return { ...player, lockStatus: 'unmatched', commenceTime: null };
  }

  const locked = Date.parse(game.commenceTime) <= now.getTime();
  return {
    ...player,
    lockStatus: locked ? 'locked' : 'upcoming',
    commenceTime: game.commenceTime,
  };
}

export function annotateLockStatus(
  roster: LeagueRoster,
  snapshot: { games: NflGameSnapshot[] },
  now: Date = new Date(),
): LockedLeagueRoster {
  return {
    ...roster,
    players: roster.players.map((player) =>
      annotatePlayer(player, snapshot.games, now),
    ),
    generatedAt: now.toISOString(),
  };
}
