import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardTenantContext } from "@/server/dashboard";
import { loadPendingConnection } from "@/server/google-ads-pending";
import { env } from "@/config/env";

export default async function GoogleAdsConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  if (!env.googleAdsConnectEnabled) {
    redirect(
      "/dashboard/google-ads?google_ads_error=feature_disabled&google_ads_message=Autenticação por conta em breve. Esta função será liberada em breve."
    );
  }

  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const pendingToken = typeof params.pending === "string" ? params.pending : null;

  if (!pendingToken) {
    redirect("/dashboard/google-ads?google_ads_error=missing_pending");
  }

  const pending = await loadPendingConnection(pendingToken, tenantId);
  if (!pending) {
    redirect(
      "/dashboard/google-ads?google_ads_error=invalid_pending&google_ads_message=Link expirado ou inválido. Conecte novamente."
    );
  }

  const { customerIds } = pending;

  return (
    <div className="px-1 py-0 sm:px-2">
      <h1 className="text-xl font-semibold text-brand-text">
        Escolher conta Google Ads
      </h1>
      <p className="mt-2 text-brand-muted">
        Selecione a conta que deseja conectar a este tenant. O link expira em
        10 minutos.
      </p>

      <form
        action="/api/google-ads/auth/complete"
        method="POST"
        className="panel-lux mt-6 max-w-md rounded-lg border border-brand-border bg-brand-surface p-4"
      >
        <input
          type="hidden"
          name="pending"
          value={pendingToken}
        />
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-brand-muted">
            Conta (Customer ID)
          </legend>
          {customerIds.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 rounded border border-brand-border p-3 transition-colors hover:bg-brand-surface/70"
            >
              <input
                type="radio"
                name="externalId"
                value={id}
                required
                className="h-4 w-4"
              />
              <span className="font-mono text-brand-text">{id}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-4">
          <label htmlFor="label" className="block text-sm font-medium text-brand-muted">
            Rótulo (opcional)
          </label>
          <input
            id="label"
            type="text"
            name="label"
            maxLength={255}
            placeholder="Ex: Conta principal"
            className="mt-1 w-full rounded border border-brand-border bg-brand-dark/50 px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-neon"
          />
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            className="btn-cta-primary rounded-lg px-4 py-2 text-sm"
          >
            Conectar esta conta
          </button>
          <Link
            href="/dashboard/google-ads"
            className="rounded border border-brand-border px-4 py-2 text-sm text-brand-text transition-colors hover:bg-brand-surface"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
