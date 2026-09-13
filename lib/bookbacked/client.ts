import type {
  NflGameSnapshot,
  NflPlayerSnapshot,
  NflSnapshot,
  PlayerMarketSnapshot,
} from '@/lib/bookbacked/types';

export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE';

export type UiPlayer = {
  rank: number;
  slug: string;
  name: string;
  team: string;
  opponent: string;
  pos: FantasyPosition;
  color: string;
  projection: number;
  coverageScore: number;
  bookCount: number;
  altLineCount: number;
  markets: [string, string, string];
  marketLabels: [string, string, string];
  range: string;
  low: number;
  high: number;
  risk: 'Stable' | 'Ceiling' | 'Volume';
  anytimeTd: string;
  kickoff: string;
  source: 'live' | 'demo';
};

export type UiSnapshot = {
  players: UiPlayer[];
  gameCount: number;
  bookCount: number;
  generatedAt: string;
  slateLabel: string;
};

const DEFAULT_TEAM_COLOR = '#334155';

const MARKET_PRIORITY: Record<FantasyPosition, string[]> = {
  QB: ['player_pass_yds', 'player_rush_yds', 'player_pass_tds'],
  RB: ['player_rush_yds', 'player_reception_yds', 'player_anytime_td'],
  WR: ['player_reception_yds', 'player_receptions', 'player_anytime_td'],
  TE: ['player_reception_yds', 'player_receptions', 'player_anytime_td'],
};

export function isFantasyPosition(value: string | null): value is FantasyPosition {
  return value === 'QB' || value === 'RB' || value === 'WR' || value === 'TE';
}

export function formatAmerican(price: number | null | undefined) {
  if (price == null || !Number.isFinite(price)) return '—';
  return price > 0 ? `+${Math.round(price)}` : `${Math.round(price)}`;
}

export function probabilityToAmerican(probability: number | null | undefined) {
  if (probability == null || probability <= 0 || probability >= 1) return '—';
  const price =
    probability >= 0.5
      ? (-100 * probability) / (1 - probability)
      : (100 * (1 - probability)) / probability;
  return formatAmerican(price);
}

export function formatKickoff(value: string) {
  const kickoff = new Date(value);
  if (Number.isNaN(kickoff.getTime())) return 'Kickoff TBD';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(kickoff);
}

function marketDisplay(market: PlayerMarketSnapshot | undefined) {
  if (!market) return '—';
  if (market.marketKey === 'player_anytime_td') {
    return probabilityToAmerican(market.consensusOverProbability);
  }
  return market.consensusLine == null ? '—' : market.consensusLine.toFixed(1);
}

function teamForPlayer(game: NflGameSnapshot, player: NflPlayerSnapshot) {
  if (player.teamId && player.teamId === game.homeTeam.id) return game.homeTeam;
  if (player.teamId && player.teamId === game.awayTeam.id) return game.awayTeam;
  return null;
}

function cleanColor(value: string | null | undefined) {
  if (!value) return DEFAULT_TEAM_COLOR;
  return value.startsWith('#') ? value : `#${value}`;
}

function uniqueBookCount(player: NflPlayerSnapshot) {
  return new Set(
    player.markets.flatMap((market) =>
      market.primaryLines.map((line) => line.bookmakerId),
    ),
  ).size;
}

function playerRange(player: NflPlayerSnapshot) {
  const projection = player.fantasyProjectionPpr ?? 0;
  if (player.fantasyRangePpr) {
    return {
      low: player.fantasyRangePpr.floor,
      high: player.fantasyRangePpr.ceiling,
    };
  }
  return { low: projection, high: projection };
}

function riskProfile(projection: number, low: number, high: number) {
  const spread = projection > 0 ? (high - low) / projection : 0;
  if (spread >= 0.65) return 'Ceiling' as const;
  if (spread <= 0.35) return 'Stable' as const;
  return 'Volume' as const;
}

function slateLabel(games: NflGameSnapshot[]) {
  if (!games.length) return 'Upcoming NFL slate';
  const starts = games
    .map((game) => new Date(game.commenceTime))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  if (!starts.length) return 'Upcoming NFL slate';
  const format = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
      date,
    );
  const first = format(starts[0]);
  const last = format(starts.at(-1) ?? starts[0]);
  return first === last ? first : `${first}–${last}`;
}

function adaptPlayer(game: NflGameSnapshot, player: NflPlayerSnapshot) {
  if (!isFantasyPosition(player.position) || player.fantasyProjectionPpr == null) {
    return null;
  }
  const team = teamForPlayer(game, player);
  const opponent =
    team?.id === game.homeTeam.id
      ? game.awayTeam
      : team?.id === game.awayTeam.id
        ? game.homeTeam
        : null;
  const isHome = team?.id === game.homeTeam.id;
  const marketsByKey = new Map(
    player.markets.map((market) => [market.marketKey, market]),
  );
  const selectedMarkets = MARKET_PRIORITY[player.position].map((key) =>
    marketsByKey.get(key),
  );
  const bookCount = uniqueBookCount(player);
  const altLineCount = player.markets.reduce(
    (total, market) => total + market.alternateLines.length,
    0,
  );
  const { low, high } = playerRange(player);
  const anytimeTd = marketDisplay(marketsByKey.get('player_anytime_td'));

  return {
    rank: 0,
    slug: player.slug,
    name: player.name,
    team: team?.abbreviation ?? team?.key?.toUpperCase() ?? 'NFL',
    opponent: opponent
      ? `${isHome ? 'vs' : 'at'} ${opponent.abbreviation ?? opponent.name}`
      : 'upcoming game',
    pos: player.position,
    color: cleanColor(team?.color),
    projection: player.fantasyProjectionPpr,
    coverageScore: Math.min(100, Math.round((bookCount / 15) * 100)),
    bookCount,
    altLineCount,
    markets: selectedMarkets.map(marketDisplay) as [string, string, string],
    marketLabels: selectedMarkets.map((market) => market?.label ?? 'No line') as [
      string,
      string,
      string,
    ],
    range: `${low.toFixed(1)}–${high.toFixed(1)}`,
    low,
    high,
    risk: riskProfile(player.fantasyProjectionPpr, low, high),
    anytimeTd,
    kickoff: formatKickoff(game.commenceTime),
    source: 'live',
  } satisfies UiPlayer;
}

export function adaptNflSnapshot(snapshot: NflSnapshot): UiSnapshot {
  const adaptedPlayers: UiPlayer[] = [];
  for (const game of snapshot.games) {
    for (const player of game.players) {
      const adapted = adaptPlayer(game, player);
      if (adapted) adaptedPlayers.push(adapted);
    }
  }
  const players = adaptedPlayers
    .sort((left, right) => right.projection - left.projection)
    .map((player, index) => ({ ...player, rank: index + 1 }));
  const books = new Set(
    snapshot.games.flatMap((game) =>
      game.players.flatMap((player) =>
        player.markets.flatMap((market) =>
          market.primaryLines.map((line) => line.bookmakerId),
        ),
      ),
    ),
  );

  return {
    players,
    gameCount: snapshot.games.length,
    bookCount: books.size,
    generatedAt: snapshot.generatedAt,
    slateLabel: slateLabel(snapshot.games),
  };
}

export function findSnapshotPlayer(snapshot: NflSnapshot, slug: string) {
  for (const game of snapshot.games) {
    const player = game.players.find((candidate) => candidate.slug === slug);
    if (player) return { game, player };
  }
  return null;
}
