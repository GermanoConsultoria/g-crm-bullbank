import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { fetchDeals, fetchProfiles, fetchTasks, shortDate, type Task } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas" },
      { name: "description", content: "Tarefas comerciais com prazo, prioridade e acompanhamento da produtividade do vendedor." },
      { property: "og:title", content: "Tarefas" },
      { property: "og:description", content: "Tarefas comerciais com prazo, prioridade e acompanhamento da produtividade do vendedor." },
    ],
  }),
  component: TasksPage,
});

const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const PRIORITY_COLOR: Record<string, string> = {
  alta: "bg-red-500/20 text-red-400 border-red-500/30",
  media: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  baixa: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// ── Calendário ──────────────────────────────────────────────
function CalendarView({
  tasks,
  onToggle,
  onRemove,
}: {
  tasks: Task[];
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = cursor.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const tasksByDate: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    (tasksByDate[key] ??= []).push(t);
  }

  const prev = () => setCursor(new Date(year, month - 1, 1));
  const next = () => setCursor(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="panel p-4">
      {/* header do mês */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="size-4" /></Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="size-4" /></Button>
      </div>

      {/* cabeçalho dos dias */}
      <div className="grid grid-cols-7 mb-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wide text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* células */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-background min-h-[72px]" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = tasksByDate[key] ?? [];
          const isToday = key === todayStr;
          return (
            <div key={key} className={`bg-background min-h-[72px] p-1 ${isToday ? "ring-1 ring-inset ring-primary" : ""}`}>
              <span className={`text-xs font-medium block mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {day}
              </span>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer border ${
                      t.done
                        ? "line-through opacity-40 bg-muted border-transparent"
                        : PRIORITY_COLOR[t.priority] ?? "bg-muted border-transparent"
                    }`}
                    title={t.title}
                    onClick={() => onToggle(t.id, !t.done)}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* legenda */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {Object.entries(PRIORITY_COLOR).map(([p, cls]) => (
          <span key={p} className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────
function TasksPage() {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: deals = [] } = useQuery({ queryKey: ["deals"], queryFn: fetchDeals });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "media",
    deal_id: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const save = useMutation({
    mutationFn: async () => {
      if (editingTask) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: form.title,
            description: form.description || null,
            due_date: form.due_date || null,
            priority: form.priority,
            deal_id: form.deal_id || null,
          })
          .eq("id", editingTask.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        owner_id: userData.user!.id,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        priority: form.priority,
        deal_id: form.deal_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editingTask ? "Tarefa atualizada." : "Tarefa criada.");
      setOpen(false);
      setEditingTask(null);
      setForm({ title: "", description: "", due_date: "", priority: "media", deal_id: "" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      priority: task.priority,
      deal_id: task.deal_id ?? "",
    });
    setOpen(true);
  };

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ done, completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const viewToggle = (
    <div className="flex items-center rounded-md border border-input bg-background p-0.5">
      <button
        onClick={() => setView("lista")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
          view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="size-3.5" /> Lista
      </button>
      <button
        onClick={() => setView("calendario")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
          view === "calendario" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <CalendarDays className="size-3.5" /> Calendário
      </button>
    </div>
  );

  const newTaskBtn = (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setEditingTask(null);
          setForm({ title: "", description: "", due_date: "", priority: "media", deal_id: "" });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingTask ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Negócio relacionado</Label>
            <select
              value={form.deal_id}
              onChange={(e) => setForm((p) => ({ ...p, deal_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Nenhum</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => (editingTask ? setConfirmSaveOpen(true) : save.mutate())}
            disabled={!form.title || save.isPending}
          >
            {editingTask ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Salvar alterações</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja salvar as edições feitas em "{editingTask?.title}"?
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
          <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir "{pendingDelete?.title}"? Essa ação não pode ser desfeita.
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
  );

  return (
    <AppShell
      title="Tarefas"
      subtitle={`${pending.length} pendentes · ${done.length} concluídas`}
      actions={newTaskBtn}
    >
      {view === "calendario" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex justify-end mb-3">{viewToggle}</div>
            <CalendarView
              tasks={tasks}
              onToggle={(id, done) => toggle.mutate({ id, done })}
              onRemove={(id) => remove.mutate(id)}
            />
          </div>
          <div className="panel h-fit p-4">
            <p className="text-sm font-medium">Produtividade por vendedor</p>
            <div className="mt-3 space-y-3">
              {profiles.map((profile) => {
                const mine = tasks.filter((t) => t.owner_id === profile.id);
                const completed = mine.filter((t) => t.done).length;
                const rate = mine.length > 0 ? (completed / mine.length) * 100 : 0;
                return (
                  <div key={profile.id}>
                    <div className="flex justify-between text-xs">
                      <span>{profile.full_name || profile.email}</span>
                      <span className="text-muted-foreground">{completed}/{mine.length}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
              {profiles.length === 0 && <p className="text-xs text-muted-foreground">Sem vendedores.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex justify-end">{viewToggle}</div>
            {[
              { label: "Pendentes", items: pending },
              { label: "Concluídas", items: done },
            ].map((group) => (
              <div key={group.label} className="panel p-4">
                <p className="text-sm font-medium">{group.label}</p>
                <div className="mt-2 divide-y divide-border">
                  {group.items.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 py-3">
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={(checked) => toggle.mutate({ id: task.id, done: Boolean(checked) })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Prazo {shortDate(task.due_date)}</span>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(task)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setPendingDelete(task)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {group.items.length === 0 && (
                    <p className="py-3 text-xs text-muted-foreground">Nada aqui.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="panel h-fit p-4">
            <p className="text-sm font-medium">Produtividade por vendedor</p>
            <div className="mt-3 space-y-3">
              {profiles.map((profile) => {
                const mine = tasks.filter((t) => t.owner_id === profile.id);
                const completed = mine.filter((t) => t.done).length;
                const rate = mine.length > 0 ? (completed / mine.length) * 100 : 0;
                return (
                  <div key={profile.id}>
                    <div className="flex justify-between text-xs">
                      <span>{profile.full_name || profile.email}</span>
                      <span className="text-muted-foreground">
                        {completed}/{mine.length}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
              {profiles.length === 0 && <p className="text-xs text-muted-foreground">Sem vendedores.</p>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
