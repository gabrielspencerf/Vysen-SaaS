/**
 * Seção em card. Design System: brand-surface, brand-border.
 */

export function PageSection({
  children,
  className = "",
  variant = "panel",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "panel" | "plain";
}) {
  const baseClassName =
    variant === "plain"
      ? "rounded-3xl px-6 py-8 sm:px-8 md:px-10 md:pt-10 md:pb-6"
      : "panel-lux rounded-3xl border border-brand-border bg-brand-surface px-6 py-8 shadow-sm sm:px-8 md:px-10 md:pt-10 md:pb-6";

  return (
    <section className={`${baseClassName} ${className}`}>
      {children}
    </section>
  );
}
