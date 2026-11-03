import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import type { Person } from '@/lib/types';

// Screens shown on the live site before the hub itself: loading, "access turned off",
// and "couldn't open". Google signs people in before the page loads, so there is no
// sign-in screen. Demo mode never shows these.

export type GateState = 'loading' | 'blocked' | 'error' | 'ready';

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink text-ink-foreground relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,204,42,.28),transparent_65%)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,204,42,.12),transparent_65%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="bg-gold inline-flex size-10 items-center justify-center rounded-xl text-[#111]">
            <span className="display text-2xl leading-none font-semibold italic">A</span>
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide text-white">AnywhereWorks</span>
            <span className="display block text-base text-white/70 italic">AI Hub</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Gate({ state, error, person }: { state: GateState; error: string; person: Person | null }) {
  if (state === 'loading' || state === 'ready')
    return (
      <Frame>
        <div className="flex items-center gap-3 text-white/70"><Loader2 className="size-5 animate-spin" />Opening the AI Hub…</div>
      </Frame>
    );

  if (state === 'blocked')
    return (
      <Frame>
        <Lock className="text-gold mb-4 size-8" />
        <h1 className="display text-4xl text-white">Your access is turned off</h1>
        <p className="mt-3 text-white/70">
          {person ? `You’re signed in as ${person.email}, ` : ''}but an admin has turned off access for this account. If you think this is a mistake, contact an AI Hub admin.
        </p>
      </Frame>
    );

  return (
    <Frame>
      <AlertCircle className="text-gold mb-4 size-8" />
      <h1 className="display text-4xl text-white">We couldn’t open the AI Hub</h1>
      <p role="alert" className="mt-3 text-white/70">{error}</p>
      <p className="mt-6 text-sm text-white/50">Refresh the page to try again.</p>
    </Frame>
  );
}
