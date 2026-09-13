'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type { UiPlayer } from '@/lib/bookbacked/client';

export function PlayerSearch({
  players,
  value,
  onChange,
  label,
}: {
  players: UiPlayer[];
  value: UiPlayer;
  onChange: (player: UiPlayer) => void;
  label: string;
}) {
  const [inputValue, setInputValue] = useState(value.name);

  function commitPlayer(name: string) {
    const next = players.find(
      (player) => player.name.toLowerCase() === name.trim().toLowerCase(),
    );
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
            if (
              !players.some(
                (player) =>
                  player.name.toLowerCase() === inputValue.toLowerCase(),
              )
            )
              setInputValue(value.name);
          }}
          aria-label={label}
        />
      </div>
    </label>
  );
}
