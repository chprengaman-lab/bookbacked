'use client';

import { useEffect, useState } from 'react';

import { Cheatsheet } from '@/app/_components/cheatsheet';
import { Compare } from '@/app/_components/compare';
import { demoPlayers } from '@/app/_components/demo-data';
import { Header } from '@/app/_components/header';
import { Optimizer } from '@/app/_components/optimizer';
import type { View } from '@/app/_components/types';
import {
  adaptNflSnapshot,
  type UiSnapshot,
} from '@/lib/bookbacked/client';
import type { NflSnapshot } from '@/lib/bookbacked/types';

export default function Home() {
  const [activeView, setActiveView] = useState<View>(() => {
    if (typeof window === 'undefined') return 'cheatsheet';
    const requestedView = new URLSearchParams(window.location.search).get(
      'view',
    );
    return requestedView === 'cheatsheet' ||
      requestedView === 'compare' ||
      requestedView === 'optimizer'
      ? requestedView
      : 'cheatsheet';
  });
  const [liveSummary, setLiveSummary] = useState<UiSnapshot | null>(null);
  const [feedState, setFeedState] = useState<
    'loading' | 'live' | 'fallback'
  >('loading');
  const [requestedPlayer] = useState(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('player'),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/nfl/snapshot?maxGames=16&horizonDays=8', {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('NFL snapshot unavailable');
        return (await response.json()) as NflSnapshot;
      })
      .then((snapshot) => {
        const adapted = adaptNflSnapshot(snapshot);
        if (adapted.players.length < 2)
          throw new Error('NFL snapshot is empty');
        setLiveSummary(adapted);
        setFeedState('live');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setFeedState('fallback');
      });
    return () => controller.abort();
  }, []);

  const activePlayers = liveSummary?.players ?? demoPlayers;
  const dataKey = liveSummary?.generatedAt ?? 'sample';
  const slateLabel = liveSummary?.slateLabel ?? 'Sample slate';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        feedState={feedState}
      />
      {activeView === 'cheatsheet' && (
        <Cheatsheet
          players={activePlayers}
          summary={liveSummary}
          onCompare={() => setActiveView('compare')}
          onOptimize={() => setActiveView('optimizer')}
        />
      )}
      {activeView === 'compare' && (
        <Compare
          key={dataKey}
          players={activePlayers}
          slateLabel={slateLabel}
          initialSlug={requestedPlayer}
        />
      )}
      {activeView === 'optimizer' && <Optimizer />}
    </main>
  );
}
