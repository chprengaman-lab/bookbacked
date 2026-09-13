export type LeagueProvider = 'sleeper' | 'espn' | 'yahoo' | 'cbs';

// 'taxi' is dynasty-specific (Sleeper today); other providers simply never
// produce it.
export type RosterSlot = 'starter' | 'bench' | 'ir' | 'taxi';

export type RosteredPlayer = {
  externalId: string;
  name: string;
  position: string | null;
  team: string | null;
  matchedSlug: string | null;
  slot: RosterSlot;
  // The specific starting slot label (e.g. "QB", "FLEX", "DEF") and its
  // position in the lineup -- both only meaningful when slot === 'starter'.
  starterSlotLabel: string | null;
  starterSlotOrder: number | null;
};

export type LeagueRoster = {
  provider: LeagueProvider;
  leagueId: string;
  leagueName: string;
  season: string;
  ownerDisplayName: string | null;
  players: RosteredPlayer[];
};

// Unrostered players available to add in a league. No ranking/order yet --
// that's added once projections can be attached to this list.
export type FreeAgentPlayer = {
  externalId: string;
  name: string;
  position: string | null;
  team: string | null;
};
