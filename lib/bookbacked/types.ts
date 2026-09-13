export type OddsProvider = 'propline' | 'sports-game-odds';

export type MarketSide = 'over' | 'under' | 'yes' | 'no' | 'other';

export type SportsbookLine = {
  bookmakerId: string;
  bookmakerName: string;
  point: number | null;
  prices: Partial<Record<MarketSide, number>>;
  lastUpdatedAt: string | null;
  deeplink: string | null;
  source: OddsProvider;
  isAlternate: boolean;
};

export type PlayerMarketSnapshot = {
  marketKey: string;
  label: string;
  consensusLine: number | null;
  consensusOverProbability: number | null;
  booksContributing: number;
  primaryLines: SportsbookLine[];
  alternateLines: SportsbookLine[];
  coverageSource: OddsProvider;
};

export type BoomBustRange = {
  marketKey: string;
  floor: number | null;
  ceiling: number | null;
  source: 'sports-game-odds' | null;
};

export type FantasyRangePpr = {
  floor: number;
  ceiling: number;
  source: 'sports-game-odds';
  components: FantasyRangeComponentPpr[];
};

export type FantasyProjectionComponentPpr = {
  marketKeys: string[];
  label: string;
  input: number;
  inputKind: 'consensus-threshold' | 'no-vig-probability';
  multiplier: number;
  fantasyPoints: number;
};

export type FantasyProjectionBreakdownPpr = {
  total: number;
  method: 'sportsbook-threshold-proxy-v1';
  components: FantasyProjectionComponentPpr[];
};

export type FantasyRangeComponentPpr = {
  marketKeys: string[];
  label: string;
  floorInput: number;
  ceilingInput: number;
  multiplier: number;
  floorPoints: number;
  ceilingPoints: number;
  inputMethod:
    | 'alternate-lines-targeting-75-and-25-percent-over'
    | 'consensus-held-constant';
};

export type NflPlayerSnapshot = {
  id: string | null;
  slug: string;
  name: string;
  position: string | null;
  teamId: string | null;
  fantasyProjectionPpr: number | null;
  fantasyProjectionBreakdownPpr: FantasyProjectionBreakdownPpr | null;
  fantasyRangePpr: FantasyRangePpr | null;
  markets: PlayerMarketSnapshot[];
  boomBust: BoomBustRange | null;
};

export type NflTeamSnapshot = {
  id: string | null;
  key: string | null;
  name: string;
  abbreviation: string | null;
  color: string | null;
};

export type NflGameSnapshot = {
  id: string;
  proplineEventId: string | null;
  sportsGameOddsEventId: string | null;
  commenceTime: string;
  homeTeam: NflTeamSnapshot;
  awayTeam: NflTeamSnapshot;
  players: NflPlayerSnapshot[];
};

export type ProviderState = 'available' | 'degraded' | 'unavailable';

export type NflSnapshot = {
  generatedAt: string;
  window: {
    startsAfter: string;
    startsBefore: string;
  };
  providers: Record<OddsProvider, ProviderState>;
  games: NflGameSnapshot[];
};
