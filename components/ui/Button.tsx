/**
 * Button Component
 * 
 * A flexible button component built with accessibility in mind.
 * Supports multiple variants, sizes, and states.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { colors, spacing, fontSize, borderRadius, transition } from "@/lib/design-tokens";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)] focus-visible:ring-[var(--accent-primary)]",
        secondary: "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]",
        ghost: "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
        danger: "bg-[var(--status-error)] text-white hover:opacity-90 focus-visible:ring-[var(--status-error)]",
        success: "bg-[var(--status-success)] text-white hover:opacity-90 focus-visible:ring-[var(--status-success)]",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-md",
        md: "h-10 px-4 text-base rounded-lg",
        lg: "h-12 px-6 text-lg rounded-lg",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * If true, the button will render as a child element
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
