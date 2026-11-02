import { Popover as P } from 'radix-ui';
import { cn } from '@/lib/utils';

const Popover = (props) => <P.Root data-slot="popover" {...props} />;
const PopoverTrigger = (props) => <P.Trigger data-slot="popover-trigger" {...props} />;
function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset}
        className={cn('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 w-72 rounded-md border p-4 shadow-md outline-hidden', className)}
        {...props} />
    </P.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
