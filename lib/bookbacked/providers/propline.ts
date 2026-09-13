import {
  fetchProviderJson,
  requireServerSecret,
} from '@/lib/bookbacked/providers/http';

const PROPLINE_BASE_URL = 'https://api.prop-line.com/v1';
const NFL_SPORT_KEY = 'football_nfl';

export const PROPLINE_NFL_MARKETS = [
  'player_pass_yds',
  'player_pass_tds',
  'player_pass_attempts',
  'player_pass_completions',
  'player_pass_interceptions',
  'player_rush_yds',
  'player_rush_attempts',
  'player_reception_yds',
  'player_receptions',
  'player_rush_reception_yds',
  'player_pass_rush_yds',
  'player_anytime_td',
] as const;

export type PropLineEvent = {
  id: string | number;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_team_key?: string | null;
  away_team_key?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
};

export type PropLineOutcome = {
  name: string;
  description?: string | null;
  price?: number | string | null;
  point?: number | string | null;
  player_id?: string | null;
};

export type PropLineMarket = {
  key: string;
  description?: string | null;
  last_update?: string | null;
  outcomes?: PropLineOutcome[];
};

export type PropLineBookmaker = {
  key: string;
  title: string;
  link?: string | null;
  last_update?: string | null;
  markets?: PropLineMarket[];
};

export type PropLineOddsEvent = PropLineEvent & {
  bookmakers?: PropLineBookmaker[];
};

export type PropLineProjection = {
  market_key: string;
  player: string;
  player_id?: string | null;
  projected_value?: number | null;
  consensus_over_prob?: number | null;
  books_contributing?: number | null;
  last_update?: string | null;
};

export type PropLineProjectionResponse = PropLineEvent & {
  projections?: PropLineProjection[];
  redacted?: boolean;
};

function proplineUrl(path: string, search?: Record<string, string>) {
  const url = new URL(`${PROPLINE_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(search ?? {}))
    url.searchParams.set(key, value);
  return url;
}

export function getPropLineNflEvents() {
  return fetchProviderJson<PropLineEvent[]>(
    'propline',
    proplineUrl(`/sports/${NFL_SPORT_KEY}/events`),
    requireServerSecret('PROPLINE_API_KEY'),
  );
}

export function getPropLineNflOdds(eventId: string) {
  return fetchProviderJson<PropLineOddsEvent>(
    'propline',
    proplineUrl(
      `/sports/${NFL_SPORT_KEY}/events/${encodeURIComponent(eventId)}/odds`,
      {
        markets: PROPLINE_NFL_MARKETS.join(','),
        includeLinks: 'true',
      },
    ),
    requireServerSecret('PROPLINE_API_KEY'),
  );
}

export function getPropLineNflProjections(eventId: string) {
  return fetchProviderJson<PropLineProjectionResponse>(
    'propline',
    proplineUrl(
      `/sports/${NFL_SPORT_KEY}/events/${encodeURIComponent(eventId)}/projections`,
      {
        markets: PROPLINE_NFL_MARKETS.join(','),
      },
    ),
    requireServerSecret('PROPLINE_API_KEY'),
  );
}
