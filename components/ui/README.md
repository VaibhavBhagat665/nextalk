# NexTalk UI Component Library

A comprehensive set of accessible, composable UI components built on Radix UI primitives and following the NexTalk design system.

## Overview

This component library provides a consistent, accessible, and beautiful user interface for NexTalk. All components are:

- **Accessible**: Built with ARIA labels, keyboard navigation, and screen reader support
- **Composable**: Components can be combined and customized easily
- **Type-safe**: Full TypeScript support with proper types
- **Themeable**: Works seamlessly with light and dark themes
- **Performant**: Optimized for production use

## Components

### Button
A flexible button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md">Click me</Button>
<Button variant="secondary" size="sm">Secondary</Button>
<Button variant="ghost" size="icon">
  <Icon />
</Button>
```

**Variants**: `primary`, `secondary`, `ghost`, `danger`, `success`  
**Sizes**: `sm`, `md`, `lg`, `icon`

### Dialog
A modal dialog component with overlay and proper focus management.

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@/components/ui';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description text</DialogDescription>
    </DialogHeader>
    <DialogBody>
      Content goes here
    </DialogBody>
    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Input
A styled text input with consistent design.

```tsx
import { Input, Label } from '@/components/ui';

<div>
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email"
    type="email" 
    placeholder="you@example.com" 
  />
</div>
```

### Tooltip
A tooltip component for providing contextual help.

```tsx
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>
      <p>Helpful information</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### DropdownMenu
An accessible dropdown menu for actions and options.

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Copy</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Card
A card container for grouping related content.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

### Tabs
A tabbed interface component.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Switch
A toggle switch for boolean options.

```tsx
import { Switch, Label } from '@/components/ui';

<div className="flex items-center gap-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Airplane Mode</Label>
</div>
```

### Separator
A visual divider.

```tsx
import { Separator } from '@/components/ui';

<Separator />
<Separator orientation="vertical" />
```

### Popover
A floating content container.

```tsx
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@/components/ui';

<Popover>
  <PopoverTrigger>Open</PopoverTrigger>
  <PopoverContent>
    Popover content
  </PopoverContent>
</Popover>
```

## Design Tokens

All components use design tokens from `lib/design-tokens.ts` for consistent styling:

- **Colors**: Neutral palette, gold accents, semantic colors
- **Spacing**: 4px grid system (xs, sm, md, lg, xl, 2xl, 3xl)
- **Typography**: Font families, sizes, weights, line heights
- **Borders**: Border radius scale
- **Shadows**: Elevation hierarchy
- **Transitions**: Duration and easing functions
- **Breakpoints**: Responsive design breakpoints

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ ARIA labels and roles
- ✅ Focus management
- ✅ Screen reader support
- ✅ Color contrast compliance
- ✅ Reduced motion support

## Theme Support

Components automatically adapt to light and dark themes using CSS custom properties:

```tsx
// Theme is controlled by the ThemeProvider
import { ThemeProvider } from '@/components/ThemeProvider';

<ThemeProvider>
  <App />
</ThemeProvider>
```

## Best Practices

1. **Always use semantic HTML**: Components render proper HTML elements
2. **Provide labels**: Use Label components or aria-label for inputs
3. **Handle disabled states**: Disable buttons during loading
4. **Use proper variants**: Choose the right variant for the context
5. **Compose thoughtfully**: Combine components to build complex UI

## Contributing

When adding new components:

1. Build on Radix UI primitives when possible
2. Follow existing naming conventions
3. Add proper TypeScript types
4. Include ARIA labels and keyboard navigation
5. Support both light and dark themes
6. Document usage with examples

## Resources

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Design Tokens Reference](../../lib/design-tokens.ts)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
