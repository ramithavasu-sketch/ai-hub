import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Tiny in-memory router. Both a Claude artifact and an Apps Script web app run the
// page inside a frame whose address bar never follows it, so routes stay in memory.

let current = '/';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read() {
  const [path, qs = ''] = current.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  return route;
}

export const navigate = (to: string) => {
  current = to;
  notify();
};

export function Link({ to, onClick, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={`#${to}`} onClick={go} {...props} />;
}

/** Match "/projects/:id" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}
