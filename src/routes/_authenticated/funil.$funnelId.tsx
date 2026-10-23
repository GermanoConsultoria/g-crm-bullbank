import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckSquare, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  currency,
  fetchContacts,
  fetchDeals,
  fetchFunnels,
  fetchLeadTypes,
  fetchProfiles,
  fetchStages,
  fetchTasks,
  shortDate,
  type Deal,
} from "@/lib/crm";

const TASK_PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const emptyDealForm = {
  title: "",
  value: "",
  client_id: "",
  lead_type: "",
  stage_id: "",
  commission_rate: "",
  partner_id: "",
  partner_commission_rate: "",
};

type FunilBoardSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/funil/$funnelId")({
  head: () => ({
    meta: [
      { title: "Funil de Vendas" },
      { name: "description", content: "Quadro kanban com etapas editáveis para acompanhar cada negócio do funil." },
      { property: "og:title", content: "Funil de Vendas" },
      { property: "og:description", content: "Quadro kanban com etapas editáveis para acompanhar cada negócio do funil." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): FunilBoardSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: FunnelBoardPage,
});

function FunnelBoardPage() {
  const { funnelId } = Route.useParams();
  const { vendorId } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: funnels = [] } = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const { data: allStages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: allDeals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: allContacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const { data: leadTypes = [] } = useQuery({ queryKey: ["lead-types"], queryFn: fetchLeadTypes });
  const { data: allTasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: currentUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const allClients = allContacts.filter((c) => c.type === "cliente");
  const partners = allContacts.filter((c) => c.type === "parceiro" && c.is_active);
  const deals = vendorId ? allDeals.filter((d) => d.owner_id === vendorId) : allDeals;
  const clients = vendorId ? allClients.filter((c) => c.owner_id === vendorId) : allClients;
  const tasks = vendorId ? allTasks.filter((t) => t.owner_id === vendorId) : allTasks;

  const funnel = funnels.find((f) => f.id === funnelId);
  const stages = allStages.filter((s) => s.funnel_id === funnelId);
  const normalStages = stages.filter((s) => !s.kind).sort((a, b) => a.position - b.position);
  const wonStage = stages.find((s) => s.kind === "ganho");
  const lostStage = stages.find((s) => s.kind === "perdido");
  const orderedStages = [...normalStages, wonStage, lostStage].filter((s): s is NonNullable<typeof s> => !!s);

  const [dealOpen, setDealOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [newStage, setNewStage] = useState("");
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [confirmSaveDealOpen, setConfirmSaveDealOpen] = useState(false);
  const [pendingDeleteDeal, setPendingDeleteDeal] = useState<Deal | null>(null);
  const [taskDeal, setTaskDeal] = useState<Deal | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", due_date: "", priority: "media" });
  const [form, setForm] = useState(emptyDealForm);

  // Ao abrir o diálogo pra um negócio novo (não edição), pré-preenche a taxa
  // de comissão com a taxa padrão do vendedor responsável, até o usuário trocar.
  useEffect(() => {
    if (dealOpen && !editingDeal) {
      const resolvedOwnerId = vendorId ?? currentUser?.id;
      const defaultRate = profiles.find((p) => p.id === resolvedOwnerId)?.commission_rate ?? 0;
      setForm((p) => ({ ...p, commission_rate: String(defaultRate) }));
    }
  }, [dealOpen, editingDeal, vendorId, currentUser, profiles]);

  // Ao trocar o cliente de um negócio NOVO, pré-preenche parceiro indicador e
  // taxa com o padrão cadastrado no cliente (default_partner_id /
  // default_partner_commission_rate) — sempre sobrescreve ao trocar de
  // cliente, mas o usuário pode editar livremente depois, igual à taxa de
  // comissão do vendedor.
  useEffect(() => {
    if (!dealOpen || editingDeal) return;
    const client = allContacts.find((c) => c.id === form.client_id);
    setForm((p) => ({
      ...p,
      partner_id: client?.default_partner_id ?? "",
      partner_commission_rate:
        client?.default_partner_commission_rate != null ? String(client.default_partner_commission_rate) : "",
    }));
  }, [dealOpen, editingDeal, form.client_id, allContacts]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["deals"] });
    queryClient.invalidateQueries({ queryKey: ["stages"] });
  };

  const createTask = useMutation({
    mutationFn: async () => {
      if (!taskDeal) return;
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        owner_id: vendorId ?? userData.user!.id,
        deal_id: taskDeal.id,
        client_id: taskDeal.client_id,
        title: taskForm.title,
        due_date: taskForm.due_date || null,
        priority: taskForm.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada.");
      setTaskDeal(null);
      setTaskForm({ title: "", due_date: "", priority: "media" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ done, completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveDeal = useMutation({
    mutationFn: async () => {
      const commission_rate = Number(form.commission_rate || 0);
      const partner_id = form.partner_id || null;
      const partner_commission_rate = partner_id ? Number(form.partner_commission_rate || 0) : null;

      if (editingDeal) {
        const { error } = await supabase
          .from("deals")
          .update({
            title: form.title,
            value: Number(form.value || 0),
            client_id: form.client_id || null,
            lead_type: form.lead_type,
            stage_id: form.stage_id || editingDeal.stage_id,
            commission_rate,
            partner_id,
            partner_commission_rate,
          })
          .eq("id", editingDeal.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("deals").insert({
        owner_id: vendorId ?? userData.user!.id,
        title: form.title,
        value: Number(form.value || 0),
        client_id: form.client_id || null,
        lead_type: form.lead_type,
        stage_id: form.stage_id || normalStages[0]?.id || null,
        commission_rate,
        partner_id,
        partner_commission_rate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editingDeal ? "Negócio atualizado." : "Negócio criado.");
      setDealOpen(false);
      setEditingDeal(null);
      setForm(emptyDealForm);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setForm({
      title: deal.title,
      value: String(deal.value),
      client_id: deal.client_id ?? "",
      lead_type: deal.lead_type,
      stage_id: deal.stage_id ?? "",
      commission_rate: String(deal.commission_rate),
      partner_id: deal.partner_id ?? "",
      partner_commission_rate: deal.partner_commission_rate != null ? String(deal.partner_commission_rate) : "",
    });
    setDealOpen(true);
  };

  const updateDeal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Deal> }) => {
      const { error } = await supabase.from("deals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stages")
        .insert({ name: newStage, funnel_id: funnelId, position: (normalStages.at(-1)?.position ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNewStage("");
      toast.success("Etapa criada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renameStage = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("stages").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingStage(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Etapa removida.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name;

  return (
    <AppShell
      title={funnel?.name ?? "Funil de vendas"}
      subtitle="Arraste os negócios entre as etapas"
      actions={
        <>
        <Button size="sm" variant="ghost" onClick={() => router.history.back()}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>

        <Dialog
          open={dealOpen}
          onOpenChange={(next) => {
            setDealOpen(next);
            if (!next) {
              setEditingDeal(null);
              setForm(emptyDealForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Novo negócio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDeal ? "Editar negócio" : "Novo negócio"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de lead</Label>
                  <select
                    value={form.lead_type}
                    onChange={(e) => setForm((p) => ({ ...p, lead_type: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {leadTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <select
                    value={form.client_id}
                    onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa</Label>
                  <select
                    value={form.stage_id}
                    onChange={(e) => setForm((p) => ({ ...p, stage_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {normalStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Taxa de comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.commission_rate}
                    onChange={(e) => setForm((p) => ({ ...p, commission_rate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Parceiro indicador</Label>
                  <select
                    value={form.partner_id}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        partner_id: e.target.value,
                        partner_commission_rate: e.target.value ? p.partner_commission_rate : "",
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem parceiro</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                {form.partner_id && (
                  <div className="space-y-1.5">
                    <Label>Comissão do parceiro (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.partner_commission_rate}
                      onChange={(e) => setForm((p) => ({ ...p, partner_commission_rate: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => (editingDeal ? setConfirmSaveDealOpen(true) : saveDeal.mutate())}
                disabled={!form.title || !form.lead_type || saveDeal.isPending}
              >
                {editingDeal ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmSaveDealOpen} onOpenChange={setConfirmSaveDealOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar alterações</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja salvar as edições feitas em "{editingDeal?.title}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmSaveDealOpen(false);
                  saveDeal.mutate();
                }}
              >
                Salvar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!pendingDeleteDeal} onOpenChange={(next) => !next && setPendingDeleteDeal(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir negócio</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{pendingDeleteDeal?.title}"? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                onClick={() => {
                  if (pendingDeleteDeal) removeDeal.mutate(pendingDeleteDeal.id);
                  setPendingDeleteDeal(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!taskDeal} onOpenChange={(next) => !next && setTaskDeal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tarefa — {taskDeal?.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm((p) => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createTask.mutate()} disabled={!taskForm.title || createTask.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      }
    >
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-slim">
        {orderedStages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          const total = stageDeals.reduce((s, d) => s + Number(d.value), 0);
          const isFixed = !!stage.kind;
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) {
                  const patch =
                    stage.kind === "ganho"
                      ? { stage_id: stage.id, status: "ganho", closed_at: new Date().toISOString() }
                      : stage.kind === "perdido"
                        ? { stage_id: stage.id, status: "perdido", closed_at: new Date().toISOString() }
                        : { stage_id: stage.id, status: "aberto", closed_at: null };
                  updateDeal.mutate({ id: dragging, patch });
                }
                setDragging(null);
              }}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface/60"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                {editingStage?.id === stage.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      className="h-7"
                      value={editingStage.name}
                      onChange={(e) => setEditingStage({ id: stage.id, name: e.target.value })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => renameStage.mutate({ id: stage.id, name: editingStage.name })}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingStage(null)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : isFixed ? (
                  <>
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
                  </>
                ) : (
                  <>
                    <button
                      className="text-left text-sm font-medium hover:text-primary"
                      onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                    >
                      {stage.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => removeStage.mutate(stage.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
              <p className="px-3 pt-2 text-xs text-muted-foreground">{currency(total)}</p>
              <div className="flex flex-col gap-2 p-3">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal.id)}
                    className="group cursor-grab rounded-md border border-border bg-card p-3 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{deal.title}</p>
                      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{clientName(deal.client_id) ?? "Sem cliente"}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">{currency(Number(deal.value))}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {deal.lead_type}
                      </Badge>
                    </div>
                    {(() => {
                      const dealTasks = tasks.filter((t) => t.deal_id === deal.id);
                      if (dealTasks.length === 0) return null;
                      return (
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
                          {dealTasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-1.5">
                              <Checkbox
                                checked={task.done}
                                onCheckedChange={(checked) =>
                                  toggleTask.mutate({ id: task.id, done: Boolean(checked) })
                                }
                                className="mt-0.5 size-3.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-xs ${
                                    task.done ? "text-muted-foreground line-through" : ""
                                  }`}
                                  title={task.title}
                                >
                                  {task.title}
                                </p>
                                {task.due_date && (
                                  <p className="text-[10px] text-muted-foreground">{shortDate(task.due_date)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="mt-2 flex gap-1">
                      {isFixed ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 flex-1 text-xs"
                          onClick={() =>
                            updateDeal.mutate({
                              id: deal.id,
                              patch: { status: "aberto", closed_at: null, stage_id: normalStages[0]?.id ?? null },
                            })
                          }
                        >
                          Reabrir
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 flex-1 text-xs"
                            onClick={() =>
                              updateDeal.mutate({
                                id: deal.id,
                                patch: {
                                  status: "ganho",
                                  closed_at: new Date().toISOString(),
                                  stage_id: wonStage?.id ?? deal.stage_id,
                                },
                              })
                            }
                          >
                            Ganho
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 flex-1 text-xs"
                            onClick={() =>
                              updateDeal.mutate({
                                id: deal.id,
                                patch: {
                                  status: "perdido",
                                  closed_at: new Date().toISOString(),
                                  stage_id: lostStage?.id ?? deal.stage_id,
                                },
                              })
                            }
                          >
                            Perdido
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setTaskDeal(deal)}
                        title="Nova tarefa"
                      >
                        <CheckSquare className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => startEditDeal(deal)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setPendingDeleteDeal(deal)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Solte um negócio aqui
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div className="w-64 shrink-0 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium">Nova etapa</p>
          <Input
            className="mt-2 h-8"
            placeholder="Ex: Follow-up"
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
          />
          <Button size="sm" className="mt-2 w-full" disabled={!newStage} onClick={() => addStage.mutate()}>
            Adicionar
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
