import {
  bookmakerName,
  normalizedName,
  slugify,
  toNumber,
} from '@/lib/bookbacked/matching';
import type { PropLineOddsEvent } from '@/lib/bookbacked/providers/propline';
import type {
  SportsGameOddsBookLine,
  SportsGameOddsEvent,
  SportsGameOddsOdd,
  SportsGameOddsPlayer,
} from '@/lib/bookbacked/providers/sports-game-odds';
import type {
  MarketSide,
  OddsProvider,
  SportsbookLine,
} from '@/lib/bookbacked/types';

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

export const SPORTS_GAME_ODDS_MARKETS: Record<string, string> = {
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

export type MutableMarket = {
  marketKey: string;
  label: string;
  consensusLine: number | null;
  consensusOverProbability: number | null;
  booksContributing: number;
  coverageSource: OddsProvider;
  lines: Map<string, SportsbookLine>;
};

export type MutablePlayer = {
  id: string | null;
  slug: string;
  name: string;
  position: string | null;
  teamId: string | null;
  markets: Map<string, MutableMarket>;
};

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

export function mutablePlayer(
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

export function mutableMarket(
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

export function lineKey(
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

export function addLine(
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

export function propLinePlayerName(
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

export function ingestPropLine(
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

export function sportsGameOddsPlayer(
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

export function addSportsGameOddsLine(
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

export function ingestSportsGameOdds(
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

export function dedupeLines(lines: SportsbookLine[]) {
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
