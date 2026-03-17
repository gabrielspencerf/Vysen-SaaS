"use client";

import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

/** Paleta para tooltips e gráficos. */
const CHART_THEME = {
  light: {
    tooltip: {
      bg: "#ffffff",
      border: "#e4e4e7",
      text: "#18181b",
    },
    grid: "rgba(113, 113, 122, 0.2)",
    text: "#71717a",
    neon: "#00a064",
    neonLight: "#00c882",
    barContrast: "#bff6df",
  },
  dark: {
    tooltip: {
      bg: "#0c0f0d",
      border: "#1a201c",
      text: "#f0f5f2",
    },
    grid: "rgba(161, 161, 170, 0.15)",
    text: "#a1a1aa",
    neon: "#00c882",
    neonLight: "#22e3a8",
    barContrast: "#8ef5cf",
  },
} as const;

/** Formato esperado para o gráfico de leads por dia (dados reais do servidor). */
export type LeadsChartDataItem = { name: string; leads: number };

/** Formato esperado para o gráfico de gasto em ads por semana (dados reais do servidor). */
export type AdsSpendChartDataItem = { name: string; gasto: number; cliques: number };

type TooltipTheme =
  | (typeof CHART_THEME)["light"]["tooltip"]
  | (typeof CHART_THEME)["dark"]["tooltip"];
const tooltipContentStyle = (t: TooltipTheme) => ({
  backgroundColor: t.bg,
  border: `1px solid ${t.border}`,
  borderRadius: 14,
  padding: "12px 16px",
  color: t.text,
  fontSize: 13,
  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.25)",
});

function formatLeads(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value) + " leads";
}
function formatGasto(value: number) {
  return (
    "R$ " +
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  );
}

const DEFAULT_LEADS_DATA: LeadsChartDataItem[] = [
  { name: "Seg", leads: 0 },
  { name: "Ter", leads: 0 },
  { name: "Qua", leads: 0 },
  { name: "Qui", leads: 0 },
  { name: "Sex", leads: 0 },
  { name: "Sáb", leads: 0 },
  { name: "Dom", leads: 0 },
];

export function LeadsChart({ data }: { data?: LeadsChartDataItem[] | null }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const th = isLight ? CHART_THEME.light : CHART_THEME.dark;
  const t = th.tooltip;
  const color = th.neon;
  const colorLight = th.neonLight;
  const chartData = data && data.length > 0 ? data : DEFAULT_LEADS_DATA;
  const maxVal = Math.max(...chartData.map((d) => d.leads), 1);

  return (
    <div className="mt-2 h-[248px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
          barCategoryGap="28%"
          barGap={4}
        >
          <defs>
            <linearGradient id="barGradientLeads" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.85} />
              <stop offset="100%" stopColor={colorLight} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 6"
            stroke={th.grid}
            vertical={false}
            strokeWidth={1}
          />
          <XAxis
            dataKey="name"
            stroke={th.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            stroke={th.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={34}
          />
          <Tooltip
            cursor={false}
            contentStyle={tooltipContentStyle(t)}
            labelStyle={{ color: t.text, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: t.text }}
            formatter={(value: unknown) => [formatLeads(Number(value ?? 0)), "Leads"]}
            labelFormatter={(label) => label}
          />
          <Bar
            dataKey="leads"
            fill="url(#barGradientLeads)"
            radius={[999, 999, 999, 999]}
            maxBarSize={34}
          >
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={color}
                fillOpacity={maxVal > 0 ? 0.5 + (entry.leads / maxVal) * 0.5 : 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DEFAULT_ADS_DATA: AdsSpendChartDataItem[] = [
  { name: "Semana 1", gasto: 0, cliques: 0 },
  { name: "Semana 2", gasto: 0, cliques: 0 },
  { name: "Semana 3", gasto: 0, cliques: 0 },
  { name: "Semana 4", gasto: 0, cliques: 0 },
];

export function AdsSpendChart({ data }: { data?: AdsSpendChartDataItem[] | null }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const th = isLight ? CHART_THEME.light : CHART_THEME.dark;
  const t = th.tooltip;
  const color = th.neon;
  const colorLight = th.neonLight;
  const chartData = data && data.length > 0 ? data : DEFAULT_ADS_DATA;

  return (
    <div className="mt-2 h-[248px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="areaGradientAds" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorLight} stopOpacity={0.45} />
              <stop offset="50%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 6"
            stroke={th.grid}
            vertical={false}
            strokeWidth={1}
          />
          <XAxis
            dataKey="name"
            stroke={th.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            stroke={th.text}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={36}
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          />
          <Tooltip
            contentStyle={tooltipContentStyle(t)}
            labelStyle={{ color: t.text, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: t.text }}
            formatter={(value: unknown) => [formatGasto(Number(value ?? 0)), "Gasto"]}
            labelFormatter={(label) => label}
            cursor={false}
          />
          <Area
            type="monotone"
            dataKey="gasto"
            stroke={colorLight}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fillOpacity={1}
            fill="url(#areaGradientAds)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
