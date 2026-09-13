import { getSleeperLeagueFreeAgents } from '@/lib/leagues/providers/sleeper';
import { LeagueProviderRequestError } from '@/lib/leagues/providers/http';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leagueId = url.searchParams.get('leagueId')?.trim();

  if (!leagueId) {
    return Response.json(
      { error: 'A leagueId is required.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const players = await getSleeperLeagueFreeAgents(leagueId);
    return Response.json({ leagueId, players }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof LeagueProviderRequestError) {
      return Response.json(
        { error: 'Sleeper is temporarily unavailable.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      { error: 'Unable to load free agents.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
