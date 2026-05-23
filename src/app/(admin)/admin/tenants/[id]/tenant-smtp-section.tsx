"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import {
  adminDelete,
  adminGet,
  adminFetch,
} from "@/features/shared/api/admin-api-client";

interface TenantSmtpConfigPublic {
  tenantId: string;
  host: string;
  port: number;
  username: string | null;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  secure: boolean;
  requireTls: boolean;
  enabled: boolean;
  hasPassword: boolean;
}

/**
 * Card de configuração SMTP por tenant. Quando ausente, o tenant usa o
 * SMTP global (env). Permite criar/editar/remover o override.
 */
export function TenantSmtpSection({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [secure, setSecure] = useState(false);
  const [requireTls, setRequireTls] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminGet<{ config: TenantSmtpConfigPublic | null }>(
      `/api/admin/tenants/${tenantId}/smtp`
    ).then((result) => {
      if (cancelled) return;
      if (result.data?.config) {
        const cfg = result.data.config;
        setHasConfig(true);
        setHasPassword(cfg.hasPassword);
        setHost(cfg.host);
        setPort(cfg.port);
        setUsername(cfg.username ?? "");
        setFromEmail(cfg.fromEmail);
        setFromName(cfg.fromName ?? "");
        setReplyTo(cfg.replyTo ?? "");
        setSecure(cfg.secure);
        setRequireTls(cfg.requireTls);
        setEnabled(cfg.enabled);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      host: host.trim(),
      port,
      username: username.trim() || null,
      from_email: fromEmail.trim(),
      from_name: fromName.trim() || null,
      reply_to: replyTo.trim() || null,
      secure,
      require_tls: requireTls,
      enabled,
    };
    if (clearPassword) {
      body.password = "";
    } else if (password.trim()) {
      body.password = password.trim();
    }
    const result = await adminFetch(`/api/admin/tenants/${tenantId}/smtp`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }
    setSuccess("Configuração SMTP salva.");
    setHasConfig(true);
    if (clearPassword) {
      setHasPassword(false);
      setClearPassword(false);
    } else if (password.trim()) {
      setHasPassword(true);
    }
    setPassword("");
    setSubmitting(false);
  }

  async function handleDelete() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const result = await adminDelete(`/api/admin/tenants/${tenantId}/smtp`);
    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }
    setHasConfig(false);
    setHasPassword(false);
    setHost("");
    setPort(587);
    setUsername("");
    setPassword("");
    setFromEmail("");
    setFromName("");
    setReplyTo("");
    setSecure(false);
    setRequireTls(true);
    setEnabled(true);
    setConfirmingDelete(false);
    setSuccess("Override removido. Tenant volta a usar SMTP global.");
    setSubmitting(false);
  }

  return (
    <Card className="border-brand-border bg-brand-surface/40">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">
            SMTP do tenant
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            Override opcional. Quando configurado, e-mails enviados em contexto
            deste tenant (notificações, alertas) usam este SMTP; senão caem no
            SMTP global (variáveis de ambiente).
            {hasConfig ? null : (
              <span className="ml-1 text-amber-300/80">
                Sem override — usando SMTP global.
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-brand-muted">Carregando…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="smtp_host"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Host
                </label>
                <Input
                  id="smtp_host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.exemplo.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="smtp_port"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Porta
                </label>
                <Input
                  id="smtp_port"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="smtp_user"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Usuário
                </label>
                <Input
                  id="smtp_user"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="smtp_password"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Senha{" "}
                  {hasPassword && (
                    <span className="ml-1 text-emerald-400">(configurada)</span>
                  )}
                </label>
                <Input
                  id="smtp_password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value) setClearPassword(false);
                  }}
                  placeholder={
                    hasPassword
                      ? "Deixe em branco para manter"
                      : "Senha SMTP"
                  }
                  disabled={clearPassword}
                  className="mt-1"
                />
                {hasPassword && (
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-brand-muted">
                    <input
                      type="checkbox"
                      checked={clearPassword}
                      onChange={(e) => {
                        setClearPassword(e.target.checked);
                        if (e.target.checked) setPassword("");
                      }}
                    />
                    Remover senha atual
                  </label>
                )}
              </div>
              <div>
                <label
                  htmlFor="smtp_from"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Remetente (e-mail)
                </label>
                <Input
                  id="smtp_from"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="smtp_from_name"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Remetente (nome de exibição)
                </label>
                <Input
                  id="smtp_from_name"
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="smtp_reply_to"
                  className="block text-xs font-medium text-brand-muted"
                >
                  Reply-To (opcional)
                </label>
                <Input
                  id="smtp_reply_to"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-brand-text">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                />
                SSL/TLS direto (porta 465)
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireTls}
                  onChange={(e) => setRequireTls(e.target.checked)}
                />
                STARTTLS obrigatório
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Ativo (se desativado, cai no SMTP global)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando…" : hasConfig ? "Atualizar" : "Salvar"}
              </Button>
              {hasConfig && (
                <>
                  {!confirmingDelete ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={submitting}
                    >
                      Remover override
                    </Button>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1">
                      <span className="text-xs text-red-300">
                        Remover e voltar ao SMTP global?
                      </span>
                      <Button
                        type="button"
                        onClick={handleDelete}
                        disabled={submitting}
                        className="bg-red-500/90 text-white hover:bg-red-500"
                      >
                        Sim, remover
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={submitting}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
