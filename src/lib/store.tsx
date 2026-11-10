import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import * as server from './server';
import { accountLinks, boot, demoApi, LIVE, liveApi, type Api } from './api';
import type { Db, Person } from './types';
import { Gate, type GateState } from '@/components/Gate';

const ME_KEY = 'aihub.me';

interface Hub {
  db: Db;
  me: Person;
  /** True on the real site (Apps Script, shared Google Sheet); false in the demo. */
  live: boolean;
  /** Demo only: switch which sample person you are. */
  signIn: (id: string) => void;
  /** Live only: Google links to switch account or sign out. */
  account: ReturnType<typeof accountLinks> | null;
  /** Run an action as the signed-in person, then reload. Resolves false (and shows why) if it was refused. */
  act: (fn: (api: Api) => Promise<unknown>, ok?: string) => Promise<boolean>;
  /** Direct access for calls that don't change data, such as reading a document. */
  api: Api;
  /** Demo only: put the sample data back. */
  resetData: () => void;
}

const Ctx = createContext<Hub | null>(null);

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
  const [account, setAccount] = useState<Hub['account']>(null);

  const refresh = useCallback(async () => { setDb(await api.load()); }, [api]);

  // Live: Google has already signed the person in; find (or create) their profile and load.
  useEffect(() => {
    if (!LIVE) return;
    boot()
      .then((r) => {
        setSelf(r.me);
        setAccount(accountLinks(r.appUrl ?? ''));
        if (!r.data) { setGate('blocked'); return; }
        setDb(r.data);
        setGate('ready');
      })
      .catch((e) => { setAuthError(e instanceof Error ? e.message : 'We couldn’t load the AI Hub.'); setGate('error'); });
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
    () => (db && me ? { db, me, live: LIVE, signIn, account, act, api, resetData } : null),
    [db, me, signIn, account, act, api, resetData],
  );

  if (gate !== 'ready' || !value) return <Gate state={gate} error={authError} person={self} />;
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
