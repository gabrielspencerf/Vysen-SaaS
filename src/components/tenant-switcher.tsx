"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  roleSlug: string;
}

interface TenantSwitcherProps {
  currentTenantId: string;
  currentTenantName: string;
  currentUserName: string;
}

export function TenantSwitcher({
  currentTenantId,
  currentTenantName,
  currentUserName,
}: TenantSwitcherProps) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/context/tenants")
      .then((res) => res.ok ? res.json() : { tenants: [] })
      .then((data: { tenants: TenantOption[] }) => setTenants(data.tenants ?? []))
      .catch(() => setTenants([]));
  }, []);

  async function switchTo(tenantId: string) {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/context/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  const others = tenants.filter((t) => t.id !== currentTenantId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded border border-brand-border bg-brand-surface px-2 py-1.5 text-left text-sm text-brand-text hover:bg-brand-surface"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{currentTenantName}</span>
          <span className="block truncate text-xs text-brand-muted">{currentUserName}</span>
        </span>
        {others.length > 0 && (
          <span className="shrink-0 text-brand-muted">▾</span>
        )}
      </button>
      {open && others.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute left-0 top-full z-20 mt-1 min-w-[12rem] rounded border border-brand-border bg-brand-surface py-1 shadow-lg"
            role="listbox"
          >
            {others.map((t) => (
              <li key={t.id} role="option">
                <button
                  type="button"
                  onClick={() => switchTo(t.id)}
                  disabled={switching}
                  className="w-full px-3 py-2 text-left text-sm text-brand-text hover:bg-brand-surface disabled:opacity-50"
                >
                  {t.name}
                  <span className="ml-1 text-brand-muted">({t.slug})</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
