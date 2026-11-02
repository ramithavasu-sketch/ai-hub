import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import * as server from './server';
import { demoApi, LIVE, liveApi, supabase, whoami, type Api } from './api';
import type { Db, Person } from './types';
import { Gate, type GateState } from '@/components/Gate';

const ME_KEY = 'aihub.me';

interface Hub {
  db: Db;
  me: Person;
  /** True on the real site (shared database, company sign-in); false in the demo. */
  live: boolean;
  /** Demo only: switch which sample person you are. */
  signIn: (id: string) => void;
  signOut: () => void;
  /** Run an action as the signed-in person, then reload. Resolves false (and shows why) if it was refused. */
  act: (fn: (api: Api) => Promise<unknown>, ok?: string) => Promise<boolean>;
  /** Demo only: put the sample data back. */
  resetData: () => void;
}

const Ctx = createContext<Hub | null>(null);

function friendlyAuthError(raw: string) {
  if (/database error saving new user|anywhere\.co/i.test(raw)) return 'Only Anywhere.co Google accounts can join the AI Hub. Sign in with your work account.';
  return 'Sign-in didn’t complete. Please try again.';
}

export function HubProvider({ children }: { children: ReactNode }) {
  const [meId, setMeId] = useState<string>(() => {
    try { return localStorage.getItem(ME_KEY) || 'u-asha'; } catch { return 'u-asha'; }
  });
  const meIdRef = useRef(meId);
  meIdRef.current = meId;
  const api = useMemo<Api>(() => (LIVE ? liveApi : demoApi(() => meIdRef.current)), []);

  const [db, setDb] = useState<Db | null>(() => (LIVE ? null : server.load()));
  const [gate, setGate] = useState<GateState>(LIVE ? 'loading' : 'ready');
  const [self, setSelf] = useState<Person | null>(null);
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async () => { setDb(await api.load()); }, [api]);

  // Live: follow the sign-in session and load the shared data once signed in.
  useEffect(() => {
    if (!LIVE) return;
    const qs = new URLSearchParams(location.search);
    const err = qs.get('error_description') || qs.get('error');
    if (err) {
      setAuthError(friendlyAuthError(err));
      history.replaceState(null, '', location.pathname + location.hash);
    }
    let cancelled = false;
    const enter = async (signedIn: boolean) => {
      if (!signedIn) { setGate('signed-out'); setDb(null); setSelf(null); return; }
      try {
        const who = await whoami();
        if (cancelled) return;
        setSelf(who);
        if (!who || !who.active) { setGate('blocked'); return; }
        const data = await liveApi.load();
        if (cancelled) return;
        setDb(data);
        setGate('ready');
      } catch {
        if (!cancelled) { setAuthError('We couldn’t load the AI Hub. Check your connection and try again.'); setGate('signed-out'); }
      }
    };
    const { data } = supabase!.auth.onAuthStateChange((event, session) => {
      // Defer: calling Supabase inside this callback can deadlock the client.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => enter(!!session), 0);
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, []);

  // Live: pick up colleagues' changes when you come back to the tab.
  useEffect(() => {
    if (!LIVE || gate !== 'ready') return;
    let last = Date.now();
    const on = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return;
      last = Date.now();
      refresh().catch(() => {});
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [gate, refresh]);

  const signIn = useCallback((id: string) => {
    setMeId(id);
    try { localStorage.setItem(ME_KEY, id); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(() => {
    if (LIVE) void supabase!.auth.signOut();
  }, []);

  const busy = useRef(false);
  const act = useCallback(async (fn: (a: Api) => Promise<unknown>, ok?: string) => {
    if (busy.current) return false; // ignore double-clicks while a save is running
    busy.current = true;
    try {
      await fn(api);
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      await refresh().catch(() => {});
      busy.current = false;
    }
  }, [api, refresh]);

  const resetData = useCallback(() => {
    setDb(server.reset());
    toast.success('Sample data restored.');
  }, []);

  const me = db && (LIVE ? db.people.find((p) => p.id === self?.id) ?? self : db.people.find((p) => p.id === meId) ?? db.people[0]);
  const value = useMemo(
    () => (db && me ? { db, me, live: LIVE, signIn, signOut, act, resetData } : null),
    [db, me, signIn, signOut, act, resetData],
  );

  if (gate !== 'ready' || !value) return <Gate state={gate} error={authError} person={self} onSignOut={signOut} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHub() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHub outside HubProvider');
  return v;
}

/** Lookup helpers bound to the current data. */
export function useLookup() {
  const { db } = useHub();
  return useMemo(() => {
    const people = new Map(db.people.map((p) => [p.id, p]));
    const depts = new Map(db.departments.map((d) => [d.id, d]));
    return {
      person: (id: string) => people.get(id),
      dept: (id: string) => depts.get(id),
    };
  }, [db]);
}
