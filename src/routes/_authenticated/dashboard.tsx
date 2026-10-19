import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/crm/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  churnFor,
  commissionFor,
  currency,
  fetchContacts,
  fetchDeals,
  fetchMyRole,
  fetchStages,
  fetchTasks,
  fetchProfiles,
  fetchUserRoles,
  onlySellers,
  partnerCommissionFor,
  profilesForVendor,
  shortDate,
  summarizeDeals,
} from "@/lib/crm";

type DashboardSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard" },
      { name: "description", content: "Visão geral do funil, negócios ganhos, metas e tarefas do time comercial." },
      { property: "og:title", content: "Dashboard" },
      { property: "og:description", content: "Visão geral do funil, negócios ganhos, metas e tarefas do time comercial." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: Dashboard,
});

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { vendorId } = Route.useSearch();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const isTeamOverview = role === "admin" && !vendorId;

  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: allTasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: rawProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: userRoles = [] } = useQuery({ queryKey: ["user-roles"], queryFn: fetchUserRoles });
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: fetchContacts,
    enabled: isTeamOverview,
  });

  // Admin não é vendedor: some das listas de desempenho/meta/comissão —
  // exceto quando ele está vendo a si mesmo (seção "Minhas vendas").
  const allProfiles = onlySellers(rawProfiles, userRoles);

  const deals = vendorId ? allDeals.filter((d) => d.owner_id === vendorId) : allDeals;
  const tasks = vendorId ? allTasks.filter((t) => t.owner_id === vendorId) : allTasks;
  const profiles = profilesForVendor(rawProfiles, allProfiles, vendorId, user?.id);

  // Resumo do time só pro admin na visão agregada (sem vendorId) — mesmas
  // fórmulas já usadas em /relatorios e /comissoes, reaproveitadas aqui pra
  // dar uma visão rápida sem precisar trocar de tela. Sempre "mês atual" /
  // histórico completo, sem seletor de período próprio (o Dashboard nunca
  // teve filtro de período — é um retrato do agora, não um relatório).
  const totalVendorCommission = isTeamOverview
    ? allProfiles.reduce((sum, p) => sum + commissionFor(allDeals, p).commission, 0)
    : 0;
  const partnersWithDeals = isTeamOverview
    ? contacts.filter((c) => c.type === "parceiro" && allDeals.some((d) => d.partner_id === c.id))
    : [];
  const totalPartnerCommission = partnersWithDeals.reduce(
    (sum, p) => sum + partnerCommissionFor(allDeals, p.id).commission,
    0,
  );
  const churn = isTeamOverview
    ? churnFor(
        contacts.filter((c) => c.type === "cliente"),
        allDeals,
        "mes",
      )
    : null;

  const leadTypes = Array.from(new Set(allDeals.map((d) => d.lead_type)));
  const byLead = leadTypes
    .map((type) => {
      const all = allDeals.filter((d) => d.lead_type === type);
      const s = summarizeDeals(all);
      return { type, total: all.length, won: s.wonCount, lost: s.lostCount, wonValue: s.wonValue, conversion: s.conversion };
    })
    .sort((a, b) => b.conversion - a.conversion);
  const bestLead = byLead[0];

  // Mantido separado do resumo abaixo: alimenta o gráfico de pipeline por
  // etapa, que é um cálculo de negócios "aberto" (pipeline), não de receita
  // ganha/comissão — famílias diferentes, não unificadas de propósito.
  const open = deals.filter((d) => d.status === "aberto");
  const summary = summarizeDeals(deals);
  const pending = tasks.filter((t) => !t.done);

  const chart = stages.map((stage) => ({
    name: stage.name,
    valor: open.filter((d) => d.stage_id === stage.id).reduce((s, d) => s + Number(d.value), 0),
  }));

  const sellerName = vendorId ? profiles[0]?.full_name || profiles[0]?.email : null;

  return (
    <AppShell
      title="Dashboard"
      subtitle={sellerName ? `Panorama de ${sellerName}` : "Panorama do time comercial"}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Pipeline aberto" value={currency(summary.openValue)} hint={`${open.length} negócios em andamento`} />
        <Kpi
          label="Ganho"
          value={currency(summary.wonValue)}
          hint={`${summary.wonCount} negócios fechados`}
        />
        <Kpi label="Conversão" value={`${summary.conversion.toFixed(1)}%`} hint={`${summary.lostCount} perdidos`} />
        <Kpi label="Tarefas pendentes" value={String(pending.length)} hint={`${tasks.length - pending.length} concluídas`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <p className="text-sm font-medium">Valor por etapa do funil</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} width={70} />
                <Tooltip
                  formatter={(v: number) => currency(v)}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Bar dataKey="valor" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-sm font-medium">Metas do time</p>
          <div className="mt-4 space-y-4">
            {profiles.map((profile) => {
              const { wonValue: total } = summarizeDeals(deals, { ownerId: profile.id });
              const progress = profile.monthly_goal > 0 ? Math.min(100, (total / profile.monthly_goal) * 100) : 0;
              return (
                <div key={profile.id}>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{profile.full_name || profile.email}</span>
                    <span className="text-muted-foreground">
                      {currency(total)} / {currency(profile.monthly_goal)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
            {profiles.length === 0 && <p className="text-xs text-muted-foreground">Nenhum vendedor cadastrado.</p>}
          </div>
        </div>
      </div>

      {isTeamOverview && churn && (
        <>
          <h2 className="mt-8 text-sm font-medium text-muted-foreground">Relatório do time</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Comissão do time" value={currency(totalVendorCommission)} hint="Histórico completo" />
            <Kpi label="Comissão de parceiros" value={currency(totalPartnerCommission)} hint="Histórico completo" />
            <Kpi
              label="Clientes ativos (mês)"
              value={String(churn.activeAtStart)}
              hint={`${churn.churned} cancelados no mês`}
            />
            <Kpi label="Taxa de churn (mês)" value={`${churn.rate.toFixed(1)}%`} />
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="panel p-4 lg:col-span-2">
              <p className="text-sm font-medium">Conversão por tipo de lead</p>
              <div className="mt-4 h-56">
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
              <p className="mt-2 text-2xl font-semibold tracking-tight">{bestLead?.type ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {bestLead
                  ? `${bestLead.conversion.toFixed(1)}% de conversão · ${currency(bestLead.wonValue)} ganhos`
                  : "Sem dados ainda."}
              </p>
            </div>
          </div>

          <div className="panel mt-3 overflow-x-auto">
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
                {allProfiles.map((profile) => {
                  const s = summarizeDeals(allDeals, { ownerId: profile.id });
                  const closed = s.wonCount + s.lostCount;
                  return (
                    <tr key={profile.id}>
                      <td className="px-4 py-3 font-medium">{profile.full_name || profile.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.openCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.wonCount}</td>
                      <td className="px-4 py-3 font-medium text-primary">
                        {closed > 0 ? `${s.conversion.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">{currency(s.wonValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {churn.churnedClients.length > 0 && (
            <div className="panel mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Cliente cancelado no mês</th>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-4 py-3 font-medium">Cancelado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {churn.churnedClients.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.company || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.churn_reason || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shortDate(c.churned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="panel mt-4 p-4">
        <p className="text-sm font-medium">Próximas tarefas</p>
        <div className="mt-3 divide-y divide-border">
          {pending.slice(0, 6).map((task) => (
            <div key={task.id} className="flex items-center justify-between py-2 text-sm">
              <span>{task.title}</span>
              <span className="text-xs text-muted-foreground">{shortDate(task.due_date)}</span>
            </div>
          ))}
          {pending.length === 0 && <p className="py-2 text-xs text-muted-foreground">Sem tarefas pendentes.</p>}
        </div>
      </div>
    </AppShell>
  );
}
