'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/game/store';
import { i18n } from '@/lib/i18n';

/**
 * Placeholder play page ("/play") for task F1.
 * Real camera and MediaPipe pose tracking will be added in task F2.
 * Uses "use client" to read the current displayName and totalXp from Zustand.
 */
export default function PlayPage() {
  const displayName = useGameStore((state) => state.displayName);
  const totalXp = useGameStore((state) => state.totalXp);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-white">
          {i18n.play.placeholder}
        </h1>

        {/* Quick readout so you can confirm Zustand kept your name across navigation */}
        <p className="text-sm text-slate-400">
          {i18n.play.playerPrefix}{' '}
          <span className="font-medium text-emerald-400">
            {displayName.trim() || i18n.play.defaultPlayer}
          </span>{' '}
          · {i18n.play.xpPrefix} <span className="text-slate-200">{totalXp}</span>
        </p>

        <Link
          href="/"
          className="inline-block rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          {i18n.play.backHome}
        </Link>
      </div>
    </main>
  );
}