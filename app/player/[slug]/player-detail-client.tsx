'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock3,
  Info,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adaptNflSnapshot,
  findSnapshotPlayer,
  formatAmerican,
  formatKickoff,
} from '@/lib/bookbacked/client';
import type {
  NflSnapshot,
  PlayerMarketSnapshot,
  SportsbookLine,
} from '@/lib/bookbacked/types';

export type FallbackPlayerProfile = {
  slug: string;
  name: string;
  team: string;
  opponent: string;
  pos: string;
  color: string;
  projection: number;
  coverageScore: number;
  floor: number;
  ceiling: number;
  markets: [
    { name: string; value: string },
    { name: string; value: string },
    { name: string; value: string },
  ];
};

type MarketRow = {
  key: string;
  market: string;
  consensus: string;
  byBook: Record<string, string>;
  bookCount: number;
};

type LadderRow = {
  label: string;
  point: number;
  market: string;
  price: string;
};

type DiscoveredLineRow = {
  key: string;
  market: string;
  book: string;
  point: string;
  overYes: string;
  underNo: string;
  kind: 'Primary' | 'Alternate';
  source: 'PropLine' | 'SportsGameOdds';
  updatedAt: string;
  marketOrder: number;
  sortPoint: number;
};

type ProjectionCalculationRow = {
  marketKeys: string[];
  label: string;
  input: number;
  inputKind: 'consensus-threshold' | 'no-vig-probability';
  multiplier: number;
  fantasyPoints: number;
};

type RangeCalculationRow = {
  marketKeys: string[];
  label: string;
  floorInput: number;
  ceilingInput: number;
  multiplier: number;
  floorPoints: number;
  ceilingPoints: number;
  inputMethod: 'alternate-lines-targeting-75-and-25-percent-over' | 'consensus-held-constant';
};

type DetailViewModel = {
  name: string;
  team: string;
  opponent: string;
  pos: string;
  color: string;
  projection: number;
  bookCount: number;
  floor: number;
  ceiling: number;
  kickoff: string;
  positionRank: number | null;
  books: { id: string; name: string }[];
  markets: MarketRow[];
  projectionComponents: ProjectionCalculationRow[];
  rangeComponents: RangeCalculationRow[];
  ladder: LadderRow[];
  allLines: DiscoveredLineRow[];
  altLineCount: number;
  capturedAt: string;
  source: 'live' | 'demo';
};

const MARKET_ORDER = [
  'player_pass_yds',
  'player_pass_tds',
  'player_pass_completions',
  'player_pass_attempts',
  'player_rush_yds',
  'player_rush_attempts',
  'player_reception_yds',
  'player_receptions',
  'player_rush_reception_yds',
  'player_anytime_td',
];

function percentage(value: number | null) {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function calculationInput(value: number, probability = false) {
  return probability ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
}

function scoringMultiplier(value: number) {
  const decimals = Math.abs(value) < 1 ? 2 : Number.isInteger(value) ? 0 : 1;
  return `× ${value < 0 ? '−' : ''}${Math.abs(value).toFixed(decimals)}`;
}

function marketConsensus(market: PlayerMarketSnapshot) {
  return market.marketKey === 'player_anytime_td'
    ? percentage(market.consensusOverProbability)
    : market.consensusLine?.toFixed(1) ?? '—';
}

function sportsbookValue(market: PlayerMarketSnapshot, line: SportsbookLine) {
  if (market.marketKey === 'player_anytime_td') {
    return formatAmerican(line.prices.yes ?? line.prices.over);
  }
  const point = line.point ?? market.consensusLine;
  const price = formatAmerican(line.prices.over ?? line.prices.yes);
  if (point == null) return price;
  return `O ${point.toFixed(1)} · ${price}`;
}

function chooseLine(market: PlayerMarketSnapshot, bookmakerId: string) {
  const options = market.primaryLines.filter(
    (line) => line.bookmakerId === bookmakerId,
  );
  if (!options.length) return null;
  if (market.consensusLine == null) return options[0];
  const consensus = market.consensusLine;
  return options.reduce((best, line) =>
    Math.abs((line.point ?? consensus) - consensus) <
    Math.abs((best.point ?? consensus) - consensus)
      ? line
      : best,
  );
}

function chosenBooks(markets: PlayerMarketSnapshot[]) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const market of markets) {
    for (const line of market.primaryLines) {
      const current = counts.get(line.bookmakerId);
      counts.set(line.bookmakerId, {
        name: line.bookmakerName,
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  const preferred = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'fanatics'];
  return [...counts.entries()]
    .sort(([leftId, left], [rightId, right]) => {
      const countOrder = right.count - left.count;
      if (countOrder) return countOrder;
      const leftPreferred = preferred.indexOf(leftId);
      const rightPreferred = preferred.indexOf(rightId);
      return (leftPreferred < 0 ? 99 : leftPreferred) -
        (rightPreferred < 0 ? 99 : rightPreferred);
    })
    .map(([id, value]) => ({ id, name: value.name }));
}

function discoveredLines(markets: PlayerMarketSnapshot[]) {
  return markets
    .flatMap((market) =>
      [...market.primaryLines, ...market.alternateLines].map((line, index) => ({
        key: `${market.marketKey}:${line.source}:${line.bookmakerId}:${line.point ?? 'none'}:${line.isAlternate ? 'alt' : 'main'}:${index}`,
        market: market.label,
        book: line.bookmakerName,
        point: line.point == null ? '—' : line.point.toFixed(1),
        overYes: formatAmerican(line.prices.over ?? line.prices.yes),
        underNo: formatAmerican(line.prices.under ?? line.prices.no),
        kind: line.isAlternate ? ('Alternate' as const) : ('Primary' as const),
        source:
          line.source === 'propline'
            ? ('PropLine' as const)
            : ('SportsGameOdds' as const),
        updatedAt: line.lastUpdatedAt
          ? new Date(line.lastUpdatedAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : '—',
        marketOrder: MARKET_ORDER.indexOf(market.marketKey),
        sortPoint: line.point ?? Number.NEGATIVE_INFINITY,
      })),
    )
    .sort((left, right) => {
      return (
        (left.marketOrder < 0 ? 99 : left.marketOrder) -
          (right.marketOrder < 0 ? 99 : right.marketOrder) ||
        (left.kind === right.kind ? 0 : left.kind === 'Primary' ? -1 : 1) ||
        left.sortPoint - right.sortPoint ||
        left.book.localeCompare(right.book)
      );
    });
}

function alternateLadder(market: PlayerMarketSnapshot | undefined) {
  if (!market) return [];
  const byPoint = new Map<number, SportsbookLine>();
  for (const line of market.alternateLines) {
    if (line.point == null) continue;
    const existing = byPoint.get(line.point);
    if (!existing || existing.prices.over == null) byPoint.set(line.point, line);
  }
  const lines = [...byPoint.values()].sort(
    (left, right) => (left.point ?? 0) - (right.point ?? 0),
  );
  if (!lines.length) return [];
  const indexes = [
    ...new Set([
      0,
      Math.round((lines.length - 1) / 3),
      Math.round(((lines.length - 1) * 2) / 3),
      lines.length - 1,
    ]),
  ];
  const labels = ['Floor', 'Safe', 'Upside', 'Boom'];
  return indexes.map((index, ladderIndex) => ({
    label:
      labels[
        Math.round((ladderIndex / Math.max(indexes.length - 1, 1)) * 3)
      ],
    point: lines[index].point!,
    market: market.label,
    price: formatAmerican(
      lines[index].prices.over ?? lines[index].prices.yes,
    ),
  }));
}

function liveViewModel(
  snapshot: NflSnapshot,
  slug: string,
  fallbackProfile: FallbackPlayerProfile | null,
): DetailViewModel | null {
  const match = findSnapshotPlayer(snapshot, slug);
  if (!match) return null;
  const { game, player } = match;
  const projection = player.fantasyProjectionPpr;
  if (projection == null) return null;
  const adapted = adaptNflSnapshot(snapshot);
  const uiPlayer = adapted.players.find((candidate) => candidate.slug === slug);
  const team =
    player.teamId === game.homeTeam.id
      ? game.homeTeam
      : player.teamId === game.awayTeam.id
        ? game.awayTeam
        : null;
  const opponent =
    team?.id === game.homeTeam.id
      ? game.awayTeam
      : team?.id === game.awayTeam.id
        ? game.homeTeam
        : null;
  const isHome = team?.id === game.homeTeam.id;
  const markets = [...player.markets]
    .filter(
      (market) =>
        market.consensusLine != null ||
        market.consensusOverProbability != null ||
        market.primaryLines.length,
    )
    .sort((left, right) => {
      const leftIndex = MARKET_ORDER.indexOf(left.marketKey);
      const rightIndex = MARKET_ORDER.indexOf(right.marketKey);
      return (leftIndex < 0 ? 99 : leftIndex) -
        (rightIndex < 0 ? 99 : rightIndex);
    });
  const books = chosenBooks(markets);
  const marketRows = markets.map((market) => ({
    key: market.marketKey,
    market: market.label,
    consensus: marketConsensus(market),
    byBook: Object.fromEntries(
      books.map((book) => {
        const line = chooseLine(market, book.id);
        return [book.id, line ? sportsbookValue(market, line) : '—'];
      }),
    ),
    bookCount: market.booksContributing,
  }));
  const ladderMarket = player.markets.find(
    (market) => market.marketKey === player.boomBust?.marketKey,
  );
  const positionRank = uiPlayer
    ? adapted.players
        .filter((candidate) => candidate.pos === uiPlayer.pos)
        .findIndex((candidate) => candidate.slug === slug)
    : -1;
  const bookCount = new Set(
    player.markets.flatMap((market) =>
      market.primaryLines.map((line) => line.bookmakerId),
    ),
  ).size;

  return {
    name: player.name,
    team:
      team?.abbreviation ??
      team?.key?.toUpperCase() ??
      fallbackProfile?.team ??
      'NFL',
    opponent: opponent
      ? `${isHome ? 'vs' : 'at'} ${opponent.abbreviation ?? opponent.name}`
      : fallbackProfile?.opponent ?? 'upcoming game',
    pos: player.position ?? fallbackProfile?.pos ?? 'NFL',
    color: uiPlayer?.color ?? fallbackProfile?.color ?? '#334155',
    projection,
    bookCount,
    floor: player.fantasyRangePpr?.floor ?? projection,
    ceiling: player.fantasyRangePpr?.ceiling ?? projection,
    kickoff: formatKickoff(game.commenceTime),
    positionRank: !uiPlayer || positionRank < 0 ? null : positionRank + 1,
    books,
    markets: marketRows,
    projectionComponents: player.fantasyProjectionBreakdownPpr?.components ?? [],
    rangeComponents: player.fantasyRangePpr?.components ?? [],
    ladder: alternateLadder(ladderMarket),
    allLines: discoveredLines(markets),
    altLineCount: player.markets.reduce(
      (total, market) => total + market.alternateLines.length,
      0,
    ),
    capturedAt: new Date(snapshot.generatedAt).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    source: 'live',
  };
}

function fallbackViewModel(profile: FallbackPlayerProfile): DetailViewModel {
  return {
    ...profile,
    bookCount: 0,
    kickoff: 'Sample slate',
    positionRank: null,
    books: [],
    markets: profile.markets.map((market) => ({
      key: market.name,
      market: market.name,
      consensus: market.value,
      byBook: {},
      bookCount: 0,
    })),
    projectionComponents: [],
    rangeComponents: [],
    ladder: [],
    allLines: [],
    altLineCount: 0,
    capturedAt: 'Static sample',
    source: 'demo',
  };
}

export default function PlayerDetailClient({
  slug,
  fallbackProfile,
}: {
  slug: string;
  fallbackProfile: FallbackPlayerProfile | null;
}) {
  const [snapshot, setSnapshot] = useState<NflSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'live' | 'fallback'>(
    'loading',
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/nfl/snapshot?maxGames=16&horizonDays=8', {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('NFL snapshot unavailable');
        return (await response.json()) as NflSnapshot;
      })
      .then((data) => {
        setSnapshot(data);
        setStatus(findSnapshotPlayer(data, slug) ? 'live' : 'fallback');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('fallback');
      });
    return () => controller.abort();
  }, [slug]);

  const profile = useMemo(
    () =>
      (snapshot ? liveViewModel(snapshot, slug, fallbackProfile) : null) ??
      (fallbackProfile ? fallbackViewModel(fallbackProfile) : null),
    [fallbackProfile, slug, snapshot],
  );

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <DetailHeader status={status} />
        <div className="page-shell player-detail-page">
          <a className="back-link" href="/?view=cheatsheet">
            <ArrowLeft aria-hidden="true" /> Back to rankings
          </a>
          <section className="board-card empty-state">
            <BarChart3 aria-hidden="true" />
            <h1>
              {status === 'loading'
                ? 'Loading sportsbook markets'
                : 'No active markets found'}
            </h1>
            <p>
              {status === 'loading'
                ? 'BookBacked is assembling the latest NFL board.'
                : 'This player is not on the current NFL sportsbook slate.'}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const agreement =
    profile.bookCount >= 10
      ? 'Broad'
      : profile.bookCount >= 5
        ? 'Solid'
        : profile.source === 'live'
          ? 'Limited'
          : 'Sample';
  return (
    <main className="min-h-screen bg-background text-foreground">
      <DetailHeader status={profile.source === 'live' ? 'live' : status} />
      <div className="page-shell player-detail-page">
        <a className="back-link" href="/?view=cheatsheet">
          <ArrowLeft aria-hidden="true" /> Back to rankings
        </a>

        <section className="player-detail-hero">
          <div className="player-hero-identity">
            <div
              className="team-badge player-hero-badge"
              style={{ backgroundColor: profile.color }}
            >
              {profile.team}
            </div>
            <div>
              <div className="eyebrow">
                {profile.pos}
                {profile.positionRank ? ` #${profile.positionRank}` : ''} ·{' '}
                PLAYER ZOOM · {profile.source === 'live' ? 'LIVE NFL SLATE' : 'SAMPLE'}
              </div>
              <h1>{profile.name}</h1>
              <p>
                {profile.pos} · {profile.team} {profile.opponent} ·{' '}
                {profile.kickoff}
              </p>
            </div>
          </div>
          <div className="player-hero-stats">
            <div><span>MARKET PROJ</span><strong>{profile.projection.toFixed(1)}</strong><small>PPR points</small></div>
            <div><span>BOOK COVERAGE</span><strong>{profile.bookCount || '—'}</strong><small>sportsbooks</small></div>
            <div><span>OUTCOME RANGE</span><strong className="range-stat">{profile.rangeComponents.length ? `${profile.floor.toFixed(1)}–${profile.ceiling.toFixed(1)}` : '—'}</strong><small>{profile.rangeComponents.length ? 'alt-line PPR range' : 'no alternate-line range'}</small></div>
          </div>
        </section>

        <section className="detail-signal-strip">
          <div><ShieldCheck aria-hidden="true" /><span>MARKET READ</span><strong>{profile.positionRank ? `${profile.pos}${profile.positionRank} on slate` : profile.source === 'live' ? 'Active slate' : 'Sample profile'}</strong></div>
          <div><TrendingUp aria-hidden="true" /><span>ALT-LINE DEPTH</span><strong>{profile.altLineCount} lines</strong></div>
          <div><BarChart3 aria-hidden="true" /><span>BOOK AGREEMENT</span><strong>{agreement}</strong></div>
          <a href={`/?view=compare&player=${slug}`}><Swords aria-hidden="true" /> Compare {profile.name.split(' ')[0]}</a>
        </section>

        <div className="player-detail-grid">
          <section className="sportsbook-card">
            <div className="detail-card-head">
              <div><span>SPORTSBOOK BOARD</span><h2>Current player markets</h2><p>{profile.capturedAt} · {profile.source === 'live' ? 'Live provider snapshot' : 'Fallback sample'}</p></div>
              <Badge variant="outline"><Clock3 aria-hidden="true" /> {profile.books.length} books</Badge>
            </div>
            <div className="market-number-guide"><Info aria-hidden="true" /><p><strong>How to read this:</strong> “O 269.5 · −110” means over 269.5 at −110 American odds. Consensus is the median posted threshold across contributing books; anytime TD consensus is a no-vig probability. Coverage is the number of books used.</p></div>
            <Table className="odds-detail-table">
              <TableHeader>
                <TableRow>
                  <TableHead>MARKET</TableHead>
                  {profile.books.map((book) => <TableHead key={book.id}>{book.name.toUpperCase()}</TableHead>)}
                  <TableHead>CONSENSUS</TableHead>
                  <TableHead>COVERAGE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.markets.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell><strong>{row.market}</strong></TableCell>
                    {profile.books.map((book) => <TableCell key={book.id}>{row.byBook[book.id] ?? '—'}</TableCell>)}
                    <TableCell><strong className="consensus-number">{row.consensus}</strong></TableCell>
                    <TableCell><Badge variant="outline" className={row.bookCount >= 8 ? 'profile-value' : 'profile-stable'}>{row.bookCount ? `${row.bookCount} books` : 'Sample'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <aside className="fantasy-translation-card">
            <div className="translation-icon"><Sparkles aria-hidden="true" /></div>
            <span>FANTASY TRANSLATION</span>
            <h2>Exact v1 calculation: {profile.projection.toFixed(1)} PPR</h2>
            <div className="translation-total"><div><span>SUM OF COMPONENTS</span><strong>{profile.projection.toFixed(1)}</strong></div><Badge>PPR</Badge></div>
            {profile.projectionComponents.length ? (
              <div className="projection-equation" aria-label={`${profile.name} projection calculation`}>
                <div className="projection-equation-head"><span>MARKET INPUT</span><span>SCORING</span><span>POINTS</span></div>
                {profile.projectionComponents.map((component) => (
                  <div key={component.marketKeys.join(':')}>
                    <span>{component.label}<small>{calculationInput(component.input, component.inputKind === 'no-vig-probability')}</small></span>
                    <strong>{scoringMultiplier(component.multiplier)}</strong>
                    <strong>{component.fantasyPoints.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="prototype-calculation-note"><Info aria-hidden="true" /><p><strong>This number is a prototype sample, not a live calculation.</strong> The displayed {profile.projection.toFixed(1)} projection and {profile.floor.toFixed(1)}–{profile.ceiling.toFixed(1)} range were seeded for the interface; there are no sportsbook inputs behind them.</p></div>
            )}
            <div className="model-caveat"><Info aria-hidden="true" /><p><strong>Key v1 limitation:</strong> sportsbook lines are thresholds or approximate medians—not expected values. That proxy is reasonable for yardage, but much weaker for discrete touchdown and interception markets. This is the boom-or-bust issue to evaluate next.</p></div>
          </aside>
        </div>

        <section className="alt-lines-card">
          <div className="detail-card-head"><div><span>BOOM / BUST PROFILE</span><h2>Alternate-line ladder</h2><p>SportsGameOdds thresholds show how sportsbooks price downside and upside.</p></div><Badge variant="outline">{profile.altLineCount} available lines</Badge></div>
          {profile.ladder.length ? (
            <div className="alt-ladder">
              {profile.ladder.map((row, index) => <div key={`${row.point}-${row.label}`}><span>{row.label}</span><strong>{row.point.toFixed(1)}+ {row.market.toLowerCase()}</strong><small>{row.price}</small><div><i style={{ width: `${88 - index * 19}%` }} /></div></div>)}
            </div>
          ) : (
            <div className="empty-state"><BarChart3 aria-hidden="true" /><h3>No alternate lines on this snapshot</h3><p>Consensus markets remain available above.</p></div>
          )}
          {profile.rangeComponents.length ? (
            <div className="range-calculation">
              <div className="range-calculation-copy"><span>RANGE CALCULATION</span><h3>How {profile.floor.toFixed(1)}–{profile.ceiling.toFixed(1)} is derived</h3><p>The floor uses alternate thresholds priced nearest a 75% chance of going over; the ceiling uses those nearest 25%. Missing alternate components fall back to consensus, while interceptions and anytime-TD probability stay fixed.</p></div>
              <div className="range-equation-head"><span>COMPONENT</span><span>FLOOR INPUT → PTS</span><span>CEILING INPUT → PTS</span></div>
              {profile.rangeComponents.map((component) => (
                <div className="range-equation-row" key={component.marketKeys.join(':')}>
                  <span>{component.label}<small>{component.inputMethod === 'consensus-held-constant' ? 'held at consensus' : 'alternate-line targets'}</small></span>
                  <strong>{calculationInput(component.floorInput, component.label.includes('probability'))} {scoringMultiplier(component.multiplier)} = {component.floorPoints.toFixed(2)}</strong>
                  <strong>{calculationInput(component.ceilingInput, component.label.includes('probability'))} {scoringMultiplier(component.multiplier)} = {component.ceilingPoints.toFixed(2)}</strong>
                </div>
              ))}
              <div className="range-equation-total"><span>ROUNDED TOTAL</span><strong>{profile.floor.toFixed(1)} PPR</strong><strong>{profile.ceiling.toFixed(1)} PPR</strong></div>
            </div>
          ) : null}
          <div className="detail-disclaimer"><Check aria-hidden="true" /> PropLine supplies primary consensus coverage; SportsGameOdds enriches the board with additional books and alternate lines.</div>
        </section>

        <section className="all-lines-card">
          <div className="detail-card-head">
            <div><span>FULL LINE INVENTORY</span><h2>Every discovered line</h2><p>Primary and alternate prices across every sportsbook in this snapshot.</p></div>
            <Badge variant="outline">{profile.allLines.length} lines</Badge>
          </div>
          {profile.allLines.length ? (
            <Table className="all-lines-table">
              <TableHeader>
                <TableRow>
                  <TableHead>MARKET</TableHead>
                  <TableHead>SPORTSBOOK</TableHead>
                  <TableHead>TYPE</TableHead>
                  <TableHead>LINE</TableHead>
                  <TableHead>OVER / YES</TableHead>
                  <TableHead>UNDER / NO</TableHead>
                  <TableHead>SOURCE</TableHead>
                  <TableHead>UPDATED</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.allLines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell><strong>{line.market}</strong></TableCell>
                    <TableCell>{line.book}</TableCell>
                    <TableCell><Badge variant="outline" className={line.kind === 'Alternate' ? 'profile-ceiling' : 'profile-stable'}>{line.kind}</Badge></TableCell>
                    <TableCell><strong className="consensus-number">{line.point}</strong></TableCell>
                    <TableCell>{line.overYes}</TableCell>
                    <TableCell>{line.underNo}</TableCell>
                    <TableCell>{line.source}</TableCell>
                    <TableCell>{line.updatedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state"><BarChart3 aria-hidden="true" /><h3>Live line inventory unavailable</h3><p>This sample player will populate when they appear on the active sportsbook slate.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}

function DetailHeader({ status }: { status: 'loading' | 'live' | 'fallback' }) {
  return (
    <header className="site-header">
      <div className="page-shell header-inner detail-header-inner">
        <a className="brand-lockup" href="/" aria-label="BookBacked home">
          <div className="brand-mark" aria-hidden="true"><span>B</span></div>
          <div><div className="brand-name">BOOKBACKED</div><div className="brand-subtitle">FOLLOW THE MONEY</div></div>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <a className="nav-item nav-item-active" href="/">Rankings</a>
          <a className="nav-item" href="/?view=compare">Compare</a>
          <a className="nav-item" href="/?view=optimizer">Optimizer</a>
        </nav>
        <div className="header-actions">
          <span className={`live-pill ${status === 'live' ? 'is-live' : ''} ${
            status === 'fallback' ? 'is-fallback' : ''
          }`}>
            <span className="live-dot" />
            {status === 'loading' ? 'Loading lines' : status === 'live' ? 'Lines live' : 'Sample fallback'}
          </span>
        </div>
      </div>
    </header>
  );
}
