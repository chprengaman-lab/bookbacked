import {
  getPropLineNflEvents,
  getPropLineNflOdds,
  type PropLineEvent,
  type PropLineOddsEvent,
} from '@/lib/bookbacked/providers/propline';
import {
  getSportsGameOddsNflEvents,
  getSportsGameOddsPlayers,
  type SportsGameOddsBookLine,
  type SportsGameOddsEvent,
  type SportsGameOddsOdd,
  type SportsGameOddsPlayer,
  type SportsGameOddsTeam,
} from '@/lib/bookbacked/providers/sports-game-odds';
import type {
  BoomBustRange,
  FantasyRangePpr,
  MarketSide,
  NflGameSnapshot,
  NflPlayerSnapshot,
  NflSnapshot,
  NflTeamSnapshot,
  OddsProvider,
  PlayerMarketSnapshot,
  ProviderState,
  SportsbookLine,
} from '@/lib/bookbacked/types';

const DEFAULT_HORIZON_DAYS = 10;
const DEFAULT_MAX_GAMES = 18;
const LIVE_LOOKBACK_HOURS = 8;
const EVENT_TIME_TOLERANCE_MS = 12 * 60 * 60 * 1000;
const PROVIDER_CONCURRENCY = 4;

const MARKET_LABELS: Record<string, string> = {
  player_pass_yds: 'Passing yards',
  player_pass_tds: 'Passing touchdowns',
  player_pass_attempts: 'Passing attempts',
  player_pass_completions: 'Passing completions',
  player_pass_interceptions: 'Interceptions thrown',
  player_rush_yds: 'Rushing yards',
  player_rush_attempts: 'Rushing attempts',
  player_reception_yds: 'Receiving yards',
  player_receptions: 'Receptions',
  player_rush_reception_yds: 'Rushing + receiving yards',
  player_pass_rush_yds: 'Passing + rushing yards',
  player_anytime_td: 'Anytime touchdown',
};

const SPORTS_GAME_ODDS_MARKETS: Record<string, string> = {
  passing_yards: 'player_pass_yds',
  passing_touchdowns: 'player_pass_tds',
  passing_attempts: 'player_pass_attempts',
  passing_completions: 'player_pass_completions',
  passing_interceptions: 'player_pass_interceptions',
  rushing_yards: 'player_rush_yds',
  rushing_attempts: 'player_rush_attempts',
  receiving_yards: 'player_reception_yds',
  receiving_receptions: 'player_receptions',
  receptions: 'player_receptions',
  'rushing+receiving_yards': 'player_rush_reception_yds',
  'passing+rushing_yards': 'player_pass_rush_yds',
  anytimeTouchdown: 'player_anytime_td',
  touchdowns: 'player_anytime_td',
};

const BOOKMAKER_NAMES: Record<string, string> = {
  bet365: 'bet365',
  betmgm: 'BetMGM',
  betrivers: 'BetRivers',
  bovada: 'Bovada',
  caesars: 'Caesars',
  draftkings: 'DraftKings',
  espnbet: 'ESPN BET',
  fanduel: 'FanDuel',
  fanatics: 'Fanatics',
  pinnacle: 'Pinnacle',
  prizepicks: 'PrizePicks',
  underdog: 'Underdog Fantasy',
  unibet: 'Unibet',
  williamhill: 'William Hill',
};

type MutableMarket = {
  marketKey: string;
  label: string;
  consensusLine: number | null;
  consensusOverProbability: number | null;
  booksContributing: number;
  coverageSource: OddsProvider;
  lines: Map<string, SportsbookLine>;
};

type MutablePlayer = {
  id: string | null;
  slug: string;
  name: string;
  position: string | null;
  teamId: string | null;
  markets: Map<string, MutableMarket>;
};

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

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function americanImpliedProbability(price: number | null | undefined) {
  if (price == null || price === 0) return null;
  return price < 0 ? -price / (-price + 100) : 100 / (price + 100);
}

function marketSide(value: string | null | undefined): MarketSide {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'over' ||
    normalized === 'under' ||
    normalized === 'yes' ||
    normalized === 'no'
  ) {
    return normalized;
  }
  return 'other';
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizedName(value: string) {
  const withoutTeamSuffix = value.replace(/\s+\([A-Z0-9]{2,4}\)\s*$/i, '');
  return slugify(withoutTeamSuffix)
    .split('-')
    .filter((part) => !['jr', 'sr', 'ii', 'iii', 'iv'].includes(part))
    .join('');
}

function teamToken(value: string) {
  const parts = slugify(value).split('-').filter(Boolean);
  return parts.at(-1) ?? '';
}

function sameGame(left: PropLineEvent, right: SportsGameOddsEvent) {
  const leftTime = Date.parse(left.commence_time);
  const rightTime = Date.parse(right.status?.startsAt ?? '');
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  if (Math.abs(leftTime - rightTime) > EVENT_TIME_TOLERANCE_MS) return false;

  const rightHome = right.teams?.home?.names?.long ?? '';
  const rightAway = right.teams?.away?.names?.long ?? '';
  return (
    teamToken(left.home_team) === teamToken(rightHome) &&
    teamToken(left.away_team) === teamToken(rightAway)
  );
}

function bookmakerName(bookmakerId: string) {
  return (
    BOOKMAKER_NAMES[bookmakerId] ??
    bookmakerId
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function mutablePlayer(
  players: Map<string, MutablePlayer>,
  name: string,
  details?: {
    id?: string | null;
    position?: string | null;
    teamId?: string | null;
  },
) {
  const key = normalizedName(name);
  const existing = players.get(key);
  if (existing) {
    existing.id ??= details?.id ?? null;
    existing.position ??= details?.position ?? null;
    existing.teamId ??= details?.teamId ?? null;
    if (details?.id) {
      existing.name = name;
      existing.slug = slugify(name);
    }
    return existing;
  }

  const player: MutablePlayer = {
    id: details?.id ?? null,
    slug: slugify(name),
    name,
    position: details?.position ?? null,
    teamId: details?.teamId ?? null,
    markets: new Map(),
  };
  players.set(key, player);
  return player;
}

function mutableMarket(
  player: MutablePlayer,
  marketKey: string,
  source: OddsProvider,
) {
  const existing = player.markets.get(marketKey);
  if (existing) return existing;

  const market: MutableMarket = {
    marketKey,
    label: MARKET_LABELS[marketKey] ?? marketKey,
    consensusLine: null,
    consensusOverProbability: null,
    booksContributing: 0,
    coverageSource: source,
    lines: new Map(),
  };
  player.markets.set(marketKey, market);
  return market;
}

function lineKey(
  line: Pick<
    SportsbookLine,
    'bookmakerId' | 'point' | 'source' | 'isAlternate'
  >,
) {
  return [
    line.source,
    line.bookmakerId,
    line.point == null ? 'none' : String(line.point),
    line.isAlternate ? 'alt' : 'main',
  ].join(':');
}

function addLine(
  market: MutableMarket,
  line: SportsbookLine,
  side: MarketSide,
  price: number | null,
) {
  const key = lineKey(line);
  const existing = market.lines.get(key);
  if (existing) {
    if (price != null) existing.prices[side] = price;
    existing.lastUpdatedAt ??= line.lastUpdatedAt;
    existing.deeplink ??= line.deeplink;
    return;
  }
  if (price != null) line.prices[side] = price;
  market.lines.set(key, line);
}

function propLinePlayerName(
  marketDescription: string | null | undefined,
  outcomeName: string,
  outcomeDescription: string | null | undefined,
) {
  if (outcomeDescription?.trim()) return outcomeDescription.trim();
  if (!['over', 'under', 'yes', 'no'].includes(outcomeName.toLowerCase()))
    return outcomeName.trim();
  const descriptionParts = marketDescription?.split(' - ');
  return descriptionParts && descriptionParts.length > 1
    ? (descriptionParts.at(-1)?.trim() ?? '')
    : '';
}

function ingestPropLine(
  players: Map<string, MutablePlayer>,
  odds: PropLineOddsEvent | null,
) {
  for (const bookmaker of odds?.bookmakers ?? []) {
    for (const providerMarket of bookmaker.markets ?? []) {
      if (!(providerMarket.key in MARKET_LABELS)) continue;
      for (const outcome of providerMarket.outcomes ?? []) {
        const playerName = propLinePlayerName(
          providerMarket.description,
          outcome.name,
          outcome.description,
        );
        if (!playerName) continue;

        const player = mutablePlayer(players, playerName, {
          id: outcome.player_id,
        });
        const market = mutableMarket(player, providerMarket.key, 'propline');
        const side =
          providerMarket.key === 'player_anytime_td' &&
          !['yes', 'no'].includes(outcome.name.toLowerCase())
            ? 'yes'
            : marketSide(outcome.name);

        addLine(
          market,
          {
            bookmakerId: bookmaker.key,
            bookmakerName: bookmaker.title,
            point: toNumber(outcome.point),
            prices: {},
            lastUpdatedAt:
              providerMarket.last_update ?? bookmaker.last_update ?? null,
            deeplink: bookmaker.link ?? null,
            source: 'propline',
            isAlternate: false,
          },
          side,
          toNumber(outcome.price),
        );
      }
    }
  }
}

function sportsGameOddsPlayer(
  event: SportsGameOddsEvent,
  odd: SportsGameOddsOdd,
  playerMetadata: Map<string, SportsGameOddsPlayer>,
) {
  const playerId = odd.playerID ?? odd.statEntityID ?? null;
  if (!playerId || ['all', 'home', 'away'].includes(playerId)) return null;
  const player = playerMetadata.get(playerId) ?? event.players?.[playerId];
  if (!player) return null;
  const name = player.name ?? player.names?.display ?? null;
  if (!name) return null;
  return {
    id: player.playerID ?? playerId,
    name,
    position: player.position ?? null,
    teamId: player.teamID ?? null,
  };
}

function addSportsGameOddsLine(
  market: MutableMarket,
  bookmakerId: string,
  providerLine: SportsGameOddsBookLine,
  odd: SportsGameOddsOdd,
  side: MarketSide,
  isAlternate: boolean,
) {
  if (providerLine.available === false) return;
  const point = toNumber(
    providerLine.overUnder ??
      (isAlternate ? null : odd.bookOverUnder) ??
      (isAlternate ? null : odd.fairOverUnder),
  );

  addLine(
    market,
    {
      bookmakerId,
      bookmakerName: bookmakerName(bookmakerId),
      point,
      prices: {},
      lastUpdatedAt: providerLine.lastUpdatedAt ?? null,
      deeplink: providerLine.deeplink ?? null,
      source: 'sports-game-odds',
      isAlternate,
    },
    side,
    toNumber(providerLine.odds),
  );
}

function ingestSportsGameOdds(
  players: Map<string, MutablePlayer>,
  event: SportsGameOddsEvent | null,
  playerMetadata: Map<string, SportsGameOddsPlayer>,
) {
  if (!event) return;

  for (const odd of Object.values(event.odds ?? {})) {
    if (odd.periodID && odd.periodID !== 'game') continue;
    const marketKey = SPORTS_GAME_ODDS_MARKETS[odd.statID];
    if (!marketKey) continue;
    const playerDetails = sportsGameOddsPlayer(event, odd, playerMetadata);
    if (!playerDetails) continue;

    const player = mutablePlayer(players, playerDetails.name, playerDetails);
    const market = mutableMarket(player, marketKey, 'sports-game-odds');
    const side = marketSide(odd.sideID);

    for (const [bookmakerId, providerLine] of Object.entries(
      odd.byBookmaker ?? {},
    )) {
      addSportsGameOddsLine(
        market,
        bookmakerId,
        providerLine,
        odd,
        side,
        false,
      );
      for (const alternateLine of providerLine.altLines ?? []) {
        addSportsGameOddsLine(
          market,
          bookmakerId,
          alternateLine,
          odd,
          side,
          true,
        );
      }
    }
  }
}

function noVigProbability(line: SportsbookLine) {
  const over = americanImpliedProbability(line.prices.over ?? line.prices.yes);
  const under = americanImpliedProbability(line.prices.under ?? line.prices.no);
  if (over == null) return null;
  if (under == null) return over;
  return over / (over + under);
}

function dedupeLines(lines: SportsbookLine[]) {
  const deduped = new Map<string, SportsbookLine>();
  const ordered = [...lines].sort((left, right) => {
    if (left.source === right.source) return 0;
    return left.source === 'propline' ? -1 : 1;
  });

  for (const line of ordered) {
    const key = [
      line.bookmakerId,
      line.point == null ? 'none' : String(line.point),
    ].join(':');
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, line);
      continue;
    }
    for (const [side, price] of Object.entries(line.prices)) {
      const typedSide = side as MarketSide;
      existing.prices[typedSide] ??= price;
    }
    existing.deeplink ??= line.deeplink;
    existing.lastUpdatedAt ??= line.lastUpdatedAt;
  }

  return [...deduped.values()].sort((left, right) => {
    const bookmakerOrder = left.bookmakerName.localeCompare(
      right.bookmakerName,
    );
    if (bookmakerOrder) return bookmakerOrder;
    return (left.point ?? 0) - (right.point ?? 0);
  });
}

function finalizeMarket(market: MutableMarket): PlayerMarketSnapshot {
  const allLines = [...market.lines.values()];
  const primaryProviderLines = allLines.filter(
    (line) => line.source === 'propline' && !line.isAlternate,
  );
  const consensusCandidates = primaryProviderLines.length
    ? primaryProviderLines
    : allLines.filter((line) => !line.isAlternate);

  market.consensusLine ??= median(
    consensusCandidates
      .map((line) => line.point)
      .filter((point): point is number => point != null),
  );
  market.consensusOverProbability ??= median(
    consensusCandidates
      .map(noVigProbability)
      .filter((probability): probability is number => probability != null),
  );
  if (!market.booksContributing) {
    market.booksContributing = new Set(
      consensusCandidates.map((line) => line.bookmakerId),
    ).size;
  }
  if (!primaryProviderLines.length && allLines.length) {
    market.coverageSource = 'sports-game-odds';
  }

  return {
    marketKey: market.marketKey,
    label: market.label,
    consensusLine: market.consensusLine,
    consensusOverProbability: market.consensusOverProbability,
    booksContributing: market.booksContributing,
    primaryLines: dedupeLines(allLines.filter((line) => !line.isAlternate)),
    alternateLines: dedupeLines(allLines.filter((line) => line.isAlternate)),
    coverageSource: market.coverageSource,
  };
}

function marketValue(markets: Map<string, PlayerMarketSnapshot>, key: string) {
  return markets.get(key)?.consensusLine ?? null;
}

function fantasyProjectionBreakdownPpr(
  markets: Map<string, PlayerMarketSnapshot>,
) {
  let points = 0;
  const components: NonNullable<
    NflPlayerSnapshot['fantasyProjectionBreakdownPpr']
  >['components'] = [];

  const add = (
    marketKeys: string[],
    label: string,
    value: number | null,
    multiplier: number,
    inputKind: 'consensus-threshold' | 'no-vig-probability' =
      'consensus-threshold',
  ) => {
    if (value == null) return;
    const fantasyPoints = value * multiplier;
    points += fantasyPoints;
    components.push({
      marketKeys,
      label,
      input: value,
      inputKind,
      multiplier,
      fantasyPoints: Math.round(fantasyPoints * 100) / 100,
    });
  };

  add(['player_pass_yds'], 'Passing yards', marketValue(markets, 'player_pass_yds'), 0.04);
  add(['player_pass_tds'], 'Passing touchdowns', marketValue(markets, 'player_pass_tds'), 4);
  add(['player_pass_interceptions'], 'Interceptions', marketValue(markets, 'player_pass_interceptions'), -2);

  const rushYards = marketValue(markets, 'player_rush_yds');
  const receivingYards = marketValue(markets, 'player_reception_yds');
  if (rushYards != null || receivingYards != null) {
    add(
      ['player_rush_yds', 'player_reception_yds'],
      receivingYards == null ? 'Rushing yards' : 'Rushing + receiving yards',
      (rushYards ?? 0) + (receivingYards ?? 0),
      0.1,
    );
  } else {
    add(
      ['player_rush_reception_yds'],
      'Rushing + receiving yards',
      marketValue(markets, 'player_rush_reception_yds'),
      0.1,
    );
  }
  add(['player_receptions'], 'Receptions', marketValue(markets, 'player_receptions'), 1);

  const touchdownProbability =
    markets.get('player_anytime_td')?.consensusOverProbability ?? null;
  add(
    ['player_anytime_td'],
    'Anytime touchdown probability',
    touchdownProbability,
    6,
    'no-vig-probability',
  );

  if (components.length < 2) return null;
  return {
    total: Math.round(points * 10) / 10,
    method: 'sportsbook-threshold-proxy-v1' as const,
    components,
  };
}

function nearestProbabilityLine(lines: SportsbookLine[], target: number) {
  const priced = lines
    .map((line) => ({
      point: line.point,
      probability: americanImpliedProbability(
        line.prices.over ?? line.prices.yes,
      ),
    }))
    .filter(
      (item): item is { point: number; probability: number } =>
        item.point != null && item.probability != null,
    );
  if (!priced.length) return null;
  return priced.reduce((best, item) =>
    Math.abs(item.probability - target) < Math.abs(best.probability - target)
      ? item
      : best,
  ).point;
}

function boomBustRange(markets: PlayerMarketSnapshot[]): BoomBustRange | null {
  const yardageMarkets = markets
    .filter(
      (market) =>
        [
          'player_pass_yds',
          'player_rush_reception_yds',
          'player_reception_yds',
          'player_rush_yds',
        ].includes(market.marketKey) &&
        market.alternateLines.some((line) => line.point != null),
    )
    .sort(
      (left, right) => (right.consensusLine ?? 0) - (left.consensusLine ?? 0),
    );
  const market = yardageMarkets[0];
  if (!market) return null;

  const points = market.alternateLines
    .map((line) => line.point)
    .filter((point): point is number => point != null)
    .sort((left, right) => left - right);
  const floor =
    nearestProbabilityLine(market.alternateLines, 0.75) ?? points[0] ?? null;
  const ceiling =
    nearestProbabilityLine(market.alternateLines, 0.25) ??
    points.at(-1) ??
    null;

  return {
    marketKey: market.marketKey,
    floor,
    ceiling,
    source: 'sports-game-odds',
  };
}

function alternateMarketValue(
  markets: Map<string, PlayerMarketSnapshot>,
  key: string,
  targetProbability: number,
) {
  const market = markets.get(key);
  if (!market) return null;
  return (
    nearestProbabilityLine(market.alternateLines, targetProbability) ??
    market.consensusLine
  );
}

function fantasyRangePpr(
  markets: Map<string, PlayerMarketSnapshot>,
): FantasyRangePpr | null {
  const hasAlternateComponent = [
    'player_pass_yds',
    'player_pass_tds',
    'player_rush_yds',
    'player_reception_yds',
    'player_rush_reception_yds',
    'player_receptions',
  ].some((key) => (markets.get(key)?.alternateLines.length ?? 0) > 0);
  if (!hasAlternateComponent) return null;

  const components: FantasyRangePpr['components'] = [];
  const add = (
    marketKeys: string[],
    label: string,
    floorInput: number | null,
    ceilingInput: number | null,
    multiplier: number,
    inputMethod: FantasyRangePpr['components'][number]['inputMethod'] =
      'alternate-lines-targeting-75-and-25-percent-over',
  ) => {
    if (floorInput == null || ceilingInput == null) return;
    components.push({
      marketKeys,
      label,
      floorInput,
      ceilingInput,
      multiplier,
      floorPoints: Math.round(floorInput * multiplier * 100) / 100,
      ceilingPoints: Math.round(ceilingInput * multiplier * 100) / 100,
      inputMethod,
    });
  };

  add(['player_pass_yds'], 'Passing yards', alternateMarketValue(markets, 'player_pass_yds', 0.75), alternateMarketValue(markets, 'player_pass_yds', 0.25), 0.04);
  add(['player_pass_tds'], 'Passing touchdowns', alternateMarketValue(markets, 'player_pass_tds', 0.75), alternateMarketValue(markets, 'player_pass_tds', 0.25), 4);
  const interceptions = marketValue(markets, 'player_pass_interceptions');
  add(['player_pass_interceptions'], 'Interceptions', interceptions, interceptions, -2, 'consensus-held-constant');

  const floorRushYards = alternateMarketValue(markets, 'player_rush_yds', 0.75);
  const ceilingRushYards = alternateMarketValue(markets, 'player_rush_yds', 0.25);
  const floorReceivingYards = alternateMarketValue(markets, 'player_reception_yds', 0.75);
  const ceilingReceivingYards = alternateMarketValue(markets, 'player_reception_yds', 0.25);
  if (floorRushYards != null || ceilingRushYards != null || floorReceivingYards != null || ceilingReceivingYards != null) {
    add(
      ['player_rush_yds', 'player_reception_yds'],
      floorReceivingYards == null && ceilingReceivingYards == null ? 'Rushing yards' : 'Rushing + receiving yards',
      (floorRushYards ?? 0) + (floorReceivingYards ?? 0),
      (ceilingRushYards ?? 0) + (ceilingReceivingYards ?? 0),
      0.1,
    );
  } else {
    add(['player_rush_reception_yds'], 'Rushing + receiving yards', alternateMarketValue(markets, 'player_rush_reception_yds', 0.75), alternateMarketValue(markets, 'player_rush_reception_yds', 0.25), 0.1);
  }
  add(['player_receptions'], 'Receptions', alternateMarketValue(markets, 'player_receptions', 0.75), alternateMarketValue(markets, 'player_receptions', 0.25), 1);
  const touchdownProbability = markets.get('player_anytime_td')?.consensusOverProbability ?? null;
  add(['player_anytime_td'], 'Anytime touchdown probability', touchdownProbability, touchdownProbability, 6, 'consensus-held-constant');

  if (components.length < 2) return null;
  const lower = components.reduce((total, item) => total + item.floorPoints, 0);
  const upper = components.reduce((total, item) => total + item.ceilingPoints, 0);
  return {
    floor: Math.round(Math.min(lower, upper) * 10) / 10,
    ceiling: Math.round(Math.max(lower, upper) * 10) / 10,
    source: 'sports-game-odds',
    components,
  };
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

export async function getNflSnapshot(
  options: GetNflSnapshotOptions = {},
): Promise<NflSnapshot> {
  const now = options.now ?? new Date();
  const horizonDays = Math.min(
    Math.max(options.horizonDays ?? DEFAULT_HORIZON_DAYS, 1),
    21,
  );
  const maxGames = Math.min(
    Math.max(options.maxGames ?? DEFAULT_MAX_GAMES, 1),
    32,
  );
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
