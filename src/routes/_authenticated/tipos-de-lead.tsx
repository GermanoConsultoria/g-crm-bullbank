import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
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
import { fetchLeadTypes, fetchMyRole, type LeadType } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/tipos-de-lead")({
  head: () => ({
    meta: [
      { title: "Tipos de lead" },
      { name: "description", content: "Cadastro dos tipos de lead disponíveis para clientes e negócios." },
      { property: "og:title", content: "Tipos de lead" },
      { property: "og:description", content: "Cadastro dos tipos de lead disponíveis para clientes e negócios." },
    ],
  }),
  component: LeadTypesPage,
});

function LeadTypesPage() {
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const { data: leadTypes = [] } = useQuery({ queryKey: ["lead-types"], queryFn: fetchLeadTypes });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeadType | null>(null);
  const [name, setName] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LeadType | null>(null);

  const isAdmin = role === "admin";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["lead-types"] });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("lead_types").update({ name }).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const nextPosition = Math.max(0, ...leadTypes.map((t) => t.position)) + 1;
      const { error } = await supabase.from("lead_types").insert({ name, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Tipo de lead atualizado." : "Tipo de lead criado.");
      setOpen(false);
      setEditing(null);
      setName("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tipo de lead removido.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (leadType: LeadType) => {
    setEditing(leadType);
    setName(leadType.name);
    setOpen(true);
  };

  if (!isAdmin) {
    return (
      <AppShell title="Tipos de lead" subtitle="Acesso restrito">
        <div className="panel flex flex-col items-center gap-2 py-16 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Somente administradores podem gerenciar os tipos de lead.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Tipos de lead"
      subtitle={`${leadTypes.length} cadastrados`}
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
                <Plus className="size-4" /> Novo tipo de lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar tipo de lead" : "Novo tipo de lead"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Facebook Ads" />
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
                  Tem certeza que deseja renomear "{editing?.name}" para "{name}"? Clientes e negócios existentes
                  não serão alterados automaticamente.
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
                <AlertDialogTitle>Excluir tipo de lead</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{pendingDelete?.name}"? Essa ação não pode ser desfeita. Clientes
                  e negócios que já usam esse tipo manterão o valor atual.
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
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leadTypes.map((leadType) => (
              <tr key={leadType.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium">{leadType.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(leadType)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setPendingDelete(leadType)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {leadTypes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum tipo de lead cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
