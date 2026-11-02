import { cn } from '@/lib/utils';

// shadcn Avatar fallback only (sample people have no photos).
function Avatar({ name = '', className }) {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span data-slot="avatar" className={cn('bg-muted text-muted-foreground relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold', className)}>
      {initials}
    </span>
  );
}

export { Avatar };
