import {
  fetchProviderJson,
  requireServerSecret,
} from '@/lib/bookbacked/providers/http';

const SPORTS_GAME_ODDS_EVENTS_URL = 'https://api.sportsgameodds.com/v2/events';
const SPORTS_GAME_ODDS_PLAYERS_URL =
  'https://api.sportsgameodds.com/v2/players';

export type SportsGameOddsBookLine = {
  odds?: string | number | null;
  overUnder?: string | number | null;
  spread?: string | number | null;
  lastUpdatedAt?: string | null;
  available?: boolean;
  deeplink?: string | null;
  altLines?: SportsGameOddsBookLine[];
};

export type SportsGameOddsOdd = {
  oddID: string;
  marketName?: string | null;
  statID: string;
  statEntityID?: string | null;
  playerID?: string | null;
  periodID?: string | null;
  betTypeID?: string | null;
  sideID?: string | null;
  fairOdds?: string | number | null;
  fairOverUnder?: string | number | null;
  bookOdds?: string | number | null;
  bookOverUnder?: string | number | null;
  byBookmaker?: Record<string, SportsGameOddsBookLine>;
};

export type SportsGameOddsPlayer = {
  playerID?: string;
  teamID?: string | null;
  position?: string | null;
  name?: string | null;
  names?: {
    display?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};

export type SportsGameOddsTeam = {
  teamID?: string | null;
  names?: {
    long?: string | null;
    medium?: string | null;
    short?: string | null;
  };
  colors?: {
    primary?: string | null;
  };
};

export type SportsGameOddsEvent = {
  eventID: string;
  leagueID?: string;
  teams?: {
    home?: SportsGameOddsTeam;
    away?: SportsGameOddsTeam;
  };
  status?: {
    startsAt?: string | null;
  };
  odds?: Record<string, SportsGameOddsOdd>;
  players?: Record<string, SportsGameOddsPlayer>;
};

type SportsGameOddsEventsResponse = {
  success?: boolean;
  data?: SportsGameOddsEvent[];
  nextCursor?: string | null;
};

type SportsGameOddsPlayersResponse = {
  success?: boolean;
  data?: SportsGameOddsPlayer[];
};

export async function getSportsGameOddsNflEvents(
  startsAfter: Date,
  startsBefore: Date,
) {
  const url = new URL(SPORTS_GAME_ODDS_EVENTS_URL);
  url.searchParams.set('leagueID', 'NFL');
  url.searchParams.set('type', 'match');
  url.searchParams.set('includeAltLines', 'true');
  url.searchParams.set('startsAfter', startsAfter.toISOString());
  url.searchParams.set('startsBefore', startsBefore.toISOString());
  url.searchParams.set('limit', '100');

  const response = await fetchProviderJson<SportsGameOddsEventsResponse>(
    'sports-game-odds',
    url,
    requireServerSecret('SPORTSGAMEODDS_API_KEY'),
  );

  return response.data ?? [];
}

export async function getSportsGameOddsPlayers(playerIds: string[]) {
  if (!playerIds.length) return [];

  const url = new URL(SPORTS_GAME_ODDS_PLAYERS_URL);
  url.searchParams.set('playerID', playerIds.join(','));
  url.searchParams.set('limit', String(Math.min(playerIds.length, 250)));

  const response = await fetchProviderJson<SportsGameOddsPlayersResponse>(
    'sports-game-odds',
    url,
    requireServerSecret('SPORTSGAMEODDS_API_KEY'),
  );

  return response.data ?? [];
}
