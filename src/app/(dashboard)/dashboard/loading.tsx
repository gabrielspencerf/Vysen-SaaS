"use client";

export default function DashboardLoading() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="panel-lux flex min-h-[280px] items-center justify-center rounded-2xl border border-brand-border bg-brand-surface">
          <div className="flex items-center gap-3 text-sm text-brand-muted">
            <span className="h-3 w-3 animate-pulse rounded-full bg-brand-neon" />
            Carregando página...
          </div>
        </div>
      </div>
    </div>
  );
}
