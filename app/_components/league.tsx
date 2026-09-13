'use client';

import { useState } from 'react';
import { HelpCircle, Lock, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LockedRosteredPlayer } from '@/lib/leagues/locked';
import type { FreeAgentPlayer, RosterSlot } from '@/lib/leagues/types';

const FREE_AGENT_POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
const FREE_AGENT_DISPLAY_CAP = 100;

const SLOT_SECTIONS: { slot: RosterSlot; label: string }[] = [
  { slot: 'starter', label: 'Starting Lineup' },
  { slot: 'bench', label: 'Bench' },
  { slot: 'ir', label: 'IR' },
  { slot: 'taxi', label: 'Taxi Squad' },
];

// Sleeper's raw label for an IDP flex slot; shortened for display.
const STARTER_LABEL_OVERRIDES: Record<string, string> = {
  IDP_FLEX: 'IDP',
};

function slotBadgeLabel(player: LockedRosteredPlayer) {
  if (player.slot === 'starter') {
    const label = player.starterSlotLabel ?? 'START';
    return STARTER_LABEL_OVERRIDES[label] ?? label;
  }
  if (player.slot === 'ir') return 'IR';
  if (player.slot === 'taxi') return 'TAXI';
  return 'BN';
}

const SLOT_BADGE_STYLES: Record<RosterSlot, string> = {
  starter: 'bg-accent text-accent-foreground',
  bench: 'bg-secondary text-secondary-foreground',
  ir: 'bg-destructive/15 text-destructive',
  taxi: 'border border-border bg-transparent text-foreground',
};

function SlotBadge({ player }: { player: LockedRosteredPlayer }) {
  return (
    <span
      className={`flex h-7 w-14 shrink-0 items-center justify-center rounded-md text-xs font-bold uppercase tracking-wide ${SLOT_BADGE_STYLES[player.slot]}`}
    >
      {slotBadgeLabel(player)}
    </span>
  );
}

function groupBySlot(players: LockedRosteredPlayer[]) {
  const groups = new Map<RosterSlot, LockedRosteredPlayer[]>(
    SLOT_SECTIONS.map(({ slot }) => [slot, []]),
  );
  for (const player of players) {
    groups.get(player.slot)?.push(player);
  }
  groups.get('starter')?.sort(
    (left, right) => (left.starterSlotOrder ?? 0) - (right.starterSlotOrder ?? 0),
  );
  return groups;
}

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
  oddsAvailable: boolean;
};

type Stage = 'idle' | 'loading-leagues' | 'leagues' | 'loading-roster' | 'roster';
type LeagueTab = 'roster' | 'free-agents';

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
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeagueTab>('roster');
  const [freeAgents, setFreeAgents] = useState<FreeAgentPlayer[] | null>(null);
  const [freeAgentsLoading, setFreeAgentsLoading] = useState(false);
  const [freeAgentsError, setFreeAgentsError] = useState<string | null>(null);
  const [faSearch, setFaSearch] = useState('');
  const [faPosition, setFaPosition] = useState<(typeof FREE_AGENT_POSITIONS)[number]>(
    'ALL',
  );

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
    setActiveTab('roster');
    setFreeAgents(null);
    setFreeAgentsError(null);

    try {
      const payload = await fetchJson<RosterResponse>(
        `/api/leagues/sleeper?username=${encodeURIComponent(trimmed)}&leagueId=${encodeURIComponent(leagueId)}`,
      );
      setRoster(payload);
      setSelectedLeagueId(leagueId);
      setStage('roster');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setStage('leagues');
    }
  }

  async function loadFreeAgents(leagueId: string) {
    setFreeAgentsLoading(true);
    setFreeAgentsError(null);

    try {
      const payload = await fetchJson<{ leagueId: string; players: FreeAgentPlayer[] }>(
        `/api/leagues/sleeper/free-agents?leagueId=${encodeURIComponent(leagueId)}`,
      );
      setFreeAgents(payload.players);
    } catch (caught) {
      setFreeAgentsError(
        caught instanceof Error ? caught.message : 'Something went wrong.',
      );
    } finally {
      setFreeAgentsLoading(false);
    }
  }

  function handleSelectTab(tab: LeagueTab) {
    setActiveTab(tab);
    if (tab === 'free-agents' && freeAgents === null && !freeAgentsLoading && selectedLeagueId) {
      void loadFreeAgents(selectedLeagueId);
    }
  }

  const filteredFreeAgents = (freeAgents ?? []).filter((player) => {
    if (faPosition !== 'ALL' && player.position !== faPosition) return false;
    const query = faSearch.trim().toLowerCase();
    if (query && !player.name.toLowerCase().includes(query)) return false;
    return true;
  });
  const isFreeAgentListNarrowed = faPosition !== 'ALL' || faSearch.trim().length > 0;
  const visibleFreeAgents = isFreeAgentListNarrowed
    ? filteredFreeAgents
    : filteredFreeAgents.slice(0, FREE_AGENT_DISPLAY_CAP);

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
                setSelectedLeagueId(null);
                setFreeAgents(null);
                setStage('leagues');
              }}
            >
              Back to leagues
            </Button>
          </div>

          <div className="flex gap-1 border-b border-border">
            <button
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'roster'
                  ? 'border-b-2 border-accent text-foreground'
                  : 'text-muted-foreground'
              }`}
              onClick={() => handleSelectTab('roster')}
            >
              My Roster
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'free-agents'
                  ? 'border-b-2 border-accent text-foreground'
                  : 'text-muted-foreground'
              }`}
              onClick={() => handleSelectTab('free-agents')}
            >
              Free Agents
            </button>
          </div>

          {activeTab === 'roster' && (
            <>
              {!roster.oddsAvailable && (
                <p className="text-sm text-muted-foreground">
                  NFL odds data is temporarily unavailable, so lock status
                  can&apos;t be determined right now. Showing your roster
                  only.
                </p>
              )}
              {(() => {
                const grouped = groupBySlot(roster.players);
                return SLOT_SECTIONS.map(({ slot, label }) => {
                  const players = grouped.get(slot) ?? [];
                  if (players.length === 0) return null;
                  return (
                    <div key={slot} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {label}
                      </h3>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {players.map((player) => (
                          <div
                            key={player.externalId}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <SlotBadge player={player} />
                            <div className="min-w-0 flex-1">
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
                  );
                });
              })()}
            </>
          )}

          {activeTab === 'free-agents' && (
            <div className="space-y-3">
              {freeAgentsLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading free agents…
                </p>
              )}
              {freeAgentsError && (
                <p className="text-sm text-destructive">{freeAgentsError}</p>
              )}
              {freeAgents && (
                <>
                  <p className="text-sm text-muted-foreground">
                    No rankings yet -- this is the full unrostered player pool.
                    Search or filter by position to narrow it down.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={faSearch}
                      onChange={(event) => setFaSearch(event.target.value)}
                      placeholder="Search free agents"
                      aria-label="Search free agents"
                      className="max-w-xs"
                    />
                    <div className="flex flex-wrap gap-1">
                      {FREE_AGENT_POSITIONS.map((pos) => (
                        <Button
                          key={pos}
                          size="sm"
                          variant={faPosition === pos ? 'default' : 'outline'}
                          onClick={() => setFaPosition(pos)}
                        >
                          {pos}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredFreeAgents.length} free agent
                    {filteredFreeAgents.length === 1 ? '' : 's'}
                    {!isFreeAgentListNarrowed &&
                    filteredFreeAgents.length > FREE_AGENT_DISPLAY_CAP
                      ? ` — showing the first ${FREE_AGENT_DISPLAY_CAP}`
                      : ''}
                  </p>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {visibleFreeAgents.map((player) => (
                      <div
                        key={player.externalId}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded-md border border-border text-xs font-bold uppercase tracking-wide text-foreground">
                          {player.position ?? '—'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {player.team ?? '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {visibleFreeAgents.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No free agents match.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
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
