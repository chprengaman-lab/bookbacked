'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  translationMarkets: { name: string; value: string }[];
  ladder: LadderRow[];
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
    .slice(0, 5)
    .map(([id, value]) => ({ id, name: value.name }));
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
): DetailViewModel | null {
  const match = findSnapshotPlayer(snapshot, slug);
  if (!match) return null;
  const { game, player } = match;
  const projection = player.fantasyProjectionPpr;
  if (projection == null) return null;
  const adapted = adaptNflSnapshot(snapshot);
  const uiPlayer = adapted.players.find((candidate) => candidate.slug === slug);
  if (!uiPlayer) return null;
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
  const marketRows = markets.slice(0, 7).map((market) => ({
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
  const positionRank = adapted.players
    .filter((candidate) => candidate.pos === uiPlayer.pos)
    .findIndex((candidate) => candidate.slug === slug);

  return {
    name: player.name,
    team: team?.abbreviation ?? team?.key?.toUpperCase() ?? 'NFL',
    opponent: opponent
      ? `${isHome ? 'vs' : 'at'} ${opponent.abbreviation ?? opponent.name}`
      : 'upcoming game',
    pos: player.position ?? 'NFL',
    color: uiPlayer.color,
    projection,
    bookCount: uiPlayer.bookCount,
    floor: player.fantasyRangePpr?.floor ?? projection,
    ceiling: player.fantasyRangePpr?.ceiling ?? projection,
    kickoff: formatKickoff(game.commenceTime),
    positionRank: positionRank < 0 ? null : positionRank + 1,
    books,
    markets: marketRows,
    translationMarkets: marketRows
      .slice(0, 3)
      .map((market) => ({ name: market.market, value: market.consensus })),
    ladder: alternateLadder(ladderMarket),
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
    translationMarkets: profile.markets,
    ladder: [],
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
      (snapshot ? liveViewModel(snapshot, slug) : null) ??
      (fallbackProfile ? fallbackViewModel(fallbackProfile) : null),
    [fallbackProfile, slug, snapshot],
  );

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <DetailHeader status={status} />
        <div className="page-shell player-detail-page">
          <Link className="back-link" href="/?view=cheatsheet">
            <ArrowLeft aria-hidden="true" /> Back to rankings
          </Link>
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
  const midpoint = (profile.floor + profile.ceiling) / 2;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <DetailHeader status={profile.source === 'live' ? 'live' : status} />
      <div className="page-shell player-detail-page">
        <Link className="back-link" href="/?view=cheatsheet">
          <ArrowLeft aria-hidden="true" /> Back to rankings
        </Link>

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
                {profile.source === 'live' ? 'LIVE NFL SLATE' : 'SAMPLE'}
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
            <div><span>OUTCOME RANGE</span><strong className="range-stat">{profile.floor.toFixed(1)}–{profile.ceiling.toFixed(1)}</strong><small>alt-line PPR range</small></div>
          </div>
        </section>

        <section className="detail-signal-strip">
          <div><ShieldCheck aria-hidden="true" /><span>MARKET READ</span><strong>{profile.positionRank ? `${profile.pos}${profile.positionRank} on slate` : 'Sample profile'}</strong></div>
          <div><TrendingUp aria-hidden="true" /><span>ALT-LINE DEPTH</span><strong>{profile.altLineCount} lines</strong></div>
          <div><BarChart3 aria-hidden="true" /><span>BOOK AGREEMENT</span><strong>{agreement}</strong></div>
          <Link href={`/?view=compare&player=${slug}`}><Swords aria-hidden="true" /> Compare {profile.name.split(' ')[0]}</Link>
        </section>

        <div className="player-detail-grid">
          <section className="sportsbook-card">
            <div className="detail-card-head">
              <div><span>SPORTSBOOK BOARD</span><h2>Current player markets</h2><p>{profile.capturedAt} · {profile.source === 'live' ? 'Live provider snapshot' : 'Fallback sample'}</p></div>
              <Badge variant="outline"><Clock3 aria-hidden="true" /> {profile.books.length} books</Badge>
            </div>
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
                    <TableCell><Badge variant="outline" className={row.bookCount >= 8 ? 'profile-ceiling' : 'profile-stable'}>{row.bookCount ? `${row.bookCount} books` : 'Sample'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <aside className="fantasy-translation-card">
            <div className="translation-icon"><Sparkles aria-hidden="true" /></div>
            <span>FANTASY TRANSLATION</span>
            <h2>How the market gets to {profile.projection.toFixed(1)}</h2>
            <div className="translation-total"><div><span>ALT-LINE MIDPOINT</span><strong>{midpoint.toFixed(1)}</strong></div><Badge>PPR</Badge></div>
            <div className="translation-lines">
              {profile.translationMarkets.map((market, index) => <div key={market.name}><span>{market.name}</span><strong>{market.value}</strong><i style={{ width: `${82 - index * 13}%` }} /></div>)}
            </div>
            <p><Info aria-hidden="true" /> Consensus props are translated with standard PPR scoring. No proprietary prediction model is added.</p>
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
          <div className="detail-disclaimer"><Check aria-hidden="true" /> PropLine supplies primary consensus coverage; SportsGameOdds enriches the board with additional books and alternate lines.</div>
        </section>
      </div>
    </main>
  );
}

function DetailHeader({ status }: { status: 'loading' | 'live' | 'fallback' }) {
  return (
    <header className="site-header">
      <div className="page-shell header-inner detail-header-inner">
        <Link className="brand-lockup" href="/" aria-label="BookBacked home">
          <div className="brand-mark" aria-hidden="true"><span>B</span></div>
          <div><div className="brand-name">BOOKBACKED</div><div className="brand-subtitle">BACKED BY THE BOOKS</div></div>
        </Link>
        <nav className="main-nav" aria-label="Primary navigation">
          <Link className="nav-item" href="/">Compare</Link>
          <Link className="nav-item nav-item-active" href="/?view=cheatsheet">Rankings</Link>
          <Link className="nav-item" href="/?view=optimizer">Optimizer</Link>
        </nav>
        <div className="header-actions">
          <span className={`live-pill ${status === 'fallback' ? 'is-fallback' : ''}`}>
            <span className="live-dot" />
            {status === 'loading' ? 'Loading lines' : status === 'live' ? 'Lines live' : 'Sample fallback'}
          </span>
        </div>
      </div>
    </header>
  );
}
