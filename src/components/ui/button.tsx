import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "btn-cta-primary focus-visible:ring-brand-neon focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 transition-all duration-200",
  secondary:
    "btn-outline focus-visible:ring-brand-muted focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 transition-all duration-200",
  ghost:
    "text-brand-muted hover:bg-brand-surface hover:text-brand-text focus-visible:ring-brand-muted disabled:opacity-50 transition-colors duration-200 rounded-xl",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-50 transition-colors duration-200 rounded-xl",
  cta: "btn-cta-primary focus-visible:ring-brand-neon focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 transition-all duration-200",
  tab: "btn-tab focus-visible:ring-brand-muted focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
  tabActive: "btn-tab-active focus-visible:ring-brand-neon focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
};

const sizes = {
  sm: "rounded-xl px-4 py-2 text-xs font-medium uppercase tracking-wider",
  md: "rounded-xl px-5 py-2.5 text-sm font-medium",
  lg: "rounded-xl px-8 py-3.5 text-base font-medium",
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
