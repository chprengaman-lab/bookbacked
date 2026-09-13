'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Gauge,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';

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

type View = 'cheatsheet' | 'compare' | 'optimizer';
type SortKey = 'projection' | 'edge';

type Player = {
  rank: number;
  name: string;
  team: string;
  opponent: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  color: string;
  projection: number;
  edge: number;
  markets: [string, string, string];
  marketLabels: [string, string, string];
  range: string;
  low: number;
  high: number;
  trend: string;
  risk: 'Stable' | 'Ceiling' | 'Volume';
  teamTotal: number;
  gameTotal: number;
  anytimeTd: string;
};

const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'] as const;

const players: Player[] = [
  { rank: 1, name: 'Josh Allen', team: 'BUF', opponent: 'vs NE', pos: 'QB', color: '#2458A6', projection: 24.8, edge: 92, markets: ['269.5', '41.5', '2.5'], marketLabels: ['PASS YDS', 'RUSH YDS', 'PASS TD'], range: '19.2–31.6', low: 19.2, high: 31.6, trend: '+1.8', risk: 'Stable', teamTotal: 29.5, gameTotal: 51.5, anytimeTd: '+145' },
  { rank: 2, name: 'Bijan Robinson', team: 'ATL', opponent: 'at CAR', pos: 'RB', color: '#C41130', projection: 21.7, edge: 89, markets: ['74.5', '29.5', '-135'], marketLabels: ['RUSH YDS', 'REC YDS', 'ANY TD'], range: '14.8–28.9', low: 14.8, high: 28.9, trend: '+2.4', risk: 'Stable', teamTotal: 26.5, gameTotal: 46.5, anytimeTd: '-135' },
  { rank: 3, name: 'Ja’Marr Chase', team: 'CIN', opponent: 'vs PIT', pos: 'WR', color: '#F36A22', projection: 20.9, edge: 87, markets: ['84.5', '6.5', '+105'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '11.7–31.2', low: 11.7, high: 31.2, trend: '+0.9', risk: 'Ceiling', teamTotal: 27.0, gameTotal: 48.5, anytimeTd: '+105' },
  { rank: 4, name: 'Jahmyr Gibbs', team: 'DET', opponent: 'at GB', pos: 'RB', color: '#0076B6', projection: 20.1, edge: 84, markets: ['63.5', '32.5', '-115'], marketLabels: ['RUSH YDS', 'REC YDS', 'ANY TD'], range: '13.1–28.2', low: 13.1, high: 28.2, trend: '+1.3', risk: 'Ceiling', teamTotal: 27.5, gameTotal: 49.5, anytimeTd: '-115' },
  { rank: 5, name: 'Puka Nacua', team: 'LAR', opponent: 'vs SEA', pos: 'WR', color: '#003594', projection: 19.6, edge: 82, markets: ['79.5', '6.5', '+125'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '12.4–28.1', low: 12.4, high: 28.1, trend: '-0.4', risk: 'Volume', teamTotal: 25.5, gameTotal: 47.5, anytimeTd: '+125' },
  { rank: 6, name: 'Trey McBride', team: 'ARI', opponent: 'at IND', pos: 'TE', color: '#97233F', projection: 16.4, edge: 78, markets: ['64.5', '5.5', '+160'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '9.8–23.6', low: 9.8, high: 23.6, trend: '+1.1', risk: 'Stable', teamTotal: 23.5, gameTotal: 45.0, anytimeTd: '+160' },
  { rank: 7, name: 'Lamar Jackson', team: 'BAL', opponent: 'vs CLE', pos: 'QB', color: '#241773', projection: 23.6, edge: 77, markets: ['241.5', '57.5', '1.5'], marketLabels: ['PASS YDS', 'RUSH YDS', 'PASS TD'], range: '16.8–32.4', low: 16.8, high: 32.4, trend: '-0.6', risk: 'Ceiling', teamTotal: 28.0, gameTotal: 44.5, anytimeTd: '+120' },
  { rank: 8, name: 'Justin Jefferson', team: 'MIN', opponent: 'at CHI', pos: 'WR', color: '#4F2683', projection: 19.1, edge: 76, markets: ['81.5', '6.5', '+130'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '10.9–28.8', low: 10.9, high: 28.8, trend: '+0.3', risk: 'Ceiling', teamTotal: 24.5, gameTotal: 43.5, anytimeTd: '+130' },
  { rank: 9, name: 'Saquon Barkley', team: 'PHI', opponent: 'vs NYG', pos: 'RB', color: '#004C54', projection: 19.0, edge: 75, markets: ['79.5', '19.5', '-125'], marketLabels: ['RUSH YDS', 'REC YDS', 'ANY TD'], range: '12.8–25.4', low: 12.8, high: 25.4, trend: '+0.8', risk: 'Stable', teamTotal: 28.5, gameTotal: 47.0, anytimeTd: '-125' },
  { rank: 10, name: 'Brock Bowers', team: 'LV', opponent: 'at DEN', pos: 'TE', color: '#111111', projection: 14.8, edge: 73, markets: ['58.5', '5.5', '+190'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '8.7–21.9', low: 8.7, high: 21.9, trend: '-0.2', risk: 'Volume', teamTotal: 19.5, gameTotal: 41.5, anytimeTd: '+190' },
  { rank: 11, name: 'CeeDee Lamb', team: 'DAL', opponent: 'vs WAS', pos: 'WR', color: '#041E42', projection: 18.7, edge: 71, markets: ['76.5', '6.5', '+135'], marketLabels: ['REC YDS', 'CATCHES', 'ANY TD'], range: '10.3–28.5', low: 10.3, high: 28.5, trend: '-0.7', risk: 'Ceiling', teamTotal: 25.0, gameTotal: 49.0, anytimeTd: '+135' },
  { rank: 12, name: 'Breece Hall', team: 'NYJ', opponent: 'at MIA', pos: 'RB', color: '#125740', projection: 17.4, edge: 68, markets: ['59.5', '27.5', '+120'], marketLabels: ['RUSH YDS', 'REC YDS', 'ANY TD'], range: '10.6–24.9', low: 10.6, high: 24.9, trend: '-1.2', risk: 'Volume', teamTotal: 22.0, gameTotal: 45.5, anytimeTd: '+120' },
];

const lineupRows = [
  { slot: 'QB', current: 'Josh Allen', balanced: 'Josh Allen', floor: 'Josh Allen', ceiling: 'Lamar Jackson' },
  { slot: 'RB', current: 'Bijan Robinson', balanced: 'Bijan Robinson', floor: 'Bijan Robinson', ceiling: 'Bijan Robinson' },
  { slot: 'RB', current: 'Breece Hall', balanced: 'Jahmyr Gibbs', floor: 'Saquon Barkley', ceiling: 'Jahmyr Gibbs' },
  { slot: 'WR', current: 'Ja’Marr Chase', balanced: 'Ja’Marr Chase', floor: 'Puka Nacua', ceiling: 'Ja’Marr Chase' },
  { slot: 'WR', current: 'CeeDee Lamb', balanced: 'Justin Jefferson', floor: 'Justin Jefferson', ceiling: 'CeeDee Lamb' },
  { slot: 'TE', current: 'Brock Bowers', balanced: 'Trey McBride', floor: 'Trey McBride', ceiling: 'Trey McBride' },
  { slot: 'FLEX', current: 'Puka Nacua', balanced: 'Puka Nacua', floor: 'Puka Nacua', ceiling: 'Justin Jefferson' },
];

function Logo() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark" aria-hidden="true"><span>S</span></div>
      <div>
        <div className="brand-name">SMACK</div>
        <div className="brand-subtitle">FOOTBALL INTELLIGENCE</div>
      </div>
    </div>
  );
}

function PlayerIdentity({ player, compact = false }: { player: Player; compact?: boolean }) {
  return (
    <div className={compact ? 'player-cell player-cell-compact' : 'player-cell'}>
      <div className="team-badge" style={{ backgroundColor: player.color }}>{player.team}</div>
      <div>
        <strong>{player.name}</strong>
        <span>{player.pos} · {player.team} {player.opponent}</span>
      </div>
    </div>
  );
}

function Header({ activeView, setActiveView }: { activeView: View; setActiveView: (view: View) => void }) {
  const labels: { key: View; label: string }[] = [
    { key: 'cheatsheet', label: 'Cheatsheet' },
    { key: 'compare', label: 'Compare' },
    { key: 'optimizer', label: 'Optimizer' },
  ];

  return (
    <header className="site-header">
      <div className="page-shell header-inner">
        <button className="logo-button" onClick={() => setActiveView('cheatsheet')} aria-label="SMACK home"><Logo /></button>
        <nav className="main-nav" aria-label="Primary navigation">
          {labels.map((item) => (
            <button
              key={item.key}
              className={activeView === item.key ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => setActiveView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="live-pill"><span className="live-dot" /> Lines live</span>
          <Button className="account-button" variant="outline">CP</Button>
        </div>
      </div>
    </header>
  );
}

function WeekControls({ onOptimize }: { onOptimize: () => void }) {
  return (
    <div className="heading-actions">
      <Button variant="outline" className="week-button">Week 6 <ChevronDown aria-hidden="true" /></Button>
      <Button className="optimize-button" onClick={onOptimize}><Sparkles aria-hidden="true" /> Optimize lineup</Button>
    </div>
  );
}

function Cheatsheet({ onCompare, onOptimize }: { onCompare: () => void; onOptimize: () => void }) {
  const [activePosition, setActivePosition] = useState<(typeof positions)[number]>('ALL');
  const [query, setQuery] = useState('');
  const [scoring, setScoring] = useState('PPR');
  const [sortKey, setSortKey] = useState<SortKey>('edge');

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = players.filter((player) => {
      const matchesPosition = activePosition === 'ALL'
        || player.pos === activePosition
        || (activePosition === 'FLEX' && ['RB', 'WR', 'TE'].includes(player.pos));
      const matchesQuery = !normalizedQuery
        || `${player.name} ${player.team}`.toLowerCase().includes(normalizedQuery);
      return matchesPosition && matchesQuery;
    });
    return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activePosition, query, sortKey]);

  const scoringAdjustment = scoring === 'PPR' ? 0 : scoring === 'HALF' ? -1.4 : -2.8;

  return (
    <div className="page-shell page-content">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><Activity aria-hidden="true" /> WEEKLY MARKET BOARD</div>
          <h1>Week 6 player rankings</h1>
          <p>One decision score built from player props, game totals, implied team points, and market movement.</p>
        </div>
        <WeekControls onOptimize={onOptimize} />
      </section>

      <section className="signal-grid" aria-label="Weekly market summary">
        <article className="signal-card signal-card-strong">
          <div className="signal-icon"><Gauge aria-hidden="true" /></div>
          <div><span>Best game environment</span><strong>BUF vs NE</strong></div>
          <div className="signal-stat"><strong>51.5</strong><span>total</span></div>
        </article>
        <article className="signal-card">
          <div className="signal-icon"><ArrowUpRight aria-hidden="true" /></div>
          <div><span>Biggest riser</span><strong>Bijan Robinson</strong></div>
          <div className="signal-stat positive"><strong>+2.4</strong><span>pts</span></div>
        </article>
        <article className="signal-card">
          <div className="signal-icon"><ShieldCheck aria-hidden="true" /></div>
          <div><span>Market coverage</span><strong>8 sportsbooks</strong></div>
          <div className="signal-stat"><strong>247</strong><span>players</span></div>
        </article>
      </section>

      <section className="board-card">
        <div className="board-toolbar">
          <div className="position-tabs" role="tablist" aria-label="Position">
            {positions.map((position) => (
              <button
                key={position}
                className={activePosition === position ? 'position-tab active' : 'position-tab'}
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
              <Input aria-label="Search players" placeholder="Search players" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <label className="select-wrap">
              <span className="sr-only">Scoring format</span>
              <select value={scoring} onChange={(event) => setScoring(event.target.value)}>
                <option value="PPR">PPR</option>
                <option value="HALF">Half PPR</option>
                <option value="STD">Standard</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="table-intro">
          <div><h2>Consensus cheatsheet</h2><p>Updated 4 min ago · Demo lines</p></div>
          <Button variant="ghost" className="method-button"><CircleHelp aria-hidden="true" /> Sportsbook-derived, no custom model</Button>
        </div>

        {filteredPlayers.length ? (
          <Table className="player-table">
            <TableHeader>
              <TableRow>
                <TableHead className="rank-col">RK</TableHead>
                <TableHead>PLAYER</TableHead>
                <TableHead>MARKET SNAPSHOT</TableHead>
                <TableHead>
                  <button className="sortable" onClick={() => setSortKey('projection')}>PROJ <ArrowDownUp aria-hidden="true" /></button>
                </TableHead>
                <TableHead>
                  <button className="sortable" onClick={() => setSortKey('edge')}>EDGE SCORE <ArrowDownUp aria-hidden="true" /></button>
                </TableHead>
                <TableHead>OUTCOME RANGE</TableHead>
                <TableHead>PROFILE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player, index) => (
                <TableRow key={player.name}>
                  <TableCell className="rank-cell">{index + 1}</TableCell>
                  <TableCell><PlayerIdentity player={player} /></TableCell>
                  <TableCell>
                    <div className="market-lines">
                      {player.markets.map((market, marketIndex) => (
                        <span key={`${player.name}-${market}`} title={player.marketLabels[marketIndex]}>{market}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="projection-cell">
                      <strong>{(player.projection + scoringAdjustment).toFixed(1)}</strong>
                      <span className={player.trend.startsWith('+') ? 'trend-up' : 'trend-down'}>{player.trend}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="edge-cell"><strong>{player.edge}</strong><span><i style={{ width: `${player.edge}%` }} /></span></div>
                  </TableCell>
                  <TableCell><div className="range-cell"><BarChart3 aria-hidden="true" /><span>{player.range}</span></div></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={player.risk === 'Ceiling' ? 'profile-ceiling' : 'profile-stable'}>{player.risk}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state"><Search aria-hidden="true" /><h3>No players found</h3><p>Try another position or player name.</p></div>
        )}

        <div className="board-footer">
          <p><Swords aria-hidden="true" /> Not sure between two players?</p>
          <Button variant="outline" onClick={onCompare}>Open player compare <ArrowUpRight aria-hidden="true" /></Button>
        </div>
      </section>
    </div>
  );
}

function PlayerSearch({ value, onChange, label }: { value: Player; onChange: (player: Player) => void; label: string }) {
  const [inputValue, setInputValue] = useState(value.name);

  function commitPlayer(name: string) {
    const next = players.find((player) => player.name.toLowerCase() === name.trim().toLowerCase());
    if (next) onChange(next);
  }

  return (
    <label className="compare-search-field">
      <span>{label}</span>
      <div className="compare-input-wrap">
        <Search aria-hidden="true" />
        <Input
          list="player-list"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            commitPlayer(event.target.value);
          }}
          onBlur={() => {
            commitPlayer(inputValue);
            if (!players.some((player) => player.name.toLowerCase() === inputValue.toLowerCase())) setInputValue(value.name);
          }}
          aria-label={label}
        />
      </div>
    </label>
  );
}

function Compare() {
  const [left, setLeft] = useState(players[2]);
  const [right, setRight] = useState(players[4]);
  const advantage = left.projection >= right.projection ? left : right;
  const other = advantage.name === left.name ? right : left;
  const projectionGap = Math.abs(left.projection - right.projection).toFixed(1);
  const confidence = Math.min(91, Math.round(55 + Math.abs(left.edge - right.edge) * 2.1));

  const comparisonRows = [
    { label: 'Market projection', left: `${left.projection.toFixed(1)} pts`, right: `${right.projection.toFixed(1)} pts`, winner: left.projection >= right.projection ? 'left' : 'right' },
    { label: 'Primary yardage line', left: `${left.markets[0]} ${left.marketLabels[0].toLowerCase()}`, right: `${right.markets[0]} ${right.marketLabels[0].toLowerCase()}`, winner: Number.parseFloat(left.markets[0]) >= Number.parseFloat(right.markets[0]) ? 'left' : 'right' },
    { label: 'Anytime TD', left: left.anytimeTd, right: right.anytimeTd, winner: left.edge >= right.edge ? 'left' : 'right' },
    { label: 'Implied team total', left: left.teamTotal.toFixed(1), right: right.teamTotal.toFixed(1), winner: left.teamTotal >= right.teamTotal ? 'left' : 'right' },
    { label: 'Game total', left: left.gameTotal.toFixed(1), right: right.gameTotal.toFixed(1), winner: left.gameTotal >= right.gameTotal ? 'left' : 'right' },
    { label: 'Floor → ceiling', left: left.range, right: right.range, winner: left.low >= right.low ? 'left' : 'right' },
    { label: 'Line movement', left: `${left.trend} pts`, right: `${right.trend} pts`, winner: Number.parseFloat(left.trend) >= Number.parseFloat(right.trend) ? 'left' : 'right' },
  ];

  return (
    <div className="page-shell page-content compare-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><Swords aria-hidden="true" /> START / SIT DECISION</div>
          <h1>Compare players</h1>
          <p>See where the market agrees, where outcomes diverge, and who gives your lineup the better path this week.</p>
        </div>
        <Button variant="outline" className="week-button">Week 6 <ChevronDown aria-hidden="true" /></Button>
      </section>

      <section className="compare-picker-card">
        <div className="compare-picker-grid">
          <PlayerSearch key={`left-${left.name}`} value={left} onChange={setLeft} label="PLAYER ONE" />
          <button
            className="swap-button"
            aria-label="Swap players"
            onClick={() => { setLeft(right); setRight(left); }}
          ><ArrowLeftRight aria-hidden="true" /></button>
          <PlayerSearch key={`right-${right.name}`} value={right} onChange={setRight} label="PLAYER TWO" />
        </div>
        <datalist id="player-list">{players.map((player) => <option key={player.name} value={player.name} />)}</datalist>
      </section>

      <section className="decision-banner">
        <div className="decision-icon"><Check aria-hidden="true" /></div>
        <div className="decision-copy">
          <span>SMACK PICK</span>
          <h2>Start {advantage.name}</h2>
          <p>{advantage.name} carries a <strong>{projectionGap}-point market edge</strong> over {other.name}, supported by a stronger combined opportunity score.</p>
        </div>
        <div className="confidence-block">
          <span>CONFIDENCE</span>
          <strong>{confidence}%</strong>
          <div><i style={{ width: `${confidence}%` }} /></div>
        </div>
      </section>

      <section className="comparison-card">
        <div className="comparison-head">
          <div><PlayerIdentity player={left} /><div className="headline-projection"><strong>{left.projection}</strong><span>projected pts</span></div></div>
          <div className="versus-mark">VS</div>
          <div><PlayerIdentity player={right} /><div className="headline-projection"><strong>{right.projection}</strong><span>projected pts</span></div></div>
        </div>
        <div className="comparison-rows">
          {comparisonRows.map((row) => (
            <div className="comparison-row" key={row.label}>
              <div className={row.winner === 'left' ? 'metric-value metric-winner' : 'metric-value'}>{row.left}{row.winner === 'left' && <Check aria-hidden="true" />}</div>
              <div className="metric-label">{row.label}</div>
              <div className={row.winner === 'right' ? 'metric-value metric-value-right metric-winner' : 'metric-value metric-value-right'}>{row.winner === 'right' && <Check aria-hidden="true" />}{row.right}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="compare-insight-grid">
        <article><div className="insight-icon"><ShieldCheck /></div><div><span>SAFER FLOOR</span><h3>{left.low >= right.low ? left.name : right.name}</h3><p>Better downside protection based on the low end of available alt-line markets.</p></div></article>
        <article><div className="insight-icon insight-icon-warm"><Zap /></div><div><span>HIGHER CEILING</span><h3>{left.high >= right.high ? left.name : right.name}</h3><p>More upside if game script and touchdown opportunities break the right way.</p></div></article>
      </section>
    </div>
  );
}

function Optimizer() {
  const [mode, setMode] = useState<'floor' | 'balanced' | 'ceiling'>('balanced');
  const [optimized, setOptimized] = useState(false);
  const [locked, setLocked] = useState<string[]>(['Josh Allen', 'Bijan Robinson']);
  const modeLabels = { floor: 'Floor first', balanced: 'Balanced', ceiling: 'Ceiling first' };

  function toggleLock(name: string) {
    setLocked((current) => current.includes(name) ? current.filter((player) => player !== name) : [...current, name]);
    setOptimized(false);
  }

  const suggestedNames = lineupRows.map((row) => row[mode]);
  const currentProjection = lineupRows.reduce((total, row) => total + (players.find((player) => player.name === row.current)?.projection ?? 0), 0);
  const suggestedProjection = lineupRows.reduce((total, row) => {
    const selectedName = locked.includes(row.current) ? row.current : row[mode];
    return total + (players.find((player) => player.name === selectedName)?.projection ?? 0);
  }, 0);

  return (
    <div className="page-shell page-content optimizer-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><Sparkles aria-hidden="true" /> LINEUP BUILDER</div>
          <h1>Set your best lineup</h1>
          <p>Optimize the players already on your roster using the market’s expectation—and choose how much volatility you want.</p>
        </div>
        <Button variant="outline" className="week-button">Week 6 <ChevronDown aria-hidden="true" /></Button>
      </section>

      <section className="optimizer-status-bar">
        <div><span>TEAM</span><strong>Sunday Scaries</strong></div>
        <div><span>FORMAT</span><strong>1 QB · PPR</strong></div>
        <div><span>ROSTER</span><strong><Check aria-hidden="true" /> 12 players ready</strong></div>
        <Button variant="outline"><Plus aria-hidden="true" /> Edit roster</Button>
      </section>

      <div className="optimizer-layout">
        <section className="lineup-card">
          <div className="lineup-card-head">
            <div><span>CURRENT STARTERS</span><h2>Your lineup</h2></div>
            <div className="current-total"><span>PROJECTED</span><strong>{currentProjection.toFixed(1)}</strong></div>
          </div>
          <div className="lineup-rows">
            {lineupRows.map((row, index) => {
              const player = players.find((item) => item.name === row.current)!;
              const isLocked = locked.includes(row.current);
              return (
                <div className="lineup-row" key={`${row.slot}-${index}`}>
                  <span className="slot-label">{row.slot}</span>
                  <PlayerIdentity player={player} compact />
                  <strong className="slot-projection">{player.projection.toFixed(1)}</strong>
                  <button className={isLocked ? 'lock-button is-locked' : 'lock-button'} onClick={() => toggleLock(row.current)} aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${row.current}`}>
                    {isLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="optimizer-panel">
          <div className="optimizer-panel-head"><div className="optimizer-panel-icon"><Target /></div><div><span>OPTIMIZATION GOAL</span><h2>Choose your approach</h2></div></div>
          <div className="risk-options">
            {(['floor', 'balanced', 'ceiling'] as const).map((option) => (
              <button key={option} className={mode === option ? 'risk-option active' : 'risk-option'} onClick={() => { setMode(option); setOptimized(false); }}>
                <span>{modeLabels[option]}</span>
                <small>{option === 'floor' ? 'Protect against busts' : option === 'balanced' ? 'Best median outcome' : 'Maximize weekly upside'}</small>
                {mode === option && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="optimizer-explainer">
            <TrendingUp aria-hidden="true" />
            <p><strong>{modeLabels[mode]}</strong> weights {mode === 'floor' ? 'alternate unders and market agreement' : mode === 'balanced' ? 'median projection and role security' : 'alternate overs and touchdown probability'}.</p>
          </div>

          <Button className="run-optimizer-button" onClick={() => setOptimized(true)}><Sparkles aria-hidden="true" /> {optimized ? 'Lineup optimized' : 'Optimize my lineup'}</Button>

          {optimized ? (
            <div className="optimizer-result" aria-live="polite">
              <div className="result-heading"><div><span>RECOMMENDED</span><h3>{modeLabels[mode]} lineup</h3></div><Badge>+{(suggestedProjection - currentProjection).toFixed(1)} pts</Badge></div>
              <div className="swap-list">
                {lineupRows.map((row, index) => {
                  const next = locked.includes(row.current) ? row.current : row[mode];
                  if (next === row.current) return null;
                  return <div key={`${row.slot}-${index}`}><span>{row.slot}</span><p><s>{row.current}</s><ArrowUpRight aria-hidden="true" /><strong>{next}</strong></p></div>;
                })}
              </div>
              <p className="result-note"><ShieldCheck aria-hidden="true" /> Locked players stayed in place. Injury status should be checked before finalizing.</p>
            </div>
          ) : (
            <div className="optimizer-preview">
              <BarChart3 aria-hidden="true" />
              <p>We’ll evaluate <strong>{suggestedNames.length} starting slots</strong> against every eligible player on your roster.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>('cheatsheet');

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header activeView={activeView} setActiveView={setActiveView} />
      {activeView === 'cheatsheet' && <Cheatsheet onCompare={() => setActiveView('compare')} onOptimize={() => setActiveView('optimizer')} />}
      {activeView === 'compare' && <Compare />}
      {activeView === 'optimizer' && <Optimizer />}
    </main>
  );
}
