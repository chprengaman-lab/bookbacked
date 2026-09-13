import type { Metadata } from 'next';

import PlayerDetailClient, {
  type FallbackPlayerProfile,
} from '@/app/player/[slug]/player-detail-client';

const profiles: FallbackPlayerProfile[] = [
  { slug: 'josh-allen', name: 'Josh Allen', team: 'BUF', opponent: 'vs NE', pos: 'QB', color: '#2458A6', projection: 24.8, coverageScore: 92, floor: 19.2, ceiling: 31.6, markets: [{ name: 'Passing yards', value: '269.5' }, { name: 'Rushing yards', value: '41.5' }, { name: 'Passing TDs', value: '2.5' }] },
  { slug: 'bijan-robinson', name: 'Bijan Robinson', team: 'ATL', opponent: 'at PIT', pos: 'RB', color: '#C41130', projection: 21.7, coverageScore: 89, floor: 14.8, ceiling: 28.9, markets: [{ name: 'Rushing yards', value: '78.5' }, { name: 'Receiving yards', value: '35.5' }, { name: 'Anytime TD', value: '-145' }] },
  { slug: 'jamarr-chase', name: 'Ja’Marr Chase', team: 'CIN', opponent: 'vs PIT', pos: 'WR', color: '#F36A22', projection: 20.9, coverageScore: 87, floor: 11.7, ceiling: 31.2, markets: [{ name: 'Receiving yards', value: '84.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+105' }] },
  { slug: 'jahmyr-gibbs', name: 'Jahmyr Gibbs', team: 'DET', opponent: 'at GB', pos: 'RB', color: '#0076B6', projection: 20.1, coverageScore: 84, floor: 13.1, ceiling: 28.2, markets: [{ name: 'Rushing yards', value: '63.5' }, { name: 'Receiving yards', value: '32.5' }, { name: 'Anytime TD', value: '-115' }] },
  { slug: 'puka-nacua', name: 'Puka Nacua', team: 'LAR', opponent: 'vs SEA', pos: 'WR', color: '#003594', projection: 19.6, coverageScore: 82, floor: 12.4, ceiling: 28.1, markets: [{ name: 'Receiving yards', value: '79.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+125' }] },
  { slug: 'trey-mcbride', name: 'Trey McBride', team: 'ARI', opponent: 'at IND', pos: 'TE', color: '#97233F', projection: 16.4, coverageScore: 78, floor: 9.8, ceiling: 23.6, markets: [{ name: 'Receiving yards', value: '64.5' }, { name: 'Receptions', value: '5.5' }, { name: 'Anytime TD', value: '+160' }] },
  { slug: 'lamar-jackson', name: 'Lamar Jackson', team: 'BAL', opponent: 'vs CLE', pos: 'QB', color: '#241773', projection: 23.6, coverageScore: 77, floor: 16.8, ceiling: 32.4, markets: [{ name: 'Passing yards', value: '241.5' }, { name: 'Rushing yards', value: '57.5' }, { name: 'Passing TDs', value: '1.5' }] },
  { slug: 'justin-jefferson', name: 'Justin Jefferson', team: 'MIN', opponent: 'at CHI', pos: 'WR', color: '#4F2683', projection: 19.1, coverageScore: 76, floor: 10.9, ceiling: 28.8, markets: [{ name: 'Receiving yards', value: '81.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+130' }] },
  { slug: 'saquon-barkley', name: 'Saquon Barkley', team: 'PHI', opponent: 'vs NYG', pos: 'RB', color: '#004C54', projection: 19, coverageScore: 75, floor: 12.8, ceiling: 25.4, markets: [{ name: 'Rushing yards', value: '79.5' }, { name: 'Receiving yards', value: '19.5' }, { name: 'Anytime TD', value: '-125' }] },
  { slug: 'brock-bowers', name: 'Brock Bowers', team: 'LV', opponent: 'at DEN', pos: 'TE', color: '#111111', projection: 14.8, coverageScore: 73, floor: 8.7, ceiling: 21.9, markets: [{ name: 'Receiving yards', value: '58.5' }, { name: 'Receptions', value: '5.5' }, { name: 'Anytime TD', value: '+190' }] },
  { slug: 'ceedee-lamb', name: 'CeeDee Lamb', team: 'DAL', opponent: 'vs WAS', pos: 'WR', color: '#041E42', projection: 18.7, coverageScore: 71, floor: 10.3, ceiling: 28.5, markets: [{ name: 'Receiving yards', value: '76.5' }, { name: 'Receptions', value: '6.5' }, { name: 'Anytime TD', value: '+135' }] },
  { slug: 'breece-hall', name: 'Breece Hall', team: 'NYJ', opponent: 'at MIA', pos: 'RB', color: '#125740', projection: 17.4, coverageScore: 68, floor: 10.6, ceiling: 24.9, markets: [{ name: 'Rushing yards', value: '59.5' }, { name: 'Receiving yards', value: '27.5' }, { name: 'Anytime TD', value: '+120' }] },
];

export function generateStaticParams() {
  return profiles.map((profile) => ({ slug: profile.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = profiles.find((item) => item.slug === slug);
  const name = profile?.name ?? slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  return {
    title: `${name} sportsbook odds — BookBacked`,
    description: `${name} consensus fantasy projection, sportsbook lines, and alternate-line range.`,
    openGraph: { title: `${name} sportsbook odds — BookBacked`, description: `${name} sportsbook-powered fantasy outlook.`, images: [] },
    twitter: { card: 'summary', title: `${name} sportsbook odds — BookBacked`, description: `${name} sportsbook-powered fantasy outlook.`, images: [] },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PlayerDetailClient slug={slug} fallbackProfile={profiles.find((profile) => profile.slug === slug) ?? null} />;
}
