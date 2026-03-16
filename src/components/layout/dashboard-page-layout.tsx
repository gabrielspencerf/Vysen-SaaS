/**
 * Layout de conteúdo do dashboard. Paleta CL: fundo escuro, container central.
 * Container max-w-[1200px] mx-auto; space-y-10.
 */

export function DashboardPageLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`dashboard-canvas min-h-full overflow-x-hidden bg-brand-dark px-4 py-8 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-10">
        {children}
      </div>
    </div>
  );
}
