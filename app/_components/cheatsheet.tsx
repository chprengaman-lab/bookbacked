'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Gauge,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
} from 'lucide-react';

import {
  PlayerIdentity,
  playerHref,
} from '@/app/_components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UiPlayer, UiSnapshot } from '@/lib/bookbacked/client';

type SortKey = 'projection' | 'coverageScore';

const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'] as const;

function WeekControls({
  onOptimize,
  slateLabel,
}: {
  onOptimize: () => void;
  slateLabel: string;
}) {
  return (
    <div className="heading-actions">
      <Button variant="outline" className="week-button">
        {slateLabel} <ChevronDown aria-hidden="true" />
      </Button>
      <Button className="optimize-button" onClick={onOptimize}>
        <Sparkles aria-hidden="true" /> Optimize lineup
      </Button>
    </div>
  );
}

export function Cheatsheet({
  players,
  summary,
  onCompare,
  onOptimize,
}: {
  players: UiPlayer[];
  summary: UiSnapshot | null;
  onCompare: () => void;
  onOptimize: () => void;
}) {
  const [activePosition, setActivePosition] =
    useState<(typeof positions)[number]>('ALL');
  const [query, setQuery] = useState('');
  const [scoring, setScoring] = useState('PPR');
  const [sortKey, setSortKey] = useState<SortKey>('coverageScore');

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = players.filter((player) => {
      const matchesPosition =
        activePosition === 'ALL' ||
        player.pos === activePosition ||
        (activePosition === 'FLEX' && ['RB', 'WR', 'TE'].includes(player.pos));
      const matchesQuery =
        !normalizedQuery ||
        `${player.name} ${player.team}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesPosition && matchesQuery;
    });
    return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activePosition, players, query, sortKey]);

  const scoringAdjustment =
    scoring === 'PPR' ? 0 : scoring === 'HALF' ? -1.4 : -2.8;

  return (
    <div className="page-shell page-content">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <Activity aria-hidden="true" /> WEEKLY MARKET BOARD
          </div>
          <h1>Live NFL player rankings</h1>
          <p>
            Consensus fantasy expectations translated directly from current
            player-prop markets.
          </p>
        </div>
        <WeekControls
          onOptimize={onOptimize}
          slateLabel={summary?.slateLabel ?? 'Sample slate'}
        />
      </section>

      <section className="signal-grid" aria-label="Weekly market summary">
        <article className="signal-card signal-card-strong">
          <div className="signal-icon">
            <Gauge aria-hidden="true" />
          </div>
          <div>
            <span>Upcoming board</span>
            <strong>{summary?.slateLabel ?? 'Sample slate'}</strong>
          </div>
          <div className="signal-stat">
            <strong>{summary?.gameCount ?? 6}</strong>
            <span>games</span>
          </div>
        </article>
        <article className="signal-card">
          <div className="signal-icon">
            <ArrowUpRight aria-hidden="true" />
          </div>
          <div>
            <span>Top consensus</span>
            <strong>{players[0]?.name ?? 'Loading players'}</strong>
          </div>
          <div className="signal-stat positive">
            <strong>{players[0]?.projection.toFixed(1) ?? '—'}</strong>
            <span>PPR</span>
          </div>
        </article>
        <article className="signal-card">
          <div className="signal-icon">
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <span>Market coverage</span>
            <strong>{summary?.bookCount ?? 8} sportsbooks</strong>
          </div>
          <div className="signal-stat">
            <strong>{players.length}</strong>
            <span>players</span>
          </div>
        </article>
      </section>

      <section className="board-card">
        <div className="board-toolbar">
          <div className="position-tabs" role="tablist" aria-label="Position">
            {positions.map((position) => (
              <button
                key={position}
                className={
                  activePosition === position
                    ? 'position-tab active'
                    : 'position-tab'
                }
                type="button"
                role="tab"
                aria-selected={activePosition === position}
                onClick={() => setActivePosition(position)}
              >
                {position}
              </button>
            ))}
          </div>
          <div className="toolbar-controls">
            <div className="search-wrap">
              <Search aria-hidden="true" />
              <Input
                aria-label="Search players"
                placeholder="Search players"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <label className="select-wrap">
              <span className="sr-only">Scoring format</span>
              <select
                value={scoring}
                onChange={(event) => setScoring(event.target.value)}
              >
                <option value="PPR">PPR</option>
                <option value="HALF">Half PPR</option>
                <option value="STD">Standard</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="table-intro">
          <div>
            <h2>Consensus cheatsheet</h2>
            <p>
              {summary
                ? `Updated ${new Date(summary.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · PropLine + SportsGameOdds`
                : 'Prototype sample values · not live or calculated from current lines'}
            </p>
          </div>
          <Button variant="ghost" className="method-button">
            <CircleHelp aria-hidden="true" /> Sportsbook-derived, no custom
            model
          </Button>
        </div>

        <div className="market-snapshot-definition">
          <Info aria-hidden="true" />
          <p>
            <strong>Market snapshot</strong> shows each prop name with its
            consensus sportsbook threshold. ANY TD is shown as American odds.
            V1 PPR projection treats those thresholds as outcome estimates;
            outcome range uses priced alternate lines.
          </p>
        </div>

        {filteredPlayers.length ? (
          <Table className="player-table">
            <TableHeader>
              <TableRow>
                <TableHead className="rank-col">RK</TableHead>
                <TableHead>PLAYER</TableHead>
                <TableHead>MARKET SNAPSHOT</TableHead>
                <TableHead>
                  <button
                    className="sortable"
                    onClick={() => setSortKey('projection')}
                  >
                    PROJ <ArrowDownUp aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="sortable"
                    onClick={() => setSortKey('coverageScore')}
                  >
                    MARKET COVERAGE <ArrowDownUp aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead>OUTCOME RANGE</TableHead>
                <TableHead>PROFILE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player, index) => (
                <TableRow
                  key={player.name}
                  className="player-ranking-row"
                >
                  <TableCell className="rank-cell">
                    <a
                      className="player-row-link"
                      href={playerHref(player)}
                      aria-label={`Open every discovered line for ${player.name}`}
                    >
                      <span className="sr-only">Open {player.name}</span>
                    </a>
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="player-detail-link">
                      <PlayerIdentity player={player} />
                      <ArrowUpRight aria-hidden="true" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="market-lines">
                      {player.markets.map((market, marketIndex) => (
                        <span
                          key={`${player.name}-${marketIndex}-${market}`}
                        >
                          <small>{player.marketLabels[marketIndex]}</small>
                          <strong>{market}</strong>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="projection-cell">
                      <strong>
                        {(player.projection + scoringAdjustment).toFixed(1)}
                      </strong>
                      <span className="trend-up">
                        {player.source === 'live'
                          ? `${player.bookCount} books`
                          : 'Sample'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="edge-cell">
                      <strong>{player.coverageScore}</strong>
                      <span>
                        <i style={{ width: `${player.coverageScore}%` }} />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="range-cell">
                      <BarChart3 aria-hidden="true" />
                      <span>{player.range}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        player.risk === 'Stable'
                          ? 'profile-stable'
                          : 'profile-ceiling'
                      }
                    >
                      {player.risk}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <h3>No players found</h3>
            <p>Try another position or player name.</p>
          </div>
        )}

        <div className="board-footer">
          <p>
            <Swords aria-hidden="true" /> Not sure between two players?
          </p>
          <Button variant="outline" onClick={onCompare}>
            Open player compare <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}
