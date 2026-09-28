import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { commissionFor, currency, fetchDeals, fetchMyRole, fetchProfiles } from "@/lib/crm";

type ComissoesSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões" },
      { name: "description", content: "Cálculo de comissão por vendedor com taxa configurável e acompanhamento de meta." },
      { property: "og:title", content: "Comissões" },
      { property: "og:description", content: "Cálculo de comissão por vendedor com taxa configurável e acompanhamento de meta." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): ComissoesSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: CommissionsPage,
});

function CommissionsPage() {
  const { vendorId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: allProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: deals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const profiles = vendorId ? allProfiles.filter((p) => p.id === vendorId) : allProfiles;
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const [drafts, setDrafts] = useState<Record<string, { rate: string; goal: string }>>({});

  const save = useMutation({
    mutationFn: async ({ id, rate, goal }: { id: string; rate: number; goal: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ commission_rate: rate, monthly_goal: goal })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Configuração salva.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalCommission = profiles.reduce((sum, p) => sum + commissionFor(deals, p).commission, 0);

  return (
    <AppShell
      title="Comissões"
      subtitle="Percentual configurável por vendedor, aplicado sobre negócios ganhos"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Comissão total</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{currency(totalCommission)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Receita ganha</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {currency(deals.filter((d) => d.status === "ganho").reduce((s, d) => s + Number(d.value), 0))}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendedores</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{profiles.length}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {profiles.map((profile) => {
          const stats = commissionFor(deals, profile);
          const editable = role === "admin" || profile.id === user?.id;
          const draft = drafts[profile.id] ?? {
            rate: String(profile.commission_rate),
            goal: String(profile.monthly_goal),
          };
          return (
            <div key={profile.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{profile.full_name || profile.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.wonCount} negócios ganhos · {currency(stats.total)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Comissão</p>
                  <p className="text-xl font-semibold text-primary">{currency(stats.commission)}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Meta mensal</span>
                  <span>
                    {currency(stats.total)} / {currency(profile.monthly_goal)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${stats.goalProgress}%` }} />
                </div>
              </div>

              {editable && (
                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Taxa (%)</Label>
                    <Input
                      className="h-9 w-24"
                      type="number"
                      step="0.5"
                      value={draft.rate}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [profile.id]: { ...draft, rate: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta (R$)</Label>
                    <Input
                      className="h-9 w-36"
                      type="number"
                      value={draft.goal}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [profile.id]: { ...draft, goal: e.target.value } }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      save.mutate({
                        id: profile.id,
                        rate: Number(draft.rate || 0),
                        goal: Number(draft.goal || 0),
                      })
                    }
                  >
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {profiles.length === 0 && (
          <p className="panel p-6 text-center text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>
        )}
      </div>
    </AppShell>
  );
}
