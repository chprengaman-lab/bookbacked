'use client';

import { useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ShieldCheck,
  Swords,
  Zap,
} from 'lucide-react';

import { PlayerSearch } from '@/app/_components/player-search';
import { PlayerIdentity } from '@/app/_components/shared';
import { Button } from '@/components/ui/button';
import type { UiPlayer } from '@/lib/bookbacked/client';

export function Compare({
  players,
  slateLabel,
  initialSlug,
}: {
  players: UiPlayer[];
  slateLabel: string;
  initialSlug: string | null;
}) {
  const initialLeft =
    players.find((player) => player.slug === initialSlug) ?? players[0];
  const initialRight =
    players.find((player) => player.name !== initialLeft.name) ?? players[1];
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  const advantage = left.projection >= right.projection ? left : right;
  const other = advantage.name === left.name ? right : left;
  const projectionGap = Math.abs(left.projection - right.projection).toFixed(1);
  const bookCoverage = Math.max(left.bookCount, right.bookCount);
  const coveragePercent = Math.min(
    100,
    Math.round((bookCoverage / 15) * 100),
  );

  const comparisonRows = [
    {
      label: 'Market projection',
      left: `${left.projection.toFixed(1)} pts`,
      right: `${right.projection.toFixed(1)} pts`,
      winner: left.projection >= right.projection ? 'left' : 'right',
    },
    {
      label: 'Primary yardage line',
      left: `${left.markets[0]} ${left.marketLabels[0].toLowerCase()}`,
      right: `${right.markets[0]} ${right.marketLabels[0].toLowerCase()}`,
      winner:
        Number.parseFloat(left.markets[0]) >=
        Number.parseFloat(right.markets[0])
          ? 'left'
          : 'right',
    },
    {
      label: 'Anytime TD',
      left: left.anytimeTd,
      right: right.anytimeTd,
      winner:
        left.anytimeTd !== '—' && right.anytimeTd !== '—'
          ? Number.parseFloat(left.anytimeTd) <=
            Number.parseFloat(right.anytimeTd)
            ? 'left'
            : 'right'
          : undefined,
    },
    {
      label: 'Sportsbook coverage',
      left: `${left.bookCount} books`,
      right: `${right.bookCount} books`,
      winner: left.bookCount >= right.bookCount ? 'left' : 'right',
    },
    {
      label: 'Alternate lines',
      left: `${left.altLineCount} available`,
      right: `${right.altLineCount} available`,
      winner: left.altLineCount >= right.altLineCount ? 'left' : 'right',
    },
    {
      label: 'Floor → ceiling',
      left: left.range,
      right: right.range,
      winner: left.low >= right.low ? 'left' : 'right',
    },
    {
      label: 'Kickoff',
      left: left.kickoff,
      right: right.kickoff,
      winner: undefined,
    },
  ];

  return (
    <div className="page-shell page-content compare-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <Swords aria-hidden="true" /> START / SIT DECISION
          </div>
          <h1>Compare players</h1>
          <p>
            See where the market agrees, where outcomes diverge, and who gives
            your lineup the better path this week.
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" className="week-button">
            {slateLabel} <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section className="compare-picker-card">
        <div className="compare-picker-grid">
          <PlayerSearch
            key={`left-${left.name}`}
            players={players}
            value={left}
            onChange={setLeft}
            label="PLAYER ONE"
          />
          <button
            className="swap-button"
            aria-label="Swap players"
            onClick={() => {
              setLeft(right);
              setRight(left);
            }}
          >
            <ArrowLeftRight aria-hidden="true" />
          </button>
          <PlayerSearch
            key={`right-${right.name}`}
            players={players}
            value={right}
            onChange={setRight}
            label="PLAYER TWO"
          />
        </div>
        <datalist id="player-list" aria-label="Available players">
          {players.map((player) => (
            <option key={player.name} value={player.name}>
              {player.name}
            </option>
          ))}
        </datalist>
      </section>

      <section className="decision-banner">
        <div className="decision-icon">
          <Check aria-hidden="true" />
        </div>
        <div className="decision-copy">
          <span>MARKET LEAN</span>
          <h2>Start {advantage.name}</h2>
          <p>
            {advantage.name} carries a{' '}
            <strong>{projectionGap}-point consensus advantage</strong> over{' '}
            {other.name} using current sportsbook player props.
          </p>
        </div>
        <div className="confidence-block">
          <span>BOOK COVERAGE</span>
          <strong>{bookCoverage}</strong>
          <div>
            <i style={{ width: `${coveragePercent}%` }} />
          </div>
        </div>
      </section>

      <section className="comparison-card">
        <div className="comparison-head">
          <div>
            <PlayerIdentity player={left} linked />
            <div className="headline-projection">
              <strong>{left.projection}</strong>
              <span>projected pts</span>
            </div>
          </div>
          <div className="versus-mark">VS</div>
          <div>
            <PlayerIdentity player={right} linked />
            <div className="headline-projection">
              <strong>{right.projection}</strong>
              <span>projected pts</span>
            </div>
          </div>
        </div>
        <div className="comparison-rows">
          {comparisonRows.map((row) => (
            <div className="comparison-row" key={row.label}>
              <div
                className={
                  row.winner === 'left'
                    ? 'metric-value metric-winner'
                    : 'metric-value'
                }
              >
                {row.left}
                {row.winner === 'left' && <Check aria-hidden="true" />}
              </div>
              <div className="metric-label">{row.label}</div>
              <div
                className={
                  row.winner === 'right'
                    ? 'metric-value metric-value-right metric-winner'
                    : 'metric-value metric-value-right'
                }
              >
                {row.winner === 'right' && <Check aria-hidden="true" />}
                {row.right}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="compare-insight-grid">
        <article>
          <div className="insight-icon">
            <ShieldCheck />
          </div>
          <div>
            <span>SAFER FLOOR</span>
            <h3>{left.low >= right.low ? left.name : right.name}</h3>
            <p>
              Better downside protection based on the low end of available
              alt-line markets.
            </p>
          </div>
        </article>
        <article>
          <div className="insight-icon insight-icon-warm">
            <Zap />
          </div>
          <div>
            <span>HIGHER CEILING</span>
            <h3>{left.high >= right.high ? left.name : right.name}</h3>
            <p>
              More upside if game script and touchdown opportunities break the
              right way.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
