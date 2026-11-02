import { useState, type ReactNode } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/api';
import type { Person } from '@/lib/types';

// Screens shown on the live site before the hub itself: loading, sign-in, and
// "access turned off". Demo mode never shows these.

export type GateState = 'loading' | 'signed-out' | 'blocked' | 'ready';

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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

function DevLogin() {
  // Local development only: one-click sign-in as Claude's temporary test accounts.
  const [msg, setMsg] = useState('');
  const password = import.meta.env.VITE_TEST_PASSWORD as string | undefined;
  if (!password) return null;
  const go = async (who: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email: `test-${who}@aihub.test`, password });
    setMsg(error ? error.message : '');
  };
  return (
    <div className="mt-8 space-y-2 rounded-2xl border border-white/15 p-4 text-sm">
      <div className="text-xs tracking-wide text-white/50 uppercase">Test sign-in (local only)</div>
      <div className="flex gap-2">
        {['admin', 'contributor', 'viewer'].map((w) => (
          <button key={w} onClick={() => go(w)} className="flex-1 cursor-pointer rounded-lg bg-white/15 py-2 capitalize hover:bg-white/25">{w}</button>
        ))}
      </div>
      {msg && <p className="text-red-300">{msg}</p>}
    </div>
  );
}

export function Gate({ state, error, person, onSignOut }: { state: GateState; error: string; person: Person | null; onSignOut: () => void }) {
  const [starting, setStarting] = useState(false);

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
        <button onClick={onSignOut} className="mt-8 cursor-pointer rounded-full border border-white/25 px-5 py-2.5 text-sm hover:bg-white/10">Sign out</button>
      </Frame>
    );

  const google = async () => {
    setStarting(true);
    const { error: e } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { hd: 'anywhere.co', prompt: 'select_account' } },
    });
    if (e) setStarting(false);
  };

  return (
    <Frame>
      <div className="text-gold text-xs font-semibold tracking-[.14em] uppercase">Discover. Collaborate. Innovate.</div>
      <h1 className="display mt-3 text-5xl leading-[1.05] text-white">Every AI project at <span className="italic">Anywhere.co</span>, in one place.</h1>
      <p className="mt-4 text-white/70">See who is building what, follow each project’s journey, and find every link you need to learn from it or join in.</p>
      <button onClick={google} disabled={starting}
        className="mt-8 inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-white px-5 py-3 font-medium text-[#111] transition hover:bg-white/90 disabled:opacity-70">
        {starting ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />}Sign in with Google
      </button>
      <p className="mt-3 text-center text-xs text-white/50">Use your Anywhere.co work account.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {import.meta.env.DEV && <DevLogin />}
    </Frame>
  );
}
