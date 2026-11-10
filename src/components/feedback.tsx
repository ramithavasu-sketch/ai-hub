import { useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import { ExternalLink, ImagePlus, Loader2, MessageSquareText, Sparkles, ThumbsUp, Wrench, X } from 'lucide-react';
import { MAX_FEEDBACK_IMAGE_MB } from '@/lib/api';
import { fileSize, useFilePicker } from './uploads';
import { useHub, useLookup } from '@/lib/store';
import { match, navigate } from '@/lib/router';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Db, FeedbackRating, FeedbackStatus } from '@/lib/types';
import { PersonAvatar } from './hub';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export const RATINGS: { k: FeedbackRating; label: string; hint: string; icon: typeof ThumbsUp; tone: string }[] = [
  { k: 'works_well', label: 'Works well', hint: 'Something here is helpful', icon: ThumbsUp, tone: 'text-success bg-success/10 border-success/30' },
  { k: 'could_be_better', label: 'Could be better', hint: 'Something is missing or confusing', icon: Wrench, tone: 'text-gold-ink bg-warning/10 border-warning/40' },
];

export const FEEDBACK_STATUSES: { k: FeedbackStatus; label: string }[] = [
  { k: 'new', label: 'New' },
  { k: 'in_progress', label: 'In progress' },
  { k: 'done', label: 'Done' },
];

/** A readable name for the page at this route, saved with the feedback. */
export function pageName(path: string, db: Db): string {
  const [p] = path.split('?');
  let m: Record<string, string> | null;
  if ((m = match('/projects/:id/edit', p))) return `Edit project: ${db.projects.find((x) => x.id === m!.id)?.name ?? 'project'}`;
  if ((m = match('/projects/:id', p))) return `Project: ${db.projects.find((x) => x.id === m!.id)?.name ?? 'project'}`;
  if ((m = match('/people/:id', p))) return `Profile: ${db.people.find((x) => x.id === m!.id)?.name ?? 'person'}`;
  if ((m = match('/departments/:id', p))) return `Department: ${db.departments.find((x) => x.id === m!.id)?.name ?? 'department'}`;
  const names: Record<string, string> = {
    '/': 'Home', '/projects': 'Explore projects', '/new': 'Add project', '/people': 'Our contributors',
    '/departments': 'Departments', '/resources': 'Resource library', '/mine': 'My projects', '/admin': 'Admin panel',
  };
  return names[p] ?? 'AI Hub';
}

/** "Feedback" button in the top bar: tells the admins how the current page is working. */
export function FeedbackButton({ path }: { path: string }) {
  const { db, act } = useHub();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [sending, setSending] = useState(false);
  const page = pageName(path, db);
  const needsMessage = rating === 'could_be_better' && !message.trim();

  // A local preview of the picked image, released when it changes.
  useEffect(() => {
    if (!image) { setPreview(''); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const pickImage = (file: File) => {
    setImageError('');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return setImageError('Attach a picture (JPG, PNG, WebP or GIF).');
    if (file.size > MAX_FEEDBACK_IMAGE_MB * 1024 * 1024) return setImageError(`Pictures can be up to ${MAX_FEEDBACK_IMAGE_MB} MB.`);
    setImage(file);
  };
  const [chooseImage, imageInput] = useFilePicker(([f]) => pickImage(f), { accept: 'image/jpeg,image/png,image/webp,image/gif' });
  // A screenshot pasted into the comment box (Cmd+V) is attached too.
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); pickImage(new File([file], file.name && file.name !== 'image.png' ? file.name : `screenshot-${Date.now()}.png`, { type: file.type })); }
  };

  const start = () => { setRating(null); setMessage(''); setImage(null); setImageError(''); setOpen(true); };
  const submit = async () => {
    if (!rating) return;
    setSending(true);
    const ok = await act(async (api) => {
      const imageUrl = image ? await api.attachFeedbackImage(image) : '';
      await api.submitFeedback({ page, path, rating, message, imageUrl });
    }, 'Thanks! Your feedback was sent to the admin team.');
    setSending(false);
    if (ok) setOpen(false);
  };

  return (
    <>
      <button onClick={start} className="bg-card hover:bg-accent inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-label="Send feedback about this page">
        <MessageSquareText className="size-[18px]" /><span className="hidden lg:inline">Feedback</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback on this page</DialogTitle>
            <DialogDescription>About <span className="text-foreground font-medium">{page}</span>. Only admins see it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div role="radiogroup" aria-label="How is this page working for you?" className="grid gap-2 sm:grid-cols-2">
              {RATINGS.map((r) => (
                <button key={r.k} type="button" role="radio" aria-checked={rating === r.k} onClick={() => setRating(r.k)}
                  className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    rating === r.k ? r.tone : 'hover:bg-accent')}>
                  <r.icon className="mt-0.5 size-5 shrink-0" />
                  <span><span className="text-foreground block text-sm font-medium">{r.label}</span><span className="text-muted-foreground block text-xs">{r.hint}</span></span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fb-msg">
                {rating === 'could_be_better' ? 'What could be better?' : 'Anything to add?'}{' '}
                <span className="text-muted-foreground font-normal">{rating === 'could_be_better' ? '(required)' : '(optional)'}</span>
              </Label>
              <Textarea id="fb-msg" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} onPaste={onPaste}
                placeholder={rating === 'could_be_better' ? 'What were you trying to do, and what got in the way?' : 'What do you like, or what would you add?'} />
            </div>
            <div className="space-y-2">
              {imageInput}
              {image ? (
                <div className="flex items-center gap-3 rounded-xl border p-2">
                  {preview && <img src={preview} alt="Attached image preview" className="size-14 shrink-0 rounded-lg border object-cover" />}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate font-medium">{image.name}</div>
                    <div className="text-muted-foreground text-xs">{fileSize(image.size)}</div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setImage(null)} disabled={sending} aria-label="Remove attached image"><X /></Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Button type="button" variant="outline" size="sm" onClick={chooseImage}><ImagePlus />Attach image</Button>
                  <span className="text-muted-foreground text-xs">Optional · a screenshot helps · up to {MAX_FEEDBACK_IMAGE_MB} MB, or paste one into the box above</span>
                </div>
              )}
              {imageError && <p role="alert" className="text-destructive text-xs">{imageError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={submit} disabled={!rating || needsMessage || sending}>
              {sending ? <><Loader2 className="animate-spin" />{image ? 'Uploading…' : 'Sending…'}</> : 'Send feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Admin Panel tab: every piece of feedback, with filters and a status to track it. */
export function FeedbackTracker() {
  const { db, act } = useHub();
  const { person } = useLookup();
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [rating, setRating] = useState<FeedbackRating | 'all'>('all');

  const list = useMemo(() => [...db.feedback]
    .filter((f) => (status === 'all' || f.status === status) && (rating === 'all' || f.rating === rating))
    .sort((a, b) => b.date.localeCompare(a.date)), [db.feedback, status, rating]);
  const count = (k: FeedbackStatus) => db.feedback.filter((f) => f.status === k).length;
  const pill = (on: boolean) => cn('cursor-pointer rounded-full border px-3 py-1 text-sm', on ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-accent');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total', db.feedback.length], ...FEEDBACK_STATUSES.map((s) => [s.label, count(s.k)])].map(([l, n]) => (
          <div key={l} className="panel p-4"><div className="display text-3xl">{n}</div><div className="text-muted-foreground text-xs">{l}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={pill(status === 'all')} onClick={() => setStatus('all')}>All</button>
        {FEEDBACK_STATUSES.map((s) => <button key={s.k} className={pill(status === s.k)} onClick={() => setStatus(s.k)}>{s.label}</button>)}
        <span className="bg-border mx-1 h-5 w-px" />
        <button className={pill(rating === 'all')} onClick={() => setRating('all')}>Any rating</button>
        {RATINGS.map((r) => <button key={r.k} className={pill(rating === r.k)} onClick={() => setRating(r.k)}>{r.label}</button>)}
      </div>

      {list.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          <Sparkles className="mx-auto mb-2 size-5" />
          {db.feedback.length ? 'No feedback matches these filters.' : 'No feedback yet. People can send it from the Feedback button at the top of every page.'}
        </div>
      ) : (
        <ul className="panel divide-y">
          {list.map((f) => {
            const r = RATINGS.find((x) => x.k === f.rating)!;
            const who = person(f.authorId);
            return (
              <li key={f.id} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', f.status === 'done' && 'opacity-60')}>
                <PersonAvatar person={who} className="size-8" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{who?.name ?? 'Former member'}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', r.tone)}><r.icon className="size-3" />{r.label}</span>
                    <span className="text-muted-foreground text-xs">{timeAgo(f.date)}</span>
                  </div>
                  <button onClick={() => navigate(f.path)} className="text-muted-foreground cursor-pointer text-xs hover:underline">on {f.page}</button>
                  {f.message ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{f.message}</p> : <p className="text-muted-foreground text-sm italic">No comment added.</p>}
                  {f.imageUrl && <FeedbackImage url={f.imageUrl} />}
                </div>
                <Select value={f.status} onValueChange={(v) => act((api) => api.setFeedbackStatus(f.id, v as FeedbackStatus))}>
                  <SelectTrigger className="h-8! w-36 shrink-0" aria-label={`Status of feedback from ${who?.name ?? 'someone'}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{FEEDBACK_STATUSES.map((s) => <SelectItem key={s.k} value={s.k}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The picture attached to a piece of feedback: shown inline (demo) or as a Drive link (live). */
function FeedbackImage({ url }: { url: string }) {
  const [big, setBig] = useState(false);
  if (url.startsWith('data:image/')) {
    return (
      <>
        <button onClick={() => setBig(true)} className="mt-1 block cursor-zoom-in" aria-label="Open the attached image">
          <img src={url} alt="Attached to the feedback" className="max-h-32 rounded-lg border object-contain" />
        </button>
        <Dialog open={big} onOpenChange={setBig}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader><DialogTitle>Attached image</DialogTitle></DialogHeader>
            <img src={url} alt="Attached to the feedback" className="max-h-[70vh] w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="bg-card hover:bg-accent mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
      <ImagePlus className="size-3.5" />View attached image<ExternalLink className="size-3" />
    </a>
  );
}
