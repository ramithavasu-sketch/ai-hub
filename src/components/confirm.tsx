import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

// In-page replacement for window.confirm(), which the artifact frame blocks.

type Ask = { title: string; body?: string; action: string; resolve: (ok: boolean) => void };
let open: ((a: Ask) => void) | null = null;

export function askConfirm(title: string, body?: string, action = 'Confirm') {
  return new Promise<boolean>((resolve) => (open ? open({ title, body, action, resolve }) : resolve(false)));
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => { open = setAsk; return () => { open = null; }; }, []);
  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && close(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ask?.title}</DialogTitle>
          {ask?.body && <DialogDescription>{ask.body}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => close(true)}>{ask?.action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
