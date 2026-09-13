'use client';

import { useState } from 'react';
import { HelpCircle, Lock, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LockedRosteredPlayer } from '@/lib/leagues/locked';

type LeagueSummary = { leagueId: string; name: string; season: string };

type LeagueListResponse = {
  user: { userId: string; displayName: string | null };
  leagues: LeagueSummary[];
};

type RosterResponse = {
  leagueName: string;
  season: string;
  ownerDisplayName: string | null;
  players: LockedRosteredPlayer[];
};

type Stage = 'idle' | 'loading-leagues' | 'leagues' | 'loading-roster' | 'roster';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Something went wrong.';
    throw new Error(message);
  }
  return data as T;
}

export function LeagueImport() {
  const [username, setUsername] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [roster, setRoster] = useState<RosterResponse | null>(null);

  async function handleFindLeagues(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setStage('loading-leagues');
    setError(null);
    setRoster(null);

    try {
      const payload = await fetchJson<LeagueListResponse>(
        `/api/leagues/sleeper?username=${encodeURIComponent(trimmed)}`,
      );
      setDisplayName(payload.user.displayName);
      setLeagues(payload.leagues);
      setStage('leagues');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setStage('idle');
    }
  }

  async function handleSelectLeague(leagueId: string) {
    const trimmed = username.trim();
    setStage('loading-roster');
    setError(null);

    try {
      const payload = await fetchJson<RosterResponse>(
        `/api/leagues/sleeper?username=${encodeURIComponent(trimmed)}&leagueId=${encodeURIComponent(leagueId)}`,
      );
      setRoster(payload);
      setStage('roster');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setStage('leagues');
    }
  }

  return (
    <div className="page-shell space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Import your Sleeper roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your Sleeper username to see which of your rostered players
          are already locked because their NFL game has started.
        </p>
      </div>

      <form onSubmit={handleFindLeagues} className="flex max-w-md gap-2">
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Sleeper username"
          aria-label="Sleeper username"
        />
        <Button type="submit" disabled={stage === 'loading-leagues'}>
          {stage === 'loading-leagues' ? 'Searching…' : 'Find leagues'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {stage === 'leagues' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {displayName ? `Leagues for ${displayName}` : 'Select a league'}
          </p>
          {leagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No NFL leagues found for this season.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {leagues.map((league) => (
                <Button
                  key={league.leagueId}
                  variant="outline"
                  onClick={() => handleSelectLeague(league.leagueId)}
                >
                  {league.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === 'loading-roster' && (
        <p className="text-sm text-muted-foreground">Loading roster…</p>
      )}

      {roster && stage === 'roster' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{roster.leagueName}</h2>
              <p className="text-sm text-muted-foreground">
                {roster.ownerDisplayName ?? username} · {roster.season}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRoster(null);
                setStage('leagues');
              }}
            >
              Back to leagues
            </Button>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {roster.players.map((player) => (
              <div
                key={player.externalId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {player.position ?? '—'} · {player.team ?? 'FA'}
                    {player.commenceTime
                      ? ` · ${new Date(player.commenceTime).toLocaleString()}`
                      : ''}
                  </div>
                </div>
                <LockStatusBadge status={player.lockStatus} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LockStatusBadge({
  status,
}: {
  status: LockedRosteredPlayer['lockStatus'];
}) {
  if (status === 'locked') {
    return (
      <Badge variant="destructive" className="gap-1">
        <Lock className="size-3" /> Locked
      </Badge>
    );
  }
  if (status === 'upcoming') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Unlock className="size-3" /> Upcoming
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <HelpCircle className="size-3" /> Unmatched
    </Badge>
  );
}
