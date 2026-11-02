import { DropdownMenu as P } from 'radix-ui';
import { CheckIcon, CircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const DropdownMenu = (props) => <P.Root data-slot="dropdown-menu" {...props} />;
const DropdownMenuTrigger = (props) => <P.Trigger data-slot="dropdown-menu-trigger" {...props} />;
const DropdownMenuRadioGroup = (props) => <P.RadioGroup {...props} />;

function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <P.Portal>
      <P.Content sideOffset={sideOffset}
        className={cn('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md', className)}
        {...props} />
    </P.Portal>
  );
}
const itemCls = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";
const DropdownMenuItem = ({ className, ...props }) => <P.Item className={cn(itemCls, className)} {...props} />;
const DropdownMenuRadioItem = ({ className, children, ...props }) => (
  <P.RadioItem className={cn(itemCls, 'pl-8', className)} {...props}>
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"><P.ItemIndicator><CircleIcon className="size-2 fill-current" /></P.ItemIndicator></span>
    {children}
  </P.RadioItem>
);
const DropdownMenuCheckboxItem = ({ className, children, ...props }) => (
  <P.CheckboxItem className={cn(itemCls, 'pl-8', className)} {...props}>
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"><P.ItemIndicator><CheckIcon className="size-4" /></P.ItemIndicator></span>
    {children}
  </P.CheckboxItem>
);
const DropdownMenuLabel = ({ className, ...props }) => <P.Label className={cn('px-2 py-1.5 text-sm font-medium', className)} {...props} />;
const DropdownMenuSeparator = ({ className, ...props }) => <P.Separator className={cn('bg-border -mx-1 my-1 h-px', className)} {...props} />;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem };
