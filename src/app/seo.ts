export const SEO_APP_NAME = "Vysen";

export const SEO_DEFAULT_DESCRIPTION =
  "Plataforma de gestão de leads, conversas e funis com IA para equipes comerciais.";

export const INDEXABLE_PUBLIC_ROUTES = ["/"] as const;

export function getAppBaseUrl(): URL {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!rawUrl) {
    return new URL("http://localhost:3000");
  }

  try {
    return new URL(rawUrl);
  } catch {
    return new URL(`https://${rawUrl}`);
  }
}
