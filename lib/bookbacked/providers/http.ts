import type { OddsProvider } from '@/lib/bookbacked/types';

const REQUEST_TIMEOUT_MS = 12_000;

export class ProviderRequestError extends Error {
  readonly provider: OddsProvider;
  readonly status: number | null;

  constructor(
    provider: OddsProvider,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderRequestError';
    this.provider = provider;
    this.status = status;
  }
}

export function requireServerSecret(
  name: 'PROPLINE_API_KEY' | 'SPORTSGAMEODDS_API_KEY',
) {
  const value = process.env[name];

  if (!value) {
    throw new ProviderRequestError(
      name === 'PROPLINE_API_KEY' ? 'propline' : 'sports-game-odds',
      `${name} is not configured`,
    );
  }

  return value;
}

export async function fetchProviderJson<T>(
  provider: OddsProvider,
  url: URL,
  apiKey: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderRequestError(
        provider,
        `${provider} returned HTTP ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;

    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `${provider} timed out`
        : `${provider} request failed`;
    throw new ProviderRequestError(provider, message);
  } finally {
    clearTimeout(timeout);
  }
}
