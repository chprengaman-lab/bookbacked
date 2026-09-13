import {
  americanImpliedProbability,
  marketValue,
} from '@/lib/bookbacked/consensus';
import type {
  BoomBustRange,
  FantasyRangePpr,
  NflPlayerSnapshot,
  PlayerMarketSnapshot,
  SportsbookLine,
} from '@/lib/bookbacked/types';

export function fantasyProjectionBreakdownPpr(
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

  add(
    ['player_pass_yds'],
    'Passing yards',
    marketValue(markets, 'player_pass_yds'),
    0.04,
  );
  add(
    ['player_pass_tds'],
    'Passing touchdowns',
    marketValue(markets, 'player_pass_tds'),
    4,
  );
  add(
    ['player_pass_interceptions'],
    'Interceptions',
    marketValue(markets, 'player_pass_interceptions'),
    -2,
  );

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
  add(
    ['player_receptions'],
    'Receptions',
    marketValue(markets, 'player_receptions'),
    1,
  );

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

export function nearestProbabilityLine(
  lines: SportsbookLine[],
  target: number,
) {
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

export function boomBustRange(
  markets: PlayerMarketSnapshot[],
): BoomBustRange | null {
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

export function alternateMarketValue(
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

export function fantasyRangePpr(
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

  add(
    ['player_pass_yds'],
    'Passing yards',
    alternateMarketValue(markets, 'player_pass_yds', 0.75),
    alternateMarketValue(markets, 'player_pass_yds', 0.25),
    0.04,
  );
  add(
    ['player_pass_tds'],
    'Passing touchdowns',
    alternateMarketValue(markets, 'player_pass_tds', 0.75),
    alternateMarketValue(markets, 'player_pass_tds', 0.25),
    4,
  );
  const interceptions = marketValue(markets, 'player_pass_interceptions');
  add(
    ['player_pass_interceptions'],
    'Interceptions',
    interceptions,
    interceptions,
    -2,
    'consensus-held-constant',
  );

  const floorRushYards = alternateMarketValue(
    markets,
    'player_rush_yds',
    0.75,
  );
  const ceilingRushYards = alternateMarketValue(
    markets,
    'player_rush_yds',
    0.25,
  );
  const floorReceivingYards = alternateMarketValue(
    markets,
    'player_reception_yds',
    0.75,
  );
  const ceilingReceivingYards = alternateMarketValue(
    markets,
    'player_reception_yds',
    0.25,
  );
  if (
    floorRushYards != null ||
    ceilingRushYards != null ||
    floorReceivingYards != null ||
    ceilingReceivingYards != null
  ) {
    add(
      ['player_rush_yds', 'player_reception_yds'],
      floorReceivingYards == null && ceilingReceivingYards == null
        ? 'Rushing yards'
        : 'Rushing + receiving yards',
      (floorRushYards ?? 0) + (floorReceivingYards ?? 0),
      (ceilingRushYards ?? 0) + (ceilingReceivingYards ?? 0),
      0.1,
    );
  } else {
    add(
      ['player_rush_reception_yds'],
      'Rushing + receiving yards',
      alternateMarketValue(markets, 'player_rush_reception_yds', 0.75),
      alternateMarketValue(markets, 'player_rush_reception_yds', 0.25),
      0.1,
    );
  }
  add(
    ['player_receptions'],
    'Receptions',
    alternateMarketValue(markets, 'player_receptions', 0.75),
    alternateMarketValue(markets, 'player_receptions', 0.25),
    1,
  );
  const touchdownProbability =
    markets.get('player_anytime_td')?.consensusOverProbability ?? null;
  add(
    ['player_anytime_td'],
    'Anytime touchdown probability',
    touchdownProbability,
    touchdownProbability,
    6,
    'consensus-held-constant',
  );

  if (components.length < 2) return null;
  const lower = components.reduce(
    (total, item) => total + item.floorPoints,
    0,
  );
  const upper = components.reduce(
    (total, item) => total + item.ceilingPoints,
    0,
  );
  return {
    floor: Math.round(Math.min(lower, upper) * 10) / 10,
    ceiling: Math.round(Math.max(lower, upper) * 10) / 10,
    source: 'sports-game-odds',
    components,
  };
}
