"use client";

import { useMemo, useState } from "react";
import { formatCustom } from "@/lib/i18n/date";

type DayData = {
  date: string;
  leads: number;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateLabel(date: string): string {
  return formatCustom(parseDateKey(date), { day: "2-digit", month: "2-digit" });
}

function formatLongDateLabel(date: string): string {
  return formatCustom(parseDateKey(date), {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function intensityClass(leads: number): string {
  if (leads >= 10) return "bg-brand-neon/18 border-brand-neon/55";
  if (leads >= 5) return "bg-brand-neon/12 border-brand-neon/42";
  if (leads >= 1) return "bg-brand-neon/8 border-brand-neon/30";
  return "bg-brand-surface/55 border-brand-border/90";
}

function intensityLabel(leads: number): string {
  if (leads >= 10) return "Alto";
  if (leads >= 5) return "Médio";
  if (leads >= 1) return "Baixo";
  return "Sem captação";
}

function deltaClass(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-rose-400";
  return "text-brand-text";
}

export function DailyCalendar({ data }: { data: DayData[] }) {
  const leadsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data) map.set(item.date, item.leads);
    return map;
  }, [data]);

  const calendarDays = useMemo(() => {
    if (data.length === 0) return [];
    const firstDate = parseDateKey(data[0].date);
    const year = firstDate.getUTCFullYear();
    const month = firstDate.getUTCMonth();
    const firstWeekday = firstDate.getUTCDay();
    const monthLength = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const out: Array<{ key: string; day: number; date: string | null; leads: number }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      out.push({ key: `empty-${i}`, day: 0, date: null, leads: 0 });
    }
    for (let day = 1; day <= monthLength; day++) {
      const d = new Date(Date.UTC(year, month, day));
      const dateKey = d.toISOString().slice(0, 10);
      out.push({
        key: dateKey,
        day,
        date: dateKey,
        leads: leadsByDate.get(dateKey) ?? 0,
      });
    }
    return out;
  }, [data, leadsByDate]);

  const monthLabel = useMemo(() => {
    if (data.length === 0) return "";
    return formatCustom(parseDateKey(data[0].date), {
      month: "long",
      year: "numeric",
    });
  }, [data]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    if (data.some((d) => d.date === todayKey)) return todayKey;
    return data[0]?.date ?? null;
  });

  const selectedLeads = selectedDate ? leadsByDate.get(selectedDate) ?? 0 : 0;
  const yesterdayLeads = useMemo(() => {
    if (!selectedDate) return 0;
    const d = parseDateKey(selectedDate);
    d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().slice(0, 10);
    return leadsByDate.get(key) ?? 0;
  }, [selectedDate, leadsByDate]);
  const selectedDelta = selectedLeads - yesterdayLeads;

  const recentList = useMemo(() => {
    return data
      .slice()
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 5);
  }, [data]);

  const monthTotalLeads = useMemo(() => data.reduce((acc, item) => acc + item.leads, 0), [data]);

  const peakDay = useMemo(() => {
    return data.reduce<DayData | null>((best, current) => {
      if (!best) return current;
      return current.leads > best.leads ? current : best;
    }, null);
  }, [data]);

  const handleMoveSelection = (offsetDays: number) => {
    if (!selectedDate) return;
    const current = parseDateKey(selectedDate);
    current.setUTCDate(current.getUTCDate() + offsetDays);
    const nextKey = current.toISOString().slice(0, 10);
    if (!leadsByDate.has(nextKey)) return;
    setSelectedDate(nextKey);
  };

  return (
    <div className="panel-lux rounded-2xl border border-brand-border/90 bg-brand-surface/70 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-brand-border/70 pb-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Calendário de leads
          </h3>
          <p className="mt-1 text-xs text-brand-muted">
            Mapa diário de captação com leitura rápida de intensidade.
          </p>
        </div>
        {monthLabel ? (
          <span className="rounded-lg border border-brand-border bg-brand-surface/80 px-2.5 py-1.5 text-xs font-medium capitalize text-brand-text">
            {monthLabel}
          </span>
        ) : null}
      </div>

      {data.length === 0 ? (
        <p className="text-xs text-brand-muted">Sem dados para o mês atual.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-brand-border bg-brand-surface/80 px-2.5 py-1.5 text-brand-muted">
              Total no mês: <strong className="text-brand-text">{monthTotalLeads}</strong>
            </span>
            {peakDay ? (
              <button
                type="button"
                className="rounded-full border border-brand-neon/30 bg-brand-neon/10 px-2.5 py-1.5 text-brand-neon transition hover:bg-brand-neon/15"
                onClick={() => setSelectedDate(peakDay.date)}
              >
                Pico: {formatDateLabel(peakDay.date)} ({peakDay.leads})
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-brand-border bg-brand-surface/80 px-2.5 py-1.5 text-brand-muted transition hover:border-brand-neon/40 hover:text-brand-text"
              onClick={() => setSelectedDate(todayKey)}
              disabled={!leadsByDate.has(todayKey)}
            >
              Ir para hoje
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <div className="max-w-[390px] rounded-xl border border-brand-border/80 bg-brand-surface/45 p-3">
          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted/90"
              >
                {label}
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 gap-1.5"
            role="grid"
            aria-label="Calendário de captação de leads por dia"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                handleMoveSelection(-1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                handleMoveSelection(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                handleMoveSelection(-7);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                handleMoveSelection(7);
              }
            }}
          >
            {calendarDays.map((day) =>
              day.date ? (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  title={`${formatDateLabel(day.date)} - ${day.leads} leads`}
                  aria-label={`${formatDateLabel(day.date)} com ${day.leads} leads`}
                  className={`relative flex h-12 items-center justify-center rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon/45 hover:-translate-y-[1px] hover:border-brand-neon/60 ${
                    selectedDate === day.date
                      ? "border-brand-neon/70 bg-brand-neon/14 ring-1 ring-brand-neon/30 shadow-[0_6px_16px_-12px_rgba(0,200,130,0.6)]"
                      : intensityClass(day.leads)
                  }`}
                >
                  <span className="text-sm font-semibold tabular-nums text-brand-text">{day.day}</span>
                  <span
                    aria-hidden
                    className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                      day.leads > 0 ? "bg-brand-neon/90" : "bg-transparent"
                    }`}
                  />
                </button>
              ) : (
                <div key={day.key} className="h-12 rounded-lg border border-transparent" />
              )
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-brand-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full border border-brand-border bg-brand-surface/80" />
              Sem captação
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full border border-brand-neon/40 bg-brand-neon/15" />
              Baixo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full border border-brand-neon/50 bg-brand-neon/30" />
              Médio
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full border border-brand-neon/60 bg-brand-neon/45" />
              Alto
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-brand-border/80 bg-brand-surface/55 p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-brand-text">Resumo do dia selecionado</h4>
          <p className="mt-1 text-xs capitalize text-brand-muted">
            {selectedDate ? formatLongDateLabel(selectedDate) : "Sem data selecionada"}
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface/80 px-3 py-2">
              <span className="text-brand-muted">Leads no dia</span>
              <strong className="text-brand-text">{selectedLeads}</strong>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface/80 px-3 py-2">
              <span className="text-brand-muted">Nível</span>
              <strong className="text-brand-text">{intensityLabel(selectedLeads)}</strong>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface/80 px-3 py-2">
              <span className="text-brand-muted">Comparação com ontem</span>
              <strong className={deltaClass(selectedDelta)}>
                {selectedDelta >= 0 ? "+" : ""}
                {selectedDelta}
              </strong>
            </li>
          </ul>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-muted">
              Lista rápida (últimos dias)
            </p>
            <ul className="space-y-1.5">
              {recentList.map((item) => (
                <li key={item.date}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-brand-muted transition hover:bg-brand-surface hover:text-brand-text"
                    onClick={() => setSelectedDate(item.date)}
                  >
                    <span>{formatDateLabel(item.date)}</span>
                    <span className="font-medium text-brand-text">{item.leads} leads</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
          </div>
        </>
      )}
    </div>
  );
}
