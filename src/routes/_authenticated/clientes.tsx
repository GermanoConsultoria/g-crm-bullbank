import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { fetchClients, fetchLeadTypes, fetchProfiles, shortDate, type Client } from "@/lib/crm";

type ClientesSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes" },
      { name: "description", content: "Cadastro de clientes e leads com origem, contato e tipo de lead." },
      { property: "og:title", content: "Clientes" },
      { property: "og:description", content: "Cadastro de clientes e leads com origem, contato e tipo de lead." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): ClientesSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: ClientsPage,
});

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  lead_type: string;
  source: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  lead_type: "",
  source: "",
  notes: "",
};

function ClientsPage() {
  const { vendorId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: allClients = [] } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: allProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled: !!vendorId });
  const { data: leadTypes = [] } = useQuery({ queryKey: ["lead-types"], queryFn: fetchLeadTypes });
  const clients = vendorId ? allClients.filter((c) => c.owner_id === vendorId) : allClients;
  const sellerName = vendorId ? allProfiles.find((p) => p.id === vendorId)?.full_name : null;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("clients").update(form).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("clients").insert({ ...form, owner_id: vendorId ?? userData.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Cliente atualizado." : "Cliente cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      company: client.company ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      lead_type: client.lead_type,
      source: client.source ?? "",
      notes: client.notes ?? "",
    });
    setOpen(true);
  };

  const filtered = clients.filter((c) =>
    [c.name, c.company, c.email, c.lead_type].join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell
      title="Clientes"
      subtitle={sellerName ? `${sellerName} · ${clients.length} cadastros` : `${clients.length} cadastros`}
      actions={
        <>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-40 sm:w-56"
          />
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
                <Plus className="size-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
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
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={set("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={set("email")} />
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={set("notes")} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => (editing ? setConfirmSaveOpen(true) : save.mutate())}
                  disabled={!form.name || !form.lead_type || save.isPending}
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

          <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{pendingDelete?.name}"? Essa ação não pode ser desfeita.
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
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Tipo de lead</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((client) => (
              <tr key={client.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium">{client.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{client.company || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {client.email || client.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{client.lead_type}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(client.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(client)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setPendingDelete(client)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
