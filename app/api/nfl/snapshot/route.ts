import {
  getNflSnapshot,
  NflDataUnavailableError,
} from '@/lib/bookbacked/nfl-data';

export const dynamic = 'force-dynamic';

function positiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const snapshot = await getNflSnapshot({
      horizonDays: positiveInteger(url.searchParams.get('horizonDays')),
      maxGames: positiveInteger(url.searchParams.get('maxGames')),
    });

    return Response.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const unavailable = error instanceof NflDataUnavailableError;
    return Response.json(
      {
        error: unavailable
          ? 'NFL data is temporarily unavailable.'
          : 'Unable to build the NFL snapshot.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
