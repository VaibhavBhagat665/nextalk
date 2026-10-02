/**
 * UI Component Examples
 * 
 * This file demonstrates how to use the NexTalk UI components.
 * These examples can be used as a reference or copied into your code.
 */

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Label,
  Separator,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "./index";

// Example 1: Button variations
export function ButtonExamples() {
  return (
    <div className="flex gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="success">Success</Button>
    </div>
  );
}

// Example 2: Card with form
export function CardFormExample() {
  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Enter your details to create an account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="John Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="john@example.com" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="newsletter" />
          <Label htmlFor="newsletter">Subscribe to newsletter</Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Create Account</Button>
      </CardFooter>
    </Card>
  );
}

// Example 3: Dialog with confirmation
export function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">Delete Account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete Account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Example 4: Dropdown menu with actions
export function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Copy Link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[var(--status-error)]">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Example 5: Tabs interface
export function TabsExample() {
  return (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="@username" />
        </div>
        <Button>Save Changes</Button>
      </TabsContent>
      <TabsContent value="password" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Current Password</Label>
          <Input id="current" type="password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New Password</Label>
          <Input id="new" type="password" />
        </div>
        <Button>Update Password</Button>
      </TabsContent>
    </Tabs>
  );
}

// Example 6: Tooltip usage
export function TooltipExample() {
  return (
    <TooltipProvider>
      <div className="flex gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is a helpful tooltip</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Another one</Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Tooltips can appear on different sides</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Example 7: Settings form with multiple components
export function SettingsFormExample() {
  return (
    <Card className="w-[500px]">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage your account preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Profile</h4>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input id="display-name" placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Input id="bio" placeholder="Tell us about yourself" />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Notifications</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifs">Email Notifications</Label>
              <p className="text-sm text-[var(--text-secondary)]">
                Receive email about your activity
              </p>
            </div>
            <Switch id="email-notifs" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifs">Push Notifications</Label>
              <p className="text-sm text-[var(--text-secondary)]">
                Receive push notifications on your device
              </p>
            </div>
            <Switch id="push-notifs" />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button>Save Changes</Button>
      </CardFooter>
    </Card>
  );
}

// Example 8: Complete demo component
export function CompleteUIDemo() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">NexTalk UI Components</h2>
        <p className="text-[var(--text-secondary)]">
          A showcase of all available components
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Buttons</h3>
        <ButtonExamples />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Card Form</h3>
        <CardFormExample />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Dialog</h3>
        <DialogExample />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Dropdown Menu</h3>
        <DropdownMenuExample />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tabs</h3>
        <TabsExample />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tooltips</h3>
        <TooltipExample />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Settings Form</h3>
        <SettingsFormExample />
      </div>
    </div>
  );
}
