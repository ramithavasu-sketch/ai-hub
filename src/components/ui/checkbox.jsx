import { Checkbox as P } from 'radix-ui';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }) {
  return (
    <P.Root data-slot="checkbox"
      className={cn('peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer', className)}
      {...props}>
      <P.Indicator className="flex items-center justify-center text-current transition-none"><CheckIcon className="size-3.5" /></P.Indicator>
    </P.Root>
  );
}

export { Checkbox };
