// components/ui/shadcn/index.js - Unified Shadcn Components with Lazy Loading
// Usage: import { shadcn } from '@/components/ui/shadcn'
// Then: <shadcn.Button />, <shadcn.Card />, etc.

class ShadcnComponents {
    // Cache for loaded components
    _cache = new Map();
  
    // Lazy getter helper
    _createGetter(componentName, componentFile, exportName = null) {
      return {
        get() {
          const cacheKey = exportName ? `${componentFile}:${exportName}` : componentFile;
          
          if (!this._cache.has(cacheKey)) {
            try {
              const module = require(`@/components/ui/shadcn/components/${componentFile}`);
              const component = exportName ? module[exportName] : module.default || module[componentName];
              
              if (!component) {
                console.warn(`Shadcn component "${exportName || componentName}" not found in ${componentFile}`);
                return null;
              }
              
              this._cache.set(cacheKey, component);
            } catch (error) {
              console.error(`Error loading Shadcn component from ${componentFile}:`, error);
              return null;
            }
          }
          
          return this._cache.get(cacheKey);
        },
        configurable: true
      };
    }
  
    constructor() {
      // Define all Shadcn components as lazy getters
      // Format: [propertyName, filename, exportName (optional)]
      const components = [
        // Layout & Structure
        ['Card', 'card', 'Card'],
        ['CardContent', 'card', 'CardContent'],
        ['CardDescription', 'card', 'CardDescription'],
        ['CardFooter', 'card', 'CardFooter'],
        ['CardHeader', 'card', 'CardHeader'],
        ['CardTitle', 'card', 'CardTitle'],
        
        ['Sheet', 'sheet', 'Sheet'],
        ['SheetContent', 'sheet', 'SheetContent'],
        ['SheetDescription', 'sheet', 'SheetDescription'],
        ['SheetFooter', 'sheet', 'SheetFooter'],
        ['SheetHeader', 'sheet', 'SheetHeader'],
        ['SheetTitle', 'sheet', 'SheetTitle'],
        ['SheetTrigger', 'sheet', 'SheetTrigger'],
        ['SheetClose', 'sheet', 'SheetClose'],
        
        ['Dialog', 'dialog', 'Dialog'],
        ['DialogContent', 'dialog', 'DialogContent'],
        ['DialogDescription', 'dialog', 'DialogDescription'],
        ['DialogFooter', 'dialog', 'DialogFooter'],
        ['DialogHeader', 'dialog', 'DialogHeader'],
        ['DialogTitle', 'dialog', 'DialogTitle'],
        ['DialogTrigger', 'dialog', 'DialogTrigger'],
        ['DialogClose', 'dialog', 'DialogClose'],
        
        ['Drawer', 'drawer', 'Drawer'],
        ['DrawerClose', 'drawer', 'DrawerClose'],
        ['DrawerContent', 'drawer', 'DrawerContent'],
        ['DrawerDescription', 'drawer', 'DrawerDescription'],
        ['DrawerFooter', 'drawer', 'DrawerFooter'],
        ['DrawerHeader', 'drawer', 'DrawerHeader'],
        ['DrawerTitle', 'drawer', 'DrawerTitle'],
        ['DrawerTrigger', 'drawer', 'DrawerTrigger'],
        
        // Navigation
        ['Tabs', 'tabs', 'Tabs'],
        ['TabsContent', 'tabs', 'TabsContent'],
        ['TabsList', 'tabs', 'TabsList'],
        ['TabsTrigger', 'tabs', 'TabsTrigger'],
        
        ['NavigationMenu', 'navigation-menu', 'NavigationMenu'],
        ['NavigationMenuContent', 'navigation-menu', 'NavigationMenuContent'],
        ['NavigationMenuItem', 'navigation-menu', 'NavigationMenuItem'],
        ['NavigationMenuLink', 'navigation-menu', 'NavigationMenuLink'],
        ['NavigationMenuList', 'navigation-menu', 'NavigationMenuList'],
        ['NavigationMenuTrigger', 'navigation-menu', 'NavigationMenuTrigger'],
        
        ['Breadcrumb', 'breadcrumb', 'Breadcrumb'],
        ['BreadcrumbEllipsis', 'breadcrumb', 'BreadcrumbEllipsis'],
        ['BreadcrumbItem', 'breadcrumb', 'BreadcrumbItem'],
        ['BreadcrumbLink', 'breadcrumb', 'BreadcrumbLink'],
        ['BreadcrumbList', 'breadcrumb', 'BreadcrumbList'],
        ['BreadcrumbPage', 'breadcrumb', 'BreadcrumbPage'],
        ['BreadcrumbSeparator', 'breadcrumb', 'BreadcrumbSeparator'],
        
        // Forms & Inputs
        ['Button', 'button'],
        ['Input', 'input'],
        ['Textarea', 'textarea'],
        ['Label', 'label'],
        ['Checkbox', 'checkbox'],
        ['RadioGroup', 'radio-group', 'RadioGroup'],
        ['RadioGroupItem', 'radio-group', 'RadioGroupItem'],
        ['Switch', 'switch'],
        ['Slider', 'slider'],
        
        ['Select', 'select', 'Select'],
        ['SelectContent', 'select', 'SelectContent'],
        ['SelectGroup', 'select', 'SelectGroup'],
        ['SelectItem', 'select', 'SelectItem'],
        ['SelectLabel', 'select', 'SelectLabel'],
        ['SelectSeparator', 'select', 'SelectSeparator'],
        ['SelectTrigger', 'select', 'SelectTrigger'],
        ['SelectValue', 'select', 'SelectValue'],
        
        ['Combobox', 'combobox'],
        ['Command', 'command', 'Command'],
        ['CommandDialog', 'command', 'CommandDialog'],
        ['CommandEmpty', 'command', 'CommandEmpty'],
        ['CommandGroup', 'command', 'CommandGroup'],
        ['CommandInput', 'command', 'CommandInput'],
        ['CommandItem', 'command', 'CommandItem'],
        ['CommandList', 'command', 'CommandList'],
        ['CommandSeparator', 'command', 'CommandSeparator'],
        ['CommandShortcut', 'command', 'CommandShortcut'],
        
        ['Form', 'form', 'Form'],
        ['FormControl', 'form', 'FormControl'],
        ['FormDescription', 'form', 'FormDescription'],
        ['FormField', 'form', 'FormField'],
        ['FormItem', 'form', 'FormItem'],
        ['FormLabel', 'form', 'FormLabel'],
        ['FormMessage', 'form', 'FormMessage'],
        
        // Feedback & Alerts
        ['Alert', 'alert', 'Alert'],
        ['AlertDescription', 'alert', 'AlertDescription'],
        ['AlertTitle', 'alert', 'AlertTitle'],
        
        ['AlertDialog', 'alert-dialog', 'AlertDialog'],
        ['AlertDialogAction', 'alert-dialog', 'AlertDialogAction'],
        ['AlertDialogCancel', 'alert-dialog', 'AlertDialogCancel'],
        ['AlertDialogContent', 'alert-dialog', 'AlertDialogContent'],
        ['AlertDialogDescription', 'alert-dialog', 'AlertDialogDescription'],
        ['AlertDialogFooter', 'alert-dialog', 'AlertDialogFooter'],
        ['AlertDialogHeader', 'alert-dialog', 'AlertDialogHeader'],
        ['AlertDialogTitle', 'alert-dialog', 'AlertDialogTitle'],
        ['AlertDialogTrigger', 'alert-dialog', 'AlertDialogTrigger'],
        
        ['Toast', 'toast', 'Toast'],
        ['ToastAction', 'toast', 'ToastAction'],
        ['ToastClose', 'toast', 'ToastClose'],
        ['ToastDescription', 'toast', 'ToastDescription'],
        ['ToastProvider', 'toast', 'ToastProvider'],
        ['ToastTitle', 'toast', 'ToastTitle'],
        ['ToastViewport', 'toast', 'ToastViewport'],
        
        ['Tooltip', 'tooltip', 'Tooltip'],
        ['TooltipContent', 'tooltip', 'TooltipContent'],
        ['TooltipProvider', 'tooltip', 'TooltipProvider'],
        ['TooltipTrigger', 'tooltip', 'TooltipTrigger'],
        
        ['Popover', 'popover', 'Popover'],
        ['PopoverContent', 'popover', 'PopoverContent'],
        ['PopoverTrigger', 'popover', 'PopoverTrigger'],
        
        ['HoverCard', 'hover-card', 'HoverCard'],
        ['HoverCardContent', 'hover-card', 'HoverCardContent'],
        ['HoverCardTrigger', 'hover-card', 'HoverCardTrigger'],
        
        // Data Display
        ['Table', 'table', 'Table'],
        ['TableBody', 'table', 'TableBody'],
        ['TableCaption', 'table', 'TableCaption'],
        ['TableCell', 'table', 'TableCell'],
        ['TableFooter', 'table', 'TableFooter'],
        ['TableHead', 'table', 'TableHead'],
        ['TableHeader', 'table', 'TableHeader'],
        ['TableRow', 'table', 'TableRow'],
        
        ['Badge', 'badge'],
        ['Avatar', 'avatar', 'Avatar'],
        ['AvatarFallback', 'avatar', 'AvatarFallback'],
        ['AvatarImage', 'avatar', 'AvatarImage'],
        
        ['Progress', 'progress'],
        ['Skeleton', 'skeleton'],
        
        // Layout Utilities
        ['ScrollArea', 'scroll-area', 'ScrollArea'],
        ['ScrollBar', 'scroll-area', 'ScrollBar'],
        ['Separator', 'separator'],
        ['AspectRatio', 'aspect-ratio'],
        ['Resizable', 'resizable', 'ResizablePanelGroup'],
        ['ResizableHandle', 'resizable', 'ResizableHandle'],
        ['ResizablePanel', 'resizable', 'ResizablePanel'],
        
        // Menu & Dropdown
        ['DropdownMenu', 'dropdown-menu', 'DropdownMenu'],
        ['DropdownMenuCheckboxItem', 'dropdown-menu', 'DropdownMenuCheckboxItem'],
        ['DropdownMenuContent', 'dropdown-menu', 'DropdownMenuContent'],
        ['DropdownMenuGroup', 'dropdown-menu', 'DropdownMenuGroup'],
        ['DropdownMenuItem', 'dropdown-menu', 'DropdownMenuItem'],
        ['DropdownMenuLabel', 'dropdown-menu', 'DropdownMenuLabel'],
        ['DropdownMenuPortal', 'dropdown-menu', 'DropdownMenuPortal'],
        ['DropdownMenuRadioGroup', 'dropdown-menu', 'DropdownMenuRadioGroup'],
        ['DropdownMenuRadioItem', 'dropdown-menu', 'DropdownMenuRadioItem'],
        ['DropdownMenuSeparator', 'dropdown-menu', 'DropdownMenuSeparator'],
        ['DropdownMenuShortcut', 'dropdown-menu', 'DropdownMenuShortcut'],
        ['DropdownMenuSub', 'dropdown-menu', 'DropdownMenuSub'],
        ['DropdownMenuSubContent', 'dropdown-menu', 'DropdownMenuSubContent'],
        ['DropdownMenuSubTrigger', 'dropdown-menu', 'DropdownMenuSubTrigger'],
        ['DropdownMenuTrigger', 'dropdown-menu', 'DropdownMenuTrigger'],
        
        ['ContextMenu', 'context-menu', 'ContextMenu'],
        ['ContextMenuCheckboxItem', 'context-menu', 'ContextMenuCheckboxItem'],
        ['ContextMenuContent', 'context-menu', 'ContextMenuContent'],
        ['ContextMenuGroup', 'context-menu', 'ContextMenuGroup'],
        ['ContextMenuItem', 'context-menu', 'ContextMenuItem'],
        ['ContextMenuLabel', 'context-menu', 'ContextMenuLabel'],
        ['ContextMenuRadioGroup', 'context-menu', 'ContextMenuRadioGroup'],
        ['ContextMenuRadioItem', 'context-menu', 'ContextMenuRadioItem'],
        ['ContextMenuSeparator', 'context-menu', 'ContextMenuSeparator'],
        ['ContextMenuShortcut', 'context-menu', 'ContextMenuShortcut'],
        ['ContextMenuSub', 'context-menu', 'ContextMenuSub'],
        ['ContextMenuSubContent', 'context-menu', 'ContextMenuSubContent'],
        ['ContextMenuSubTrigger', 'context-menu', 'ContextMenuSubTrigger'],
        ['ContextMenuTrigger', 'context-menu', 'ContextMenuTrigger'],
        
        ['Menubar', 'menubar', 'Menubar'],
        ['MenubarCheckboxItem', 'menubar', 'MenubarCheckboxItem'],
        ['MenubarContent', 'menubar', 'MenubarContent'],
        ['MenubarItem', 'menubar', 'MenubarItem'],
        ['MenubarLabel', 'menubar', 'MenubarLabel'],
        ['MenubarMenu', 'menubar', 'MenubarMenu'],
        ['MenubarRadioGroup', 'menubar', 'MenubarRadioGroup'],
        ['MenubarRadioItem', 'menubar', 'MenubarRadioItem'],
        ['MenubarSeparator', 'menubar', 'MenubarSeparator'],
        ['MenubarShortcut', 'menubar', 'MenubarShortcut'],
        ['MenubarSub', 'menubar', 'MenubarSub'],
        ['MenubarSubContent', 'menubar', 'MenubarSubContent'],
        ['MenubarSubTrigger', 'menubar', 'MenubarSubTrigger'],
        ['MenubarTrigger', 'menubar', 'MenubarTrigger'],
        
        // Advanced Components
        ['Calendar', 'calendar'],
        ['DatePicker', 'date-picker'],
        ['Collapsible', 'collapsible', 'Collapsible'],
        ['CollapsibleContent', 'collapsible', 'CollapsibleContent'],
        ['CollapsibleTrigger', 'collapsible', 'CollapsibleTrigger'],
        
        ['Accordion', 'accordion', 'Accordion'],
        ['AccordionContent', 'accordion', 'AccordionContent'],
        ['AccordionItem', 'accordion', 'AccordionItem'],
        ['AccordionTrigger', 'accordion', 'AccordionTrigger'],
        
        ['Carousel', 'carousel', 'Carousel'],
        ['CarouselContent', 'carousel', 'CarouselContent'],
        ['CarouselItem', 'carousel', 'CarouselItem'],
        ['CarouselNext', 'carousel', 'CarouselNext'],
        ['CarouselPrevious', 'carousel', 'CarouselPrevious']
      ];
  
      // Create lazy getters for all components
      components.forEach(([propName, fileName, exportName]) => {
        Object.defineProperty(this, propName, this._createGetter(propName, fileName, exportName));
      });
    }
  
    // Dynamic component getter for components not predefined
    get(componentName, fileName = null, exportName = null) {
      const file = fileName || componentName.toLowerCase().replace(/([A-Z])/g, '-$1').slice(1);
      const cacheKey = exportName ? `${file}:${exportName}` : file;
      
      if (!this._cache.has(cacheKey)) {
        try {
          const module = require(`@/components/ui/shadcn/components/${file}`);
          const component = exportName ? module[exportName] : module.default || module[componentName];
          
          if (component) {
            this._cache.set(cacheKey, component);
          } else {
            console.warn(`Shadcn component "${exportName || componentName}" not found in ${file}`);
            return null;
          }
        } catch (error) {
          console.error(`Error loading Shadcn component from ${file}:`, error);
          return null;
        }
      }
      
      return this._cache.get(cacheKey);
    }
  
    // Development helpers
    getLoadedComponents() {
      return Array.from(this._cache.keys());
    }
  
    clearCache() {
      this._cache.clear();
    }
  
    exists(fileName) {
      try {
        require.resolve(`@/components/ui/shadcn/components/${fileName}`);
        return true;
      } catch {
        return false;
      }
    }
  }
  
  // Export singleton instance
  export const shadcn = new ShadcnComponents();