import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Move, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import * as server from '@/lib/server';
import { Button } from './ui/button';

const VIEW = 240; // size of the round frame on screen, in CSS pixels
const OUT = 256; // saved picture size
const MAX_ZOOM = 5;

interface Frame { zoom: number; x: number; y: number; turns: number }
const START: Frame = { zoom: 1, x: 0, y: 0, turns: 0 };

/** Load a picked file as an image element. */
function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('We couldn’t open that picture. Try a JPG or PNG.')); };
    img.src = url;
  });
}

/** Width and height of the image once turned by quarter turns. */
const turned = (img: HTMLImageElement, turns: number) =>
  turns % 2 ? { w: img.naturalHeight, h: img.naturalWidth } : { w: img.naturalWidth, h: img.naturalHeight };

/** Keep the photo covering the whole circle, however it's zoomed or dragged. */
function clamp(f: Frame, img: HTMLImageElement): Frame {
  const { w, h } = turned(img, f.turns);
  const s = (VIEW / Math.min(w, h)) * f.zoom;
  const maxX = Math.max(0, (w * s - VIEW) / 2);
  const maxY = Math.max(0, (h * s - VIEW) / 2);
  return { ...f, x: Math.min(maxX, Math.max(-maxX, f.x)), y: Math.min(maxY, Math.max(-maxY, f.y)) };
}

/** Draw exactly what's inside the circle onto a square canvas and return a small JPEG. */
function render(img: HTMLImageElement, f: Frame): string {
  const { w, h } = turned(img, f.turns);
  const s = (VIEW / Math.min(w, h)) * f.zoom;
  const k = OUT / VIEW;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = OUT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, OUT, OUT);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(OUT / 2 + f.x * k, OUT / 2 + f.y * k);
  ctx.rotate((f.turns * Math.PI) / 2);
  ctx.scale(s * k, s * k);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  for (const q of [0.88, 0.75, 0.6, 0.45]) {
    const data = canvas.toDataURL('image/jpeg', q);
    if (data.length <= server.MAX_PHOTO_CHARS) return data;
  }
  throw new Error('That picture couldn’t be used. Try another photo.');
}

/**
 * Frame a profile picture: drag to move, zoom with the slider, buttons or scroll wheel,
 * turn it a quarter at a time. The circle shows exactly what will be saved.
 */
export function PhotoEditor({ file, onApply, onCancel }: { file: File; onApply: (photo: string) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState<Frame>(START);
  const drag = useRef<{ id: number; x: number; y: number; from: Frame } | null>(null);

  useEffect(() => {
    let url = '';
    let gone = false;
    loadImage(file).then((r) => { url = r.url; if (gone) URL.revokeObjectURL(url); else { setImg(r.img); setFrame(START); } }, (e) => setError(e.message));
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [file]);

  const update = (next: Partial<Frame>) => img && setFrame((f) => clamp({ ...f, ...next }, img));
  const zoomBy = (d: number) => img && setFrame((f) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, +(f.zoom + d).toFixed(2)));
    const r = zoom / f.zoom; // keep the middle of the circle on the same spot
    return clamp({ ...f, zoom, x: f.x * r, y: f.y * r }, img);
  });

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: frame };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !img) return;
    setFrame(clamp({ ...d.from, x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y }, img));
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e: ReactWheelEvent) => zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, Partial<Frame>> = {
      ArrowLeft: { x: frame.x - step }, ArrowRight: { x: frame.x + step }, ArrowUp: { y: frame.y - step }, ArrowDown: { y: frame.y + step },
    };
    if (moves[e.key]) { e.preventDefault(); update(moves[e.key]); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(0.2); }
    if (e.key === '-') { e.preventDefault(); zoomBy(-0.2); }
  };

  const apply = () => {
    if (!img) return;
    try { onApply(render(img, frame)); } catch (e) { setError(e instanceof Error ? e.message : 'That picture couldn’t be used.'); }
  };

  let photoStyle = {};
  if (img) {
    const s = (VIEW / Math.min(turned(img, frame.turns).w, turned(img, frame.turns).h)) * frame.zoom;
    photoStyle = {
      width: img.naturalWidth * s, height: img.naturalHeight * s,
      transform: `translate(-50%, -50%) translate(${frame.x}px, ${frame.y}px) rotate(${frame.turns * 90}deg)`,
    };
  }

  return (
    <div className="bg-secondary/40 space-y-4 rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">Adjust your photo</div>
        <div className="text-muted-foreground flex items-center gap-1 text-xs"><Move className="size-3.5" />Drag to move · scroll or use the slider to zoom</div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
        <div
          role="application"
          aria-label="Photo framing. Drag or use the arrow keys to move, plus and minus to zoom."
          tabIndex={0}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={onWheel} onKeyDown={onKey}
          className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-xl bg-neutral-900 outline-none select-none active:cursor-grabbing focus-visible:ring-[3px] focus-visible:ring-ring/40"
          style={{ width: VIEW + 40, height: VIEW + 40 }}
        >
          {img && <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute top-1/2 left-1/2 max-w-none" style={photoStyle} />}
          {/* Dim everything outside the circle; the ring marks what will be saved. */}
          <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/90"
            style={{ width: VIEW, height: VIEW, boxShadow: '0 0 0 999px rgb(0 0 0 / 0.55)' }} />
          {!img && !error && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Loading…</div>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => zoomBy(-0.2)} disabled={!img || frame.zoom <= 1} aria-label="Zoom out"><ZoomOut /></Button>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={frame.zoom} disabled={!img}
          onChange={(e) => zoomBy(Number(e.target.value) - frame.zoom)}
          aria-label="Zoom" className="accent-foreground h-1.5 min-w-0 flex-1 cursor-pointer" />
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => zoomBy(0.2)} disabled={!img || frame.zoom >= MAX_ZOOM} aria-label="Zoom in"><ZoomIn /></Button>
        <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">{Math.round(frame.zoom * 100)}%</span>
      </div>

      {error && <p role="alert" className="text-destructive text-xs">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => update({ turns: (frame.turns + 1) % 4, x: 0, y: 0 })} disabled={!img}><RotateCw />Turn</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => img && setFrame(START)} disabled={!img}><RotateCcw />Reset</Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" onClick={apply} disabled={!img}>Use this photo</Button>
        </div>
      </div>
    </div>
  );
}
