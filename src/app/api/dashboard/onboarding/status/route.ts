import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { listOnboardingStepsWithProgress } from "@/server/dashboard";

type GuideActionId = "profile" | "channel" | "funnel";
type GuideActionStatus = "pending" | "in_progress" | "completed";

interface GuideAction {
  id: GuideActionId;
  title: string;
  description: string;
  href: string;
  status: GuideActionStatus;
}

function resolveStatus(completed: boolean, hasPreviousCompleted: boolean): GuideActionStatus {
  if (completed) return "completed";
  return hasPreviousCompleted ? "in_progress" : "pending";
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;
  const steps = await listOnboardingStepsWithProgress(tenantId);
  const completedBySlug = new Set(
    steps.filter((step) => step.completedAt).map((step) => step.slug)
  );

  const profileReady = Boolean(session.user.name?.trim());
  const profileDone =
    profileReady || completedBySlug.has("configurar-perfil");
  const channelDone = completedBySlug.has("conectar-google-ads");
  const funnelDone = completedBySlug.has("configurar-funil");

  const actions: GuideAction[] = [
    {
      id: "profile",
      title: "Configurar perfil",
      description: "Defina seu nome e avatar para personalizar sua conta.",
      href: "/dashboard/settings",
      status: resolveStatus(profileDone, false),
    },
    {
      id: "channel",
      title: "Conectar canal",
      description: "Ative Google Ads para iniciar leitura de campanhas e sinais.",
      href: "/dashboard/google-ads",
      status: resolveStatus(channelDone, profileDone),
    },
    {
      id: "funnel",
      title: "Revisar funil",
      description: "Ajuste etapas para melhorar previsão e conversão comercial.",
      href: "/dashboard/funnel/config",
      status: resolveStatus(funnelDone, profileDone || channelDone),
    },
  ];

  return NextResponse.json({
    ok: true,
    actions,
  });
}

