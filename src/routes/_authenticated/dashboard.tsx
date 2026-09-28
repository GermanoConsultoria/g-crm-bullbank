import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/crm/AppShell";
import { currency, fetchDeals, fetchStages, fetchTasks, fetchProfiles, shortDate } from "@/lib/crm";

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
  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: allTasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: allProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const deals = vendorId ? allDeals.filter((d) => d.owner_id === vendorId) : allDeals;
  const tasks = vendorId ? allTasks.filter((t) => t.owner_id === vendorId) : allTasks;
  const profiles = vendorId ? allProfiles.filter((p) => p.id === vendorId) : allProfiles;

  const open = deals.filter((d) => d.status === "aberto");
  const won = deals.filter((d) => d.status === "ganho");
  const lost = deals.filter((d) => d.status === "perdido");
  const openValue = open.reduce((s, d) => s + Number(d.value), 0);
  const wonValue = won.reduce((s, d) => s + Number(d.value), 0);
  const conversion = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;
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
        <Kpi label="Pipeline aberto" value={currency(openValue)} hint={`${open.length} negócios em andamento`} />
        <Kpi label="Ganho" value={currency(wonValue)} hint={`${won.length} negócios fechados`} />
        <Kpi label="Conversão" value={`${conversion.toFixed(1)}%`} hint={`${lost.length} perdidos`} />
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
              const total = won
                .filter((d) => d.owner_id === profile.id)
                .reduce((s, d) => s + Number(d.value), 0);
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
