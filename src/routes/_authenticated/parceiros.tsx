import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Info, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { fetchMyRole, fetchPartners, shortDate, type Partner } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/parceiros")({
  head: () => ({
    meta: [
      { title: "Parceiros" },
      { name: "description", content: "Cadastro estruturado de parceiros comerciais." },
      { property: "og:title", content: "Parceiros" },
      { property: "og:description", content: "Cadastro estruturado de parceiros comerciais." },
    ],
  }),
  component: PartnersPage,
});

type FormState = {
  name: string;
  company: string;
  document: string;
  email: string;
  phone: string;
  segment: string;
  specialty: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  company: "",
  document: "",
  email: "",
  phone: "",
  segment: "",
  specialty: "",
  notes: "",
};

type Filter = "all" | "active" | "review";

function PartnersPage() {
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: fetchPartners });
  const isAdmin = role === "admin";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<Partner | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["partners"] });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("partners")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("partners").insert({ ...form, created_by: userData.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Parceiro atualizado." : "Parceiro cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("partners")
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (partner: Partner) => {
    setEditing(partner);
    setForm({
      name: partner.name,
      company: partner.company ?? "",
      document: partner.document ?? "",
      email: partner.email ?? "",
      phone: partner.phone ?? "",
      segment: partner.segment ?? "",
      specialty: partner.specialty ?? "",
      notes: partner.notes ?? "",
    });
    setOpen(true);
  };

  const filtered = partners
    .filter((p) => {
      if (filter === "active") return p.is_active;
      if (filter === "review") return !!p.import_review_reason;
      return true;
    })
    .filter((p) =>
      [p.name, p.company, p.email, p.phone, p.segment].join(" ").toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <AppShell
      title="Parceiros"
      subtitle={`${partners.length} cadastrados`}
      actions={
        <>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-40 sm:w-56"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="review">Pendentes de revisão</option>
          </select>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditing(null);
                setForm(empty);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> Novo parceiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={set("name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={set("company")} />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ/CPF</Label>
                  <Input value={form.document} onChange={set("document")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={set("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={set("email")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Segmento de atuação</Label>
                  <Input value={form.segment} onChange={set("segment")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Especialidade</Label>
                  <Input value={form.specialty} onChange={set("specialty")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={set("notes")} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => (editing ? setConfirmSaveOpen(true) : save.mutate())}
                  disabled={!form.name || save.isPending}
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
                  Tem certeza que deseja salvar as edições feitas em "{editing?.name}"?
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

          <AlertDialog open={!!pendingDeactivate} onOpenChange={(next) => !next && setPendingDeactivate(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desativar parceiro</AlertDialogTitle>
                <AlertDialogDescription>
                  "{pendingDeactivate?.name}" deixará de aparecer como parceiro ativo. O cadastro não é
                  apagado e pode ser reativado depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingDeactivate) toggleActive.mutate({ id: pendingDeactivate.id, active: false });
                    setPendingDeactivate(null);
                  }}
                >
                  Desativar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Segmento</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((partner) => (
              <tr key={partner.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    {partner.name}
                    {partner.import_review_reason && (
                      <span title={partner.import_review_reason}>
                        <Info className="size-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{partner.company || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{partner.email || partner.phone || "—"}</td>
                <td className="px-4 py-3">
                  {partner.segment ? <Badge variant="secondary">{partner.segment}</Badge> : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      partner.is_active
                        ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {partner.is_active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(partner.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(partner)}>
                        <Pencil className="size-4" />
                      </Button>
                      {partner.is_active ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={toggleActive.isPending}
                          title="Desativar"
                          onClick={() => setPendingDeactivate(partner)}
                        >
                          <PowerOff className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={toggleActive.isPending}
                          title="Ativar"
                          onClick={() => toggleActive.mutate({ id: partner.id, active: true })}
                        >
                          <Power className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum parceiro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
