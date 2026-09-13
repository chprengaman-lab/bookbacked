import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
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

type PlayerProfile = {
  slug: string;
  name: string;
  team: string;
  opponent: string;
  pos: string;
  color: string;
  projection: number;
  edge: number;
  floor: number;
  ceiling: number;
  markets: [
    { name: string; value: string },
    { name: string; value: string },
    { name: string; value: string },
  ];
};

const profiles: PlayerProfile[] = [
  { slug: 'josh-allen', name: 'Josh Allen', team: 'BUF', opponent: 'vs NE', pos: 'QB', color: '#2458A6', projection: 24.8, edge: 92, floor: 19.2, ceiling: 31.6, markets: [{ name: 'Passing yards', value: '269.5' }, { name: 'Rushing yards', value: '41.5' }, { name: 'Passing TDs', value: '2.5' }] },
  { slug: 'bijan-robinson', name: 'Bijan Robinson', team: 'ATL', opponent: 'at PIT', pos: 'RB', color: '#C41130', projection: 21.7, edge: 89, floor: 14.8, ceiling: 28.9, markets: [{ name: 'Rushing yards', value: '78.5' }, { name: 'Receiving yards', value: '35.5' }, { name: 'Anytime TD', value: '-145' }] },
  { slug: 'jamarr-chase', name: 'Ja’Marr Chase', team: 'CIN', opponent: 'vs PIT', pos: 'WR', color: '#F36A22', projection: 20.9, edge: 87, floor: 11.7, ceiling: 31.2, markets: [{ name: 'Receiving yards', value: '84.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+105' }] },
  { slug: 'jahmyr-gibbs', name: 'Jahmyr Gibbs', team: 'DET', opponent: 'at GB', pos: 'RB', color: '#0076B6', projection: 20.1, edge: 84, floor: 13.1, ceiling: 28.2, markets: [{ name: 'Rushing yards', value: '63.5' }, { name: 'Receiving yards', value: '32.5' }, { name: 'Anytime TD', value: '-115' }] },
  { slug: 'puka-nacua', name: 'Puka Nacua', team: 'LAR', opponent: 'vs SEA', pos: 'WR', color: '#003594', projection: 19.6, edge: 82, floor: 12.4, ceiling: 28.1, markets: [{ name: 'Receiving yards', value: '79.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+125' }] },
  { slug: 'trey-mcbride', name: 'Trey McBride', team: 'ARI', opponent: 'at IND', pos: 'TE', color: '#97233F', projection: 16.4, edge: 78, floor: 9.8, ceiling: 23.6, markets: [{ name: 'Receiving yards', value: '64.5' }, { name: 'Receptions', value: '5.5' }, { name: 'Anytime TD', value: '+160' }] },
  { slug: 'lamar-jackson', name: 'Lamar Jackson', team: 'BAL', opponent: 'vs CLE', pos: 'QB', color: '#241773', projection: 23.6, edge: 77, floor: 16.8, ceiling: 32.4, markets: [{ name: 'Passing yards', value: '241.5' }, { name: 'Rushing yards', value: '57.5' }, { name: 'Passing TDs', value: '1.5' }] },
  { slug: 'justin-jefferson', name: 'Justin Jefferson', team: 'MIN', opponent: 'at CHI', pos: 'WR', color: '#4F2683', projection: 19.1, edge: 76, floor: 10.9, ceiling: 28.8, markets: [{ name: 'Receiving yards', value: '81.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+130' }] },
  { slug: 'saquon-barkley', name: 'Saquon Barkley', team: 'PHI', opponent: 'vs NYG', pos: 'RB', color: '#004C54', projection: 19.0, edge: 75, floor: 12.8, ceiling: 25.4, markets: [{ name: 'Rushing yards', value: '79.5' }, { name: 'Receiving yards', value: '19.5' }, { name: 'Anytime TD', value: '-125' }] },
  { slug: 'brock-bowers', name: 'Brock Bowers', team: 'LV', opponent: 'at DEN', pos: 'TE', color: '#111111', projection: 14.8, edge: 73, floor: 8.7, ceiling: 21.9, markets: [{ name: 'Receiving yards', value: '58.5' }, { name: 'Receptions', value: '5.5' }, { name: 'Anytime TD', value: '+190' }] },
  { slug: 'ceedee-lamb', name: 'CeeDee Lamb', team: 'DAL', opponent: 'vs WAS', pos: 'WR', color: '#041E42', projection: 18.7, edge: 71, floor: 10.3, ceiling: 28.5, markets: [{ name: 'Receiving yards', value: '76.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+135' }] },
  { slug: 'breece-hall', name: 'Breece Hall', team: 'NYJ', opponent: 'at MIA', pos: 'RB', color: '#125740', projection: 17.4, edge: 68, floor: 10.6, ceiling: 24.9, markets: [{ name: 'Rushing yards', value: '59.5' }, { name: 'Receiving yards', value: '27.5' }, { name: 'Anytime TD', value: '+120' }] },
];

const bookNames = ['DraftKings', 'FanDuel', 'BetMGM'];

function playerMarkets(profile: PlayerProfile) {
  if (profile.slug === 'bijan-robinson') {
    return [
      { market: 'Rushing yards', draftkings: 'O 78.5 · -113', fanduel: 'O 75.5 · -113', betmgm: 'O 80.5 · -115', consensus: '78.5', signal: 'Strong' },
      { market: 'Receiving yards', draftkings: 'O 35.5 · -109', fanduel: 'O 32.5 · -113', betmgm: 'O 31.5 · -115', consensus: '33.5', signal: 'Stable' },
      { market: 'Receptions', draftkings: 'O 4.5 · +114', fanduel: 'O 4.5 · -102', betmgm: 'O 4.5 · +120', consensus: '4.5', signal: 'Stable' },
      { market: 'Anytime touchdown', draftkings: '-145', fanduel: '-135', betmgm: '-140', consensus: '59.1%', signal: 'Strong' },
    ];
  }

  return profile.markets.map((market, index) => {
    const numeric = Number.parseFloat(market.value);
    const isPrice = market.name.includes('TD') && (market.value.startsWith('+') || market.value.startsWith('-'));
    return {
      market: market.name,
      draftkings: isPrice ? market.value : `O ${numeric.toFixed(1)} · -110`,
      fanduel: isPrice ? `${numeric >= 0 ? '+' : ''}${numeric + 5}` : `O ${(numeric - (index ? 0 : 1)).toFixed(1)} · -115`,
      betmgm: isPrice ? `${numeric >= 0 ? '+' : ''}${numeric - 5}` : `O ${(numeric + (index ? 0 : 1)).toFixed(1)} · -105`,
      consensus: isPrice ? `${Math.max(32, Math.min(66, 48 - numeric / 20)).toFixed(1)}%` : numeric.toFixed(1),
      signal: index === 0 ? 'Strong' : 'Stable',
    };
  });
}

export function generateStaticParams() {
  return profiles.map((profile) => ({ slug: profile.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = profiles.find((item) => item.slug === slug);
  if (!profile) return { title: 'Player not found — Implied' };
  return {
    title: `${profile.name} sportsbook odds — Implied`,
    description: `${profile.name} Week 6 fantasy projection, sportsbook lines, floor, ceiling, and market signals.`,
    openGraph: { title: `${profile.name} sportsbook odds — Implied`, description: `${profile.name} Week 6 sportsbook-powered fantasy outlook.`, images: [] },
    twitter: { card: 'summary', title: `${profile.name} sportsbook odds — Implied`, description: `${profile.name} Week 6 sportsbook-powered fantasy outlook.`, images: [] },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = profiles.find((item) => item.slug === slug);
  if (!profile) notFound();
  const marketRows = playerMarkets(profile);
  const midpoint = (profile.floor + profile.ceiling) / 2;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="site-header">
        <div className="page-shell header-inner detail-header-inner">
          <a className="brand-lockup" href="/" aria-label="Implied home">
            <div className="brand-mark" aria-hidden="true"><span>I</span></div>
            <div><div className="brand-name">IMPLIED</div><div className="brand-subtitle">VEGAS-POWERED FANTASY DECISIONS</div></div>
          </a>
          <nav className="main-nav" aria-label="Primary navigation">
            <a className="nav-item" href="/">Compare</a>
            <a className="nav-item nav-item-active" href="/?view=cheatsheet">Rankings</a>
            <a className="nav-item" href="/?view=optimizer">Optimizer</a>
          </nav>
          <div className="header-actions"><span className="live-pill"><span className="live-dot" /> Lines captured</span></div>
        </div>
      </header>

      <div className="page-shell player-detail-page">
        <a className="back-link" href="/?view=cheatsheet"><ArrowLeft aria-hidden="true" /> Back to rankings</a>

        <section className="player-detail-hero">
          <div className="player-hero-identity">
            <div className="team-badge player-hero-badge" style={{ backgroundColor: profile.color }}>{profile.team}</div>
            <div><div className="eyebrow">WEEK 6 · {profile.pos} #{profiles.filter((item) => item.pos === profile.pos).findIndex((item) => item.slug === profile.slug) + 1}</div><h1>{profile.name}</h1><p>{profile.pos} · {profile.team} {profile.opponent} · Sunday 1:00 PM ET</p></div>
          </div>
          <div className="player-hero-stats">
            <div><span>MARKET PROJ</span><strong>{profile.projection.toFixed(1)}</strong><small>PPR points</small></div>
            <div><span>EDGE SCORE</span><strong>{profile.edge}</strong><small>of 100</small></div>
            <div><span>OUTCOME RANGE</span><strong className="range-stat">{profile.floor}–{profile.ceiling}</strong><small>floor → ceiling</small></div>
          </div>
        </section>

        <section className="detail-signal-strip">
          <div><ShieldCheck aria-hidden="true" /><span>MARKET READ</span><strong>Strong start</strong></div>
          <div><TrendingUp aria-hidden="true" /><span>LINE MOVEMENT</span><strong>+2.4 pts</strong></div>
          <div><BarChart3 aria-hidden="true" /><span>BOOK AGREEMENT</span><strong>High</strong></div>
          <a href={`/?view=compare`}><Swords aria-hidden="true" /> Compare {profile.name.split(' ')[0]}</a>
        </section>

        <div className="player-detail-grid">
          <section className="sportsbook-card">
            <div className="detail-card-head">
              <div><span>SPORTSBOOK BOARD</span><h2>Current player markets</h2><p>Captured sample · Sep 12, 8:57 PM ET</p></div>
              <Badge variant="outline"><Clock3 aria-hidden="true" /> 3 books</Badge>
            </div>
            <Table className="odds-detail-table">
              <TableHeader><TableRow><TableHead>MARKET</TableHead>{bookNames.map((book) => <TableHead key={book}>{book.toUpperCase()}</TableHead>)}<TableHead>CONSENSUS</TableHead><TableHead>SIGNAL</TableHead></TableRow></TableHeader>
              <TableBody>
                {marketRows.map((row) => (
                  <TableRow key={row.market}>
                    <TableCell><strong>{row.market}</strong></TableCell>
                    <TableCell>{row.draftkings}</TableCell>
                    <TableCell>{row.fanduel}</TableCell>
                    <TableCell>{row.betmgm}</TableCell>
                    <TableCell><strong className="consensus-number">{row.consensus}</strong></TableCell>
                    <TableCell><Badge variant="outline" className={row.signal === 'Strong' ? 'profile-ceiling' : 'profile-stable'}>{row.signal}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <aside className="fantasy-translation-card">
            <div className="translation-icon"><Sparkles aria-hidden="true" /></div>
            <span>FANTASY TRANSLATION</span>
            <h2>How Vegas gets to {profile.projection.toFixed(1)}</h2>
            <div className="translation-total"><div><span>MARKET MIDPOINT</span><strong>{midpoint.toFixed(1)}</strong></div><Badge>Start</Badge></div>
            <div className="translation-lines">
              {profile.markets.map((market, index) => <div key={market.name}><span>{market.name}</span><strong>{market.value}</strong><i style={{ width: `${82 - index * 13}%` }} /></div>)}
            </div>
            <p><Info aria-hidden="true" /> The current prototype translates consensus props into fantasy scoring. It does not add a proprietary prediction model.</p>
          </aside>
        </div>

        <section className="alt-lines-card">
          <div className="detail-card-head"><div><span>BOOM / BUST PROFILE</span><h2>Alternate-line ladder</h2><p>Multiple thresholds show how quickly the market prices out upside.</p></div><Badge variant="outline">18 available lines</Badge></div>
          <div className="alt-ladder">
            {[-30, -20, 10, 20].map((delta, index) => {
              const mainLine = Number.parseFloat(profile.markets[0].value);
              const line = Math.max(0.5, mainLine + delta).toFixed(1);
              const prices = ['-450', '-220', '+150', '+280'];
              const labels = ['Floor', 'Safe', 'Upside', 'Boom'];
              return <div key={delta}><span>{labels[index]}</span><strong>{line}+ {profile.markets[0].name.toLowerCase()}</strong><small>{prices[index]}</small><div><i style={{ width: `${88 - index * 19}%` }} /></div></div>;
            })}
          </div>
          <div className="detail-disclaimer"><Check aria-hidden="true" /> This page is designed to become shareable content once live odds and player IDs are connected.</div>
        </section>
      </div>
    </main>
  );
}
