// app/game/page.tsx 
'use client'; 

import { useEffect, useState } from 'react';
import { FishSimple } from '@phosphor-icons/react';
import Header from '../components/Header';
import { AppIcon } from '../components/ui';

export default function Game() { 
  const [score, setScore] = useState(0); 
  const [fish, setFish] = useState(false); 
  const [multiplier, setMultiplier] = useState(1.5);

  const catchFish = () => { 
    setFish(true); 
    setScore(prev => prev + Math.max(1, Math.round(multiplier)) ); 
    setTimeout(() => setFish(false), 1000); 
  }; 

  useEffect(() => {
    try {
      const url = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      const m = parseFloat(url.searchParams.get('multiplier') || '1.5');
      if (!Number.isNaN(m) && m >= 1.5) setMultiplier(m);
    } catch {}
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Game" />
      <section className="app-page flex flex-1 flex-col items-center justify-center text-center">
        <div className="app-panel w-full max-w-sm">
          <div className="mb-4 flex items-center justify-center gap-2">
            <AppIcon icon={FishSimple} size="lg" weight="fill" className="text-accent" />
            <h1 className="font-display text-2xl font-bold">FarFISH Game</h1>
          </div>
          <h2 className="text-xl font-bold">Score: {score}</h2>
          <p className="mt-1 text-sm text-muted">Current multiplier: x{multiplier.toFixed(1)}</p>

          <div className="game-water relative mx-auto my-section h-40 w-52 overflow-hidden rounded-control">
            {fish && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 animate-[jump_0.5s_ease-in-out]">
                <AppIcon icon={FishSimple} size="lg" weight="fill" aria-label="Caught fish" />
              </div>
            )}
          </div>

          <button type="button" onClick={catchFish} className="app-button w-full text-lg">
            Cast Line
          </button>
        </div>
      </section>
    </div>
  );
}
