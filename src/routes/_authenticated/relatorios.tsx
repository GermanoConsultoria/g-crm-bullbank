import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/crm/AppShell";
import { ClientVolumeDialog } from "@/components/crm/ClientVolumeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  churnFor,
  clientVolumeFor,
  currency,
  fetchContacts,
  fetchDeals,
  fetchProfiles,
  fetchUserRoles,
  filterByPeriod,
  onlySellers,
  profilesForVendor,
  shortDate,
  summarizeDeals,
  type Contact,
  type Period,
} from "@/lib/crm";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  aberto: "secondary",
  ganho: "default",
  perdido: "destructive",
};

type RelatoriosSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios" },
      { name: "description", content: "Análise de conversão por tipo de lead e desempenho de cada vendedor." },
      { property: "og:title", content: "Relatórios" },
      { property: "og:description", content: "Análise de conversão por tipo de lead e desempenho de cada vendedor." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RelatoriosSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: ReportsPage,
});

const PERIODS: { value: Period; label: string }[] = [
  { value: "semana", label: "Semana atual" },
  { value: "mes",    label: "Mês atual" },
  { value: "ano",    label: "Ano atual" },
];

function ReportsPage() {
  const { vendorId } = Route.useSearch();
  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: rawProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: userRoles = [] } = useQuery({ queryKey: ["user-roles"], queryFn: fetchUserRoles });
  const { data: contacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const [period, setPeriod] = useState<Period>("mes");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [volumeTarget, setVolumeTarget] = useState<Contact | null>(null);

  // Admin não é vendedor: some da tabela de desempenho por vendedor (mas
  // continua aparecendo no Histórico se algum negócio antigo for dele) —
  // exceto quando ele está vendo a si mesmo (seção "Minhas vendas").
  const allProfiles = onlySellers(rawProfiles, userRoles);
  const profiles = profilesForVendor(rawProfiles, allProfiles, vendorId, user?.id);
  const scopedDeals = vendorId ? allDeals.filter((d) => d.owner_id === vendorId) : allDeals;
  const deals = filterByPeriod(scopedDeals, period);

  // Histórico independe do filtro de período — é o extrato completo, mais recente primeiro.
  const history = [...scopedDeals].sort(
    (a, b) =>
      new Date(b.closed_at ?? b.created_at).getTime() - new Date(a.closed_at ?? a.created_at).getTime(),
  );
  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name ?? "—";
  const profileName = (id: string) => {
    const profile = rawProfiles.find((p) => p.id === id);
    return profile?.full_name || profile?.email || "—";
  };

  const clientContacts = contacts.filter((c) => c.type === "cliente" && (!vendorId || c.owner_id === vendorId));
  const churn = churnFor(clientContacts, scopedDeals, period);

  // Independe do filtro de período — é um acumulado histórico, igual ao Histórico de negócios.
  const volumeRanking = clientContacts
    .map((c) => ({ contact: c, volume: clientVolumeFor(scopedDeals, c.id, c.churned_at) }))
    .filter((row) => row.volume.wonCount > 0)
    .sort((a, b) => b.volume.total - a.volume.total);

  const leadTypes = Array.from(new Set(deals.map((d) => d.lead_type)));
  const byLead = leadTypes
    .map((type) => {
      const all = deals.filter((d) => d.lead_type === type);
      const summary = summarizeDeals(all);
      return {
        type,
        total: all.length,
        won: summary.wonCount,
        lost: summary.lostCount,
        wonValue: summary.wonValue,
        ticket: summary.wonCount > 0 ? summary.wonValue / summary.wonCount : 0,
        conversion: summary.conversion,
      };
    })
    .sort((a, b) => b.conversion - a.conversion);

  const best = byLead[0];

  return (
    <AppShell title="Relatórios" subtitle="Conversão por tipo de lead e desempenho do time">
      <div className="flex items-center justify-between mb-4">
        <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
          <History className="size-4" /> Histórico
        </Button>
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
              const summary = summarizeDeals(deals, { ownerId: profile.id });
              const closed = summary.wonCount + summary.lostCount;
              return (
                <tr key={profile.id}>
                  <td className="px-4 py-3 font-medium">{profile.full_name || profile.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{summary.openCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{summary.wonCount}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {closed > 0 ? `${summary.conversion.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">{currency(summary.wonValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted-foreground">Clientes por volume de compra</h2>
      <div className="panel mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Negócios ganhos</th>
              <th className="px-4 py-3 font-medium">Total comprado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {volumeRanking.map(({ contact, volume }) => (
              <tr
                key={contact.id}
                className="cursor-pointer hover:bg-secondary/40"
                onClick={() => setVolumeTarget(contact)}
              >
                <td className="px-4 py-3 font-medium">{contact.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{contact.company || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{volume.wonCount}</td>
                <td className="px-4 py-3">{currency(volume.total)}</td>
              </tr>
            ))}
            {volumeRanking.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente com negócio ganho ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted-foreground">Churn de clientes</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Clientes ativos no início do período</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{churn.activeAtStart}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelados no período</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{churn.churned}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxa de churn</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-destructive">
            {churn.rate.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="panel mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Receita gerada</th>
              <th className="px-4 py-3 font-medium">Motivo</th>
              <th className="px-4 py-3 font-medium">Cancelado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {churn.churnedClients.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.company || "—"}</td>
                <td className="px-4 py-3">{currency(c.wonValue)}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.churn_reason || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(c.churned_at)}</td>
              </tr>
            ))}
            {churn.churnedClients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente cancelado nesse período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {churn.excludedChurn.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            Cancelaram dentro do período, mas viraram cliente no mesmo período — não entram na taxa de churn
            acima (não estavam "ativos no início do período").
          </p>
          <div className="panel mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Receita gerada</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Cancelado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {churn.excludedChurn.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.company || "—"}</td>
                    <td className="px-4 py-3">{currency(c.wonValue)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.churn_reason || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(c.churned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Histórico de negócios</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Negócio</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Vendedor</th>
                  <th className="px-3 py-2 font-medium">Tipo de lead</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Comissão</th>
                  <th className="px-3 py-2 font-medium">Parceiro indicador</th>
                  <th className="px-3 py-2 font-medium">Comissão parceiro</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((deal) => (
                  <tr key={deal.id}>
                    <td className="px-3 py-2 font-medium">{deal.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{contactName(deal.client_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{profileName(deal.owner_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{deal.lead_type}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[deal.status] ?? "secondary"}>
                        {STATUS_LABEL[deal.status] ?? deal.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{currency(Number(deal.value))}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {deal.status === "ganho"
                        ? `${currency((Number(deal.value) * Number(deal.commission_rate)) / 100)} (${deal.commission_rate}%)`
                        : `${deal.commission_rate}%`}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {deal.partner_id ? contactName(deal.partner_id) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {deal.partner_id
                        ? deal.status === "ganho"
                          ? `${currency((Number(deal.value) * Number(deal.partner_commission_rate ?? 0)) / 100)} (${deal.partner_commission_rate ?? 0}%)`
                          : `${deal.partner_commission_rate ?? 0}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{shortDate(deal.closed_at ?? deal.created_at)}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Nenhum negócio cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <ClientVolumeDialog
        contact={volumeTarget}
        deals={scopedDeals}
        open={!!volumeTarget}
        onOpenChange={(next) => !next && setVolumeTarget(null)}
      />
    </AppShell>
  );
}
