import type { LeagueProvider } from '@/lib/leagues/types';

const REQUEST_TIMEOUT_MS = 12_000;

export class LeagueProviderRequestError extends Error {
  readonly provider: LeagueProvider;
  readonly status: number | null;

  constructor(
    provider: LeagueProvider,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'LeagueProviderRequestError';
    this.provider = provider;
    this.status = status;
  }
}

export async function fetchLeagueProviderJson<T>(
  provider: LeagueProvider,
  url: URL,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LeagueProviderRequestError(
        provider,
        `${provider} returned HTTP ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof LeagueProviderRequestError) throw error;

    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `${provider} timed out`
        : `${provider} request failed`;
    throw new LeagueProviderRequestError(provider, message);
  } finally {
    clearTimeout(timeout);
  }
}
