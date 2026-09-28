import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/crm/AppShell";
import { currency, fetchDeals, fetchProfiles, type Deal } from "@/lib/crm";

type Period = "semana" | "mes" | "ano";

function filterByPeriod(deals: Deal[], period: Period): Deal[] {
  const now = new Date();
  return deals.filter((d) => {
    const ref = d.closed_at ?? d.created_at;
    const date = new Date(ref);
    if (period === "semana") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (period === "mes") {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    // ano
    return date.getFullYear() === now.getFullYear();
  });
}

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios" },
      { name: "description", content: "Análise de conversão por tipo de lead e desempenho de cada vendedor." },
      { property: "og:title", content: "Relatórios" },
      { property: "og:description", content: "Análise de conversão por tipo de lead e desempenho de cada vendedor." },
    ],
  }),
  component: ReportsPage,
});

const PERIODS: { value: Period; label: string }[] = [
  { value: "semana", label: "Semana atual" },
  { value: "mes",    label: "Mês atual" },
  { value: "ano",    label: "Ano atual" },
];

function ReportsPage() {
  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const [period, setPeriod] = useState<Period>("mes");

  const deals = filterByPeriod(allDeals, period);

  const leadTypes = Array.from(new Set(deals.map((d) => d.lead_type)));
  const byLead = leadTypes
    .map((type) => {
      const all = deals.filter((d) => d.lead_type === type);
      const won = all.filter((d) => d.status === "ganho");
      const lost = all.filter((d) => d.status === "perdido");
      const closed = won.length + lost.length;
      return {
        type,
        total: all.length,
        won: won.length,
        lost: lost.length,
        wonValue: won.reduce((s, d) => s + Number(d.value), 0),
        ticket: won.length > 0 ? won.reduce((s, d) => s + Number(d.value), 0) / won.length : 0,
        conversion: closed > 0 ? (won.length / closed) * 100 : 0,
      };
    })
    .sort((a, b) => b.conversion - a.conversion);

  const best = byLead[0];

  return (
    <AppShell title="Relatórios" subtitle="Conversão por tipo de lead e desempenho do time">
      <div className="flex justify-end mb-4">
        <div className="flex items-center rounded-md border border-input bg-background p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded px-2.5 py-1.5 text-xs transition-colors ${
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <p className="text-sm font-medium">Taxa de conversão por tipo de lead</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byLead}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="type" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis unit="%" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Bar dataKey="conversion" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Melhor origem</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{best?.type ?? "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {best ? `${best.conversion.toFixed(1)}% de conversão · ${currency(best.wonValue)} ganhos` : "Sem dados ainda."}
          </p>
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo de lead</th>
              <th className="px-4 py-3 font-medium">Negócios</th>
              <th className="px-4 py-3 font-medium">Ganhos</th>
              <th className="px-4 py-3 font-medium">Perdidos</th>
              <th className="px-4 py-3 font-medium">Conversão</th>
              <th className="px-4 py-3 font-medium">Ticket médio</th>
              <th className="px-4 py-3 font-medium">Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {byLead.map((row) => (
              <tr key={row.type}>
                <td className="px-4 py-3 font-medium">{row.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.total}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.won}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.lost}</td>
                <td className="px-4 py-3 font-medium text-primary">{row.conversion.toFixed(1)}%</td>
                <td className="px-4 py-3 text-muted-foreground">{currency(row.ticket)}</td>
                <td className="px-4 py-3">{currency(row.wonValue)}</td>
              </tr>
            ))}
            {byLead.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Cadastre negócios para gerar relatórios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Abertos</th>
              <th className="px-4 py-3 font-medium">Ganhos</th>
              <th className="px-4 py-3 font-medium">Conversão</th>
              <th className="px-4 py-3 font-medium">Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {profiles.map((profile) => {
              const mine = deals.filter((d) => d.owner_id === profile.id);
              const won = mine.filter((d) => d.status === "ganho");
              const lost = mine.filter((d) => d.status === "perdido");
              const closed = won.length + lost.length;
              return (
                <tr key={profile.id}>
                  <td className="px-4 py-3 font-medium">{profile.full_name || profile.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {mine.filter((d) => d.status === "aberto").length}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{won.length}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {closed > 0 ? `${((won.length / closed) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">{currency(won.reduce((s, d) => s + Number(d.value), 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
