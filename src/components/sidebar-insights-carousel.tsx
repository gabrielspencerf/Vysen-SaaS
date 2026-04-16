"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SidebarInsightsPayload } from "@/types/sidebar-insights";

interface SidebarInsightsCarouselProps {
  insights: SidebarInsightsPayload;
}

function formatInsightValue(
  value: number | null,
  valueType: "ratio" | "percent" | "currency" | "status" | "number",
  statusLabel?: string
): string {
  if (valueType === "status") return statusLabel ?? "desconhecido";
  if (value === null) return "—";
  if (valueType === "number") {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
  }
  if (valueType === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (valueType === "percent") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return `${value.toFixed(2)}x`;
}

function getMetricPercent(
  value: number | null,
  valueType: "ratio" | "percent" | "currency" | "status" | "number"
): number {
  if (value === null) return 0;
  if (valueType === "status") return value > 0 ? 100 : 20;
  if (valueType === "number") return Math.max(0, Math.min(100, (value / 5000) * 100));
  if (valueType === "ratio") return Math.max(0, Math.min(100, (value / 6) * 100));
  if (valueType === "percent") return Math.max(0, Math.min(100, (value + 1) * 50));
  return Math.max(0, Math.min(100, (value / 10000) * 100));
}

function getMetricBarClass(
  value: number | null,
  valueType: "ratio" | "percent" | "currency" | "status" | "number",
  statusLabel?: string
): string {
  if (valueType !== "status") return "bg-brand-neon";
  const normalizedStatus = (statusLabel ?? "").toLowerCase();
  if (value !== null && value > 0) return "bg-emerald-500";
  if (normalizedStatus.includes("stale") || normalizedStatus.includes("offline")) return "bg-red-500";
  return "bg-amber-500";
}

function buildMiniSeries(seed: string, metricPercent: number): number[] {
  const safePercent = Math.max(8, Math.min(100, metricPercent));
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return Array.from({ length: 10 }).map((_, idx) => {
    const noise = ((hash >> ((idx % 4) * 6)) & 0x1f) / 100; // 0 - 0.31
    const baseline = safePercent / 100;
    const wave = Math.sin((idx + 1) * 0.8) * 0.08;
    const value = baseline * (0.62 + idx * 0.038) + wave + noise - 0.12;
    return Math.max(0.08, Math.min(0.98, value));
  });
}

export function SidebarInsightsCarousel({ insights }: SidebarInsightsCarouselProps) {
  const cards = useMemo(() => insights.cards.filter((card) => card !== null), [insights.cards]);
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (cards.length === 0) {
      setIndex(0);
      return;
    }
    if (index > cards.length - 1) setIndex(0);
  }, [cards.length, index]);

  useEffect(() => {
    if (cards.length <= 1 || isDragging || isHovered) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % cards.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [cards.length, isDragging, isHovered]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (cards.length <= 1) return;
    pointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    setIsDragging(true);
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || pointerIdRef.current !== event.pointerId) return;
    const delta = event.clientX - dragStartXRef.current;
    setDragOffset(delta);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || pointerIdRef.current !== event.pointerId) return;
    const width = viewportRef.current?.offsetWidth ?? 1;
    const threshold = Math.max(36, width * 0.2);

    if (dragOffset >= threshold) {
      setIndex((prev) => (prev - 1 + cards.length) % cards.length);
    } else if (dragOffset <= -threshold) {
      setIndex((prev) => (prev + 1) % cards.length);
    }

    setIsDragging(false);
    setDragOffset(0);
    pointerIdRef.current = null;
  }

  if (cards.length === 0) return null;

  return (
    <div className="mx-2 rounded-xl border border-brand-border bg-brand-surface/40 px-3 py-3">
      <div
        ref={viewportRef}
        className={`relative h-[152px] overflow-hidden ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        style={{ touchAction: "pan-y" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className={`flex h-full ${isDragging ? "" : "transition-transform duration-500 ease-out"}`}
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
          }}
        >
          {cards.map((card, cardIndex) => {
            const metricPercent = getMetricPercent(card.value, card.valueType);
            const metricColorClass = getMetricBarClass(card.value, card.valueType, card.statusLabel);
            const miniSeries = buildMiniSeries(card.id, metricPercent);
            const miniSeriesPath = miniSeries
              .map((point, pointIndex) => {
                const x = (pointIndex / (miniSeries.length - 1)) * 100;
                const y = 100 - point * 100;
                return `${pointIndex === 0 ? "M" : "L"} ${x},${y}`;
              })
              .join(" ");

            return (
              <article key={card.id} data-card-index={cardIndex} className="h-full w-full shrink-0 grow-0 basis-full px-1">
                <p className="text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                  {card.label}
                </p>
                <p className="mt-1 text-[1.66rem] leading-none font-bold text-brand-text">
                  {formatInsightValue(card.value, card.valueType, card.statusLabel)}
                </p>
                <div className="mt-2 rounded-lg border border-brand-border/70 bg-brand-surface/45 px-2 py-1.5">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-7 w-full"
                    aria-hidden
                  >
                    <path
                      d={miniSeriesPath}
                      fill="none"
                      className="text-brand-neon/80"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="mt-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-brand-border/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${metricColorClass}`}
                      style={{ width: `${metricPercent}%` }}
                    />
                  </div>
                </div>
                <p
                  data-card-hint-index={cardIndex}
                  className="mt-1.5 line-clamp-2 text-[0.69rem] leading-4 text-brand-muted"
                >
                  {card.hint}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {cards.map((card, dotIndex) => (
          <button
            key={card.id}
            type="button"
            aria-label={`Ir para insight ${dotIndex + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              dotIndex === index ? "w-4 bg-brand-neon" : "w-1.5 bg-brand-border"
            }`}
            onClick={() => setIndex(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
