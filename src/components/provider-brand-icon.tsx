import Image from "next/image";
import { cn } from "@/lib/utils";

export type ProviderBrand =
  | "whatsapp"
  | "evolution"
  | "uazapi"
  | "googleAds"
  | "typebot"
  | "metaAds"
  | "clarity";

interface ProviderBrandIconProps {
  provider: ProviderBrand;
  variant?: "framed" | "plain";
  monochrome?: boolean;
  frameClassName?: string;
  className?: string;
}

const PROVIDER_META: Record<ProviderBrand, { src: string; alt: string }> = {
  whatsapp: { src: "/brands/whatsapp.svg", alt: "WhatsApp" },
  evolution: { src: "/brands/evolution.png", alt: "Evolution API" },
  uazapi: { src: "/brands/uazapi.png", alt: "UAZAPI" },
  googleAds: { src: "/brands/google-ads.svg", alt: "Google Ads" },
  typebot: { src: "/brands/typebot.png", alt: "Typebot" },
  metaAds: { src: "/brands/meta-ads.svg", alt: "Meta Ads" },
  clarity: { src: "/brands/clarity.svg", alt: "Microsoft Clarity" },
};

export function ProviderBrandIcon({
  provider,
  variant = "framed",
  monochrome = false,
  frameClassName,
  className,
}: ProviderBrandIconProps) {
  const meta = PROVIDER_META[provider];
  return (
    <span
      data-provider-brand={provider}
      className={cn(
        "provider-brand-icon inline-flex h-5 w-5 shrink-0 items-center justify-center",
        variant === "framed" && "rounded-md border border-brand-border/80 bg-brand-surface/80",
        frameClassName
      )}
    >
      <Image
        src={meta.src}
        alt={meta.alt}
        width={16}
        height={16}
        className={cn(
          "provider-brand-icon-img h-4 w-4 object-contain object-center",
          monochrome && "brand-icon-monochrome",
          className
        )}
      />
    </span>
  );
}
