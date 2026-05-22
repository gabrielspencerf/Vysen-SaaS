"use client";

import { formatDate } from "@/lib/i18n/date";

type ResultWithScore = {
  id: string;
  url: string;
  strategy: string;
  metricDate: Date | string;
  fetchedAt: Date | string;
  score: number | null;
};

export function PageSpeedResults({
  results,
}: {
  results: ResultWithScore[];
}) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Nenhum resultado ainda. Configure a URL e clique em &quot;Atualizar análise&quot;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-left text-brand-muted">
            <th className="pb-2 pr-4">Data</th>
            <th className="pb-2 pr-4">Dispositivo</th>
            <th className="pb-2 pr-4">Performance (0–100)</th>
            <th className="pb-2">Atualizado em</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-b border-brand-border/50">
              <td className="py-2 pr-4 text-brand-text">{formatDate(new Date(r.metricDate))}</td>
              <td className="py-2 pr-4 text-brand-text">
                {r.strategy === "mobile" ? "Mobile" : "Desktop"}
              </td>
              <td className="py-2 pr-4">
                {r.score !== null ? (
                  <span
                    className={
                      r.score >= 90
                        ? "text-green-600 dark:text-green-400"
                        : r.score >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }
                  >
                    {r.score}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 text-brand-muted">
                {new Date(r.fetchedAt).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
