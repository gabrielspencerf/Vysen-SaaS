"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Check, Circle } from "lucide-react";

type Step = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  completedAt: Date | null;
};

export function OnboardingProgress({ steps }: { steps: Step[] }) {
  const [completing, setCompleting] = useState<string | null>(null);
  const [localSteps, setLocalSteps] = useState(steps);

  const handleComplete = async (stepId: string) => {
    const step = localSteps.find((s) => s.id === stepId);
    if (!step || step.completedAt) return;
    setCompleting(stepId);
    try {
      const res = await fetch("/api/dashboard/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      if (res.ok) {
        setLocalSteps((prev) =>
          prev.map((s) =>
            s.id === stepId ? { ...s, completedAt: new Date() } : s
          )
        );
      }
    } finally {
      setCompleting(null);
    }
  };

  return (
    <ul className="space-y-3">
      {localSteps.map((step) => (
        <li
          key={step.id}
          className="flex items-start gap-4 rounded-lg border border-brand-border bg-brand-surface p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-text/10">
            {step.completedAt ? (
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <Circle className="h-5 w-5 text-brand-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-brand-text">{step.name}</h3>
            {step.description && (
              <p className="mt-1 text-sm text-brand-muted">{step.description}</p>
            )}
          </div>
          {!step.completedAt && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleComplete(step.id)}
              disabled={completing === step.id}
            >
              {completing === step.id ? "Salvando…" : "Marcar como concluído"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
