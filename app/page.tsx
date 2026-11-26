'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/game/store';
import { i18n } from '@/lib/i18n';

/**
 * Home page ("/").
 * Uses "use client" because it reads and updates the Zustand hook (useGameStore).
 */
export default function HomePage() {
  // Connect the text input directly to the in-memory Zustand store
  const displayName = useGameStore((state) => state.displayName);
  const setDisplayName = useGameStore((state) => state.setDisplayName);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        {/* Game title and one-sentence description */}
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-emerald-400">
            {i18n.home.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            {i18n.home.description}
          </p>
        </div>

        {/* Optional display-name field stored in Zustand */}
        <div className="space-y-2">
          <label
            htmlFor="display-name"
            className="block text-sm font-medium text-slate-200"
          >
            {i18n.home.nameLabel}
          </label>
          <input
            id="display-name"
            type="text"
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={i18n.home.namePlaceholder}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        {/* Client-side link to /play so in-memory Zustand state is kept */}
        <Link
          href="/play"
          className="block w-full rounded-xl bg-emerald-500 px-5 py-3 text-center text-base font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          {i18n.home.startButton}
        </Link>

        <p className="text-center text-xs text-slate-400">
          {i18n.home.privacyNote}
        </p>
      </div>
    </main>
  );
}