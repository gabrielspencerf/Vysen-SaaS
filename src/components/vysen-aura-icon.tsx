import { cn } from "@/lib/utils";

interface VysenAuraIconProps {
  className?: string;
  animated?: boolean;
}

export function VysenAuraIcon({ className, animated = true }: VysenAuraIconProps) {
  return (
    <span
      className={cn("vysen-aura-orb", animated && "vysen-aura-orb-animated", className)}
      aria-hidden
    />
  );
}
