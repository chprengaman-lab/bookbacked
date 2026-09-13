import { dedupeLines, type MutableMarket } from '@/lib/bookbacked/ingest';
import type {
  PlayerMarketSnapshot,
  SportsbookLine,
} from '@/lib/bookbacked/types';

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function americanImpliedProbability(
  price: number | null | undefined,
) {
  if (price == null || price === 0) return null;
  return price < 0 ? -price / (-price + 100) : 100 / (price + 100);
}

export function noVigProbability(line: SportsbookLine) {
  const over = americanImpliedProbability(line.prices.over ?? line.prices.yes);
  const under = americanImpliedProbability(line.prices.under ?? line.prices.no);
  if (over == null) return null;
  if (under == null) return over;
  return over / (over + under);
}

export function finalizeMarket(market: MutableMarket): PlayerMarketSnapshot {
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

export function marketValue(
  markets: Map<string, PlayerMarketSnapshot>,
  key: string,
) {
  return markets.get(key)?.consensusLine ?? null;
}
