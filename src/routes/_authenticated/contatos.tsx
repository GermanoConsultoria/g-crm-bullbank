import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchContacts,
  fetchLeadTypes,
  fetchMyRole,
  fetchProfiles,
  shortDate,
  type Contact,
  type ContactType,
} from "@/lib/crm";

type ContatosSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos" },
      { name: "description", content: "Cadastro de clientes e parceiros em um só lugar." },
      { property: "og:title", content: "Contatos" },
      { property: "og:description", content: "Cadastro de clientes e parceiros em um só lugar." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): ContatosSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: ContatosPage,
});

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  lead_type: string;
  source: string;
  document: string;
  segment: string;
  specialty: string;
};

const empty: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  notes: "",
  lead_type: "",
  source: "",
  document: "",
  segment: "",
  specialty: "",
};

function ContatosPage() {
  const { vendorId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const isAdmin = role === "admin";
  const { data: currentUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: allContacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const { data: allProfiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled: isAdmin });
  const { data: leadTypes = [] } = useQuery({ queryKey: ["lead-types"], queryFn: fetchLeadTypes });

  const [tipo, setTipo] = useState<ContactType>("cliente");
  const byType = allContacts.filter((c) => c.type === tipo);
  const contacts = tipo === "cliente" && vendorId ? byType.filter((c) => c.owner_id === vendorId) : byType;
  const sellerName = tipo === "cliente" && vendorId ? allProfiles.find((p) => p.id === vendorId)?.full_name : null;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [ownerId, setOwnerId] = useState("");
  const [search, setSearch] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Contact | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Enquanto o diálogo está aberto para um cadastro novo de cliente, mantém
  // o responsável padrão (pasta do vendedor atual, ou o próprio usuário)
  // pré-selecionado no campo visível só para admin, até ele trocar.
  useEffect(() => {
    if (open && !editing && tipo === "cliente") {
      setOwnerId(vendorId ?? currentUser?.id ?? "");
    }
  }, [open, editing, tipo, vendorId, currentUser]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const common = {
        name: form.name,
        company: form.company,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
      };
      const specific =
        tipo === "cliente"
          ? { lead_type: form.lead_type, source: form.source }
          : { document: form.document, segment: form.segment, specialty: form.specialty };

      if (editing) {
        const resolvedOwnerId =
          tipo === "cliente" && isAdmin ? ownerId || userData.user!.id : editing.owner_id;
        const { error } = await supabase
          .from("contacts")
          .update({ ...common, ...specific, owner_id: resolvedOwnerId, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const resolvedOwnerId =
        tipo === "cliente"
          ? isAdmin
            ? ownerId || userData.user!.id
            : vendorId ?? userData.user!.id
          : userData.user!.id;

      const { error } = await supabase
        .from("contacts")
        .insert({ ...common, ...specific, type: tipo, owner_id: resolvedOwnerId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Contato atualizado." : "Contato cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cliente removido.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("contacts")
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

  const startEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      company: contact.company ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      notes: contact.notes ?? "",
      lead_type: contact.lead_type ?? "",
      source: contact.source ?? "",
      document: contact.document ?? "",
      segment: contact.segment ?? "",
      specialty: contact.specialty ?? "",
    });
    setOwnerId(contact.owner_id);
    setOpen(true);
  };

  const filtered = contacts.filter((c) =>
      [c.name, c.company, c.email, c.phone, c.lead_type, c.segment]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

  const typeLabel = tipo === "cliente" ? "cliente" : "parceiro";
  const canShowActions = tipo === "parceiro" ? isAdmin : true;

  return (
    <AppShell
      title="Contatos"
      subtitle={sellerName ? `${sellerName} · ${contacts.length} cadastros` : `${contacts.length} cadastros`}
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
                <Plus className="size-4" /> Novo {typeLabel}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? `Editar ${typeLabel}` : `Novo ${typeLabel}`}
                </DialogTitle>
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
                {tipo === "parceiro" && (
                  <div className="space-y-1.5">
                    <Label>CNPJ/CPF</Label>
                    <Input value={form.document} onChange={set("document")} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={set("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={set("email")} />
                </div>
                {tipo === "cliente" ? (
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
                ) : (
                  <div className="space-y-1.5">
                    <Label>Segmento de atuação</Label>
                    <Input value={form.segment} onChange={set("segment")} />
                  </div>
                )}
                {tipo === "parceiro" && (
                  <div className="space-y-1.5">
                    <Label>Especialidade</Label>
                    <Input value={form.specialty} onChange={set("specialty")} />
                  </div>
                )}
                {tipo === "cliente" && isAdmin && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Vendedor responsável (somente admin)</Label>
                    <Select value={ownerId} onValueChange={setOwnerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.email || "Sem nome"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={set("notes")} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => (editing ? setConfirmSaveOpen(true) : save.mutate())}
                  disabled={!form.name || (tipo === "cliente" && !form.lead_type) || save.isPending}
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
      <Tabs value={tipo} onValueChange={(v) => setTipo(v as ContactType)} className="mb-4">
        <TabsList>
          <TabsTrigger value="cliente">Clientes</TabsTrigger>
          <TabsTrigger value="parceiro">Parceiros</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              {tipo === "cliente" ? (
                <th className="px-4 py-3 font-medium">Tipo de lead</th>
              ) : (
                <>
                  <th className="px-4 py-3 font-medium">Segmento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </>
              )}
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((contact) => (
              <tr key={contact.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium">{contact.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{contact.company || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{contact.email || contact.phone || "—"}</td>
                {tipo === "cliente" ? (
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{contact.lead_type}</Badge>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      {contact.segment ? <Badge variant="secondary">{contact.segment}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          contact.is_active
                            ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {contact.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-muted-foreground">{shortDate(contact.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {canShowActions && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(contact)}>
                        <Pencil className="size-4" />
                      </Button>
                      {tipo === "cliente" ? (
                        <Button size="icon" variant="ghost" onClick={() => setPendingDelete(contact)}>
                          <Trash2 className="size-4" />
                        </Button>
                      ) : contact.is_active ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={toggleActive.isPending}
                          title="Desativar"
                          onClick={() => setPendingDeactivate(contact)}
                        >
                          <PowerOff className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={toggleActive.isPending}
                          title="Ativar"
                          onClick={() => toggleActive.mutate({ id: contact.id, active: true })}
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
                <td colSpan={tipo === "cliente" ? 6 : 7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum {typeLabel} encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
