/**
 * Linha de listagem em card. Paleta CL: fundos surface/card, bordas e destaque verde.
 */

const gradientByVariant = {
  violet: "bg-brand-surface border border-brand-border",
  teal: "bg-brand-surface border border-brand-border",
  amber: "bg-brand-surface border border-brand-border",
  indigo: "bg-brand-surface border border-brand-border",
  neutral: "bg-brand-surface border border-brand-border",
} as const;

export function ListRowCard({
  children,
  variant = "neutral",
  className = "",
  as: Component = "div",
}: {
  children: React.ReactNode;
  variant?: keyof typeof gradientByVariant;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  const Comp = Component;
  return (
    <Comp
      className={`panel-lux flex flex-wrap items-center justify-between rounded-2xl px-4 py-4 transition-shadow hover:shadow-md sm:px-6 ${gradientByVariant[variant]} ${className}`}
    >
      {children}
    </Comp>
  );
}
