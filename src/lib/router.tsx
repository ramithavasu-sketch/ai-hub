import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { LIVE } from './api';

// Tiny router. On the live site routes live in the address bar (#/projects/…) so links
// can be bookmarked and shared. Inside a Claude artifact the address bar never follows
// the page, so the demo keeps routes in memory.

const fromHash = () => {
  const h = decodeURI(location.hash.slice(1));
  return h.startsWith('/') ? h : '/';
};

let current = LIVE ? fromHash() : '/';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (LIVE) window.addEventListener('hashchange', () => { current = fromHash(); notify(); });

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
  if (LIVE) { location.hash = to; return; } // hashchange updates the page
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
