"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageSection } from "@/components/layout";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { CompanyFilesSection } from "./company-files-section";
import { AuditLogSection } from "./audit-log-section";
import { ProfileAvatarSection } from "./profile-avatar-section";
import { SecuritySection } from "./security-section";
import { Settings, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";

interface ProfilePayload {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  jobTitle: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  timezone: string | null;
  avatarUrl: string | null;
}

export default function DashboardSettingsPage() {
  const { setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [timezone, setTimezone] = useState("");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ds-theme");
      const nextTheme = stored === "light" ? "light" : "dark";
      setThemeMode(nextTheme);
    } catch {
      setThemeMode("dark");
    }
  }, []);

  useEffect(() => {
    fetch("/api/context/profile")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data?.error ?? "Não foi possível carregar perfil");
          return;
        }
        setProfile(data as ProfilePayload);
        const p = data as ProfilePayload;
        setName(p.name ?? "");
        setPhone(p.phone ?? "");
        setJobTitle(p.jobTitle ?? "");
        setCompanyName(p.companyName ?? "");
        setCompanyWebsite(p.companyWebsite ?? "");
        setCompanyPhone(p.companyPhone ?? "");
        setCompanyAddress(p.companyAddress ?? "");
        setTimezone(p.timezone ?? "");
      })
      .catch(() => setError("Falha de conexão"))
      .finally(() => setLoading(false));
  }, []);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/context/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone.trim() || null,
          jobTitle: jobTitle.trim() || null,
          companyName: companyName.trim() || null,
          companyWebsite: companyWebsite.trim() || null,
          companyPhone: companyPhone.trim() || null,
          companyAddress: companyAddress.trim() || null,
          timezone: timezone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar");
        return;
      }
      setSuccess("Perfil atualizado com sucesso.");
      window.dispatchEvent(
        new CustomEvent("vysen-profile-updated", {
          detail: { name: name.trim() || null },
        })
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim() || null,
              phone: phone.trim() || null,
              jobTitle: jobTitle.trim() || null,
              companyName: companyName.trim() || null,
              companyWebsite: companyWebsite.trim() || null,
              companyPhone: companyPhone.trim() || null,
              companyAddress: companyAddress.trim() || null,
              timezone: timezone.trim() || null,
            }
          : prev
      );
    } catch {
      setError("Falha de conexão");
    } finally {
      setSaving(false);
    }
  }

  function applyTheme(nextTheme: "dark" | "light") {
    setThemeMode(nextTheme);
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.classList.toggle("light", nextTheme === "light");
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("ds-theme", nextTheme);
    } catch {}
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <Settings className="h-4 w-4 text-brand-text" />
            </div>
            <h1 className="text-2xl font-semibold text-brand-text">Configurações</h1>
          </div>
          <p className="mt-2 text-sm text-brand-muted">
            Atualize os dados do perfil e preferências da conta.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="border-brand-border"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("vysen-open-first-access-guide"))
          }
        >
          Ver guia de boas-vindas
        </Button>
      </div>

      <Card className="mt-6 border-brand-border bg-brand-surface">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-brand-text">Aparência</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Escolha o tema visual da interface.
          </p>
          <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface/60 p-1">
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                themeMode === "dark"
                  ? "nav-active-neon"
                  : "text-brand-muted hover:text-brand-text"
              }`}
              aria-pressed={themeMode === "dark"}
            >
              Escuro
            </button>
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                themeMode === "light"
                  ? "nav-active-neon"
                  : "text-brand-muted hover:text-brand-text"
              }`}
              aria-pressed={themeMode === "light"}
            >
              Claro
            </button>
          </div>
        </CardContent>
      </Card>

      {profile && (
        <ProfileAvatarSection
          displayName={name || profile.name || ""}
          email={profile.email}
          avatarUrl={profile.avatarUrl}
          onAvatarChange={(nextUrl) =>
            setProfile((prev) => (prev ? { ...prev, avatarUrl: nextUrl } : prev))
          }
          onError={(message) => {
            setError(message);
            setSuccess(null);
          }}
          onSuccess={(message) => {
            setSuccess(message);
            setError(null);
          }}
        />
      )}

      <Card className="mt-6 border-brand-border bg-brand-surface">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <Smartphone className="h-4 w-4 text-brand-text" />
            </div>
            <h2 className="text-base font-semibold text-brand-text">WhatsApp</h2>
          </div>
          <p className="mt-1 text-sm text-brand-muted">
            Veja o status da instância (Evolution ou UAZAPI) e gere QR para reconectar o aparelho.
          </p>
          <Link
            href="/dashboard/settings/whatsapp"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface/60 px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface transition-colors"
          >
            Gerenciar conexão WhatsApp
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-6 border-brand-border bg-brand-surface">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-brand-text">Dados pessoais</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Nome, e-mail e telefone do seu perfil de acesso.
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-brand-muted">Carregando perfil...</p>
          ) : (
            <form onSubmit={submitForm} className="mt-4 space-y-4">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {success}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_email">
                  E-mail
                </label>
                <Input
                  id="profile_email"
                  type="email"
                  value={profile?.email ?? ""}
                  readOnly
                  className="mt-1 opacity-80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_name">
                  Nome
                </label>
                <Input
                  id="profile_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="mt-1"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_phone">
                  Telefone
                </label>
                <Input
                  id="profile_phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="mt-1"
                  maxLength={64}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_job_title">
                  Cargo / Função
                </label>
                <Input
                  id="profile_job_title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex.: Gerente de Vendas"
                  className="mt-1"
                  maxLength={255}
                />
              </div>

              <h3 className="pt-4 text-sm font-semibold text-brand-text">Empresa</h3>
              <p className="text-sm text-brand-muted">
                Informações da empresa (opcional).
              </p>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_company_name">
                  Nome da empresa
                </label>
                <Input
                  id="profile_company_name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Razão social ou nome fantasia"
                  className="mt-1"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_company_website">
                  Site
                </label>
                <Input
                  id="profile_company_website"
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                  maxLength={512}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_company_phone">
                  Telefone da empresa
                </label>
                <Input
                  id="profile_company_phone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+55 11 3000-0000"
                  className="mt-1"
                  maxLength={64}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_company_address">
                  Endereço
                </label>
                <Input
                  id="profile_company_address"
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Endereço completo"
                  className="mt-1"
                  maxLength={512}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-muted" htmlFor="profile_timezone">
                  Fuso horário
                </label>
                <Input
                  id="profile_timezone"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Ex.: America/Sao_Paulo"
                  className="mt-1"
                  maxLength={64}
                />
              </div>

              <Button type="submit" disabled={saving} className="mt-4">
                {saving ? "Salvando..." : "Salvar perfil"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-brand-border bg-brand-surface">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-brand-text">Funil de vendas</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Configure as etapas do seu funil de vendas (perfil do cliente). Defina o funil padrão e as etapas na ordem desejada.
          </p>
          <Link
            href="/dashboard/funnel/config"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface/60 px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface transition-colors"
          >
            Configurar funil
          </Link>
        </CardContent>
      </Card>

      <SecuritySection />
      <CompanyFilesSection />
      <AuditLogSection />
    </PageSection>
  );
}
