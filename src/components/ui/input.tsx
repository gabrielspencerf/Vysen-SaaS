import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`relative z-[1] block w-full rounded-xl border bg-brand-surface/55 px-4 py-2.5 text-[0.95rem] text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-neon/35 focus:border-brand-neon disabled:opacity-50 transition-all duration-200 backdrop-blur-sm pointer-events-auto ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-brand-border"
        } ${className}`}
        aria-invalid={error ?? undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
