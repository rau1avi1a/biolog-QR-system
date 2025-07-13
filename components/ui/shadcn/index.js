// components/ui/shadcn/index.js
"use client";

import dynamic from "next/dynamic";

const components = [
  { name: "Card", file: "card", exportName: "Card" },
  { name: "CardContent", file: "card", exportName: "CardContent" },
  { name: "CardDescription", file: "card", exportName: "CardDescription" },
  { name: "CardFooter", file: "card", exportName: "CardFooter" },
  { name: "CardHeader", file: "card", exportName: "CardHeader" },
  { name: "CardTitle", file: "card", exportName: "CardTitle" },

  { name: "Sheet", file: "sheet", exportName: "Sheet" },
  { name: "SheetContent", file: "sheet", exportName: "SheetContent" },
  { name: "SheetDescription", file: "sheet", exportName: "SheetDescription" },
  { name: "SheetFooter", file: "sheet", exportName: "SheetFooter" },
  { name: "SheetHeader", file: "sheet", exportName: "SheetHeader" },
  { name: "SheetTitle", file: "sheet", exportName: "SheetTitle" },
  { name: "SheetTrigger", file: "sheet", exportName: "SheetTrigger" },
  { name: "SheetClose", file: "sheet", exportName: "SheetClose" },

  { name: "Dialog", file: "dialog", exportName: "Dialog" },
  { name: "DialogContent", file: "dialog", exportName: "DialogContent" },
  { name: "DialogDescription", file: "dialog", exportName: "DialogDescription" },
  { name: "DialogFooter", file: "dialog", exportName: "DialogFooter" },
  { name: "DialogHeader", file: "dialog", exportName: "DialogHeader" },
  { name: "DialogTitle", file: "dialog", exportName: "DialogTitle" },
  { name: "DialogTrigger", file: "dialog", exportName: "DialogTrigger" },
  { name: "DialogClose", file: "dialog", exportName: "DialogClose" },

  { name: "Drawer", file: "drawer", exportName: "Drawer" },
  { name: "DrawerClose", file: "drawer", exportName: "DrawerClose" },
  { name: "DrawerContent", file: "drawer", exportName: "DrawerContent" },
  { name: "DrawerDescription", file: "drawer", exportName: "DrawerDescription" },
  { name: "DrawerFooter", file: "drawer", exportName: "DrawerFooter" },
  { name: "DrawerHeader", file: "drawer", exportName: "DrawerHeader" },
  { name: "DrawerTitle", file: "drawer", exportName: "DrawerTitle" },
  { name: "DrawerTrigger", file: "drawer", exportName: "DrawerTrigger" },

  { name: "Tabs", file: "tabs", exportName: "Tabs" },
  { name: "TabsContent", file: "tabs", exportName: "TabsContent" },
  { name: "TabsList", file: "tabs", exportName: "TabsList" },
  { name: "TabsTrigger", file: "tabs", exportName: "TabsTrigger" },

  { name: "NavigationMenu", file: "navigation-menu", exportName: "NavigationMenu" },
  { name: "NavigationMenuContent", file: "navigation-menu", exportName: "NavigationMenuContent" },
  { name: "NavigationMenuItem", file: "navigation-menu", exportName: "NavigationMenuItem" },
  { name: "NavigationMenuLink", file: "navigation-menu", exportName: "NavigationMenuLink" },
  { name: "NavigationMenuList", file: "navigation-menu", exportName: "NavigationMenuList" },
  { name: "NavigationMenuTrigger", file: "navigation-menu", exportName: "NavigationMenuTrigger" },

  { name: "Breadcrumb", file: "breadcrumb", exportName: "Breadcrumb" },
  { name: "BreadcrumbEllipsis", file: "breadcrumb", exportName: "BreadcrumbEllipsis" },
  { name: "BreadcrumbItem", file: "breadcrumb", exportName: "BreadcrumbItem" },
  { name: "BreadcrumbLink", file: "breadcrumb", exportName: "BreadcrumbLink" },
  { name: "BreadcrumbList", file: "breadcrumb", exportName: "BreadcrumbList" },
  { name: "BreadcrumbPage", file: "breadcrumb", exportName: "BreadcrumbPage" },
  { name: "BreadcrumbSeparator", file: "breadcrumb", exportName: "BreadcrumbSeparator" },

  { name: "Button", file: "button", exportName: null },
  { name: "Input", file: "input", exportName: null },
  { name: "Textarea", file: "textarea", exportName: null },
  { name: "Label", file: "label", exportName: null },
  { name: "Checkbox", file: "checkbox", exportName: null },
  { name: "RadioGroup", file: "radio-group", exportName: "RadioGroup" },
  { name: "RadioGroupItem", file: "radio-group", exportName: "RadioGroupItem" },
  { name: "Switch", file: "switch", exportName: null },
  { name: "Slider", file: "slider", exportName: null },

  { name: "Select", file: "select", exportName: "Select" },
  { name: "SelectContent", file: "select", exportName: "SelectContent" },
  { name: "SelectGroup", file: "select", exportName: "SelectGroup" },
  { name: "SelectItem", file: "select", exportName: "SelectItem" },
  { name: "SelectLabel", file: "select", exportName: "SelectLabel" },
  { name: "SelectSeparator", file: "select", exportName: "SelectSeparator" },
  { name: "SelectTrigger", file: "select", exportName: "SelectTrigger" },
  { name: "SelectValue", file: "select", exportName: "SelectValue" },

  { name: "Combobox", file: "combobox", exportName: null },
  { name: "Command", file: "command", exportName: "Command" },
  { name: "CommandDialog", file: "command", exportName: "CommandDialog" },
  { name: "CommandEmpty", file: "command", exportName: "CommandEmpty" },
  { name: "CommandGroup", file: "command", exportName: "CommandGroup" },
  { name: "CommandInput", file: "command", exportName: "CommandInput" },
  { name: "CommandItem", file: "command", exportName: "CommandItem" },
  { name: "CommandList", file: "command", exportName: "CommandList" },
  { name: "CommandSeparator", file: "command", exportName: "CommandSeparator" },
  { name: "CommandShortcut", file: "command", exportName: "CommandShortcut" },

  { name: "Form", file: "form", exportName: "Form" },
  { name: "FormControl", file: "form", exportName: "FormControl" },
  { name: "FormDescription", file: "form", exportName: "FormDescription" },
  { name: "FormField", file: "form", exportName: "FormField" },
  { name: "FormItem", file: "form", exportName: "FormItem" },
  { name: "FormLabel", file: "form", exportName: "FormLabel" },
  { name: "FormMessage", file: "form", exportName: "FormMessage" },

  { name: "Alert", file: "alert", exportName: "Alert" },
  { name: "AlertDescription", file: "alert", exportName: "AlertDescription" },
  { name: "AlertTitle", file: "alert", exportName: "AlertTitle" },

  { name: "AlertDialog", file: "alert-dialog", exportName: "AlertDialog" },
  { name: "AlertDialogAction", file: "alert-dialog", exportName: "AlertDialogAction" },
  { name: "AlertDialogCancel", file: "alert-dialog", exportName: "AlertDialogCancel" },
  { name: "AlertDialogContent", file: "alert-dialog", exportName: "AlertDialogContent" },
  { name: "AlertDialogDescription", file: "alert-dialog", exportName: "AlertDialogDescription" },
  { name: "AlertDialogFooter", file: "alert-dialog", exportName: "AlertDialogFooter" },
  { name: "AlertDialogHeader", file: "alert-dialog", exportName: "AlertDialogHeader" },
  { name: "AlertDialogTitle", file: "alert-dialog", exportName: "AlertDialogTitle" },
  { name: "AlertDialogTrigger", file: "alert-dialog", exportName: "AlertDialogTrigger" },

  { name: "Toast", file: "toast", exportName: "Toast" },
  { name: "ToastAction", file: "toast", exportName: "ToastAction" },
  { name: "ToastClose", file: "toast", exportName: "ToastClose" },
  { name: "ToastDescription", file: "toast", exportName: "ToastDescription" },
  { name: "ToastProvider", file: "toast", exportName: "ToastProvider" },
  { name: "ToastTitle", file: "toast", exportName: "ToastTitle" },
  { name: "ToastViewport", file: "toast", exportName: "ToastViewport" },

  { name: "Tooltip", file: "tooltip", exportName: "Tooltip" },
  { name: "TooltipContent", file: "tooltip", exportName: "TooltipContent" },
  { name: "TooltipProvider", file: "tooltip", exportName: "TooltipProvider" },
  { name: "TooltipTrigger", file: "tooltip", exportName: "TooltipTrigger" },

  { name: "Popover", file: "popover", exportName: "Popover" },
  { name: "PopoverContent", file: "popover", exportName: "PopoverContent" },
  { name: "PopoverTrigger", file: "popover", exportName: "PopoverTrigger" },

  { name: "HoverCard", file: "hover-card", exportName: "HoverCard" },
  { name: "HoverCardContent", file: "hover-card", exportName: "HoverCardContent" },
  { name: "HoverCardTrigger", file: "hover-card", exportName: "HoverCardTrigger" },

  { name: "Table", file: "table", exportName: "Table" },
  { name: "TableBody", file: "table", exportName: "TableBody" },
  { name: "TableCaption", file: "table", exportName: "TableCaption" },
  { name: "TableCell", file: "table", exportName: "TableCell" },
  { name: "TableFooter", file: "table", exportName: "TableFooter" },
  { name: "TableHead", file: "table", exportName: "TableHead" },
  { name: "TableHeader", file: "table", exportName: "TableHeader" },
  { name: "TableRow", file: "table", exportName: "TableRow" },

  { name: "Badge", file: "badge", exportName: null },
  { name: "Avatar", file: "avatar", exportName: "Avatar" },
  { name: "AvatarFallback", file: "avatar", exportName: "AvatarFallback" },
  { name: "AvatarImage", file: "avatar", exportName: "AvatarImage" },

  { name: "Progress", file: "progress", exportName: null },
  { name: "Skeleton", file: "skeleton", exportName: null },

  { name: "ScrollArea", file: "scroll-area", exportName: "ScrollArea" },
  { name: "ScrollBar", file: "scroll-area", exportName: "ScrollBar" },
  { name: "Separator", file: "separator", exportName: null },
  { name: "AspectRatio", file: "aspect-ratio", exportName: null },
  { name: "Resizable", file: "resizable", exportName: "ResizablePanelGroup" },
  { name: "ResizableHandle", file: "resizable", exportName: "ResizableHandle" },
  { name: "ResizablePanel", file: "resizable", exportName: "ResizablePanel" },

  { name: "DropdownMenu", file: "dropdown-menu", exportName: "DropdownMenu" },
  { name: "DropdownMenuCheckboxItem", file: "dropdown-menu", exportName: "DropdownMenuCheckboxItem" },
  { name: "DropdownMenuContent", file: "dropdown-menu", exportName: "DropdownMenuContent" },
  { name: "DropdownMenuGroup", file: "dropdown-menu", exportName: "DropdownMenuGroup" },
  { name: "DropdownMenuItem", file: "dropdown-menu", exportName: "DropdownMenuItem" },
  { name: "DropdownMenuLabel", file: "dropdown-menu", exportName: "DropdownMenuLabel" },
  { name: "DropdownMenuPortal", file: "dropdown-menu", exportName: "DropdownMenuPortal" },
  { name: "DropdownMenuRadioGroup", file: "dropdown-menu", exportName: "DropdownMenuRadioGroup" },
  { name: "DropdownMenuRadioItem", file: "dropdown-menu", exportName: "DropdownMenuRadioItem" },
  { name: "DropdownMenuSeparator", file: "dropdown-menu", exportName: "DropdownMenuSeparator" },
  { name: "DropdownMenuShortcut", file: "dropdown-menu", exportName: "DropdownMenuShortcut" },
  { name: "DropdownMenuSub", file: "dropdown-menu", exportName: "DropdownMenuSub" },
  { name: "DropdownMenuSubContent", file: "dropdown-menu", exportName: "DropdownMenuSubContent" },
  { name: "DropdownMenuSubTrigger", file: "dropdown-menu", exportName: "DropdownMenuSubTrigger" },
  { name: "DropdownMenuTrigger", file: "dropdown-menu", exportName: "DropdownMenuTrigger" },

  { name: "ContextMenu", file: "context-menu", exportName: "ContextMenu" },
  { name: "ContextMenuCheckboxItem", file: "context-menu", exportName: "ContextMenuCheckboxItem" },
  { name: "ContextMenuContent", file: "context-menu", exportName: "ContextMenuContent" },
  { name: "ContextMenuGroup", file: "context-menu", exportName: "ContextMenuGroup" },
  { name: "ContextMenuItem", file: "context-menu", exportName: "ContextMenuItem" },
  { name: "ContextMenuLabel", file: "context-menu", exportName: "ContextMenuLabel" },
  { name: "ContextMenuRadioGroup", file: "context-menu", exportName: "ContextMenuRadioGroup" },
  { name: "ContextMenuRadioItem", file: "context-menu", exportName: "ContextMenuRadioItem" },
  { name: "ContextMenuSeparator", file: "context-menu", exportName: "ContextMenuSeparator" },
  { name: "ContextMenuShortcut", file: "context-menu", exportName: "ContextMenuShortcut" },
  { name: "ContextMenuSub", file: "context-menu", exportName: "ContextMenuSub" },
  { name: "ContextMenuSubContent", file: "context-menu", exportName: "ContextMenuSubContent" },
  { name: "ContextMenuSubTrigger", file: "context-menu", exportName: "ContextMenuSubTrigger" },
  { name: "ContextMenuTrigger", file: "context-menu", exportName: "ContextMenuTrigger" },

  { name: "Menubar", file: "menubar", exportName: "Menubar" },
  { name: "MenubarCheckboxItem", file: "menubar", exportName: "MenubarCheckboxItem" },
  { name: "MenubarContent", file: "menubar", exportName: "MenubarContent" },
  { name: "MenubarItem", file: "menubar", exportName: "MenubarItem" },
  { name: "MenubarLabel", file: "menubar", exportName: "MenubarLabel" },
  { name: "MenubarMenu", file: "menubar", exportName: "MenubarMenu" },
  { name: "MenubarRadioGroup", file: "menubar", exportName: "MenabarRadioGroup" },
  { name: "MenubarRadioItem", file: "menubar", exportName: "MenubarRadioItem" },
  { name: "MenubarSeparator", file: "menubar", exportName: "MenubarSeparator" },
  { name: "MenubarShortcut", file: "menubar", exportName: "MenubarShortcut" },
  { name: "MenubarSub", file: "menubar", exportName: "MenubarSub" },
  { name: "MenubarSubContent", file: "menubar", exportName: "MenubarSubContent" },
  { name: "MenubarSubTrigger", file: "menubar", exportName: "MenubarSubTrigger" },
  { name: "MenubarTrigger", file: "menabar", exportName: "MenubarTrigger" },

  { name: "Calendar", file: "calendar", exportName: null },
  { name: "DatePicker", file: "date-picker", exportName: null },

  { name: "Collapsible", file: "collapsible", exportName: "Collapsible" },
  { name: "CollapsibleContent", file: "collapsible", exportName: "CollapsibleContent" },
  { name: "CollapsibleTrigger", file: "collapsible", exportName: "CollapsibleTrigger" },

  { name: "Accordion", file: "accordion", exportName: "Accordion" },
  { name: "AccordionContent", file: "accordion", exportName: "AccordionContent" },
  { name: "AccordionItem", file: "accordion", exportName: "AccordionItem" },
  { name: "AccordionTrigger", file: "accordion", exportName: "AccordionTrigger" },

  { name: "Carousel", file: "carousel", exportName: "Carousel" },
  { name: "CarouselContent", file: "carousel", exportName: "CarouselContent" },
  { name: "CarouselItem", file: "carousel", exportName: "CarouselItem" },
  { name: "CarouselNext", file: "carousel", exportName: "CarouselNext" },
  { name: "CarouselPrevious", file: "carousel", exportName: "CarouselPrevious" },
];

function loadShadcnComponent(file, exportName, name) {
  return dynamic(
    () =>
      import(
        /* webpackChunkName: "shadcn-[request]" */
        `@/components/ui/shadcn/components/${file}`
      ).then((mod) => (exportName ? mod[exportName] : mod.default || mod[name]))
  );
}

export const shadcn = components.reduce((acc, { name, file, exportName }) => {
  acc[name] = loadShadcnComponent(file, exportName, name);
  return acc;
}, {});
