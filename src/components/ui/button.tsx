import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "btn-cta-primary focus-visible:ring-brand-neon focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 transition-all duration-300",
  secondary:
    "border border-brand-border bg-transparent text-brand-text hover:bg-brand-surface focus-visible:ring-brand-muted disabled:opacity-50 transition-all duration-300 rounded-md",
  ghost:
    "text-brand-muted hover:bg-brand-surface hover:text-brand-text focus-visible:ring-brand-muted disabled:opacity-50 transition-colors duration-300 rounded-md",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-50 transition-colors duration-300 rounded-md",
  cta: "btn-cta-primary focus-visible:ring-brand-neon focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 transition-all duration-300",
};

const sizes = {
  sm: "rounded-md px-4 py-2 text-xs font-medium uppercase tracking-wider",
  md: "rounded-md px-5 py-2.5 text-sm font-medium",
  lg: "rounded-md px-8 py-3.5 text-base font-medium",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium focus-visible:outline-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
