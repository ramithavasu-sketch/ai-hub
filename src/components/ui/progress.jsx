import { Progress as P } from 'radix-ui';
import { cn } from '@/lib/utils';

function Progress({ className, value, ...props }) {
  return (
    <P.Root data-slot="progress" className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)} {...props}>
      <P.Indicator className="bg-primary h-full w-full flex-1 transition-all" style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
    </P.Root>
  );
}

export { Progress };
