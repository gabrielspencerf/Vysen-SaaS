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

const mockLeadData = [
  { name: "Seg", leads: 12, tone: 0.68, highlight: false },
  { name: "Ter", leads: 19, tone: 0.82, highlight: false },
  { name: "Qua", leads: 15, tone: 0.58, highlight: false },
  { name: "Qui", leads: 22, tone: 0.95, highlight: true },
  { name: "Sex", leads: 28, tone: 0.9, highlight: false },
  { name: "Sáb", leads: 10, tone: 0.55, highlight: false },
  { name: "Dom", leads: 8, tone: 0.46, highlight: false },
];

const mockAdsData = [
  { name: "Semana 1", gasto: 400, cliques: 1200 },
  { name: "Semana 2", gasto: 300, cliques: 900 },
  { name: "Semana 3", gasto: 550, cliques: 1800 },
  { name: "Semana 4", gasto: 620, cliques: 2100 },
];

const tooltipContentStyle = (
  t: (typeof CHART_THEME)["light"]["tooltip"]
) => ({
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

export function LeadsChart() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const th = isLight ? CHART_THEME.light : CHART_THEME.dark;
  const t = th.tooltip;
  const color = th.neon;
  const colorLight = th.neonLight;
  const barContrast = th.barContrast;

  return (
    <div className="mt-2 h-[248px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mockLeadData}
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
            formatter={(value: number) => [formatLeads(value), "Leads"]}
            labelFormatter={(label) => label}
          />
          <Bar
            dataKey="leads"
            fill="url(#barGradientLeads)"
            radius={[999, 999, 999, 999]}
            maxBarSize={34}
          >
            {mockLeadData.map((entry) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={entry.highlight ? barContrast : color}
                fillOpacity={entry.highlight ? 0.95 : entry.tone}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdsSpendChart() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const th = isLight ? CHART_THEME.light : CHART_THEME.dark;
  const t = th.tooltip;
  const color = th.neon;
  const colorLight = th.neonLight;

  return (
    <div className="mt-2 h-[248px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={mockAdsData}
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
            formatter={(value: number) => [formatGasto(value), "Gasto"]}
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
