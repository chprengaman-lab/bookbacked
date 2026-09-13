'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Unlock,
} from 'lucide-react';

import { demoPlayers, lineupRows } from '@/app/_components/demo-data';
import { PlayerIdentity } from '@/app/_components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Optimizer() {
  const [mode, setMode] = useState<'floor' | 'balanced' | 'ceiling'>(
    'balanced',
  );
  const [optimized, setOptimized] = useState(false);
  const [locked, setLocked] = useState<string[]>([
    'Josh Allen',
    'Bijan Robinson',
  ]);
  const modeLabels = {
    floor: 'Floor first',
    balanced: 'Balanced',
    ceiling: 'Ceiling first',
  };

  function toggleLock(name: string) {
    setLocked((current) =>
      current.includes(name)
        ? current.filter((player) => player !== name)
        : [...current, name],
    );
    setOptimized(false);
  }

  const suggestedNames = lineupRows.map((row) => row[mode]);
  const currentProjection = lineupRows.reduce(
    (total, row) =>
      total +
      (demoPlayers.find((player) => player.name === row.current)?.projection ??
        0),
    0,
  );
  const suggestedProjection = lineupRows.reduce((total, row) => {
    const selectedName = locked.includes(row.current)
      ? row.current
      : row[mode];
    return (
      total +
      (demoPlayers.find((player) => player.name === selectedName)?.projection ??
        0)
    );
  }, 0);

  return (
    <div className="page-shell page-content optimizer-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <Sparkles aria-hidden="true" /> LINEUP BUILDER
          </div>
          <h1>Set your best lineup</h1>
          <p>
            Optimize the players already on your roster using the market’s
            expectation—and choose how much volatility you want.
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" className="week-button">
            Sample roster <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section className="optimizer-status-bar">
        <div>
          <span>TEAM</span>
          <strong>Sunday Scaries</strong>
        </div>
        <div>
          <span>FORMAT</span>
          <strong>1 QB · PPR</strong>
        </div>
        <div>
          <span>ROSTER</span>
          <strong>
            <Check aria-hidden="true" /> 12 players ready
          </strong>
        </div>
        <Button variant="outline">
          <Plus aria-hidden="true" /> Edit roster
        </Button>
      </section>

      <div className="optimizer-layout">
        <section className="lineup-card">
          <div className="lineup-card-head">
            <div>
              <span>CURRENT STARTERS</span>
              <h2>Your lineup</h2>
            </div>
            <div className="current-total">
              <span>PROJECTED</span>
              <strong>{currentProjection.toFixed(1)}</strong>
            </div>
          </div>
          <div className="lineup-rows">
            {lineupRows.map((row, index) => {
              const player = demoPlayers.find(
                (item) => item.name === row.current,
              )!;
              const isLocked = locked.includes(row.current);
              return (
                <div className="lineup-row" key={`${row.slot}-${index}`}>
                  <span className="slot-label">{row.slot}</span>
                  <PlayerIdentity player={player} compact linked />
                  <strong className="slot-projection">
                    {player.projection.toFixed(1)}
                  </strong>
                  <button
                    className={
                      isLocked ? 'lock-button is-locked' : 'lock-button'
                    }
                    onClick={() => toggleLock(row.current)}
                    aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${row.current}`}
                  >
                    {isLocked ? (
                      <Lock aria-hidden="true" />
                    ) : (
                      <Unlock aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="optimizer-panel">
          <div className="optimizer-panel-head">
            <div className="optimizer-panel-icon">
              <Target />
            </div>
            <div>
              <span>OPTIMIZATION GOAL</span>
              <h2>Choose your approach</h2>
            </div>
          </div>
          <div className="risk-options">
            {(['floor', 'balanced', 'ceiling'] as const).map((option) => (
              <button
                key={option}
                className={
                  mode === option ? 'risk-option active' : 'risk-option'
                }
                onClick={() => {
                  setMode(option);
                  setOptimized(false);
                }}
              >
                <span>{modeLabels[option]}</span>
                <small>
                  {option === 'floor'
                    ? 'Protect against busts'
                    : option === 'balanced'
                      ? 'Best median outcome'
                      : 'Maximize weekly upside'}
                </small>
                {mode === option && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="optimizer-explainer">
            <TrendingUp aria-hidden="true" />
            <p>
              <strong>{modeLabels[mode]}</strong> weights{' '}
              {mode === 'floor'
                ? 'alternate unders and market agreement'
                : mode === 'balanced'
                  ? 'median projection and role security'
                  : 'alternate overs and touchdown probability'}
              .
            </p>
          </div>

          <Button
            className="run-optimizer-button"
            onClick={() => setOptimized(true)}
          >
            <Sparkles aria-hidden="true" />{' '}
            {optimized ? 'Lineup optimized' : 'Optimize my lineup'}
          </Button>

          {optimized ? (
            <div className="optimizer-result" aria-live="polite">
              <div className="result-heading">
                <div>
                  <span>RECOMMENDED</span>
                  <h3>{modeLabels[mode]} lineup</h3>
                </div>
                <Badge>
                  +{(suggestedProjection - currentProjection).toFixed(1)} pts
                </Badge>
              </div>
              <div className="swap-list">
                {lineupRows.map((row, index) => {
                  const next = locked.includes(row.current)
                    ? row.current
                    : row[mode];
                  if (next === row.current) return null;
                  return (
                    <div key={`${row.slot}-${index}`}>
                      <span>{row.slot}</span>
                      <p>
                        <s>{row.current}</s>
                        <ArrowUpRight aria-hidden="true" />
                        <strong>{next}</strong>
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="result-note">
                <ShieldCheck aria-hidden="true" /> Locked players stayed in
                place. Injury status should be checked before finalizing.
              </p>
            </div>
          ) : (
            <div className="optimizer-preview">
              <BarChart3 aria-hidden="true" />
              <p>
                We’ll evaluate <strong>{suggestedNames.length} starting slots</strong>{' '}
                against every eligible player on your roster.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
