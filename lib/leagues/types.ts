export type LeagueProvider = 'sleeper' | 'espn' | 'yahoo' | 'cbs';

export type RosteredPlayer = {
  externalId: string;
  name: string;
  position: string | null;
  team: string | null;
  matchedSlug: string | null;
};

export type LeagueRoster = {
  provider: LeagueProvider;
  leagueId: string;
  leagueName: string;
  season: string;
  ownerDisplayName: string | null;
  players: RosteredPlayer[];
};
