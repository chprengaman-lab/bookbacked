/* oxlint-disable next/no-html-link-for-pages */

import type { UiPlayer } from '@/lib/bookbacked/client';

export function Logo() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark" aria-hidden="true">
        <span>B</span>
      </div>
      <div>
        <div className="brand-name">BOOKBACKED</div>
        <div className="brand-subtitle">BACKED BY THE BOOKS</div>
      </div>
    </div>
  );
}

export function playerHref(player: UiPlayer) {
  return `/player/${player.slug}`;
}

export function PlayerIdentity({
  player,
  compact = false,
  linked = false,
}: {
  player: UiPlayer;
  compact?: boolean;
  linked?: boolean;
}) {
  const identity = (
    <div className={compact ? 'player-cell player-cell-compact' : 'player-cell'}>
      <div className="team-badge" style={{ backgroundColor: player.color }}>
        {player.team}
      </div>
      <div>
        <strong>{player.name}</strong>
        <span>
          {player.pos} · {player.team} {player.opponent}
        </span>
      </div>
    </div>
  );

  return linked ? (
    <a className="player-identity-link" href={playerHref(player)}>
      {identity}
    </a>
  ) : (
    identity
  );
}
