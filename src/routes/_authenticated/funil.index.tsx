import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, KanbanSquare, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { currency, fetchDeals, fetchFunnels, fetchProfiles, fetchStages, type Funnel } from "@/lib/crm";

type FunilIndexSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/funil/")({
  head: () => ({
    meta: [
      { title: "Funis de vendas" },
      { name: "description", content: "Cadastro dos funis de vendas. Selecione um para abrir o quadro kanban." },
      { property: "og:title", content: "Funis de vendas" },
      { property: "og:description", content: "Cadastro dos funis de vendas. Selecione um para abrir o quadro kanban." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): FunilIndexSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: FunnelListPage,
});

function FunnelListPage() {
  const { vendorId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: allFunnels = [] } = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: allProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled: !!vendorId });
  const funnels = vendorId ? allFunnels.filter((f) => f.owner_id === vendorId) : allFunnels;
  const deals = vendorId ? allDeals.filter((d) => d.owner_id === vendorId) : allDeals;
  const sellerName = vendorId ? allProfiles.find((p) => p.id === vendorId)?.full_name : null;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funnel | null>(null);
  const [name, setName] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Funnel | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["funnels"] });
    queryClient.invalidateQueries({ queryKey: ["stages"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("funnels").update({ name }).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const nextPosition = Math.max(0, ...funnels.map((f) => f.position)) + 1;
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("funnels")
        .insert({ name, position: nextPosition, owner_id: vendorId ?? userData.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Funil atualizado." : "Funil criado.");
      setOpen(false);
      setEditing(null);
      setName("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Funil removido.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (funnel: Funnel) => {
    setEditing(funnel);
    setName(funnel.name);
    setOpen(true);
  };

  return (
    <AppShell
      title="Funis de vendas"
      subtitle={
        sellerName
          ? `${sellerName} · ${funnels.length} cadastrado${funnels.length === 1 ? "" : "s"}`
          : `${funnels.length} cadastrado${funnels.length === 1 ? "" : "s"}`
      }
      actions={
        <>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditing(null);
                setName("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> Novo funil
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar funil" : "Novo funil"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Funil comercial" />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => (editing ? setConfirmSaveOpen(true) : save.mutate())}
                  disabled={!name || save.isPending}
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Salvar alterações</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja renomear "{editing?.name}" para "{name}"?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setConfirmSaveOpen(false);
                    save.mutate();
                  }}
                >
                  Salvar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir funil</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{pendingDelete?.name}"? Todas as etapas desse funil serão
                  removidas e os negócios nelas ficarão sem etapa. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                  onClick={() => {
                    if (pendingDelete) remove.mutate(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {funnels.map((funnel) => {
          const funnelStages = stages.filter((s) => s.funnel_id === funnel.id);
          const stageIds = new Set(funnelStages.map((s) => s.id));
          const funnelDeals = deals.filter((d) => d.stage_id && stageIds.has(d.stage_id) && d.status === "aberto");
          const total = funnelDeals.reduce((s, d) => s + Number(d.value), 0);
          return (
            <div
              key={funnel.id}
              role="button"
              tabIndex={0}
              className="panel flex cursor-pointer items-center gap-2 p-4 transition-colors hover:bg-secondary/40"
              onClick={() =>
                navigate({ to: "/funil/$funnelId", params: { funnelId: funnel.id }, search: { vendorId } })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  navigate({ to: "/funil/$funnelId", params: { funnelId: funnel.id }, search: { vendorId } });
              }}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KanbanSquare className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{funnel.name}</p>
                <p className="text-xs text-muted-foreground">
                  {funnelStages.length} etapa{funnelStages.length === 1 ? "" : "s"} · {funnelDeals.length} negócio
                  {funnelDeals.length === 1 ? "" : "s"} aberto{funnelDeals.length === 1 ? "" : "s"} · {currency(total)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); startEdit(funnel); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(funnel);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </div>
          );
        })}
        {funnels.length === 0 && (
          <div className="panel flex flex-col items-center gap-2 py-16 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum funil cadastrado. Crie o primeiro para começar.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
