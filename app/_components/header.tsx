import { Button } from '@/components/ui/button';

import { Logo } from '@/app/_components/shared';
import type { View } from '@/app/_components/types';

export function Header({
  activeView,
  setActiveView,
  feedState,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
  feedState: 'loading' | 'live' | 'fallback';
}) {
  const labels: { key: View; label: string }[] = [
    { key: 'cheatsheet', label: 'Rankings' },
    { key: 'compare', label: 'Compare' },
    { key: 'optimizer', label: 'Optimizer' },
    { key: 'league', label: 'My League' },
  ];

  return (
    <header className="site-header">
      <div className="page-shell header-inner">
        <button
          className="logo-button"
          onClick={() => setActiveView('cheatsheet')}
          aria-label="BookBacked rankings"
        >
          <Logo />
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          {labels.map((item) => (
            <button
              key={item.key}
              className={
                activeView === item.key
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              onClick={() => setActiveView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span
            className={`live-pill ${feedState === 'fallback' ? 'is-fallback' : ''}`}
          >
            <span className="live-dot" />
            {feedState === 'loading'
              ? 'Loading lines'
              : feedState === 'live'
                ? 'Lines live'
                : 'Sample fallback'}
          </span>
          <Button className="account-button" variant="outline">
            CP
          </Button>
        </div>
      </div>
    </header>
  );
}
