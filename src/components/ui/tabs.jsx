import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const Tabs = ({ className, ...props }) => <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-3', className)} {...props} />;
const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List data-slot="tabs-list" className={cn('text-muted-foreground flex w-full max-w-full items-center gap-6 overflow-x-auto border-b px-1', className)} {...props} />
);
const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger data-slot="tabs-trigger"
    className={cn("text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary focus-visible:ring-ring/50 -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent pt-3 pb-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer", className)}
    {...props} />
);
const TabsContent = ({ className, ...props }) => <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />;

export { Tabs, TabsList, TabsTrigger, TabsContent };
