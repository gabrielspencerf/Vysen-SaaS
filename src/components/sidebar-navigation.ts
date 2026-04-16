import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Box,
  Building2,
  Eye,
  Filter,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCircle,
  Users,
  Waypoints,
} from "lucide-react";
import type { ProviderBrand } from "@/components/provider-brand-icon";

/**
 * Governança da navegação:
 * - Seções com `label` agrupam itens (ex.: Comercial, Canais) sem poluir a lista principal.
 * - A navegação de Admin é separada e nunca deve aparecer no menu do dashboard.
 */
export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  providerBrand?: ProviderBrand;
  exactMatch?: boolean;
}

export interface SidebarNavSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  collapsible?: boolean;
  items: SidebarNavItem[];
}

export const dashboardNavSections: SidebarNavSection[] = [
  {
    id: "dashboard-main",
    label: "",
    items: [{ href: "/dashboard/home", label: "Início", icon: LayoutDashboard }],
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: Users,
    collapsible: true,
    items: [
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      { href: "/dashboard/opportunities", label: "Oportunidades", icon: TrendingUp },
      { href: "/dashboard/conversations", label: "Conversas", icon: MessageSquare },
    ],
  },
  {
    id: "canais",
    label: "Canais",
    icon: Megaphone,
    collapsible: true,
    items: [
      { href: "/dashboard/google-ads", label: "Google Ads", icon: BarChart3, providerBrand: "googleAds" },
      { href: "/dashboard/meta-ads", label: "Meta Ads", icon: Megaphone, providerBrand: "metaAds" },
      { href: "/dashboard/clarity", label: "Clarity", icon: Eye, providerBrand: "clarity" },
      { href: "/dashboard/settings/whatsapp", label: "WhatsApp", icon: Smartphone, providerBrand: "whatsapp" },
    ],
  },
  {
    id: "dashboard-more",
    label: "",
    items: [
      { href: "/dashboard/contacts", label: "Contatos", icon: UserCircle },
      { href: "/dashboard/funnel", label: "Funil", icon: Filter },
      { href: "/dashboard/products", label: "Produtos", icon: Package },
      { href: "/dashboard/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export const adminNavSections: SidebarNavSection[] = [
  {
    id: "admin-overview",
    label: "Painel",
    items: [{ href: "/admin", label: "Início", icon: LayoutDashboard, exactMatch: true }],
  },
  {
    id: "admin-management",
    label: "Gestão",
    items: [
      { href: "/admin/tenants", label: "Tenants", icon: Building2 },
      { href: "/admin/users", label: "Usuários", icon: Users },
    ],
  },
  {
    id: "admin-platform",
    label: "Plataforma",
    items: [
      { href: "/admin/integrations", label: "Integrações", icon: Box },
      { href: "/admin/agent", label: "Vysen", icon: Sparkles },
      { href: "/admin/worker-pipeline", label: "Worker & dados", icon: Waypoints },
      { href: "/admin/observability", label: "Observabilidade", icon: Activity },
    ],
  },
];

export function isNavItemActive(pathname: string, item: SidebarNavItem): boolean {
  if (item.exactMatch) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
