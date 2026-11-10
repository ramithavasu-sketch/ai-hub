import { useRef, useState, type ChangeEvent } from 'react';
import { CircleCheck, FileText, FileUp, Loader2, Paperclip, Undo2, X } from 'lucide-react';
import { useHub } from '@/lib/store';
import * as server from '@/lib/server';
import { RESOURCE_TYPES } from '@/lib/meta';
import { MAX_READ_MB, MAX_UPLOAD_MB } from '@/lib/api';
import type { ResourceType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DOC_ACCEPT = '.docx,.doc,.pdf,.txt,.md,.rtf,.odt';

export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** File name without its extension, for a starting title. */
export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) || name;

/** A hidden file input plus a function that opens it. */
export function useFilePicker(onPick: (files: File[]) => void, opts: { accept?: string; multiple?: boolean } = {}) {
  const ref = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = ''; // let the same file be picked again
    if (files.length) onPick(files);
  };
  const input = <input ref={ref} type="file" hidden accept={opts.accept} multiple={opts.multiple} onChange={onChange} />;
  return [() => ref.current?.click(), input] as const;
}

// ---------- fill the form from a document ----------

const FIELD_NAMES: Record<server.DocField, string> = {
  name: 'name', tagline: 'summary', description: 'description', problem: 'problem', solution: 'solution',
  benefits: 'outcome', technologies: 'tools', tags: 'keywords', notes: 'notes',
};

/**
 * "Have a project document?" card. Reads the file, hands the fields it found to the form,
 * and offers Undo. Everything it fills stays editable in the form below.
 */
export function ImportDocument({ onFill, onUndo }: {
  onFill: (fields: Partial<Record<server.DocField, string>>, file: File) => void;
  onUndo: () => void;
}) {
  const { api, live } = useHub();
  const [state, setState] = useState<{ step: 'idle' | 'reading' } | { step: 'done'; file: string; found: server.DocField[] }>({ step: 'idle' });
  const [error, setError] = useState('');

  const [open, input] = useFilePicker(async ([file]) => {
    setError('');
    setState({ step: 'reading' });
    try {
      const { fields, found } = await api.readDocument(file);
      if (!found.length) throw new Error('We couldn’t find project details in that file. Try headings like “Problem” and “Proposed solution”, or fill in the form yourself.');
      onFill(fields, file);
      setState({ step: 'done', file: file.name, found });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t read that file.');
      setState({ step: 'idle' });
    }
  }, { accept: live ? DOC_ACCEPT : '.txt,.md' });

  return (
    <div className="bg-card mt-5 rounded-2xl border p-4">
      {input}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FileText className="text-gold-ink size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          {state.step === 'done' ? (
            <>
              <p className="font-medium">Filled {state.found.length} {state.found.length === 1 ? 'field' : 'fields'} from {state.file}</p>
              <p className="text-muted-foreground">
                {(Object.keys(FIELD_NAMES) as server.DocField[]).filter((k) => state.found.includes(k)).map((k) => FIELD_NAMES[k]).join(', ')}. Check them below and edit anything that isn’t right.
                {live && ' The document is also attached under Files.'}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Have a project document?</p>
              <p className="text-muted-foreground">
                Upload it and we’ll fill in the form for you to check. {live ? `Word, PDF or text, up to ${MAX_READ_MB} MB.` : 'The demo reads .txt files.'} Works best with headings like Project name, Problem, Proposed solution and Expected outcome.
              </p>
            </>
          )}
          {error && <p role="alert" className="text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {state.step === 'done' && (
            <Button type="button" variant="ghost" onClick={() => { onUndo(); setState({ step: 'idle' }); }}><Undo2 />Undo</Button>
          )}
          <Button type="button" variant="outline" onClick={open} disabled={state.step === 'reading'}>
            {state.step === 'reading' ? <><Loader2 className="animate-spin" />Reading…</> : <><FileUp />{state.step === 'done' ? 'Use another' : 'Upload document'}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- files to attach ----------

export interface Attachment {
  key: string;
  file: File;
  title: string;
  type: ResourceType;
  /** Set once the file is uploaded, so a retry doesn't upload it twice. */
  url?: string;
  /** Set once it's saved on the project. */
  added?: boolean;
}

export function toAttachment(file: File): Attachment {
  return { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file, title: titleFromFile(file.name), type: server.resourceTypeFor(file.name, file.type) };
}

/** Files picked in the project form (live only). Titles and types can be edited; files upload when the project is saved. */
export function Attachments({ value, onChange, disabled }: { value: Attachment[]; onChange: (v: Attachment[]) => void; disabled?: boolean }) {
  const [error, setError] = useState('');
  const [open, input] = useFilePicker((files) => {
    const big = files.filter((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    setError(big.length ? `${big.map((f) => f.name).join(', ')} ${big.length === 1 ? 'is' : 'are'} over ${MAX_UPLOAD_MB} MB.` : '');
    onChange([...value, ...files.filter((f) => !big.includes(f)).map(toAttachment)]);
  }, { multiple: true });
  const edit = (key: string, patch: Partial<Attachment>) => onChange(value.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-2">
      {input}
      <div className="text-sm font-medium">Files <span className="text-muted-foreground font-normal">(optional)</span></div>
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((a) => (
            <li key={a.key} className="space-y-2 rounded-xl border p-2.5">
              <div className="flex items-center gap-2">
                {a.added ? <CircleCheck className="text-success size-4 shrink-0" /> : <Paperclip className="text-muted-foreground size-4 shrink-0" />}
                <Input value={a.title} onChange={(e) => edit(a.key, { title: e.target.value })} maxLength={120} disabled={disabled || a.added} aria-label={`Title for ${a.file.name}`} className="h-9" />
                <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onChange(value.filter((x) => x.key !== a.key))} disabled={disabled || a.added} aria-label={`Remove ${a.file.name}`}><X /></Button>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Select value={a.type} onValueChange={(v) => edit(a.key, { type: v as ResourceType })} disabled={disabled || a.added}>
                  <SelectTrigger className="h-8! w-44" aria-label={`Type for ${a.file.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{RESOURCE_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-muted-foreground min-w-0 truncate text-xs">{a.file.name} · {fileSize(a.file.size)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={open} disabled={disabled}><FileUp />Upload files</Button>
      <p className="text-muted-foreground text-xs">
        PDFs, slides, images or documents, up to {MAX_UPLOAD_MB} MB each. They upload when you save, into the AI Hub’s Google Drive folder, and anyone at AnywhereWorks with the link can open them.
      </p>
      {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
