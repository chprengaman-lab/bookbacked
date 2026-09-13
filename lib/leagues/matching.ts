import { normalizedName } from '@/lib/bookbacked/matching';
import type { NflGameSnapshot, NflPlayerSnapshot } from '@/lib/bookbacked/types';
import type { RosteredPlayer } from '@/lib/leagues/types';

type MatchCandidate = {
  slug: string;
  normalizedName: string;
  position: string | null;
  teamAbbreviation: string | null;
};

function teamAbbreviationForPlayer(
  game: NflGameSnapshot,
  player: NflPlayerSnapshot,
) {
  if (player.teamId && player.teamId === game.homeTeam.id)
    return game.homeTeam.abbreviation;
  if (player.teamId && player.teamId === game.awayTeam.id)
    return game.awayTeam.abbreviation;
  return null;
}

function candidatesFromGames(games: NflGameSnapshot[]): MatchCandidate[] {
  return games.flatMap((game) =>
    game.players.map((player) => ({
      slug: player.slug,
      normalizedName: normalizedName(player.name),
      position: player.position,
      teamAbbreviation: teamAbbreviationForPlayer(game, player),
    })),
  );
}

/**
 * Resolves a rostered player to a BookBacked player slug against the
 * players currently present in an NFL snapshot. Returns null (rather than
 * guessing) whenever the name is missing entirely or still ambiguous after
 * disambiguating by team and position -- callers should surface that as
 * "unmatched", not drop the player or attach a wrong slug.
 */
export function matchRosteredPlayerSlug(
  rosteredPlayer: RosteredPlayer,
  candidates: MatchCandidate[],
): string | null {
  const targetName = normalizedName(rosteredPlayer.name);
  if (!targetName) return null;

  const nameMatches = candidates.filter(
    (candidate) => candidate.normalizedName === targetName,
  );
  if (nameMatches.length === 0) return null;
  if (nameMatches.length === 1) return nameMatches[0].slug;

  const targetTeam = rosteredPlayer.team?.toUpperCase() ?? null;
  const teamMatches = targetTeam
    ? nameMatches.filter(
        (candidate) => candidate.teamAbbreviation?.toUpperCase() === targetTeam,
      )
    : [];
  if (teamMatches.length === 1) return teamMatches[0].slug;

  const targetPosition = rosteredPlayer.position?.toUpperCase() ?? null;
  const positionMatches = nameMatches.filter(
    (candidate) => candidate.position?.toUpperCase() === targetPosition,
  );
  if (positionMatches.length === 1) return positionMatches[0].slug;

  return null;
}

export function matchRosterToSnapshot(
  players: RosteredPlayer[],
  games: NflGameSnapshot[],
): RosteredPlayer[] {
  const candidates = candidatesFromGames(games);
  return players.map((player) => ({
    ...player,
    matchedSlug: matchRosteredPlayerSlug(player, candidates),
  }));
}
