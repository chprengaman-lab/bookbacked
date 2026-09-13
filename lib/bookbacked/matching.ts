import type { PropLineEvent } from '@/lib/bookbacked/providers/propline';
import type { SportsGameOddsEvent } from '@/lib/bookbacked/providers/sports-game-odds';

const EVENT_TIME_TOLERANCE_MS = 12 * 60 * 60 * 1000;

const BOOKMAKER_NAMES: Record<string, string> = {
  bet365: 'bet365',
  betmgm: 'BetMGM',
  betrivers: 'BetRivers',
  bovada: 'Bovada',
  caesars: 'Caesars',
  draftkings: 'DraftKings',
  espnbet: 'ESPN BET',
  fanduel: 'FanDuel',
  fanatics: 'Fanatics',
  pinnacle: 'Pinnacle',
  prizepicks: 'PrizePicks',
  underdog: 'Underdog Fantasy',
  unibet: 'Unibet',
  williamhill: 'William Hill',
};

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizedName(value: string) {
  const withoutTeamSuffix = value.replace(/\s+\([A-Z0-9]{2,4}\)\s*$/i, '');
  return slugify(withoutTeamSuffix)
    .split('-')
    .filter((part) => !['jr', 'sr', 'ii', 'iii', 'iv'].includes(part))
    .join('');
}

export function teamToken(value: string) {
  const parts = slugify(value).split('-').filter(Boolean);
  return parts.at(-1) ?? '';
}

export function sameGame(
  left: PropLineEvent,
  right: SportsGameOddsEvent,
) {
  const leftTime = Date.parse(left.commence_time);
  const rightTime = Date.parse(right.status?.startsAt ?? '');
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  if (Math.abs(leftTime - rightTime) > EVENT_TIME_TOLERANCE_MS) return false;

  const rightHome = right.teams?.home?.names?.long ?? '';
  const rightAway = right.teams?.away?.names?.long ?? '';
  return (
    teamToken(left.home_team) === teamToken(rightHome) &&
    teamToken(left.away_team) === teamToken(rightAway)
  );
}

export function bookmakerName(bookmakerId: string) {
  return (
    BOOKMAKER_NAMES[bookmakerId] ??
    bookmakerId
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
